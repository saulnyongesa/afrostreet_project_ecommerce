// static/js/base.js

document.addEventListener('DOMContentLoaded', async () => {
    // Populate Global Navbar Categories
    const loadNavCategories = async () => {
        try {
            const response = await fetch('/api/store/categories/');
            const categories = await response.json();
            const navDropdown = document.getElementById('navCategoryDropdown');

            if (!navDropdown) return; // Exit if navbar isn't on this page for some reason

            if (categories.length === 0) {
                navDropdown.innerHTML = '<li><span class="dropdown-item text-muted">No categories</span></li>';
                return;
            }

            navDropdown.innerHTML = categories.map(cat => `
                <li><a class="dropdown-item transition-hover" href="/category/${cat.slug}/">${cat.name}</a></li>
            `).join('');
            
        } catch (error) {
            console.error("Failed to load navbar categories:", error);
        }
    };

    loadNavCategories();
});