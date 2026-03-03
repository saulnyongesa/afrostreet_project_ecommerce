// static/js/pages/promotions.js

document.addEventListener('DOMContentLoaded', async () => {
    const promoType = document.getElementById('promoType').value; // 'deals' or 'offers'
    const container = document.getElementById('promoContainer');
    const titleElement = document.getElementById('promoTitle');
    const countElement = document.getElementById('promoCount');

    try {
        // Fetch the combined endpoint
        const response = await fetch('/api/store/deals-and-offers/');
        const data = await response.json();

        // Extract the specific array we need based on the URL
        const products = promoType === 'deals' ? data.deals : data.offers;

        // Set UI Text dynamically
        if (promoType === 'deals') {
            titleElement.innerText = "🔥 Top Deals";
            document.title = "Top Deals | Afrostreet";
        } else {
            titleElement.innerText = "🏷️ Exclusive Offers";
            document.title = "Exclusive Offers | Afrostreet";
        }

        if (products.length === 0) {
            countElement.innerText = "0 Items";
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <span class="fs-1">🛍️</span>
                    <h5 class="mt-3">No active ${promoType} at the moment.</h5>
                    <a href="/" class="btn btn-khaki mt-3">Continue Shopping</a>
                </div>`;
            return;
        }

        countElement.innerText = `${products.length} Items`;

        // Render the mobile-optimized grid
        container.innerHTML = products.map(product => `
            <div class="col-6 col-md-3 mb-4">
                <a href="/product/${product.slug}/" class="text-decoration-none">
                    <div class="card h-100 border-0 shadow-sm product-card transition-hover">
                        <img src="/media/${product.image}" class="card-img-top product-image-adaptive" alt="${product.name}">
                        <div class="card-body p-2 p-md-3">
                            <h6 class="card-title text-truncate mb-1 text-dark">${product.name}</h6>
                            <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mt-1 mt-md-2">
                                <span class="fw-bold text-dark fs-5">KSh ${parseFloat(product.price).toLocaleString()}</span>
                                ${product.discount_price ? `<span class="text-decoration-line-through text-muted small">KSh ${parseFloat(product.discount_price).toLocaleString()}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </a>
            </div>
        `).join('');

    } catch (error) {
        console.error(`Failed to load ${promoType}:`, error);
        container.innerHTML = '<div class="col-12 text-center text-danger py-5">Failed to load promotions. Please try again.</div>';
    }
});