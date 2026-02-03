/**
 * SiteSnap - Frontend Application
 */

// DOM Elements
const form = document.getElementById('screenshot-form');
const urlInput = document.getElementById('url-input');
const submitBtn = document.getElementById('submit-btn');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressMessage = document.getElementById('progress-message');
const alertError = document.getElementById('alert-error');
const alertSuccess = document.getElementById('alert-success');
const errorMessage = document.getElementById('error-message');
const results = document.getElementById('results');
const modal = document.getElementById('modal');
const modalImage = document.getElementById('modal-image');
const modalClose = document.getElementById('modal-close');

// Desktop elements
const desktopImage = document.getElementById('desktop-image');
const desktopDownload = document.getElementById('desktop-download');
const desktopMeta = document.getElementById('desktop-meta');

// Mobile elements
const mobileImage = document.getElementById('mobile-image');
const mobileDownload = document.getElementById('mobile-download');
const mobileMeta = document.getElementById('mobile-meta');

/**
 * Format file size to human readable string
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Reset UI state
 */
function resetUI() {
    progressContainer.classList.remove('is-visible');
    alertError.classList.remove('is-visible');
    alertSuccess.classList.remove('is-visible');
    results.classList.remove('is-visible');
    progressFill.style.width = '0%';
}

/**
 * Set loading state
 */
function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    urlInput.disabled = isLoading;

    if (isLoading) {
        submitBtn.innerHTML = '<span class="progress-text__spinner" aria-hidden="true"></span> 撮影中...';
    } else {
        submitBtn.innerHTML = '<span class="btn__icon" aria-hidden="true">📷</span> 撮影';
    }
}

/**
 * Show error message
 */
function showError(message) {
    errorMessage.textContent = message;
    alertError.classList.add('is-visible');
    setLoading(false);
}

/**
 * Update progress display
 */
function updateProgress(progress, message) {
    progressFill.style.width = `${progress}%`;
    progressMessage.textContent = message;

    // Update ARIA attributes
    const progressBar = progressFill.parentElement;
    progressBar.setAttribute('aria-valuenow', progress);
}

/**
 * Display results
 */
function displayResults(result) {
    // Desktop
    desktopImage.src = result.desktop.url;
    desktopImage.alt = `デスクトップ版スクリーンショット - ${result.url}`;
    desktopDownload.href = result.desktop.url;
    desktopDownload.download = result.desktop.filename;
    desktopMeta.textContent = `${result.desktop.resolution} • ${formatFileSize(result.desktop.size)}`;

    // Mobile
    mobileImage.src = result.mobile.url;
    mobileImage.alt = `モバイル版スクリーンショット - ${result.url}`;
    mobileDownload.href = result.mobile.url;
    mobileDownload.download = result.mobile.filename;
    mobileMeta.textContent = `${result.mobile.resolution} • ${formatFileSize(result.mobile.size)}`;

    // Show results section
    results.classList.add('is-visible');
    alertSuccess.classList.add('is-visible');

    // Scroll to results
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Open image in modal
 */
function openModal(src, alt) {
    modalImage.src = src;
    modalImage.alt = alt;
    modal.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
    modalClose.focus();
}

/**
 * Close modal
 */
function closeModal() {
    modal.classList.remove('is-visible');
    document.body.style.overflow = '';
    modalImage.src = '';
}

/**
 * Handle form submission
 */
async function handleSubmit(event) {
    event.preventDefault();

    const url = urlInput.value.trim();

    // Validate URL
    if (!url) {
        showError('URLを入力してください');
        urlInput.focus();
        return;
    }

    try {
        new URL(url);
    } catch {
        showError('有効なURLを入力してください（例: https://example.com）');
        urlInput.focus();
        return;
    }

    // Reset and show progress
    resetUI();
    setLoading(true);
    progressContainer.classList.add('is-visible');
    updateProgress(5, '処理を開始しています...');

    try {
        // Send screenshot request
        const response = await fetch('/api/screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'エラーが発生しました');
        }

        // Connect to SSE for progress updates
        const jobId = data.jobId;
        const eventSource = new EventSource(`/api/progress/${jobId}`);

        eventSource.onmessage = (event) => {
            const progressData = JSON.parse(event.data);

            updateProgress(progressData.progress, progressData.message);

            if (progressData.status === 'completed') {
                eventSource.close();
                progressContainer.classList.remove('is-visible');
                setLoading(false);
                displayResults(progressData.result);
            } else if (progressData.status === 'error') {
                eventSource.close();
                progressContainer.classList.remove('is-visible');
                showError(progressData.message);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            progressContainer.classList.remove('is-visible');
            showError('接続が切断されました。もう一度お試しください。');
        };

    } catch (error) {
        showError(error.message);
    }
}

// Event Listeners
form.addEventListener('submit', handleSubmit);

// Image click to open modal
desktopImage.addEventListener('click', () => {
    openModal(desktopImage.src, desktopImage.alt);
});

mobileImage.addEventListener('click', () => {
    openModal(mobileImage.src, mobileImage.alt);
});

// Modal close handlers
modalClose.addEventListener('click', closeModal);

modal.addEventListener('click', (event) => {
    if (event.target === modal) {
        closeModal();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-visible')) {
        closeModal();
    }
});

// Focus management for accessibility
urlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        form.dispatchEvent(new Event('submit'));
    }
});

// Clear error on input
urlInput.addEventListener('input', () => {
    alertError.classList.remove('is-visible');
});

// Initialize
console.log('🚀 SiteSnap initialized');
