// --- JavaScript (script.js - Hoàn thiện) ---

// --- Configuration ---
// const SHEET_ID = 'YOUR_SHEET_ID_HERE'; // Không cần thiết nữa nếu chỉ dùng WebApp URL
// URL Web App đã copy sau khi triển khai Apps Script ở trên
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwd2dmoqXdXcnZCCNjJLEN6YskOPWDdQYfeRfZDAb1HI5T0liAQ-qnpXkU6iP7HNnA0Aw/exec'; // !!! THAY THẾ BẰNG URL CỦA BẠN !!!

// --- Global State ---
let athletes = [];
let filteredAthletes = [];
let selectedAthleteIds = new Set();
let currentModalAthlete = null;
let cameraStream = null;
let isFetching = false; // Cờ để tránh fetch chồng chéo
let isCommitting = false; // Cờ để tránh commit chồng chéo

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

/** Debounce function */
function debounce(func, delay) { /* ... Giữ nguyên ... */ }
/** Shows loader */
function showLoader() { /* ... Giữ nguyên ... */ }
/** Hides loader */
function hideLoader() { /* ... Giữ nguyên ... */ }
/** Formats Date */
function formatDate(date) { /* ... Giữ nguyên ... */ }
/** Shows notification */
function showNotification(message, type = 'info', duration = 4000) { /* ... Giữ nguyên ... */ }

// --- Data Fetching and Processing ---

/**
 * Fetches athlete data from the Google Apps Script Web App (doGet).
 */
async function fetchAthletes() {
    if (isFetching) {
        console.log("Fetch already in progress. Skipping.");
        showNotification("Đang tải dữ liệu...", "info", 1500);
        return;
    }
    isFetching = true;
    showLoader();
    refreshBtn.disabled = true; // Disable refresh button during fetch
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
    console.log('Fetching athletes via Web App URL...');

    try {
        if (!WEBAPP_URL || !WEBAPP_URL.startsWith('https://script.google.com/macros/s/')) {
             throw new Error("WebApp URL không hợp lệ. Vui lòng kiểm tra cấu hình.");
        }
        const response = await fetch(WEBAPP_URL); // Gọi hàm doGet của Apps Script
        if (!response.ok) {
            let errorMsg = `Lỗi ${response.status} khi tải dữ liệu từ server.`;
            try {
                 const errData = await response.json();
                 errorMsg = `Lỗi server: ${errData.error || response.statusText}`;
            } catch(e){ /* Ignore if response is not JSON */ }
            throw new Error(errorMsg);
        }
        const jsonData = await response.json();

        // Kiểm tra nếu server trả về lỗi trong JSON (doGet có thể trả lỗi 500 nhưng body là JSON lỗi)
        if (jsonData.success === false && jsonData.error) {
            throw new Error(jsonData.error);
        }

        processDataFromWebApp(jsonData); // Xử lý JSON trả về từ Apps Script

        console.log(`Fetched ${athletes.length} athletes successfully.`);
        showNotification('Danh sách VĐV đã được cập nhật.', 'success', 2000);
    } catch (error) {
        console.error('Error fetching data:', error);
        showNotification(`Lỗi khi tải dữ liệu: ${error.message}. Thử lại sau.`, 'error', 6000);
        // Không dùng test data nữa, chỉ báo lỗi
        // useTestData();
        athletes = []; // Xóa dữ liệu cũ nếu fetch lỗi
        filteredAthletes = [];
        renderAthletes(); // Hiển thị trạng thái rỗng/lỗi
    } finally {
        applyFilters(); // Render lại (có thể rỗng nếu lỗi)
        hideLoader();
        isFetching = false;
        refreshBtn.disabled = false; // Re-enable button
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Làm mới';
    }
}

/**
 * Processes data received from the Apps Script Web App (doGet).
 * Expects an array of objects with lowercase keys from Apps Script.
 * @param {Array<object>} jsonData Array of athlete objects.
 */
