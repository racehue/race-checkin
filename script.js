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
const GITHUB_TOKEN = 'ghp_11BQPVGFI0zOa7bCH0l1Bp_u0OlKmIACymFgikVSoTKHaTKonB7a7nr8EuYck1ZHpVTHPKOH2AeiL43Mnk'; // Replace with your actual token
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
let isOnline = true; // Track network status
let db; // IndexedDB database object
const DB_NAME = 'raceCheckinDB';
const DB_VERSION = 1;
// DOM elements
const searchInput = document.getElementById('search-input');
const refreshBtn = document.getElementById('refresh-btn');
const checkinBtn = document.getElementById('checkin-btn');
const distanceFilterBtns = document.querySelectorAll('.distance-filter-btn');
const genderFilterBtns = document.querySelectorAll('.gender-filter-btn');
const athletesList = document.getElementById('athletes-list');
const noResultsMessage = document.getElementById('no-results');
const resultsCount = document.getElementById('results-count');
const photoModal = document.getElementById('photo-modal');
const closeModalBtn = document.getElementById('close-modal');
const webcamPreview = document.getElementById('webcam-preview');
const photoCanvas = document.getElementById('photo-canvas'); // Get the canvas element
const capturedPhoto = document.getElementById('captured-photo');
const captureBtn = document.getElementById('capture-btn');
const retakeBtn = document.getElementById('retake-btn');
const confirmBtn = document.getElementById('confirm-btn');
const photoFeedback = document.getElementById('photo-feedback');
// Helper Functions
/**
 * Displays a notification message to the user.
 * @param {string} message - The message to display.
 * @param {string} type - The type of notification ('success', 'error', 'warning').
 */
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000);
}
/**
 * Debounces a function to prevent it from being called too frequently.
 * @param {function} func - The function to debounce.
 * @param {number} delay - The delay in milliseconds.
 * @returns {function} The debounced function.
 */
function debounce(func, delay = 300) {
    let timeoutId;
    return (...args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func(...args);
        }, delay);
    };
}
/**
 * Renders the list of athletes based on the current filters and search query.
 */
function renderAthletes() {
    athletesList.innerHTML = '';
    const searchTerm = searchInput.value.toLowerCase();
    filteredAthletes = athletes.filter(athlete => {
        const searchMatch =
            athlete.bib.toLowerCase().includes(searchTerm) ||
            athlete.name.toLowerCase().includes(searchTerm);
        const distanceMatch =
            selectedDistance === 'all' || athlete.distance === selectedDistance;
        const genderMatch =
            selectedGender === 'all' || athlete.gender === selectedGender;
        return searchMatch && distanceMatch && genderMatch;
    });
    filteredAthletes.forEach(athlete => {
        const athleteCard = document.createElement('div');
        athleteCard.classList.add('athlete-card', 'bg-white', 'rounded-md', 'shadow-sm', 'p-4', 'flex', 'items-center', 'justify-between', 'transition-all', 'duration-200', 'hover:shadow-md');
        if (selectedAthleteId === athlete.id) {
            athleteCard.classList.add('selected');
        }
        athleteCard.innerHTML = `
            <div>
                <div class="font-semibold text-lg text-blue-600">${athlete.name}</div>
                <div class="text-gray-600 text-sm">BIB: <span class="font-mono">${athlete.bib}</span></div>
                <div class="text-gray-500 text-xs">Distance: <span class="font-medium">${athlete.distance}</span></div>
                <div class="text-gray-500 text-xs">Gender: <span class="font-medium">${athlete.gender}</span></div>
                <div class="text-gray-500 text-xs">Check-in: <span class="${athlete.checkedIn ? 'text-green-600' : 'text-red-600'} font-medium">${athlete.checkedIn ? 'Yes' : 'No'}</span></div>
            </div>
            <div class="flex gap-2">
                <img src="${athlete.photo || 'placeholder.png'}" alt="Athlete Photo" class="w-16 h-16 rounded-md object-cover">
                <button class="checkin-button action-btn bg-yellow-500 hover:bg-yellow-600 text-gray-800 font-semibold rounded-md shadow-md transition-all duration-200 px-3 py-1.5 flex items-center gap-1.5" data-athlete-id="${athlete.id}">
                    <i class="fas fa-check-circle"></i> <span class="hidden sm:inline">Check-in</span>
                </button>
            </div>
        `;
        const checkinButton = athleteCard.querySelector('.checkin-button');
        checkinButton.addEventListener('click', () => {
            selectedAthleteId = athlete.id;
            renderAthletes(); // Re-render to highlight selected athlete
            openPhotoModal();
        });
        athletesList.appendChild(athleteCard);
    });
    resultsCount.textContent = `[${filteredAthletes.length}/${athletes.length}]`;
    noResultsMessage.classList.toggle('hidden', filteredAthletes.length > 0);
}
/**
 * Opens the photo capture modal.
 */
