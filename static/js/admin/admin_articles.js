// static/js/admin/admin_articles.js

let editorInstance;
const articleModal = new bootstrap.Modal(document.getElementById('articleModal'));

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Initialize AfroCropper for the cover image (Ratio 16/9 for banners)
    window.AfroCropper.init('articleImageInput', 'articleImagePreview', 'articleFinalImageUrl', 16/9);

    // --- NEW: Custom CKEditor Upload Adapter ---
    // This intercepts images dropped into CKEditor and sends them to our existing Base64 endpoint
    class Base64UploadAdapter {
        constructor(loader) {
            this.loader = loader;
        }

        upload() {
            return this.loader.file.then(file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async () => {
                    const base64Image = reader.result;
                    try {
                        const response = await fetch('/api/store/admin/upload-image/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCSRFToken()
                            },
                            body: JSON.stringify({ image_base64: base64Image })
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok) {
                            // CKEditor requires the URL to be returned in a 'default' property
                            resolve({ default: data.url }); 
                        } else {
                            reject(data.error || 'Upload failed');
                        }
                    } catch (error) {
                        reject('Network error during image upload.');
                    }
                };
                reader.readAsDataURL(file);
            }));
        }

        abort() {
            // Can be implemented if you want to support aborting uploads
        }
    }

    function CustomUploadAdapterPlugin(editor) {
        editor.plugins.get('FileRepository').createUploadAdapter = (loader) => {
            return new Base64UploadAdapter(loader);
        };
    }
    // -------------------------------------------

    // 2. Initialize CKEditor 5
    ClassicEditor
        .create(document.querySelector('#articleContentEditor'), {
            // Note: 'imageUpload' is the standard toolbar name for the default Classic build
            toolbar: ['heading', '|', 'bold', 'italic', 'imageUpload', 'link', 'bulletedList', 'numberedList', 'blockQuote', 'insertTable', 'undo', 'redo'],
            extraPlugins: [CustomUploadAdapterPlugin] // Attach our custom uploader here!
        })
        .then(editor => {
            editorInstance = editor;
        })
        .catch(error => console.error(error));

    // Helper to format image URLs from the database string
    const getFullImageUrl = (imagePath) => {
        if (!imagePath) return '';
        if (imagePath.startsWith('http') || imagePath.startsWith('/media/')) return imagePath;
        return `/media/${imagePath}`; // Prepend media URL if it's just the relative path
    };

    // 3. Fetch and Render Articles Table
    const loadArticles = async () => {
        const tbody = document.getElementById('articlesTableBody');
        try {
            const res = await fetch('/api/blog/admin/articles/');
            const articles = await res.json();

            if (articles.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No articles found. Click "Write New Article" to start.</td></tr>';
                return;
            }

            tbody.innerHTML = articles.map(article => {
                const imageUrl = getFullImageUrl(article.cover_image);
                
                // Dynamic Button Styling based on current status
                const publishBtnText = article.is_published ? '🚫 Unpublish' : '✅ Publish';
                const publishBtnClass = article.is_published ? 'btn-outline-warning' : 'btn-outline-success';
                const statusBadge = article.is_published 
                    ? '<span class="badge bg-success bg-opacity-10 text-success border border-success">Published</span>' 
                    : '<span class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary">Draft</span>';

                return `
                    <tr>
                        <td class="ps-4">
                            <div class="d-flex align-items-center">
                                <img src="${imageUrl}" class="rounded me-3 shadow-sm" style="width: 50px; height: 50px; object-fit: cover;">
                                <span class="fw-bold text-dark text-truncate" style="max-width: 250px;">${article.title}</span>
                            </div>
                        </td>
                        <td class="text-muted small">${article.author_name || 'Admin'}</td>
                        <td class="text-muted small">${new Date(article.created_at).toLocaleDateString()}</td>
                        <td>${statusBadge}</td>
                        <td class="text-end pe-4">
                            <button class="btn btn-sm ${publishBtnClass} me-2" onclick="togglePublish(${article.id}, ${article.is_published})">
                                ${publishBtnText}
                            </button>
                            <button class="btn btn-sm btn-light border me-1" onclick='editArticle(${JSON.stringify(article).replace(/'/g, "&#39;")})'>
                                ✏️ Edit
                            </button>
                            <button class="btn btn-sm btn-light border text-danger" onclick="deleteArticle(${article.id})">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Failed to load data. Please refresh.</td></tr>';
        }
    };

    loadArticles(); // Initial load

    // 4. Handle Save Button (Create & Update via Modal)
    document.getElementById('saveArticleBtn').addEventListener('click', async (e) => {
        const btn = e.target;
        const id = document.getElementById('articleId').value;
        const title = document.getElementById('articleTitle').value;
        const content = editorInstance.getData();
        const coverImageUrl = document.getElementById('articleFinalImageUrl').value;
        const isPublished = document.getElementById('articleIsPublished').checked;

        if (!title || !content || !coverImageUrl) {
            alert('Please fill out the title, content, and select a cropped cover image.');
            return;
        }

        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
        btn.disabled = true;

        const payload = {
            title: title,
            content: content,
            cover_image: coverImageUrl, // Sends the relative path to DRF
            is_published: isPublished
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/blog/admin/articles/${id}/` : '/api/blog/admin/articles/';

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
                articleModal.hide();
                loadArticles(); // Refresh table instantly
            } else {
                const err = await res.json();
                alert('Error: ' + JSON.stringify(err));
            }
        } catch (error) {
            alert('A network error occurred.');
        } finally {
            btn.innerHTML = 'Save Article';
            btn.disabled = false;
        }
    });

    // --- Global Functions (Accessible by onclick attributes in the HTML) ---

    // Open Modal for NEW Article
    window.openArticleModal = () => {
        document.getElementById('articleModalTitle').innerText = 'Write New Article';
        document.getElementById('articleId').value = '';
        document.getElementById('articleTitle').value = '';
        editorInstance.setData('');
        document.getElementById('articleImageInput').value = '';
        document.getElementById('articleFinalImageUrl').value = '';
        document.getElementById('articleImagePreview').classList.add('d-none');
        document.getElementById('articleIsPublished').checked = true;
        articleModal.show();
    };

    // Open Modal for EDITING an Article
    window.editArticle = (article) => {
        document.getElementById('articleModalTitle').innerText = 'Edit Article';
        document.getElementById('articleId').value = article.id;
        document.getElementById('articleTitle').value = article.title;
        editorInstance.setData(article.content);
        
        // Load existing image into the preview (convert to full URL for the <img> tag)
        document.getElementById('articleFinalImageUrl').value = article.cover_image;
        const preview = document.getElementById('articleImagePreview');
        preview.src = getFullImageUrl(article.cover_image);
        preview.classList.remove('d-none');
        
        document.getElementById('articleIsPublished').checked = article.is_published;
        articleModal.show();
    };

    // Quick Toggle: Publish / Unpublish directly from the table
    window.togglePublish = async (id, currentStatus) => {
        try {
            const newStatus = !currentStatus; // Flip the status
            const res = await fetch(`/api/blog/admin/articles/${id}/`, {
                method: 'PUT', // We configured our API to accept partial PUT updates
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({ is_published: newStatus })
            });

            if (res.ok) {
                loadArticles(); // Refresh the table instantly to show the new badge
            } else {
                alert('Failed to update publish status.');
            }
        } catch (error) {
            alert('A network error occurred.');
        }
    };

    // Delete Article
    window.deleteArticle = async (id) => {
        if (!confirm('Are you sure you want to delete this article? This cannot be undone.')) return;
        
        try {
            const res = await fetch(`/api/blog/admin/articles/${id}/`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCSRFToken() }
            });
            if (res.ok) {
                loadArticles(); // Refresh table
            } else {
                alert('Failed to delete.');
            }
        } catch (error) {
            alert('A network error occurred.');
        }
    };
});