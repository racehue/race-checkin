document.addEventListener('DOMContentLoaded', () => {
    const SHEET_ID = '1kdt68gFOrTyirvo69oRDpAJDM7y_iGxvXM3HLDb57kw';
    const API_KEY = 'AIzaSyAMjzUR6DiIiSBkxaqtohn4YJqlm9njUu0';
    const SHEET_NAME = 'athletes';
    const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;

    const GITHUB_OWNER = 'racehue';
    const GITHUB_REPO = 'race-check-in';
    const GITHUB_PATH = 'data/athletes.json';
    const GITHUB_BRANCH = 'main';
    const GITHUB_TOKEN = 'ghp_11BQPVGFI0zOa7bCH0l1Bp_u0OlKmIACymFgikVSoTKHaTKonB7a7nr8EuYck1ZHpVTHPKOH2AeiL43Mnk';

    const searchInput = document.getElementById('search-input');
    const refreshBtn = document.getElementById('refresh-btn');
    const checkinBtn = document.getElementById('checkin-btn');
    const filterBtn = document.getElementById('filter-btn');
    const filterMenu = document.getElementById('filter-menu');
    const distanceFilter = document.getElementById('distance-filter');
    const genderFilter = document.getElementById('gender-filter');
    const athletesList = document.getElementById('athletes-list');
    const noResultsMessage = document.getElementById('no-results');

    let athletes = [];

    // Toggle filter menu
    filterBtn.addEventListener('click', () => {
        filterMenu.classList.toggle('hidden');
    });

    async function fetchAthletes() {
        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            athletes = data.values.slice(1).map(row => ({
                id: row[0],
                bib: row[1],
                name: row[2],
                gender: row[3],
                distance: row[4],
                checkedIn: row[5] === 'TRUE'
            }));
            renderAthletes();
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu từ Google Sheets:', error);
        }
    }

    function renderAthletes() {
        athletesList.innerHTML = '';
        const searchTerm = searchInput.value.toLowerCase();
        const filteredAthletes = athletes.filter(athlete => {
            return (
                athlete.name.toLowerCase().includes(searchTerm) || athlete.bib.includes(searchTerm)
            ) && (
                distanceFilter.value === "all" || athlete.distance === distanceFilter.value
            ) && (
                genderFilter.value === "all" || athlete.gender === genderFilter.value
            );
        });
        filteredAthletes.forEach(athlete => {
            const athleteCard = document.createElement('div');
            athleteCard.classList.add('p-4', 'bg-white', 'rounded-md', 'shadow', 'flex', 'justify-between', 'items-center');
            athleteCard.innerHTML = `
                <div>
                    <div class="font-bold text-lg">${athlete.name}</div>
                    <div class="text-sm text-gray-600">BIB: ${athlete.bib} | ${athlete.distance}</div>
                </div>
                <button class="checkin-btn px-3 py-1 bg-blue-500 text-white rounded-md ${athlete.checkedIn ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}" ${athlete.checkedIn ? 'disabled' : ''}>
                    ${athlete.checkedIn ? 'Đã Check-in' : 'Check-in'}
                </button>
            `;
            athleteCard.querySelector('.checkin-btn').addEventListener('click', () => handleCheckin(athlete));
            athletesList.appendChild(athleteCard);
        });
        noResultsMessage.classList.toggle('hidden', filteredAthletes.length > 0);
    }

    async function handleCheckin(athlete) {
        athlete.checkedIn = true;
        renderAthletes();
        await updateGitHub(athlete);
        alert(`Check-in thành công cho ${athlete.name}!`);
    }

    async function updateGitHub(updatedAthlete) {
        try {
            const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`, {
                method: 'GET',
                headers: {
                    Authorization: `token ${GITHUB_TOKEN}`
                }
            });
            const fileData = await response.json();
            const decodedContent = JSON.parse(atob(fileData.content));
            const athleteIndex = decodedContent.findIndex(a => a.id === updatedAthlete.id);
            if (athleteIndex !== -1) {
                decodedContent[athleteIndex].checkedIn = true;
            }
            const updatedContent = btoa(JSON.stringify(decodedContent, null, 2));
            await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`, {
                method: 'PUT',
                headers: {
                    Authorization: `token ${GITHUB_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Cập nhật trạng thái check-in',
                    content: updatedContent,
                    sha: fileData.sha,
                    branch: GITHUB_BRANCH
                })
            });
        } catch (error) {
            console.error('Lỗi khi cập nhật GitHub:', error);
        }
    }

    searchInput.addEventListener('input', renderAthletes);
    refreshBtn.addEventListener('click', fetchAthletes);
    distanceFilter.addEventListener('change', renderAthletes);
    genderFilter.addEventListener('change', renderAthletes);

    fetchAthletes();
});