function openPhotoModal() {
    photoModal.classList.remove('hidden');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: 'user' } })
            .then(stream => {
                videoStream = stream;
                webcamPreview.srcObject = stream;
                webcamPreview.classList.remove('hidden');
                photoCanvas.classList.add('hidden'); // Hide the canvas
                capturedPhoto.classList.add('hidden');
                captureBtn.classList.remove('hidden');
                retakeBtn.classList.add('hidden');
                confirmBtn.classList.add('hidden');
                photoFeedback.classList.add('hidden');
            })
            .catch(error => {
                console.error('Error accessing webcam:', error);
                showNotification('Không thể truy cập webcam. Vui lòng kiểm tra kết nối và cho phép truy cập.', 'error');
                photoFeedback.textContent = 'Không thể truy cập webcam.';
                photoFeedback.classList.remove('hidden');
            });
    } else {
        showNotification('Trình duyệt của bạn không hỗ trợ truy cập webcam.', 'error');
        photoFeedback.textContent = 'Không hỗ trợ webcam.';
        photoFeedback.classList.remove('hidden');
    }
}
/**
 * Closes the photo capture modal and stops the webcam stream.
 */
function closePhotoModal() {
    photoModal.classList.add('hidden');
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    selectedAthleteId = null; // Reset selection
    renderAthletes();
}
/**
 * Captures a photo from the webcam stream using a canvas.
 */
function capturePhoto() {
    const context = photoCanvas.getContext('2d');
    // Set canvas dimensions to match video
    photoCanvas.width = webcamPreview.videoWidth;
    photoCanvas.height = webcamPreview.videoHeight;
    context.drawImage(webcamPreview, 0, 0, photoCanvas.width, photoCanvas.height);
    capturedImageURL = photoCanvas.toDataURL('image/png'); // Get image data URL from canvas
    capturedPhoto.src = capturedImageURL;
    webcamPreview.classList.add('hidden');
    photoCanvas.classList.remove('hidden'); // Show the canvas
    capturedPhoto.classList.remove('hidden');
    captureBtn.classList.add('hidden');
    retakeBtn.classList.remove('hidden');
    confirmBtn.classList.remove('hidden');
    photoFeedback.classList.add('hidden');
}
/**
 * Retakes the photo, restarting the webcam stream.
 */
function retakePhoto() {
    if (videoStream) {
        webcamPreview.classList.remove('hidden');
        photoCanvas.classList.add('hidden'); // Hide the canvas
        capturedPhoto.classList.add('hidden');
        captureBtn.classList.remove('hidden');
        retakeBtn.classList.add('hidden');
        confirmBtn.classList.add('hidden');
        photoFeedback.classList.add('hidden');
    } else {
        openPhotoModal(); // Re-initialize the webcam stream
    }
}
/**
 * Confirms the photo and updates the athlete's data.
 */
function confirmPhoto() {
    if (!selectedAthleteId) {
        showNotification('Vui lòng chọn vận động viên trước khi xác nhận.', 'error');
        return;
    }
    const athleteToUpdate = athletes.find(a => a.id === selectedAthleteId);
    if (athleteToUpdate) {
        athleteToUpdate.checkedIn = true;
        athleteToUpdate.photo = capturedImageURL;
        updateAthleteData(athleteToUpdate); // Update in Google Sheets
        saveAthleteData(athletes); // Save to local storage
        renderAthletes();
        closePhotoModal();
        showNotification(`Check-in thành công cho ${athleteToUpdate.name}!`, 'success');
    } else {
        showNotification('Không tìm thấy vận động viên. Vui lòng thử lại.', 'error');
    }
}
/**
 * Updates the athlete's data in the Google Sheets.
 * @param {object} athlete - The athlete object to update.
 */
