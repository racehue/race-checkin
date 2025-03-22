// Google Sheets API setup
const SHEET_ID = 'YOUR_SHEET_ID'; // Thay bằng ID của Google Sheet
const API_KEY = 'YOUR_API_KEY'; // Thay bằng Google API Key
const SHEET_NAME = 'athletes';
const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;
// GitHub repository details
const GITHUB_OWNER = 'YOUR_GITHUB_USERNAME'; // Thay bằng username GitHub
const GITHUB_REPO = 'YOUR_REPOSITORY_NAME'; // Thay bằng tên repository
const GITHUB_PATH = 'data/athletes.json';
const GITHUB_DATA_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${GITHUB_PATH}`;
// Web App URL for Google Sheets (Google Apps Script)
const WEBAPP_URL = 'YOUR_WEBAPP_URL'; // Thay bằng URL của Google Apps Script Web App

// Global variables
let athletes = [];
let filteredAthletes = [];
let selectedDistance = 'all';
let selectedGender = 'all';
let selectedAthleteId = null;
let capturedImageURL = '';
let videoStream = null;
let isOnline = navigator.onLine;
let db;
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
const photoCanvas = document.getElementById('photo-canvas');
const capturedPhoto = document.getElementById('captured-photo');
const captureBtn = document.getElementById('capture-btn');
const retakeBtn = document.getElementById('retake-btn');
const confirmBtn = document.getElementById('confirm-btn');
const photoFeedback = document.getElementById('photo-feedback');

// Helper Functions
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    const iconClass = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    }[type] || 'fas fa-info-circle';
    notification.innerHTML = `<i class="${iconClass}"></i> ${message}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function debounce(func, delay = 300) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

function renderAthletes() {
    athletesList.innerHTML = '';
    const searchTerm = searchInput.value.toLowerCase();
    filteredAthletes = athletes.filter(athlete => {
        const searchMatch = athlete.bib.toLowerCase().includes(searchTerm) || athlete.name.toLowerCase().includes(searchTerm);
        const distanceMatch = selectedDistance === 'all' || athlete.distance === selectedDistance;
        const genderMatch = selectedGender === 'all' || athlete.gender === selectedGender;
        return searchMatch && distanceMatch && genderMatch;
    });
    filteredAthletes.forEach(athlete => {
        const athleteCard = document.createElement('div');
        athleteCard.classList.add('athlete-card', 'bg-white', 'rounded-md', 'shadow-sm', 'p-4', 'flex', 'items-center', 'justify-between', 'transition-all', 'duration-200', 'hover:shadow-md');
        if (selectedAthleteId === athlete.id) athleteCard.classList.add('selected');
        athleteCard.innerHTML = `
            <div>
                <div class="font-semibold text-lg text-blue-600">${athlete.name}</div>
                <div class="text-gray-600 text-sm">BIB: <span class="font-mono">${athlete.bib}</span></div>
                <div class="text-gray-500 text-xs">Distance: <span class="font-medium">${athlete.distance}</span></div>
                <div class="text-gray-500 text-xs">Gender: <span class="font-medium">${athlete.gender}</span></div>
                <div class="text-gray-500 text-xs">Check-in: <span class="${athlete.checkedIn ? 'text-green-600' : 'text-red-600'} font-medium">${athlete.checkedIn ? 'Yes' : 'No'}</span></div>
            </div>
            <div class="flex gap-2">
                <img src="${athlete.photo || 'placeholder.png'}" alt="Ảnh của ${athlete.name}" class="w-16 h-16 rounded-md object-cover">
                <button class="checkin-button action-btn bg-yellow-500 hover:bg-yellow-600 text-gray-800 font-semibold rounded-md shadow-md transition-all duration-200 px-3 py-1.5 flex items-center gap-1.5" data-athlete-id="${athlete.id}" aria-label="Check-in cho ${athlete.name}" ${athlete.checkedIn ? 'disabled' : ''}>
                    <i class="fas fa-check-circle"></i> <span class="hidden sm:inline">Check-in</span>
                </button>
            </div>
        `;
        const checkinButton = athleteCard.querySelector('.checkin-button');
        if (!athlete.checkedIn) {
            checkinButton.addEventListener('click', () => {
                selectedAthleteId = athlete.id;
                renderAthletes();
                openPhotoModal();
            });
        }
        athletesList.appendChild(athleteCard);
    });
    resultsCount.textContent = `[${filteredAthletes.length}/${athletes.length}]`;
    noResultsMessage.classList.toggle('hidden', filteredAthletes.length > 0);
}

