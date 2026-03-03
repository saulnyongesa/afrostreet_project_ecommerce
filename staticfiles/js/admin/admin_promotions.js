// static/js/admin/admin_promotions.js

const bannerModal = new bootstrap.Modal(document.getElementById('bannerModal'));

document.addEventListener('DOMContentLoaded', () => {
    
    // Initialize Cropper for Banners (Ratio 4:5 to look like modern product cards)
    window.AfroCropper.init('bannerImageInput', 'bannerImagePreview', 'bannerFinalImageUrl', 4/5);

    const getFullImageUrl = (imagePath) => {
        if (!imagePath) return '';
        if (imagePath.startsWith('http') || imagePath.startsWith('/media/')) return imagePath;
        return `/media/${imagePath}`;
    };

    // --- PART 1: DEALS & OFFERS LOGIC ---

    const loadPromotions = async () => {
        const dealsList = document.getElementById('dealsList');
        const offersList = document.getElementById('offersList');
        
        try {
            // We reuse your public endpoint which already returns deals & offers!
            const res = await fetch('/api/store/deals-and-offers/');
            const data = await res.json();

            const renderItem = (item, type) => `
                <li class="list-group-item d-flex justify-content-between align-items-center py-3">
                    <div class="d-flex align-items-center">
                        <img src="${getFullImageUrl(item.image)}" class="rounded border me-3" style="width: 40px; height: 40px; object-fit: cover;">
                        <div>
                            <h6 class="mb-0 text-dark" style="font-size: 0.9rem;">${item.name}</h6>
                            <small class="text-muted">ID: ${item.id} | KSh ${item.price}</small>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.removePromotion(${item.id}, '${type}')">Remove</button>
                </li>
            `;

            dealsList.innerHTML = data.deals.length ? data.deals.map(d => renderItem(d, 'deal')).join('') : '<li class="list-group-item text-muted">No top deals active.</li>';
            offersList.innerHTML = data.offers.length ? data.offers.map(o => renderItem(o, 'offer')).join('') : '<li class="list-group-item text-muted">No exclusive offers active.</li>';
            
        } catch (error) {
            console.error("Failed to load promotions");
        }
    };

    loadPromotions();

    // Product Search for adding to Promos
    const searchInput = document.getElementById('promoProductSearch');
    const resultsDiv = document.getElementById('promoSearchResults');

    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length < 2) { resultsDiv.classList.add('d-none'); return; }

        try {
            const res = await fetch(`/api/store/products/?search=${query}`); 
            const products = await res.json();

            resultsDiv.innerHTML = products.map(p => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <img src="${getFullImageUrl(p.image)}" class="rounded me-3" style="width: 30px; height: 30px; object-fit: cover;">
                        <span>${p.name} <small class="text-muted">(ID: ${p.id})</small></span>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-danger me-1" onclick="window.addPromotion(${p.id}, 'deal')">+ Deal</button>
                        <button class="btn btn-sm btn-outline-primary" onclick="window.addPromotion(${p.id}, 'offer')">+ Offer</button>
                    </div>
                </div>
            `).join('');
            resultsDiv.classList.remove('d-none');
        } catch(e) { console.error("Search failed"); }
    });

    window.addPromotion = async (productId, type) => {
        resultsDiv.classList.add('d-none');
        searchInput.value = '';
        await togglePromotion(productId, type, true);
    };

    window.removePromotion = async (productId, type) => {
        await togglePromotion(productId, type, false);
    };

    const togglePromotion = async (productId, type, status) => {
        try {
            const res = await fetch(`/api/store/admin/products/${productId}/toggle-promo/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
                body: JSON.stringify({ type: type, status: status })
            });
            if (res.ok) loadPromotions();
            else alert("Failed to update promotion.");
        } catch (error) { alert("Network error."); }
    };


    // --- PART 2: FEATURED HIGHLIGHTS (BANNERS) LOGIC ---

    const loadBanners = async () => {
        const grid = document.getElementById('bannersGrid');
        try {
            const res = await fetch('/api/store/admin/banners/');
            const banners = await res.json();

            if (banners.length === 0) {
                grid.innerHTML = '<div class="col-12 text-center py-5 text-muted">No banners currently active.</div>';
                return;
            }

            grid.innerHTML = banners.map(banner => `
                <div class="col-md-3">
                    <div class="card border-0 shadow-sm h-100 position-relative">
                        <button class="btn btn-danger btn-sm position-absolute top-0 end-0 m-2 rounded-circle z-3" onclick="window.deleteBanner(${banner.id})" title="Delete">🗑️</button>
                        <img src="${getFullImageUrl(banner.image)}" class="card-img-top" style="height: 250px; object-fit: cover;">
                        <div class="card-body p-2 text-center bg-dark text-white rounded-bottom">
                            <h6 class="m-0">${banner.title}</h6>
                            <small class="text-khaki">${banner.product_name || 'No Link'}</small>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error(error);
        }
    };

    loadBanners();

    // 1. Live Product Search for the Banner Modal
    const bannerSearchInput = document.getElementById('bannerProductSearch');
    const bannerResultsDiv = document.getElementById('bannerSearchResults');
    const saveBannerBtn = document.getElementById('saveBannerBtn');

    bannerSearchInput.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length < 2) { bannerResultsDiv.classList.add('d-none'); return; }

        try {
            const res = await fetch(`/api/store/products/?search=${query}`); 
            const products = await res.json();

            bannerResultsDiv.innerHTML = products.map(p => `
                <a href="#" class="list-group-item list-group-item-action d-flex align-items-center" 
                   onclick="window.selectBannerProduct(${p.id}, '${p.name.replace(/'/g, "&#39;")}', '${p.image}')">
                    <img src="${getFullImageUrl(p.image)}" class="rounded me-3" style="width: 30px; height: 30px; object-fit: cover;">
                    <span>${p.name}</span>
                </a>
            `).join('');
            bannerResultsDiv.classList.remove('d-none');
        } catch(e) { console.error("Search failed"); }
    });

    // 2. Handle Product Selection
    window.selectBannerProduct = (id, name, imagePath) => {
        // Hide search results and clear input
        bannerResultsDiv.classList.add('d-none');
        bannerSearchInput.value = '';

        // Set hidden fields
        document.getElementById('bannerSelectedProductId').value = id;
        document.getElementById('bannerSelectedProductImage').value = imagePath; // Transfer the image!

        // Show visual confirmation
        document.getElementById('bannerSelectedProductName').innerText = name;
        document.getElementById('bannerImagePreview').src = getFullImageUrl(imagePath);
        document.getElementById('bannerSelectedPreviewContainer').classList.remove('d-none');

        // Enable the save button
        saveBannerBtn.disabled = false;
    };

    // 3. Reset Modal when opened
    window.openBannerModal = () => {
        document.getElementById('bannerTitle').value = '';
        document.getElementById('bannerProductSearch').value = '';
        document.getElementById('bannerSelectedProductId').value = '';
        document.getElementById('bannerSelectedProductImage').value = '';
        document.getElementById('bannerSelectedPreviewContainer').classList.add('d-none');
        saveBannerBtn.disabled = true; // Disabled until a product is selected
        bannerModal.show();
    };

    // 4. Save the Banner
    saveBannerBtn.addEventListener('click', async (e) => {
        const btn = e.target;
        const title = document.getElementById('bannerTitle').value;
        const productId = document.getElementById('bannerSelectedProductId').value;
        const imageUrl = document.getElementById('bannerSelectedProductImage').value;

        if (!title || !productId) { alert('Title and Product selection are required.'); return; }

        btn.innerHTML = 'Saving...'; btn.disabled = true;

        const payload = { 
            title: title, 
            product: parseInt(productId),
            image: imageUrl, // Reuse the product's image for the banner
            is_active: true 
        };

        try {
            const res = await fetch('/api/store/admin/banners/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                bannerModal.hide();
                loadBanners(); // Refresh the grid
            } else { alert('Failed to save banner.'); }
        } catch (error) { alert('Network error.'); } finally {
            btn.innerHTML = 'Save Highlight'; btn.disabled = false;
        }
    });

    window.deleteBanner = async (id) => {
        if (!confirm('Delete this highlight?')) return;
        try {
            const res = await fetch(`/api/store/admin/banners/${id}/`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCSRFToken() }
            });
            if (res.ok) loadBanners();
        } catch (error) { alert('Failed to delete.'); }
    };
});