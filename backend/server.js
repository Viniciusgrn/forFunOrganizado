const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3000;

// --- CONFIGURAÇÃO DO ARMAZENAMENTO DE ARQUIVOS (MULTER) ---

const uploadDir = path.join(path.dirname(__dirname), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 }
}).array('mediaFiles', 5);

// --- MIDDLEWARE GLOBAL ---
app.use(bodyParser.urlencoded({ extended: true }));

// --- CONFIGURAÇÃO DO BANCO DE DADOS (SQLite) ---

const DB_PATH = path.join(__dirname, 'marketplace.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error("Erro ao abrir o banco de dados:", err.message);
    } else {
        console.log("Conectado ao banco de dados SQLite.");
        initializeDB();
    }
});

// Inicialização e Criação das Tabelas (ESQUEMA COMPLETO)
const initializeDB = () => {
    // Tabela de Usuário
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT
    )`, (err) => {
        if (!err) {
            db.get(`SELECT id FROM users WHERE username = 'admin'`, (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO users (username, password) VALUES ('eduardo', 'Centauro@10')`);
                    console.log("Usuário admin padrão criado (admin/123456).");
                }
            });
        }
    });

    // Tabela de Produtos - Incluindo shopee_clicks
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price TEXT, description TEXT, shopeeLink TEXT,
        views_count INTEGER DEFAULT 0, is_featured INTEGER DEFAULT 0,
        shopee_clicks INTEGER DEFAULT 0     
    )`);

    // TABELA DE MÍDIA - Incluindo is_main
    db.run(`CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, file_path TEXT, media_type TEXT,
        is_main INTEGER DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);
};


// --- MIDDLEWARE E ROTAS DE AUTENTICAÇÃO E LOGIN ---
const isAuthenticated = (req, res, next) => {
    if (req.headers.authorization === 'Bearer valid_admin_token') {
        return next();
    }
    res.status(401).send({ message: 'Não autorizado. Faça login.' });
};

app.post('/api/login', bodyParser.json(), (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, row) => {
        if (err || !row) return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
        res.json({ success: true, token: 'valid_admin_token' });
    });
});


// --- ROTAS DE PRODUTOS (CRUD, MÍDIA E TRACKING) ---

