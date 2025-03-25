    <script>
        // Global variables
        let athletes = [];
        let currentAthlete = null;
        let html5QrCode = null;
        let cameraStream = null;
        let photoTaken = false;

        // Google Apps Script configuration
        const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec';

        // DOM Elements
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        const startScanBtn = document.getElementById('start-scan');
        const qrReader = document.getElementById('qr-reader');
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');
        const searchResults = document.getElementById('search-results');
        const athleteModal = document.getElementById('athlete-modal');
        const athleteInfo = document.getElementById('athlete-info');
        const capturePhotoSection = document.getElementById('capture-photo');
        const confirmCheckinBtn = document.getElementById('confirm-checkin');
        const cancelCheckinBtn = document.getElementById('cancel-checkin');
        const closeModal = document.querySelector('.close-modal');
        const startCameraBtn = document.getElementById('start-camera');
        const captureButton = document.getElementById('capture-button');
        const retryCaptureBtn = document.getElementById('retry-capture');
        const cameraView = document.getElementById('camera-view');
        const cameraCanvas = document.getElementById('camera-canvas');
        const capturedImage = document.getElementById('captured-image');
        const totalAthletesElement = document.getElementById('total-athletes');
        const checkedInElement = document.getElementById('checked-in');
        const pendingElement = document.getElementById('pending');
        const activityLog = document.getElementById('activity-log');
        const loadingOverlay = document.getElementById('loading-overlay');
        const refreshDataBtn = document.getElementById('refresh-data');

        // Event Listeners
        document.addEventListener('DOMContentLoaded', initApp);
        tabButtons.forEach(button => {
            button.addEventListener('click', () => switchTab(button.dataset.tab));
        });
        startScanBtn.addEventListener('click', startQRScanner);
        searchBtn.addEventListener('click', searchAthlete);
        searchInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') searchAthlete();
        });
        closeModal.addEventListener('click', closeAthleteModal);
        cancelCheckinBtn.addEventListener('click', closeAthleteModal);
        confirmCheckinBtn.addEventListener('click', confirmCheckin);
        startCameraBtn.addEventListener('click', startCamera);
        captureButton.addEventListener('click', capturePhoto);
        retryCaptureBtn.addEventListener('click', retryCapture);
        refreshDataBtn.addEventListener('click', refreshData);

        // Initialize the application
        async function initApp() {
            showLoading();
            try {
                await fetchAthletes();
                updateStats();
                html5QrCode = new Html5Qrcode("qr-reader");
            } catch (error) {
                showAlert('Error initializing application. Please refresh the page.', 'error');
                console.error('Initialization error:', error);
            }
            hideLoading();
        }

        // Fetch athletes data
        async function fetchAthletes() {
            try {
                const sheetData = await fetchFromGoogleSheet();
                if (sheetData && sheetData.length > 0) {
                    athletes = sheetData;
                    console.log('Athletes loaded from Google Sheet:', athletes.length);
                    return;
                }
                throw new Error('No data source available');
            } catch (error) {
                console.error('Error fetching athlete data:', error);
                showAlert('Error loading athlete data. Using mock data.', 'error');
                athletes = generateMockData();
            }
        }

        // Fetch data from Google Sheet
        async function fetchFromGoogleSheet() {
            try {
                const response = await fetch(SHEET_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ operation: 'retrieve' })
                });
                const result = await response.json();
                if (result.success) {
                    return result.data.map(athlete => ({
                        ...athlete,
                        checked_in: athlete.checked_in === 'TRUE' || athlete.checked_in === true,
                        age: parseInt(athlete.age) || 0
                    }));
                }
                throw new Error(result.message || 'Failed to fetch data');
            } catch (error) {
                console.error('Google Sheet fetch error:', error);
                return null;
            }
        }

        // Update a single athlete in Google Sheet
        async function updateAthleteInSheet(athlete) {
            try {
                const response = await fetch(SHEET_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        operation: 'update',
                        id: athlete.id,
                        updates: {
                            checked_in: athlete.checked_in,
                            bib_photo: athlete.bib_photo,
                            check_in_time: athlete.check_in_time
                        }
                    })
                });
                const result = await response.json();
                if (result.success) {
                    return true;
                } else {
                    throw new Error(result.message || 'Update failed');
                }
            } catch (error) {
                console.error('Error updating athlete:', error);
                return false;
            }
        }

        // Refresh data from Google Sheet
        async function refreshData() {
            showLoading();
            try {
                await fetchAthletes();
                updateStats();
                showAlert('Data refreshed successfully', 'success');
            } catch (error) {
                showAlert('Error refreshing data', 'error');
                console.error('Refresh error:', error);
            }
            hideLoading();
        }

        // Update statistics
        function updateStats() {
            const totalAthletes = athletes.length;
            const checkedIn = athletes.filter(a => a.checked_in).length;
            const pending = totalAthletes - checkedIn;
            totalAthletesElement.textContent = totalAthletes;
            checkedInElement.textContent = checkedIn;
            pendingElement.textContent = pending;
        }

        // Generate mock data for testing
        function generateMockData() {
            const mockData = [];
            for (let i = 1; i <= 50; i++) {
                mockData.push({
                    id: i,
                    bib_number: i,
                    full_name: `Athlete ${i}`,
                    phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
                    email: `athlete${i}@example.com`,
                    gender: i % 2 === 0 ? 'Male' : 'Female',
                    age: Math.floor(18 + Math.random() * 50),
                    category: ['5K', '10K', '21K'][Math.floor(Math.random() * 3)],
                    team: `Team ${Math.floor(Math.random() * 10) + 1}`,
                    emergency_contact: `Contact ${i}`,
                    emergency_phone: `08${Math.floor(10000000 + Math.random() * 90000000)}`,
                    checked_in: Math.random() > 0.7,
                    bib_photo: null
                });
            }
            return mockData;
        }

        // Start QR code scanner
        function startQRScanner() {
            if (html5QrCode.isScanning) {
                html5QrCode.stop().then(() => {
                    console.log('QR Scanner stopped');
                    startScanBtn.innerHTML = '<i class="fas fa-camera"></i> Start Scanner';
                }).catch(err => console.error('Error stopping QR Scanner:', err));
                return;
            }
            const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 } };
            html5QrCode.start(
                { facingMode: "environment" },
                qrConfig,
                onQRCodeSuccess,
                onQRCodeError
            ).then(() => {
                console.log('QR Scanner started');
                startScanBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Scanner';
            }).catch(err => {
                console.error('Error starting QR Scanner:', err);
                showAlert('Unable to start camera. Check permissions.', 'error');
            });
        }

        // QR Code Success Handler
        function onQRCodeSuccess(decodedText) {
            console.log('QR Code detected:', decodedText);
            html5QrCode.pause();
            try {
                let athleteIdentifier;
                try {
                    const qrData = JSON.parse(decodedText);
                    athleteIdentifier = qrData.bib_number || qrData.id || qrData.phone;
                } catch (e) {
                    athleteIdentifier = decodedText;
                }
                const athlete = athletes.find(a =>
                    a.bib_number?.toString() === athleteIdentifier?.toString() ||
                    a.id?.toString() === athleteIdentifier?.toString() ||
                    a.phone === athleteIdentifier
                );
                if (athlete) {
                    displayAthleteModal(athlete);
                } else {
                    showAlert(`No athlete found with identifier: ${athleteIdentifier}`, 'warning');
                    html5QrCode.resume();
                }
            } catch (error) {
                console.error('Error processing QR code:', error);
                showAlert('Invalid QR code format', 'error');
                html5QrCode.resume();
            }
        }

        // QR Code Error Handler
        function onQRCodeError(error) {
            console.debug('QR scan error (normal):', error);
        }

        // Search athlete
        function searchAthlete() {
            const searchTerm = searchInput.value.trim().toLowerCase();
            if (!searchTerm) {
                showAlert('Please enter a search term', 'warning');
                return;
            }
            const results = athletes.filter(athlete => {
                const nameMatch = athlete.full_name?.toLowerCase().includes(searchTerm);
                const bibMatch = athlete.bib_number?.toString().includes(searchTerm);
                const phoneMatch = athlete.phone?.includes(searchTerm);
                const emailMatch = athlete.email?.toLowerCase().includes(searchTerm);
                return nameMatch || bibMatch || phoneMatch || emailMatch;
            });
            displaySearchResults(results);
        }

        // Display search results
        function displaySearchResults(results) {
            searchResults.innerHTML = '';
            if (results.length === 0) {
                searchResults.innerHTML = '<p>No athletes found.</p>';
                return;
            }
            const resultsList = document.createElement('div');
            results.forEach(athlete => {
                const athleteCard = document.createElement('div');
                athleteCard.className = `athlete-card ${athlete.checked_in ? 'checked-in' : ''}`;
                athleteCard.innerHTML = `
                    <div>Bib #${athlete.bib_number || 'N/A'} - ${athlete.checked_in ? 'Checked In' : 'Pending'}</div>
                    <h3>${athlete.full_name || 'Unknown'}</h3>
                    <p>${athlete.category || 'N/A'} | ${athlete.gender || 'N/A'}</p>
                    <p>${athlete.phone || 'N/A'}</p>
                `;
                athleteCard.addEventListener('click', () => displayAthleteModal(athlete));
                resultsList.appendChild(athleteCard);
            });
            searchResults.appendChild(resultsList);
        }

        // Display athlete modal
        function displayAthleteModal(athlete) {
            currentAthlete = athlete;
            photoTaken = false;
            const status = athlete.checked_in ? '<span>Checked In</span>' : '<span>Pending</span>';
            athleteInfo.innerHTML = `
                <h2>${athlete.full_name || 'Unknown'}</h2>
                <div>${status}</div>
                <p>Bib Number: ${athlete.bib_number || 'N/A'}</p>
                <p>Category: ${athlete.category || 'N/A'}</p>
                <p>Gender: ${athlete.gender || 'N/A'}</p>
                <p>Age: ${athlete.age || 'N/A'}</p>
                <p>Team: ${athlete.team || 'N/A'}</p>
                <p>Phone: ${athlete.phone || 'N/A'}</p>
                <p>Email: ${athlete.email || 'N/A'}</p>
                <p>Emergency Contact: ${athlete.emergency_contact || 'N/A'}</p>
                <p>Emergency Phone: ${athlete.emergency_phone || 'N/A'}</p>
            `;
            if (athlete.checked_in) {
                capturePhotoSection.style.display = 'none';
                confirmCheckinBtn.style.display = 'none';
                if (athlete.bib_photo) {
                    athleteInfo.innerHTML += `
                        <h3>Bib Photo</h3>
                        <img src="${athlete.bib_photo}" alt="Bib photo" style="width: 100%;">
                    `;
                }
            } else {
                capturePhotoSection.style.display = 'block';
                confirmCheckinBtn.style.display = 'block';
                cameraView.style.display = 'none';
                capturedImage.style.display = 'none';
                startCameraBtn.style.display = 'block';
                captureButton.style.display = 'none';
                retryCaptureBtn.style.display = 'none';
            }
            athleteModal.style.display = 'flex';
            if (html5QrCode && html5QrCode.getState() === Html5QrcodeScannerState.PAUSED) {
                html5QrCode.resume();
            }
        }

        // Close athlete modal
        function closeAthleteModal() {
            athleteModal.style.display = 'none';
            stopCamera();
            currentAthlete = null;
        }

        // Start camera
        async function startCamera() {
            try {
                cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                cameraView.srcObject = cameraStream;
                cameraView.style.display = 'block';
                startCameraBtn.style.display = 'none';
                captureButton.style.display = 'block';
                await cameraView.play();
            } catch (error) {
                console.error('Error starting camera:', error);
                showAlert('Unable to access camera.', 'error');
            }
        }

        // Stop camera
        function stopCamera() {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
            cameraView.srcObject = null;
        }

        // Capture photo
        function capturePhoto() {
            if (!cameraStream) return;
            const context = cameraCanvas.getContext('2d');
            cameraCanvas.width = cameraView.videoWidth;
            cameraCanvas.height = cameraView.videoHeight;
            context.drawImage(cameraView, 0, 0, cameraCanvas.width, cameraCanvas.height);
            const imageDataUrl = cameraCanvas.toDataURL('image/jpeg');
            capturedImage.src = imageDataUrl;
            capturedImage.style.display = 'block';
            cameraView.style.display = 'none';
            captureButton.style.display = 'none';
            retryCaptureBtn.style.display = 'block';
            photoTaken = true;
            stopCamera();
        }

        // Retry photo capture
        function retryCapture() {
            capturedImage.style.display = 'none';
            retryCaptureBtn.style.display = 'none';
            photoTaken = false;
            startCamera();
        }

        // Confirm athlete check-in
        async function confirmCheckin() {
            if (!currentAthlete) return;
            if (!photoTaken) {
                showAlert('Please take a photo of the athlete with their bib number', 'warning');
                return;
            }
            showLoading();
            try {
                const bibPhoto = capturedImage.src;
                const athleteIndex = athletes.findIndex(a => a.id === currentAthlete.id);
                if (athleteIndex >= 0) {
                    athletes[athleteIndex].checked_in = true;
                    athletes[athleteIndex].bib_photo = bibPhoto;
                    athletes[athleteIndex].check_in_time = new Date().toISOString();
                    const success = await updateAthleteInSheet(athletes[athleteIndex]);
                    if (!success) {
                        throw new Error('Failed to update athlete in Google Sheet');
                    }
                }
                updateStats();
                addToActivityLog(`Checked in: ${currentAthlete.full_name} (Bib #${currentAthlete.bib_number})`);
                closeAthleteModal();
                showAlert(`${currentAthlete.full_name} successfully checked in!`, 'success');
            } catch (error) {
                console.error('Error during check-in:', error);
                showAlert('Error saving check-in data. Please try again.', 'error');
            }
            hideLoading();
        }

        // Switch tabs
        function switchTab(tabId) {
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) content.classList.add('active');
            });
            tabButtons.forEach(button => {
                button.classList.remove('active');
                if (button.dataset.tab === tabId) button.classList.add('active');
            });
        }

        // Show alert
        function showAlert(message, type = 'info') {
            const alert = document.createElement('div');
            alert.className = `alert alert-${type}`;
            alert.innerHTML = `${message} <button class="alert-close">×</button>`;
            alert.querySelector('.alert-close').addEventListener('click', () => alert.remove());
            document.body.appendChild(alert);
            setTimeout(() => alert.remove(), 5000);
        }

        // Show loading
        function showLoading() {
            loadingOverlay.style.display = 'flex';
        }

        // Hide loading
        function hideLoading() {
            loadingOverlay.style.display = 'none';
        }
    </script>
