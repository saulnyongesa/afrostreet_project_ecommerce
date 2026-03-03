// static/js/admin/admin_products.js

let editorInstance;
const productModal = new bootstrap.Modal(document.getElementById('productModal'));

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Initialize AfroCropper for product images (Ratio 1 for square)
    window.AfroCropper.init('productImageInput', 'productImagePreview', 'productFinalImageUrl', 1);

    // 2. Initialize CKEditor 5
    ClassicEditor
        .create(document.querySelector('#productDescriptionEditor'), {
            toolbar: ['heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote', 'undo', 'redo']
        })
        .then(editor => {
            editorInstance = editor;
        })
        .catch(error => console.error(error));

    const getFullImageUrl = (imagePath) => {
        if (!imagePath) return '';
        if (imagePath.startsWith('http') || imagePath.startsWith('/media/')) return imagePath;
        return `/media/${imagePath}`;
    };

    // 3. Fetch and Render Products Table
    const loadProducts = async () => {
        const tbody = document.getElementById('productsTableBody');
        try {
            const res = await fetch('/api/store/admin/products/');
            const products = await res.json();

            if (products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No products found. Add your first item!</td></tr>';
                return;
            }

            tbody.innerHTML = products.map(product => {
                const imageUrl = getFullImageUrl(product.image);
                
                const activeBtnClass = product.is_active ? 'btn-outline-warning' : 'btn-outline-success';
                const activeBtnText = product.is_active ? '⏸️ Deactivate' : '▶️ Activate';
                const statusBadge = product.is_active 
                    ? '<span class="badge bg-success bg-opacity-10 text-success border border-success">In Stock</span>' 
                    : '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger">Out of Stock</span>';

                return `
                    <tr>
                        <td class="ps-4">
                            <div class="d-flex align-items-center">
                                <img src="${imageUrl}" class="rounded border me-3 shadow-sm" style="width: 50px; height: 50px; object-fit: cover;">
                                <span class="fw-bold text-dark text-truncate" style="max-width: 200px;" title="${product.name}">${product.name}</span>
                            </div>
                        </td>
                        <td class="text-muted small">${product.category_name || 'Uncategorized'}</td>
                        <td>
                            <span class="fw-bold text-dark d-block">KSh ${parseFloat(product.price).toLocaleString()}</span>
                            ${product.discount_price ? `<small class="text-success text-decoration-line-through">KSh ${parseFloat(product.discount_price).toLocaleString()}</small>` : ''}
                        </td>
                        <td>${statusBadge}</td>
                        <td class="text-end pe-4 text-nowrap">
                            <button class="btn btn-sm ${activeBtnClass} me-2" onclick="window.toggleProductActive(${product.id}, ${product.is_active})">
                                ${activeBtnText}
                            </button>
                            <button class="btn btn-sm btn-light border me-1" onclick='window.editProduct(${JSON.stringify(product).replace(/'/g, "&#39;")})'>
                                ✏️ Edit
                            </button>
                            <button class="btn btn-sm btn-light border text-danger" onclick="window.deleteProduct(${product.id})">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Failed to load data.</td></tr>';
        }
    };

    loadProducts();

    // 4. Save Product
    document.getElementById('saveProductBtn').addEventListener('click', async (e) => {
        const btn = e.target;
        const id = document.getElementById('productId').value;
        const name = document.getElementById('productName').value;
        const categoryId = document.getElementById('productCategory').value;
        const price = document.getElementById('productPrice').value;
        const discountPrice = document.getElementById('productDiscount').value;
        const content = editorInstance.getData();
        const imageUrl = document.getElementById('productFinalImageUrl').value;
        const isActive = document.getElementById('productIsActive').checked;

        if (!name || !categoryId || !price || !imageUrl) {
            alert('Please fill out the name, category, price, and select a cropped image.');
            return;
        }

        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
        btn.disabled = true;

        const payload = {
            name: name,
            category: parseInt(categoryId),
            price: price,
            description: content,
            image: imageUrl,
            is_active: isActive
        };

        if (discountPrice) {
            payload.discount_price = discountPrice;
        } else {
            payload.discount_price = null; // Clear it out if empty
        }

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/store/admin/products/${id}/` : '/api/store/admin/products/';

        try {
            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                productModal.hide();
                loadProducts();
            } else {
                const err = await res.json();
                alert('Error: ' + JSON.stringify(err));
            }
        } catch (error) {
            alert('A network error occurred.');
        } finally {
            btn.innerHTML = 'Save Product';
            btn.disabled = false;
        }
    });

    // --- GLOBAL FUNCTIONS ---

    window.openProductModal = () => {
        document.getElementById('productModalTitle').innerText = 'Add New Product';
        document.getElementById('productId').value = '';
        document.getElementById('productName').value = '';
        document.getElementById('productCategory').value = '';
        document.getElementById('productPrice').value = '';
        document.getElementById('productDiscount').value = '';
        editorInstance.setData('');
        document.getElementById('productImageInput').value = '';
        document.getElementById('productFinalImageUrl').value = '';
        document.getElementById('productImagePreview').classList.add('d-none');
        document.getElementById('productIsActive').checked = true;
        productModal.show();
    };

    window.editProduct = (product) => {
        document.getElementById('productModalTitle').innerText = 'Edit Product';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productDiscount').value = product.discount_price || '';
        editorInstance.setData(product.description || '');
        
        document.getElementById('productFinalImageUrl').value = product.image;
        const preview = document.getElementById('productImagePreview');
        preview.src = getFullImageUrl(product.image);
        preview.classList.remove('d-none');
        
        document.getElementById('productIsActive').checked = product.is_active;
        productModal.show();
    };

    window.toggleProductActive = async (id, currentStatus) => {
        try {
            const res = await fetch(`/api/store/admin/products/${id}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({ is_active: !currentStatus })
            });
            if (res.ok) loadProducts();
        } catch (error) {
            alert('Failed to update status.');
        }
    };

    window.deleteProduct = async (id) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            const res = await fetch(`/api/store/admin/products/${id}/`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCSRFToken() }
            });
            if (res.ok) loadProducts();
        } catch (error) {
            alert('Failed to delete.');
        }
    };
});