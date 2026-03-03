// static/js/admin/admin_orders.js

// 1. Initialize Modals
const detailsModal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
const createOrderModal = new bootstrap.Modal(document.getElementById('adminCreateOrderModal'));
const editOrderModal = new bootstrap.Modal(document.getElementById('editOrderModal'));

// 2. Global State Variables
let currentOrders = [];
let adminCart = [];
let selectedUser = null;

document.addEventListener('DOMContentLoaded', () => {
    
    // --- PART 1: ORDER LIST & FILTERING LOGIC ---
    
    const tableBody = document.getElementById('ordersTableBody');
    const filterSelect = document.getElementById('orderStatusFilter');
    const createOrderBtn = document.getElementById('adminCreateOrderBtn');

    // Helper to color-code the select dropdowns based on status
    const getStatusColorClass = (status) => {
        switch(status) {
            case 'Pending Payment': return 'text-warning bg-warning bg-opacity-10 border-warning';
            case 'Processing': return 'text-primary bg-primary bg-opacity-10 border-primary';
            case 'Shipped': return 'text-info bg-info bg-opacity-10 border-info';
            case 'Delivered': return 'text-success bg-success bg-opacity-10 border-success';
            case 'Cancelled': return 'text-danger bg-danger bg-opacity-10 border-danger';
            default: return '';
        }
    };

    // Main function to fetch and render the table
    const loadOrders = async (statusFilter = '') => {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted"><div class="spinner-border text-khaki"></div></td></tr>';
        
        try {
            const url = statusFilter ? `/api/store/admin/orders/?status=${encodeURIComponent(statusFilter)}` : '/api/store/admin/orders/';
            const res = await fetch(url);
            const orders = await res.json();
            currentOrders = orders; // Store globally for "View" and "Edit" modals

            if (orders.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">No orders found.</td></tr>';
                return;
            }

            tableBody.innerHTML = orders.map(order => `
                <tr>
                    <td class="ps-4">
                        <span class="fw-bold text-dark d-block">#${order.id}</span>
                        <span class="text-muted small">${new Date(order.created_at).toLocaleDateString()}</span>
                    </td>
                    <td>
                        <span class="fw-bold text-dark d-block">${order.full_name}</span>
                        <span class="text-muted small">${order.phone}</span>
                    </td>
                    <td><span class="badge bg-light text-dark border font-monospace p-2">${order.mpesa_account_number || 'N/A'}</span></td>
                    <td><span class="fw-bold text-dark">KSh ${parseFloat(order.total_amount).toLocaleString()}</span></td>
                    <td>
                        <select class="form-select form-select-sm fw-bold ${getStatusColorClass(order.status)}" onchange="window.updateOrderStatus(${order.id}, this)">
                            <option value="Pending Payment" ${order.status === 'Pending Payment' ? 'selected' : ''}>Pending Payment</option>
                            <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
                            <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </td>
                    <td class="text-end pe-4 text-nowrap">
                        <button class="btn btn-sm btn-light border text-dark me-1" onclick="window.viewOrderDetails(${order.id})" title="View">👁️</button>
                        <button class="btn btn-sm btn-light border text-primary me-1" onclick="window.openEditOrderModal(${order.id})" title="Edit">✏️</button>
                        <button class="btn btn-sm btn-light border text-danger" onclick="window.deleteOrder(${order.id})" title="Delete">🗑️</button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error(error);
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Failed to load orders.</td></tr>';
        }
    };

    // Initial Load & Filter Listener
    loadOrders();
    filterSelect.addEventListener('change', (e) => loadOrders(e.target.value));

    // --- PART 2: EDIT ORDER LOGIC (PUT) ---
    
    const saveOrderUpdateBtn = document.getElementById('saveOrderUpdateBtn');
    if (saveOrderUpdateBtn) {
        saveOrderUpdateBtn.addEventListener('click', async (e) => {
            const btn = e.target;
            const orderId = document.getElementById('editOrderId').value;
            
            const payload = {
                full_name: document.getElementById('editOrderName').value,
                email: document.getElementById('editOrderEmail').value,
                phone: document.getElementById('editOrderPhone').value,
                shipping_address: document.getElementById('editOrderAddress').value,
            };

            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
            btn.disabled = true;

            try {
                const res = await fetch(`/api/store/admin/orders/${orderId}/`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    editOrderModal.hide();
                    loadOrders(filterSelect.value); // Clean reload matching current filter
                } else {
                    const err = await res.json();
                    alert('Failed to update order: ' + JSON.stringify(err));
                }
            } catch (error) {
                alert('Network error occurred.');
            } finally {
                btn.innerHTML = 'Save Changes';
                btn.disabled = false;
            }
        });
    }

    // --- PART 3: MANUAL ORDER CREATION LOGIC ---

    if (createOrderBtn) {
        createOrderBtn.disabled = false;
        createOrderBtn.addEventListener('click', () => {
            // Reset form for new order
            document.getElementById('manualOrderEmail').value = '';
            document.getElementById('manualOrderName').value = '';
            document.getElementById('manualOrderPhone').value = '';
            document.getElementById('newUserFields').classList.add('d-none');
            document.getElementById('userFeedback').innerText = '';
            document.getElementById('selectedUserId').value = '';
            
            const section2 = document.getElementById('productSelectionSection');
            section2.classList.add('opacity-50');
            section2.style.pointerEvents = 'none';
            
            document.getElementById('adminCartBody').innerHTML = '<tr><td colspan="5" class="text-center text-muted">No items added.</td></tr>';
            document.getElementById('adminCartTotal').innerText = 'KSh 0';
            
            adminCart = [];
            selectedUser = null;
            createOrderModal.show();
        });
    }

    // A. User Check / Creation
    document.getElementById('checkUserBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('manualOrderEmail').value;
        const name = document.getElementById('manualOrderName').value;
        const phone = document.getElementById('manualOrderPhone').value;
        const feedback = document.getElementById('userFeedback');
        const section2 = document.getElementById('productSelectionSection');

        if (!email) { alert("Enter an email first."); return; }

        try {
            const res = await fetch('/api/store/admin/users/check-or-create/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
                body: JSON.stringify({ email, full_name: name, phone: phone })
            });
            const data = await res.json();

            if (res.status === 200) {
                // User Found
                selectedUser = data.user;
                feedback.innerHTML = `✅ Selected: ${data.user.full_name} (${data.user.email})`;
                feedback.className = 'fw-bold text-success mt-2';
                section2.classList.remove('opacity-50');
                section2.style.pointerEvents = 'auto';
                document.getElementById('newUserFields').classList.add('d-none');
            } else if (res.status === 201) {
                // User Created
                selectedUser = data.user;
                feedback.innerHTML = `✨ Created & Selected: ${data.user.full_name}`;
                feedback.className = 'fw-bold text-primary mt-2';
                section2.classList.remove('opacity-50');
                section2.style.pointerEvents = 'auto';
                document.getElementById('newUserFields').classList.add('d-none');
            } else if (res.status === 404) {
                // Not found, ask for details
                feedback.innerText = "User not found. Please enter Name & Phone to create.";
                feedback.className = 'fw-bold text-warning mt-2';
                document.getElementById('newUserFields').classList.remove('d-none');
            }
        } catch (error) {
            alert("Error checking user.");
        }
    });

    // B. Product Search
    const searchInput = document.getElementById('adminProductSearch');
    const resultsDiv = document.getElementById('adminProductSearchResults');

    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value;
            if (query.length < 2) { resultsDiv.classList.add('d-none'); return; }

            try {
                const res = await fetch(`/api/store/products/?search=${query}`); 
                const products = await res.json();

                resultsDiv.innerHTML = products.map(p => `
                    <a href="#" class="list-group-item list-group-item-action" onclick="window.addToAdminCart(${p.id}, '${p.name.replace(/'/g, "")}', ${p.price}, '${p.image}')">
                        <div class="d-flex justify-content-between align-items-center">
                            <span>${p.name}</span>
                            <span class="fw-bold text-khaki">KSh ${p.price}</span>
                        </div>
                    </a>
                `).join('');
                resultsDiv.classList.remove('d-none');
            } catch(e) { console.error("Search failed", e); }
        });
    }

    // C. Submit Order
    document.getElementById('submitManualOrderBtn')?.addEventListener('click', async (e) => {
        if (!selectedUser || adminCart.length === 0) return;
        
        const btn = e.target;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/store/admin/orders/create/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
                body: JSON.stringify({
                    user_id: selectedUser.id,
                    items: adminCart
                })
            });
            
            if (res.ok) {
                alert("Order created successfully!");
                createOrderModal.hide();
                loadOrders(filterSelect.value); // Refresh table
            } else {
                alert("Failed to create order.");
            }
        } catch (err) {
            alert("Network error.");
        } finally {
            btn.innerHTML = 'Place Order';
            btn.disabled = false;
        }
    });
});

// --- GLOBAL FUNCTIONS (Window Scope) ---

// 1. Instant Status Update (PATCH)
window.updateOrderStatus = async (orderId, selectElement) => {
    const newStatus = selectElement.value;
    const previousStatus = selectElement.getAttribute('data-prev') || selectElement.querySelector('option[selected]')?.value;
    
    // Determine color class to apply on success
    const getStatusColorClass = (status) => {
        switch(status) {
            case 'Pending Payment': return 'text-warning bg-warning bg-opacity-10 border-warning';
            case 'Processing': return 'text-primary bg-primary bg-opacity-10 border-primary';
            case 'Shipped': return 'text-info bg-info bg-opacity-10 border-info';
            case 'Delivered': return 'text-success bg-success bg-opacity-10 border-success';
            case 'Cancelled': return 'text-danger bg-danger bg-opacity-10 border-danger';
            default: return '';
        }
    };

    selectElement.disabled = true;

    try {
        const res = await fetch(`/api/store/admin/orders/${orderId}/status/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
            body: JSON.stringify({ status: newStatus })
        });

        if (res.ok) {
            selectElement.setAttribute('data-prev', newStatus);
            selectElement.className = `form-select form-select-sm fw-bold ${getStatusColorClass(newStatus)}`;
        } else {
            alert('Failed to update status.');
            selectElement.value = previousStatus;
        }
    } catch (error) {
        selectElement.value = previousStatus;
    } finally {
        selectElement.disabled = false;
    }
};

// 2. View Order Details Modal
window.viewOrderDetails = (orderId) => {
    const order = currentOrders.find(o => o.id == orderId);
    if (!order) { console.error("Order not found in cache", orderId); return; }

    const content = document.getElementById('orderDetailsContent');
    const itemsHtml = order.items.map(item => `
        <li class="list-group-item d-flex justify-content-between align-items-center bg-white border-0 border-bottom pb-2 mb-2">
            <div class="d-flex align-items-center">
                <img src="${item.product_image}" class="rounded me-3 border" style="width: 50px; height: 50px; object-fit: cover;">
                <div>
                    <h6 class="mb-0 text-dark">${item.product_name}</h6>
                    <small class="text-muted">Qty: ${item.quantity} x KSh ${parseFloat(item.purchase_price).toLocaleString()}</small>
                </div>
            </div>
            <span class="fw-bold">KSh ${(item.purchase_price * item.quantity).toLocaleString()}</span>
        </li>
    `).join('');

    content.innerHTML = `
        <div class="row g-3">
            <div class="col-md-6">
                <div class="card border-0 shadow-sm p-3 h-100">
                    <h6 class="fw-bold border-bottom pb-2">Customer Details</h6>
                    <p class="mb-1"><strong>Name:</strong> ${order.full_name}</p>
                    <p class="mb-1"><strong>Email:</strong> ${order.email}</p>
                    <p class="mb-1"><strong>Phone:</strong> ${order.phone}</p>
                    <p class="mb-0"><strong>Address:</strong><br>${order.shipping_address ? order.shipping_address.replace(/\n/g, '<br>') : 'N/A'}</p>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-0 shadow-sm p-3 h-100">
                    <h6 class="fw-bold border-bottom pb-2">Payment Info</h6>
                    <p class="mb-1"><strong>Account No:</strong> <span class="badge bg-light text-dark border font-monospace">${order.mpesa_account_number || 'N/A'}</span></p>
                    <p class="mb-1"><strong>Status:</strong> <span class="badge bg-dark">${order.status}</span></p>
                    <h5 class="fw-bold mt-3 text-khaki">Total: KSh ${parseFloat(order.total_amount).toLocaleString()}</h5>
                </div>
            </div>
            <div class="col-12 mt-3">
                <h6 class="fw-bold">Items Purchased</h6>
                <ul class="list-group list-group-flush rounded border p-2 bg-white">
                    ${itemsHtml}
                </ul>
            </div>
        </div>
    `;
    detailsModal.show();
};

// 3. Open Edit Order Modal
window.openEditOrderModal = (orderId) => {
    const order = currentOrders.find(o => o.id == orderId);
    if (!order) return;

    document.getElementById('editOrderId').value = order.id;
    document.getElementById('editOrderName').value = order.full_name;
    document.getElementById('editOrderEmail').value = order.email;
    document.getElementById('editOrderPhone').value = order.phone;
    document.getElementById('editOrderAddress').value = order.shipping_address;

    editOrderModal.show();
};

// 4. Delete Order (DELETE)
window.deleteOrder = async (orderId) => {
    if (!confirm(`⚠️ Are you sure you want to permanently delete Order #${orderId}? This cannot be undone.`)) return;

    try {
        const res = await fetch(`/api/store/admin/orders/${orderId}/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCSRFToken() }
        });

        if (res.ok || res.status === 204) {
            // Force a table refresh to remove the deleted order
            document.getElementById('orderStatusFilter').dispatchEvent(new Event('change'));
        } else {
            const err = await res.json();
            alert('Failed to delete order: ' + (err.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Network error occurred while trying to delete.');
    }
};

// --- CART FUNCTIONS FOR MANUAL ORDER ---

window.addToAdminCart = (id, name, price, image) => {
    document.getElementById('adminProductSearchResults').classList.add('d-none');
    document.getElementById('adminProductSearch').value = '';

    const existing = adminCart.find(i => i.product_id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        adminCart.push({ product_id: id, name, price, quantity: 1, image });
    }
    renderAdminCart();
};

window.renderAdminCart = () => {
    const tbody = document.getElementById('adminCartBody');
    const totalEl = document.getElementById('adminCartTotal');
    const submitBtn = document.getElementById('submitManualOrderBtn');
    
    let total = 0;
    
    if (adminCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No items added.</td></tr>';
        submitBtn.disabled = true;
    } else {
        tbody.innerHTML = adminCart.map((item, index) => {
            total += (item.price * item.quantity);
            return `
                <tr>
                    <td>${item.name}</td>
                    <td><input type="number" min="1" class="form-control form-control-sm" value="${item.quantity}" onchange="updateAdminCartQty(${index}, this.value)"></td>
                    <td>${item.price.toLocaleString()}</td>
                    <td class="fw-bold">${(item.price * item.quantity).toLocaleString()}</td>
                    <td><button class="btn btn-sm text-danger border-0" onclick="removeAdminCartItem(${index})">🗑️</button></td>
                </tr>
            `;
        }).join('');
        submitBtn.disabled = false;
    }
    totalEl.innerText = `KSh ${total.toLocaleString()}`;
};

window.updateAdminCartQty = (index, qty) => {
    if (qty < 1) return;
    adminCart[index].quantity = parseInt(qty);
    renderAdminCart();
};

window.removeAdminCartItem = (index) => {
    adminCart.splice(index, 1);
    renderAdminCart();
};