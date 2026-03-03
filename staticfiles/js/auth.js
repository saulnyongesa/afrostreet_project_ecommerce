// static/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    
    // --- CSRF Token Helper ---
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

    // --- DOM Elements ---
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const authAlert = document.getElementById('authAlert');
    const logoutBtn = document.getElementById('logoutBtn'); // May be null if not logged in

    // --- Toggle Forms in Modal ---
    if (showRegisterLink && showLoginLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('d-none');
            registerForm.classList.remove('d-none');
            authAlert.classList.add('d-none'); // Clear errors
        });

        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.add('d-none');
            loginForm.classList.remove('d-none');
            authAlert.classList.add('d-none'); // Clear errors
        });
    }

    // --- Show Alert Helper ---
    const showAlert = (message, type = 'danger') => {
        authAlert.className = `alert alert-${type}`;
        authAlert.textContent = message;
        authAlert.classList.remove('d-none');
    };

    // --- Handle Login ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const btn = document.getElementById('loginBtn');
            
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Loading...';
            btn.disabled = true;

            try {
                const response = await fetch('/api/accounts/login/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    showAlert('Login successful!', 'success');
                    // Reload exactly where the user is to update the navbar seamlessly
                    setTimeout(() => window.location.reload(), 800); 
                } else {
                    showAlert(data.error || 'Invalid credentials.');
                    btn.innerHTML = 'Login';
                    btn.disabled = false;
                }
            } catch (error) {
                showAlert('A network error occurred.');
                btn.innerHTML = 'Login';
                btn.disabled = false;
            }
        });
    }

    // --- Handle Registration ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const full_name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const btn = document.getElementById('registerBtn');

            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating...';
            btn.disabled = true;

            try {
                const response = await fetch('/api/accounts/register/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify({ full_name, email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    showAlert('Account created successfully!', 'success');
                    setTimeout(() => window.location.reload(), 800);
                } else {
                    // Extract DRF validation errors
                    const errorMsg = Object.values(data).flat().join(' ');
                    showAlert(errorMsg || 'Failed to register.');
                    btn.innerHTML = 'Register';
                    btn.disabled = false;
                }
            } catch (error) {
                showAlert('A network error occurred.');
                btn.innerHTML = 'Register';
                btn.disabled = false;
            }
        });
    }

    // --- Handle Logout ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch('/api/accounts/logout/', {
                    method: 'POST',
                    headers: { 'X-CSRFToken': csrftoken }
                });
                window.location.reload();
            } catch (error) {
                console.error("Logout failed:", error);
            }
        });
    }
});