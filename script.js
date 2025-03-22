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
    // Add GitHub buttons to action area
    addGitHubButtons();
    
    // Initialize the app
    initializeApp();
    setupEventListeners();
    
    // Set active filter button
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
            
            // Use cached data if it's not expired
            if (now - timestamp < CACHE_EXPIRY) {
                athletes = data;
                filteredAthletes = [...athletes];
                updateResultsCount();
                renderAthletes();
                showNotification('Đã tải dữ liệu từ bộ nhớ đệm', 'info');
                
                // Still fetch in background for updates
                setTimeout(fetchAthletes, 100);
                return;
            }
        } catch (err) {
            console.error('Error parsing cached data:', err);
        }
    }
    
    // No valid cache, fetch from API
    fetchAthletes();
}

// Fetch athletes data from Google Sheets with retry and error handling
function fetchAthletes() {
    // Throttle frequent fetches
    const now = Date.now();
    if (now - lastFetchTime < FETCH_COOLDOWN) {
        showNotification('Đang tải dữ liệu, vui lòng chờ...', 'info');
        return;
    }
    
    lastFetchTime = now;
    
    // Show loading state
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
            
            // Reset retry count on success
            retryCount = 0;
            
            // Cache the data
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
                setTimeout(fetchAthletes, 2000 * retryCount); // Exponential backoff
            } else {
                showNotification('Không thể kết nối với Google Sheets sau nhiều lần thử', 'error');
                // If we have cached data, use it
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
                        useTestData(); // Last resort
                    }
                } else {
                    useTestData(); // Fallback to test data
                }
            }
        })
        .finally(() => {
            // Hide loading state
            if (DOM.refreshBtn) {
                DOM.refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Làm mới';
                DOM.refreshBtn.disabled = false;
            }
        });
}

// Process the data from Google Sheets
function processData(values) {
    // Skip header row
    const headers = values[0];
    athletes = [];

    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        // Skip empty rows
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
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Clean the container once instead of multiple innerHTML operations
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

        // Using template literals for better readability
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
    
    // Append all elements at once
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
}, 250); // 250ms delay for better performance

// Check in selected athlete with enhanced error handling
function checkInAthlete(athleteId) {
    const now = new Date();
    const timeString = formatDate(now);

    // Find the athlete in our local data
    const athlete = athletes.find(a => a.id === athleteId);
    if (!athlete) {
        showNotification('VĐV không tồn tại trong dữ liệu', 'error');
        return false;
    }
    
    // Optimistically update local data
    athlete.checkedIn = true;
    athlete.checkinTime = timeString;
    if (capturedImageURL) {
        athlete.photoUrl = capturedImageURL;
    }

    // Update Google Sheet via API with retry mechanism
    updateGoogleSheet(athleteId, timeString, capturedImageURL);
    
    // Update the UI
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
    
    // Show loading notification
    const notificationId = 'update-' + athleteId;
    showNotification('Đang cập nhật dữ liệu...', 'info', notificationId);
    
    return fetch(updateUrl)
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
            
            // Update local cache
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
            
            return true;
        })
        .catch(error => {
            console.error('Error updating sheet:', error);
            removeNotification(notificationId);
            showNotification('Lỗi khi cập nhật Google Sheet. Sẽ đồng bộ sau.', 'warning');
            
            // Save failed updates to sync later
            saveFailedUpdate(athleteId, timeString, photoUrl);
            return false;
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
    
    // Add sync button if not already present
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
        
        // Process updates one by one
        processNextUpdate(failedUpdates, 0);
    } catch (err) {
        console.error('Error syncing failed updates:', err);
        showNotification('Lỗi khi đồng bộ dữ liệu', 'error');
    }
}

// Process updates recursively
function processNextUpdate(updates, index) {
    if (index >= updates.length) {
        // All done
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
                // Remove this update and continue
                updates.splice(index, 1);
                localStorage.setItem('failedUpdates', JSON.stringify(updates));
                processNextUpdate(updates, index);
            } else {
                // Skip to next
                processNextUpdate(updates, index + 1);
            }
        })
        .catch(() => {
            // Skip to next
            processNextUpdate(updates, index + 1);
        });
}

