// static/js/pages/my_orders.js

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('ordersContainer');

    // Helper function to color-code order statuses
    const getStatusBadge = (status) => {
        switch (status) {
            case 'Pending': return '<span class="badge bg-warning text-dark">Pending</span>';
            case 'Processing': return '<span class="badge bg-info text-dark">Processing</span>';
            case 'Shipped': return '<span class="badge bg-primary">Shipped</span>';
            case 'Delivered': return '<span class="badge bg-success">Delivered</span>';
            case 'Cancelled': return '<span class="badge bg-danger">Cancelled</span>';
            default: return `<span class="badge bg-secondary">${status}</span>`;
        }
    };

    try {
        const response = await fetch('/api/store/orders/my-orders/');
        
        // If the user isn't logged in, the API will reject the request
        if (response.status === 401 || response.status === 403) {
            window.location.href = '/'; 
            return;
        }

        const orders = await response.json();

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="col-md-8 text-center py-5 bg-white shadow-sm rounded">
                    <span class="fs-1">🛍️</span>
                    <h5 class="mt-3 text-dark fw-bold">You haven't placed any orders yet.</h5>
                    <p class="text-muted">Start exploring our collections and discover your style.</p>
                    <a href="/" class="btn btn-khaki mt-3">Start Shopping</a>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(order => {
            // --- NEW: Generate Paybill Instructions for unpaid orders ---
            let paybillInstructions = '';
            if (order.status === 'Pending Payment') {
                paybillInstructions = `
                    <div class="alert alert-warning m-3 border-warning border-start border-4 shadow-sm" role="alert">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="fw-bold mb-2 text-dark">📱 Complete Your Payment</h6>
                                <p class="small mb-2 text-dark">If your M-Pesa prompt timed out, please pay manually via your SIM Toolkit or M-Pesa App:</p>
                                <ul class="list-unstyled mb-0 font-monospace text-dark bg-white p-2 rounded border">
                                    <li><strong>1. Paybill Business No:</strong> 4043381</li>
                                    <li><strong>2. Account No:</strong> ${order.mpesa_account_number}</li>
                                    <li><strong>3. Amount:</strong> KSh ${parseFloat(order.total_amount).toLocaleString()}</li>
                                </ul>
                            </div>
                            <button class="btn btn-sm btn-dark" onclick="window.location.reload()">
                                🔄 Refresh Status
                            </button>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="col-lg-8 mb-4">
                    <div class="card border-0 shadow-sm">
                        <div class="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center">
                            <div>
                                <span class="text-muted small d-block">Order #${order.id}</span>
                                <span class="fw-bold text-dark">${new Date(order.created_at).toLocaleDateString()}</span>
                            </div>
                            <div>
                                ${getStatusBadge(order.status)}
                            </div>
                        </div>
                        
                        ${paybillInstructions}
                        
                        <div class="card-body p-0">
                            <ul class="list-group list-group-flush">
                                ${order.items.map(item => `
                                    <li class="list-group-item p-3 d-flex align-items-center border-0">
                                        <img src="${item.product_image}" alt="${item.product_name}" class="rounded border" style="width: 60px; height: 60px; object-fit: cover;">
                                        <div class="ms-3 flex-grow-1">
                                            <h6 class="mb-1 text-dark">${item.product_name}</h6>
                                            <span class="text-muted small">Qty: ${item.quantity}</span>
                                        </div>
                                        <div class="fw-bold text-dark">
                                            KSh ${(item.purchase_price * item.quantity).toLocaleString()}
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        <div class="card-footer bg-light p-3 d-flex justify-content-between align-items-center">
                            <span class="text-muted fw-bold">Order Total:</span>
                            <span class="fw-bold fs-5 text-dark">KSh ${parseFloat(order.total_amount).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Failed to load orders:", error);
        container.innerHTML = '<div class="col-12 text-center text-danger py-5">Failed to load order history. Please refresh the page.</div>';
    }
});