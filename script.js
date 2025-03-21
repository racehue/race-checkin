// Google Sheets API setup
const SHEET_ID = '1kdt68gFOrTyirvo69oRDpAJDM7y_iGxvXM3HLDb57kw';
const API_KEY = 'AIzaSyAMjzUR6DiIiSBkxaqtohn4YJqlm9njUu0'; // Thay bằng API key của bạn
const SHEET_NAME = 'athletes';
const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec';

// Global variables
let athletes = [];
let filteredAthletes = [];
let selectedDistance = 'all';
let selectedGender = 'all';
let currentAthleteId = null;

document.addEventListener('DOMContentLoaded', () => {
    const athletesList = document.getElementById('athletes-list');
    const searchInput = document.getElementById('search-input');
    const refreshBtn = document.getElementById('refresh-btn');
    const checkinBtn = document.getElementById('checkin-btn');

    fetchAthletes();
    setupEventListeners();
});

// Fetch athletes data from Google Sheets
function fetchAthletes() {
    fetch(API_URL)
        .then(response => response.json())
        .then(data => {
            processData(data.values);
            renderAthletes();
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            useTestData();
        });
}

// Process the data from Google Sheets
function processData(values) {
    const headers = values[0];
    athletes = [];
    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row || row.length === 0) continue;
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
    const resultsCount = document.getElementById('results-count');
    if (resultsCount) {
        resultsCount.textContent = `[${filteredAthletes.length}/${athletes.length}]`;
    }
}

// Render athletes list
function renderAthletes() {
    const athletesList = document.getElementById('athletes-list');
    if (!athletesList) return;
    athletesList.innerHTML = '';
    filteredAthletes.forEach(athlete => {
        const card = document.createElement('div');
        card.className = 'athlete-card';
        if (athlete.checkedIn) {
            card.classList.add('checked-in');
        }
        card.dataset.id = athlete.id;
        card.innerHTML = `
            <div class="athlete-photo">
                <img src="${athlete.photoUrl || 'placeholder.jpg'}" alt="${athlete.name}" onerror="this.src='placeholder.jpg'">
            </div>
            <div class="athlete-info">
                <div class="athlete-name">${athlete.name}</div>
                <div class="athlete-bib">${athlete.bib || 'No BIB'}</div>
                <div class="checkin-status ${athlete.checkedIn ? 'checked' : ''}">${athlete.checkedIn ? 'Đã check in' : 'Chưa check in'}</div>
            </div>
        `;
        athletesList.appendChild(card);
    });
}

// Check in selected athlete
function checkInAthlete(athleteId) {
    showPhotoModal(athleteId);
}

// Show modal for capturing photo
function showPhotoModal(athleteId) {
    const modal = document.getElementById('photo-modal');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const captureBtn = document.getElementById('capture-btn');
    const confirmBtn = document.getElementById('confirm-btn');
    const closeBtn = document.querySelector('.close-btn');

    currentAthleteId = athleteId;

    modal.style.display = 'block';

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            video.play();
        })
        .catch(error => {
            console.error('Error accessing camera:', error);
            alert('Không thể truy cập camera.');
            modal.style.display = 'none';
        });

    captureBtn.addEventListener('click', () => {
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        video.style.display = 'none';
        canvas.style.display = 'block';
        captureBtn.style.display = 'none';
        confirmBtn.style.display = 'inline-block';
    });

    confirmBtn.addEventListener('click', () => {
        const photoUrl = canvas.toDataURL('image/png');
        savePhotoToGoogleSheet(photoUrl);
        modal.style.display = 'none';
        resetModal(video, canvas, captureBtn, confirmBtn);
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        resetModal(video, canvas, captureBtn, confirmBtn);
    });
}

// Save photo URL to Google Sheet
function savePhotoToGoogleSheet(photoUrl) {
    const now = new Date();
    const timeString = formatDate(now);

    const athlete = athletes.find(a => a.id === currentAthleteId);
    if (athlete) {
        athlete.photoUrl = photoUrl;
        athlete.checkedIn = true;
        athlete.checkinTime = timeString;
    }

    fetch(`${WEBAPP_URL}?id=${currentAthleteId}&time=${encodeURIComponent(timeString)}&photoUrl=${encodeURIComponent(photoUrl)}`)
        .then(response => response.json())
        .then(data => {
            console.log('Update successful:', data);
            renderAthletes();
            showNotification('Check-in thành công');
        })
        .catch(error => {
            console.error('Error updating sheet:', error);
            showNotification('Lỗi khi cập nhật Google Sheet', 'error');
        });
}

// Reset modal state
function resetModal(video, canvas, captureBtn, confirmBtn) {
    const stream = video.srcObject;
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
    }
    video.style.display = 'block';
    canvas.style.display = 'none';
    captureBtn.style.display = 'inline-block';
    confirmBtn.style.display = 'none';
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

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fadeout');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Setup all event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const refreshBtn = document.getElementById('refresh-btn');
    const checkinBtn = document.getElementById('checkin-btn');
    const athletesList = document.getElementById('athletes-list');

    searchInput.addEventListener('input', filterAthletes);
    refreshBtn.addEventListener('click', fetchAthletes);

    checkinBtn.addEventListener('click', () => {
        const selectedCards = document.querySelectorAll('.athlete-card.selected');
        if (selectedCards.length === 0) {
            showNotification('Vui lòng chọn VĐV để check-in', 'error');
            return;
        }
        selectedCards.forEach(card => {
            checkInAthlete(card.dataset.id);
            card.classList.remove('selected');
        });
    });

    athletesList.addEventListener('click', (e) => {
        const card = e.target.closest('.athlete-card');
        if (card) {
            card.classList.toggle('selected');
        }
    });
}
