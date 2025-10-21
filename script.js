// VARIÁVEL GLOBAL: Armazenará os dados de produtos para busca dinâmica
let allProductsData = [];

// =================================================================
// 1. INICIALIZAÇÃO E CONTROLE GERAL
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // ⚠️ ANIMAÇÃO DA BORBOLETA
    activateSparkle();

    // Roteamento simples: Página de detalhes vs. Página principal
    if (document.body.classList.contains('product-details-container-body')) {
        loadProductDetails();
    } else {
        initHomePage();
    }
});

// =================================================================
// 2. FUNÇÕES DE BUSCA DE PRODUTOS (API)
// =================================================================

/** Busca todos os produtos para o grid e sugestões. */
const fetchProducts = async () => {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) {
            console.error('Falha ao carregar produtos do servidor.');
            return [];
        }
        return response.json();
    } catch (error) {
        console.error('Erro de conexão ao buscar produtos:', error);
        return [];
    }
};

/** Busca apenas produtos marcados como DESTAQUE. */
const fetchFeaturedProducts = async () => {
    try {
        const response = await fetch('/api/featured');
        if (!response.ok) {
            console.error('Falha ao carregar produtos em destaque.');
            return [];
        }
        return response.json();
    } catch (error) {
        console.error('Erro de conexão ao buscar destaques:', error);
        return [];
    }
};


// =================================================================
// 3. LÓGICA DA PÁGINA INICIAL (Home)
// =================================================================

async function initHomePage() {
    // 1. CARREGA TODOS OS DADOS
    allProductsData = await fetchProducts();
    const featuredProducts = await fetchFeaturedProducts();

    // 2. CONFIGURAÇÃO DA BUSCA DINÂMICA
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // 3. INICIALIZA COMPONENTES DE CONTEÚDO
    initCarousel(featuredProducts); // Carrossel Principal (Destaques)
    renderSuggestionsCarousel(allProductsData); // Carrossel de Sugestões
    renderProductGrid(allProductsData); // Grid Principal
}


// Função para lidar com a busca dinâmica
function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.trim().toLowerCase();

    const filteredProducts = allProductsData.filter(product =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm)
    );

    renderProductGrid(filteredProducts);
}

// =================================================================
// 4. LÓGICA DE RENDERIZAÇÃO DE PRODUTOS (Card)
// =================================================================

/** Renderiza o HTML do card de produto (Usada por Grid e Sugestões) */
function createProductCardHTML(product) {
    const maxLength = 50;
    const descriptionSnippet = product.description.substring(0, maxLength);
    const showEllipsis = product.description.length > maxLength;

    // Encontra o caminho da primeira imagem. 
    const firstImagePath = (product.media && product.media.length > 0)
        ? product.media[0].file_path
        : 'https://via.placeholder.com/280x280?text=Sem+Imagem';

    const isVideo = product.media && product.media[0].media_type === 'video';

    // ✅ NOVO: Botão de link direto para a Shopee
    const shopeeButton = product.shopeeLink ? `
        <a href="${product.shopeeLink}" target="_blank" class="card-shopee-btn">
            Comprar
        </a>
    ` : '';

    return `
        <img src="${isVideo ? 'https://via.placeholder.com/280x280?text=VIDEO' : firstImagePath}" 
             alt="${product.name}"
             loading="lazy">
        <div class="product-info">
            <p class="product-name">${product.name}</p>
            <p class="product-description">
                ${descriptionSnippet}${showEllipsis ? '...' : ''}
            </p>
        </div>
        <div class="card-actions">
            ${shopeeButton}
        </div>
    `;
}

/** Renderiza o Grid principal ou o resultado da busca. */
function renderProductGrid(productsToDisplay) {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (productsToDisplay.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 30px; font-size: 1.2em; color: #6c757d;">Nenhum produto encontrado com este termo.</p>';
        return;
    }

    productsToDisplay.forEach(product => {
        const card = document.createElement('a');
        card.href = `product.html?id=${product.id}`;
        card.className = 'product-card';
        card.innerHTML = createProductCardHTML(product);
        grid.appendChild(card);
    });
}

// =================================================================
// 5. LÓGICA DO CARROSSEL PRINCIPAL (DESTAQUES)
// =================================================================

