// Global Variables
const SHEET_ID = '1kdt68gFOrTyirvo69oRDpAJDM7y_iGxvXM3HLDb57kw'; // Thay bằng ID bảng tính Google Sheets
const API_KEY = 'AIzaSyAMjzUR6DiIiSBkxaqtohn4YJqlm9njUu0'; // Thay bằng API Key của bạn
const GITHUB_OWNER = 'racehue'; // Thay bằng username GitHub của bạn
const GITHUB_REPO = 'race-check-in'; // Thay bằng tên repo
const GITHUB_PATH = 'data/athletes.json'; // Đường dẫn trong repo
const GITHUB_BRANCH = 'main'; // Nhánh GitHub
const GITHUB_TOKEN = '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'; // Thay bằng Personal Access Token
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec'; // Thay bằng Web App URL

let athletes = [];
let filteredAthletes = [];
let selectedDistance = 'all';
let selectedGender = 'all';
let currentAthleteId = null;

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    fetchAthletes();
    setupEventListeners();
});

// Fetch athletes data from Google Sheets
async function fetchAthletes() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Athletes?key=${API_KEY}`);
        const data = await response.json();
        processData(data.values);
        renderAthletes();
    } catch (error) {
        console.error('Error fetching data:', error);
        useTestData();
    }
}

// Process the data from Google Sheets
function processData(values) {
    const headers = values[0];
    athletes = values.slice(1).map(row => ({
        id: row[0],
        name: row[1],
        gender: row[2],
        distance: row[3],
        bib: row[4],
        checkedIn: row[5] === 'true',
        checkinTime: row[6] || '',
        photoUrl: row[7] || ''
    }));
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
        card.className = `athlete-card ${athlete.checkedIn ? 'checked-in' : ''}`;
        card.dataset.id = athlete.id;
        card.innerHTML = `
            <div class="athlete-photo">
                <img src="${athlete.photoUrl || 'placeholder.jpg'}" alt="${athlete.name}" onerror="this.src='placeholder.jpg'">
            </div>
            <div class="athlete-info">
                <div class="athlete-name">${athlete.name}</div>
                <div class="athlete-bib">BIB: ${athlete.bib}</div>
                <div class="checkin-status">${athlete.checkedIn ? 'Đã check-in' : 'Chưa check-in'}</div>
                <div class="checkin-time">${athlete.checkinTime || ''}</div>
            </div>
        `;
        athletesList.appendChild(card);
    });
}

// Filter athletes based on search input, distance, and gender
function filterAthletes() {
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput.value.toLowerCase();
    filteredAthletes = athletes.filter(athlete => {
        const matchesSearch = searchTerm === '' ||
            athlete.name.toLowerCase().includes(searchTerm) ||
            athlete.bib.toLowerCase().includes(searchTerm);
        const matchesDistance = selectedDistance === 'all' || athlete.distance === selectedDistance;
        const matchesGender = selectedGender === 'all' || athlete.gender.toLowerCase() === selectedGender.toLowerCase();
        return matchesSearch && matchesDistance && matchesGender;
    });
    updateResultsCount();
    renderAthletes();
}

// Check in selected athlete
function checkInAthlete(id) {
    showPhotoModal(id);
}

// Show modal for capturing photo
function showPhotoModal(id) {
    const modal = document.getElementById('photo-modal');
    modal.style.display = 'flex';

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            const video = document.getElementById('video');
            video.srcObject = stream;
            video.play();
        })
        .catch(error => {
            console.error('Error accessing camera:', error);
            alert('Không thể truy cập camera.');
            modal.style.display = 'none';
        });

    currentAthleteId = id;
}

// Capture photo
document.getElementById('capture-btn').addEventListener('click', () => {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    video.style.display = 'none';
    canvas.style.display = 'block';
    document.getElementById('capture-btn').style.display = 'none';
    document.getElementById('confirm-btn').style.display = 'inline-block';
});

// Confirm photo
document.getElementById('confirm-btn').addEventListener('click', async () => {
    const canvas = document.getElementById('canvas');
    const photoUrl = canvas.toDataURL('image/png');

    // Save to Google Sheets
    await updateGoogleSheet(currentAthleteId, photoUrl);

    // Close modal
    document.getElementById('photo-modal').style.display = 'none';
    resetModal();
});

// Reset modal
function resetModal() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const stream = video.srcObject;
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
    }
    video.style.display = 'block';
    canvas.style.display = 'none';
    document.getElementById('capture-btn').style.display = 'inline-block';
    document.getElementById('confirm-btn').style.display = 'none';
}

// Update Google Sheet with check-in data
async function updateGoogleSheet(id, photoUrl) {
    const now = new Date();
    const timeString = formatDate(now);

    // Update local data
    const athlete = athletes.find(a => a.id === id);
    if (athlete) {
        athlete.checkedIn = true;
        athlete.checkinTime = timeString;
        athlete.photoUrl = photoUrl;
    }

    // Push to Google Sheets via Web App
    try {
        const response = await fetch(`${WEBAPP_URL}?id=${id}&time=${encodeURIComponent(timeString)}&photoUrl=${encodeURIComponent(photoUrl)}`, {
            method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
            renderAthletes();
            showNotification('Check-in thành công!');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Error updating sheet:', error);
        showNotification('Lỗi khi cập nhật Google Sheet', 'error');
    }
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

// Setup event listeners
function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', filterAthletes);
    document.getElementById('refresh-btn').addEventListener('click', fetchAthletes);

    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDistance = btn.dataset.filter;
            filterAthletes();
        });
    });

    document.querySelectorAll('[data-gender]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-gender]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedGender = btn.dataset.gender;
            filterAthletes();
        });
    });

    document.getElementById('checkin-btn').addEventListener('click', () => {
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

    document.getElementById('athletes-list').addEventListener('click', (e) => {
        const card = e.target.closest('.athlete-card');
        if (card) {
            card.classList.toggle('selected');
        }
    });

    // QR Code Scanning
    document.getElementById('qr-scan-btn').addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            const video = document.createElement('video');
            video.setAttribute('autoplay', '');
            video.setAttribute('playsinline', '');
            video.srcObject = stream;
            document.body.appendChild(video);

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            function scanQR() {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const qrCode = jsQR(imageData.data, canvas.width, canvas.height);

                if (qrCode) {
                    const athleteId = qrCode.data; // Giả sử mã QR chứa ID vận động viên
                    checkInAthlete(athleteId);
                    stream.getTracks().forEach(track => track.stop());
                    video.remove();
                } else {
                    requestAnimationFrame(scanQR);
                }
            }
            scanQR();
        } catch (error) {
            console.error('Error accessing camera:', error);
            showNotification('Không thể truy cập camera.', 'error');
        }
    });
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
