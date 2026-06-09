// Application state
let robotsData = [];
let filteredRobots = [];
let allHardwareTags = [];
let allBoardTags = [];
let allLanguageTags = [];
let adminMode = false;

// DOM Elements
const robotsGrid = document.getElementById('robots-grid');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const filterYear = document.getElementById('filter-year');
const filterCompetition = document.getElementById('filter-competition');
const boardFiltersContainer = document.getElementById('board-filters');
const languageFiltersContainer = document.getElementById('language-filters');
const hardwareFiltersContainer = document.getElementById('hardware-filters');
const btnClear = document.getElementById('btn-clear');
const btnEmptyReset = document.getElementById('btn-empty-reset');

// Stat Elements
const statTotal = document.getElementById('stat-total');
const statYears = document.getElementById('stat-years');
const statCompetitions = document.getElementById('stat-competitions');

// Helper to remove accents/diacritics for easier searching
function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Fetch robots database
async function fetchRobots() {
    try {
        const response = await fetch('data/robots.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        robotsData = await response.json();
        
        // Initialize app data
        initApp();
    } catch (error) {
        console.error('Error fetching robots:', error);
        loadingState.innerHTML = `
            <div class="text-red-500">
                <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
                <p class="font-bold">Nepodařilo se načíst data o robotech.</p>
                <p class="text-sm text-slate-500 mt-1">${error.message}</p>
            </div>
        `;
        lucide.createIcons();
    }
}

// Initialize components once data is loaded
function initApp() {
    // Populate stats
    updateDashboardStats();
    
    // Extract tags
    extractTags();
    
    // Populate dropdown options
    populateFilters();
    
    // Populate filter checkboxes
    renderFilterCheckboxes(allHardwareTags, hardwareFiltersContainer, 'hardware-filter');
    renderFilterCheckboxes(allBoardTags, boardFiltersContainer, 'board-filter');
    renderFilterCheckboxes(allLanguageTags, languageFiltersContainer, 'language-filter');
    
    // Perform initial render
    applyFilters();
    
    // Add event listeners
    searchInput.addEventListener('input', applyFilters);
    filterYear.addEventListener('change', applyFilters);
    filterCompetition.addEventListener('change', applyFilters);
    
    btnClear.addEventListener('click', resetFilters);
    btnEmptyReset.addEventListener('click', resetFilters);
    
    // Admin Toggle functionality
    const btnAdminToggle = document.getElementById('btn-admin-toggle');
    const adminStatusText = document.getElementById('admin-status-text');
    const adminIcon = document.getElementById('admin-icon');

    if (btnAdminToggle) {
        btnAdminToggle.addEventListener('click', () => {
            adminMode = !adminMode;
            if (adminMode) {
                btnAdminToggle.classList.remove('bg-slate-900/60', 'border-slate-800', 'text-slate-400', 'hover:bg-slate-800', 'hover:text-slate-200');
                btnAdminToggle.classList.add('bg-red-500/10', 'border-red-500/30', 'text-red-400', 'hover:bg-red-500/20', 'hover:text-red-300');
                adminStatusText.textContent = 'Admin: Aktivní';
                if (adminIcon) {
                    adminIcon.classList.remove('text-slate-500');
                    adminIcon.classList.add('text-red-400');
                }
            } else {
                btnAdminToggle.classList.remove('bg-red-500/10', 'border-red-500/30', 'text-red-400', 'hover:bg-red-500/20', 'hover:text-red-300');
                btnAdminToggle.classList.add('bg-slate-900/60', 'border-slate-800', 'text-slate-400', 'hover:bg-slate-800', 'hover:text-slate-200');
                adminStatusText.textContent = 'Admin režim';
                if (adminIcon) {
                    adminIcon.classList.remove('text-red-400');
                    adminIcon.classList.add('text-slate-500');
                }
            }
            renderCards(); // Redraw cards to add/remove delete buttons
        });
    }

    // Hide loading indicator
    loadingState.classList.add('hidden');
}

// Calculate and render dashboard stats from the complete dataset
function updateDashboardStats() {
    statTotal.textContent = robotsData.length;
    
    const uniqueYears = new Set(robotsData.map(r => r.year).filter(Boolean));
    statYears.textContent = uniqueYears.size;
    
    const uniqueCompetitions = new Set(robotsData.map(r => r.competition).filter(Boolean));
    statCompetitions.textContent = uniqueCompetitions.size;
}

// Extract all unique tags (hardware, boards, languages) from the robots database
function extractTags() {
    const hwSet = new Set();
    const boardSet = new Set();
    const langSet = new Set();
    
    robotsData.forEach(robot => {
        if (robot.hardware && Array.isArray(robot.hardware)) {
            robot.hardware.forEach(tag => hwSet.add(tag.trim()));
        }
        if (robot.board && Array.isArray(robot.board)) {
            robot.board.forEach(tag => boardSet.add(tag.trim()));
        }
        if (robot.language && Array.isArray(robot.language)) {
            robot.language.forEach(tag => langSet.add(tag.trim()));
        }
    });
    
    allHardwareTags = Array.from(hwSet).sort((a, b) => a.localeCompare(b));
    allBoardTags = Array.from(boardSet).sort((a, b) => a.localeCompare(b));
    allLanguageTags = Array.from(langSet).sort((a, b) => a.localeCompare(b));
}

// Populate the select elements with unique values present in the database
function populateFilters() {
    // Clear select elements, keeping the first (default) option
    filterYear.innerHTML = '<option value="">Všechny roky</option>';
    filterCompetition.innerHTML = '<option value="">Všechny soutěže</option>';

    // Generate school years dynamically from 2015 to current calendar year
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    const generatedYears = [];
    const baseYear = 2015; // base anchor at 2015
    for (let y = currentYear; y >= baseYear; y--) {
        generatedYears.push(String(y));
    }
    
    // Also include any other years in the database
    const dataYears = robotsData.map(r => r.year).filter(Boolean);
    const allYearsSet = new Set([...generatedYears, ...dataYears]);
    const sortedYears = Array.from(allYearsSet).sort((a, b) => b.localeCompare(a));
    
    sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        filterYear.appendChild(option);
    });
    
    // Extract unique competitions and sort them
    const competitions = [...new Set(robotsData.map(r => r.competition).filter(Boolean))];
    competitions.sort((a, b) => a.localeCompare(b));
    
    competitions.forEach(comp => {
        const option = document.createElement('option');
        option.value = comp;
        option.textContent = comp;
        filterCompetition.appendChild(option);
    });
}

