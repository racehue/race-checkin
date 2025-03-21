        // Google Sheets API setup
        const SHEET_ID = '1kdt68gFOrTyirvo69oRDpAJDM7y_iGxvXM3HLDb57kw'; // Bạn cần thay thế cái này
        const API_KEY = 'AIzaSyAMjzUR6DiIiSBkxaqtohn4YJqlm9njUu0'; // Bạn cần thay thế cái này
        const SHEET_NAME = 'athletes';
        const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;
        
        // GitHub repository details
        const GITHUB_OWNER = 'racehue';  // Thay bằng username GitHub của bạn
        const GITHUB_REPO = 'race-check-in';   // Thay bằng tên repo
        const GITHUB_PATH = 'data/athletes.json';   // Đường dẫn trong repo
        const GITHUB_BRANCH = 'main';    // Nhánh GitHub
        const GITHUB_TOKEN = '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';    // Thay bằng Personal Access Token
        
        // Web App URL cho Google Sheets
        const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec';
        
        // Global variables
        let athletes = [];
        let filteredAthletes = [];
        let selectedDistance = 'all';
        let selectedGender = 'all';
        let selectedAthleteId = null;
        let capturedImageURL = '';
        
        // DOM Elements
        const athletesList = document.getElementById('athletes-list');
        const searchInput = document.getElementById('search-input');
        const resultsCount = document.getElementById('results-count');
        const refreshBtn = document.getElementById('refresh-btn');
        const checkinBtn = document.getElementById('checkin-btn');
        const importBtn = document.getElementById('import-btn');
        const takePhotoBtn = document.getElementById('take-photo-btn');
        const distanceFilters = document.querySelectorAll('[data-filter]');
        const genderFilters = document.querySelectorAll('[data-gender]');
        const noResultsElement = document.getElementById('no-results');

        // Modal elements
        const modal = document.getElementById('photo-modal');
        const webcamPreview = document.getElementById('webcam-preview');
        const capturedPhoto = document.getElementById('captured-photo');
        const captureBtn = document.getElementById('capture-btn');
        const retakeBtn = document.getElementById('retake-btn');
        const confirmBtn = document.getElementById('confirm-btn');
        const closeModalBtn = document.getElementById('close-modal');

        let videoStream;
        
        // Initialize the app
        document.addEventListener('DOMContentLoaded', () => {
            // Add GitHub buttons to action area
            addGitHubButtons();
            
            // Initialize the app
            fetchAthletes();
            setupEventListeners();
            
            // Set active filter button
            setActiveFilterButton('distance', selectedDistance);
            setActiveFilterButton('gender', selectedGender);
        });
        
        // Fetch athletes data from Google Sheets
        function fetchAthletes() {
            // Show loading state
            const refreshBtn = document.getElementById('refresh-btn');
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync loading-icon"></i> Đang tải...';
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
                })
                .catch(error => {
                    console.error('Error fetching data:', error);
                    showNotification('Lỗi khi tải dữ liệu từ Google Sheets', 'error');
                    useTestData(); // Fallback to test data
                })
                .finally(() => {
                    // Hide loading state
                    if (refreshBtn) {
                        refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Làm mới';
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
            resultsCount.textContent = `[${filteredAthletes.length}/${athletes.length}]`;
            if (filteredAthletes.length === 0) {
                noResultsElement.classList.remove('hidden');
            } else {
                noResultsElement.classList.add('hidden');
            }
        }
        
        // Render athletes list
        function renderAthletes() {
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
                        <img src="${athlete.photoUrl || 'placeholder.jpg'}" alt="${athlete.name}" onerror="this.src='placeholder.jpg'">
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
            const timeString = formatDate(now);
        
            // Find the athlete in our local data
            const athlete = athletes.find(a => a.id === athleteId);
            if (athlete) {
                athlete.checkedIn = true;
                athlete.checkinTime = timeString;
            }
        
            // Update Google Sheet via API
            updateGoogleSheet(athleteId, timeString, capturedImageURL);
        
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
        
        // Update Google Sheet with check-in data and photo URL
        function updateGoogleSheet(athleteId, timeString, photoUrl) {
            fetch(`${WEBAPP_URL}?id=${athleteId}&time=${encodeURIComponent(timeString)}&photoUrl=${encodeURIComponent(photoUrl)}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Update successful:', data);
                    showNotification('Check-in thành công');
                    
                    // Update photoUrl in local data
                    const athlete = athletes.find(a => a.id === athleteId);
                    if (athlete) {
                        athlete.photoUrl = photoUrl;
                    }
                    renderAthletes();
                    
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
        
            // Refresh button
            refreshBtn.addEventListener('click', fetchAthletes);
        
            // Distance filter buttons
            distanceFilters.forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedDistance = btn.dataset.filter;
                    setActiveFilterButton('distance', selectedDistance);
                    filterAthletes();
                });
            });
        
            // Gender filter buttons
            genderFilters.forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedGender = btn.dataset.gender;
                    setActiveFilterButton('gender', selectedGender);
                    filterAthletes();
                });
            });
        
            // Check-in button
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
        
            // Athlete card selection
            athletesList.addEventListener('click', (e) => {
                const card = e.target.closest('.athlete-card');
                if (card) {
                    card.classList.toggle('selected');
                }
            });

            // Take photo button
            takePhotoBtn.addEventListener('click', () => {
                const selectedCards = document.querySelectorAll('.athlete-card.selected');
                if (selectedCards.length !== 1) {
                    showNotification('Vui lòng chọn một VĐV để chụp ảnh', 'error');
                    return;
                }
                selectedAthleteId = selectedCards[0].dataset.id;
                openCamera();
            });

            // Modal close button
            closeModalBtn.addEventListener('click', () => {
                closeModal();
            });

            // Capture button
            captureBtn.addEventListener('click', () => {
                capturePhoto();
            });

            // Retake button
            retakeBtn.addEventListener('click', () => {
                retakePhoto();
            });

            // Confirm button
            confirmBtn.addEventListener('click', () => {
                confirmPhoto();
            });

            // Import button
            importBtn.addEventListener('click', () => {
                // In a real application, you would handle file selection and parsing here
                // This is just a placeholder for the functionality
                showNotification('Chức năng nhập dữ liệu đang được phát triển', 'info');
                // You might use a hidden file input element and trigger a click event
                // to open the file dialog:
                // const fileInput = document.createElement('input');
                // fileInput.type = 'file';
                // fileInput.accept = '.csv, .json'; // Specify accepted file types
                // fileInput.onchange = handleFileImport;
                // fileInput.click();
            });
        }

        function setActiveFilterButton(filterType, filterValue) {
            const buttons = filterType === 'distance' ? distanceFilters : genderFilters;
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