/** Inicializa o Carrossel Principal com conteúdo dinâmico da API. */
function initCarousel(featuredProducts) {
    const carousel = document.getElementById('bestProductsCarousel');
    if (!carousel) return;

    // Limpa o conteúdo estático/antigo
    carousel.innerHTML = '';

    if (featuredProducts.length === 0) {
        carousel.innerHTML = '<p style="text-align: center; padding: 50px; color: #6c757d;">Marque alguns produtos como Destaque no painel Admin!</p>';
        return;
    }

    // 1. Popula o carrossel com os produtos em destaque
    featuredProducts.forEach((product, index) => {
        const maxLength = 100;
        const descriptionSnippet = product.description.substring(0, maxLength);
        const showEllipsis = product.description.length > maxLength;

        const featuredMediaPath = (product.media && product.media.length > 0)
            ? product.media[0].file_path
            : 'https://via.placeholder.com/1200x400?text=DESTAQUE+SEM+IMAGEM';

        const item = document.createElement('div');
        item.className = `carousel-item ${index === 0 ? 'active' : ''}`;

        // Injeta o caminho da primeira mídia no CSS background-image
        item.innerHTML = `
        <div class="featured-slide" style="background-image: url('${featuredMediaPath}');">
            <div class="featured-info">
                <h2>${product.name}</h2>
                <p>${descriptionSnippet}${showEllipsis ? '...' : ''}</p>
                <a href="product.html?id=${product.id}" class="carousel-cta-btn">Ver Detalhes</a>
            </div>
        </div>
    `;
        carousel.appendChild(item);
    });

    // 2. CRIA BOTÕES DE NAVEGAÇÃO COM CLASSES ISOLADAS
    const prevBtn = document.createElement('button');
    prevBtn.className = 'main-prev-btn'; // CLASSE ÚNICA
    prevBtn.textContent = '‹';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'main-next-btn'; // CLASSE ÚNICA
    nextBtn.textContent = '›';

    carousel.appendChild(prevBtn);
    carousel.appendChild(nextBtn);

    // 3. Lógica de Controle de Slides
    const items = carousel.querySelectorAll('.carousel-item');
    let currentIndex = 0;

    const updateCarousel = () => {
        items.forEach((item, index) => {
            item.classList.toggle('active', index === currentIndex);
        });
    };

    const nextSlide = () => {
        currentIndex = (currentIndex + 1) % items.length;
        updateCarousel();
    };
    const prevSlide = () => {
        currentIndex = (currentIndex - 1 + items.length) % items.length;
        updateCarousel();
    };

    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);
    setInterval(nextSlide, 5000);
}


// =================================================================
// 6. LÓGICA DO CARROSSEL DE SUGESTÕES (SCROLL)
// =================================================================

function shuffleArray(array) {
    // Função simples para embaralhar um array (Fisher-Yates)
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getSuggestedProducts(products, count = 8) {
    // Retorna 'count' produtos aleatórios e não repetidos
    return shuffleArray([...products]).slice(0, count);
}

function renderSuggestionsCarousel(products) {
    const carouselContent = document.getElementById('suggestionsCarousel');
    if (!carouselContent) return;

    const suggestedProducts = getSuggestedProducts(products, 8);
    carouselContent.innerHTML = '';

    suggestedProducts.forEach(product => {
        const card = document.createElement('a');
        card.href = `product.html?id=${product.id}`;
        card.className = 'product-card';
        card.innerHTML = createProductCardHTML(product); // Reuso da função de HTML
        carouselContent.appendChild(card);
    });

    // Configura a navegação por setas (rolagem horizontal)
    initSuggestionsNavigation(carouselContent);
}

function initSuggestionsNavigation(carouselContent) {
    // Busca os botões por classe específica (previne conflitos)
    const prevBtn = document.querySelector('.suggestions-prev-btn');
    const nextBtn = document.querySelector('.suggestions-next-btn');

    if (!prevBtn || !nextBtn) return;

    const scrollDistance = 300;

    nextBtn.addEventListener('click', () => {
        carouselContent.scrollBy({
            left: scrollDistance,
            behavior: 'smooth'
        });
    });

    prevBtn.addEventListener('click', () => {
        carouselContent.scrollBy({
            left: -scrollDistance,
            behavior: 'smooth'
        });
    });
}

// =================================================================
// 7. LÓGICA DA PÁGINA DE DETALHES (Produto)
// =================================================================

async function loadProductDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id'));

    const productsData = await fetchProducts();
    const product = productsData.find(p => p.id === productId);

    // 1. Rastreamento de Visualizações
    if (product) {
        try {
            await fetch(`/api/products/view/${productId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.error('Falha ao registrar visualização:', error);
        }
    }

    // 2. Preenchimento dos Detalhes
    if (product) {

        // --- GESTÃO DE MÍDIAS ---
        const mediaThumbnailsContainer = document.getElementById('mediaThumbnails');
        const mainMediaDisplay = document.querySelector('.main-media-display');

        if (product.media && product.media.length > 0 && mediaThumbnailsContainer && mainMediaDisplay) {

            // Função para renderizar a mídia principal
            const renderMainMedia = (media) => {
                let mediaTag;
                if (media.media_type === 'video') {
                    mediaTag = `<video controls autoplay loop src="${media.file_path}"></video>`;
                } else {
                    mediaTag = `<img src="${media.file_path}" alt="Imagem principal do produto">`;
                }
                mainMediaDisplay.innerHTML = mediaTag;
            };

            // Renderiza a primeira mídia (que é a principal devido ao ORDER BY is_main DESC)
            renderMainMedia(product.media[0]);

            // Popula as miniaturas
            product.media.forEach((media, index) => {
                const item = document.createElement('div');
                item.className = `media-thumbnail-item ${index === 0 ? 'active' : ''}`;

                // ⚠️ NOVO: DEFINE A FONTE DA IMAGEM DA MINIATURA
                let mediaPreviewHTML;
                if (media.media_type === 'video') {
                    // Ícone de Play ou Texto de Vídeo para a miniatura
                    mediaPreviewHTML = `<div class="video-preview-icon">▶️ VIDEO</div>`;
                } else {
                    // Se for imagem
                    mediaPreviewHTML = `<img src="${media.file_path}" alt="Miniatura ${index + 1}">`;
                }

                item.innerHTML = mediaPreviewHTML;

                // Lógica de troca de imagem (mantida)
                item.addEventListener('click', () => {
                    document.querySelectorAll('.media-thumbnail-item').forEach(el => el.classList.remove('active'));
                    item.classList.add('active');
                    renderMainMedia(media);
                });

                mediaThumbnailsContainer.appendChild(item);
            });

        } else {
            // Caso não haja mídias
            mainMediaDisplay.innerHTML = '<img src="https://via.placeholder.com/500x500?text=Nenhuma+Mídia" alt="Sem mídia disponível">';
        }

        // --- Preenchimento dos Campos de Texto ---
        document.getElementById('productName').textContent = product.name;
        document.getElementById('productTitle').textContent = product.name;
        document.getElementById('productDescription').textContent = product.description;

        const shopeeLinkElement = document.getElementById('shopeeLink');
        if (shopeeLinkElement) {
            shopeeLinkElement.href = product.shopeeLink;

            // Adiciona o listener para rastrear o clique
            shopeeLinkElement.addEventListener('click', async () => {
                try {
                    await fetch(`/api/products/click/${productId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                    });
                } catch (error) {
                    console.error('Falha ao registrar clique na Shopee:', error);
                }
            });
        }

    } else {
        // Produto Não Encontrado
        document.getElementById('productName').textContent = 'Produto Não Encontrado';
        document.getElementById('productTitle').textContent = 'Produto Não Encontrado';
        document.getElementById('productDescription').textContent = 'O item buscado não está disponível.';
        document.getElementById('shopeeLink').style.display = 'none';
    }
}