function openPhotoModal() {
    photoModal.classList.remove('hidden');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
            .then(stream => {
                videoStream = stream;
                webcamPreview.srcObject = stream;
                webcamPreview.classList.remove('hidden');
                capturedPhoto.classList.add('hidden');
                captureBtn.classList.remove('hidden');
                retakeBtn.classList.add('hidden');
                confirmBtn.classList.add('hidden');
                photoFeedback.classList.add('hidden');
            })
            .catch(error => {
                console.error('Error accessing webcam:', error);
                showNotification('Lỗi truy cập webcam. Vui lòng kiểm tra quyền truy cập.', 'error');
                photoFeedback.textContent = 'Không thể truy cập webcam. Vui lòng kiểm tra thiết bị và quyền truy cập.';
                photoFeedback.classList.remove('hidden');
            });
    }
}

function closePhotoModal() {
    photoModal.classList.add('hidden');
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    selectedAthleteId = null;
    renderAthletes();
}

function capturePhoto() {
    const context = photoCanvas.getContext('2d');
    photoCanvas.width = webcamPreview.videoWidth;
    photoCanvas.height = webcamPreview.videoHeight;
    context.drawImage(webcamPreview, 0, 0, photoCanvas.width, photoCanvas.height);
    capturedImageURL = photoCanvas.toDataURL('image/png');
    capturedPhoto.src = capturedImageURL;
    webcamPreview.classList.add('hidden');
    capturedPhoto.classList.remove('hidden');
    captureBtn.classList.add('hidden');
    retakeBtn.classList.remove('hidden');
    confirmBtn.classList.remove('hidden');
}

function retakePhoto() {
    webcamPreview.classList.remove('hidden');
    capturedPhoto.classList.add('hidden');
    captureBtn.classList.remove('hidden');
    retakeBtn.classList.add('hidden');
    confirmBtn.classList.add('hidden');
}

function confirmPhoto() {
    if (!selectedAthleteId) {
        showNotification('Vui lòng chọn vận động viên trước khi xác nhận.', 'error');
        return;
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Đang xác nhận...';
    const athleteToUpdate = athletes.find(a => a.id === selectedAthleteId);
    if (athleteToUpdate) {
        athleteToUpdate.checkedIn = true;
        athleteToUpdate.photo = capturedImageURL;
        updateAthleteData(athleteToUpdate)
            .then(() => {
                saveAthleteData(athletes);
                renderAthletes();
                closePhotoModal();
                showNotification(`Check-in thành công cho ${athleteToUpdate.name}!`, 'success');
            })
            .catch(() => showNotification('Lỗi khi check-in. Vui lòng thử lại.', 'error'))
            .finally(() => {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Xác nhận';
            });
    }
}

function updateAthleteData(athlete) {
    if (!isOnline) {
        let queuedUpdates = JSON.parse(localStorage.getItem('queuedUpdates')) || [];
        queuedUpdates.push({ id: athlete.id, checkedIn: athlete.checkedIn, photo: athlete.photo });
        localStorage.setItem('queuedUpdates', JSON.stringify(queuedUpdates));
        return Promise.resolve();
    }
    const data = { id: athlete.id, checkedIn: athlete.checkedIn, photo: athlete.photo };
    return fetch(WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateAthlete', data })
    })
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                if (db) {
                    const transaction = db.transaction(['athletes'], 'readwrite');
                    const store = transaction.objectStore('athletes');
                    store.put(athlete);
                }
            } else {
                throw new Error(result.message);
            }
        });
}

