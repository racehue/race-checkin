// Google Sheets API setup
const SHEET_ID = '1kdt68gFOrTyirvo69oRDpAJDM7y_iGxvXM3HLDb57kw';
const API_KEY = 'AIzaSyAMjzUR6DiIiSBkxaqtohn4YJqlm9njUu0';
const SHEET_NAME = 'athletes';
const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;
// GitHub repository details
const GITHUB_OWNER = 'racehue';
const GITHUB_REPO = 'race-check-in';
const GITHUB_PATH = 'data/athletes.json';
const GITHUB_BRANCH = 'main';
const GITHUB_TOKEN = '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';
// Web App URL for Google Sheets
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec';
// Global variables
let athletes = [];
let filteredAthletes = [];
let selectedDistance = 'all';
let selectedGender = 'all';
let selectedAthleteId = null;
let capturedImageURL = '';
let videoStream = null;
let retryCount = 0;
const MAX_RETRIES = 3;
let lastFetchTime = 0;
const FETCH_COOLDOWN = 10000; // 10 seconds cooldown between fetches
// Cache settings
const CACHE_KEY = 'athletesData';
const CACHE_EXPIRY = 3600000; // 1 hour in milliseconds
// DOM Elements - Using selectors only once for performance
const DOM = {
    athletesList: document.getElementById('athletes-list'),
    searchInput: document.getElementById('search-input'),
    resultsCount: document.getElementById('results-count'),
    refreshBtn: document.getElementById('refresh-btn'),
    checkinBtn: document.getElementById('checkin-btn'),
    importBtn: document.getElementById('import-btn'),
    takePhotoBtn: document.getElementById('take-photo-btn'),
    distanceFilters: document.querySelectorAll('[data-filter]'),
    genderFilters: document.querySelectorAll('[data-gender]'),
    noResultsElement: document.getElementById('no-results'),
    modal: document.getElementById('photo-modal'),
    webcamPreview: document.getElementById('webcam-preview'),
    capturedPhoto: document.getElementById('captured-photo'),
    captureBtn: document.getElementById('capture-btn'),
    retakeBtn: document.getElementById('retake-btn'),
    confirmBtn: document.getElementById('confirm-btn'),
    closeModalBtn: document.getElementById('close-modal')
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    addGitHubButtons();
    initializeApp();
    setupEventListeners();
    setActiveFilterButton('distance', selectedDistance);
    setActiveFilterButton('gender', selectedGender);
});

// Initialize app with cached data if available
function initializeApp() {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
        try {
            const { data, timestamp } = JSON.parse(cachedData);
            const now = Date.now();
            if (now - timestamp < CACHE_EXPIRY) {
                athletes = data;
                filteredAthletes = [...athletes];
                updateResultsCount();
                renderAthletes();
                showNotification('Đã tải dữ liệu từ bộ nhớ đệm', 'info');
                setTimeout(fetchAthletes, 100);
                return;
            }
        } catch (err) {
            console.error('Error parsing cached data:', err);
        }
    }
    fetchAthletes();
}

// Fetch athletes data from Google Sheets with retry and error handling
function fetchAthletes() {
    const now = Date.now();
    if (now - lastFetchTime < FETCH_COOLDOWN) {
        showNotification('Đang tải dữ liệu, vui lòng chờ...', 'info');
        return;
    }
    lastFetchTime = now;

    if (DOM.refreshBtn) {
        DOM.refreshBtn.innerHTML = '<i class="fas fa-sync loading-icon"></i> Đang tải...';
        DOM.refreshBtn.disabled = true;
    }

    fetch(API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            processData(data.values);
            renderAthletes();
            console.log('Data fetched successfully');
            retryCount = 0;
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: athletes,
                timestamp: Date.now()
            }));
            showNotification('Dữ liệu đã được cập nhật', 'success');
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            if (retryCount < MAX_RETRIES) {
                retryCount++;
                showNotification(`Lỗi kết nối. Đang thử lại (${retryCount}/${MAX_RETRIES})...`, 'warning');
                setTimeout(fetchAthletes, 2000 * retryCount);
            } else {
                showNotification('Không thể kết nối với Google Sheets sau nhiều lần thử', 'error');
                const cachedData = localStorage.getItem(CACHE_KEY);
                if (cachedData) {
                    try {
                        const { data } = JSON.parse(cachedData);
                        athletes = data;
                        filteredAthletes = [...athletes];
                        updateResultsCount();
                        renderAthletes();
                        showNotification('Sử dụng dữ liệu cũ từ bộ nhớ đệm', 'info');
                    } catch (err) {
                        console.error('Error using cached data:', err);
                        useTestData();
                    }
                } else {
                    useTestData();
                }
            }
        })
        .finally(() => {
            if (DOM.refreshBtn) {
                DOM.refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Làm mới';
                DOM.refreshBtn.disabled = false;
            }
        });
}