function processDataFromWebApp(jsonData) {
    if (!Array.isArray(jsonData)) {
        console.error("Invalid data format received from server:", jsonData);
        throw new Error("Dữ liệu nhận được từ server không hợp lệ.");
    }
    athletes = jsonData.map((item, index) => {
        // Validate và chuẩn hóa dữ liệu nhận được
        const id = String(item.id || `generated-${index}`).trim();
        const name = String(item.name || 'N/A').trim();
        const bib = String(item.bib || 'N/A').trim();
        const checkedin = item.checkedin === true; // Đảm bảo là boolean
        const checkintime = String(item.checkintime || '').trim();
        const photourl = String(item.photourl || '').trim(); // URL từ Drive

        if (!id || !name || !bib) {
            console.warn(`Invalid data for record at index ${index}:`, item);
            // Có thể bỏ qua bản ghi lỗi hoặc dùng giá trị mặc định
        }

        return {
            id: id,
            name: name,
            gender: String(item.gender || '').trim(),
            distance: String(item.distance || '').trim().toUpperCase(),
            bib: bib,
            checkedIn: checkedin, // Đã là boolean
            checkinTime: checkintime,
            photoUrl: photourl // URL từ Drive
        };
    }).filter(a => a.id && a.name && a.bib); // Lọc bỏ các bản ghi không hợp lệ cơ bản
}

// --- UI Rendering and Filtering ---

