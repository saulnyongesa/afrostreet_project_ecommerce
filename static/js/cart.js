// static/js/cart.js

// Initialize a global AfroCart object
window.AfroCart = {
    cartKey: 'afrostreet_cart',

    // Get cart array from LocalStorage
    getCart: function() {
        return JSON.parse(localStorage.getItem(this.cartKey)) || [];
    },

    // Save cart array to LocalStorage
    saveCart: function(cart) {
        localStorage.setItem(this.cartKey, JSON.stringify(cart));
        this.updateUI();
    },

    // Add a product to the cart
    addItem: function(product) {
        let cart = this.getCart();
        // Check if item already exists
        let existingItem = cart.find(item => item.id === product.id);

        if (existingItem) {
            existingItem.quantity += 1; // Increment quantity
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                slug: product.slug,
                price: parseFloat(product.price), // Use discount if available
                image: product.image,
                quantity: 1
            });
        }
        this.saveCart(cart);
        
        // Optionally pop open the cart to show the user it was added
        const cartOffcanvas = new bootstrap.Offcanvas(document.getElementById('cartOffcanvas'));
        cartOffcanvas.show();
    },

    // Remove an item entirely
    removeItem: function(productId) {
        let cart = this.getCart();
        cart = cart.filter(item => item.id !== productId);
        this.saveCart(cart);
    },

    // Change quantity (+1 or -1)
    changeQuantity: function(productId, delta) {
        let cart = this.getCart();
        let item = cart.find(i => i.id === productId);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                this.removeItem(productId);
                return;
            }
            this.saveCart(cart);
        }
    },

    // Master function to update all UI elements (Badge, List, Totals)
    updateUI: function() {
        const cart = this.getCart();
        
        // Target both Desktop and Mobile Badges
        const badgeDesktop = document.getElementById('navCartBadge');
        const badgeMobile = document.getElementById('navCartBadgeMobile');
        
        const container = document.getElementById('cartItemsContainer');
        const subtotalEl = document.getElementById('cartSubtotal');
        const checkoutBtn = document.getElementById('checkoutBtn');

        // 1. Update Badge Total Items on all screens
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (badgeDesktop) badgeDesktop.innerText = totalItems;
        if (badgeMobile) badgeMobile.innerText = totalItems;

        // 2. Calculate Subtotal
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if(subtotalEl) subtotalEl.innerText = `KSh ${subtotal.toLocaleString()}`;

        // 3. Enable/Disable Checkout Button
        if(checkoutBtn) {
            checkoutBtn.disabled = cart.length === 0;
            checkoutBtn.onclick = () => {
                window.location.href = '/checkout/';
            };
        }

        // 4. Render Items in Offcanvas
        if (!container) return;

        if (cart.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted mt-5">
                    <span class="fs-1">🛍️</span>
                    <p class="mt-2">Your cart is currently empty.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = cart.map(item => `
            <div class="d-flex mb-3 border-bottom pb-3">
                <img src="/media/${item.image}" alt="${item.name}" class="rounded border" style="width: 70px; height: 70px; object-fit: cover;">
                <div class="ms-3 flex-grow-1">
                    <h6 class="mb-1 text-dark text-truncate" style="max-width: 180px;">${item.name}</h6>
                    <div class="text-khaki fw-bold small mb-2">KSh ${item.price.toLocaleString()}</div>
                    
                    <div class="d-flex align-items-center">
                        <div class="btn-group btn-group-sm" role="group">
                            <button type="button" class="btn btn-outline-secondary px-2 py-0" onclick="window.AfroCart.changeQuantity(${item.id}, -1)">-</button>
                            <span class="px-3 border-top border-bottom d-flex align-items-center">${item.quantity}</span>
                            <button type="button" class="btn btn-outline-secondary px-2 py-0" onclick="window.AfroCart.changeQuantity(${item.id}, 1)">+</button>
                        </div>
                        <button class="btn btn-link text-danger text-decoration-none btn-sm ms-auto p-0" onclick="window.AfroCart.removeItem(${item.id})">Remove</button>
                    </div>
                </div>
            </div>
        `).join('');
    }
};

// Initialize UI on page load
document.addEventListener('DOMContentLoaded', () => {
    window.AfroCart.updateUI();
});