// static/js/pages/checkout.js

document.addEventListener('DOMContentLoaded', () => {
    const cart = window.AfroCart.getCart();

    // 1. Kick them back to home if they try to access checkout with an empty cart
    if (cart.length === 0) {
        window.location.href = '/';
        return;
    }

    // 2. Render Order Summary
    const container = document.getElementById('checkoutItemsContainer');
    let subtotal = 0;

    container.innerHTML = cart.map(item => {
        subtotal += (item.price * item.quantity);
        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-center">
                    <span class="badge bg-secondary rounded-pill me-2">${item.quantity}</span>
                    <span class="text-truncate" style="max-width: 200px; font-size: 0.9rem;">${item.name}</span>
                </div>
                <span class="text-dark fw-bold" style="font-size: 0.9rem;">KSh ${(item.price * item.quantity).toLocaleString()}</span>
            </div>
        `;
    }).join('');

    document.getElementById('checkoutSubtotal').innerText = `KSh ${subtotal.toLocaleString()}`;
    document.getElementById('checkoutTotal').innerText = `KSh ${subtotal.toLocaleString()}`;

    // 3. Handle Form Submission
    const checkoutForm = document.getElementById('checkoutForm');
    
    // Grab the CSRF token using the helper
    const getCookie = (name) => {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    };
    const csrftoken = getCookie('csrftoken');

    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('placeOrderBtn');
        const instructionBox = document.getElementById('mpesaInstructionBox');
        const displayAccountNumber = document.getElementById('displayAccountNumber');
        const displayAmount = document.getElementById('displayAmount');
        
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Initiating M-Pesa...';
        btn.disabled = true;

        const payload = {
            customer: {
                full_name: document.getElementById('chkName').value,
                email: document.getElementById('chkEmail').value,
                phone: document.getElementById('chkPhone').value,
                shipping_address: document.getElementById('chkAddress').value
            },
            items: cart.map(item => ({ id: item.id, quantity: item.quantity }))
        };

        try {
            const response = await fetch('/api/store/checkout/process/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            // CRITICAL FIX: If order_id exists, the order is safely in the database!
            if (data.order_id) {
                
                // 1. Immediately clear the cart to prevent duplicate orders
                window.AfroCart.saveCart([]);

                // 2. Hide the checkout button and show the instruction box
                btn.classList.add('d-none');
                instructionBox.classList.remove('d-none');

                // 3. Populate the exact Paybill details (useful for both timeout and failure)
                displayAccountNumber.innerText = data.account_number;
                displayAmount.innerText = `KSh ${subtotal.toLocaleString()}`;

                // SCENARIO A: STK Push was successfully sent to the phone
                if (data.checkout_request_id) {
                    const pollInterval = setInterval(async () => {
                        const statusRes = await fetch(`/api/store/mpesa/status/${data.checkout_request_id}/`);
                        const statusData = await statusRes.json();
                        
                        if (statusData.status === 'COMPLETED') {
                            clearInterval(pollInterval);
                            alert(`Payment Received! Your order #${data.order_id} is processing.`);
                            window.location.href = '/my-orders/'; 
                        }
                    }, 3000); 

                    // Timeout after 45 seconds if they ignore the prompt
                    setTimeout(() => {
                        clearInterval(pollInterval);
                        instructionBox.innerHTML = `
                            <h5 class="fw-bold text-danger">M-Pesa Prompt Timed Out</h5>
                            <p class="text-muted">Don't worry, your order is saved! Please use the Paybill details below to complete your payment.</p>
                            <div class="bg-white p-3 rounded border text-start d-inline-block">
                                <strong class="text-muted">Paybill:</strong> <span class="text-dark fw-bold">4043381</span> <br>
                                <strong class="text-muted">Account:</strong> <span class="text-success fw-bold fs-5">${data.account_number}</span><br>
                                <strong class="text-muted">Amount:</strong> <span class="text-dark fw-bold">KSh ${subtotal.toLocaleString()}</span>
                            </div>
                            <br>
                            <a href="/my-orders/" class="btn btn-dark mt-3">View My Orders</a>
                        `;
                    }, 45000);
                } 
                
                // SCENARIO B: STK Push Failed immediately (Safaricom issue, invalid number, etc.)
                else {
                    instructionBox.innerHTML = `
                        <h5 class="fw-bold text-danger">M-Pesa Push Failed</h5>
                        <p class="text-muted">We couldn't send the prompt to your phone, but your order is safely placed! Please pay manually using the details below:</p>
                        <div class="bg-white p-3 rounded border text-start d-inline-block">
                            <strong class="text-muted">Paybill:</strong> <span class="text-dark fw-bold">4043381</span> <br>
                            <strong class="text-muted">Account:</strong> <span class="text-success fw-bold fs-5">${data.account_number}</span><br>
                            <strong class="text-muted">Amount:</strong> <span class="text-dark fw-bold">KSh ${subtotal.toLocaleString()}</span>
                        </div>
                        <br>
                        <a href="/my-orders/" class="btn btn-dark mt-3">View My Orders</a>
                    `;
                }
            } 
            
            // SCENARIO C: Complete failure (e.g., cart was empty, backend validation failed)
            else {
                alert(data.error || 'Failed to place order.');
                btn.innerHTML = 'Pay Securely with M-Pesa';
                btn.disabled = false;
            }
        } catch (error) {
            alert('A network error occurred. Please try again.');
            btn.innerHTML = 'Pay Securely with M-Pesa';
            btn.disabled = false;
        }
    });
});