// Process the data from Google Sheets
function processData(values) {
    const headers = values[0];
    athletes = [];
    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row || row.length === 0 || !row[0]) continue;
        const athlete = {
            id: row[0] || '',
            name: row[1] || '',
            gender: row[2] || '',
            distance: row[3] || '',
            bib: row[4] || '',
            checkedIn: row[5] === 'true',
            checkinTime: row[6] || '',
            photoUrl: row[7] || ''
        };
        athletes.push(athlete);
    }
    filteredAthletes = [...athletes];
    updateResultsCount();
}

// Update the display of results count
function updateResultsCount() {
    DOM.resultsCount.textContent = `[${filteredAthletes.length}/${athletes.length}]`;
    if (filteredAthletes.length === 0) {
        DOM.noResultsElement.classList.remove('hidden');
    } else {
        DOM.noResultsElement.classList.add('hidden');
    }
}

// Render athletes list with performance optimizations
function renderAthletes() {
    const fragment = document.createDocumentFragment();
    DOM.athletesList.innerHTML = '';
    filteredAthletes.forEach(athlete => {
        const card = document.createElement('div');
        card.className = 'athlete-card';
        if (athlete.checkedIn) {
            card.classList.add('checked-in');
        }
        card.dataset.id = athlete.id;
        const genderClass = athlete.gender.toLowerCase() === 'nam' ? 'gender-m' : 'gender-f';
        const genderLabel = athlete.gender.toLowerCase() === 'nam' ? 'M' : 'F';
        card.innerHTML = `
            <div class="athlete-photo">
                <img src="${athlete.photoUrl || 'placeholder.jpg'}" alt="${athlete.name}" onerror="this.src='placeholder.jpg'" loading="lazy">
            </div>
            <div class="athlete-info">
                <div class="flex items-center mb-1">
                    <div class="athlete-gender ${genderClass}">${genderLabel}</div>
                    <div class="athlete-name">${athlete.name}</div>
                </div>
                <div class="bib-number">Bib: ${athlete.bib || 'Chưa có Bib'}</div>
                <div class="checkin-status ${athlete.checkedIn ? 'checked' : ''}">${athlete.checkedIn ? 'Đã check in' : 'Chưa check in'}</div>
                <div class="checkin-time">${athlete.checkinTime ? 'Lúc: ' + athlete.checkinTime : ''}</div>
            </div>
            <div class="athlete-distance">${athlete.distance}</div>
        `;
        fragment.appendChild(card);
    });
    DOM.athletesList.appendChild(fragment);
}

// Debounce function for search input
function debounce(func, delay) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// Filter athletes based on search input, distance and gender
const filterAthletes = debounce(function() {
    const searchTerm = DOM.searchInput.value.toLowerCase();
    filteredAthletes = athletes.filter(athlete => {
        const matchesSearch = searchTerm === '' ||
            athlete.name.toLowerCase().includes(searchTerm) ||
            athlete.bib.toLowerCase().includes(searchTerm);
        const matchesDistance = selectedDistance === 'all' ||
            athlete.distance === selectedDistance;
        const matchesGender = selectedGender === 'all' ||
            athlete.gender.toLowerCase() === selectedGender.toLowerCase();
        return matchesSearch && matchesDistance && matchesGender;
    });
    updateResultsCount();
    renderAthletes();
}, 250);

