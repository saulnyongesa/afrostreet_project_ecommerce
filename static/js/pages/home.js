// static/js/pages/home.js

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Fetch & Render Hero Banners ---
    const loadBanners = async () => {
        try {
            const response = await fetch('/api/store/banners/');
            const banners = await response.json();
            
            const container = document.getElementById('heroBannerContainer');
            
            if (banners.length === 0) {
                container.innerHTML = `<div class="p-5 text-center text-muted w-100">No active featured items.</div>`;
                return;
            }

            // Map the banner data to cards
            container.innerHTML = banners.map(banner => {
                let priceHtml = '';
                let btnHtml = '<button class="btn btn-outline-secondary w-100 disabled">Coming Soon</button>';
                
                // Check if a product ID is linked
                if (banner.product) {
                    // Pull from the new flat fields we added to the serializer
                    const price = banner.product_price;
                    priceHtml = `<div class="fw-bold text-dark fs-5 mb-2">KSh ${parseFloat(price).toLocaleString()}</div>`;
                    
                    // Route to /product/ so it opens the actual detail page, not the media file!
                    btnHtml = `<a href="/product/${banner.product_slug}/" class="btn btn-khaki w-100 fw-bold transition-hover">Buy Now</a>`;
                }

                // Helper to ensure the image URL is correct
                const imageUrl = banner.image.startsWith('http') || banner.image.startsWith('/media/') 
                    ? banner.image 
                    : `/media/${banner.image}`;

                return `
                    <div class="card border-0 shadow-sm scrolling-card">
                        <img src="${imageUrl}" class="card-img-top" alt="${banner.title}" style="height: 220px; object-fit: cover;">
                        <div class="card-body d-flex flex-column p-3">
                            <h6 class="card-title text-truncate text-muted small mb-1" title="${banner.title}">${banner.title}</h6>
                            ${priceHtml}
                            <div class="mt-auto">
                                ${btnHtml}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // --- Auto-Scroll Animation Logic ---
            let scrollInterval;
            const scrollStep = 1; 
            const scrollSpeed = 20; 

            const startScroll = () => {
                scrollInterval = setInterval(() => {
                    if (container.scrollLeft >= (container.scrollWidth - container.clientWidth - 1)) {
                        container.scrollLeft = 0;
                    } else {
                        container.scrollLeft += scrollStep;
                    }
                }, scrollSpeed);
            };

            const stopScroll = () => clearInterval(scrollInterval);

            startScroll();

            container.addEventListener('mouseenter', stopScroll);
            container.addEventListener('touchstart', stopScroll);
            container.addEventListener('mouseleave', startScroll);
            container.addEventListener('touchend', () => {
                setTimeout(startScroll, 2000); 
            });

        } catch (error) {
            console.error("Failed to load featured banners:", error);
        }
    };

    // --- 2. Fetch & Render Deals and Offers ---
    const loadDealsAndOffers = async () => {
        try {
            const response = await fetch('/api/store/deals-and-offers/');
            const data = await response.json();

            // Helper function to generate generic product cards
            // Updated to use product-image-adaptive, added link wrapper, and optimized mobile padding
            const generateCard = (product) => `
                <div class="col-6 col-md-3 mb-3">
                    <a href="/product/${product.slug}/" class="text-decoration-none">
                        <div class="card h-100 border-0 shadow-sm product-card transition-hover">
                            <img src="/media/${product.image}" class="card-img-top product-image-adaptive" alt="${product.name}">
                            <div class="card-body p-2 p-md-3">
                                <h6 class="card-title text-truncate mb-1 text-dark" title="${product.name}">${product.name}</h6>
                                <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mt-1 mt-md-2">
                                    <span class="fw-bold text-dark fs-5">KSh ${parseFloat(product.price).toLocaleString()}</span>
                                    ${product.discount_price ? `<span class="text-decoration-line-through text-muted small">KSh ${parseFloat(product.discount_price).toLocaleString()}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </a>
                </div>
            `;

            // Populate Deals
            const dealsContainer = document.getElementById('dealsContainer');
            if (data.deals.length > 0) {
                dealsContainer.innerHTML = data.deals.map(generateCard).join('');
            } else {
                dealsContainer.innerHTML = '<div class="col-12 text-muted">No deals currently available.</div>';
            }

            // Populate Offers
            const offersContainer = document.getElementById('offersContainer');
            if (data.offers.length > 0) {
                offersContainer.innerHTML = data.offers.map(generateCard).join('');
            } else {
                offersContainer.innerHTML = '<div class="col-12 text-muted">No exclusive offers currently available.</div>';
            }

        } catch (error) {
            console.error("Failed to load deals and offers:", error);
        }
    };

    // --- 3. Fetch & Render Categories (Desktop Sidebar & Mobile Scroll) ---
    const loadCategories = async () => {
        try {
            const response = await fetch('/api/store/categories/');
            const categories = await response.json();
            const sidebar = document.getElementById('categorySidebar');

            if (categories.length === 0) {
                if(sidebar) sidebar.innerHTML = '<li class="list-group-item text-muted">No categories yet.</li>';
                return;
            }

            // Populate Desktop Sidebar
            if (sidebar) {
                sidebar.innerHTML = categories.map(cat => `
                    <a href="/category/${cat.slug}/" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center transition-hover">
                        ${cat.name} <span class="text-muted small">></span>
                    </a>
                `).join('');
            }

            // Populate Mobile Horizontal Scroll
            const mobileScroll = document.getElementById('mobileCategoryScroll');
            if (mobileScroll) {
                mobileScroll.innerHTML = categories.map(cat => `
                    <a href="/category/${cat.slug}/" class="badge bg-white text-dark border p-2 me-2 text-decoration-none shadow-sm transition-hover" style="font-size: 0.9rem;">
                        ${cat.name}
                    </a>
                `).join('');
            }

        } catch (error) {
            console.error("Failed to load categories:", error);
        }
    };

    // Execute concurrently for faster loading
    loadBanners();
    loadDealsAndOffers();
    loadCategories();
});