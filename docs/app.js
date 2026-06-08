// Application state
let robotsData = [];
let filteredRobots = [];

// DOM Elements
const robotsGrid = document.getElementById('robots-grid');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const filterYear = document.getElementById('filter-year');
const filterCompetition = document.getElementById('filter-competition');
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
    
    // Populate dropdown options
    populateFilters();
    
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

// Populate the select elements with unique values present in the database
function populateFilters() {
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

// Reset all filtering inputs
function resetFilters() {
    searchInput.value = '';
    filterYear.value = '';
    filterCompetition.value = '';
    applyFilters();
}

// Core filtering logic
function applyFilters() {
    const searchVal = removeAccents(searchInput.value.trim().toLowerCase());
    const selectedYear = filterYear.value;
    const selectedComp = filterCompetition.value;
    
    filteredRobots = robotsData.filter(robot => {
        // Search text matching (name, competition, team members)
        const nameMatch = removeAccents(robot.name.toLowerCase()).includes(searchVal);
        const compMatchText = removeAccents(robot.competition.toLowerCase()).includes(searchVal);
        const teamMatch = removeAccents(robot.team.toLowerCase()).includes(searchVal);
        const textMatch = nameMatch || compMatchText || teamMatch;
        
        // Dropdown matching
        const yearMatch = !selectedYear || robot.year === selectedYear;
        const compMatch = !selectedComp || robot.competition === selectedComp;
        
        return textMatch && yearMatch && compMatch;
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
        
        card.innerHTML = `
            <!-- Image Container -->
            <div class="relative aspect-[4/3] overflow-hidden bg-slate-950/60">
                <img src="${robot.image}" alt="${robot.name}" 
                     class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                     onerror="this.onerror=null; this.src='https://placehold.co/600x400/0d1127/a78bfa?text=${fallbackText}';">
                <div class="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                    <span class="px-2.5 py-1 bg-brand-500/90 backdrop-blur-md text-white text-xs font-bold rounded-lg border border-brand-400/30 shadow-lg">
                        ${robot.year}
                    </span>
                </div>
            </div>
            
            <!-- Content -->
            <div class="p-6 flex flex-col flex-grow">
                <div class="flex items-center gap-1.5 text-xs text-blue-400 font-semibold uppercase tracking-wider mb-2">
                    <i data-lucide="trophy" class="w-3.5 h-3.5"></i>
                    <span class="truncate">${robot.competition}</span>
                </div>
                
                <h3 class="font-outfit text-xl font-bold text-white mb-3 group-hover:text-brand-300 transition-colors">
                    ${robot.name}
                </h3>
                
                <!-- Team members -->
                <div class="mb-6 flex-grow">
                    <div class="text-xs text-slate-555 text-slate-500 font-medium mb-1 flex items-center gap-1">
                        <i data-lucide="users" class="w-3.5 h-3.5"></i>
                        Členové týmu
                    </div>
                    <p class="text-slate-300 text-sm font-light leading-relaxed">
                        ${robot.team}
                    </p>
                </div>
                
                <!-- Action Buttons -->
                <div class="grid grid-cols-5 gap-2 mt-auto">
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
