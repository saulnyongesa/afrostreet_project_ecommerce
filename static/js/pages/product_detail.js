// static/js/pages/product_detail.js

document.addEventListener('DOMContentLoaded', () => {
    const slug = document.getElementById('productSlug').value;
    
    const loadProductDetails = async () => {
        try {
            const response = await fetch(`/api/store/products/${slug}/`);
            if (!response.ok) {
                document.getElementById('mainProductContainer').innerHTML = `<div class="col-12 text-center text-danger py-5">Product not found.</div>`;
                return;
            }
            const product = await response.json();

            document.title = `${product.name} | Afrostreet`;

            // 1. Render Main Product Area
            const mainContainer = document.getElementById('mainProductContainer');
            mainContainer.innerHTML = `
                <div class="col-md-5 mb-4 mb-md-0 text-center position-relative">
                    <img src="/media/${product.image}" id="mainProductImage" alt="${product.name}" class="img-fluid rounded border p-2 shadow-sm transition-hover" style="max-height: 400px; width: 100%; object-fit: contain; cursor: zoom-in;" title="Click to zoom">
                    <span class="badge bg-dark bg-opacity-75 position-absolute top-0 end-0 m-3 p-2" style="pointer-events: none;">🔍 Tap to zoom</span>
                </div>
                
                <div class="col-md-7">
                    <span class="badge bg-khaki mb-2">${product.category ? product.category.name : 'Fashion'}</span>
                    <h2 class="fw-bold text-dark fs-3 fs-md-2">${product.name}</h2>
                    <hr>
                    <div class="mb-4">
                        <h3 class="fw-bold text-dark m-0 fs-4 fs-md-3">KSh ${parseFloat(product.price).toLocaleString()}</h3>
                        ${product.discount_price ? `<span class="text-decoration-line-through text-muted small">KSh ${parseFloat(product.discount_price).toLocaleString()}</span> <span class="badge bg-success ms-2">Discount Applied</span>` : ''}
                    </div>
                    
                    <div class="d-grid gap-2 col-12 col-md-8">
                        <button id="addToCartBtn" class="btn btn-khaki btn-lg fw-bold d-flex align-items-center justify-content-center gap-2 transition-hover">
                            🛒 Add To Cart
                        </button>
                    </div>
                </div>
            `;

            // --- NEW: Image Zoom Logic ---
            const mainImg = document.getElementById('mainProductImage');
            if (mainImg) {
                mainImg.addEventListener('click', () => {
                    const zoomModalEl = document.getElementById('imageZoomModal');
                    const zoomedImg = document.getElementById('zoomedImage');
                    
                    if (zoomModalEl && zoomedImg) {
                        zoomedImg.src = `/media/${product.image}`;
                        
                        // FIX: Use getOrCreateInstance to prevent multiple backdrop overlays
                        const zoomModal = bootstrap.Modal.getOrCreateInstance(zoomModalEl);
                        zoomModal.show();
                    }
                });
            }

            // Attach the click listener to the Add to Cart button
            const addToCartBtn = document.getElementById('addToCartBtn');
            if (addToCartBtn) {
                addToCartBtn.addEventListener('click', () => {
                    window.AfroCart.addItem(product);
                });
            }

            // 2. Render CKEditor Rich Text Description
            const descSection = document.getElementById('productDescriptionSection');
            const descContent = document.getElementById('productDescriptionContent');
            if (product.description) {
                descContent.innerHTML = product.description;
                descSection.classList.remove('d-none');
            }

        } catch (error) {
            console.error("Failed to load product details:", error);
        }
    };

    const loadRelatedProducts = async () => {
        try {
            const response = await fetch(`/api/store/products/${slug}/related/`);
            const relatedProducts = await response.json();
            
            const container = document.getElementById('relatedProductsContainer');
            container.innerHTML = '';

            if (relatedProducts.length === 0) {
                container.innerHTML = `<div class="col-12 text-center text-muted">No related products found.</div>`;
                return;
            }

            relatedProducts.forEach(product => {
                container.innerHTML += `
                    <div class="col-6 col-md-3 mb-3">
                        <a href="/product/${product.slug}/" class="text-decoration-none">
                            <div class="card h-100 border-0 shadow-sm product-card transition-hover">
                                <img src="/media/${product.image}" class="card-img-top product-image-adaptive" alt="${product.name}">
                                <div class="card-body p-2 p-md-3">
                                    <small class="text-muted d-block mb-1 text-truncate">${product.category ? product.category.name : ''}</small>
                                    <h6 class="card-title text-truncate mb-1 text-dark">${product.name}</h6>
                                    <div class="fw-bold text-dark fs-6 mt-1">KSh ${parseFloat(product.price).toLocaleString()}</div>
                                </div>
                            </div>
                        </a>
                    </div>
                `;
            });
        } catch (error) {
            console.error("Failed to load related products:", error);
        }
    };

    // Execute concurrently
    loadProductDetails();
    loadRelatedProducts();
});