// Auxiliar: Função para buscar as mídias de um produto (Ordena por IS_MAIN)
const getProductMedia = (productId) => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT file_path, media_type, is_main FROM media WHERE product_id = ? ORDER BY is_main DESC, id ASC`, productId, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};

// LER TODOS OS PRODUTOS (GET) - INCLUI MÍDIAS
app.get('/api/products', async (req, res) => {
    db.all(`SELECT * FROM products`, [], async (err, rows) => {
        if (err) return res.status(500).send({ message: "Erro ao consultar produtos." });

        const productsWithMedia = await Promise.all(rows.map(async (product) => {
            product.media = await getProductMedia(product.id);
            return product;
        }));

        res.json(productsWithMedia);
    });
});

// CRIAR PRODUTO (POST) - MARCA O PRIMEIRO UPLOAD COMO IS_MAIN=1
app.post('/api/products', isAuthenticated, upload, (req, res) => {
    const { name, price, description, shopeeLink } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).send({ message: "É necessário fazer upload de pelo menos uma imagem/vídeo." });
    }

    // Insere o novo produto na tabela 'products'
    db.run(`INSERT INTO products (name, price, description, shopeeLink, views_count, is_featured, shopee_clicks) VALUES (?, ?, ?, ?, 0, 0, 0)`,
        [name, price, description, shopeeLink],
        function (err) {
            if (err) {
                if (req.files) req.files.forEach(file => fs.unlinkSync(file.path));
                return res.status(500).send({ message: "Erro ao criar produto: " + err.message });
            }

            const productId = this.lastID;
            const mediaInserts = [];

            // Salva os caminhos dos arquivos na tabela 'media'
            files.forEach((file, index) => {
                const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';
                const filePath = '/uploads/' + path.basename(file.path);
                const isMain = index === 0 ? 1 : 0; // O PRIMEIRO ARQUIVO É O PRINCIPAL

                mediaInserts.push(new Promise((resolve, reject) => {
                    db.run(`INSERT INTO media (product_id, file_path, media_type, is_main) VALUES (?, ?, ?, ?)`,
                        [productId, filePath, mediaType, isMain],
                        (err) => err ? reject(err) : resolve()
                    );
                }));
            });

            Promise.all(mediaInserts)
                .then(() => res.status(201).json({ id: productId, name, price, description, shopeeLink, mediaCount: files.length }))
                .catch(err => {
                    console.error("Erro ao salvar mídias:", err);
                    res.status(500).send({ message: "Produto criado, mas houve falha no upload de mídia." });
                });
        }
    );
});

// ATUALIZAR PRODUTO (PUT) - Apenas atualiza campos de texto
app.put('/api/products/:id', isAuthenticated, bodyParser.json(), (req, res) => {
    const id = parseInt(req.params.id);
    const { name, price, description, shopeeLink } = req.body;

    const sql = `UPDATE products SET name = ?, price = ?, description = ?, shopeeLink = ? WHERE id = ?`;

    db.run(sql, [name, price, description, shopeeLink, id], function (err) {
        if (err || this.changes === 0) {
            if (this.changes === 0) return res.status(404).send({ message: "Produto não encontrado ou nenhum dado alterado." });
            return res.status(500).send({ message: "Erro ao atualizar produto." });
        }
        res.json({ id, name, price, description, shopeeLink });
    });
});

// ROTA PARA BUSCAR PRODUTOS EM DESTAQUE (Carrossel Principal)
app.get('/api/featured', async (req, res) => {
    db.all(`SELECT * FROM products WHERE is_featured = 1`, [], async (err, rows) => {
        if (err) return res.status(500).send({ message: "Erro ao buscar destaques." });

        const productsWithMedia = await Promise.all(rows.map(async (product) => {
            product.media = await getProductMedia(product.id);
            return product;
        }));

        res.json(productsWithMedia);
    });
});


// ROTA PARA ATUALIZAR STATUS DE DESTAQUE (Feature)
app.put('/api/products/feature/:id', isAuthenticated, bodyParser.json(), (req, res) => {
    const id = parseInt(req.params.id);
    const is_featured = req.body.is_featured ? 1 : 0;

    const sql = `UPDATE products SET is_featured = ? WHERE id = ?`;
    db.run(sql, [is_featured, id], function (err) {
        if (err || this.changes === 0) return res.status(500).send({ message: "Erro ao atualizar destaque." });
        res.json({ id, is_featured });
    });
});

// ROTA PARA ATUALIZAR STATUS DE MÍDIA PRINCIPAL
app.put('/api/media/set-main/:mediaId', isAuthenticated, bodyParser.json(), (req, res) => {
    const mediaId = parseInt(req.params.mediaId);

    // 1. Encontra o ID do produto associado a esta mídia
    db.get(`SELECT product_id FROM media WHERE id = ?`, mediaId, (err, row) => {
        if (err || !row) return res.status(404).send({ message: "Mídia não encontrada." });
        const productId = row.product_id;

        // 2. Transação: Zera todas as mídias do produto (is_main = 0)
        db.run(`UPDATE media SET is_main = 0 WHERE product_id = ?`, productId, (err) => {
            if (err) return res.status(500).send({ message: "Erro ao zerar mídias." });

            // 3. Define a mídia escolhida como principal (is_main = 1)
            db.run(`UPDATE media SET is_main = 1 WHERE id = ?`, mediaId, function (err) {
                if (err) return res.status(500).send({ message: "Erro ao definir nova principal." });
                res.status(200).send({ message: "Nova imagem principal definida com sucesso!" });
            });
        });
    });
});


// ROTA PARA CONTAR VISUALIZAÇÕES (Views Count)
app.post('/api/products/view/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const sql = `UPDATE products SET views_count = views_count + 1 WHERE id = ?`;
    db.run(sql, [id], function (err) { // ✅ CORRIGIDO: Passando [id] como array
        if (err || this.changes === 0) return res.status(500).send({ message: "Erro ao registrar visualização." });
        res.status(200).send({ message: "Visualização registrada." });
    });
});

// ROTA PARA CONTAR CLIQUES NA SHOPEE (NOVO)
app.post('/api/products/click/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const sql = `UPDATE products SET shopee_clicks = shopee_clicks + 1 WHERE id = ?`;
    db.run(sql, [id], function (err) { // ✅ CORRIGIDO: Passando [id] como array
        if (err || this.changes === 0) return res.status(500).send({ message: "Erro ao registrar clique." });
        res.status(200).send({ message: "Clique na Shopee registrado." });
    });
});


// DELETAR PRODUTO (DELETE) - Inclui a exclusão dos arquivos físicos
app.delete('/api/products/:id', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const mediaPaths = await getProductMedia(id);

    db.run(`DELETE FROM products WHERE id = ?`, id, function (err) {
        if (err || this.changes === 0) return res.status(404).send({ message: "Produto não encontrado." });

        // Deleta os arquivos físicos
        mediaPaths.forEach(media => {
            const fullPath = path.join(uploadDir, path.basename(media.file_path));
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        });

        res.status(204).send();
    });
});


// --- SERVIR ARQUIVOS ESTÁTICOS ---
app.use(express.static(path.join(path.dirname(__dirname))));
app.use('/uploads', express.static(uploadDir));
app.use('/admin', express.static(path.join(path.dirname(__dirname), 'admin')));


// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Pasta de uploads: ${uploadDir}`);
    console.log(`Admin Dashboard em http://localhost:${PORT}/admin/login.html`);
});