// Enhanced notification system
function showNotification(message, type = 'success', id = null) {
    if (id) {
        // Check if notification with this ID already exists
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
    
    // Only auto-remove if no ID is provided
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
    // Search input
    DOM.searchInput.addEventListener('input', filterAthletes);

    // Refresh button with safeguard against double-click
    DOM.refreshBtn.addEventListener('click', function() {
        if (!this.disabled) {
            fetchAthletes();
        }
    });

    // Distance filter buttons
    DOM.distanceFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedDistance = btn.dataset.filter;
            setActiveFilterButton('distance', selectedDistance);
            filterAthletes();
        });
    });

    // Gender filter buttons
    DOM.genderFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedGender = btn.dataset.gender;
            setActiveFilterButton('gender', selectedGender);
            filterAthletes();
        });
    });

    // Check-in button
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

    // Athlete card selection with touch support
    DOM.athletesList.addEventListener('click', (e) => {
        const card = e.target.closest('.athlete-card');
        if (card) {
            // For mobile: deselect all other cards if not holding shift
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

    // Take photo button with permission check
    DOM.takePhotoBtn.addEventListener('click', () => {
        const selectedCards = document.querySelectorAll('.athlete-card.selected');
        if (selectedCards.length !== 1) {
            showNotification('Vui lòng chọn một VĐV để chụp ảnh', 'error');
            return;
        }
        selectedAthleteId = selectedCards[0].dataset.id;
        
        // Check if we already have camera permission
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'camera' })
                .then(permissionStatus => {
                    if (permissionStatus.state === 'granted') {
                        openCamera();
                    } else {
                        showCameraPermissionRequest();
                    }
                })
                .catch(() => {
                    // Permissions API not supported, try directly
                    openCamera();
                });
        } else {
            // Permissions API not supported, try directly
            openCamera();
        }
    });

    // Modal close button with safety check
    DOM.closeModalBtn.addEventListener('click', () => {
        if (capturedImageURL && !confirm('Bạn có chắc muốn hủy ảnh đã chụp?')) {
            return;
        }
        closeModal();
    });

    // Capture button
    DOM.captureBtn.addEventListener('click', capturePhoto);

    // Retake button
    DOM.retakeBtn.addEventListener('click', retakePhoto);

    // Confirm button with feedback
    DOM.confirmBtn.addEventListener('click', () => {
        if (!capturedImageURL) {
            showNotification('Vui lòng chụp ảnh trước khi xác nhận', 'warning');
            return;
        }
        DOM.confirmBtn.disabled = true;
        DOM.confirmBtn.textContent = 'Đang xử lý...';
        
        // Optimize image before saving
        optimizeImage(capturedImageURL)
            .then(optimizedImage => {
                capturedImageURL = optimizedImage;
                confirmPhoto();
            })
            .catch(err => {
                console.error('Error optimizing image:', err);
                // Fallback to original image
                confirmPhoto();
            })
            .finally(() => {
                DOM.confirmBtn.disabled = false;
                DOM.confirmBtn.textContent = 'Xác nhận';
            });
    });

    // Import button
    DOM.importBtn.addEventListener('click', () => {
        showNotification('Chức năng nhập dữ liệu đang được phát triển', 'info');
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Prevent shortcuts when typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Ctrl+R or F5: Refresh data
        if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
            e.preventDefault();
            fetchAthletes();
        }
        
        // Enter: Check-in selected athletes
        if (e.key === 'Enter') {
            const selectedCards = document.querySelectorAll('.athlete-card.selected');
            if (selectedCards.length > 0) {
                e.preventDefault();
                DOM.checkinBtn.click();
            }
        }
        
        // P: Take photo of selected athlete
        if (e.key === 'p' || e.key === 'P') {
            const selectedCards = document.querySelectorAll('.athlete-card.selected');
            if (selectedCards.length === 1) {
                e.preventDefault();
                DOM.takePhotoBtn.click();
            }
        }
        
        // Escape: Close modal
        if (e.key === 'Escape' && DOM.modal.style.display === 'flex') {
            e.preventDefault();
            closeModal();
        }
    });
}

// Show camera permission request with instructions
function showCameraPermissionRequest() {
    const permissionDialog = document.createElement('div');
    permissionDialog.className = 'camera-permission-dialog';
    permissionDialog.innerHTML = `
        <h3>Cần quyền truy cập camera</h3>
        <p>Để chụp ảnh check-in, ứng dụng cần quyền truy cập camera của bạn.</p>
        <div class="button-group">
            <button id="permission-ok" class="btn primary">Cho phép</button>
            <button id="permission-cancel" class="btn secondary">Hủy</button>
        </div>
    `;
    
    document.body.appendChild(permissionDialog);
    
    document.getElementById('permission-ok').addEventListener('click', () => {
        permissionDialog.remove();
        openCamera();
    });
    
    document.getElementById('permission-cancel').addEventListener('click', () => {
        permissionDialog.remove();
    });
}