// =================================================================
// 8. LÓGICA DE ANIMAÇÃO (Borboleta e Brilhos)
// =================================================================

function createConfetti(targetElement, count = 10) {
    const sparkleContainer = document.createElement('div');
    sparkleContainer.className = 'sparkle-container';

    const logoContainer = targetElement.closest('.logo');
    if (!logoContainer) return;
    logoContainer.appendChild(sparkleContainer);

    const offsetX = 5;

    const rect = targetElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const logoRect = logoContainer.getBoundingClientRect();

    sparkleContainer.style.left = `${(centerX - logoRect.left) + offsetX}px`;
    sparkleContainer.style.top = `${centerY - logoRect.top}px`;
    sparkleContainer.style.transform = `translate(-50%, -50%)`;


    for (let i = 0; i < count; i++) {
        const sparkle = document.createElement('span');
        sparkle.textContent = '✨❤️';
        sparkle.className = 'confetti-sparkle';

        const duration = Math.random() * 0.8 + 1.2;
        const startX = Math.random() * 40 - 20;
        const startY = Math.random() * 40 - 20;
        const endX = Math.random() * 100 - 50;
        const endY = Math.random() * 50 + 100;
        const delay = Math.random() * 0.1;

        sparkle.style.left = `${startX}px`;
        sparkle.style.top = `${startY}px`;
        sparkle.style.animation = `sparkle-fall ${duration}s ease-in ${delay}s forwards`;

        sparkle.style.setProperty('--end-x', `${endX}px`);
        sparkle.style.setProperty('--end-y', `${endY}px`);

        sparkleContainer.appendChild(sparkle);

        setTimeout(() => {
            sparkle.remove();
        }, (duration + delay) * 1000 + 100);
    }

    setTimeout(() => {
        sparkleContainer.remove();
    }, 2500);
}


function activateSparkle() {
    const butterfly = document.getElementById('animatedButterfly');
    const logoElement = document.querySelector('.logo');

    
    if (!butterfly) return;

    butterfly.addEventListener('animationend', () => {
        createConfetti(butterfly, 12);
        setTimeout(() => {
            logoElement.classList.add('logo-pulse-animation');

            // 3. Opcional: Remove a classe após a animação de pulso terminar
            // Isso permite que a animação possa ser reativada se necessário.
            logoElement.addEventListener('animationend', () => {
                // Remove a classe APENAS se a animação for 'logoPulse'
                if (logoElement.classList.contains('logo-pulse-animation')) {
                    logoElement.classList.remove('logo-pulse-animation');
                }
            }, { once: true }); // O listener só roda uma vez

        }, 2500);
    });
}