// Check in selected athlete with enhanced error handling
function checkInAthlete(athleteId) {
    const now = new Date();
    const timeString = formatDate(now);
    const athlete = athletes.find(a => a.id === athleteId);
    if (!athlete) {
        showNotification('VĐV không tồn tại trong dữ liệu', 'error');
        return false;
    }
    athlete.checkedIn = true;
    athlete.checkinTime = timeString;
    if (capturedImageURL) {
        athlete.photoUrl = capturedImageURL;
    }
    updateGoogleSheet(athleteId, timeString, capturedImageURL);
    renderAthletes();
    return true;
}

// Format date in a user-friendly format
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Update Google Sheet with check-in data and photo URL
function updateGoogleSheet(athleteId, timeString, photoUrl) {
    const encodedTime = encodeURIComponent(timeString);
    const encodedPhotoUrl = encodeURIComponent(photoUrl || '');
    const updateUrl = `${WEBAPP_URL}?id=${athleteId}&time=${encodedTime}&photoUrl=${encodedPhotoUrl}`;
    const notificationId = 'update-' + athleteId;
    showNotification('Đang cập nhật dữ liệu...', 'info', notificationId);
    fetch(updateUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Update successful:', data);
            removeNotification(notificationId);
            showNotification('Check-in thành công');
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (cachedData) {
                try {
                    const cache = JSON.parse(cachedData);
                    const athleteIndex = cache.data.findIndex(a => a.id === athleteId);
                    if (athleteIndex >= 0) {
                        cache.data[athleteIndex].checkedIn = true;
                        cache.data[athleteIndex].checkinTime = timeString;
                        if (photoUrl) {
                            cache.data[athleteIndex].photoUrl = photoUrl;
                        }
                        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
                    }
                } catch (err) {
                    console.error('Error updating cached data:', err);
                }
            }
        })
        .catch(error => {
            console.error('Error updating sheet:', error);
            removeNotification(notificationId);
            showNotification('Lỗi khi cập nhật Google Sheet. Sẽ đồng bộ sau.', 'warning');
            saveFailedUpdate(athleteId, timeString, photoUrl);
        });
}

// Save failed update to sync later
function saveFailedUpdate(athleteId, timeString, photoUrl) {
    let failedUpdates = [];
    const saved = localStorage.getItem('failedUpdates');
    if (saved) {
        try {
            failedUpdates = JSON.parse(saved);
        } catch (err) {
            console.error('Error parsing failed updates:', err);
        }
    }
    failedUpdates.push({
        athleteId,
        timeString,
        photoUrl,
        timestamp: Date.now()
    });
    localStorage.setItem('failedUpdates', JSON.stringify(failedUpdates));
    addSyncButton();
}

// Add sync button to UI
function addSyncButton() {
    if (document.getElementById('sync-button')) return;
    const actionArea = document.querySelector('.action-buttons');
    if (!actionArea) return;
    const syncBtn = document.createElement('button');
    syncBtn.id = 'sync-button';
    syncBtn.className = 'action-btn warning';
    syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Đồng bộ dữ liệu';
    syncBtn.addEventListener('click', syncFailedUpdates);
    actionArea.appendChild(syncBtn);
}

// Sync failed updates
function syncFailedUpdates() {
    const saved = localStorage.getItem('failedUpdates');
    if (!saved) return;
    try {
        const failedUpdates = JSON.parse(saved);
        if (failedUpdates.length === 0) {
            showNotification('Không có dữ liệu cần đồng bộ', 'info');
            return;
        }
        showNotification(`Đang đồng bộ ${failedUpdates.length} bản ghi...`, 'info');
        processNextUpdate(failedUpdates, 0);
    } catch (err) {
        console.error('Error syncing failed updates:', err);
        showNotification('Lỗi khi đồng bộ dữ liệu', 'error');
    }
}

// Process updates recursively
function processNextUpdate(updates, index) {
    if (index >= updates.length) {
        localStorage.removeItem('failedUpdates');
        showNotification('Đồng bộ hoàn tất', 'success');
        const syncBtn = document.getElementById('sync-button');
        if (syncBtn) syncBtn.remove();
        return;
    }
    const update = updates[index];
    updateGoogleSheet(update.athleteId, update.timeString, update.photoUrl)
        .then(success => {
            if (success) {
                updates.splice(index, 1);
                localStorage.setItem('failedUpdates', JSON.stringify(updates));
                processNextUpdate(updates, index);
            } else {
                processNextUpdate(updates, index + 1);
            }
        })
        .catch(() => {
            processNextUpdate(updates, index + 1);
        });
}