// Render dynamic checkboxes for a given set of tags, container, and checkbox name
function renderFilterCheckboxes(tags, container, cbName) {
    container.innerHTML = '';
    
    if (tags.length === 0) {
        container.innerHTML = '<span class="text-xs text-slate-500 italic">Žádné tagy nebyly nalezeny.</span>';
        return;
    }
    
    tags.forEach(tag => {
        const label = document.createElement('label');
        label.className = "flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700/60 rounded-xl cursor-pointer select-none transition-all text-xs font-semibold text-slate-350";
        label.innerHTML = `
            <input type="checkbox" name="${cbName}" value="${tag}" class="w-3.5 h-3.5 rounded text-brand-600 bg-slate-950 border-slate-850 focus:ring-brand-500/20">
            <span>${tag}</span>
        `;
        
        // Add event listener to checkbox
        label.querySelector('input').addEventListener('change', applyFilters);
        container.appendChild(label);
    });
}

// Reset all filtering inputs
function resetFilters() {
    searchInput.value = '';
    filterYear.value = '';
    filterCompetition.value = '';
    
    // Uncheck all filters
    document.querySelectorAll('input[name="hardware-filter"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="board-filter"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="language-filter"]').forEach(cb => cb.checked = false);
    
    applyFilters();
}

// Helper for dynamic coloring of tags
function getTagColorClass(tag, type = 'hardware') {
    if (type === 'language') {
        switch(tag.toLowerCase()) {
            case 'c++':
            case 'cpp': return 'bg-blue-600/10 text-blue-300 border-blue-500/25';
            case 'python':
            case 'py': return 'bg-yellow-500/10 text-yellow-350 border-yellow-500/25';
            case 'c': return 'bg-sky-650/10 text-sky-300 border-sky-500/25';
            case 'blocks':
            case 'bloky':
            case 'grafické':
            case 'graficke (bloky)':
            case 'grafické (bloky)': return 'bg-orange-500/10 text-orange-355 border-orange-500/25';
            default: return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
        }
    }
    
    if (type === 'board') {
        switch(tag.toLowerCase()) {
            case 'esp32': return 'bg-red-500/10 text-red-300 border-red-500/25';
            case 'rbcx': return 'bg-purple-500/10 text-purple-300 border-purple-500/25';
            case 'rbc': return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25';
            case 'lego mindstorms':
            case 'lego mindstorm':
            case 'lego': return 'bg-orange-500/10 text-orange-300 border-orange-500/25';
            case 'robutek':
            case 'robůtek': return 'bg-pink-500/10 text-pink-300 border-pink-500/25';
            case 'arduino': return 'bg-teal-500/10 text-teal-300 border-teal-500/25';
            case 'raspberry pi':
            case 'rpi': return 'bg-rose-600/10 text-rose-300 border-rose-500/25';
            default: return 'bg-amber-500/10 text-amber-300 border-amber-500/25';
        }
    }

    switch(tag.toLowerCase()) {
        case 'kamera': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        case 'lidar': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        case 'barevny senzor':
        case 'barevný senzor': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        case 'gyroskop': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        case 'chapadlo / kleste':
        case 'chápadlo / kleště': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        case 'sledovani cary':
        case 'sledování čáry':
        case 'line-following modul': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
        case 'led diody': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
        case 'ultrazvukovy senzor':
        case 'ultrazvukový senzor':
        case 'ultrazvuk': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
        case 'kola': return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
        case 'pásy':
        case 'pasy': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
        default: return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
    }
}

