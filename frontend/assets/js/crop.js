/**
 * PixelMagic - Crop Tool Module (Fixed Version)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const fileInput = document.getElementById('fileInput');
    const selectImageBtn = document.getElementById('selectImageBtn');
    const emptyState = document.getElementById('emptyState');
    const cropWrapper = document.getElementById('cropWrapper');
    const cropContainer = document.getElementById('cropContainer');
    const cropImage = document.getElementById('cropImage');
    const cropBox = document.getElementById('cropBox');
    const cropDimensions = document.getElementById('cropDimensions');
    const previewImage = document.getElementById('previewImage');

    const aspectButtons = document.getElementById('aspectButtons');
    const cropX = document.getElementById('cropX');
    const cropY = document.getElementById('cropY');
    const cropW = document.getElementById('cropW');
    const cropH = document.getElementById('cropH');

    const resetBtn = document.getElementById('resetBtn');
    const applyBtn = document.getElementById('applyBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // Shade elements
    const shadeTop = document.getElementById('shadeTop');
    const shadeBottom = document.getElementById('shadeBottom');
    const shadeLeft = document.getElementById('shadeLeft');
    const shadeRight = document.getElementById('shadeRight');

    // State
    let currentFile = null;
    let uploadedFilename = null;
    let imageWidth = 0;
    let imageHeight = 0;
    let displayWidth = 0;
    let displayHeight = 0;
    let scale = 1;
    let containerRect = null;

    let cropState = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    };

    let aspectRatio = null; // Start with free crop
    let isDragging = false;
    let isResizing = false;
    let activeHandle = null;
    let startX = 0;
    let startY = 0;
    let startCrop = {};

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

        // Aspect ratio buttons - set free as default active
        document.querySelectorAll('.aspect-btn').forEach(btn => btn.classList.remove('active'));
        const freeBtn = document.querySelector('[data-ratio="free"]');
        if (freeBtn) freeBtn.classList.add('active');

        aspectButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('aspect-btn')) {
                document.querySelectorAll('.aspect-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                const ratio = e.target.dataset.ratio;
                if (ratio === 'free') {
                    aspectRatio = null;
                } else {
                    const [w, h] = ratio.split(':').map(Number);
                    aspectRatio = w / h;
                }

                if (cropState.width > 0) {
                    constrainCropBox();
                    updateCropBox();
                    updatePreview();
                }
            }
        });

        // Manual input
        [cropX, cropY, cropW, cropH].forEach(input => {
            input.addEventListener('change', handleManualInput);
            input.addEventListener('input', debounce(handleManualInput, 300));
        });

        // Crop box interactions
        cropBox.addEventListener('mousedown', handleMouseDown);
        cropBox.addEventListener('touchstart', handleTouchStart, { passive: false });

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);

        // Action buttons
        resetBtn.addEventListener('click', reset);
        applyBtn.addEventListener('click', applyCrop);
        downloadBtn.addEventListener('click', download);

        // Drag and drop
        setupDragDrop(cropWrapper);

        // Handle window resize
        window.addEventListener('resize', debounce(() => {
            if (cropImage.src && cropImage.complete) {
                recalculateScale();
            }
        }, 200));
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

        // Get dimensions first
        const dims = await getImageDimensions(file);
        imageWidth = dims.width;
        imageHeight = dims.height;

        // Show image
        const reader = new FileReader();
        reader.onload = (e) => {
            cropImage.src = e.target.result;

            // Wait for image to be fully loaded and rendered
            cropImage.onload = () => {
                // Use requestAnimationFrame to ensure layout is complete
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        recalculateScale();
                        initCropBox();

                        // Show container
                        cropContainer.classList.remove('hidden');
                        emptyState.classList.add('hidden');
                    });
                });
            };
        };
        reader.readAsDataURL(file);

        // Upload to server
        try {
            const result = await uploadFile(file);
            uploadedFilename = result.filename;

            resetBtn.disabled = false;
            applyBtn.disabled = false;

            showToast('Image loaded successfully!', 'success');
        } catch (error) {
            showToast(`Upload failed: ${error.message}`, 'error');
        }
    }

    function recalculateScale() {
        // Get actual rendered dimensions
        const rect = cropImage.getBoundingClientRect();
        displayWidth = rect.width;
        displayHeight = rect.height;

        // Calculate scale based on actual dimensions
        if (displayWidth > 0 && imageWidth > 0) {
            scale = imageWidth / displayWidth;
        } else {
            scale = 1;
        }

        // Store container position for coordinate calculations
        containerRect = cropContainer.getBoundingClientRect();
    }

    function initCropBox() {
        // Recalculate in case dimensions changed
        recalculateScale();

        // Start with centered crop box (80% of image)
        let boxWidth, boxHeight;

        if (aspectRatio) {
            // Calculate size based on aspect ratio
            if (displayWidth / displayHeight > aspectRatio) {
                boxHeight = displayHeight * 0.8;
                boxWidth = boxHeight * aspectRatio;
            } else {
                boxWidth = displayWidth * 0.8;
                boxHeight = boxWidth / aspectRatio;
            }
        } else {
            boxWidth = displayWidth * 0.8;
            boxHeight = displayHeight * 0.8;
        }

        // Ensure box fits within image
        boxWidth = Math.min(boxWidth, displayWidth);
        boxHeight = Math.min(boxHeight, displayHeight);

        cropState = {
            x: (displayWidth - boxWidth) / 2,
            y: (displayHeight - boxHeight) / 2,
            width: boxWidth,
            height: boxHeight
        };

        updateCropBox();
        updatePreview();
    }

    function updateCropBox() {
        // Position the crop box
        cropBox.style.left = `${cropState.x}px`;
        cropBox.style.top = `${cropState.y}px`;
        cropBox.style.width = `${cropState.width}px`;
        cropBox.style.height = `${cropState.height}px`;

        // Update shades - they overlay the non-selected areas
        // Top shade: full width, from top to crop box top
        shadeTop.style.top = '0';
        shadeTop.style.left = '0';
        shadeTop.style.right = '0';
        shadeTop.style.height = `${Math.max(0, cropState.y)}px`;
        shadeTop.style.width = '100%';

        // Bottom shade: full width, from crop box bottom to image bottom
        shadeBottom.style.bottom = '0';
        shadeBottom.style.left = '0';
        shadeBottom.style.right = '0';
        shadeBottom.style.height = `${Math.max(0, displayHeight - cropState.y - cropState.height)}px`;
        shadeBottom.style.width = '100%';

        // Left shade: from crop top to crop bottom, from left edge to crop left
        shadeLeft.style.top = `${cropState.y}px`;
        shadeLeft.style.left = '0';
        shadeLeft.style.width = `${Math.max(0, cropState.x)}px`;
        shadeLeft.style.height = `${cropState.height}px`;

        // Right shade: from crop top to crop bottom, from crop right to image right
        shadeRight.style.top = `${cropState.y}px`;
        shadeRight.style.right = '0';
        shadeRight.style.width = `${Math.max(0, displayWidth - cropState.x - cropState.width)}px`;
        shadeRight.style.height = `${cropState.height}px`;

        // Update dimensions display (in real pixels)
        const realW = Math.round(cropState.width * scale);
        const realH = Math.round(cropState.height * scale);
        cropDimensions.textContent = `${realW} x ${realH}`;

        // Update inputs (in real pixels)
        cropX.value = Math.round(cropState.x * scale);
        cropY.value = Math.round(cropState.y * scale);
        cropW.value = realW;
        cropH.value = realH;
    }

    function handleMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();

        recalculateScale();

        if (e.target.classList.contains('crop-handle')) {
            isResizing = true;
            activeHandle = e.target.dataset.handle;
        } else {
            isDragging = true;
        }

        startX = e.clientX;
        startY = e.clientY;
        startCrop = { ...cropState };
    }

    function handleTouchStart(e) {
        if (e.touches.length !== 1) return;
        e.preventDefault();

        recalculateScale();

        const touch = e.touches[0];
        if (e.target.classList.contains('crop-handle')) {
            isResizing = true;
            activeHandle = e.target.dataset.handle;
        } else {
            isDragging = true;
        }

        startX = touch.clientX;
        startY = touch.clientY;
        startCrop = { ...cropState };
    }

    function handleMouseMove(e) {
        if (!isDragging && !isResizing) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (isDragging) {
            moveCropBox(dx, dy);
        } else if (isResizing) {
            resizeCropBox(dx, dy);
        }

        updateCropBox();
        updatePreview();
    }

    function handleTouchMove(e) {
        if (!isDragging && !isResizing) return;
        if (e.touches.length !== 1) return;

        e.preventDefault();

        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        if (isDragging) {
            moveCropBox(dx, dy);
        } else if (isResizing) {
            resizeCropBox(dx, dy);
        }

        updateCropBox();
        updatePreview();
    }

    function handleMouseUp() {
        if (isDragging || isResizing) {
            updatePreview();
        }
        isDragging = false;
        isResizing = false;
        activeHandle = null;
    }

    function handleTouchEnd() {
        if (isDragging || isResizing) {
            updatePreview();
        }
        isDragging = false;
        isResizing = false;
        activeHandle = null;
    }

    function moveCropBox(dx, dy) {
        let newX = startCrop.x + dx;
        let newY = startCrop.y + dy;

        // Constrain to image bounds
        newX = clamp(newX, 0, displayWidth - cropState.width);
        newY = clamp(newY, 0, displayHeight - cropState.height);

        cropState.x = newX;
        cropState.y = newY;
    }

    function resizeCropBox(dx, dy) {
        let newX = startCrop.x;
        let newY = startCrop.y;
        let newW = startCrop.width;
        let newH = startCrop.height;

        const minSize = 30; // Minimum 30px

        switch (activeHandle) {
            case 'tl': // Top-left
                newX = startCrop.x + dx;
                newY = startCrop.y + dy;
                newW = startCrop.width - dx;
                newH = startCrop.height - dy;
                break;
            case 'tr': // Top-right
                newY = startCrop.y + dy;
                newW = startCrop.width + dx;
                newH = startCrop.height - dy;
                break;
            case 'bl': // Bottom-left
                newX = startCrop.x + dx;
                newW = startCrop.width - dx;
                newH = startCrop.height + dy;
                break;
            case 'br': // Bottom-right
                newW = startCrop.width + dx;
                newH = startCrop.height + dy;
                break;
            case 'tm': // Top-middle
                newY = startCrop.y + dy;
                newH = startCrop.height - dy;
                break;
            case 'bm': // Bottom-middle
                newH = startCrop.height + dy;
                break;
            case 'ml': // Middle-left
                newX = startCrop.x + dx;
                newW = startCrop.width - dx;
                break;
            case 'mr': // Middle-right
                newW = startCrop.width + dx;
                break;
        }

        // Enforce minimum size
        if (newW < minSize) {
            if (activeHandle.includes('l')) {
                newX = startCrop.x + startCrop.width - minSize;
            }
            newW = minSize;
        }
        if (newH < minSize) {
            if (activeHandle.includes('t')) {
                newY = startCrop.y + startCrop.height - minSize;
            }
            newH = minSize;
        }

        // Enforce aspect ratio if set
        if (aspectRatio && ['tl', 'tr', 'bl', 'br'].includes(activeHandle)) {
            const currentRatio = newW / newH;
            if (currentRatio > aspectRatio) {
                newW = newH * aspectRatio;
                // Adjust position for left handles
                if (activeHandle.includes('l')) {
                    newX = startCrop.x + startCrop.width - newW;
                }
            } else {
                newH = newW / aspectRatio;
                // Adjust position for top handles
                if (activeHandle.includes('t')) {
                    newY = startCrop.y + startCrop.height - newH;
                }
            }
        }

        // Bounds check - ensure crop box stays within image
        if (newX < 0) {
            newW += newX;
            newX = 0;
        }
        if (newY < 0) {
            newH += newY;
            newY = 0;
        }
        if (newX + newW > displayWidth) {
            newW = displayWidth - newX;
        }
        if (newY + newH > displayHeight) {
            newH = displayHeight - newY;
        }

        // Final minimum size check
        newW = Math.max(newW, minSize);
        newH = Math.max(newH, minSize);

        cropState = { x: newX, y: newY, width: newW, height: newH };
    }

    function constrainCropBox() {
        if (!aspectRatio) return;

        // Maintain aspect ratio while keeping within bounds
        const currentRatio = cropState.width / cropState.height;

        if (currentRatio > aspectRatio) {
            cropState.width = cropState.height * aspectRatio;
        } else {
            cropState.height = cropState.width / aspectRatio;
        }

        // Ensure still within bounds
        if (cropState.x + cropState.width > displayWidth) {
            cropState.x = displayWidth - cropState.width;
        }
        if (cropState.y + cropState.height > displayHeight) {
            cropState.y = displayHeight - cropState.height;
        }

        // Clamp position
        cropState.x = Math.max(0, cropState.x);
        cropState.y = Math.max(0, cropState.y);
    }

    function handleManualInput() {
        // Get values in real pixels and convert to display pixels
        const realX = parseInt(cropX.value) || 0;
        const realY = parseInt(cropY.value) || 0;
        const realW = parseInt(cropW.value) || 100;
        const realH = parseInt(cropH.value) || 100;

        // Convert to display coordinates
        const x = realX / scale;
        const y = realY / scale;
        const w = realW / scale;
        const h = realH / scale;

        cropState = {
            x: clamp(x, 0, displayWidth - 30),
            y: clamp(y, 0, displayHeight - 30),
            width: clamp(w, 30, displayWidth - x),
            height: clamp(h, 30, displayHeight - y)
        };

        // Re-constrain if aspect ratio is set
        if (aspectRatio) {
            constrainCropBox();
        }

        updateCropBox();
        updatePreview();
    }

    function updatePreview() {
        if (!cropImage.src || !cropImage.complete) return;

        // Create canvas for preview
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate real pixel coordinates
        const realX = Math.round(cropState.x * scale);
        const realY = Math.round(cropState.y * scale);
        const realW = Math.round(cropState.width * scale);
        const realH = Math.round(cropState.height * scale);

        // Clamp to valid bounds
        const clampedX = Math.max(0, Math.min(realX, imageWidth - 1));
        const clampedY = Math.max(0, Math.min(realY, imageHeight - 1));
        const clampedW = Math.min(realW, imageWidth - clampedX);
        const clampedH = Math.min(realH, imageHeight - clampedY);

        if (clampedW <= 0 || clampedH <= 0) return;

        canvas.width = clampedW;
        canvas.height = clampedH;

        // Draw the cropped portion
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            ctx.drawImage(img, clampedX, clampedY, clampedW, clampedH, 0, 0, clampedW, clampedH);
            previewImage.src = canvas.toDataURL('image/png');
            previewImage.classList.remove('hidden');
            const emptyStateEl = previewImage.parentElement.querySelector('.empty-state');
            if (emptyStateEl) emptyStateEl.classList.add('hidden');
        };
        img.src = cropImage.src;
    }

    async function applyCrop() {
        if (!uploadedFilename) {
            showToast('Please upload an image first', 'warning');
            return;
        }

        try {
            // Calculate real pixel coordinates
            const crop = {
                x: Math.max(0, Math.round(cropState.x * scale)),
                y: Math.max(0, Math.round(cropState.y * scale)),
                width: Math.max(1, Math.round(cropState.width * scale)),
                height: Math.max(1, Math.round(cropState.height * scale))
            };

            // Validate bounds
            crop.x = Math.min(crop.x, imageWidth - 1);
            crop.y = Math.min(crop.y, imageHeight - 1);
            crop.width = Math.min(crop.width, imageWidth - crop.x);
            crop.height = Math.min(crop.height, imageHeight - crop.y);

            showToast('Cropping image...', 'info');
            const result = await cropImageAPI(uploadedFilename, crop);

            // Update with cropped image
            uploadedFilename = result.filename;
            imageWidth = result.width;
            imageHeight = result.height;

            // Reload with new image
            const newImageUrl = `${API_BASE}${result.imageUrl}?t=${Date.now()}`;
            cropImage.src = newImageUrl;
            cropImage.onload = () => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        recalculateScale();
                        initCropBox();
                    });
                });
            };

            downloadBtn.disabled = false;
            showToast('Image cropped successfully!', 'success');
        } catch (error) {
            showToast(`Crop failed: ${error.message}`, 'error');
        }
    }

    async function cropImageAPI(filename, crop) {
        const formData = new FormData();
        formData.append('filename', filename);
        formData.append('x', crop.x);
        formData.append('y', crop.y);
        formData.append('width', crop.width);
        formData.append('height', crop.height);

        const response = await fetch(`${API_BASE}/crop`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Crop failed');
        }

        return response.json();
    }

    function download() {
        if (!uploadedFilename) {
            showToast('No image to download', 'warning');
            return;
        }

        const url = `${API_BASE}/download/${uploadedFilename}`;
        downloadFile(url, `cropped_${Date.now()}.png`);
        showToast('Download started!', 'success');
    }

    function reset() {
        currentFile = null;
        uploadedFilename = null;

        cropImage.src = '';
        cropContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        previewImage.src = '';
        previewImage.classList.add('hidden');

        const emptyStateEl = previewImage.parentElement.querySelector('.empty-state');
        if (emptyStateEl) emptyStateEl.classList.remove('hidden');

        cropState = { x: 0, y: 0, width: 0, height: 0 };
        imageWidth = 0;
        imageHeight = 0;
        displayWidth = 0;
        displayHeight = 0;
        scale = 1;

        resetBtn.disabled = true;
        applyBtn.disabled = true;
        downloadBtn.disabled = true;

        fileInput.value = '';

        // Reset aspect ratio to free
        document.querySelectorAll('.aspect-btn').forEach(btn => btn.classList.remove('active'));
        const freeBtn = document.querySelector('[data-ratio="free"]');
        if (freeBtn) freeBtn.classList.add('active');
        aspectRatio = null;

        // Reset inputs
        cropX.value = '';
        cropY.value = '';
        cropW.value = '';
        cropH.value = '';
    }
});
