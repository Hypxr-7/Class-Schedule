/* ================================
   GLOBAL VARIABLES
   ================================ */
let selectedSections = new Set();
let allSchedules = [];
let currentScheduleIndex = 0;
let allSections = [];
let filteredSections = [];
let currentPage = 0;
const sectionsPerPage = 12;

const courseColors = [
    "#FFD700", "#FF6347", "#20B2AA", "#9370DB", "#3CB371",
    "#4682B4", "#FF69B4", "#8B4513", "#2F4F4F", "#800080"
];

/* ================================
   INITIALIZATION
   ================================ */
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing application...');
    initializeSections();
    setupEventListeners();
    displayCurrentPage();
});

/**
 * Initialize sections data and convert schedules to 12-hour format
 */
function initializeSections() {
    allSections = Array.from(document.querySelectorAll('.section-item')).map(item => ({
        element: item,
        data: {
            section: item.dataset.section,
            courseName: item.querySelector('h3').textContent.toLowerCase(),
            instructor: item.querySelector('.instructor').textContent.toLowerCase(),
            schedule: item.querySelector('.schedule').textContent.toLowerCase(),
            sectionCode: item.querySelector('.section-code').textContent.toLowerCase(),
            program: item.querySelector('.program') ? item.querySelector('.program').textContent.toLowerCase() : '',
            campus: item.querySelector('.campus').textContent.toLowerCase(),
            teachers: item.querySelector('.instructor').textContent.toLowerCase().split(' & ')
        }
    }));

    // Convert all schedule times to 12-hour format
    allSections.forEach(sectionItem => {
        const scheduleElement = sectionItem.element.querySelector('.schedule');
        if (scheduleElement) {
            scheduleElement.innerHTML = convertScheduleTo12Hour(scheduleElement.textContent);
            sectionItem.data.schedule = scheduleElement.textContent.toLowerCase();
        }
    });

    filteredSections = [...allSections];
}

/**
 * Set up all event listeners for the application
 */