// Core filtering logic
function applyFilters() {
    const searchVal = removeAccents(searchInput.value.trim().toLowerCase());
    const selectedYear = filterYear.value;
    const selectedComp = filterCompetition.value;
    
    // Get list of checked tags
    const checkedHw = Array.from(document.querySelectorAll('input[name="hardware-filter"]:checked')).map(cb => cb.value);
    const checkedBoards = Array.from(document.querySelectorAll('input[name="board-filter"]:checked')).map(cb => cb.value);
    const checkedLangs = Array.from(document.querySelectorAll('input[name="language-filter"]:checked')).map(cb => cb.value);
    
    filteredRobots = robotsData.filter(robot => {
        // Search text matching (name, year, competition, team members, tags)
        const nameMatch = removeAccents(robot.name.toLowerCase()).includes(searchVal);
        const yearMatchText = robot.year ? removeAccents(robot.year.toLowerCase()).includes(searchVal) : false;
        const compMatchText = removeAccents(robot.competition.toLowerCase()).includes(searchVal);
        const teamMatch = removeAccents(robot.team.toLowerCase()).includes(searchVal);
        
        const hwMatchText = robot.hardware && Array.isArray(robot.hardware)
            ? robot.hardware.some(tag => removeAccents(tag.toLowerCase()).includes(searchVal))
            : false;
        const boardMatchText = robot.board && Array.isArray(robot.board)
            ? robot.board.some(tag => removeAccents(tag.toLowerCase()).includes(searchVal))
            : false;
        const langMatchText = robot.language && Array.isArray(robot.language)
            ? robot.language.some(tag => removeAccents(tag.toLowerCase()).includes(searchVal))
            : false;
            
        const textMatch = nameMatch || yearMatchText || compMatchText || teamMatch || hwMatchText || boardMatchText || langMatchText;
        
        // Dropdown matching
        const yearMatch = !selectedYear || robot.year === selectedYear;
        const compMatch = !selectedComp || robot.competition === selectedComp;
        
        // Tag matching (AND-logic: robot must have all selected tags in each category)
        const hwMatch = checkedHw.every(tag => robot.hardware && robot.hardware.includes(tag));
        const boardMatch = checkedBoards.every(tag => robot.board && robot.board.includes(tag));
        const langMatch = checkedLangs.every(tag => robot.language && robot.language.includes(tag));
        
        return textMatch && yearMatch && compMatch && hwMatch && boardMatch && langMatch;
    });
    
    renderCards();
}

