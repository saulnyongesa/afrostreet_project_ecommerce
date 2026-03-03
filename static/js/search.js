// static/js/search.js

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('smartSearchInput');
    const suggestionsBox = document.getElementById('searchSuggestionsBox');
    const resultsBox = document.getElementById('searchResultsBox');

    // Utility: Debounce function to limit API calls while typing
    const debounce = (func, delay = 300) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(null, args), delay);
        };
    };

    // Auto-suggest API Call
    const fetchSuggestions = async (query) => {
        if (query.length < 2) {
            suggestionsBox.classList.add('d-none');
            return;
        }

        try {
            const response = await fetch(`/api/search/autocomplete/?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.length > 0) {
                suggestionsBox.innerHTML = ''; // Clear previous
                data.forEach(item => {
                    const btn = document.createElement('button');
                    btn.className = 'list-group-item list-group-item-action fw-bold text-khaki';
                    // Show query text, and append a little trend icon if it's highly searched
                    btn.innerHTML = `🔍 ${item.query_text} <span class="badge bg-light text-secondary float-end">Trending</span>`;
                    
                    // Clicking a suggestion executes the full search
                    btn.onclick = () => {
                        searchInput.value = item.query_text;
                        suggestionsBox.classList.add('d-none');
                        executeSearch(item.query_text);
                    };
                    suggestionsBox.appendChild(btn);
                });
                suggestionsBox.classList.remove('d-none');
            } else {
                suggestionsBox.classList.add('d-none');
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    };

    // Full Search Execution API Call
    const executeSearch = async (query) => {
        if (!query) return;

        // UI Update: Show Loading State
        suggestionsBox.classList.add('d-none');
        resultsBox.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="spinner-border text-khaki" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Searching Afrostreet...</p>
            </div>
        `;

        try {
            const response = await fetch(`/api/search/results/?q=${encodeURIComponent(query)}`);
            const products = await response.json();

            resultsBox.innerHTML = ''; // Clear loading spinner

            if (products.length === 0) {
                resultsBox.innerHTML = `
                    <div class="col-12 text-center py-5 text-muted">
                        <h5>No products found for "${query}"</h5>
                        <p>Try searching for "bags", "earrings", or check our categories.</p>
                    </div>
                `;
                return;
            }

            // Render Product Cards dynamically
            products.forEach(product => {
                const productHtml = `
                    <div class="col-6 col-md-4 mb-3">
                        <div class="card h-100 border-0 shadow-sm product-card">
                            <img src="${product.image}" class="card-img-top" alt="${product.name}" style="object-fit: cover; height: 200px;">
                            <div class="card-body p-2">
                                <small class="text-muted">${product.category ? product.category.name : 'Uncategorized'}</small>
                                <h6 class="card-title text-truncate mb-1">${product.name}</h6>
                                <div class="fw-bold text-dark">KSh ${parseFloat(product.price).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                `;
                resultsBox.insertAdjacentHTML('beforeend', productHtml);
            });

        } catch (error) {
            console.error('Search execution failed:', error);
            resultsBox.innerHTML = `<div class="col-12 text-center text-danger py-4">An error occurred. Please try again.</div>`;
        }
    };

    // --- Event Listeners ---
    
    // 1. Listen for typing (triggers autocomplete with debounce)
    searchInput.addEventListener('input', debounce((e) => {
        fetchSuggestions(e.target.value.trim());
    }, 300));

    // 2. Listen for 'Enter' key to execute full search
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeSearch(e.target.value.trim());
        }
    });

    // 3. Close suggestions box if user clicks outside of it
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.classList.add('d-none');
        }
    });
});