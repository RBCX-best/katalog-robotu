// Application state
let robotsData = [];
let filteredRobots = [];
let allHardwareTags = [];

// DOM Elements
const robotsGrid = document.getElementById('robots-grid');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const filterYear = document.getElementById('filter-year');
const filterCompetition = document.getElementById('filter-competition');
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
    
    // Extract hardware tags
    extractHardwareTags();
    
    // Populate dropdown options
    populateFilters();
    
    // Populate hardware tag filters
    renderHardwareFilterCheckboxes();
    
    // Perform initial render
    applyFilters();
    
    // Add event listeners
    searchInput.addEventListener('input', applyFilters);
    filterYear.addEventListener('change', applyFilters);
    filterCompetition.addEventListener('change', applyFilters);
    
    btnClear.addEventListener('click', resetFilters);
    btnEmptyReset.addEventListener('click', resetFilters);
    
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

// Extract all unique hardware tags from the robots database
function extractHardwareTags() {
    const tagsSet = new Set();
    robotsData.forEach(robot => {
        if (robot.hardware && Array.isArray(robot.hardware)) {
            robot.hardware.forEach(tag => tagsSet.add(tag.trim()));
        }
    });
    allHardwareTags = Array.from(tagsSet).sort((a, b) => a.localeCompare(b));
}

// Populate the select elements with unique values present in the database
function populateFilters() {
    // Clear select elements, keeping the first (default) option
    filterYear.innerHTML = '<option value="">Všechny roky</option>';
    filterCompetition.innerHTML = '<option value="">Všechny soutěže</option>';

    // Extract unique school years and sort them
    const years = [...new Set(robotsData.map(r => r.year).filter(Boolean))];
    years.sort((a, b) => b.localeCompare(a)); // Sort descending (recent first)
    
    years.forEach(year => {
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

// Render dynamic checkboxes for each unique hardware tag
function renderHardwareFilterCheckboxes() {
    hardwareFiltersContainer.innerHTML = '';
    
    if (allHardwareTags.length === 0) {
        hardwareFiltersContainer.innerHTML = '<span class="text-xs text-slate-500 italic">Žádné tagy nebyly nalezeny v databázi.</span>';
        return;
    }
    
    allHardwareTags.forEach(tag => {
        const label = document.createElement('label');
        label.className = "flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700/60 rounded-xl cursor-pointer select-none transition-all text-xs font-semibold text-slate-350";
        label.innerHTML = `
            <input type="checkbox" name="hardware-filter" value="${tag}" class="w-3.5 h-3.5 rounded text-brand-600 bg-slate-950 border-slate-850 focus:ring-brand-500/20">
            <span>${tag}</span>
        `;
        
        // Add event listener to checkbox
        label.querySelector('input').addEventListener('change', applyFilters);
        hardwareFiltersContainer.appendChild(label);
    });
}

// Reset all filtering inputs
function resetFilters() {
    searchInput.value = '';
    filterYear.value = '';
    filterCompetition.value = '';
    
    // Uncheck all hardware filters
    document.querySelectorAll('input[name="hardware-filter"]').forEach(cb => {
        cb.checked = false;
    });
    
    applyFilters();
}

// Helper for dynamic coloring of tags
function getTagColorClass(tag) {
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
        default: return 'bg-violet-500/10 text-violet-400 border-violet-500/20'; // Sleek default for new custom tags
    }
}

// Core filtering logic
function applyFilters() {
    const searchVal = removeAccents(searchInput.value.trim().toLowerCase());
    const selectedYear = filterYear.value;
    const selectedComp = filterCompetition.value;
    
    // Get list of checked hardware tags
    const checkedTags = Array.from(document.querySelectorAll('input[name="hardware-filter"]:checked')).map(cb => cb.value);
    
    filteredRobots = robotsData.filter(robot => {
        // Search text matching (name, competition, team members)
        const nameMatch = removeAccents(robot.name.toLowerCase()).includes(searchVal);
        const compMatchText = removeAccents(robot.competition.toLowerCase()).includes(searchVal);
        const teamMatch = removeAccents(robot.team.toLowerCase()).includes(searchVal);
        const textMatch = nameMatch || compMatchText || teamMatch;
        
        // Dropdown matching
        const yearMatch = !selectedYear || robot.year === selectedYear;
        const compMatch = !selectedComp || robot.competition === selectedComp;
        
        // Hardware tag matching (AND-logic: robot must have all selected tags)
        const tagsMatch = checkedTags.every(tag => robot.hardware && robot.hardware.includes(tag));
        
        return textMatch && yearMatch && compMatch && tagsMatch;
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
        
        // Construct hardware tags badges HTML
        let hwBadgesHtml = '';
        if (robot.hardware && robot.hardware.length > 0) {
            hwBadgesHtml = `
                <div class="flex flex-wrap gap-1.5">
                    ${robot.hardware.map(tag => `
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded-md border ${getTagColorClass(tag)}">
                            ${tag}
                        </span>
                    `).join('')}
                </div>
            `;
        }
        
        card.innerHTML = `
            <!-- Image Container -->
            <div class="relative aspect-[4/3] overflow-hidden bg-slate-950/60">
                <img src="${robot.image}" alt="${robot.name}" 
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
                
                <!-- Hardware Tags (at the bottom, before buttons) -->
                <div class="mt-auto mb-6">
                    ${hwBadgesHtml}
                </div>
                
                <!-- Action Buttons -->
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
            </div>
        `;
        
        robotsGrid.appendChild(card);
    });
    
    // Re-initialize Lucide icons for newly appended cards
    lucide.createIcons();
}

// Start loading process when DOM is ready
document.addEventListener('DOMContentLoaded', fetchRobots);
