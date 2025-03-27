// --- JavaScript (script.js - Hoàn thiện v3 - Giống bản trước) ---

// --- Configuration ---
// !!! QUAN TRỌNG: Thay thế bằng URL Web App thực tế của bạn sau khi triển khai Apps Script !!!
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec';

// --- Global State ---
let athletes = []; // Holds all athlete data fetched from server
let filteredAthletes = []; // Holds currently displayed athletes
let selectedAthleteIds = new Set(); // Holds IDs of selected athletes for batch check-in
let currentModalAthlete = null; // Athlete being processed in the check-in modal
let cameraStream = null; // Holds the camera stream for cleanup
let isFetching = false; // Flag to prevent concurrent data fetches
let isCommitting = false; // Flag to prevent concurrent GitHub commits

// QR Scanner state
let qrScanner = null; // Holds the video element during scan
let qrAnimation = null; // Holds the requestAnimationFrame ID for QR scanning

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

// Photo Modal Elements - Ensure these IDs match your HTML
const photoModal = document.getElementById('photo-modal');
const modalCloseBtn = photoModal?.querySelector('.close-btn'); // Added optional chaining
const modalCancelBtn = photoModal?.querySelector('#cancel-modal-btn');
const modalVideo = photoModal?.querySelector('#camera-video');
const modalCanvas = photoModal?.querySelector('#canvas');
const modalCaptureBtn = photoModal?.querySelector('#capture-btn');
const modalRetakeBtn = photoModal?.querySelector('#retake-btn');
const modalConfirmBtn = photoModal?.querySelector('#confirm-btn');
const modalAthleteInfo = photoModal?.querySelector('#modal-athlete-info');
const modalCameraError = photoModal?.querySelector('#camera-error');

// --- Utility Functions ---

/** Debounce function */
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}
/** Shows loader */
function showLoader() {
    if (loader) loader.style.display = 'block';
    // Hide list/no-results message while loading
    if (athletesListContainer) athletesListContainer.style.display = 'none';
    if (noResultsMessage) noResultsMessage.style.display = 'none';
}
/** Hides loader */
function hideLoader() {
    if (loader) loader.style.display = 'none';
    // Don't force display here, let renderAthletes handle visibility
}
/** Formats Date */
function formatDate(date) {
    if (!date || !(date instanceof Date)) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}