// Optimize image before upload
function optimizeImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // Target width/height for optimization
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 600;
            
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions while maintaining aspect ratio
            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get optimized image with reduced quality
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        
        img.onerror = reject;
        img.src = dataUrl;
    });
}

function setActiveFilterButton(filterType, filterValue) {
    const buttons = filterType === 'distance' ? DOM.distanceFilters : DOM.genderFilters;
    buttons.forEach(button => {
        if (button.dataset[filterType] === filterValue) {
            button.classList.add('active');
            button.classList.remove('bg-gray-300', 'text-gray-700', 'hover:bg-gray-400');
            button.classList.add('bg-blue-500', 'text-white', 'hover:bg-blue-600');
        } else {
            button.classList.remove('active');
            button.classList.remove('bg-blue-500', 'text-white', 'hover:bg-blue-600');
            button.classList.add('bg-gray-300', 'text-gray-700', 'hover:bg-gray-400');
        }
    });
}

// Function to add GitHub buttons to the interface
function addGitHubButtons() {
    const actionArea = document.querySelector('.action-buttons');
    if (!actionArea) return;
    
    // Add export button
    const exportBtn = document.createElement('button');
    exportBtn.id = 'github-export-btn';
    exportBtn.className = 'action-btn';
    exportBtn.innerHTML = '<i class="fas fa-download"></i> Xuất JSON';
    exportBtn.addEventListener('click', exportDataForGitHub);
    actionArea.appendChild(exportBtn);
    
    // Add commit button
    const commitBtn = document.createElement('button');
    commitBtn.id = 'github-commit-btn';
    commitBtn.className = 'action-btn';
    commitBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Đẩy lên GitHub';
    commitBtn.addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn cập nhật dữ liệu VĐV lên GitHub không?')) {
            commitToGitHub();
        }
    });
    actionArea.appendChild(commitBtn);
}