// Render filtered cards to the DOM
function renderCards() {
    // Clear the grid
    robotsGrid.innerHTML = '';
    
    if (filteredRobots.length === 0) {
        robotsGrid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    robotsGrid.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    filteredRobots.forEach((robot, index) => {
        const card = document.createElement('div');
        card.className = "glass-card rounded-2xl overflow-hidden flex flex-col h-full card-appear border border-slate-800/40 hover:border-brand-500/30 group";
        // Stagger entrance animations by index
        card.style.animationDelay = `${index * 50}ms`;
        
        // URL encode robot name for safe fallback URL
        const fallbackText = encodeURIComponent(robot.name);
        
        // Construct tags badges HTML
        let tagsHtml = '';
        
        // Render Board badges
        if (robot.board && robot.board.length > 0) {
            tagsHtml += `
                <div class="flex flex-wrap gap-1.5 mb-3">
                    <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider w-full mb-0.5 block">Deska / Platforma:</span>
                    ${robot.board.map(tag => `
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded-md border ${getTagColorClass(tag, 'board')}">
                            ${tag}
                        </span>
                    `).join('')}
                </div>
            `;
        }
        
        // Render Language badges
        if (robot.language && robot.language.length > 0) {
            tagsHtml += `
                <div class="flex flex-wrap gap-1.5 mb-3">
                    <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider w-full mb-0.5 block">Jazyk:</span>
                    ${robot.language.map(tag => `
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded-md border ${getTagColorClass(tag, 'language')}">
                            ${tag}
                        </span>
                    `).join('')}
                </div>
            `;
        }
        
        // Render Hardware badges
        if (robot.hardware && robot.hardware.length > 0) {
            tagsHtml += `
                <div class="flex flex-wrap gap-1.5">
                    <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider w-full mb-0.5 block">Hardware:</span>
                    ${robot.hardware.map(tag => `
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded-md border ${getTagColorClass(tag, 'hardware')}">
                            ${tag}
                        </span>
                    `).join('')}
                </div>
            `;
        }
        
        // Action Buttons
        let actionButtonsHtml = '';
        if (adminMode) {
            actionButtonsHtml = `
                <div class="grid grid-cols-5 gap-2">
                    <a href="${robot.github}" target="_blank" 
                       class="col-span-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-80/80 hover:bg-brand-600 hover:text-white text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/50 hover:border-brand-500/40 transition-all">
                        <i data-lucide="github" class="w-4 h-4"></i>
                        Repozitář
                    </a>
                    <button onclick="requestDeleteRobot(${robot.id}, '${robot.name.replace(/'/g, "\\'")}')" title="Odstranit robota z katalogu"
                       class="col-span-1 flex items-center justify-center p-2.5 bg-red-950/40 hover:bg-red-900/30 text-red-400 hover:text-red-300 rounded-xl border border-red-900/30 hover:border-red-900/50 transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                    <a href="${robot.issue_url}" target="_blank" title="Zobrazit schvalovací issue"
                       class="col-span-1 flex items-center justify-center p-2.5 bg-slate-850/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-all">
                        <i data-lucide="external-link" class="w-4 h-4"></i>
                    </a>
                </div>
            `;
        } else {
            actionButtonsHtml = `
                <div class="grid grid-cols-5 gap-2">
                    <a href="${robot.github}" target="_blank" 
                       class="col-span-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-brand-600 hover:text-white text-slate-200 text-sm font-semibold rounded-xl border border-slate-700/50 hover:border-brand-500/40 transition-all">
                        <i data-lucide="github" class="w-4 h-4"></i>
                        Repozitář
                    </a>
                    <a href="${robot.issue_url}" target="_blank" title="Zobrazit schvalovací issue"
                       class="col-span-1 flex items-center justify-center p-2.5 bg-slate-850/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-all">
                        <i data-lucide="external-link" class="w-4 h-4"></i>
                    </a>
                </div>
            `;
        }
        
        // Placement / Achievements Badge
        let placementBadgeHtml = '';
        if (robot.placement && robot.placement !== 'Bez specifického umístění' && robot.placement !== 'Bez umístění') {
            let badgeBgClass = 'bg-slate-900/90 text-slate-350 border-slate-700/50';
            let iconColor = 'text-amber-400';
            let iconName = 'award';
            
            if (robot.placement.includes('1.')) {
                badgeBgClass = 'bg-amber-500/10 text-amber-350 border-amber-500/30 backdrop-blur-md';
                iconColor = 'text-amber-400';
                iconName = 'trophy';
            } else if (robot.placement.includes('2.')) {
                badgeBgClass = 'bg-slate-300/10 text-slate-200 border-slate-350/30 backdrop-blur-md';
                iconColor = 'text-slate-300';
                iconName = 'medal';
            } else if (robot.placement.includes('3.')) {
                badgeBgClass = 'bg-amber-700/15 text-amber-600 border-amber-700/30 backdrop-blur-md';
                iconColor = 'text-amber-600';
                iconName = 'medal';
            }
            
            placementBadgeHtml = `
                <div class="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 ${badgeBgClass} border rounded-lg text-[10px] font-bold tracking-wide uppercase shadow-lg">
                    <i data-lucide="${iconName}" class="w-3.5 h-3.5 ${iconColor}"></i>
                    <span>${robot.placement}</span>
                </div>
            `;
        }

        card.innerHTML = `
            <!-- Image Container -->
            <div class="relative aspect-[4/3] overflow-hidden bg-slate-950/60">
                ${placementBadgeHtml}
                <img src="${robot.image}" alt="${robot.name}" loading="lazy" 
                     class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                     onerror="this.onerror=null; this.src='https://placehold.co/600x400/0d1127/a78bfa?text=${fallbackText}';">
            </div>
            
            <!-- Content -->
            <div class="p-6 flex flex-col flex-grow">
                <!-- Year & Competition (side-by-side) -->
                <div class="flex flex-wrap items-center gap-x-2 text-xs text-slate-450 mb-2.5 font-medium">
                    <span class="flex items-center gap-1 text-brand-400">
                        <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                        ${robot.year}
                    </span>
                    <span class="text-slate-700">•</span>
                    <span class="flex items-center gap-1 text-blue-400 truncate max-w-[160px]" title="${robot.competition}">
                        <i data-lucide="trophy" class="w-3.5 h-3.5"></i>
                        ${robot.competition}
                    </span>
                </div>
                
                <!-- Robot Name -->
                <h3 class="font-outfit text-xl font-bold text-white mb-2 group-hover:text-brand-300 transition-colors">
                    ${robot.name}
                </h3>
                
                <!-- Team members -->
                <div class="mb-4">
                    <p class="text-slate-350 text-sm leading-relaxed">
                        <span class="text-slate-500 font-semibold font-sans">Tým:</span> ${robot.team}
                    </p>
                </div>
                
                <!-- Tags (at the bottom, before buttons) -->
                <div class="mt-auto mb-6 space-y-3">
                    ${tagsHtml}
                </div>
                
                <!-- Action Buttons -->
                ${actionButtonsHtml}
            </div>
        `;
        
        robotsGrid.appendChild(card);
    });
    
    // Re-initialize Lucide icons for newly appended cards
    lucide.createIcons();
}

// Global function for handling admin deletion requests
window.requestDeleteRobot = function(id, name) {
    const confirmDelete = confirm(`Opravdu chcete požádat o odstranění robota "${name}" (ID: ${id})?\n\nBudete přesměrováni na předvyplněný GitHub Issue.`);
    if (confirmDelete) {
        const title = `Smazat robota: ${name} (ID: ${id})`;
        const body = `### Odstranění robota\n- **ID**: ${id}\n- **Název**: ${name}\n\nProsím o schválení odstranění tohoto robota z katalogu.`;
        const repoUrl = "https://github.com/RBCX-best/katalog-robotu/issues/new";
        window.location.href = `${repoUrl}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    }
};

// Start loading process when DOM is ready
document.addEventListener('DOMContentLoaded', fetchRobots);
