// Google Sheets API setup
const SHEET_ID = '1kdt68gFOrTyirvo69oRDpAJDM7y_iGxvXM3HLDb57kw'; // You'll need to replace this
const API_KEY = '110189773640066865208'; // You'll need to replace this
const SHEET_NAME = 'athletes';
const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;

// Global variables
let athletes = [];
let filteredAthletes = [];
let selectedDistance = 'all';
let selectedGender = 'all';

// DOM Elements
const athletesList = document.getElementById('athletes-list');
const searchInput = document.getElementById('search-input');
const resultsCount = document.getElementById('results-count');
const refreshBtn = document.getElementById('refresh-btn');
const checkinBtn = document.getElementById('checkin-btn');
const importBtn = document.getElementById('import-btn');
const testBtn = document.getElementById('test-btn');
const distanceFilters = document.querySelectorAll('[data-filter]');
const genderFilters = document.querySelectorAll('[data-gender]');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
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
            
            // For testing without API
            useTestData();
        });
}

// Process the data from Google Sheets
function processData(values) {
    // Skip header row
    const headers = values[0];
    athletes = [];
    
    for (let i = 1; i < values.length; i++) {
        const row = values[i];
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
    resultsCount.textContent = `[${filteredAthletes.length}/${athletes.length}]`;
}

// Render athletes list
function renderAthletes() {
    athletesList.innerHTML = '';
    
    filteredAthletes.forEach(athlete => {
        const card = document.createElement('div');
        card.className = 'athlete-card';
        card.dataset.id = athlete.id;
        
        const genderClass = athlete.gender.toLowerCase() === 'nam' ? 'gender-m' : 'gender-f';
        const genderLabel = athlete.gender.toLowerCase() === 'nam' ? 'M' : 'F';
        
        card.innerHTML = `
            <div class="athlete-photo">
                <img src="${athlete.photoUrl || 'placeholder.jpg'}" alt="${athlete.name}">
            </div>
            <div class="athlete-info">
                <div class="athlete-gender ${genderClass}">${genderLabel}</div>
                <div class="athlete-name">${athlete.name}</div>
                <div class="checkin-status">Đã check in</div>
                <div class="checkin-time">${athlete.checkinTime || ''}</div>
            </div>
            <div class="athlete-distance">${athlete.distance}</div>
            <button class="email-btn"><i class="far fa-envelope"></i></button>
        `;
        
        athletesList.appendChild(card);
    });
}

// Filter athletes based on search input, distance and gender
function filterAthletes() {
    const searchTerm = searchInput.value.toLowerCase();
    
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
}

// Check in selected athlete
function checkInAthlete(athleteId) {
    const now = new Date();
    const timeString = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes()} CH`;
    
    // Find the athlete in our local data
    const athlete = athletes.find(a => a.id === athleteId);
    if (athlete) {
        athlete.checkedIn = true;
        athlete.checkinTime = timeString;
    }
    
    // Update Google Sheet via API
    updateGoogleSheet(athleteId, timeString);
    
    // Update the UI
    renderAthletes();
}

// Update Google Sheet with check-in data
function updateGoogleSheet(athleteId, timeString) {
    // This would normally be a more complex API call with proper authentication
    // For GitHub Pages, you'd likely need a serverless function or similar
    console.log(`Updating athlete ${athleteId} with time ${timeString}`);
}

// Setup all event listeners
function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', filterAthletes);
    
    // Refresh button
    refreshBtn.addEventListener('click', fetchAthletes);
    
    // Distance filter buttons
    distanceFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            distanceFilters.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Update selected distance
            selectedDistance = btn.dataset.filter;
            
            // Re-filter athletes
            filterAthletes();
        });
    });
    
    // Gender filter buttons
    genderFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            genderFilters.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Update selected gender
            selectedGender = btn.dataset.gender;
            
            // Re-filter athletes
            filterAthletes();
        });
    });
    
    // Check-in button
    checkinBtn.addEventListener('click', () => {
        const selectedCards = document.querySelectorAll('.athlete-card.selected');
        selectedCards.forEach(card => {
            checkInAthlete(card.dataset.id);
        });
    });
    
    // Athlete card selection
    athletesList.addEventListener('click', (e) => {
        const card = e.target.closest('.athlete-card');
        if (card) {
            card.classList.toggle('selected');
        }
    });
}

// Use test data for development
function useTestData() {
    athletes = [
        { id: '1', name: 'BIỆN TIẾN KIỆN', gender: 'Nam', distance: '5KM', bib: '31000', checkedIn: true, checkinTime: '20/03/2025 4:40 CH', photoUrl: '' },
        { id: '2', name: 'CHU THỊ MỸ HẰNG', gender: 'Nữ', distance: '10KM', bib: '11101', checkedIn: true, checkinTime: '20/03/2025 1:56 CH', photoUrl: '' },
        { id: '3', name: 'ĐẶNG ANH THI', gender: 'Nam', distance: '10KM', bib: '11803', checkedIn: true, checkinTime: '20/03/2025 4:05 CH', photoUrl: '' },
        { id: '4', name: 'ĐẶNG HẢI', gender: 'Nam', distance: '10KM', bib: '11993', checkedIn: true, checkinTime: '20/03/2025 5:26 CH', photoUrl: '' },
        { id: '5', name: 'ĐẶNG MINH TÀI', gender: 'Nam', distance: '5KM', bib: '38888', checkedIn: false, checkinTime: '', photoUrl: '' }
    ];
    
    filteredAthletes = [...athletes];
    updateResultsCount();
    renderAthletes();
}
function updateGoogleSheet(athleteId, timeString) {
    const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec';
    
    fetch(`${WEBAPP_URL}?id=${athleteId}&time=${encodeURIComponent(timeString)}`)
        .then(response => response.json())
        .then(data => {
            console.log('Update successful:', data);
        })
        .catch(error => {
            console.error('Error updating sheet:', error);
        });
}