// Enhanced notification system
function showNotification(message, type = 'success', id = null) {
    if (id) {
        const existing = document.getElementById(id);
        if (existing) {
            existing.textContent = message;
            existing.className = `notification ${type}`;
            return;
        }
    }
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    if (id) notification.id = id;
    document.body.appendChild(notification);
    if (!id) {
        setTimeout(() => {
            notification.classList.add('fadeout');
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
}

// Remove a specific notification
function removeNotification(id) {
    const notification = document.getElementById(id);
    if (notification) {
        notification.classList.add('fadeout');
        setTimeout(() => notification.remove(), 500);
    }
}

// Setup all event listeners with improved touch support
function setupEventListeners() {
    DOM.searchInput.addEventListener('input', filterAthletes);
    DOM.refreshBtn.addEventListener('click', function() {
        if (!this.disabled) {
            fetchAthletes();
        }
    });
    DOM.distanceFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedDistance = btn.dataset.filter;
            setActiveFilterButton('distance', selectedDistance);
            filterAthletes();
        });
    });
    DOM.genderFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedGender = btn.dataset.gender;
            setActiveFilterButton('gender', selectedGender);
            filterAthletes();
        });
    });
    DOM.checkinBtn.addEventListener('click', () => {
        const selectedCards = document.querySelectorAll('.athlete-card.selected');
        if (selectedCards.length === 0) {
            showNotification('Vui lòng chọn VĐV để check-in', 'error');
            return;
        }
        let successCount = 0;
        selectedCards.forEach(card => {
            if (checkInAthlete(card.dataset.id)) {
                successCount++;
                card.classList.remove('selected');
            }
        });
        if (successCount > 0) {
            showNotification(`Đã check-in cho ${successCount} VĐV`, 'success');
        }
    });
    DOM.athletesList.addEventListener('click', (e) => {
        const card = e.target.closest('.athlete-card');
        if (card) {
            if (!e.shiftKey) {
                document.querySelectorAll('.athlete-card.selected').forEach(selected => {
                    if (selected !== card) {
                        selected.classList.remove('selected');
                    }
                });
            }
            card.classList.toggle('selected');
        }
    });
    DOM.takePhotoBtn.addEventListener('click', () => {
        const selectedCards = document.querySelectorAll('.athlete-card.selected');
        if (selectedCards.length !== 1) {
            showNotification('Vui lòng chọn một VĐV để chụp ảnh', 'error');
            return;
        }
        selectedAthleteId = selectedCards[0].dataset.id;
        openCamera();
    });
    DOM.closeModalBtn.addEventListener('click', () => {
        if (capturedImageURL && !confirm('Bạn có chắc muốn hủy ảnh đã chụp?')) {
            return;
        }
        closeModal();
    });
    DOM.captureBtn.addEventListener('click', capturePhoto);
    DOM.retakeBtn.addEventListener('click', retakePhoto);
    DOM.confirmBtn.addEventListener('click', () => {
        if (!capturedImageURL) {
            showNotification('Vui lòng chụp ảnh trước khi xác nhận', 'warning');
            return;
        }
        DOM.confirmBtn.disabled = true;
        DOM.confirmBtn.textContent = 'Đang xử lý...';
        optimizeImage(capturedImageURL)
            .then(optimizedImage => {
                capturedImageURL = optimizedImage;
                confirmPhoto();
            })
            .catch(err => {
                console.error('Error optimizing image:', err);
                confirmPhoto();
            })
            .finally(() => {
                DOM.confirmBtn.disabled = false;
                DOM.confirmBtn.textContent = 'Xác nhận';
            });
    });
    DOM.importBtn.addEventListener('click', () => {
        showNotification('Chức năng nhập dữ liệu đang được phát triển', 'info');
    });
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
// Keyboard shortcuts
        if (e.key === 'Escape') {
            closeModal();
        } else if (e.key === 'Enter' && !DOM.modal.classList.contains('hidden')) {
            if (DOM.webcamPreview.classList.contains('active')) {
                capturePhoto();
            } else if (DOM.capturedPhoto.classList.contains('active')) {
                confirmPhoto();
            }
        }
    });
    // Add touch support for mobile devices
    if ('ontouchstart' in window) {
        addTouchSupport();
    }
}