function setupEventListeners() {
    // Search functionality
    const searchBox = document.getElementById('courseSearch');
    if (searchBox) {
        searchBox.addEventListener('input', function() {
            filterSections(this.value);
        });
    }
    
    // Control buttons
    const generateBtn = document.getElementById('generateBtn');
    const clearBtn = document.getElementById('clearBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (generateBtn) generateBtn.addEventListener('click', generateSchedules);
    if (clearBtn) clearBtn.addEventListener('click', clearSelection);
    if (prevBtn) prevBtn.addEventListener('click', () => navigateSchedule(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateSchedule(1));
    
    // Pagination buttons (top and bottom)
    setupPaginationListeners();
    
    console.log('Event listeners initialized');
}

/**
 * Set up pagination event listeners
 */
function setupPaginationListeners() {
    const paginationButtons = [
        { id: 'prevPageBtn', direction: -1 },
        { id: 'nextPageBtn', direction: 1 },
        { id: 'prevPageBtnBottom', direction: -1 },
        { id: 'nextPageBtnBottom', direction: 1 }
    ];
    
    paginationButtons.forEach(btn => {
        const element = document.getElementById(btn.id);
        if (element) {
            element.addEventListener('click', () => changePage(btn.direction));
        }
    });
}

/* ================================
   TIME FORMATTING UTILITIES
   ================================ */
/**
 * Convert schedule text to 12-hour format with line breaks
 * @param {string} scheduleText - Original schedule text
 * @returns {string} Formatted schedule text
 */
function convertScheduleTo12Hour(scheduleText) {
    let converted = scheduleText.replace(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/g, (match, startHour, startMin, endHour, endMin) => {
        const startTime = formatTime12Hour(`${startHour.padStart(2, '0')}:${startMin}`);
        const endTime = formatTime12Hour(`${endHour.padStart(2, '0')}:${endMin}`);
        return `${startTime}-${endTime}`;
    });
    
    return converted.replace(/,\s*/g, '<br>');
}

/**
 * Convert 24-hour time to 12-hour AM/PM format
 * @param {string} timeStr - Time in HH:MM format
 * @returns {string} Time in 12-hour AM/PM format
 */
function formatTime12Hour(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Convert time string to minutes since midnight
 * @param {string} timeStr - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/* ================================
   PAGINATION FUNCTIONS
   ================================ */
/**
 * Display current page of sections
 */
function displayCurrentPage() {
    const sectionGrid = document.getElementById('sectionGrid');
    if (!sectionGrid) return;
    
    sectionGrid.innerHTML = '';
    
    const startIndex = currentPage * sectionsPerPage;
    const endIndex = Math.min(startIndex + sectionsPerPage, filteredSections.length);
    
    for (let i = startIndex; i < endIndex; i++) {
        const sectionItem = filteredSections[i];
        const clonedElement = sectionItem.element.cloneNode(true);
        
        clonedElement.addEventListener('click', function() {
            toggleSection(this.dataset.section, this);
        });
        
        if (selectedSections.has(sectionItem.data.section)) {
            clonedElement.classList.add('selected');
        }
        
        clonedElement.style.display = 'block';
        sectionGrid.appendChild(clonedElement);
    }
    
    updatePaginationInfo();
}

/**
 * Update pagination information and button states
 */
function updatePaginationInfo() {
    const totalPages = Math.ceil(filteredSections.length / sectionsPerPage);
    const startIndex = currentPage * sectionsPerPage + 1;
    const endIndex = Math.min((currentPage + 1) * sectionsPerPage, filteredSections.length);
    
    const pageText = `Page ${currentPage + 1} of ${totalPages}`;
    const resultsText = `Showing ${startIndex}-${endIndex} of ${filteredSections.length} sections`;
    
    // Update all pagination elements
    const elements = [
        { page: 'pageInfo', results: 'resultsCounter', prev: 'prevPageBtn', next: 'nextPageBtn' },
        { page: 'pageInfoBottom', results: 'resultsCounterBottom', prev: 'prevPageBtnBottom', next: 'nextPageBtnBottom' }
    ];
    
    elements.forEach(set => {
        const pageEl = document.getElementById(set.page);
        const resultsEl = document.getElementById(set.results);
        const prevEl = document.getElementById(set.prev);
        const nextEl = document.getElementById(set.next);
        
        if (pageEl) pageEl.textContent = pageText;
        if (resultsEl) resultsEl.textContent = resultsText;
        if (prevEl) prevEl.disabled = currentPage === 0;
        if (nextEl) nextEl.disabled = currentPage >= totalPages - 1;
    });
}

/**
 * Change page
 * @param {number} direction - Direction to change page (-1 for previous, 1 for next)
 */
function changePage(direction) {
    const totalPages = Math.ceil(filteredSections.length / sectionsPerPage);
    const newPage = currentPage + direction;
    
    if (newPage >= 0 && newPage < totalPages) {
        currentPage = newPage;
        displayCurrentPage();
    }
}

/* ================================
   SECTION MANAGEMENT
   ================================ */
/**
 * Toggle section selection
 * @param {string} sectionId - ID of the section
 * @param {HTMLElement} element - The section item element
 */
function toggleSection(sectionId, element) {
    if (selectedSections.has(sectionId)) {
        selectedSections.delete(sectionId);
        element.classList.remove('selected');
    } else {
        selectedSections.add(sectionId);
        element.classList.add('selected');
    }
    
    updateSelectedCount();
    updateGenerateButton();
}

/**
 * Update the selected sections count display
 */
function updateSelectedCount() {
    const countElement = document.getElementById('selectedCount');
    if (countElement) {
        countElement.textContent = selectedSections.size;
    }
}

/**
 * Update generate button state
 */
function updateGenerateButton() {
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
        generateBtn.disabled = selectedSections.size === 0;
    }
}

/**
 * Clear all section selections
 */
function clearSelection() {
    selectedSections.clear();
    displayCurrentPage();
    updateSelectedCount();
    updateGenerateButton();
    
    const results = document.getElementById('results');
    if (results) results.style.display = 'none';
}

/**
 * Filter sections based on search term
 * @param {string} searchTerm - The search term
 */
function filterSections(searchTerm) {
    const term = searchTerm.toLowerCase();
    
    filteredSections = term === '' ? [...allSections] : allSections.filter(sectionItem => {
        const data = sectionItem.data;
        
        // Check if any individual teacher name matches
        const teacherMatch = data.teachers.some(teacher => teacher.includes(term));
        
        return data.courseName.includes(term) || 
               data.instructor.includes(term) || 
               teacherMatch ||
               data.schedule.includes(term) || 
               data.sectionCode.includes(term) ||
               data.program.includes(term)
    });
    
    currentPage = 0;
    displayCurrentPage();
}

/* ================================
   SCHEDULE GENERATION
   ================================ */
/**
 * Generate schedules by calling the backend API
 */
async function generateSchedules() {
    if (selectedSections.size === 0) return;
    
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const results = document.getElementById('results');
    
    showLoading(true);
    hideError();
    hideResults();
    
    try {
        const response = await fetch('/generate_schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sections: Array.from(selectedSections),
                max_schedules: 50
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            allSchedules = data.schedules;
            currentScheduleIndex = 0;
            displaySchedules();
            showResults();
        } else {
            showError(data.error);
        }
    } catch (error) {
        console.error('Error generating schedules:', error);
        showError('Failed to generate schedules. Please try again.');
    }
    
    showLoading(false);
}

/* ================================
   UI STATE MANAGEMENT
   ================================ */
/**
 * Show/hide loading state
 * @param {boolean} show - Whether to show loading
 */
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = show ? 'block' : 'none';
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

/**
 * Hide error message
 */
function hideError() {
    const error = document.getElementById('error');
    if (error) error.style.display = 'none';
}

/**
 * Show results section
 */
function showResults() {
    const results = document.getElementById('results');
    if (results) results.style.display = 'block';
}

/**
 * Hide results section
 */
function hideResults() {
    const results = document.getElementById('results');
    if (results) results.style.display = 'none';
}

/* ================================
   SCHEDULE DISPLAY
   ================================ */
/**
 * Display the current schedule
 */
function displaySchedules() {
    if (allSchedules.length === 0) return;
    
    const schedule = allSchedules[currentScheduleIndex];
    const container = document.getElementById('scheduleContainer');
    
    updateScheduleNavigation();
    
    if (container) {
        container.innerHTML = generateScheduleHTML(schedule);
    }
}

/**
 * Update schedule navigation controls
 */
function updateScheduleNavigation() {
    const elements = {
        current: document.getElementById('currentSchedule'),
        total: document.getElementById('totalSchedules'),
        prev: document.getElementById('prevBtn'),
        next: document.getElementById('nextBtn')
    };
    
    if (elements.current) elements.current.textContent = currentScheduleIndex + 1;
    if (elements.total) elements.total.textContent = allSchedules.length;
    if (elements.prev) elements.prev.disabled = currentScheduleIndex === 0;
    if (elements.next) elements.next.disabled = currentScheduleIndex === allSchedules.length - 1;
}

/**
 * Navigate between schedules
 * @param {number} direction - Direction to navigate (-1 for previous, 1 for next)
 */
function navigateSchedule(direction) {
    const newIndex = currentScheduleIndex + direction;
    if (newIndex >= 0 && newIndex < allSchedules.length) {
        currentScheduleIndex = newIndex;
        displaySchedules();
    }
}

/* ================================
   SCHEDULE HTML GENERATION
   ================================ */
/**
 * Generate HTML for a schedule
 * @param {Object} schedule - Schedule object
 * @returns {string} HTML string
 */
function generateScheduleHTML(schedule) {
    return `
        ${generateMetricsHTML(schedule)}
        ${generateTimetableHTML(schedule)}
        ${generateCourseDetailsHTML(schedule)}
    `;
}

/**
 * Generate metrics HTML
 * @param {Object} schedule - Schedule object
 * @returns {string} HTML string
 */
function generateMetricsHTML(schedule) {
    return `
        <div class="metrics">
            <div class="metric">
                <div class="metric-value">${schedule.days_count}</div>
                <div class="metric-label">Days</div>
            </div>
            <div class="metric">
                <div class="metric-value">${schedule.gap_time}</div>
                <div class="metric-label">Gap Minutes</div>
            </div>
            <div class="metric">
                <div class="metric-value">${Math.floor(schedule.gap_time / 60)}h ${schedule.gap_time % 60}m</div>
                <div class="metric-label">Total Gap Time</div>
            </div>
        </div>
    `;
}

/**
 * Generate timetable HTML
 * @param {Object} schedule - Schedule object
 * @returns {string} HTML string
 */
function generateTimetableHTML(schedule) {
    const dayOrder = ['M', 'T', 'W', 'R', 'F', 'S'];
    const dayNames = {
        'M': 'Monday', 'T': 'Tuesday', 'W': 'Wednesday', 
        'R': 'Thursday', 'F': 'Friday', 'S': 'Saturday'
    };
    const sortedDays = Object.keys(schedule.days).sort((a, b) => 
        dayOrder.indexOf(a) - dayOrder.indexOf(b)
    );
    
    let html = `
        <h3>Timetable View</h3>
        <table class="timetable">
            <thead>
                <tr>
                    <th class="time-column">Time</th>
                    ${sortedDays.map(day => `<th>${dayNames[day] || day}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;
    
    const timeSlots = generateTimeSlots();
    timeSlots.forEach(timeSlot => {
        html += `<tr><td class="time-column">${formatTime12Hour(timeSlot)}</td>`;
        
        sortedDays.forEach(day => {
            html += '<td>';
            const sessions = schedule.days[day] || [];
            
            sessions.forEach(session => {
                if (session.start === timeSlot) {
                    html += generateCourseSlotHTML(session, schedule);
                }
            });
            
            html += '</td>';
        });
        
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    return html;
}

/**
 * Generate course slot HTML
 * @param {Object} session - Session object
 * @param {Object} schedule - Schedule object
 * @returns {string} HTML string
 */
function generateCourseSlotHTML(session, schedule) {
    const duration = (timeToMinutes(session.end) - timeToMinutes(session.start)) / 30;
    const height = duration * 40 - 4;
    const color = courseColors[Object.keys(schedule.courses).indexOf(session.course) % courseColors.length];
    
    const shortName = session.course.split(' ').filter(w => w.length > 3 || w.match(/^[A-Z]+$/)).join(' ');
    const displayName = shortName.length > 25 ? shortName.substring(0, 22) + '...' : shortName;
    
    // Handle multiple teachers - show abbreviated form in timetable
    let teacherDisplay = session.teacher;
    if (session.teachers && session.teachers.length > 1) {
        // For multiple teachers, show count or abbreviated form
        teacherDisplay = `${session.teachers.length} instructors`;
    }
    
    return `
        <div class="course-slot" style="height: ${height}px; background-color: ${color};" 
             title="${session.course} - Section ${session.section} - ${session.teacher}">
            <strong>${displayName}</strong><br>
            ${formatTime12Hour(session.start)} - ${formatTime12Hour(session.end)}<br>
            <small>Sec: ${session.section}<br>${teacherDisplay}</small>
        </div>
    `;
}

/**
 * Format instructor name for display
 * @param {string} instructor - Full instructor name
 * @returns {string} Formatted instructor name
 */
// function formatInstructorName(instructor) {
//     if (instructor.split(' ').length > 1) {
//         let formatted = instructor.split(' ')[0].charAt(0) + ". " + instructor.split(' ').pop();
//         return formatted.length > 15 ? instructor.split(' ').pop() : formatted;
//     }
//     return instructor;
// }

/**
 * Generate course details HTML
 * @param {Object} schedule - Schedule object
 * @returns {string} HTML string
 */
function generateCourseDetailsHTML(schedule) {
    let html = `
        <div class="course-details">
            <h3>Selected Sections</h3>
            <div class="course-list">
    `;
    
    Object.entries(schedule.courses).forEach(([courseName, courseInfo]) => {
        html += `
            <div class="course-card">
                <h4>${courseName}</h4>
                <p><strong>Section:</strong> ${courseInfo.section}</p>
                <p><strong>Teacher:</strong> ${courseInfo.teacher}</p>
            </div>
        `;
    });
    
    html += '</div></div>';
    return html;
}

/**
 * Generate time slots for the timetable (8:00 AM to 6:30 PM)
 * @returns {Array} Array of time slots in HH:MM format
 */
function generateTimeSlots() {
    const slots = [];
    for (let hour = 8; hour < 19; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
}