// Function to export athlete data to JSON format for GitHub
function exportDataForGitHub() {
    // Create a formatted JSON object of all athlete data
    const exportData = {
        lastUpdated: new Date().toISOString(),
        totalAthletes: athletes.length,
        checkedInCount: athletes.filter(a => a.checkedIn).length,
        athletes: athletes.map(athlete => ({
            id: athlete.id,
            name: athlete.name,
            gender: athlete.gender,
            distance: athlete.distance,
            bib: athlete.bib,
            checkedIn: athlete.checkedIn,
            checkinTime: athlete.checkinTime,
            photoUrl: athlete.photoUrl
        }))
    };
            // Convert to JSON string with nice formatting
            const jsonData = JSON.stringify(exportData, null, 2);
            
            // Create a download link for the JSON file
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'athletes-data.json';
            a.click();
            
            URL.revokeObjectURL(url);
            
            showNotification('Đã xuất dữ liệu JSON thành công');
            console.log('Data exported for GitHub. You can now commit this file to your repository.');
        }
        
        // Function to commit athlete data directly to GitHub
        async function commitToGitHub() {
            // Show loading state
            showNotification('Đang cập nhật lên GitHub...', 'info');
            
            // Prepare the data
            const exportData = {
                lastUpdated: new Date().toISOString(),
                totalAthletes: athletes.length,
                checkedInCount: athletes.filter(a => a.checkedIn).length,
                athletes: athletes.map(athlete => ({
                    id: athlete.id,
                    name: athlete.name,
                    gender: athlete.gender,
                    distance: athlete.distance,
                    bib: athlete.bib,
                    checkedIn: athlete.checkedIn,
                    checkinTime: athlete.checkinTime,
                    photoUrl: athlete.photoUrl
                }))
            };
            
            // Convert to JSON string
            const content = JSON.stringify(exportData, null, 2);
            const contentEncoded = btoa(unescape(encodeURIComponent(content)));
            
            try {
                // First, get the current file SHA (if it exists)
                let sha;
                try {
                    const fileResponse = await fetch(
                        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`,
                        {
                            headers: {
                                'Authorization': `token ${GITHUB_TOKEN}`,
                                'Accept': 'application/vnd.github.v3+json'
                            }
                        }
                    );
                    
                    if (fileResponse.ok) {
                        const fileData = await fileResponse.json();
                        sha = fileData.sha;
                    }
                } catch (error) {
                    console.log('File does not exist yet, creating new file');
                }
                
                // Now commit the file
                const response = await fetch(
                    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${GITHUB_TOKEN}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: `Cập nhật dữ liệu VĐV - ${new Date().toLocaleString('vi-VN')}`,
                            content: contentEncoded,
                            branch: GITHUB_BRANCH,
                            sha
                        })
                    }
                );
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('Successfully committed to GitHub:', result);
                    showNotification('Đã cập nhật thành công lên GitHub!');
                } else {
                    const error = await response.json();
                    console.error('Error committing to GitHub:', error);
                    showNotification('Không thể cập nhật lên GitHub. Xem console để biết thêm chi tiết.', 'error');
                }
            } catch (error) {
                console.error('Exception when committing to GitHub:', error);
                showNotification('Lỗi kết nối tới GitHub API', 'error');
            }
        }
        
        // Use test data for development
        function useTestData() {
            const testData = [
                {id: "1", name: "Nguyễn Văn A", gender: "Nam", distance: "42K", bib: "A001", checkedIn: false, checkinTime: "", photoUrl: ""},
                {id: "2", name: "Trần Thị B", gender: "Nữ", distance: "21K", bib: "B002", checkedIn: true, checkinTime: "20/03/2025 08:15", photoUrl: "https://via.placeholder.com/150"},
                {id: "3", name: "Phạm Văn C", gender: "Nam", distance: "10K", bib: "C003", checkedIn: false, checkinTime: "", photoUrl: ""},
                {id: "4", name: "Lê Thị D", gender: "Nữ", distance: "5K", bib: "D004", checkedIn: true, checkinTime: "20/03/2025 07:45", photoUrl: "https://via.placeholder.com/150"},
                {id: "5", name: "Hoàng Văn E", gender: "Nam", distance: "42K", bib: "E005", checkedIn: false, checkinTime: "", photoUrl: ""}
            ];
        
            athletes = testData;
            filteredAthletes = [...athletes];
            updateResultsCount();
            renderAthletes();
            
            showNotification('Sử dụng dữ liệu test do không thể kết nối Google Sheets', 'info');
        }

        // Function to open the camera
        function openCamera() {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ video: true })
                    .then(stream => {
                        videoStream = stream;
                        webcamPreview.srcObject = stream;
                        webcamPreview.style.display = 'block';
                        capturedPhoto.style.display = 'none';
                        captureBtn.classList.remove('hidden');
                        retakeBtn.classList.add('hidden');
                        confirmBtn.classList.add('hidden');
                        modal.style.display = 'flex';
                    })
                    .catch(err => {
                        console.error('Error accessing the camera:', err);
                        showNotification('Không thể truy cập camera. Vui lòng kiểm tra cài đặt của bạn.', 'error');
                    });
            } else {
                showNotification('Trình duyệt của bạn không hỗ trợ truy cập camera.', 'error');
            }
        }

        // Function to capture a photo
        function capturePhoto() {
            const canvas = document.createElement('canvas');
            canvas.width = webcamPreview.videoWidth;
            canvas.height = webcamPreview.videoHeight;
            const context = canvas.getContext('2d');
            context.drawImage(webcamPreview, 0, 0, canvas.width, canvas.height);
            capturedImageURL = canvas.toDataURL('image/png');
            capturedPhoto.src = capturedImageURL;
            webcamPreview.style.display = 'none';
            capturedPhoto.style.display = 'block';
            captureBtn.classList.add('hidden');
            retakeBtn.classList.remove('hidden');
            confirmBtn.classList.remove('hidden');
        }

        // Function to retake the photo
        function retakePhoto() {
            webcamPreview.style.display = 'block';
            capturedPhoto.style.display = 'none';
            captureBtn.classList.remove('hidden');
            retakeBtn.classList.add('hidden');
            confirmBtn.classList.add('hidden');
            capturedImageURL = '';
        }

        // Function to confirm the photo
        function confirmPhoto() {
            if (selectedAthleteId) {
                checkInAthlete(selectedAthleteId);
                closeModal();
            } else {
                showNotification('Không tìm thấy ID vận động viên. Vui lòng thử lại.', 'error');
            }
        }

        // Function to close the modal
        function closeModal() {
            modal.style.display = 'none';
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
                videoStream = null;
            }
            selectedAthleteId = null;
            capturedImageURL = '';
        }