// Add touch support for mobile devices
function addTouchSupport() {
    let touchStartTime;
    let touchStartElement;
    
    document.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
        touchStartElement = e.target.closest('.athlete-card');
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - touchStartTime;
        
        // Long press (similar to shift+click)
        if (touchDuration > 500 && touchStartElement) {
            e.preventDefault();
            if (!touchStartElement.classList.contains('selected')) {
                touchStartElement.classList.add('selected');
            } else {
                touchStartElement.classList.remove('selected');
            }
        }
    });
}

// Set active filter button
function setActiveFilterButton(type, value) {
    const selector = type === 'distance' ? '[data-filter]' : '[data-gender]';
    const attribute = type === 'distance' ? 'data-filter' : 'data-gender';
    
    document.querySelectorAll(selector).forEach(btn => {
        if (btn.getAttribute(attribute) === value) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Open camera modal
function openCamera() {
    DOM.modal.classList.remove('hidden');
    DOM.webcamPreview.classList.add('active');
    DOM.capturedPhoto.classList.remove('active');
    DOM.captureBtn.classList.remove('hidden');
    DOM.retakeBtn.classList.add('hidden');
    DOM.confirmBtn.classList.add('hidden');
    
    // Access camera
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        } 
    })
    .then(stream => {
        videoStream = stream;
        DOM.webcamPreview.srcObject = stream;
        DOM.webcamPreview.play();
    })
    .catch(err => {
        console.error('Error accessing camera:', err);
        showNotification('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.', 'error');
        closeModal();
    });
}

