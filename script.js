// Configuration
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec';
let athletes = [];
let filteredAthletes = [];
let currentTab = 'all';
let currentCategory = 'all';
let currentPage = 1;
let itemsPerPage = 10;
let selectedAthlete = null;
let lastDataSource = 'none'; // Track where data was last loaded from

// DOM Elements
const athleteListEl = document.getElementById('athlete-list');
const loadingEl = document.getElementById('loading');
const searchInputEl = document.getElementById('search-input');
const searchBtnEl = document.getElementById('search-btn');
const refreshBtnEl = document.getElementById('refresh-btn');
const qrScanBtnEl = document.getElementById('qr-scan-btn');
const qrModalEl = document.getElementById('qr-modal');
const closeQrModalEl = document.getElementById('close-qr-modal');
const cameraModalEl = document.getElementById('camera-modal');
const closeCameraModalEl = document.getElementById('close-camera-modal');
const captureBtnEl = document.getElementById('capture-btn');
const confirmCheckinBtnEl = document.getElementById('confirm-checkin-btn');
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('canvas');
const capturedImageEl = document.getElementById('captured-image');
const athleteNamePreviewEl = document.getElementById('athlete-name-preview');
const athleteBibPreviewEl = document.getElementById('athlete-bib-preview');
const paginationEl = document.getElementById('pagination');
const tabsEl = document.querySelectorAll('.tab');
const categoryFiltersEl = document.querySelectorAll('.category-filter');
const syncStatusEl = document.getElementById('sync-status') || document.createElement('div'); // Thêm trạng thái đồng bộ

// Initialize the application
window.addEventListener('DOMContentLoaded', () => {
    loadAthletes();
    setupEventListeners();

    // Tạo và thêm phần tử hiển thị trạng thái đồng bộ nếu chưa có trong HTML
    if (!document.getElementById('sync-status')) {
        syncStatusEl.id = 'sync-status';
        syncStatusEl.className = 'sync-status';
        document.querySelector('.search-container').appendChild(syncStatusEl);
    }
});

// Load athletes data
async function loadAthletes() {
    showLoading();
    try {
        const response = await fetch(WEBAPP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getAthletes' })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                athletes = result.data;
                lastDataSource = 'google-apps-script';
                updateSyncStatus('Đã tải dữ liệu từ Google Apps Script');
            } else {
                throw new Error(result.message || 'Không thể tải dữ liệu');
            }
        } else {
            throw new Error('Lỗi khi gọi Google Apps Script');
        }

        applyFilters();
    } catch (error) {
        console.error('Error loading data:', error);
        updateSyncStatus('Lỗi tải dữ liệu');
        alert('Không thể tải dữ liệu. Vui lòng thử lại sau.');
    } finally {
        hideLoading();
    }
}

// Apply filters and search to athletes list
function applyFilters() {
    const searchTerm = searchInputEl.value.toLowerCase();
    filteredAthletes = athletes.filter(athlete => {
        const nameMatch = athlete.name?.toLowerCase().includes(searchTerm);
        const bibMatch = athlete.bib?.toLowerCase().includes(searchTerm);
        const phoneMatch = athlete.phone?.toLowerCase().includes(searchTerm);
        const matchesSearch = !searchTerm || nameMatch || bibMatch || phoneMatch;

        let tabMatch = true;
        if (currentTab === 'checked-in') {
            tabMatch = athlete.checkin === 'Yes';
        } else if (currentTab === 'not-checked-in') {
            tabMatch = athlete.checkin !== 'Yes';
        }

        let categoryMatch = true;
        if (currentCategory !== 'all') {
            categoryMatch = athlete.category === currentCategory ||
                            athlete.distance === currentCategory ||
                            athlete.gender === currentCategory;
        }

        return matchesSearch && tabMatch && categoryMatch;
    });

    renderPagination();
    renderAthleteList();
}

