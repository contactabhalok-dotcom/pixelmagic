/**
 * PixelMagic - Resize Tool Module
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
    const originalInfo = document.getElementById('originalInfo');
    const resultInfo = document.getElementById('resultInfo');
    const originalDimensions = document.getElementById('originalDimensions');
    const resultDimensions = document.getElementById('resultDimensions');

    const widthInput = document.getElementById('widthInput');
    const heightInput = document.getElementById('heightInput');
    const aspectToggle = document.getElementById('aspectToggle');
    const modeButtons = document.getElementById('modeButtons');
    const presetButtons = document.getElementById('presetButtons');
    const formatSelect = document.getElementById('formatSelect');
    const qualityGroup = document.getElementById('qualityGroup');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValue = document.getElementById('qualityValue');

    const resetBtn = document.getElementById('resetBtn');
    const resizeBtn = document.getElementById('resizeBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // State
    let currentFile = null;
    let uploadedFilename = null;
    let processedFilename = null;
    let originalWidth = 0;
    let originalHeight = 0;
    let aspectLocked = true;
    let resizeMode = 'fit';

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
        const originalPreview = document.getElementById('originalPreview');
        setupDragDrop(originalPreview);

        // Width/Height inputs
        widthInput.addEventListener('input', debounce(() => {
            if (aspectLocked && originalWidth > 0) {
                const ratio = originalHeight / originalWidth;
                heightInput.value = Math.round(parseInt(widthInput.value) * ratio);
            }
        }, 100));

        heightInput.addEventListener('input', debounce(() => {
            if (aspectLocked && originalHeight > 0) {
                const ratio = originalWidth / originalHeight;
                widthInput.value = Math.round(parseInt(heightInput.value) * ratio);
            }
        }, 100));

        // Aspect toggle
        aspectToggle.addEventListener('click', () => {
            aspectLocked = !aspectLocked;
            aspectToggle.classList.toggle('active', aspectLocked);
        });

        // Mode buttons
        modeButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('aspect-btn')) {
                document.querySelectorAll('#modeButtons .aspect-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                resizeMode = e.target.dataset.mode;
            }
        });

        // Preset buttons
        presetButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('aspect-btn')) {
                const preset = e.target.dataset.preset;
                const [w, h] = preset.split('x').map(Number);
                widthInput.value = w;
                heightInput.value = h;
            }
        });

        // Format select
        formatSelect.addEventListener('change', () => {
            qualityGroup.classList.toggle('hidden', formatSelect.value !== 'jpg');
        });

        // Quality slider
        qualitySlider.addEventListener('input', () => {
            qualityValue.textContent = `${qualitySlider.value}%`;
        });

        // Action buttons
        resetBtn.addEventListener('click', reset);
        resizeBtn.addEventListener('click', processResize);
        downloadBtn.addEventListener('click', download);
    }

    function setupDragDrop(element) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            element.addEventListener(event, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
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

        // Get dimensions
        const dims = await getImageDimensions(file);
        originalWidth = dims.width;
        originalHeight = dims.height;

        // Update UI
        originalDimensions.textContent = `${originalWidth} x ${originalHeight} px`;
        widthInput.value = originalWidth;
        heightInput.value = originalHeight;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage.src = e.target.result;
            originalImage.classList.remove('hidden');
            emptyState.classList.add('hidden');
            originalInfo.classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        // Upload to server
        try {
            const result = await uploadFile(file);
            uploadedFilename = result.filename;

            resetBtn.disabled = false;
            resizeBtn.disabled = false;

            showToast('Image loaded successfully!', 'success');
        } catch (error) {
            showToast(`Upload failed: ${error.message}`, 'error');
        }
    }

    async function processResize() {
        if (!uploadedFilename) {
            showToast('Please upload an image first', 'warning');
            return;
        }

        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);

        if (!width || !height || width < 1 || height < 1) {
            showToast('Please enter valid dimensions', 'warning');
            return;
        }

        if (width > 10000 || height > 10000) {
            showToast('Maximum dimension is 10000px', 'warning');
            return;
        }

        // Show loading
        loadingOverlay.classList.remove('hidden');
        resultEmpty.classList.add('hidden');
        resizeBtn.disabled = true;

        try {
            const options = {
                width,
                height,
                mode: resizeMode,
                format: formatSelect.value,
                quality: parseInt(qualitySlider.value)
            };

            const result = await resizeImage(uploadedFilename, options);
            processedFilename = result.filename;

            // Show result
            resultImage.src = `${API_BASE}${result.imageUrl}`;
            resultImage.onload = () => {
                resultImage.classList.remove('hidden');
                loadingOverlay.classList.add('hidden');
                resultInfo.classList.remove('hidden');
                resultDimensions.textContent = `${result.width} x ${result.height} px`;
                downloadBtn.disabled = false;
            };

            showToast('Image resized successfully!', 'success');
        } catch (error) {
            showToast(`Resize failed: ${error.message}`, 'error');
            loadingOverlay.classList.add('hidden');
            resultEmpty.classList.remove('hidden');
        } finally {
            resizeBtn.disabled = false;
        }
    }

    function download() {
        if (!processedFilename) {
            showToast('No resized image to download', 'warning');
            return;
        }

        const ext = formatSelect.value === 'jpg' ? 'jpg' : 'png';
        const url = `${API_BASE}/download/${processedFilename}`;
        downloadFile(url, `resized_${Date.now()}.${ext}`);
        showToast('Download started!', 'success');
    }

    function reset() {
        currentFile = null;
        uploadedFilename = null;
        processedFilename = null;
        originalWidth = 0;
        originalHeight = 0;

        // Reset UI
        originalImage.src = '';
        originalImage.classList.add('hidden');
        resultImage.src = '';
        resultImage.classList.add('hidden');
        emptyState.classList.remove('hidden');
        resultEmpty.classList.remove('hidden');
        originalInfo.classList.add('hidden');
        resultInfo.classList.add('hidden');

        // Reset inputs
        widthInput.value = 800;
        heightInput.value = 600;
        aspectLocked = true;
        aspectToggle.classList.add('active');

        // Reset mode
        document.querySelectorAll('#modeButtons .aspect-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('[data-mode="fit"]').classList.add('active');
        resizeMode = 'fit';

        // Reset format
        formatSelect.value = 'png';
        qualityGroup.classList.add('hidden');
        qualitySlider.value = 90;
        qualityValue.textContent = '90%';

        // Reset buttons
        resetBtn.disabled = true;
        resizeBtn.disabled = true;
        downloadBtn.disabled = true;

        fileInput.value = '';
    }
});