// Capture photo from webcam
function capturePhoto() {
    if (!videoStream) {
        showNotification('Camera chưa được khởi tạo', 'error');
        return;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = DOM.webcamPreview.videoWidth;
    canvas.height = DOM.webcamPreview.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // Draw video frame to canvas
    ctx.drawImage(DOM.webcamPreview, 0, 0, canvas.width, canvas.height);
    
    // Convert to data URL
    capturedImageURL = canvas.toDataURL('image/jpeg', 0.8);
    
    // Display captured photo
    DOM.capturedPhoto.src = capturedImageURL;
    DOM.webcamPreview.classList.remove('active');
    DOM.capturedPhoto.classList.add('active');
    DOM.captureBtn.classList.add('hidden');
    DOM.retakeBtn.classList.remove('hidden');
    DOM.confirmBtn.classList.remove('hidden');
}

// Retake photo
function retakePhoto() {
    capturedImageURL = '';
    DOM.webcamPreview.classList.add('active');
    DOM.capturedPhoto.classList.remove('active');
    DOM.captureBtn.classList.remove('hidden');
    DOM.retakeBtn.classList.add('hidden');
    DOM.confirmBtn.classList.add('hidden');
}

// Optimize image for better performance
function optimizeImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            // Target size around 400px width for good quality but smaller file size
            const maxWidth = 400;
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG with 0.7 quality
            const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            resolve(optimizedDataUrl);
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// Confirm and save photo
function confirmPhoto() {
    closeModal();
    if (selectedAthleteId && capturedImageURL) {
        // First update UI immediately
        const athlete = athletes.find(a => a.id === selectedAthleteId);
        if (athlete) {
            athlete.photoUrl = capturedImageURL;
            
            // Check if athlete is already checked in
            if (!athlete.checkedIn) {
                const shouldCheckIn = confirm('Xác nhận check-in cho VĐV này luôn?');
                if (shouldCheckIn) {
                    checkInAthlete(selectedAthleteId);
                } else {
                    // Just update the photo
                    updateGoogleSheet(selectedAthleteId, athlete.checkinTime || '', capturedImageURL);
                }
            } else {
                // Just update the photo
                updateGoogleSheet(selectedAthleteId, athlete.checkinTime, capturedImageURL);
            }
            
            renderAthletes();
            showNotification('Ảnh đã được cập nhật', 'success');
        }
    }
    capturedImageURL = '';
    selectedAthleteId = null;
}

// Close camera modal and clean up
function closeModal() {
    DOM.modal.classList.add('hidden');
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    DOM.webcamPreview.srcObject = null;
}

// Add GitHub buttons for data export and sync
function addGitHubButtons() {
    const actionArea = document.querySelector('.action-buttons');
    if (!actionArea) return;
    
    const exportBtn = document.createElement('button');
    exportBtn.className = 'action-btn secondary';
    exportBtn.innerHTML = '<i class="fas fa-upload"></i> Xuất dữ liệu';
    exportBtn.addEventListener('click', exportToGitHub);
    actionArea.appendChild(exportBtn);
}

// Export data to GitHub repository
function exportToGitHub() {
    showNotification('Đang xuất dữ liệu lên GitHub...', 'info');
    
    const formattedData = JSON.stringify(athletes, null, 2);
    const headers = {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
    };
    
    // First get the SHA of the current file if it exists
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`, {
        method: 'GET',
        headers
    })
    .then(response => response.json())
    .then(fileInfo => {
        const sha = fileInfo.sha;
        const encodedContent = btoa(formattedData);
        
        // Now update the file with the new content
        return fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: `Update athletes data - ${new Date().toISOString()}`,
                content: encodedContent,
                sha,
                branch: GITHUB_BRANCH
            })
        });
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update GitHub file');
        }
        return response.json();
    })
    .then(() => {
        showNotification('Dữ liệu đã được xuất thành công lên GitHub', 'success');
    })
    .catch(error => {
        console.error('Error exporting to GitHub:', error);
        showNotification('Lỗi khi xuất dữ liệu: ' + error.message, 'error');
    });
}

// Use test data when all else fails
function useTestData() {
    athletes = [
        {
            id: 'test1',
            name: 'Nguyễn Văn A',
            gender: 'Nam',
            distance: '42K',
            bib: '1001',
            checkedIn: false,
            checkinTime: '',
            photoUrl: ''
        },
        {
            id: 'test2',
            name: 'Trần Thị B',
            gender: 'Nữ',
            distance: '21K',
            bib: '2001',
            checkedIn: true,
            checkinTime: '01/01/2023 08:00',
            photoUrl: ''
        }
    ];
    filteredAthletes = [...athletes];
    updateResultsCount();
    renderAthletes();
    showNotification('Sử dụng dữ liệu mẫu', 'warning');
}

// Add progressive web app support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Add offline detection
window.addEventListener('online', () => {
    document.body.classList.remove('offline');
    showNotification('Đã kết nối lại mạng', 'success');
    if (document.getElementById('sync-button')) {
        syncFailedUpdates();
    }
});

window.addEventListener('offline', () => {
    document.body.classList.add('offline');
    showNotification('Mất kết nối mạng. Ứng dụng sẽ hoạt động trong chế độ ngoại tuyến.', 'warning');
});

// Add performance metrics
window.addEventListener('load', () => {
    setTimeout(() => {
        const timing = window.performance.timing;
        const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
        console.log(`Page load time: ${pageLoadTime}ms`);
        
        // Report to analytics if needed
        if (pageLoadTime > 3000) {
            // Slow loading, might want to optimize
            console.warn('Page loading slowly. Consider optimization.');
        }
    }, 0);
});

// Add error tracking
window.addEventListener('error', event => {
    console.error('Global error:', event.error);
    // You could send this to a logging service
    const errorTime = new Date().toISOString();
    const errorMessage = event.message;
    const errorStack = event.error ? event.error.stack : '';
    const errorData = { time: errorTime, message: errorMessage, stack: errorStack };
    
    // Store errors locally
    let errors = [];
    try {
        const storedErrors = localStorage.getItem('errorLog');
        if (storedErrors) {
            errors = JSON.parse(storedErrors);
        }
    } catch (e) {
        // Reset if corrupted
        errors = [];
    }
    
    errors.push(errorData);
    // Keep only recent errors
    if (errors.length > 20) {
        errors = errors.slice(-20);
    }
    
    localStorage.setItem('errorLog', JSON.stringify(errors));
});
