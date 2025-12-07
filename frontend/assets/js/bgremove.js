/**
 * PixelMagic - Background Remover Module
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const fileInput = document.getElementById('fileInput');
    const selectImageBtn = document.getElementById('selectImageBtn');
    const originalImage = document.getElementById('originalImage');
    const resultImage = document.getElementById('resultImage');
    const emptyState = document.getElementById('emptyState');
    const resultEmpty = document.getElementById('resultEmpty');
    const loadingOverlay = document.getElementById('loadingOverlay');

    const softnessSlider = document.getElementById('softnessSlider');
    const featherSlider = document.getElementById('featherSlider');
    const softnessValue = document.getElementById('softnessValue');
    const featherValue = document.getElementById('featherValue');

    const bgColor = document.getElementById('bgColor');
    const uploadBgBtn = document.getElementById('uploadBgBtn');
    const bgImageInput = document.getElementById('bgImageInput');
    const clearBgBtn = document.getElementById('clearBgBtn');

    const resetBtn = document.getElementById('resetBtn');
    const processBtn = document.getElementById('processBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // State
    let currentFile = null;
    let uploadedFilename = null;
    let processedFilename = null;
    let customBackground = null;

    // Initialize
    init();

    function init() {
        // Check for pending image from home page
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

        // Drag and drop on original preview
        const originalPreview = document.getElementById('originalPreview');
        setupDragDrop(originalPreview);

        // Sliders
        softnessSlider.addEventListener('input', (e) => {
            softnessValue.textContent = e.target.value;
        });

        featherSlider.addEventListener('input', (e) => {
            featherValue.textContent = e.target.value;
        });

        // Background options
        bgColor.addEventListener('change', applyBackgroundColor);
        uploadBgBtn.addEventListener('click', () => bgImageInput.click());
        bgImageInput.addEventListener('change', handleBackgroundImage);
        clearBgBtn.addEventListener('click', clearBackground);

        // Action buttons
        resetBtn.addEventListener('click', reset);
        processBtn.addEventListener('click', processImage);
        downloadBtn.addEventListener('click', download);
    }

    function setupDragDrop(element) {
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

    async function handleFileSelect(file) {
        if (!validateFile(file)) return;

        currentFile = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage.src = e.target.result;
            originalImage.classList.remove('hidden');
            emptyState.classList.add('hidden');
        };
        reader.readAsDataURL(file);

        // Upload to server
        try {
            showToast('Uploading image...', 'info');
            const result = await uploadFile(file);
            uploadedFilename = result.filename;

            // Enable buttons
            processBtn.disabled = false;
            resetBtn.disabled = false;

            showToast('Image uploaded successfully!', 'success');
        } catch (error) {
            showToast(`Upload failed: ${error.message}`, 'error');
        }
    }

    async function processImage() {
        if (!uploadedFilename) {
            showToast('Please upload an image first', 'warning');
            return;
        }

        // Show loading
        loadingOverlay.classList.remove('hidden');
        resultEmpty.classList.add('hidden');
        processBtn.disabled = true;

        try {
            const options = {
                softness: parseInt(softnessSlider.value),
                feather: parseInt(featherSlider.value)
            };

            const result = await removeBackground(uploadedFilename, options);
            processedFilename = result.filename;

            // Show result
            resultImage.src = `${API_BASE}${result.imageUrl}`;
            resultImage.onload = () => {
                resultImage.classList.remove('hidden');
                loadingOverlay.classList.add('hidden');
                downloadBtn.disabled = false;

                // Apply background if set
                if (customBackground) {
                    applyCustomBackground();
                }
            };

            showToast('Background removed successfully!', 'success');
        } catch (error) {
            showToast(`Processing failed: ${error.message}`, 'error');
            loadingOverlay.classList.add('hidden');
            resultEmpty.classList.remove('hidden');
        } finally {
            processBtn.disabled = false;
        }
    }

    function applyBackgroundColor() {
        const preview = document.getElementById('resultPreview');
        preview.style.backgroundColor = bgColor.value;
        preview.classList.remove('checkerboard');
        customBackground = { type: 'color', value: bgColor.value };
    }

    function handleBackgroundImage(e) {
        if (e.target.files.length === 0) return;

        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const preview = document.getElementById('resultPreview');
            preview.style.backgroundImage = `url(${event.target.result})`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
            preview.classList.remove('checkerboard');
            customBackground = { type: 'image', value: event.target.result };
        };
        reader.readAsDataURL(file);
    }

    function clearBackground() {
        const preview = document.getElementById('resultPreview');
        preview.style.backgroundColor = '';
        preview.style.backgroundImage = '';
        preview.classList.add('checkerboard');
        customBackground = null;
        bgColor.value = '#ffffff';
    }

    function applyCustomBackground() {
        if (!customBackground) return;

        const preview = document.getElementById('resultPreview');
        if (customBackground.type === 'color') {
            preview.style.backgroundColor = customBackground.value;
        } else if (customBackground.type === 'image') {
            preview.style.backgroundImage = `url(${customBackground.value})`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
        }
    }

    async function download() {
        if (!processedFilename) {
            showToast('No processed image to download', 'warning');
            return;
        }

        try {
            // If custom background, composite the image
            if (customBackground && resultImage.src) {
                await downloadWithBackground();
            } else {
                // Direct download
                const url = `${API_BASE}/download/${processedFilename}`;
                downloadFile(url, `bg_removed_${Date.now()}.png`);
            }
            showToast('Download started!', 'success');
        } catch (error) {
            showToast(`Download failed: ${error.message}`, 'error');
        }
    }

    async function downloadWithBackground() {
        // Create canvas to composite
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const img = await loadImage(resultImage.src);
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw background
        if (customBackground.type === 'color') {
            ctx.fillStyle = customBackground.value;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (customBackground.type === 'image') {
            const bgImg = await loadImage(customBackground.value);
            // Cover the canvas with background
            const scale = Math.max(canvas.width / bgImg.width, canvas.height / bgImg.height);
            const x = (canvas.width - bgImg.width * scale) / 2;
            const y = (canvas.height - bgImg.height * scale) / 2;
            ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
        }

        // Draw processed image on top
        ctx.drawImage(img, 0, 0);

        // Download
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bg_removed_${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    function reset() {
        currentFile = null;
        uploadedFilename = null;
        processedFilename = null;
        customBackground = null;

        // Reset UI
        originalImage.src = '';
        originalImage.classList.add('hidden');
        resultImage.src = '';
        resultImage.classList.add('hidden');
        emptyState.classList.remove('hidden');
        resultEmpty.classList.remove('hidden');

        // Reset sliders
        softnessSlider.value = 0;
        featherSlider.value = 0;
        softnessValue.textContent = '0';
        featherValue.textContent = '0';

        // Reset background
        clearBackground();

        // Reset buttons
        processBtn.disabled = true;
        downloadBtn.disabled = true;
        resetBtn.disabled = true;

        // Reset file input
        fileInput.value = '';
    }
});