function updateAthleteData(athlete) {
    if (!isOnline) {
        console.warn('Offline: Data update will be queued.');
        // Store the update for later synchronization
        let queuedUpdates = JSON.parse(localStorage.getItem('queuedUpdates')) || [];
        queuedUpdates.push({
            id: athlete.id,
            checkedIn: athlete.checkedIn,
            photo: athlete.photo,
        });
        localStorage.setItem('queuedUpdates', JSON.stringify(queuedUpdates));
        return; // Stop,  online.
    }
    const data = {
        id: athlete.id,
        checkedIn: athlete.checkedIn,
        photo: athlete.photo,
    };
    fetch(WEBAPP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'updateAthlete', data }),
    })
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                console.log('Athlete data updated successfully in Google Sheets.');
                // Update in IndexedDB
                if (db) {
                    const transaction = db.transaction(['athletes'], 'readwrite');
                    const store = transaction.objectStore('athletes');
                    const request = store.put(athlete);
                    request.onsuccess = () => {
                        console.log('Athlete data updated successfully in IndexedDB.');
                    };
                    request.onerror = () => {
                        console.error('Error updating athlete data in IndexedDB:', request.error);
                    };
                }
            } else {
                console.error('Error updating athlete data in Google Sheets:', result.message);
                showNotification('Lỗi khi cập nhật dữ liệu vận động viên. Vui lòng thử lại.', 'error');
            }
        })
        .catch(error => {
            console.error('Error sending update request:', error);
            showNotification('Lỗi khi gửi yêu cầu cập nhật dữ liệu. Vui lòng kiểm tra kết nối mạng.', 'error');
        });
}
/**
 * Saves the athlete data to local storage.
 * @param {array} data - The array of athlete objects.
 */
function saveAthleteData(data) {
    try {
        localStorage.setItem('athleteData', JSON.stringify(data));
    } catch (error) {
        console.error('Error saving athlete data to local storage:', error);
        showNotification('Lỗi khi lưu dữ liệu vào bộ nhớ cục bộ. Một số chức năng có thể không hoạt động.', 'warning');
    }
}
/**
 * Loads the athlete data from local storage.
 * @returns {array} The array of athlete objects, or an empty array if no data is found.
 */
function loadAthleteData() {
    try {
        const data = localStorage.getItem('athleteData');
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error loading athlete data from local storage:', error);
        showNotification('Lỗi khi tải dữ liệu từ bộ nhớ cục bộ.', 'error');
        return [];
    }
}
/**
  * Initializes the IndexedDB database.
  */
function initDatabase() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => {
        console.error("Database error: " + event.target.errorCode);
        showNotification('Lỗi khi khởi tạo cơ sở dữ liệu cục bộ.', 'error');
    };
    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('IndexedDB database initialized.');
        loadInitialData(); // Load data after DB is ready
    };
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Create the athletes object store if it doesn't exist
        if (!db.objectStoreNames.contains('athletes')) {
            const objectStore = db.createObjectStore('athletes', { keyPath: 'id' });
            objectStore.createIndex('bib', 'bib', { unique: true }); // Index for searching by BIB
            objectStore.createIndex('name', 'name', { unique: false }); // Index for searching by name
            objectStore.createIndex('distance', 'distance', { unique: false }); // Index for filtering
            objectStore.createIndex('gender', 'gender', { unique: false });       // Index for filtering
            objectStore.createIndex('checkedIn', 'checkedIn', { unique: false }); // Index for filtering
        }
        console.log('Database upgrade completed.');
    };
}
/**
 * Fetches athlete data from Google Sheets API.
 */
function fetchAthleteData() {
    if (!isOnline) {
        showNotification('Bạn đang ở chế độ ngoại tuyến. Dữ liệu có thể không được cập nhật.', 'warning');
        return;
    }
    showNotification('Đang tải dữ liệu vận động viên...', 'info');
    fetch(API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.values && data.values.length > 0) {
                // Clear existing data
                athletes = [];
                const headerRow = data.values[0];
                for (let i = 1; i < data.values.length; i++) {
                    const row = data.values[i];
                    if (row.length !== headerRow.length) {
                        console.warn(`Row ${i + 1} has inconsistent number of columns. Skipping.`);
                        continue;
                    }
                    try {
                        const athlete = {
                            id: parseInt(row[0]),
                            bib: row[1],
                            name: row[2],
                            gender: row[3],
                            distance: row[4],
                            checkedIn: row[5] === 'TRUE',
                            photo: row[6] || '', // Photo URL
                        };
                        athletes.push(athlete);
                    } catch (e) {
                         console.error(`Error parsing row ${i + 1}:`, e, row);
                         showNotification(`Dữ liệu ở hàng ${i + 1} không hợp lệ và đã bị bỏ qua.`, 'error');
                    }
                }
                // Save to local storage and IndexedDB
                saveAthleteData(athletes);
                if (db) {
                    const transaction = db.transaction(['athletes'], 'readwrite');
                    const store = transaction.objectStore('athletes');
                    store.clear(); // Clear old data
                    athletes.forEach(athlete => {
                        store.add(athlete);
                    });
                    transaction.oncomplete = () => {
                        console.log('Athlete data loaded into IndexedDB.');
                        renderAthletes();
                        showNotification('Dữ liệu vận động viên đã được cập nhật.', 'success');
                    };
                    transaction.onerror = () => {
                         console.error('Error loading athlete data into IndexedDB:', transaction.error);
                         showNotification('Lỗi khi lưu dữ liệu vận động viên vào cơ sở dữ liệu cục bộ.', 'error');
                    }
                 } else {
                    renderAthletes();
                    showNotification('Dữ liệu vận động viên đã được cập nhật.', 'success');
                 }
            } else {
                showNotification('Không có dữ liệu vận động viên.', 'warning');
            }
        })
        .catch(error => {
            console.error('Error fetching athlete data:', error);
            showNotification('Không thể tải dữ liệu vận động viên. Vui lòng kiểm tra kết nối mạng.', 'error');
        });
}
/**
 * Loads initial data from IndexedDB or Google Sheets.
 */