/** Shows notification */
function showNotification(message, type = 'info', duration = 4000) {
    if (!notificationArea) {
        console.warn("Notification area not found.");
        return;
    }
    // Optional: Limit number of notifications displayed simultaneously
    const MAX_NOTIFICATIONS = 5;
    while (notificationArea.children.length >= MAX_NOTIFICATIONS) {
        notificationArea.removeChild(notificationArea.firstChild);
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.setAttribute('role', type === 'error' ? 'alert' : 'status'); // Role based on type
    notification.style.animationDuration = '0.4s, 0.5s'; // Adjusted timings
    notification.style.animationDelay = `0s, ${duration / 1000 - 0.5}s`;
    notificationArea.appendChild(notification);
    setTimeout(() => { notification.remove(); }, duration);
}


// --- Data Fetching and Processing ---

/** Fetches athlete data from the Apps Script Web App (doGet). */
async function fetchAthletes() {
    if (isFetching) {
        console.log("Fetch already in progress. Skipping.");
        // showNotification("Đang tải dữ liệu...", "info", 1500); // Avoid repetitive notifications
        return;
    }
    isFetching = true;
    showLoader();
    if(refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Đang tải...';
    }
    console.log('Fetching athletes via Web App URL:', WEBAPP_URL);

    try {
        if (!WEBAPP_URL || !WEBAPP_URL.startsWith('https://script.google.com/macros/s/')) {
             throw new Error("WebApp URL không hợp lệ. Vui lòng kiểm tra cấu hình `script.js`.");
        }
        const response = await fetch(WEBAPP_URL);
        console.log(`Fetch response status: ${response.status} ${response.statusText}`);

        const responseText = await response.text();

        if (!response.ok) {
            let errorMsg = `Lỗi ${response.status} khi tải dữ liệu.`;
            try {
                 const errData = JSON.parse(responseText);
                 errorMsg = `Lỗi server (${response.status}): ${errData.error || responseText}`;
            } catch(e){
                errorMsg = `Lỗi ${response.status}: ${responseText || response.statusText}`;
             }
             console.error("Raw Error Response Text:", responseText);
            throw new Error(errorMsg);
        }

        let jsonData;
        try {
             jsonData = JSON.parse(responseText);
        } catch (e) {
             console.error("Failed to parse successful response JSON:", e);
             console.error("Raw Success Response Text:", responseText);
             throw new Error(`Dữ liệu nhận được từ server không hợp lệ (JSON parse error).`);
        }

        if (jsonData.success === false && jsonData.error) { // Check for logical error JSON
             console.error("Server returned logical error:", jsonData.error);
            throw new Error(jsonData.error);
        }

        processDataFromWebApp(jsonData); // Process the valid data

        console.log(`Fetched ${athletes.length} athletes successfully.`);
        if (athletes.length > 0) {
             // showNotification('Danh sách VĐV đã được cập nhật.', 'success', 2000); // Success is implied by display
        } else {
            console.log("Fetched data but the list is empty or invalid.");
            // No results message will be shown by renderAthletes
            // showNotification('Danh sách VĐV trống hoặc không có dữ liệu.', 'info', 3000);
        }

    } catch (error) {
        console.error('Error fetching data:', error); // Log the full error
        showNotification(`Lỗi khi tải dữ liệu: ${error.message}. Vui lòng thử lại.`, 'error', 6000);
        athletes = [];
        filteredAthletes = [];
        renderAthletes(); // Show empty state
    } finally {
        applyFilters(); // Ensure UI consistency
        hideLoader();
        isFetching = false;
         if(refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt" aria-hidden="true"></i> Làm mới';
        }
    }
}

/** Processes data received from the Apps Script doGet endpoint. */
function processDataFromWebApp(jsonData) {
    if (!Array.isArray(jsonData)) {
        console.error("Invalid data format received (expected array):", jsonData);
        throw new Error("Dữ liệu nhận được từ server không hợp lệ.");
    }
    // Map and filter in one step
    athletes = jsonData
        .map((item, index) => {
            // Ensure item is an object
            if (typeof item !== 'object' || item === null) {
                 console.warn(`Skipping invalid item at index ${index}: Not an object.`);
                 return null;
            }

            const id = String(item.id || '').trim();
            const name = String(item.name || '').trim();
            const bib = String(item.bib || '').trim();

            // Basic validation for required fields
            if (!id || !name || !bib) {
                console.warn(`Skipping record at index ${index} due to missing id, name, or bib:`, item);
                return null;
            }

            return {
                id: id,
                name: name,
                gender: String(item.gender || '').trim(),
                distance: String(item.distance || '').trim().toUpperCase(),
                bib: bib,
                checkedIn: item.checkedin === true,
                checkinTime: String(item.checkintime || '').trim(),
                photoUrl: String(item.photourl || '').trim()
            };
        })
        .filter(athlete => athlete !== null); // Remove nulls from invalid records
}

// --- UI Rendering and Filtering ---

/** Renders the list of athletes. */
function renderAthletes() {
    if (!athletesListContainer) {
        console.error("Athlete list container not found!");
        return;
    }
    athletesListContainer.innerHTML = ''; // Clear previous list

    if (filteredAthletes.length === 0) {
        if (noResultsMessage) noResultsMessage.style.display = 'block';
        athletesListContainer.style.display = 'none'; // Hide grid if empty
    } else {
        if (noResultsMessage) noResultsMessage.style.display = 'none';
        athletesListContainer.style.display = 'grid'; // Show grid
        const fragment = document.createDocumentFragment();
        filteredAthletes.forEach(athlete => {
            const card = document.createElement('div');
            card.className = `athlete-card ${athlete.checkedIn ? 'checked-in' : ''} ${selectedAthleteIds.has(athlete.id) ? 'selected' : ''}`;
            card.dataset.id = athlete.id; // Use data attributes for ID
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0'); // Make focusable
            card.setAttribute('aria-label', `Vận động viên ${athlete.name}, BIB ${athlete.bib}${athlete.checkedIn ? ', đã check-in' : ''}`);
            card.setAttribute('aria-pressed', selectedAthleteIds.has(athlete.id) ? 'true' : 'false');

            const photoUrl = athlete.photoUrl || 'https://via.placeholder.com/80/EEEEEE/999999?text=No+Image';
            const checkinStatusText = athlete.checkedIn ? 'Đã check-in' : 'Chưa check-in';
            const checkinStatusClass = athlete.checkedIn ? 'checked' : 'not-checked';

            // Use template literals for cleaner HTML generation
            card.innerHTML = `
                <div class="athlete-photo">
                    <img src="${photoUrl}" alt="Ảnh VĐV ${athlete.name}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/80/FFCCCC/CC0000?text=Error'; this.alt='Lỗi tải ảnh';">
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
            // Add event listener directly here if needed, or rely on delegation
             card.addEventListener('dblclick', () => {
                 if (!athlete.checkedIn) {
                     // console.log(`Double-clicked card for ${athlete.id}`);
                     checkInAthlete(athlete.id);
                 } else {
                     showNotification(`${athlete.name} đã check-in rồi.`, 'info');
                 }
             });
            fragment.appendChild(card);
        });
        athletesListContainer.appendChild(fragment);
    }
    updateResultsCount();
}

/** Updates results count and button states. */
function updateResultsCount() {
    if (resultsCountSpan) {
        resultsCountSpan.textContent = `[${filteredAthletes.length}/${athletes.length}]`;
    }
    const hasSelection = selectedAthleteIds.size > 0;
    if(checkinSelectedBtn){
        checkinSelectedBtn.disabled = !hasSelection;
        checkinSelectedBtn.title = hasSelection
            ? `Check-in ${selectedAthleteIds.size} VĐV đã chọn`
            : "Chọn ít nhất một VĐV để check-in";
    }
}

/** Applies filters based on current selections and search term. */
function applyFilters() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedDistance = distanceFilterGroup?.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    const selectedGender = genderFilterGroup?.querySelector('.filter-btn.active')?.dataset.gender || 'all';

    filteredAthletes = athletes.filter(athlete => {
        // Ensure athlete object and properties exist
        if (!athlete || !athlete.name || !athlete.bib) return false;

        const nameMatch = athlete.name.toLowerCase().includes(searchTerm);
        const bibMatch = athlete.bib.toLowerCase().includes(searchTerm);
        const distanceMatch = selectedDistance === 'all' || athlete.distance === selectedDistance;
        // Case-insensitive gender match, handles empty gender
        const genderMatch = selectedGender === 'all' || (athlete.gender && athlete.gender.toLowerCase() === selectedGender.toLowerCase());

        return (nameMatch || bibMatch) && distanceMatch && genderMatch;
    });

    renderAthletes(); // Render the filtered list
}

/** Debounced applyFilters */
const debouncedApplyFilters = debounce(applyFilters, 300);

// --- Check-in Logic ---

/** Initiates check-in for a single athlete. */
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
    if (!photoModal) {
         showNotification(`Lỗi: Không tìm thấy cửa sổ chụp ảnh (modal).`, 'error');
         return;
    }

    currentModalAthlete = athlete;
    deselectAllAthletes(); // Clear multi-selection
    showPhotoModal();
}

/** Initiates check-in for selected athletes. */
function checkInSelectedAthletes() {
    if (selectedAthleteIds.size === 0) {
        showNotification('Vui lòng chọn ít nhất một VĐV để check-in.', 'info');
        return;
    }

    const athletesToCheckIn = Array.from(selectedAthleteIds)
                                   .map(id => athletes.find(a => a.id === id))
                                   .filter(a => a && !a.checkedIn);

    if (athletesToCheckIn.length === 0) {
        showNotification('Tất cả VĐV đã chọn đều đã check-in.', 'info');
        deselectAllAthletes();
        return;
    }

    console.log(`Starting batch check-in. Processing ${athletesToCheckIn[0].id} first.`);
    checkInAthlete(athletesToCheckIn[0].id); // Start with the first one
}

// --- Photo Modal Logic ---

/** Shows photo modal and starts camera. */
async function showPhotoModal() {
    if (!currentModalAthlete || !photoModal || !modalVideo || !modalCanvas || !modalCaptureBtn || !modalRetakeBtn || !modalConfirmBtn || !modalAthleteInfo || !modalCameraError) {
        console.error("Photo modal or its elements not found.");
        showNotification("Lỗi giao diện: Không thể mở cửa sổ chụp ảnh.", "error");
        return;
    }

    // Reset state
    modalVideo.style.display = 'block';
    modalCanvas.style.display = 'none';
    modalCaptureBtn.style.display = 'inline-block';
    modalRetakeBtn.style.display = 'none';
    modalConfirmBtn.style.display = 'none';
    modalCameraError.style.display = 'none';
    modalAthleteInfo.textContent = `VĐV: ${currentModalAthlete.name} (BIB: ${currentModalAthlete.bib})`;
    modalConfirmBtn.disabled = false;
    modalConfirmBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Xác nhận Check-in';
    modalVideo.srcObject = null;

    photoModal.setAttribute('aria-hidden', 'false');
    photoModal.classList.add('active'); // Use class for transition

    // Request camera access
    try {
        console.log("Requesting camera stream (user facing)...");
        const constraints = { video: { facingMode: 'user' } };
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Trình duyệt không hỗ trợ truy cập camera.");
        }
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Camera stream obtained.");
        modalVideo.srcObject = cameraStream;

        // Wait for video to be ready and play
        await new Promise((resolve, reject) => {
            modalVideo.onloadedmetadata = () => {
                modalVideo.play().then(resolve).catch(reject);
            };
            modalVideo.onerror = (e) => reject(new Error("Lỗi tải video từ camera."));
            // Slightly longer timeout
            setTimeout(() => reject(new Error("Hết thời gian chờ camera sẵn sàng.")), 8000);
        });
        console.log("Camera video playing.");

    } catch (error) {
        console.error('Error accessing or playing camera:', error); // Log full error
        modalCameraError.textContent = `Lỗi camera: ${error.name || 'Lỗi không xác định'} - ${error.message}. Vui lòng cấp quyền và kiểm tra thiết bị.`;
        modalCameraError.style.display = 'block';
        modalCaptureBtn.style.display = 'none'; // Hide capture if no camera
        // Clean up stream if partially obtained
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
    }
}

/** Hides photo modal and cleans up camera. */
function hidePhotoModal() {
    console.log("Hiding photo modal and cleaning up camera stream.");
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
            track.stop();
            // console.log(`Camera track stopped: ${track.kind}`);
        });
        cameraStream = null;
    }
    if (modalVideo) {
        modalVideo.srcObject = null;
        modalVideo.pause();
        modalVideo.removeAttribute('src'); // Clean up thoroughly
    }
    if (photoModal) {
        photoModal.setAttribute('aria-hidden', 'true');
        photoModal.classList.remove('active');
    }
    currentModalAthlete = null; // Clear current athlete

    // Reset button/display states for next time (optional, but good practice)
    if (modalVideo) modalVideo.style.display = 'block';
    if (modalCanvas) modalCanvas.style.display = 'none';
    if (modalCaptureBtn) modalCaptureBtn.style.display = 'inline-block';
    if (modalRetakeBtn) modalRetakeBtn.style.display = 'none';
    if (modalConfirmBtn) modalConfirmBtn.style.display = 'none';
    if (modalCameraError) modalCameraError.style.display = 'none';
    if (modalConfirmBtn) {
         modalConfirmBtn.disabled = false;
         modalConfirmBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Xác nhận Check-in';
    }
}

/** Captures photo from video to canvas. */
function capturePhoto() {
    console.log("Attempting to capture photo...");
    if (!cameraStream || !modalVideo || modalVideo.readyState < modalVideo.HAVE_METADATA || !modalVideo.videoWidth || !modalVideo.videoHeight) {
        showNotification("Camera chưa sẵn sàng hoặc video chưa tải.", "error");
        console.error("Capture failed: Video not ready.", { state: modalVideo?.readyState, w: modalVideo?.videoWidth, h: modalVideo?.videoHeight });
        return;
    }
    if (!modalCanvas) {
         console.error("Canvas element not found for capture.");
         return;
    }

    try {
        const context = modalCanvas.getContext('2d');
        modalCanvas.width = modalVideo.videoWidth;
        modalCanvas.height = modalVideo.videoHeight;
        // console.log(`Canvas dimensions set: ${modalCanvas.width}x${modalCanvas.height}`);

        context.drawImage(modalVideo, 0, 0, modalCanvas.width, modalCanvas.height);
        // console.log("drawImage called.");

        // Update UI
        if(modalVideo) modalVideo.style.display = 'none';
        modalCanvas.style.display = 'block';
        if(modalCaptureBtn) modalCaptureBtn.style.display = 'none';
        if(modalRetakeBtn) modalRetakeBtn.style.display = 'inline-block';
        if(modalConfirmBtn) modalConfirmBtn.style.display = 'inline-block';
        // console.log("Display updated for captured photo.");
        // Optional: pause video stream
        // modalVideo.pause();

    } catch (error) {
         console.error("Error during photo capture process:", error);
         showNotification("Lỗi khi chụp ảnh. Vui lòng thử lại.", "error");
         retakePhoto(); // Attempt to reset to camera view
    }
}

/** Switches back to live camera view. */
function retakePhoto() {
    console.log("Retaking photo...");
    if (!modalVideo || !modalCanvas || !modalCaptureBtn || !modalRetakeBtn || !modalConfirmBtn) return;

    modalVideo.style.display = 'block';
    modalCanvas.style.display = 'none';
    // Optional: ensure video plays if paused
    // if (modalVideo.paused) {
    //     modalVideo.play().catch(e => console.error("Error resuming video:", e));
    // }
    modalCaptureBtn.style.display = 'inline-block';
    modalRetakeBtn.style.display = 'none';
    modalConfirmBtn.style.display = 'none';
    console.log("Retake successful: UI reset.");
}

/** Confirms check-in, sends data to server, handles queue. */
async function confirmCheckIn() {
    if (!currentModalAthlete || !modalCanvas || !modalConfirmBtn || modalCanvas.style.display === 'none') {
        console.error("ConfirmCheckIn called in invalid state (no athlete, canvas hidden, or button missing).");
        showNotification("Chưa chụp ảnh hoặc VĐV không hợp lệ.", "error");
        return;
    }

    modalConfirmBtn.disabled = true;
    modalConfirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Đang xử lý...';
    console.log(`Confirming check-in for athlete ID: ${currentModalAthlete.id}`);

    let photoDataUrl = '';
    try {
        photoDataUrl = modalCanvas.toDataURL('image/jpeg', 0.85); // JPEG format, 85% quality
        if (!photoDataUrl || photoDataUrl.length < 150 || !photoDataUrl.startsWith('data:image/jpeg;base64,')) {
             console.error("Invalid photo data from canvas:", photoDataUrl?.substring(0, 100));
             throw new Error("Dữ liệu ảnh chụp không hợp lệ.");
        }
        // console.log(`Generated photo Data URL (length: ${photoDataUrl.length})`);
    } catch (error) {
        console.error('Error getting photo data from canvas:', error);
        showNotification(`Lỗi xử lý ảnh chụp: ${error.message || 'Không rõ'}`, 'error');
        modalConfirmBtn.disabled = false;
        modalConfirmBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Xác nhận Check-in';
        return;
    }

    // --- Send data to Apps Script ---
    try {
        const updateResult = await updateGoogleSheetCheckin(currentModalAthlete.id, photoDataUrl);

        if (updateResult && updateResult.success) {
            // --- Update Local State on Success ---
            const athleteIndex = athletes.findIndex(a => a.id === currentModalAthlete.id);
            if (athleteIndex > -1) {
                athletes[athleteIndex].checkedIn = true;
                athletes[athleteIndex].checkinTime = formatDate(new Date()); // Client time for immediate UI
                athletes[athleteIndex].photoUrl = updateResult.actualPhotoUrl || ''; // Use server's Drive URL
                console.log(`Local athlete ${currentModalAthlete.id} updated successfully.`);
            } else {
                 console.warn(`Athlete ID ${currentModalAthlete.id} not found locally after successful check-in.`);
            }

            showNotification(`VĐV ${currentModalAthlete.name} (BIB: ${currentModalAthlete.bib}) đã check-in!`, 'success');
            const justCheckedInId = currentModalAthlete.id; // Store ID before clearing currentModalAthlete

            // --- Queue Handling ---
            // Find next *selected* athlete who is not checked in
             const remainingSelected = Array.from(selectedAthleteIds)
                                           .map(id => athletes.find(a => a.id === id))
                                           .filter(a => a && !a.checkedIn && a.id !== justCheckedInId); // Exclude the one just processed

            if (remainingSelected.length > 0) {
                 const nextAthlete = remainingSelected[0];
                 console.log(`Batch Check-in: Processing next -> ${nextAthlete.id}`);
                 // Deselect the processed one *before* hiding modal (UI update happens later)
                 deselectAthlete(justCheckedInId);
                 hidePhotoModal(); // Clean close
                 setTimeout(() => checkInAthlete(nextAthlete.id), 150); // Open for next
            } else {
                 console.log("Check-in complete or no more selected athletes in queue.");
                 // Deselect the processed one
                 deselectAthlete(justCheckedInId);
                 hidePhotoModal(); // Close if queue empty
            }
             // --- End Queue Handling ---

             applyFilters(); // Re-render list after potential selection changes and status update


        } else {
            // Error handled and notified by updateGoogleSheetCheckin
            console.log("Check-in failed. Result:", updateResult);
            // Re-enable confirm button to allow retry
            modalConfirmBtn.disabled = false;
            modalConfirmBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Xác nhận Check-in';
        }
    } catch (error) { // Catch unexpected errors in this flow
        console.error('Unexpected error during check-in confirmation:', error);
        showNotification(`Lỗi không mong muốn khi xác nhận: ${error.message || 'Không rõ'}`, 'error');
        modalConfirmBtn.disabled = false;
        modalConfirmBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Xác nhận Check-in';
    }
}

/** Sends Check-in request to Apps Script doPost. */
async function updateGoogleSheetCheckin(id, photoDataUrl) {
    const now = new Date();
    const timeString = formatDate(now);
    const postData = { action: ACTION_CHECKIN, id: id, time: timeString, photoUrl: photoDataUrl };

    // console.log(`Attempting POST Check-in to: ${WEBAPP_URL} for ID: ${id}.`);
    if (!WEBAPP_URL || !WEBAPP_URL.startsWith('https://script.google.com/macros/s/')) {
         showNotification('Lỗi cấu hình: URL Web App không hợp lệ.', 'error');
         return { success: false, error: 'Invalid WEBAPP_URL configuration.' };
    }

    try {
        const response = await fetch(WEBAPP_URL, {
            method: 'POST', mode: 'cors', cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData), redirect: 'follow'
        });
        // console.log(`Check-in POST Response Status: ${response.status} ${response.statusText}`);

        let responseData = null;
        let responseText = '';
        try {
            responseText = await response.text();
            responseData = JSON.parse(responseText);
            // console.log('Received Check-in JSON response:', responseData);
        } catch (e) {
            console.error("Could not parse JSON response for check-in:", e);
            console.error("Raw Response Text:", responseText);
            const errorMsg = `Lỗi ${response.status}: Server trả về phản hồi không hợp lệ.`;
            showNotification(errorMsg, 'error', 8000);
            return { success: false, error: errorMsg, status: response.status, responseBody: responseText };
        }

        if (!response.ok || responseData.success === false) {
            const errorMsgFromServer = responseData?.error || `Lỗi không rõ từ server (Status ${response.status})`;
            console.error(`Check-in request failed. Status: ${response.status}. Server Error: ${errorMsgFromServer}. Full Response:`, responseData);
            // Show specific error message from server if available
            showNotification(`Lỗi Check-in VĐV ${id}: ${errorMsgFromServer}`, 'error', 6000);
            return { success: false, error: errorMsgFromServer, status: response.status, athleteId: id };
        }

        return { success: true, actualPhotoUrl: responseData.actualPhotoUrl || null };

    } catch (error) {
        console.error('Network or unexpected error during check-in POST:', error);
        const displayError = (error instanceof TypeError && error.message.includes('Failed to fetch'))
                           ? 'Lỗi kết nối mạng khi gửi yêu cầu check-in.'
                           : `Lỗi Client-side: ${error.message || 'Không rõ'}`;
        showNotification(displayError, 'error');
        return { success: false, error: displayError };
    }
}

// --- QR Code Scanning ---
// (Giữ nguyên code QR từ câu trả lời trước - startQrScanning, stopQrScanning, processQrCode)
/** Starts the QR code scanning process. */
async function startQrScanning() {
    if (typeof jsQR === 'undefined') {
        showNotification('Thư viện quét QR (jsQR) chưa được tải.', 'error');
        console.error("jsQR library is not loaded. Make sure it's included in your HTML.");
        return;
    }
    if (qrScanner) {
        showNotification('Đang quét QR...', 'info');
        return;
    }

    qrScanner = document.createElement('video');
    qrScanner.setAttribute('playsinline', '');
    qrScanner.style.position = 'fixed';
    qrScanner.style.inset = '0'; // Use inset
    qrScanner.style.width = '100%';
    qrScanner.style.height = '100%';
    qrScanner.style.objectFit = 'cover';
    qrScanner.style.zIndex = '1500';
    document.body.appendChild(qrScanner);

    const closeScanBtn = document.createElement('button');
    closeScanBtn.textContent = '✕ Đóng Quét QR';
    closeScanBtn.type = 'button'; // Explicitly set type
    closeScanBtn.style.position = 'fixed';
    closeScanBtn.style.bottom = '30px';
    closeScanBtn.style.left = '50%';
    closeScanBtn.style.transform = 'translateX(-50%)';
    closeScanBtn.style.zIndex = '1501';
    closeScanBtn.style.padding = '12px 25px';
    closeScanBtn.style.fontSize = '16px';
    closeScanBtn.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
    closeScanBtn.style.color = 'white';
    closeScanBtn.style.border = 'none';
    closeScanBtn.style.borderRadius = '8px';
    closeScanBtn.style.cursor = 'pointer';
    closeScanBtn.onclick = stopQrScanning; // Assign function directly
    document.body.appendChild(closeScanBtn);
    qrScanner.closeButton = closeScanBtn;

    const qrCanvas = document.createElement('canvas');
    const qrContext = qrCanvas.getContext('2d', { willReadFrequently: true });

    showNotification('Hướng camera vào mã QR...', 'info', 5000);

    try {
        console.log("Requesting camera stream (environment)...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        qrScanner.srcObject = stream;
        await qrScanner.play();

        await new Promise(resolve => {
             if (qrScanner.readyState >= qrScanner.HAVE_METADATA) resolve();
             else qrScanner.onloadedmetadata = resolve;
         });

        qrCanvas.width = qrScanner.videoWidth;
        qrCanvas.height = qrScanner.videoHeight;
        console.log(`QR Scanner dimensions: ${qrCanvas.width}x${qrCanvas.height}`);

        function scanFrame() {
            if (!qrScanner || !qrScanner.srcObject || qrScanner.paused || qrScanner.ended || !qrScanner.videoWidth) {
                 return; // Stop loop
            }
             try {
                 if(qrCanvas.width !== qrScanner.videoWidth || qrCanvas.height !== qrScanner.videoHeight) {
                    qrCanvas.width = qrScanner.videoWidth;
                    qrCanvas.height = qrScanner.videoHeight;
                 }
                qrContext.drawImage(qrScanner, 0, 0, qrCanvas.width, qrCanvas.height);
                const imageData = qrContext.getImageData(0, 0, qrCanvas.width, qrCanvas.height);

                if (!imageData?.data?.length) {
                     qrAnimation = requestAnimationFrame(scanFrame); return; // Try next frame
                }
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

                if (code && code.data) {
                    console.log('QR Code detected:', code.data);
                    showNotification(`Đã quét mã: ${code.data}`, 'success', 2000);
                    stopQrScanning();
                    processQrCode(code.data);
                } else {
                    qrAnimation = requestAnimationFrame(scanFrame); // Continue
                }
             } catch (scanError) {
                 console.error("Error during QR frame scan:", scanError);
                 if (qrScanner && qrScanner.srcObject) { // Continue if possible
                     qrAnimation = requestAnimationFrame(scanFrame);
                 } else {
                     stopQrScanning(); // Cleanup if fatal
                 }
             }
        }
        qrAnimation = requestAnimationFrame(scanFrame); // Start loop

    } catch (error) {
        console.error('Error accessing camera for QR scanning:', error);
        showNotification(`Lỗi camera QR: ${error.name}. Vui lòng cấp quyền và kiểm tra.`, 'error');
        stopQrScanning();
    }
}
/** Stops QR scanning and cleans up. */
function stopQrScanning() {
    console.log('Stopping QR Scanning...');
    if (qrAnimation) cancelAnimationFrame(qrAnimation);
    qrAnimation = null;
    if (qrScanner) {
        if (qrScanner.srcObject) {
            qrScanner.srcObject.getTracks().forEach(track => track.stop());
            qrScanner.srcObject = null;
        }
        if (qrScanner.closeButton) qrScanner.closeButton.remove();
        qrScanner.remove();
        qrScanner = null;
        console.log('QR Scanner stopped and removed.');
    }
}
/** Processes scanned QR data. */
function processQrCode(qrData) {
    qrData = String(qrData || '').trim();
    if (!qrData) {
        showNotification('Mã QR không hợp lệ.', 'error'); return;
    }
    console.log(`Processing QR data: "${qrData}"`);
    const lowerQrData = qrData.toLowerCase();

    let foundAthlete = athletes.find(a => a.bib && String(a.bib).toLowerCase() === lowerQrData)
                    || athletes.find(a => a.id && String(a.id).toLowerCase() === lowerQrData); // Combine find attempts

    if (foundAthlete) {
        showNotification(`Tìm thấy VĐV: ${foundAthlete.name} (BIB: ${foundAthlete.bib})`, 'success');
        const card = athletesListContainer?.querySelector(`.athlete-card[data-id="${foundAthlete.id}"]`);
        if(card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('highlight');
            setTimeout(() => card?.classList.remove('highlight'), 2500);
        }
        checkInAthlete(foundAthlete.id); // Initiate check-in
    } else {
        showNotification(`Không tìm thấy VĐV nào khớp với mã QR: ${qrData}`, 'error');
    }
}

// --- Data Export and GitHub Commit ---

/** Exports filtered checked-in athletes. */
function exportToJson() {
     const dataToExport = filteredAthletes
        .filter(a => a.checkedIn)
        .map(({ id, name, bib, distance, gender, checkinTime, photoUrl }) =>
            ({ id, name, bib, distance, gender, checkinTime, photoUrl })); // Include Drive URL

    if (dataToExport.length === 0) {
        showNotification('Không có VĐV đã check-in trong bộ lọc hiện tại.', 'info');
        return;
    }
    try {
        const jsonString = JSON.stringify(dataToExport, null, 2);
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
    } catch (error) {
         console.error("Error exporting to JSON:", error);
         showNotification(`Lỗi khi xuất file JSON: ${error.message}`, 'error');
    }
}
/** Triggers GitHub commit via Apps Script. */
async function commitToGitHub() {
    if (isCommitting) {
        showNotification("Đang đẩy dữ liệu...", "info", 2000); return;
    }
    if(!commitBtn) return; // Exit if button doesn't exist

    isCommitting = true;
    commitBtn.disabled = true;
    commitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Đang đẩy...';
    console.log("Requesting GitHub commit via Apps Script...");

    const postData = { action: ACTION_COMMIT };

    if (!WEBAPP_URL || !WEBAPP_URL.startsWith('https://script.google.com/macros/s/')) {
         showNotification('Lỗi cấu hình: URL Web App không hợp lệ.', 'error');
         // Reset button state immediately
         isCommitting = false;
         commitBtn.disabled = false;
         commitBtn.innerHTML = '<i class="fas fa-cloud-upload-alt" aria-hidden="true"></i> Đẩy lên GitHub';
         return;
    }

    try {
        const response = await fetch(WEBAPP_URL, {
            method: 'POST', mode: 'cors', cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData), redirect: 'follow'
        });
        // console.log(`Commit POST Response Status: ${response.status} ${response.statusText}`);

        let responseData = null;
        let responseText = '';
        try {
            responseText = await response.text();
            responseData = JSON.parse(responseText);
            // console.log('Received Commit JSON response:', responseData);
        } catch (e) {
            console.error("Could not parse JSON response for commit:", e);
            console.error("Raw Response Text:", responseText);
            const errorMsg = `Lỗi ${response.status}: Server trả về phản hồi không hợp lệ khi commit.`;
            showNotification(errorMsg, 'error', 8000);
            throw new Error(errorMsg); // Throw to outer catch
        }

        if (!response.ok || responseData.success === false) {
            const errorMsgFromServer = responseData?.error || `Lỗi không rõ từ server khi commit (Status ${response.status})`;
            console.error(`Commit request failed. Status: ${response.status}. Server Error: ${errorMsgFromServer}. Full Response:`, responseData);
            showNotification(`Lỗi đẩy lên GitHub: ${errorMsgFromServer}`, 'error', 8000);
            throw new Error(errorMsgFromServer); // Throw to outer catch
        }

        showNotification(`Đẩy dữ liệu lên GitHub thành công! ${responseData.commitUrl ? 'Xem commit' : ''}`, 'success', 7000);
        // Optionally open commit URL in new tab:
        // if(responseData.commitUrl) window.open(responseData.commitUrl, '_blank');

    } catch (error) {
        console.error('Error during GitHub commit request process:', error);
        // Notification was likely shown already
    } finally {
        isCommitting = false;
        if (commitBtn) {
             commitBtn.disabled = false;
             commitBtn.innerHTML = '<i class="fas fa-cloud-upload-alt" aria-hidden="true"></i> Đẩy lên GitHub';
        }
    }
}


// --- Athlete Selection Logic ---

/** Toggles selection state of an athlete card. */
function toggleAthleteSelection(athleteId) {
    if (!athletesListContainer) return;
    const card = athletesListContainer.querySelector(`.athlete-card[data-id="${athleteId}"]`);
    if (!card) return;

    const athlete = athletes.find(a => a.id === athleteId);
    // Prevent selection if athlete not found or already checked in
    if (!athlete || athlete.checkedIn) {
        if(athlete && athlete.checkedIn) showNotification(`${athlete.name} đã check-in rồi.`, 'info');
        // Ensure card is not marked as selected if checked-in
        if(selectedAthleteIds.has(athleteId)) deselectAthlete(athleteId);
        return;
    }

    if (selectedAthleteIds.has(athleteId)) {
        selectedAthleteIds.delete(athleteId);
        card.classList.remove('selected');
        card.setAttribute('aria-pressed', 'false');
    } else {
        selectedAthleteIds.add(athleteId);
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
    }
    updateResultsCount();
}
/** Deselects a specific athlete. */
function deselectAthlete(athleteId) {
     if (selectedAthleteIds.has(athleteId)) {
        selectedAthleteIds.delete(athleteId);
        const card = athletesListContainer?.querySelector(`.athlete-card[data-id="${athleteId}"]`);
        if (card) {
            card.classList.remove('selected');
            card.setAttribute('aria-pressed', 'false');
        }
        updateResultsCount();
    }
}
/** Deselects all athletes. */
function deselectAllAthletes() {
    if (selectedAthleteIds.size === 0) return;
    selectedAthleteIds.forEach(id => {
         const card = athletesListContainer?.querySelector(`.athlete-card[data-id="${id}"]`);
        if (card) {
            card.classList.remove('selected');
            card.setAttribute('aria-pressed', 'false');
        }
    });
    selectedAthleteIds.clear();
    updateResultsCount();
    // console.log("All athletes deselected.");
}

// --- Event Listeners ---

/** Sets up all event listeners. */
function setupEventListeners() {
    // Search Input
    if (searchInput) searchInput.addEventListener('input', debouncedApplyFilters);
    else console.warn("Search input not found.");

    // Refresh Button
    if (refreshBtn) refreshBtn.addEventListener('click', fetchAthletes);
    else console.warn("Refresh button not found.");

    // Filter Buttons Delegation
    if (distanceFilterGroup) {
        distanceFilterGroup.addEventListener('click', (e) => {
            if (e.target.matches('.filter-btn')) {
                distanceFilterGroup.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false');
                });
                e.target.classList.add('active'); e.target.setAttribute('aria-pressed', 'true');
                applyFilters();
            }
        });
    } else console.warn("Distance filter group not found.");

    if (genderFilterGroup) {
         genderFilterGroup.addEventListener('click', (e) => {
             if (e.target.matches('.filter-btn')) {
                 genderFilterGroup.querySelectorAll('.filter-btn').forEach(btn => {
                     btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false');
                 });
                 e.target.classList.add('active'); e.target.setAttribute('aria-pressed', 'true');
                 applyFilters();
             }
         });
    } else console.warn("Gender filter group not found.");

    // Athlete List Delegation (Click)
    if (athletesListContainer) {
        athletesListContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.athlete-card');
            if (!card) return;
            const athleteId = card.dataset.id;
            // Single click toggles selection (dblclick handled separately)
            if (e.detail === 1) { // Ensure it's a single click
                 toggleAthleteSelection(athleteId);
            }
        });
         // Athlete List Delegation (Keyboard)
         athletesListContainer.addEventListener('keydown', (e) => {
             const card = e.target.closest('.athlete-card');
             if (!card) return;
             if (e.key === 'Enter' || e.key === ' ') {
                 e.preventDefault();
                 toggleAthleteSelection(card.dataset.id); // Enter/Space toggles selection
             }
         });
    } else console.error("Athletes list container not found!");


    // Action Buttons
    if (checkinSelectedBtn) checkinSelectedBtn.addEventListener('click', checkInSelectedAthletes);
    else console.warn("Checkin selected button not found.");

    if (qrScanBtn) qrScanBtn.addEventListener('click', startQrScanning);
    else console.warn("QR scan button not found.");

    if (exportBtn) exportBtn.addEventListener('click', exportToJson);
    else console.warn("Export button not found.");

    if (commitBtn) commitBtn.addEventListener('click', commitToGitHub);
    else console.warn("Commit button not found.");

    // Photo Modal Buttons & Interactions (Check if elements exist)
    if(modalCloseBtn) modalCloseBtn.addEventListener('click', hidePhotoModal);
    if(modalCancelBtn) modalCancelBtn.addEventListener('click', hidePhotoModal);
    if(modalCaptureBtn) modalCaptureBtn.addEventListener('click', capturePhoto);
    if(modalRetakeBtn) modalRetakeBtn.addEventListener('click', retakePhoto);
    if(modalConfirmBtn) modalConfirmBtn.addEventListener('click', confirmCheckIn);
    if (photoModal) {
        photoModal.addEventListener('click', (e) => { if (e.target === photoModal) hidePhotoModal(); });
        photoModal.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePhotoModal(); });
    } else console.warn("Photo modal element not found.");
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded. Initializing application...');

    // Check critical dependencies
    if (typeof jsQR === 'undefined') {
         console.error("jsQR library not loaded! QR Scanning disabled.");
         showNotification("Lỗi: Thư viện quét QR không tải được. Chức năng quét QR bị vô hiệu hóa.", "error", 10000);
         if(qrScanBtn) qrScanBtn.disabled = true;
    }
    if (!WEBAPP_URL || !WEBAPP_URL.startsWith('https://script.google.com/macros/s/') || WEBAPP_URL.includes('PASTE_YOUR_NEW_WEB_APP_URL_HERE')) {
        showNotification("LỖI CẤU HÌNH NGHIÊM TRỌNG: URL Web App không hợp lệ hoặc chưa được cập nhật trong script.js!", "error", 30000);
        console.error("WEBAPP_URL is invalid or placeholder! Please update script.js with the correct URL.");
        // Disable server interactions
        if(refreshBtn) refreshBtn.disabled = true;
        if(checkinSelectedBtn) checkinSelectedBtn.disabled = true;
        if(commitBtn) commitBtn.disabled = true;
        if(qrScanBtn) qrScanBtn.disabled = true;
        if (loader) loader.style.display = 'none';
        return; // Stop initialization
    }

    // If dependencies are ok, setup listeners and fetch data
    setupEventListeners();
    fetchAthletes(); // Load initial data
});

// --- END OF script.js ---