/** Renders the list of athletes */
function renderAthletes() {
    if (!athletesListContainer) return;
    athletesListContainer.innerHTML = '';

    if (filteredAthletes.length === 0) {
        noResultsMessage.style.display = 'block';
        athletesListContainer.style.display = 'none';
    } else {
        noResultsMessage.style.display = 'none';
        athletesListContainer.style.display = 'grid';
        const fragment = document.createDocumentFragment();
        filteredAthletes.forEach(athlete => {
            const card = document.createElement('div');
            card.className = `athlete-card ${athlete.checkedIn ? 'checked-in' : ''} ${selectedAthleteIds.has(athlete.id) ? 'selected' : ''}`;
            card.dataset.id = athlete.id;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `Vận động viên ${athlete.name}, BIB ${athlete.bib}`);
            card.setAttribute('aria-pressed', selectedAthleteIds.has(athlete.id) ? 'true' : 'false');

            // Sử dụng URL ảnh từ Drive (athlete.photoUrl)
            const photoUrl = athlete.photoUrl || 'https://via.placeholder.com/80/CCCCCC/FFFFFF?text=No+Image';
            const checkinStatusText = athlete.checkedIn ? 'Đã check-in' : 'Chưa check-in';
            const checkinStatusClass = athlete.checkedIn ? 'checked' : 'not-checked';

            card.innerHTML = `
                <div class="athlete-photo">
                    <img src="${photoUrl}" alt="Ảnh VĐV ${athlete.name}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/80/CCCCCC/FFFFFF?text=ImgError'; this.alt='Lỗi tải ảnh';">
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
            // Thêm listener double-click để check-in nhanh (tùy chọn)
            card.addEventListener('dblclick', () => {
                 if (!athlete.checkedIn) {
                     console.log(`Double-clicked to check-in ${athlete.id}`);
                     checkInAthlete(athlete.id);
                 }
             });
            fragment.appendChild(card);
        });
        athletesListContainer.appendChild(fragment);
    }
    updateResultsCount();
}

/** Updates the results count display and button states */
function updateResultsCount() { /* ... Giữ nguyên như trước ... */ }
/** Applies filters */
function applyFilters() { /* ... Giữ nguyên như trước ... */ }
/** Debounced applyFilters */
const debouncedApplyFilters = debounce(applyFilters, 300);

// --- Check-in Logic ---

/** Initiates check-in for a single athlete */
function checkInAthlete(athleteId) { /* ... Giữ nguyên như trước ... */ }
/** Initiates check-in for selected athletes */
function checkInSelectedAthletes() { /* ... Giữ nguyên như trước ... */ }

// --- Photo Modal ---
/** Shows the photo modal */
async function showPhotoModal() { /* ... Giữ nguyên như trước (bản đã sửa lỗi) ... */ }
/** Hides the photo modal and cleans up */
function hidePhotoModal() { /* ... Giữ nguyên như trước (bản đã sửa lỗi / dọn dẹp) ... */ }
/** Captures photo to canvas */
function capturePhoto() { /* ... Giữ nguyên như trước (bản đã sửa lỗi) ... */ }
/** Switches back to live camera */
function retakePhoto() { /* ... Giữ nguyên như trước (bản đã sửa lỗi) ... */ }

/**
 * Confirms check-in: Sends data to Apps Script (doPost, action: 'checkin')
 * and updates local state with the actual photo URL from the response.
 */
async function confirmCheckIn() {
    if (!currentModalAthlete || !modalCanvas || modalCanvas.style.display === 'none') {
        console.error("ConfirmCheckIn called in invalid state.");
        showNotification("Chưa chụp ảnh hoặc VĐV không hợp lệ.", "error");
        return;
    }

    modalConfirmBtn.disabled = true;
    modalConfirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
    console.log(`Confirming check-in for athlete ID: ${currentModalAthlete.id}`);

    let photoDataUrl = '';
    try {
        photoDataUrl = modalCanvas.toDataURL('image/jpeg', 0.85); // JPEG, quality 85%
        if (!photoDataUrl || photoDataUrl.length < 100) { // Kiểm tra sơ bộ kích thước base64
             throw new Error("Ảnh chụp không hợp lệ hoặc quá nhỏ.");
        }
        console.log(`Generated photo Data URL (length: ${photoDataUrl.length})`);
    } catch (error) {
        console.error('Error getting photo data from canvas:', error);
        showNotification(`Lỗi xử lý ảnh chụp: ${error.message}`, 'error');
        modalConfirmBtn.disabled = false;
        modalConfirmBtn.innerHTML = '<i class="fas fa-check"></i> Xác nhận Check-in';
        return;
    }

    // --- Attempt to update Google Sheet via Apps Script ---
    try {
        // Gửi request check-in đến doPost
        const updateResult = await updateGoogleSheetCheckin(currentModalAthlete.id, photoDataUrl);

        if (updateResult && updateResult.success) {
            // Cập nhật local data với thông tin CHUẨN từ server trả về
            const athleteIndex = athletes.findIndex(a => a.id === currentModalAthlete.id);
            if (athleteIndex > -1) {
                athletes[athleteIndex].checkedIn = true;
                athletes[athleteIndex].checkinTime = formatDate(new Date()); // Dùng giờ client cho UI tức thời
                // !!! Dùng URL ảnh thực tế từ Drive do server trả về !!!
                athletes[athleteIndex].photoUrl = updateResult.actualPhotoUrl || '';
                console.log(`Local athlete ${currentModalAthlete.id} updated. Photo URL: ${athletes[athleteIndex].photoUrl}`);
            }

            showNotification(`VĐV ${currentModalAthlete.name} (BIB: ${currentModalAthlete.bib}) đã check-in!`, 'success');
            deselectAthlete(currentModalAthlete.id);
            applyFilters(); // Render lại danh sách

            // Xử lý VĐV tiếp theo trong danh sách chọn (nếu có)
            const remainingSelected = Array.from(selectedAthleteIds)
                                          .map(id => athletes.find(a => a.id === id))
                                          .filter(a => a && !a.checkedIn);

            if (remainingSelected.length > 0) {
                 console.log(`Processing next selected athlete: ${remainingSelected[0].id}`);
                 hidePhotoModal(); // Đóng modal hiện tại
                 setTimeout(() => checkInAthlete(remainingSelected[0].id), 150); // Mở modal cho VĐV tiếp theo
            } else {
                 hidePhotoModal(); // Không còn ai thì đóng modal
            }
        } else {
            // Lỗi đã được xử lý và thông báo trong updateGoogleSheetCheckin
            console.log("Check-in via Apps Script failed.");
            modalConfirmBtn.disabled = false; // Cho phép thử lại
            modalConfirmBtn.innerHTML = '<i class="fas fa-check"></i> Xác nhận Check-in';
        }
    } catch (error) { // Lỗi ngoài dự kiến trong luồng confirm
        console.error('Unexpected error during check-in confirmation flow:', error);
        showNotification('Có lỗi không mong muốn khi xác nhận check-in.', 'error');
        modalConfirmBtn.disabled = false;
        modalConfirmBtn.innerHTML = '<i class="fas fa-check"></i> Xác nhận Check-in';
    }
}

/**
 * Gửi yêu cầu Check-in đến Apps Script Web App (doPost).
 * Returns Promise<{success: boolean, actualPhotoUrl?: string, error?: string}>
 * @param {string} id Athlete ID.
 * @param {string} photoDataUrl Base64 encoded image data URL.
 * @returns {Promise<object>} Object indicating success/failure and actual photo URL.
 */
async function updateGoogleSheetCheckin(id, photoDataUrl) {
    const now = new Date();
    const timeString = formatDate(now);

    const postData = {
        action: 'checkin', // Chỉ định hành động
        id: id,
        time: timeString,
        photoUrl: photoDataUrl
    };

    console.log(`Attempting POST Check-in to: ${WEBAPP_URL} for ID: ${id}.`);

    if (!WEBAPP_URL || !WEBAPP_URL.startsWith('https://script.google.com/macros/s/')) {
         showNotification('URL Web App không hợp lệ.', 'error');
         return { success: false, error: 'Invalid WEBAPP_URL configuration.' };
    }

    try {
        const response = await fetch(WEBAPP_URL, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData),
            redirect: 'follow'
        });

        let responseData = null;
        try {
            responseData = await response.json();
            console.log('Received Check-in response:', responseData);
        } catch (e) {
            console.error("Could not parse JSON response:", e);
            const textResponse = await response.text().catch(() => "Could not read response text.");
            const errorMsg = `Lỗi ${response.status}: Server trả về dữ liệu không hợp lệ. ${textResponse.substring(0,100)}`;
            showNotification(errorMsg, 'error');
            return { success: false, error: errorMsg, status: response.status };
        }

        if (!response.ok || responseData.success === false) {
            const errorMsg = responseData?.error || `Lỗi không xác định từ server (Status ${response.status})`;
            console.error('Check-in request failed:', errorMsg);
            showNotification(`Lỗi Check-in VĐV ${id}: ${errorMsg}`, 'error', 6000);
            return { success: false, error: errorMsg, status: response.status, athleteId: id };
        }

        // Check-in thành công
        return {
            success: true,
            actualPhotoUrl: responseData.actualPhotoUrl || null // URL ảnh từ Drive
         };

    } catch (error) { // Lỗi mạng hoặc lỗi khác
        console.error('Network or other error during check-in:', error);
        const displayError = (error instanceof TypeError && error.message.includes('Failed to fetch'))
                           ? 'Lỗi kết nối mạng khi gửi yêu cầu check-in.'
                           : `Lỗi không xác định: ${error.message}`;
        showNotification(displayError, 'error');
        return { success: false, error: displayError };
    }
}


// --- QR Code Scanning ---
// ... (startQrScanning, stopQrScanning, processQrCode giữ nguyên) ...

// --- Data Export and GitHub Commit ---

/** Exports filtered checked-in athletes to JSON */
function exportToJson() { /* ... Giữ nguyên như trước ... */ }

/**
 * Triggers the GitHub commit process securely via Apps Script.
 */
async function commitToGitHub() {
    if (isCommitting) {
        showNotification("Đang đẩy dữ liệu lên GitHub...", "info", 2000);
        return;
    }
    isCommitting = true;
    commitBtn.disabled = true;
    commitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đẩy...';
    console.log("Requesting GitHub commit via Apps Script...");

    const postData = {
        action: 'commit' // Chỉ định hành động
        // Không cần gửi data, Apps Script sẽ tự đọc từ Sheet
    };

    if (!WEBAPP_URL || !WEBAPP_URL.startsWith('https://script.google.com/macros/s/')) {
         showNotification('URL Web App không hợp lệ.', 'error');
         isCommitting = false;
         commitBtn.disabled = false;
         commitBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Đẩy lên GitHub';
         return;
    }

    try {
        const response = await fetch(WEBAPP_URL, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData),
            redirect: 'follow'
        });

        let responseData = null;
        try {
            responseData = await response.json();
            console.log('Received Commit response:', responseData);
        } catch (e) {
             console.error("Could not parse JSON response for commit:", e);
            const textResponse = await response.text().catch(() => "Could not read response text.");
            const errorMsg = `Lỗi ${response.status}: Server trả về dữ liệu không hợp lệ khi commit. ${textResponse.substring(0,100)}`;
            showNotification(errorMsg, 'error');
            throw new Error(errorMsg); // Ném lỗi để vào catch bên dưới
        }

        if (!response.ok || responseData.success === false) {
            const errorMsg = responseData?.error || `Lỗi không xác định từ server khi commit (Status ${response.status})`;
            console.error('Commit request failed:', errorMsg);
            showNotification(`Lỗi đẩy lên GitHub: ${errorMsg}`, 'error', 8000);
             throw new Error(errorMsg); // Ném lỗi để vào catch bên dưới
        }

        // Commit thành công
        showNotification(`Đẩy dữ liệu lên GitHub thành công! Commit: ${responseData.commitUrl || 'N/A'}`, 'success', 6000);

    } catch (error) { // Bắt lỗi từ fetch hoặc lỗi logic đã throw ở trên
        console.error('Error during GitHub commit request:', error);
        // Notification đã được hiển thị ở nơi lỗi xảy ra hoặc ở trên
        // showNotification(`Lỗi khi đẩy lên GitHub: ${error.message}`, 'error');
    } finally {
        isCommitting = false;
        commitBtn.disabled = false;
        commitBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Đẩy lên GitHub';
    }
}

// --- Athlete Selection Logic ---
/** Toggles selection state */
function toggleAthleteSelection(athleteId) { /* ... Giữ nguyên như trước ... */ }
/** Deselects a specific athlete */
function deselectAthlete(athleteId) { /* ... Giữ nguyên như trước ... */ }
/** Deselects all athletes */
function deselectAllAthletes() { /* ... Giữ nguyên như trước ... */ }

// --- Event Listeners ---
/** Sets up all event listeners */
function setupEventListeners() {
    // Search Input
    searchInput.addEventListener('input', debouncedApplyFilters);

    // Refresh Button
    refreshBtn.addEventListener('click', fetchAthletes);

    // Filter Buttons (Distance & Gender)
    distanceFilterGroup.addEventListener('click', (e) => { /* ... Giữ nguyên ... */ });
    genderFilterGroup.addEventListener('click', (e) => { /* ... Giữ nguyên ... */ });

    // Athlete List Click/Keydown for Selection/Check-in
    athletesListContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.athlete-card');
        if (!card) return;
        const athleteId = card.dataset.id;
        const athlete = athletes.find(a => a.id === athleteId);
        if (!athlete) return;

        if (e.detail === 2) { // Double-click detection (simple)
             if (!athlete.checkedIn) {
                 console.log(`Double-clicked (captured) to check-in ${athlete.id}`);
                 checkInAthlete(athlete.id);
             } else {
                 showNotification(`${athlete.name} đã check-in rồi.`, 'info');
             }
        } else { // Single click - toggle selection
            if (!athlete.checkedIn) {
                 toggleAthleteSelection(athleteId);
            } else {
                 showNotification(`${athlete.name} đã check-in rồi.`, 'info');
                 // Bỏ chọn nếu đang chọn VĐV đã check-in
                 if (selectedAthleteIds.has(athleteId)) {
                     deselectAthlete(athleteId);
                 }
            }
        }
    });
    athletesListContainer.addEventListener('keydown', (e) => {
         const card = e.target.closest('.athlete-card');
         if (!card) return;
         if (e.key === 'Enter' || e.key === ' ') {
             e.preventDefault();
             const athleteId = card.dataset.id;
             const athlete = athletes.find(a => a.id === athleteId);
             if (athlete && !athlete.checkedIn) {
                 toggleAthleteSelection(athleteId); // Enter/Space để chọn/bỏ chọn
                 // Hoặc bạn muốn Enter/Space để check-in luôn?
                 // checkInAthlete(athleteId);
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
     commitBtn.addEventListener('click', commitToGitHub); // Gọi hàm đã sửa

     // Photo Modal Buttons & Interactions
     modalCloseBtn.addEventListener('click', hidePhotoModal);
     modalCancelBtn.addEventListener('click', hidePhotoModal);
     modalCaptureBtn.addEventListener('click', capturePhoto);
     modalRetakeBtn.addEventListener('click', retakePhoto);
     modalConfirmBtn.addEventListener('click', confirmCheckIn); // Gọi hàm đã sửa
     photoModal.addEventListener('click', (e) => { /* ... Giữ nguyên ... */ });
     photoModal.addEventListener('keydown', (e) => { /* ... Giữ nguyên ... */ });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded.');
    if (!window.jsQR) {
         console.error("jsQR library not loaded!");
         showNotification("Lỗi: Thư viện quét QR không tải được.", "error");
    }
    if (!WEBAPP_URL || !WEBAPP_URL.includes('/macros/s/')) {
        showNotification("Lỗi cấu hình: URL Web App không hợp lệ!", "error", 10000);
        console.error("WEBAPP_URL is not configured correctly!");
        // Vô hiệu hóa các nút tương tác với server
        refreshBtn.disabled = true;
        checkinSelectedBtn.disabled = true;
        commitBtn.disabled = true;
        qrScanBtn.disabled = true; // QR scan vẫn cần checkin sau đó
    }

    setupEventListeners();
    fetchAthletes(); // Initial data load via Web App
});

// --- END OF script.js ---
