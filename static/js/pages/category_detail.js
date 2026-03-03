// static/js/pages/category_detail.js

document.addEventListener('DOMContentLoaded', async () => {
    const slug = document.getElementById('categorySlug').value;
    const container = document.getElementById('categoryProductsContainer');
    const titleElement = document.getElementById('categoryTitle');
    const countElement = document.getElementById('productCount');

    try {
        // Fetch products filtered by the category slug
        const response = await fetch(`/api/store/products/?category=${slug}`);
        const products = await response.json();

        if (products.length === 0) {
            titleElement.innerText = "Category Details";
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <h5>No products found in this category yet.</h5>
                    <a href="/" class="btn btn-khaki mt-3">Continue Shopping</a>
                </div>`;
            return;
        }

        // Dynamically set the title based on the first product's category name
        const categoryName = products[0].category_name;
        titleElement.innerText = `${categoryName} Collection`;
        document.title = `${categoryName} | Afrostreet`;
        countElement.innerText = `${products.length} Items found`;

        // Render the product grid (Mobile Optimized)
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
        console.error("Failed to load category products:", error);
        container.innerHTML = '<div class="col-12 text-center text-danger py-5">Failed to load products. Please try again.</div>';
    }
});