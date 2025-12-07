/**
 * PixelMagic - Utility Functions
 */

// API Base URL - Change this to your backend URL
const API_BASE = 'http://localhost:8000';

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', 'warning', 'info'
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = getToastIcon(type);
    toast.innerHTML = `${icon}<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function getToastIcon(type) {
    const icons = {
        success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
        warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };
    return icons[type] || icons.info;
}

/**
 * Upload file to server
 * @param {File} file - File to upload
 * @returns {Promise<Object>} - Upload response
 */
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
}

/**
 * Remove background from image
 * @param {string} filename - Uploaded filename
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Processing response
 */
async function removeBackground(filename, options = {}) {
    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('softness', options.softness || 0);
    formData.append('feather', options.feather || 0);

    const response = await fetch(`${API_BASE}/remove-bg`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Background removal failed');
    }

    return response.json();
}

/**
 * Crop image
 * @param {string} filename - Uploaded filename
 * @param {Object} crop - Crop coordinates {x, y, width, height}
 * @returns {Promise<Object>} - Processing response
 */
async function cropImage(filename, crop) {
    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('x', Math.round(crop.x));
    formData.append('y', Math.round(crop.y));
    formData.append('width', Math.round(crop.width));
    formData.append('height', Math.round(crop.height));

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

/**
 * Resize image
 * @param {string} filename - Uploaded filename
 * @param {Object} options - Resize options
 * @returns {Promise<Object>} - Processing response
 */
async function resizeImage(filename, options) {
    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('width', options.width);
    formData.append('height', options.height);
    formData.append('mode', options.mode || 'fit');
    formData.append('format', options.format || 'png');
    formData.append('quality', options.quality || 90);

    const response = await fetch(`${API_BASE}/resize`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Resize failed');
    }

    return response.json();
}

/**
 * Upscale image
 * @param {string} filename - Uploaded filename
 * @param {number} scale - Scale factor (2, 4, or 8)
 * @returns {Promise<Object>} - Processing response
 */
async function upscaleImage(filename, scale) {
    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('scale', scale);

    const response = await fetch(`${API_BASE}/upscale`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upscale failed');
    }

    return response.json();
}

/**
 * Download file
 * @param {string} url - File URL
 * @param {string} filename - Download filename
 */
function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Validate file type and size
 * @param {File} file - File to validate
 * @returns {boolean} - Is valid
 */
function validateFile(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
        showToast('Invalid file type. Please upload JPG, PNG, or WebP.', 'error');
        return false;
    }

    if (file.size > maxSize) {
        showToast('File too large. Maximum size is 10MB.', 'error');
        return false;
    }

    return true;
}

/**
 * Get image dimensions from file
 * @param {File} file - Image file
 * @returns {Promise<{width: number, height: number}>}
 */
function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
            URL.revokeObjectURL(img.src);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Load image from URL and return as Image element
 * @param {string} url - Image URL
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function}
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Clamp value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Check for pending image from home page
function checkPendingImage() {
    const pendingImage = sessionStorage.getItem('pendingImage');
    const pendingImageName = sessionStorage.getItem('pendingImageName');

    if (pendingImage && pendingImageName) {
        sessionStorage.removeItem('pendingImage');
        sessionStorage.removeItem('pendingImageName');
        return { dataUrl: pendingImage, name: pendingImageName };
    }
    return null;
}

// Convert data URL to File
function dataURLtoFile(dataUrl, filename) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}