function loadInitialData() {
    if (db) {
        const transaction = db.transaction(['athletes'], 'readonly');
        const store = transaction.objectStore('athletes');
        const countRequest = store.count();
        countRequest.onsuccess = () => {
            if (countRequest.result > 0) {
                // Data exists in IndexedDB, load from there
                const getAllRequest = store.getAll();
                getAllRequest.onsuccess = () => {
                    athletes = getAllRequest.result;
                    console.log('Athlete data loaded from IndexedDB.');
                    renderAthletes();
                };
                getAllRequest.onerror = () => {
                    console.error('Error loading athlete data from IndexedDB:', getAllRequest.error);
                    showNotification('Lỗi khi tải dữ liệu vận động viên từ cơ sở dữ liệu cục bộ.', 'error');
                    fetchAthleteData(); // Fallback to fetch from Google Sheets
                };
            } else {
                // No data in IndexedDB, fetch from Google Sheets
                fetchAthleteData();
            }
        };
        countRequest.onerror = () => {
            console.error('Error counting records in IndexedDB:', countRequest.error);
            showNotification('Lỗi khi truy vấn cơ sở dữ liệu cục bộ.', 'error');
            fetchAthleteData(); // Fallback to fetch from Google Sheets
        };
    } else {
        fetchAthleteData(); // If DB is not ready, fetch from Google Sheets
    }
}
/**
 * Handles the check-in process for an athlete.
 * @param {number} athleteId - The ID of the athlete to check in.
 */
function handleCheckin(athleteId) {
    selectedAthleteId = athleteId; // Set the selected athlete ID
    openPhotoModal(); // Open the photo modal
}
// Event Listeners
searchInput.addEventListener('input', debounce(renderAthletes));
refreshBtn.addEventListener('click', () => {
    fetchAthleteData();
    showNotification('Đang làm mới dữ liệu...', 'info');
});
checkinBtn.addEventListener('click', () => {
    if (selectedAthleteId) {
        openPhotoModal();
    } else {
        showNotification('Vui lòng chọn vận động viên để check-in.', 'warning');
    }
});
distanceFilterBtns.forEach(button => {
    button.addEventListener('click', function() {
        selectedDistance = this.dataset.filter;
        distanceFilterBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        renderAthletes();
    });
});
genderFilterBtns.forEach(button => {
    button.addEventListener('click', function() {
        selectedGender = this.dataset.gender;
        genderFilterBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        renderAthletes();
    });
});
closeModalBtn.addEventListener('click', closePhotoModal);
captureBtn.addEventListener('click', capturePhoto);
retakeBtn.addEventListener('click', retakePhoto);
confirmBtn.addEventListener('click', confirmPhoto);
// Event listener for online/offline status
window.addEventListener('online', () => {
    isOnline = true;
    showNotification('Bạn đã kết nối mạng trở lại.', 'success');
    // Sync queued updates
    const queuedUpdates = JSON.parse(localStorage.getItem('queuedUpdates')) || [];
    queuedUpdates.forEach(update => {
        const athleteToUpdate = athletes.find(a => a.id === update.id);
         if (athleteToUpdate) {
            athleteToUpdate.checkedIn = update.checkedIn;
            athleteToUpdate.photo = update.photo;
            updateAthleteData(athleteToUpdate); // Send update to Google Sheets
         }
    });
    localStorage.removeItem('queuedUpdates'); // Clear the queue
    // Refresh data
    fetchAthleteData();
});
window.addEventListener('offline', () => {
    isOnline = false;
    showNotification('Bạn đang ở chế độ ngoại tuyến. Một số chức năng có thể bị hạn chế.', 'warning');
});
// Initialize
initDatabase();
