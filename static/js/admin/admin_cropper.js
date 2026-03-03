// static/js/admin/admin_cropper.js

window.AfroCropper = {
    cropperInstance: null,
    currentInputElement: null,
    targetPreviewElement: null,
    targetHiddenInputElement: null,

    /**
     * Binds the cropper to a specific file input.
     * @param {string} inputId - The ID of the <input type="file">
     * @param {string} previewId - The ID of the <img> to show the final result
     * @param {string} hiddenInputId - The ID of the hidden input to store the final URL
     * @param {number} defaultRatio - The required aspect ratio (e.g., 1 for square, 16/9 for banners)
     */
    init: function(inputId, previewId, hiddenInputId, defaultRatio = 1) {
        const fileInput = document.getElementById(inputId);
        if (!fileInput) return;

        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                const file = files[0];
                
                // Ensure it's an image
                if (!file.type.startsWith('image/')) {
                    alert('Please select a valid image file.');
                    return;
                }

                this.currentInputElement = fileInput;
                this.targetPreviewElement = document.getElementById(previewId);
                this.targetHiddenInputElement = document.getElementById(hiddenInputId);

                // Convert file to URL and load into modal
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imageToCrop = document.getElementById('imageToCrop');
                    imageToCrop.src = event.target.result;
                    
                    // Show the modal
                    const modalEl = document.getElementById('cropperModal');
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();

                    // Initialize Cropper when modal is fully shown
                    modalEl.addEventListener('shown.bs.modal', () => {
                        if (this.cropperInstance) {
                            this.cropperInstance.destroy();
                        }
                        this.cropperInstance = new Cropper(imageToCrop, {
                            aspectRatio: defaultRatio,
                            viewMode: 2, // Restrict crop box to not exceed canvas
                            dragMode: 'move',
                            autoCropArea: 1,
                            restore: false,
                            guides: true,
                            center: true,
                            highlight: false,
                            cropBoxMovable: true,
                            cropBoxResizable: true,
                            toggleDragModeOnDblclick: false,
                        });
                    }, { once: true }); // Ensure event only fires once
                };
                reader.readAsDataURL(file);
            }
        });
    },

    // Allow admin to switch aspect ratios dynamically
    setRatio: function(ratio) {
        if (this.cropperInstance) {
            this.cropperInstance.setAspectRatio(ratio);
        }
    }
};

// Handle the "Crop & Upload" Button click
document.addEventListener('DOMContentLoaded', () => {
    const confirmBtn = document.getElementById('confirmCropBtn');
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (!window.AfroCropper.cropperInstance) return;

            // Show loading state
            const originalText = confirmBtn.innerHTML;
            confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Uploading...';
            confirmBtn.disabled = true;

            // Get the cropped image as a high-quality Base64 string
            const canvas = window.AfroCropper.cropperInstance.getCroppedCanvas({
                width: 1080, // Max width standard for e-commerce
                height: 1080,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            });
            
            const base64Image = canvas.toDataURL('image/jpeg', 0.85); // 85% quality JPEG

            try {
                // Post to our DRF endpoint
                const response = await fetch('/api/store/admin/upload-image/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken() // Helper from admin_base.html
                    },
                    body: JSON.stringify({ image_base64: base64Image })
                });

                const data = await response.json();

                if (response.ok) {
                    // 1. Update the hidden input with the relative PATH for the database!
                    if (window.AfroCropper.targetHiddenInputElement) {
                        window.AfroCropper.targetHiddenInputElement.value = data.path; // CHANGED FROM data.url
                    }

                    // 2. Update the preview image on the main form with the full URL
                    if (window.AfroCropper.targetPreviewElement) {
                        window.AfroCropper.targetPreviewElement.src = data.url; 
                        window.AfroCropper.targetPreviewElement.classList.remove('d-none');
                    }

                    // 3. Clear the file input so it can be used again if needed
                    window.AfroCropper.currentInputElement.value = '';

                    // 4. Close the modal
                    const modalEl = document.getElementById('cropperModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    modal.hide();
                } else {
                    alert('Upload failed: ' + data.error);
                }
            } catch (error) {
                console.error('Cropper upload error:', error);
                alert('A network error occurred.');
            } finally {
                // Restore button state
                confirmBtn.innerHTML = originalText;
                confirmBtn.disabled = false;
            }
        });
    }
});