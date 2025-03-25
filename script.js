// Global Variables
const SHEET_ID = '1kdt68gFOrTyirvo69oRDpAJDM7y_iGxvXM3HLDb57kw';
const API_KEY = 'AIzaSyAMjzUR6DiIiSBkxaqtohn4YJqlm9njUu0';
const GITHUB_TOKEN = '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';
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec';
let athletes = [];
let filteredAthletes = [];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchAthletes();
    setupEventListeners();
});

// Fetch Athletes from Google Sheets
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

// Process Data
function processData(values) {
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
}

// Render Athletes
function renderAthletes() {
    const list = document.getElementById('athletes-list');
    list.innerHTML = '';
    filteredAthletes.forEach(athlete => {
        const card = document.createElement('div');
        card.className = 'athlete-card';
        if (athlete.checkedIn) card.classList.add('checked-in');
        card.innerHTML = `
            <img src="${athlete.photoUrl || 'placeholder.jpg'}" alt="${athlete.name}">
            <h3>${athlete.name}</h3>
            <p>BIB: ${athlete.bib}</p>
            <p>${athlete.distance} | ${athlete.gender}</p>
            <button onclick="checkInAthlete('${athlete.id}')">${athlete.checkedIn ? 'Đã check-in' : 'Check-in'}</button>
        `;
        list.appendChild(card);
    });
}

// Check-in Athlete
function checkInAthlete(id) {
    const athlete = athletes.find(a => a.id === id);
    if (!athlete) return;

    showPhotoModal(id);
}

// Show Photo Modal
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
}

// Capture Photo
document.getElementById('capture-btn').addEventListener('click', () => {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    video.style.display = 'none';
    canvas.style.display = 'block';
    document.getElementById('capture-btn').style.display = 'none';
    document.getElementById('confirm-btn').style.display = 'inline-block';
});

// Confirm Photo
document.getElementById('confirm-btn').addEventListener('click', async () => {
    const canvas = document.getElementById('canvas');
    const photoUrl = canvas.toDataURL('image/png');

    // Save to Google Sheets
    await updateGoogleSheet(currentAthleteId, photoUrl);

    // Close Modal
    document.getElementById('photo-modal').style.display = 'none';
    resetModal();
});
     .checkin-time {
         font-size: 12px;
         color: #9e9e9e;
     }
     
     .action-btn {
         padding: 8px 16px;
         margin: 5px;
         border: none;
         border-radius: 4px;
         background-color: #2196F3;
         color: white;
         cursor: pointer;
         transition: background-color 0.3s;
     }
     
     .action-btn:hover {
         background-color: #0b7dda;
     }
     
     #refresh-btn {
         background-color: #4CAF50;
     }
     
     #checkin-btn {
         background-color: #FF9800;
     }
     
     #github-export-btn {
         background-color: #9C27B0;
     }
     
     #github-commit-btn {
         background-color: #333;
     }
     
     .athlete-bib {
         font-size: 14px;
         color: #555;
         margin-bottom: 3px;
     }
 `;
 
 document.head.appendChild(style);
document.getElementById('qr-scan-btn').addEventListener('click', () => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            const video = document.createElement('video');
            video.srcObject = stream;
            video.setAttribute('autoplay', '');
            video.setAttribute('playsinline', '');
            document.body.appendChild(video);

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            video.addEventListener('play', () => {
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
            });
        })
        .catch(error => {
            console.error('Error accessing camera:', error);
            alert('Không thể truy cập camera.');
        });
});