// Render athlete list
function renderAthleteList() {
    athleteListEl.innerHTML = '';
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedAthletes = filteredAthletes.slice(startIndex, endIndex);

    if (paginatedAthletes.length === 0) {
        athleteListEl.innerHTML = '<p class="text-center">Không tìm thấy vận động viên nào.</p>';
        return;
    }

    paginatedAthletes.forEach(athlete => {
        const card = document.createElement('div');
        card.className = 'athlete-card';
        const isCheckedIn = athlete.checkin === 'Yes';

        card.innerHTML = `
            <div class="athlete-info">
                <div class="athlete-status ${isCheckedIn ? 'status-yes' : 'status-no'}">
                    ${isCheckedIn ? 'Đã check-in' : 'Chưa check-in'}
                </div>
                <div class="athlete-name">${athlete.name || 'Không có tên'}</div>
                <div class="athlete-details">BIB: ${athlete.bib || 'N/A'}</div>
                <div class="athlete-details">Cự ly: ${athlete.distance || 'N/A'}</div>
                <div class="athlete-details">Giới tính: ${athlete.gender || 'N/A'}</div>
                <button class="btn ${isCheckedIn ? 'btn-success' : 'btn-warning'} checkin-btn" data-id="${athlete.id || athlete.bib}">
                    <i class="fas ${isCheckedIn ? 'fa-check-circle' : 'fa-sign-in-alt'}"></i>
                    ${isCheckedIn ? 'Đã check-in' : 'Check-in'}
                </button>
            </div>
        `;

        const checkinBtn = card.querySelector('.checkin-btn');
        checkinBtn.addEventListener('click', () => {
            if (!isCheckedIn) {
                selectedAthlete = athlete;
                openCameraModal(athlete);
            }
        });

        athleteListEl.appendChild(card);
    });
}

// Render pagination
function renderPagination() {
    paginationEl.innerHTML = '';
    const totalPages = Math.ceil(filteredAthletes.length / itemsPerPage);

    if (totalPages <= 1) {
        return;
    }

    const prevBtn = document.createElement('div');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderAthleteList();
            updatePaginationActive();
        }
    });
    paginationEl.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        if (totalPages > 7) {
            if (i !== 1 && i !== totalPages && (i < currentPage - 1 || i > currentPage + 1)) {
                if (i === 2 || i === totalPages - 1) {
                    const dots = document.createElement('div');
                    dots.className = 'page-btn';
                    dots.textContent = '...';
                    dots.style.pointerEvents = 'none';
                    paginationEl.appendChild(dots);
                }
                continue;
            }
        }

        const pageBtn = document.createElement('div');
        pageBtn.className = 'page-btn';
        pageBtn.textContent = i;
        pageBtn.dataset.page = i;
        if (i === currentPage) {
            pageBtn.classList.add('active');
        }
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            renderAthleteList();
            updatePaginationActive();
        });
        paginationEl.appendChild(pageBtn);
    }

    const nextBtn = document.createElement('div');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderAthleteList();
            updatePaginationActive();
        }
    });
    paginationEl.appendChild(nextBtn);
}

// Update active pagination button
function updatePaginationActive() {
    const pageButtons = paginationEl.querySelectorAll('.page-btn');
    pageButtons.forEach(btn => {
        if (btn.dataset.page) {
            btn.classList.toggle('active', parseInt(btn.dataset.page) === currentPage);
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    searchBtnEl.addEventListener('click', () => {
        applyFilters();
    });

    searchInputEl.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });

    refreshBtnEl.addEventListener('click', async () => {
        showLoading();
        try {
            const response = await fetch(WEBAPP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'syncFromGitHub' })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    updateSyncStatus('Đã làm mới và đồng bộ dữ liệu từ GitHub');
                    await loadAthletes();
                } else {
                    updateSyncStatus('Lỗi làm mới dữ liệu từ GitHub');
                }
            } else {
                throw new Error('Server error during refresh');
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
            updateSyncStatus('Lỗi làm mới dữ liệu');
            alert('Không thể làm mới dữ liệu. Vui lòng thử lại sau.');
        } finally {
            hideLoading();
        }
    });

    qrScanBtnEl.addEventListener('click', openQrScanner);
    closeQrModalEl.addEventListener('click', closeQrScanner);
    closeCameraModalEl.addEventListener('click', closeCameraModal);
    captureBtnEl.addEventListener('click', captureImage);
    confirmCheckinBtnEl.addEventListener('click', confirmCheckin);

    tabsEl.forEach(tab => {
        tab.addEventListener('click', () => {
            tabsEl.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            currentPage = 1;
            applyFilters();
        });
    });

    categoryFiltersEl.forEach(filter => {
        filter.addEventListener('click', () => {
            categoryFiltersEl.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            currentCategory = filter.dataset.category;
            currentPage = 1;
            applyFilters();
        });
    });
}

