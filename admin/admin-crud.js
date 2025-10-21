const API_URL = '/api/products';
const authToken = localStorage.getItem('authToken');

// 1. Verificar Autenticação
if (!authToken) {
    window.location.href = 'login.html';
}

// 2. Função para Obter Headers com Token (APENAS Authorization para FormData)
const getHeaders = () => ({
    'Authorization': `Bearer ${authToken}`
});

// Função de Limpeza Comum (Usada após sucesso em POST/PUT)
const resetFormAndLoad = () => {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('saveButton').textContent = 'Salvar Produto';
    document.getElementById('currentMedia').innerHTML = '';
    loadProducts();
};


// 3. Função para Enviar Formulário (CREATE/UPDATE)
document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('productId').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    // --- LÓGICA DE CRIAÇÃO (POST com arquivos) ---
    if (method === 'POST') {
        const formData = new FormData(e.target);

        // CRÍTICO: Validação de arquivo (verifica se o campo mediaFiles está vazio)
        const mediaFiles = document.getElementById('mediaFiles');
        if (mediaFiles.files.length === 0) {
            alert("É necessário selecionar pelo menos uma imagem ou vídeo para criar o produto.");
            return;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': getHeaders().Authorization },
                body: formData
            });

            if (response.ok) {
                alert('Produto criado com sucesso!');
                resetFormAndLoad();
            } else {
                alert('Falha ao salvar produto: ' + response.statusText);
            }
        } catch (error) {
            alert('Erro de conexão ao salvar produto.');
        }
        return;
    }

    // --- ATUALIZAÇÃO (PUT, apenas texto) ---
    if (method === 'PUT') {
        const productData = {
            name: document.getElementById('name').value,
            price: document.getElementById('price').value,
            shopeeLink: document.getElementById('shopeeLink').value,
            description: document.getElementById('description').value,
        };

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': getHeaders().Authorization
                },
                body: JSON.stringify(productData)
            });

            if (response.ok) {
                alert('Produto atualizado com sucesso!');
                resetFormAndLoad();
            } else {
                alert('Falha ao atualizar produto: ' + response.statusText);
            }
        } catch (error) {
            alert('Erro de conexão ao atualizar produto.');
        }
    }
});


// 4. Função para Preencher Formulário para Edição
const editProduct = (product) => {
    document.getElementById('productId').value = product.id;
    document.getElementById('name').value = product.name;
    document.getElementById('price').value = product.price;
    document.getElementById('shopeeLink').value = product.shopeeLink;
    document.getElementById('description').value = product.description;
    document.getElementById('saveButton').textContent = 'Atualizar Produto';

    // ✅ NOVO: Mostra as mídias existentes com prévia
    const mediaArea = document.getElementById('currentMedia');
    mediaArea.innerHTML = '';

    if (product.media && product.media.length > 0) {
        const mainMedia = product.media[0];
        
        const mediaTag = mainMedia.media_type && mainMedia.media_type.startsWith('video')
            ? `<video controls src="${mainMedia.file_path}" style="max-width: 100px; max-height: 100px; border-radius: 5px; margin-top: 5px;"></video>`
            : `<img src="${mainMedia.file_path}" style="max-width: 100px; max-height: 100px; border-radius: 5px; margin-top: 5px;">`;

        mediaArea.innerHTML = `
            <p>Mídia Principal (${product.media.length} arquivos):</p>
            ${mediaTag}
            <p><small>A edição atualiza apenas o texto. Para trocar mídias, você precisa deletar e recriar o produto.</small></p>
        `;
    } else {
         mediaArea.innerHTML = '<p>Nenhuma mídia anexada.</p>';
    }
};

// 5. Função para Deletar Item (DELETE)
const deleteProduct = async (id) => {
    if (!confirm('Tem certeza que deseja deletar este produto? (Isso também deletará os arquivos)')) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });

        if (response.ok) {
            alert('Produto e mídias deletados com sucesso!');
            loadProducts();
        } else {
            alert('Falha ao deletar produto: ' + response.statusText);
        }
    } catch (error) {
        alert('Erro de conexão ao deletar produto.');
    }
};


// 6. Função para Carregar Itens (READ)
const loadProducts = async () => {
    try {
        const response = await fetch(API_URL);
        const products = await response.json();

        const tbody = document.querySelector('#productsTable tbody');
        tbody.innerHTML = '';

        products.forEach(product => {
            const row = tbody.insertRow();
            row.insertCell().textContent = product.id;

            // Exibe o nome e a contagem de mídias
            const mediaCount = product.media ? product.media.length : 0;
            const nameCell = row.insertCell();
            nameCell.innerHTML = `<strong>${product.name}</strong><br><small>Mídias: ${mediaCount}</small>`;

            
            row.insertCell().textContent = product.views_count || 0;

            // ✅ CORREÇÃO: ADICIONA A CÉLULA DE CLIQUES SHOPEE
            row.insertCell().textContent = product.shopee_clicks || 0;

            // --- Célula de Destaque (Checkbox) ---
            const featureCell = row.insertCell();
            const featureCheckbox = document.createElement('input');
            featureCheckbox.type = 'checkbox';
            featureCheckbox.checked = product.is_featured === 1;

            featureCheckbox.addEventListener('change', (e) => {
                updateFeatureStatus(product.id, e.target.checked);
            });
            featureCell.appendChild(featureCheckbox);

            // --- Célula de Ações ---
            const actionCell = row.insertCell();
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Editar';
            editBtn.onclick = () => editProduct(product);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Deletar';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = () => deleteProduct(product.id);

            actionCell.appendChild(editBtn);
            actionCell.appendChild(deleteBtn);
        });
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
};

// 7. Função para Atualizar Status de Destaque
const updateFeatureStatus = async (productId, isChecked) => {
    try {
        const response = await fetch(`/api/products/feature/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getHeaders().Authorization
            },
            body: JSON.stringify({ is_featured: isChecked })
        });

        if (response.ok) {
            loadProducts();
        } else {
            alert('Falha ao atualizar o status de destaque. Tente novamente.');
            loadProducts();
        }
    } catch (error) {
        console.error('Erro de conexão ao atualizar destaque:', error);
        alert('Erro de conexão com o servidor. Status de destaque não alterado.');
        loadProducts();
    }
};

// 8. Logout
document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
});

// Carrega os dados ao iniciar
loadProducts();