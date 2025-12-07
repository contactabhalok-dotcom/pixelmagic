/**
 * PixelMagic - Upload Module
 * Handles drag-drop and file upload functionality
 */

class UploadHandler {
    constructor(options = {}) {
        this.uploadArea = options.uploadArea;
        this.fileInput = options.fileInput;
        this.onFileSelect = options.onFileSelect || (() => {});
        this.validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        this.maxSize = 10 * 1024 * 1024; // 10MB

        if (this.uploadArea && this.fileInput) {
            this.init();
        }
    }

    init() {
        // Drag and drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            this.uploadArea.addEventListener(event, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(event => {
            this.uploadArea.addEventListener(event, () => {
                this.uploadArea.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(event => {
            this.uploadArea.addEventListener(event, () => {
                this.uploadArea.classList.remove('dragover');
            });
        });

        // Handle drop
        this.uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });

        // Handle click
        this.uploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });

        // Handle file input change
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });
    }

    handleFile(file) {
        // Validate type
        if (!this.validTypes.includes(file.type)) {
            if (typeof showToast === 'function') {
                showToast('Invalid file type. Please upload JPG, PNG, or WebP.', 'error');
            }
            return;
        }

        // Validate size
        if (file.size > this.maxSize) {
            if (typeof showToast === 'function') {
                showToast('File too large. Maximum size is 10MB.', 'error');
            }
            return;
        }

        this.onFileSelect(file);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UploadHandler;
}