// QR Scanner functionality
function openQrScanner() {
    qrModalEl.style.display = 'block';
    const qrConfig = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true
    };
    qrScanner = new Html5Qrcode("qr-reader");
    qrScanner.start(
        { facingMode: "environment" },
        qrConfig,
        onQrSuccess,
        onQrFailure
    );
}

function closeQrScanner() {
    qrModalEl.style.display = 'none';
    if (qrScanner && qrScanner.isScanning) {
        qrScanner.stop().catch(error => console.error('Error stopping QR scanner:', error));
    }
}

function onQrSuccess(decodedText) {
    closeQrScanner();
    const athlete = athletes.find(a =>
        a.id === decodedText ||
        a.bib === decodedText ||
        `${a.id}-${a.bib}` === decodedText
    );
    if (athlete) {
        selectedAthlete = athlete;
        openCameraModal(athlete);
    } else {
        alert('Không tìm thấy vận động viên với mã QR này.');
    }
}

function onQrFailure(error) {
    console.log('QR scan error:', error);
}

// Camera functionality
function openCameraModal(athlete) {
    cameraModalEl.style.display = 'block';
    athleteNamePreviewEl.textContent = `Tên: ${athlete.name || 'N/A'}`;
    athleteBibPreviewEl.textContent = `BIB: ${athlete.bib || 'N/A'}`;

    capturedImageEl.style.display = 'none';
    videoEl.style.display = 'block';
    captureBtnEl.style.display = 'block';
    confirmCheckinBtnEl.style.display = 'none';

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                videoEl.srcObject = stream;
            })
            .catch(error => {
                console.error('Error accessing camera:', error);
                alert('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.');
            });
    } else {
        alert('Trình duyệt của bạn không hỗ trợ chức năng camera.');
    }
}

function closeCameraModal() {
    cameraModalEl.style.display = 'none';
    if (videoEl.srcObject) {
        videoEl.srcObject.getTracks().forEach(track => track.stop());
        videoEl.srcObject = null;
    }
}

function captureImage() {
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    canvasEl.getContext('2d').drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

    const imageDataUrl = canvasEl.toDataURL('image/png');
    capturedImageEl.src = imageDataUrl;
    capturedImageEl.style.display = 'block';

    videoEl.style.display = 'none';
    captureBtnEl.style.display = 'none';
    confirmCheckinBtnEl.style.display = 'block';

    if (videoEl.srcObject) {
        videoEl.srcObject.getTracks().forEach(track => track.stop());
        videoEl.srcObject = null;
    }
}

async function confirmCheckin() {
    if (!selectedAthlete) {
        alert('Không tìm thấy thông tin vận động viên.');
        return;
    }

    showLoading();
    updateSyncStatus('Đang thực hiện check-in...');
    try {
        const imageBlob = await new Promise(resolve => {
            canvasEl.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
        });

        const formData = new FormData();
        formData.append('action', 'checkin');
        formData.append('id', selectedAthlete.id || '');
        formData.append('bib', selectedAthlete.bib || '');
        formData.append('image', imageBlob, `${selectedAthlete.bib || 'unknown'}.jpg`);
        formData.append('syncToGitHub', 'yes');

        const response = await fetch(WEBAPP_URL, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                if (result.syncStatus === 'success') {
                    updateSyncStatus('Check-in thành công và đã đồng bộ với GitHub!');
                } else if (result.syncStatus === 'failed') {
                    updateSyncStatus('Check-in thành công nhưng đồng bộ GitHub thất bại!');
                    await loadAthletes();
                } else {
                    updateSyncStatus('Check-in thành công!');
                    await loadAthletes();
                }
                alert('Check-in thành công!');
                closeCameraModal();
            } else {
                updateSyncStatus('Check-in thất bại!');
                alert('Check-in thất bại. Vui lòng thử lại.');
            }
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        console.error('Error confirming check-in:', error);
        updateSyncStatus('Lỗi khi xác nhận check-in');
        alert('Đã xảy ra lỗi khi xác nhận check-in.');
    } finally {
        hideLoading();
    }
}

// Utility functions
function showLoading() {
    loadingEl.style.display = 'block';
}

function hideLoading() {
    loadingEl.style.display = 'none';
}

function updateSyncStatus(message) {
    if (syncStatusEl) {
        syncStatusEl.textContent = message;
        syncStatusEl.style.display = 'block';
        setTimeout(() => {
            syncStatusEl.style.opacity = '0.7';
        }, 5000);
    }
    console.log('Sync status:', message);
}
