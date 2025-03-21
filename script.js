// Google Sheets API setup
 const SHEET_ID = '1kdt68gFOrTyirvo69oRDpAJDM7y_iGxvXM3HLDb57kw'; // You'll need to replace this
 const API_KEY = 'AIzaSyAMjzUR6DiIiSBkxaqtohn4YJqlm9njUu0'; // You'll need to replace this
 const SHEET_ID = '1kdt68gFOrTyirvo69oRDpAJDM7y_iGxvXM3HLDb57kw';
 const API_KEY = 'AIzaSyAMjzUR6DiIiSBkxaqtohn4YJqlm9njUu0'; // Thay bằng API key của bạn
 const SHEET_NAME = 'athletes';
 const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;
 
 // GitHub repository details
 const GITHUB_OWNER = 'racehue';  // Thay bằng username GitHub của bạn
 const GITHUB_REPO = 'race-check-in';  // Thay bằng tên repo
 const GITHUB_PATH = 'data/athletes.json';  // Đường dẫn trong repo
 const GITHUB_BRANCH = 'main';  // Nhánh GitHub
 const GITHUB_TOKEN = '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';  // Thay bằng Personal Access Token
 
 // Web App URL cho Google Sheets
 const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec';
 
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
     // Initialize elements
     const athletesList = document.getElementById('athletes-list');
     const searchInput = document.getElementById('search-input');
     const resultsCount = document.getElementById('results-count');
     const refreshBtn = document.getElementById('refresh-btn');
     const checkinBtn = document.getElementById('checkin-btn');
     const importBtn = document.getElementById('import-btn');
     const distanceFilters = document.querySelectorAll('[data-filter]');
     const genderFilters = document.querySelectorAll('[data-gender]');
     
     // Add GitHub buttons to action area
     addGitHubButtons();
     
     // Initialize the app
     fetchAthletes();
     setupEventListeners();
 });
 
 // Fetch athletes data from Google Sheets
 function fetchAthletes() {
     fetch(API_URL)
         .then(response => response.json())
         .then(response => {
             if (!response.ok) {
                 throw new Error('Network response was not ok: ' + response.statusText);
             }
             return response.json();
         })
         .then(data => {
             processData(data.values);
             renderAthletes();
             if (data && data.values) {
                 processData(data.values);
                 renderAthletes();
                 console.log('Data fetched successfully');
             } else {
                 console.error('Invalid data format:', data);
                 useTestData();
             }
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
     resultsCount.textContent = `[${filteredAthletes.length}/${athletes.length}]`;
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
 
         const genderClass = athlete.gender.toLowerCase() === 'nam' ? 'gender-m' : 'gender-f';
         const genderLabel = athlete.gender.toLowerCase() === 'nam' ? 'M' : 'F';
 
         card.innerHTML = `
             <div class="athlete-photo">
                 <img src="${athlete.photoUrl || 'placeholder.jpg'}" alt="${athlete.name}">
                 <img src="${athlete.photoUrl || 'placeholder.jpg'}" alt="${athlete.name}" onerror="this.src='placeholder.jpg'">
             </div>
             <div class="athlete-info">
                 <div class="athlete-gender ${genderClass}">${genderLabel}</div>
                 <div class="athlete-name">${athlete.name}</div>
                 <div class="checkin-status">Đã check in</div>
                 <div class="athlete-bib">${athlete.bib || 'No BIB'}</div>
                 <div class="checkin-status ${athlete.checkedIn ? 'checked' : ''}">${athlete.checkedIn ? 'Đã check in' : 'Chưa check in'}</div>
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
     const searchInput = document.getElementById('search-input');
     const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
 
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
     const timeString = formatDate(now);
 
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
 
 // Format date in a user-friendly format
 function formatDate(date) {
     const day = String(date.getDate()).padStart(2, '0');
     const month = String(date.getMonth() + 1).padStart(2, '0');
     const year = date.getFullYear();
     const hours = String(date.getHours()).padStart(2, '0');
     const minutes = String(date.getMinutes()).padStart(2, '0');
     
     return `${day}/${month}/${year} ${hours}:${minutes}`;
 }
 
 // Update Google Sheet with check-in data
 function updateGoogleSheet(athleteId, timeString) {
     // This would normally be a more complex API call with proper authentication
     // For GitHub Pages, you'd likely need a serverless function or similar
     console.log(`Updating athlete ${athleteId} with time ${timeString}`);
     fetch(`${WEBAPP_URL}?id=${athleteId}&time=${encodeURIComponent(timeString)}`)
         .then(response => {
             if (!response.ok) {
                 throw new Error('Network response was not ok');
             }
             return response.json();
         })
         .then(data => {
             console.log('Update successful:', data);
             showNotification('Check-in thành công');
         })
         .catch(error => {
             console.error('Error updating sheet:', error);
             showNotification('Lỗi khi cập nhật Google Sheet', 'error');
         });
 }
 
 // Show notification
 function showNotification(message, type = 'success') {
     const notification = document.createElement('div');
     notification.className = `notification ${type}`;
     notification.textContent = message;
     
     document.body.appendChild(notification);
     
     // Remove after 3 seconds
     setTimeout(() => {
         notification.classList.add('fadeout');
         setTimeout(() => notification.remove(), 500);
     }, 3000);
 }
 
 // Setup all event listeners
 function setupEventListeners() {
     // Search input
     searchInput.addEventListener('input', filterAthletes);
     const searchInput = document.getElementById('search-input');
     if (searchInput) {
         searchInput.addEventListener('input', filterAthletes);
     }
 
     // Refresh button
     refreshBtn.addEventListener('click', fetchAthletes);
     const refreshBtn = document.getElementById('refresh-btn');
     if (refreshBtn) {
         refreshBtn.addEventListener('click', fetchAthletes);
     }
 
     // Distance filter buttons
     const distanceFilters = document.querySelectorAll('[data-filter]');
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
     const genderFilters = document.querySelectorAll('[data-gender]');
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
     const checkinBtn = document.getElementById('checkin-btn');
     if (checkinBtn) {
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
     });
     }
 
     // Athlete card selection
     athletesList.addEventListener('click', (e) => {
         const card = e.target.closest('.athlete-card');
         if (card) {
             card.classList.toggle('selected');
     const athletesList = document.getElementById('athletes-list');
     if (athletesList) {
         athletesList.addEventListener('click', (e) => {
             const card = e.target.closest('.athlete-card');
             if (card) {
                 card.classList.toggle('selected');
             }
         });
     }
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
 function updateGoogleSheet(athleteId, timeString) {
     const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec';
 function useTestData() {
     const testData = [
         {id: "1", name: "Nguyễn Văn A", gender: "Nam", distance: "42K", bib: "A001", checkedIn: false, checkinTime: "", photoUrl: ""},
         {id: "2", name: "Trần Thị B", gender: "Nữ", distance: "21K", bib: "B002", checkedIn: true, checkinTime: "20/03/2025 08:15", photoUrl: ""},
         {id: "3", name: "Phạm Văn C", gender: "Nam", distance: "10K", bib: "C003", checkedIn: false, checkinTime: "", photoUrl: ""},
         {id: "4", name: "Lê Thị D", gender: "Nữ", distance: "5K", bib: "D004", checkedIn: true, checkinTime: "20/03/2025 07:45", photoUrl: ""},
         {id: "5", name: "Hoàng Văn E", gender: "Nam", distance: "42K", bib: "E005", checkedIn: false, checkinTime: "", photoUrl: ""}
     ];
 
     fetch(`${WEBAPP_URL}?id=${athleteId}&time=${encodeURIComponent(timeString)}`)
         .then(response => response.json())
         .then(data => {
             console.log('Update successful:', data);
         })
         .catch(error => {
             console.error('Error updating sheet:', error);
         });
     athletes = testData;
     filteredAthletes = [...athletes];
     updateResultsCount();
     renderAthletes();
     
     showNotification('Sử dụng dữ liệu test do không thể kết nối Google Sheets', 'info');
 }
 
 // CSS Styles for notifications
 const style = document.createElement('style');
 style.textContent = `
     .notification {
         position: fixed;
         top: 20px;
         right: 20px;
         padding: 12px 20px;
         border-radius: 4px;
         color: white;
         z-index: 1000;
         box-shadow: 0 4px 8px rgba(0,0,0,0.2);
         animation: slidein 0.3s ease-out;
     }
     
     .notification.success {
         background-color: #4CAF50;
     }
     
     .notification.error {
         background-color: #F44336;
     }
     
     .notification.info {
         background-color: #2196F3;
     }
     
     .notification.fadeout {
         animation: fadeout 0.5s ease-in forwards;
     }
     
     @keyframes slidein {
         from { transform: translateX(100%); opacity: 0; }
         to { transform: translateX(0); opacity: 1; }
     }
     
     @keyframes fadeout {
         from { opacity: 1; }
         to { opacity: 0; }
     }
     
     .athlete-card {
         display: flex;
         border: 1px solid #ddd;
         margin-bottom: 10px;
         padding: 10px;
         border-radius: 5px;
         background-color: #f9f9f9;
         transition: all 0.3s ease;
     }
     
     .athlete-card.selected {
         background-color: #e3f2fd;
         border-color: #2196F3;
     }
     
     .athlete-card.checked-in {
         background-color: #e8f5e9;
         border-color: #4CAF50;
     }
     
     .athlete-photo {
         width: 60px;
         height: 60px;
         overflow: hidden;
         border-radius: 50%;
         margin-right: 15px;
     }
     
     .athlete-photo img {
         width: 100%;
         height: 100%;
         object-fit: cover;
     }
     
     .athlete-info {
         flex: 1;
     }
     
     .athlete-name {
         font-weight: bold;
         font-size: 16px;
         margin-bottom: 5px;
     }
     
     .athlete-gender {
         display: inline-block;
         padding: 2px 8px;
         border-radius: 12px;
         font-size: 12px;
         font-weight: bold;
         margin-right: 5px;
     }
     
     .gender-m {
         background-color: #2196F3;
         color: white;
     }
     
     .gender-f {
         background-color: #E91E63;
         color: white;
     }
     
     .athlete-distance {
         font-weight: bold;
         display: flex;
         align-items: center;
         justify-content: center;
         margin-left: 10px;
         padding: 0 10px;
         border-left: 1px solid #ddd;
     }
     
     .checkin-status {
         font-size: 14px;
         color: #757575;
     }
     
     .checkin-status.checked {
         color: #4CAF50;
     }
     
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
