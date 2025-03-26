// --- Configuration ---
 // !!! SECURITY WARNING !!!
 // DO NOT EXPOSE API KEYS OR TOKENS IN CLIENT-SIDE JAVASCRIPT!
 // These values are visible to anyone inspecting your website's code.
 // Consider using a server-side proxy or environment variables for secure handling.
 const SHEET_ID = '1kdt68gFOrTyirvo69oRDpAJDM7y_iGxvXM3HLDb57kw'; // Replace with your Sheet ID
 const API_KEY = 'AIzaSyAMjzUR6DiIiSBkxaqtohn4YJqlm9njUu0'; // !!! INSECURE - Replace with server-side solution !!!
 const GITHUB_OWNER = 'racehue'; // Replace with your GitHub username
 const GITHUB_REPO = 'race-check-in'; // Replace with your repo name
 const GITHUB_PATH = 'data/athletes.json'; // Path in your repo
 const GITHUB_BRANCH = 'main';
 const GITHUB_TOKEN = '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'; // !!! EXTREMELY INSECURE - Replace with server-side solution !!!
 const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec'; // Your Google Apps Script Web App URL for UPDATING sheet data
 
 // --- Global State ---
 let athletes = []; // Holds all athlete data
 let filteredAthletes = []; // Holds currently displayed athletes
 let selectedAthleteIds = new Set(); // Holds IDs of selected athletes for batch check-in
 let currentModalAthlete = null; // Athlete being processed in the modal
 let cameraStream = null; // Holds the camera stream for cleanup
 
 // --- DOM Elements ---
 const loader = document.getElementById('loader');
 const athletesListContainer = document.getElementById('athletes-list');
 const resultsCountSpan = document.getElementById('results-count');
 const searchInput = document.getElementById('search-input');
 const refreshBtn = document.getElementById('refresh-btn');
 const distanceFilterGroup = document.getElementById('distance-filter');
 const genderFilterGroup = document.getElementById('gender-filter');
 const qrScanBtn = document.getElementById('qr-scan-btn');
 const exportBtn = document.getElementById('export-btn');
 const commitBtn = document.getElementById('commit-btn');
 const checkinSelectedBtn = document.getElementById('checkin-selected-btn');
 const noResultsMessage = document.getElementById('no-results');
 const notificationArea = document.getElementById('notification-area');
 
 // Photo Modal Elements
 const photoModal = document.getElementById('photo-modal');
 const modalCloseBtn = photoModal.querySelector('.close-btn');
 const modalCancelBtn = photoModal.querySelector('#cancel-modal-btn');
 const modalVideo = photoModal.querySelector('#camera-video');
 const modalCanvas = photoModal.querySelector('#canvas');
 const modalCaptureBtn = photoModal.querySelector('#capture-btn');
 const modalRetakeBtn = photoModal.querySelector('#retake-btn');
 const modalConfirmBtn = photoModal.querySelector('#confirm-btn');
 const modalAthleteInfo = photoModal.querySelector('#modal-athlete-info');
 const modalCameraError = photoModal.querySelector('#camera-error');
 
 
 // --- Utility Functions ---
 
 /**
  * Debounce function to limit the rate at which a function can fire.
  * @param {Function} func Function to debounce.
  * @param {number} delay Delay in milliseconds.
  * @returns {Function} Debounced function.
  */
 function debounce(func, delay) {
     let timeoutId;
     return function(...args) {
         clearTimeout(timeoutId);
         timeoutId = setTimeout(() => {
             func.apply(this, args);
         }, delay);
     };
 }
 
 /**
  * Shows the loading indicator.
  */
 function showLoader() {
     if (loader) loader.style.display = 'block';
     if (athletesListContainer) athletesListContainer.style.display = 'none';
     if (noResultsMessage) noResultsMessage.style.display = 'none';
 }
 
 /**
  * Hides the loading indicator.
  */
 function hideLoader() {
     if (loader) loader.style.display = 'none';
     if (athletesListContainer) athletesListContainer.style.display = 'grid'; // Use grid display
 }
 
 /**
  * Formats a Date object into "DD/MM/YYYY HH:MM".
  * @param {Date} date Date object.
  * @returns {string} Formatted date string.
  */
 function formatDate(date) {
     if (!date || !(date instanceof Date)) return '';
     const day = String(date.getDate()).padStart(2, '0');
     const month = String(date.getMonth() + 1).padStart(2, '0');
     const year = date.getFullYear();
     const hours = String(date.getHours()).padStart(2, '0');
     const minutes = String(date.getMinutes()).padStart(2, '0');
     return `${day}/${month}/${year} ${hours}:${minutes}`;
 }
 
 /**
  * Shows a notification message.
  * @param {string} message The message to display.
  * @param {'success' | 'error' | 'info'} type The type of notification.
  * @param {number} duration Duration in milliseconds.
  */
 function showNotification(message, type = 'info', duration = 4000) {
     if (!notificationArea) return;
 
     const notification = document.createElement('div');
     notification.className = `notification ${type}`;
     notification.textContent = message;
 
     // Set animation duration
     notification.style.animationDuration = '0.5s, 0.5s'; // In, Out
     notification.style.animationDelay = `0s, ${duration / 1000 - 0.5}s`; // Delay fadeOut
 
     notificationArea.appendChild(notification);
 
     // Remove notification after animation finishes
     setTimeout(() => {
         notification.remove();
     }, duration);
 }
 
 // --- Data Fetching and Processing ---
 
 /**
  * Fetches athlete data from Google Sheets API.
  */
 async function fetchAthletes() {
     showLoader();
     console.log('Fetching athletes...');
     try {
         // !!! SECURITY WARNING: Using API Key in client-side is insecure !!!
         const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Athletes?key=${API_KEY}`);
         if (!response.ok) {
             throw new Error(`HTTP error! status: ${response.status}`);
         }
         const data = await response.json();
         if (!data.values) {
              throw new Error('No data found in sheet.');
         }
         processData(data.values);
         console.log(`Fetched ${athletes.length} athletes.`);
         showNotification('Danh sách VĐV đã được cập nhật.', 'success', 2000);
     } catch (error) {
         console.error('Error fetching data from Google Sheets:', error);
         showNotification('Lỗi khi tải dữ liệu từ Google Sheets. Sử dụng dữ liệu mẫu.', 'error');
         useTestData(); // Fallback to test data
     } finally {
         applyFilters(); // Apply filters even if using test data
         hideLoader();
     }
 }
 
 /**
  * Processes raw data from Google Sheets into structured athlete objects.
  * @param {Array<Array<string>>} values The raw rows from the sheet.
  */
 function processData(values) {
     const headers = values[0].map(h => h.toLowerCase().trim()); // Normalize headers
     const idIndex = headers.indexOf('id');
     const nameIndex = headers.indexOf('name');
     const genderIndex = headers.indexOf('gender');
     const distanceIndex = headers.indexOf('distance');
     const bibIndex = headers.indexOf('bib');
     const checkedInIndex = headers.indexOf('checkedin'); // Consistent lower case
     const checkinTimeIndex = headers.indexOf('checkintime');
     const photoUrlIndex = headers.indexOf('photourl');
 
     if (idIndex === -1 || nameIndex === -1 || bibIndex === -1) {
         console.error('Missing required columns (id, name, bib) in Google Sheet.');
         showNotification('Lỗi cấu trúc bảng tính: Thiếu cột ID, Name hoặc BIB.', 'error');
         athletes = []; // Clear athletes if structure is wrong
         return;
     }
 
     athletes = values.slice(1).map((row, index) => {
         // Basic validation
         const id = row[idIndex] || `generated-${index}`; // Generate fallback ID if missing
         const name = row[nameIndex] || 'N/A';
         const bib = row[bibIndex] || 'N/A';
 
         return {
             id: id.toString().trim(),
             name: name.toString().trim(),
             gender: (row[genderIndex] || '').toString().trim(),
             distance: (row[distanceIndex] || '').toString().trim().toUpperCase(),
             bib: bib.toString().trim(),
             checkedIn: (row[checkedInIndex] || 'false').toString().toLowerCase() === 'true',
             checkinTime: (row[checkinTimeIndex] || '').toString().trim(),
             photoUrl: (row[photoUrlIndex] || '').toString().trim()
         };
     });
 }
 
 /**
  * Uses predefined test data if fetching fails.
  */
 function useTestData() {
     console.warn("Using test data because fetch failed.");
     athletes = [
         { id: '1', name: 'Nguyễn Văn A', gender: 'Nam', distance: '10KM', bib: '1001', checkedIn: false, checkinTime: '', photoUrl: '' },
         { id: '2', name: 'Trần Thị B', gender: 'Nữ', distance: '5KM', bib: '5001', checkedIn: true, checkinTime: '01/01/2024 08:30', photoUrl: 'https://via.placeholder.com/80/00FF00/FFFFFF?text=B' },
         { id: '3', name: 'Lê Văn C', gender: 'Nam', distance: '10KM', bib: '1002', checkedIn: false, checkinTime: '', photoUrl: 'https://via.placeholder.com/80/0000FF/FFFFFF?text=C' },
         { id: '4', name: 'Phạm Thị D', gender: 'Nữ', distance: '10KM', bib: '1003', checkedIn: false, checkinTime: '', photoUrl: '' },
         { id: '5', name: 'Hoàng Văn E', gender: 'Nam', distance: '5KM', bib: '5002', checkedIn: false, checkinTime: '', photoUrl: '' },
     ];
 }
 
 // --- UI Rendering and Filtering ---
 
 /**
  * Renders the list of athletes based on the `filteredAthletes` array.
  */
 function renderAthletes() {
     if (!athletesListContainer) return;
 
     athletesListContainer.innerHTML = ''; // Clear previous list
 
     if (filteredAthletes.length === 0) {
         noResultsMessage.style.display = 'block';
         athletesListContainer.style.display = 'none'; // Hide grid container
     } else {
         noResultsMessage.style.display = 'none';
          athletesListContainer.style.display = 'grid'; // Ensure grid is visible
 
         const fragment = document.createDocumentFragment();
         filteredAthletes.forEach(athlete => {
             const card = document.createElement('div');
             card.className = `athlete-card ${athlete.checkedIn ? 'checked-in' : ''} ${selectedAthleteIds.has(athlete.id) ? 'selected' : ''}`;
             card.dataset.id = athlete.id;
             card.setAttribute('role', 'button');
             card.setAttribute('tabindex', '0'); // Make it focusable
             card.setAttribute('aria-label', `Vận động viên ${athlete.name}, BIB ${athlete.bib}`);
 
             const photoUrl = athlete.photoUrl || 'https://via.placeholder.com/80/CCCCCC/FFFFFF?text=No+Image';
             const checkinStatusText = athlete.checkedIn ? 'Đã check-in' : 'Chưa check-in';
             const checkinStatusClass = athlete.checkedIn ? 'checked' : 'not-checked';
 
             card.innerHTML = `
                 <div class="athlete-photo">
                     <img src="${photoUrl}" alt="Ảnh VĐV ${athlete.name}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/80/CCCCCC/FFFFFF?text=Error';">
                 </div>
                 <div class="athlete-info">
                     <div class="athlete-name">${athlete.name}</div>
                     <div class="athlete-details">
                         <span class="athlete-bib">BIB: ${athlete.bib}</span> |
                         <span>${athlete.distance || 'N/A'}</span> |
                         <span>${athlete.gender || 'N/A'}</span>
                     </div>
                     <div class="checkin-status ${checkinStatusClass}">${checkinStatusText}</div>
                     ${athlete.checkinTime ? `<div class="checkin-time">Lúc: ${athlete.checkinTime}</div>` : ''}
                 </div>
             `;
             fragment.appendChild(card);
         });
         athletesListContainer.appendChild(fragment);
     }
 
     updateResultsCount();
 }
 
 /**
  * Updates the results count display.
  */
 function updateResultsCount() {
     if (resultsCountSpan) {
         resultsCountSpan.textContent = `[${filteredAthletes.length}/${athletes.length}]`;
     }
      // Toggle checkin selected button based on selection
     checkinSelectedBtn.disabled = selectedAthleteIds.size === 0;
     checkinSelectedBtn.title = selectedAthleteIds.size === 0 ? "Chọn ít nhất một VĐV để check-in" : `Check-in ${selectedAthleteIds.size} VĐV đã chọn`;
 
 }
 
 /**
  * Applies current filters (search, distance, gender) to the athletes list.
  */
 function applyFilters() {
     const searchTerm = searchInput.value.toLowerCase().trim();
     const selectedDistance = distanceFilterGroup.querySelector('.active')?.dataset.filter || 'all';
     const selectedGender = genderFilterGroup.querySelector('.active')?.dataset.gender || 'all';
 
     filteredAthletes = athletes.filter(athlete => {
         const nameMatch = athlete.name.toLowerCase().includes(searchTerm);
         const bibMatch = athlete.bib.toLowerCase().includes(searchTerm);
         const distanceMatch = selectedDistance === 'all' || athlete.distance === selectedDistance;
         // Allow filtering by 'Nam'/'Nữ' case-insensitively, handle empty gender
         const genderMatch = selectedGender === 'all' || (athlete.gender && athlete.gender.toLowerCase() === selectedGender.toLowerCase());
 
         return (nameMatch || bibMatch) && distanceMatch && genderMatch;
     });
 
     renderAthletes();
 }
 
 // Debounced version of applyFilters for search input
 const debouncedApplyFilters = debounce(applyFilters, 300);
 
 // --- Check-in Logic ---
 
 /**
  * Initiates the check-in process for a single athlete.
  * @param {string} athleteId The ID of the athlete to check in.
  */
 function checkInAthlete(athleteId) {
     const athlete = athletes.find(a => a.id === athleteId);
     if (!athlete) {
         showNotification(`Không tìm thấy VĐV với ID: ${athleteId}`, 'error');
         return;
     }
     if (athlete.checkedIn) {
         showNotification(`${athlete.name} (BIB: ${athlete.bib}) đã check-in rồi.`, 'info');
         return;
     }
 
     currentModalAthlete = athlete;
     // Clear selection when initiating check-in for a single athlete
     deselectAllAthletes();
     showPhotoModal();
 }
 
 /**
  * Initiates check-in for all currently selected athletes.
  */
 function checkInSelectedAthletes() {
     if (selectedAthleteIds.size === 0) {
         showNotification('Vui lòng chọn ít nhất một VĐV để check-in.', 'info');
         return;
     }
 
     const athletesToCheckIn = Array.from(selectedAthleteIds)
                                   .map(id => athletes.find(a => a.id === id))
                                   .filter(a => a && !a.checkedIn); // Only check-in those not already checked in
 
     if (athletesToCheckIn.length === 0) {
         showNotification('Tất cả VĐV đã chọn đều đã check-in.', 'info');
         deselectAllAthletes(); // Clear selection as action is complete
         return;
     }
 
      // For simplicity, we'll process the first selected athlete in the modal.
      // A more advanced UX might allow skipping photos or batch processing without photos.
      checkInAthlete(athletesToCheckIn[0].id);
 
      // Keep others selected? Or clear selection after initiating? Let's clear.
      // If the user cancels the modal, they'll need to re-select.
       // Note: The current modal flow only handles one photo at a time.
       // Batch check-in *with* photos would need a queueing mechanism or different UI.
 }
 
 
 // ... (Phần đầu của script.js giữ nguyên) ...
 
 // --- Check-in Logic ---
 
 // ... (hàm checkInAthlete, checkInSelectedAthletes giữ nguyên) ...
 
 /**
  * Shows the photo capture modal.
  */
 async function showPhotoModal() {
     if (!currentModalAthlete) return;
 
     // Reset modal state
     modalVideo.style.display = 'block';
     modalCanvas.style.display = 'none';
     modalCaptureBtn.style.display = 'inline-block';
     modalRetakeBtn.style.display = 'none';
     modalConfirmBtn.style.display = 'none';
     modalCameraError.style.display = 'none';
     // Reset modal state VERY carefully
     modalVideo.style.display = 'block'; // Ensure video is visible initially
     modalCanvas.style.display = 'none'; // Ensure canvas is hidden
     modalCaptureBtn.style.display = 'inline-block'; // Show capture button
     modalRetakeBtn.style.display = 'none'; // Hide retake button
     modalConfirmBtn.style.display = 'none'; // Hide confirm button
     modalCameraError.style.display = 'none'; // Hide error message
     modalAthleteInfo.textContent = `VĐV: ${currentModalAthlete.name} (BIB: ${currentModalAthlete.bib})`;
     // Reset confirm button state in case it was left disabled/loading
     modalConfirmBtn.disabled = false;
     modalConfirmBtn.innerHTML = '<i class="fas fa-check"></i> Xác nhận Check-in';
 
 
     photoModal.setAttribute('aria-hidden', 'false');
     // Optionally focus the capture button for accessibility
     // setTimeout(() => modalCaptureBtn.focus(), 100);
 
     try {
         // Prefer back camera for QR, maybe front for check-in photos?
         const constraints = { video: { facingMode: 'user' } }; // 'user' for front camera
         console.log("Requesting camera stream...");
         const constraints = { video: { facingMode: 'user' } };
         cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
         console.log("Camera stream obtained.");
         modalVideo.srcObject = cameraStream;
         modalVideo.play(); // Ensure video plays
 
         // Important: Wait for video metadata to load to get dimensions correctly
         await new Promise((resolve, reject) => {
             modalVideo.onloadedmetadata = () => {
                 console.log("Video metadata loaded.");
                 resolve();
             };
             modalVideo.onerror = (e) => {
                  console.error("Video element error:", e);
                  reject(new Error("Lỗi tải video từ camera"));
             }
             // Add a timeout in case loadedmetadata never fires
             setTimeout(() => reject(new Error("Hết thời gian chờ video metadata")), 5000);
         });
 
         // Play the video *after* metadata is loaded
         await modalVideo.play();
         console.log("Video playing.");
 
 
     } catch (error) {
         console.error('Error accessing camera:', error);
         modalCameraError.textContent = `Lỗi camera: ${error.name}. Vui lòng cấp quyền và thử lại.`;
         console.error('Error accessing or playing camera:', error);
         modalCameraError.textContent = `Lỗi camera: ${error.name} - ${error.message}. Vui lòng cấp quyền và thử lại.`;
         modalCameraError.style.display = 'block';
         modalCaptureBtn.style.display = 'none'; // Disable capture if no camera
         // Optionally disable confirm too?
         // Stop any partial stream
         hidePhotoModal(); // Clean up stream tracks etc.
         photoModal.setAttribute('aria-hidden', 'true'); // Ensure modal is hidden if setup failed badly
     }
 }
 
 /**
  * Hides the photo capture modal and cleans up resources.
  */
 function hidePhotoModal() {
     console.log("Hiding photo modal and cleaning up camera stream.");
     if (cameraStream) {
         cameraStream.getTracks().forEach(track => track.stop());
         cameraStream = null; // Clear the stream
         cameraStream.getTracks().forEach(track => {
             track.stop();
             console.log(`Camera track stopped: ${track.kind}`);
         });
         cameraStream = null; // Clear the stream variable
     }
     if (modalVideo) { // Check if modalVideo exists
         modalVideo.srcObject = null; // Release video source
         modalVideo.pause(); // Ensure video is paused
         modalVideo.removeAttribute('src'); // Clean up src attribute too
     }
     modalVideo.srcObject = null; // Release video source
     photoModal.setAttribute('aria-hidden', 'true');
     currentModalAthlete = null; // Clear the athlete being processed
     // Reset button states just in case
     modalCaptureBtn.style.display = 'inline-block';
     modalRetakeBtn.style.display = 'none';
     modalConfirmBtn.style.display = 'none';
 
     // Explicitly reset styles again for safety
     if (modalVideo) modalVideo.style.display = 'block';
     if (modalCanvas) modalCanvas.style.display = 'none';
     if (modalCaptureBtn) modalCaptureBtn.style.display = 'inline-block';
     if (modalRetakeBtn) modalRetakeBtn.style.display = 'none';
     if (modalConfirmBtn) modalConfirmBtn.style.display = 'none';
     if (modalCameraError) modalCameraError.style.display = 'none';
     if (modalConfirmBtn) {
          modalConfirmBtn.disabled = false;
          modalConfirmBtn.innerHTML = '<i class="fas fa-check"></i> Xác nhận Check-in';
     }
 
 }
 
 /**
  * Captures a photo from the video stream onto the canvas.
  */
 function capturePhoto() {
     if (!cameraStream || !modalVideo.readyState >= modalVideo.HAVE_CURRENT_DATA) {
         showNotification("Camera chưa sẵn sàng.", "error");
     console.log("Attempting to capture photo...");
     // Check if video is ready and has dimensions
     if (!cameraStream || !modalVideo || modalVideo.readyState < modalVideo.HAVE_METADATA || !modalVideo.videoWidth || !modalVideo.videoHeight) {
         showNotification("Camera chưa sẵn sàng hoặc video chưa tải.", "error");
         console.error("Capture failed: Video not ready or dimensions unknown.", {
              readyState: modalVideo?.readyState,
              videoWidth: modalVideo?.videoWidth,
              videoHeight: modalVideo?.videoHeight
              });
         return;
     }
 
     const context = modalCanvas.getContext('2d');
     // Set canvas dimensions based on video aspect ratio to avoid distortion
     const aspectRatio = modalVideo.videoWidth / modalVideo.videoHeight;
     modalCanvas.width = modalVideo.videoWidth; // Use actual video width
     modalCanvas.height = modalVideo.videoHeight; // Use actual video height
     try {
         const context = modalCanvas.getContext('2d');
 
         // Set canvas dimensions explicitly *before* drawing
         // Use actual video dimensions to avoid distortion
         modalCanvas.width = modalVideo.videoWidth;
         modalCanvas.height = modalVideo.videoHeight;
         console.log(`Canvas dimensions set to: ${modalCanvas.width}x${modalCanvas.height}`);
 
 
     // Draw the current video frame to the canvas
     context.drawImage(modalVideo, 0, 0, modalCanvas.width, modalCanvas.height);
         // Draw the current video frame to the canvas
         context.drawImage(modalVideo, 0, 0, modalCanvas.width, modalCanvas.height);
         console.log("drawImage called successfully.");
 
     // Show canvas, hide video
     modalVideo.style.display = 'none';
     modalCanvas.style.display = 'block';
 
     // Update button visibility
     modalCaptureBtn.style.display = 'none';
     modalRetakeBtn.style.display = 'inline-block';
     modalConfirmBtn.style.display = 'inline-block';
         // --- CRITICAL: Update display styles ---
         modalVideo.style.display = 'none';   // Hide video
         modalCanvas.style.display = 'block'; // Show canvas
         console.log("Display styles updated: video hidden, canvas shown.");
 
     // Pause the video stream to save resources maybe? Optional.
     // modalVideo.pause();
 
         // Update button visibility
         modalCaptureBtn.style.display = 'none';
         modalRetakeBtn.style.display = 'inline-block';
         modalConfirmBtn.style.display = 'inline-block';
         console.log("Button visibility updated.");
 
 
         // Optional: Pause video stream after capture if needed
         // modalVideo.pause();
 
     } catch (error) {
          console.error("Error during photo capture (drawing or style update):", error);
          showNotification("Lỗi khi chụp ảnh.", "error");
          // Optionally reset to camera view on error?
          // retakePhoto();
     }
 }
 
 /**
  * Switches back to the live camera view from the captured photo.
  */
 function retakePhoto() {
     modalVideo.style.display = 'block';
     modalCanvas.style.display = 'none';
     // modalVideo.play(); // Ensure video plays if paused
     console.log("Retaking photo...");
     if (!modalVideo || !modalCanvas) return; // Safety check
 
     modalVideo.style.display = 'block'; // Show video
     modalCanvas.style.display = 'none'; // Hide canvas
 
     // Ensure video plays if it was paused
     // if (modalVideo.paused) {
     //     modalVideo.play().catch(e => console.error("Error resuming video:", e));
     // }
 
     // Reset button visibility
     modalCaptureBtn.style.display = 'inline-block';
     modalRetakeBtn.style.display = 'none';
     modalConfirmBtn.style.display = 'none';
     console.log("Retake successful: video shown, canvas hidden, buttons reset.");
 }
 
 /**
  * Confirms the captured photo and proceeds with the check-in update.
  */
 async function confirmCheckIn() {
     if (!currentModalAthlete || modalCanvas.style.display === 'none') return;
     // Double-check required elements and state
     if (!currentModalAthlete || !modalCanvas || modalCanvas.style.display === 'none') {
         console.error("ConfirmCheckIn called in invalid state.", { currentModalAthlete, modalCanvasExists: !!modalCanvas, canvasVisible: modalCanvas?.style.display !== 'none' });
         showNotification("Không có ảnh để xác nhận hoặc VĐV không hợp lệ.", "error");
         return;
     }
 
     modalConfirmBtn.disabled = true; // Prevent double clicks
     modalConfirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
     console.log(`Confirming check-in for athlete ID: ${currentModalAthlete.id}`);
 
     let photoDataUrl = '';
     try {
         // Get image data (consider quality/size)
         const photoDataUrl = modalCanvas.toDataURL('image/jpeg', 0.8); // Use JPEG with compression
         // Get image data (use JPEG for smaller size, adjust quality 0.0-1.0)
         photoDataUrl = modalCanvas.toDataURL('image/jpeg', 0.85); // Quality 0.85
         console.log(`Generated photo Data URL (length: ${photoDataUrl.length})`);
         if (!photoDataUrl || photoDataUrl === 'data:,') {
              throw new Error("Canvas toDataURL returned empty or invalid data.");
         }
 
         // --- Update Google Sheet ---
         // We use the Web App URL which should handle authentication securely on the server-side (Google Apps Script)
     } catch (error) {
         console.error('Error getting photo data from canvas:', error);
         showNotification('Lỗi xử lý ảnh chụp. Không thể tiếp tục.', 'error');
         modalConfirmBtn.disabled = false; // Re-enable button
         modalConfirmBtn.innerHTML = '<i class="fas fa-check"></i> Xác nhận Check-in';
         return; // Stop the process
     }
 
     // --- Now attempt to update Google Sheet ---
     try {
         // Pass the generated photoDataUrl
         const success = await updateGoogleSheet(currentModalAthlete.id, photoDataUrl);
 
         if (success) {
             // Update local data immediately for responsiveness
             const athleteIndex = athletes.findIndex(a => a.id === currentModalAthlete.id);
             if (athleteIndex > -1) {
                 athletes[athleteIndex].checkedIn = true;
                 athletes[athleteIndex].checkinTime = formatDate(new Date());
                 athletes[athleteIndex].photoUrl = photoDataUrl; // Store locally temporarily, GSheet update is the source of truth
                 // Don't store the full base64 locally long-term unless necessary,
                 // but okay for immediate render update. The GSheet is source of truth.
                 athletes[athleteIndex].photoUrl = photoDataUrl;
                 console.log(`Local athlete data updated for ID: ${currentModalAthlete.id}`);
             } else {
                  console.warn(`Athlete ID ${currentModalAthlete.id} not found in local array after successful update.`);
             }
 
             showNotification(`VĐV ${currentModalAthlete.name} (BIB: ${currentModalAthlete.bib}) đã check-in thành công!`, 'success');
 
             // Deselect the athlete if they were selected
             deselectAthlete(currentModalAthlete.id);
 
             // Re-render the list to show updated status
             applyFilters();
             applyFilters(); // applyFilters calls renderAthletes
 
              // Check if there are more selected athletes to process (basic queue)
             const remainingSelected = Array.from(selectedAthleteIds)
                                           .map(id => athletes.find(a => a.id === id))
                                           .filter(a => a && !a.checkedIn);
 
             if (remainingSelected.length > 0) {
                  console.log(`Processing next selected athlete: ${remainingSelected[0].id}`);
                 // Automatically open modal for the next selected athlete
                 // Small delay to allow notification to be seen
                 setTimeout(() => {
                     checkInAthlete(remainingSelected[0].id);
                 }, 1000);
                     // We need to hide the current modal *before* showing the next
                     // to ensure camera resources are released and re-acquired cleanly.
                     hidePhotoModal();
                     setTimeout(() => { // Add another small delay
                         checkInAthlete(remainingSelected[0].id);
                     }, 100); // Short delay after hide before show
                 }, 800); // Delay after success notification
             } else {
                  console.log("No more selected athletes to check in.");
                  hidePhotoModal(); // Close modal only if no more selected athletes
             }
 
         } else {
             // Error handled within updateGoogleSheet, notification shown there
             // Re-enable button to allow retry
              modalConfirmBtn.disabled = false;
              modalConfirmBtn.innerHTML = '<i class="fas fa-check"></i> Xác nhận Check-in';
              // Optionally allow retrying without closing modal?
              console.log("updateGoogleSheet returned false.");
              // Decide if you want to keep the modal open or close it on failure
              // hidePhotoModal(); // Example: Close modal on failure too
         }
 
     } catch (error) {
         console.error('Error during check-in confirmation:', error);
         showNotification('Có lỗi xảy ra trong quá trình xác nhận check-in.', 'error');
         // This catch block is unlikely to be hit if updateGoogleSheet handles its own errors,
         // but good practice to have it.
         console.error('Unexpected error during check-in confirmation flow:', error);
         showNotification('Có lỗi không mong muốn xảy ra trong quá trình xác nhận.', 'error');
         modalConfirmBtn.disabled = false;
         modalConfirmBtn.innerHTML = '<i class="fas fa-check"></i> Xác nhận Check-in';
         // Decide if you want to keep the modal open or close it on failure
         // hidePhotoModal();
     }
     // Note: The modal might close automatically or stay open depending on success and queue status
     // Note: Modal closure is now handled inside the success/failure logic and queue check.
 }
 
 
 /**
  * Updates the Google Sheet via the Web App URL.
  * @param {string} id Athlete ID.
  * @param {string} photoDataUrl Base64 encoded image data URL.
  * @returns {Promise<boolean>} True if update was successful, false otherwise.
  */
 async function updateGoogleSheet(id, photoDataUrl) {
     const now = new Date();
     const timeString = formatDate(now);
 
     const postData = {
         id: id,
         time: timeString,
         photoUrl: photoDataUrl // Send photo data in the request body
     };
 
     console.log(`Attempting to update Sheet via POST to: ${WEBAPP_URL} for ID: ${id}`);
     console.log(`Data size (photoUrl length): ${photoDataUrl.length}`); // Log size, large URLs can cause issues
 
     // Check URL validity roughly
     if (!WEBAPP_URL || !WEBAPP_URL.startsWith('https://script.google.com/macros/s/')) {
          console.error("Invalid WEBAPP_URL:", WEBAPP_URL);
          showNotification('URL cập nhật Google Sheet không hợp lệ.', 'error');
          return false; // Prevent fetch with bad URL
     }
 
     try {
         const response = await fetch(WEBAPP_URL, {
             method: 'POST',
             mode: 'cors', // Keep cors
             cache: 'no-cache',
             headers: {
                  // IMPORTANT: Your Apps Script doPost(e) MUST be able to parse this.
                  // Common issue: Sending JSON but Apps Script expecting form data or vice versa.
                 'Content-Type': 'application/json',
             },
             body: JSON.stringify(postData), // Send data as JSON string
              redirect: 'follow' // Handle redirects if Apps Script URL changes
         });
 
         console.log(`Fetch response status: ${response.status}`);
 
         // Check if the response is OK (status 200-299)
         if (!response.ok) {
             // Try to get more detailed error message from response body
             let errorMsg = `Lỗi Server: ${response.status} ${response.statusText}`;
             try {
                 // Check content type before assuming JSON
                 const contentType = response.headers.get("content-type");
                 if (contentType && contentType.indexOf("application/json") !== -1) {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorData.message || JSON.stringify(errorData); // Provide more context from JSON error
                     console.error('Server returned JSON error:', errorData);
                 } else {
                     const textError = await response.text(); // Get text error if not JSON
                     errorMsg = textError || errorMsg; // Use text error if available
                     console.error('Server returned non-JSON error:', textError);
                  }
             } catch (e) {
                  console.error("Could not parse error response body:", e);
                  // Use the basic HTTP error if parsing fails
             }
             // Throw the detailed error to be caught below
             throw new Error(errorMsg);
         }
 
         // Assuming the Web App returns JSON with a success status like { success: true } or { result: "success" }
         const data = await response.json();
         console.log('Received response data from Web App:', data);
 
         // Adjust this condition based on the *actual* success response from your Apps Script
         if (data.success === true || data.result === "success") {
             console.log(`Sheet update successful for ID: ${id}`);
             return true; // Indicate success
         } else {
             // Handle cases where the script ran but indicated failure
             const failureMsg = data.error || data.message || 'Apps Script báo cáo lỗi không xác định.';
             console.error('Sheet update failed logically:', failureMsg);
             showNotification(`Lỗi cập nhật Google Sheet: ${failureMsg}`, 'error');
             return false; // Indicate failure
         }
     } catch (error) {
         // This catches network errors (fetch itself failed) OR errors thrown from !response.ok block
         console.error('Error sending update to Google Sheet:', error);
         // Provide a more user-friendly message for common network issues
         let displayError = error.message;
         if (error instanceof TypeError && error.message.includes('Failed to fetch')) { // Common network error
              displayError = 'Lỗi kết nối mạng hoặc không thể truy cập URL cập nhật. Kiểm tra mạng và cấu hình CORS/URL.';
         } else if (error.message.includes('Server returned non-JSON error:')) { // Specific non-JSON error
              displayError = `Server Web App trả về lỗi không đúng định dạng: ${error.message.split(':').slice(1).join(':').trim()}`;
         } else if (error.message.includes('Lỗi Server:')) { // Specific HTTP error
             displayError = `Yêu cầu cập nhật thất bại: ${error.message}`;
         }
         // Default error for other cases
         showNotification(displayError || 'Lỗi không xác định khi gửi cập nhật.', 'error');
         return false; // Indicate failure
     }
 }
 
 
 // ... (Rest of the script.js: QR Code, Export, GitHub, Selection, Event Listeners, Initialization) ...
 
 /**
  * Updates the Google Sheet via the Web App URL.
  * @param {string} id Athlete ID.
  * @param {string} photoDataUrl Base64 encoded image data URL.
  * @returns {Promise<boolean>} True if update was successful, false otherwise.
  */
 async function updateGoogleSheet(id, photoDataUrl) {
     const now = new Date();
     const timeString = formatDate(now);
 
     // Construct the URL for the GET request to the Web App
     // Ensure parameters are URL encoded
     const params = new URLSearchParams({
         id: id,
         time: timeString,
         // Sending large data URLs via GET can fail. POST is preferred.
         // Assuming your Apps Script is set up to handle POST with JSON payload
         // photoUrl: photoDataUrl // Remove if sending via POST body
     });
 
     // Using POST is generally better for sending data, especially large data like image URLs
     const postData = {
         id: id,
         time: timeString,
         photoUrl: photoDataUrl // Send photo data in the request body
     };
 
     console.log(`Updating Sheet for ID: ${id}`);
 
     try {
         // !!! Ensure your Google Apps Script `doPost(e)` is configured to handle this JSON payload !!!
         const response = await fetch(WEBAPP_URL, {
             method: 'POST',
             mode: 'cors', // Required if your Apps Script isn't deployed correctly for anonymous access or needs specific headers
             cache: 'no-cache',
             headers: {
                 'Content-Type': 'application/json',
             },
              // Redirect: 'follow', // Optional: handle redirects if any
              // ReferrerPolicy: 'no-referrer', // Optional: control referrer policy
             body: JSON.stringify(postData) // Send data as JSON string
         });
 
         // Check if the response is OK (status 200-299)
         if (!response.ok) {
             // Try to get error message from response body
             let errorMsg = `HTTP error! status: ${response.status}`;
             try {
                 const errorData = await response.json();
                 errorMsg = errorData.error || errorData.message || errorMsg;
             } catch (e) { /* Ignore if response body is not JSON */ }
             throw new Error(errorMsg);
         }
 
         // Assuming the Web App returns JSON with a success status
         const data = await response.json();
 
         if (data.success) {
             console.log(`Sheet update successful for ID: ${id}`);
             return true;
         } else {
             console.error('Sheet update failed:', data.error || 'Unknown error from Web App');
             showNotification(`Lỗi cập nhật Google Sheet: ${data.error || 'Lỗi không xác định'}`, 'error');
             return false;
         }
     } catch (error) {
         console.error('Error sending update to Google Sheet:', error);
         showNotification(`Lỗi kết nối tới server cập nhật: ${error.message}`, 'error');
         return false;
     }
 }
 
 // --- QR Code Scanning ---
 
 let qrScanner = null; // To hold the video element during scan
 let qrAnimation = null; // To hold the requestAnimationFrame ID
 
 /**
  * Starts the QR code scanning process.
  */
 async function startQrScanning() {
     if (!window.jsQR) {
         showNotification('Thư viện quét QR chưa tải xong.', 'error');
         return;
     }
     if (qrScanner) {
          showNotification('Đang quét QR...', 'info'); // Already scanning
         return;
     }
 
 
     // Create video element dynamically for scanning
     qrScanner = document.createElement('video');
     qrScanner.setAttribute('playsinline', ''); // Important for iOS
     qrScanner.style.position = 'fixed';
     qrScanner.style.top = '0';
     qrScanner.style.left = '0';
     qrScanner.style.width = '100%';
     qrScanner.style.height = '100%';
     qrScanner.style.objectFit = 'cover';
     qrScanner.style.zIndex = '1500'; // Above modal potentially
     document.body.appendChild(qrScanner);
 
      // Add a close button
     const closeScanBtn = document.createElement('button');
     closeScanBtn.textContent = 'Đóng Quét QR';
     closeScanBtn.style.position = 'fixed';
     closeScanBtn.style.bottom = '20px';
     closeScanBtn.style.left = '50%';
     closeScanBtn.style.transform = 'translateX(-50%)';
     closeScanBtn.style.zIndex = '1501';
     closeScanBtn.style.padding = '10px 20px';
     closeScanBtn.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
     closeScanBtn.style.color = 'white';
     closeScanBtn.style.border = 'none';
     closeScanBtn.style.borderRadius = '5px';
     closeScanBtn.onclick = stopQrScanning;
     document.body.appendChild(closeScanBtn);
     qrScanner.closeButton = closeScanBtn; // Store reference for cleanup
 
 
     // Create canvas for processing frames (offscreen)
     const qrCanvas = document.createElement('canvas');
     const qrContext = qrCanvas.getContext('2d', { willReadFrequently: true }); // Optimization hint
 
 
     showNotification('Hướng camera vào mã QR...', 'info', 5000);
 
     try {
         const stream = await navigator.mediaDevices.getUserMedia({
             video: { facingMode: 'environment' } // Prefer back camera
         });
         qrScanner.srcObject = stream;
         qrScanner.play();
 
         // Wait for video to be ready before getting dimensions
          await new Promise(resolve => qrScanner.onloadedmetadata = resolve);
 
 
         qrCanvas.width = qrScanner.videoWidth;
         qrCanvas.height = qrScanner.videoHeight;
 
         function scanFrame() {
             if (!qrScanner || !qrScanner.srcObject) return; // Stop if scanner closed
 
              try {
                 // Ensure canvas size matches video in case it changes (e.g., orientation)
                  if(qrCanvas.width !== qrScanner.videoWidth || qrCanvas.height !== qrScanner.videoHeight) {
                     qrCanvas.width = qrScanner.videoWidth;
                     qrCanvas.height = qrScanner.videoHeight;
                  }
 
                 qrContext.drawImage(qrScanner, 0, 0, qrCanvas.width, qrCanvas.height);
                 const imageData = qrContext.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
                 const code = jsQR(imageData.data, imageData.width, imageData.height, {
                      inversionAttempts: "dontInvert", // Optimization
                 });
 
 
                 if (code && code.data) {
                     console.log('QR Code detected:', code.data);
                     stopQrScanning(); // Stop scanning immediately
                     processQrCode(code.data);
                 } else {
                     // Continue scanning
                     qrAnimation = requestAnimationFrame(scanFrame);
                 }
              } catch (scanError) {
                  console.error("Error during QR frame scan:", scanError);
                  // Continue scanning unless it's a fatal error
                  if (qrScanner && qrScanner.srcObject) {
                      qrAnimation = requestAnimationFrame(scanFrame);
                  } else {
                      stopQrScanning(); // Ensure cleanup if scanner is gone
                  }
              }
         }
 
         qrAnimation = requestAnimationFrame(scanFrame);
 
     } catch (error) {
         console.error('Error accessing camera for QR scanning:', error);
         showNotification(`Lỗi camera QR: ${error.name}. Vui lòng cấp quyền.`, 'error');
         stopQrScanning(); // Clean up if camera access failed
     }
 }
 
 /**
  * Stops the QR code scanning process and cleans up resources.
  */
 function stopQrScanning() {
     if (qrAnimation) {
         cancelAnimationFrame(qrAnimation);
         qrAnimation = null;
     }
     if (qrScanner) {
         if (qrScanner.srcObject) {
             qrScanner.srcObject.getTracks().forEach(track => track.stop());
             qrScanner.srcObject = null;
         }
          if (qrScanner.closeButton) {
             qrScanner.closeButton.remove(); // Remove close button
         }
         qrScanner.remove(); // Remove video element
         qrScanner = null;
     }
      console.log('QR Scanning stopped.');
 }
 
 /**
  * Processes the data obtained from the QR code.
  * @param {string} qrData The data string from the QR code.
  */
 function processQrCode(qrData) {
     // Assuming the QR code contains the athlete's BIB number or ID
     // Try to find athlete by BIB first, then by ID if BIB fails
     qrData = qrData.trim();
     console.log(`Processing QR data: "${qrData}"`);
 
     let foundAthlete = athletes.find(a => a.bib && a.bib.toLowerCase() === qrData.toLowerCase());
 
     if (!foundAthlete) {
         foundAthlete = athletes.find(a => a.id && a.id.toLowerCase() === qrData.toLowerCase());
     }
 
     if (foundAthlete) {
         showNotification(`Tìm thấy VĐV: ${foundAthlete.name} (BIB: ${foundAthlete.bib})`, 'success');
         // Scroll to the athlete? Optional UX enhancement
         // Highlight the card? Optional UX enhancement
         checkInAthlete(foundAthlete.id); // Start check-in process
     } else {
         showNotification(`Không tìm thấy VĐV nào khớp với mã QR: ${qrData}`, 'error');
     }
 }
 
 
 // --- Data Export and GitHub Commit ---
 
 /**
  * Exports the currently filtered and checked-in athletes to a JSON file.
  */
 function exportToJson() {
     const dataToExport = filteredAthletes
         .filter(a => a.checkedIn) // Only export checked-in athletes from the current view
         .map(({ id, name, bib, distance, gender, checkinTime, photoUrl }) => ({ // Select relevant fields
             id, name, bib, distance, gender, checkinTime,
             // Optionally exclude large photoUrl data from simple export
             // photoUrl: photoUrl ? photoUrl.substring(0, 50) + '...' : ''
         }));
 
     if (dataToExport.length === 0) {
         showNotification('Không có VĐV đã check-in nào trong bộ lọc hiện tại để xuất.', 'info');
         return;
     }
 
     const jsonString = JSON.stringify(dataToExport, null, 2); // Pretty print JSON
     const blob = new Blob([jsonString], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
     a.download = `checked_in_athletes_${timestamp}.json`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);
     showNotification(`Đã xuất ${dataToExport.length} VĐV ra file JSON.`, 'success');
 }
 
 /**
  * Commits the full athlete data (including check-in status) to GitHub.
  */
 async function commitToGitHub() {
      // !!! SECURITY WARNING: Using PAT Token in client-side is extremely insecure !!!
      // This function demonstrates the API call but should ideally be done server-side.
      if (!GITHUB_TOKEN || GITHUB_TOKEN === 'YOUR_GITHUB_PAT_TOKEN_HERE') {
         showNotification('Token GitHub chưa được cấu hình (INSECURE). Không thể đẩy dữ liệu.', 'error');
         console.error('GitHub token is missing or placeholder.');
         return;
      }
 
     commitBtn.disabled = true;
     commitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đẩy...';
 
     // Prepare the full data payload
     const dataToCommit = athletes.map(a => ({ ...a })); // Create a copy
     const content = JSON.stringify(dataToCommit, null, 2);
     const encodedContent = btoa(unescape(encodeURIComponent(content))); // Base64 encode
 
 
     const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
 
     try {
         // 1. Get the current file's SHA (required for updating)
         let currentSha = null;
         try {
             const getResponse = await fetch(GITHUB_API_URL + `?ref=${GITHUB_BRANCH}`, {
                 headers: {
                     'Authorization': `token ${GITHUB_TOKEN}`,
                     'Accept': 'application/vnd.github.v3+json'
                 }
             });
             if (getResponse.ok) {
                 const fileData = await getResponse.json();
                 currentSha = fileData.sha;
                  console.log("Current file SHA:", currentSha);
             } else if (getResponse.status !== 404) { // Don't throw if file just doesn't exist yet
                  throw new Error(`GitHub GET error: ${getResponse.status}`);
             }
         } catch (getError) {
             console.warn("Could not get current file SHA (maybe file doesn't exist yet):", getError);
             // Proceeding without SHA will create the file if it doesn't exist
         }
 
 
         // 2. Create or Update the file
         const commitMessage = `Update athlete data - ${new Date().toISOString()}`;
         const payload = {
             message: commitMessage,
             content: encodedContent,
             branch: GITHUB_BRANCH,
             ...(currentSha && { sha: currentSha }) // Include SHA only if updating an existing file
         };
 
         const putResponse = await fetch(GITHUB_API_URL, {
             method: 'PUT',
             headers: {
                 'Authorization': `token ${GITHUB_TOKEN}`,
                 'Accept': 'application/vnd.github.v3+json',
                 'Content-Type': 'application/json'
             },
             body: JSON.stringify(payload)
         });
 
         if (putResponse.ok) {
             const result = await putResponse.json();
             console.log('GitHub commit successful:', result);
             showNotification('Đẩy dữ liệu lên GitHub thành công!', 'success');
         } else {
             const errorData = await putResponse.json();
             console.error('GitHub commit failed:', putResponse.status, errorData);
             throw new Error(`GitHub PUT error: ${putResponse.status} - ${errorData.message}`);
         }
 
     } catch (error) {
         console.error('Error committing to GitHub:', error);
         showNotification(`Lỗi khi đẩy lên GitHub: ${error.message}`, 'error');
     } finally {
         commitBtn.disabled = false;
         commitBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Đẩy lên GitHub';
     }
 }
 
 // --- Athlete Selection Logic ---
 
 /**
  * Toggles the selection state of an athlete card.
  * @param {string} athleteId The ID of the athlete to toggle.
  */
 function toggleAthleteSelection(athleteId) {
     const card = athletesListContainer.querySelector(`.athlete-card[data-id="${athleteId}"]`);
     if (!card) return;
 
     if (selectedAthleteIds.has(athleteId)) {
         selectedAthleteIds.delete(athleteId);
         card.classList.remove('selected');
         card.setAttribute('aria-pressed', 'false');
     } else {
         selectedAthleteIds.add(athleteId);
         card.classList.add('selected');
         card.setAttribute('aria-pressed', 'true');
     }
     updateResultsCount(); // Update button states based on selection
 }
 
 /**
  * Deselects a specific athlete.
  * @param {string} athleteId The ID of the athlete to deselect.
  */
 function deselectAthlete(athleteId) {
      if (selectedAthleteIds.has(athleteId)) {
         selectedAthleteIds.delete(athleteId);
         const card = athletesListContainer.querySelector(`.athlete-card[data-id="${athleteId}"]`);
         if (card) {
             card.classList.remove('selected');
             card.setAttribute('aria-pressed', 'false');
         }
         updateResultsCount();
     }
 }
 
 /**
  * Deselects all currently selected athletes.
  */
 function deselectAllAthletes() {
     selectedAthleteIds.forEach(id => {
          const card = athletesListContainer.querySelector(`.athlete-card[data-id="${id}"]`);
         if (card) {
             card.classList.remove('selected');
             card.setAttribute('aria-pressed', 'false');
         }
     });
     selectedAthleteIds.clear();
     updateResultsCount();
 }
 
 // --- Event Listeners ---
 
 /**
  * Sets up all event listeners for the application.
  */
 function setupEventListeners() {
     // Search Input
     searchInput.addEventListener('input', debouncedApplyFilters);
 
     // Refresh Button
     refreshBtn.addEventListener('click', fetchAthletes);
 
     // Filter Buttons (Distance & Gender) - Using Event Delegation
     distanceFilterGroup.addEventListener('click', (e) => {
         if (e.target.matches('.filter-btn')) {
             distanceFilterGroup.querySelectorAll('.filter-btn').forEach(btn => {
                 btn.classList.remove('active');
                 btn.setAttribute('aria-pressed', 'false');
             });
             e.target.classList.add('active');
             e.target.setAttribute('aria-pressed', 'true');
             applyFilters();
         }
     });
 
     genderFilterGroup.addEventListener('click', (e) => {
         if (e.target.matches('.filter-btn')) {
             genderFilterGroup.querySelectorAll('.filter-btn').forEach(btn => {
                  btn.classList.remove('active');
                  btn.setAttribute('aria-pressed', 'false');
             });
             e.target.classList.add('active');
             e.target.setAttribute('aria-pressed', 'true');
             applyFilters();
         }
     });
 
     // Athlete List - Event Delegation for clicks and keydown
     athletesListContainer.addEventListener('click', (e) => {
         const card = e.target.closest('.athlete-card');
         if (!card) return;
 
         const athleteId = card.dataset.id;
         const athlete = athletes.find(a => a.id === athleteId);
 
         if (!athlete) return;
 
          // Check if clicking on an interactive element inside the card later if needed
          // For now, main click toggles selection, unless already checked in
 
         if (athlete.checkedIn) {
              showNotification(`${athlete.name} đã check-in rồi.`, 'info');
              // Maybe allow viewing details or un-checking (requires more logic)?
         } else {
              // Toggle selection instead of immediate check-in
              toggleAthleteSelection(athleteId);
         }
 
     });
      athletesListContainer.addEventListener('keydown', (e) => {
          const card = e.target.closest('.athlete-card');
          if (!card) return;
         // Allow selection/check-in with Enter or Space key
         if (e.key === 'Enter' || e.key === ' ') {
             e.preventDefault(); // Prevent default space scroll
             const athleteId = card.dataset.id;
             const athlete = athletes.find(a => a.id === athleteId);
             if (athlete && !athlete.checkedIn) {
                 toggleAthleteSelection(athleteId);
             }
         }
     });
 
 
      // Check-in Selected Button
     checkinSelectedBtn.addEventListener('click', checkInSelectedAthletes);
 
 
     // QR Scan Button
     qrScanBtn.addEventListener('click', startQrScanning);
 
     // Export Button
     exportBtn.addEventListener('click', exportToJson);
 
     // Commit Button
     commitBtn.addEventListener('click', commitToGitHub);
 
     // Photo Modal Buttons
     modalCloseBtn.addEventListener('click', hidePhotoModal);
     modalCancelBtn.addEventListener('click', hidePhotoModal);
     modalCaptureBtn.addEventListener('click', capturePhoto);
     modalRetakeBtn.addEventListener('click', retakePhoto);
     modalConfirmBtn.addEventListener('click', confirmCheckIn);
     // Close modal if clicking outside the content
     photoModal.addEventListener('click', (e) => {
         if (e.target === photoModal) {
             hidePhotoModal();
         }
     });
 
     // Keyboard accessibility for modal
      photoModal.addEventListener('keydown', (e) => {
         if (e.key === 'Escape') {
             hidePhotoModal();
         }
     });
 
 }
 
 // --- Initialization ---
 document.addEventListener('DOMContentLoaded', () => {
     console.log('DOM fully loaded and parsed');
     setupEventListeners();
     fetchAthletes(); // Initial data load
 });
