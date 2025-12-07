/**
 * PixelMagic - Upscale Tool Module (Enhanced)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const fileInput = document.getElementById('fileInput');
    const selectImageBtn = document.getElementById('selectImageBtn');
    const emptyState = document.getElementById('emptyState');
    const uploadedImage = document.getElementById('uploadedImage');
    const uploadInfo = document.getElementById('uploadInfo');
    const uploadDimensions = document.getElementById('uploadDimensions');

    const scaleCards = document.querySelectorAll('.scale-card');
    const preview2x = document.getElementById('preview2x');
    const preview4x = document.getElementById('preview4x');
    const preview8x = document.getElementById('preview8x');

    const comparisonSection = document.getElementById('comparisonSection');
    const comparisonWrapper = document.getElementById('comparisonWrapper');
    const beforeImage = document.getElementById('beforeImage');
    const afterImage = document.getElementById('afterImage');
    const comparisonSlider = document.getElementById('comparisonSlider');
    const loadingOverlay = document.getElementById('loadingOverlay');

    const resetBtn = document.getElementById('resetBtn');
    const upscaleBtn = document.getElementById('upscaleBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // State
    let currentFile = null;
    let uploadedFilename = null;
    let processedFilename = null;
    let originalWidth = 0;
    let originalHeight = 0;
    let selectedScale = 4;
    let sliderPosition = 50;
    let isDragging = false;
    let originalImageDataUrl = null;

    // Initialize
    init();

    function init() {
        // Check for pending image
        const pending = checkPendingImage();
        if (pending) {
            const file = dataURLtoFile(pending.dataUrl, pending.name);
            handleFileSelect(file);
        }

        // Event listeners
        selectImageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });

        // Drag and drop
        const uploadPreview = document.getElementById('uploadPreview');
        setupDragDrop(uploadPreview);

        // Scale selection
        scaleCards.forEach(card => {
            card.addEventListener('click', () => {
                // Check if this card is disabled
                if (card.style.pointerEvents === 'none') return;

                scaleCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                selectedScale = parseInt(card.dataset.scale);
            });
        });

        // Comparison slider
        setupComparisonSlider();

        // Action buttons
        resetBtn.addEventListener('click', reset);
        upscaleBtn.addEventListener('click', processUpscale);
        downloadBtn.addEventListener('click', download);
    }

    function setupDragDrop(element) {
        if (!element) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            element.addEventListener(event, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(event => {
            element.addEventListener(event, () => element.classList.add('dragover'));
        });

        ['dragleave', 'drop'].forEach(event => {
            element.addEventListener(event, () => element.classList.remove('dragover'));
        });

        element.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });
    }

    function setupComparisonSlider() {
        comparisonSlider.addEventListener('mousedown', startDrag);
        comparisonSlider.addEventListener('touchstart', startDrag, { passive: false });

        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag, { passive: false });

        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);

        // Click anywhere on comparison to move slider
        comparisonWrapper.addEventListener('click', (e) => {
            if (e.target === comparisonSlider || e.target.closest('.comparison-handle')) return;

            const rect = comparisonWrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            sliderPosition = clamp((x / rect.width) * 100, 0, 100);
            updateSlider();
        });
    }

    function startDrag(e) {
        isDragging = true;
        e.preventDefault();
    }

    function drag(e) {
        if (!isDragging) return;

        const rect = comparisonWrapper.getBoundingClientRect();
        let clientX;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }

        const x = clientX - rect.left;
        sliderPosition = clamp((x / rect.width) * 100, 0, 100);
        updateSlider();

        e.preventDefault();
    }

    function endDrag() {
        isDragging = false;
    }

    function updateSlider() {
        comparisonWrapper.style.setProperty('--position', `${sliderPosition}%`);
        comparisonSlider.style.left = `${sliderPosition}%`;
    }

    async function handleFileSelect(file) {
        if (!validateFile(file)) return;

        currentFile = file;

        // Get dimensions
        const dims = await getImageDimensions(file);
        originalWidth = dims.width;
        originalHeight = dims.height;

        // Update UI
        uploadDimensions.textContent = `${originalWidth} x ${originalHeight} px`;
        updatePreviewDimensions();

        // Reset 8x card first
        const scale8Card = document.querySelector('[data-scale="8"]');
        scale8Card.style.opacity = '1';
        scale8Card.style.pointerEvents = 'auto';
        preview8x.textContent = `${originalWidth * 8} x ${originalHeight * 8}`;

        // Check if upscaling would be too large
        if (originalWidth * 8 > 10000 || originalHeight * 8 > 10000) {
            preview8x.textContent = 'Too large';
            scale8Card.style.opacity = '0.5';
            scale8Card.style.pointerEvents = 'none';

            // If 8x was selected, switch to 4x
            if (selectedScale === 8) {
                scaleCards.forEach(c => c.classList.remove('active'));
                document.querySelector('[data-scale="4"]').classList.add('active');
                selectedScale = 4;
            }
        }

        // Also check 4x
        const scale4Card = document.querySelector('[data-scale="4"]');
        if (originalWidth * 4 > 10000 || originalHeight * 4 > 10000) {
            preview4x.textContent = 'Too large';
            scale4Card.style.opacity = '0.5';
            scale4Card.style.pointerEvents = 'none';

            // If 4x was selected, switch to 2x
            if (selectedScale === 4) {
                scaleCards.forEach(c => c.classList.remove('active'));
                document.querySelector('[data-scale="2"]').classList.add('active');
                selectedScale = 2;
            }
        } else {
            scale4Card.style.opacity = '1';
            scale4Card.style.pointerEvents = 'auto';
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            originalImageDataUrl = e.target.result;
            uploadedImage.src = e.target.result;
            uploadedImage.classList.remove('hidden');
            emptyState.classList.add('hidden');
            uploadInfo.classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        // Upload to server
        try {
            showToast('Uploading image...', 'info');
            const result = await uploadFile(file);
            uploadedFilename = result.filename;

            resetBtn.disabled = false;
            upscaleBtn.disabled = false;

            showToast('Image loaded successfully!', 'success');
        } catch (error) {
            showToast(`Upload failed: ${error.message}`, 'error');
        }
    }

    function updatePreviewDimensions() {
        preview2x.textContent = `${originalWidth * 2} x ${originalHeight * 2}`;
        preview4x.textContent = `${originalWidth * 4} x ${originalHeight * 4}`;
        preview8x.textContent = `${originalWidth * 8} x ${originalHeight * 8}`;
    }

    async function processUpscale() {
        if (!uploadedFilename) {
            showToast('Please upload an image first', 'warning');
            return;
        }

        // Check limits
        const newWidth = originalWidth * selectedScale;
        const newHeight = originalHeight * selectedScale;

        if (newWidth > 10000 || newHeight > 10000) {
            showToast('Resulting image would be too large. Try a smaller scale.', 'warning');
            return;
        }

        // Show loading
        comparisonSection.classList.remove('hidden');
        loadingOverlay.classList.remove('hidden');
        upscaleBtn.disabled = true;

        // Scroll to comparison section
        comparisonSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Set before image using stored data URL for reliability
        beforeImage.src = originalImageDataUrl || uploadedImage.src;

        try {
            showToast(`Upscaling image ${selectedScale}x... This may take a moment.`, 'info');

            const result = await upscaleImage(uploadedFilename, selectedScale);
            processedFilename = result.filename;

            // Show result with cache buster
            const imageUrl = `${API_BASE}${result.imageUrl}?t=${Date.now()}`;

            // Preload the image
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';

            tempImg.onload = () => {
                afterImage.src = imageUrl;
                loadingOverlay.classList.add('hidden');
                downloadBtn.disabled = false;

                // Reset slider to middle
                sliderPosition = 50;
                updateSlider();

                showToast(`Image upscaled ${selectedScale}x successfully!`, 'success');
            };

            tempImg.onerror = () => {
                loadingOverlay.classList.add('hidden');
                showToast('Failed to load upscaled image', 'error');
            };

            tempImg.src = imageUrl;

        } catch (error) {
            showToast(`Upscale failed: ${error.message}`, 'error');
            loadingOverlay.classList.add('hidden');
            comparisonSection.classList.add('hidden');
        } finally {
            upscaleBtn.disabled = false;
        }
    }

    function download() {
        if (!processedFilename) {
            showToast('No upscaled image to download', 'warning');
            return;
        }

        const url = `${API_BASE}/download/${processedFilename}`;
        downloadFile(url, `upscaled_${selectedScale}x_${Date.now()}.png`);
        showToast('Download started!', 'success');
    }

    function reset() {
        currentFile = null;
        uploadedFilename = null;
        processedFilename = null;
        originalWidth = 0;
        originalHeight = 0;
        selectedScale = 4;
        originalImageDataUrl = null;

        // Reset UI
        uploadedImage.src = '';
        uploadedImage.classList.add('hidden');
        emptyState.classList.remove('hidden');
        uploadInfo.classList.add('hidden');
        comparisonSection.classList.add('hidden');
        beforeImage.src = '';
        afterImage.src = '';

        // Reset scale cards
        scaleCards.forEach(c => c.classList.remove('active'));
        document.querySelector('[data-scale="4"]').classList.add('active');

        // Reset all scale cards to enabled
        document.querySelector('[data-scale="2"]').style.opacity = '1';
        document.querySelector('[data-scale="2"]').style.pointerEvents = 'auto';
        document.querySelector('[data-scale="4"]').style.opacity = '1';
        document.querySelector('[data-scale="4"]').style.pointerEvents = 'auto';
        document.querySelector('[data-scale="8"]').style.opacity = '1';
        document.querySelector('[data-scale="8"]').style.pointerEvents = 'auto';

        // Reset previews
        preview2x.textContent = '-';
        preview4x.textContent = '-';
        preview8x.textContent = '-';

        // Reset slider
        sliderPosition = 50;
        updateSlider();

        // Reset buttons
        resetBtn.disabled = true;
        upscaleBtn.disabled = true;
        downloadBtn.disabled = true;

        fileInput.value = '';
    }
});