function saveAthleteData(data) {
    localStorage.setItem('athleteData', JSON.stringify(data));
}

function loadAthleteData() {
    const data = localStorage.getItem('athleteData');
    return data ? JSON.parse(data) : [];
}

function initDatabase() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = (event) => {
        db = event.target.result;
        loadInitialData();
    };
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('athletes')) {
            const store = db.createObjectStore('athletes', { keyPath: 'id' });
            store.createIndex('bib', 'bib', { unique: true });
        }
    };
}

function fetchAthleteData() {
    if (!isOnline) {
        showNotification('Chế độ ngoại tuyến. Dữ liệu có thể không mới.', 'warning');
        return Promise.resolve();
    }
    refreshBtn.disabled = true;
    refreshBtn.querySelector('.fa-sync').classList.add('hidden');
    refreshBtn.querySelector('.fa-spinner').classList.remove('hidden');
    return fetch(GITHUB_DATA_URL) // Fetch từ GitHub thay vì Google Sheets trực tiếp
        .then(response => response.json())
        .then(data => {
            athletes = data.map((row, i) => ({
                id: parseInt(row[0]),
                bib: row[1],
                name: row[2],
                gender: row[3],
                distance: row[4],
                checkedIn: row[5] === 'TRUE',
                photo: row[6] || ''
            }));
            saveAthleteData(athletes);
            if (db) {
                const transaction = db.transaction(['athletes'], 'readwrite');
                const store = transaction.objectStore('athletes');
                store.clear();
                athletes.forEach(athlete => store.add(athlete));
            }
            renderAthletes();
            showNotification('Dữ liệu đã được cập nhật từ GitHub.', 'success');
        })
        .catch(() => {
            showNotification('Lỗi tải dữ liệu từ GitHub. Vui lòng kiểm tra mạng.', 'error');
        })
        .finally(() => {
            refreshBtn.disabled = false;
            refreshBtn.querySelector('.fa-sync').classList.remove('hidden');
            refreshBtn.querySelector('.fa-spinner').classList.add('hidden');
        });
}

function loadInitialData() {
    if (db) {
        const transaction = db.transaction(['athletes'], 'readonly');
        const store = transaction.objectStore('athletes');
        const request = store.getAll();
        request.onsuccess = () => {
            athletes = request.result.length ? request.result : loadAthleteData();
            renderAthletes();
        };
        request.onerror = () => fetchAthleteData();
    } else {
        athletes = loadAthleteData();
        renderAthletes();
    }
}

// Event Listeners
searchInput.addEventListener('input', debounce(renderAthletes));
refreshBtn.addEventListener('click', fetchAthleteData);
checkinBtn.addEventListener('click', () => {
    if (selectedAthleteId) openPhotoModal();
    else showNotification('Vui lòng chọn vận động viên để check-in.', 'warning');
});
distanceFilterBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        selectedDistance = this.dataset.filter;
        distanceFilterBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        renderAthletes();
    });
});
genderFilterBtns.forEach(btn => {
    btn.addEventListener('click', function() {
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
window.addEventListener('online', () => {
    isOnline = true;
    showNotification('Đã kết nối mạng trở lại.', 'success');
    const queuedUpdates = JSON.parse(localStorage.getItem('queuedUpdates')) || [];
    Promise.all(queuedUpdates.map(update => {
        const athlete = athletes.find(a => a.id === update.id);
        if (athlete) {
            athlete.checkedIn = update.checkedIn;
            athlete.photo = update.photo;
            return updateAthleteData(athlete);
        }
        return Promise.resolve();
    })).then(() => {
        localStorage.removeItem('queuedUpdates');
        fetchAthleteData();
    });
});
window.addEventListener('offline', () => {
    isOnline = false;
    showNotification('Chế độ ngoại tuyến. Chức năng bị hạn chế.', 'warning');
});

// Initialize
initDatabase();
