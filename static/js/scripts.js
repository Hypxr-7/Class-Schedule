// Global variables
let selectedSections = new Set();
let allSchedules = [];
let currentScheduleIndex = 0;
// Add pagination variables
let allSections = [];
let filteredSections = [];
let currentPage = 0;
const sectionsPerPage = 12;

const courseColors = [
    "#FFD700", "#FF6347", "#20B2AA", "#9370DB", "#3CB371",
    "#4682B4", "#FF69B4", "#8B4513", "#2F4F4F", "#800080"
];

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up event listeners...');
    // Store all sections for pagination
    allSections = Array.from(document.querySelectorAll('.section-item')).map(item => ({
        element: item,
        data: {
            section: item.dataset.section,
            courseName: item.querySelector('h3').textContent.toLowerCase(),
            instructor: item.querySelector('.instructor').textContent.toLowerCase(),
            schedule: item.querySelector('.schedule').textContent.toLowerCase(),
            sectionCode: item.querySelector('.section-code').textContent.toLowerCase()
        }
    }));

    // Convert all schedule times to 12-hour format
    allSections.forEach(sectionItem => {
    const scheduleElement = sectionItem.element.querySelector('.schedule');
    if (scheduleElement) {
        scheduleElement.innerHTML = convertScheduleTo12Hour(scheduleElement.textContent);
        // Update the stored data as well
        sectionItem.data.schedule = scheduleElement.textContent.toLowerCase();
    }
});

    filteredSections = [...allSections];
    setupEventListeners();
    displayCurrentPage();
});

function convertScheduleTo12Hour(scheduleText) {
    // First convert time patterns like "14:30-16:00" or "09:00-10:30" to 12-hour format
    let converted = scheduleText.replace(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/g, (match, startHour, startMin, endHour, endMin) => {
        const startTime = formatTime12Hour(`${startHour.padStart(2, '0')}:${startMin}`);
        const endTime = formatTime12Hour(`${endHour.padStart(2, '0')}:${endMin}`);
        return `${startTime}-${endTime}`;
    });
    
    // Replace commas with line breaks for better formatting
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
    
    // Pagination buttons
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    const prevPageBtnBottom = document.getElementById('prevPageBtnBottom');
    const nextPageBtnBottom = document.getElementById('nextPageBtnBottom');
    
    
    if (generateBtn) generateBtn.addEventListener('click', generateSchedules);
    if (clearBtn) clearBtn.addEventListener('click', clearSelection);
    if (prevBtn) prevBtn.addEventListener('click', () => navigateSchedule(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateSchedule(1));
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => changePage(-1));
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => changePage(1));
    
    if (prevPageBtnBottom) prevPageBtnBottom.addEventListener('click', () => changePage(-1));
    if (nextPageBtnBottom) nextPageBtnBottom.addEventListener('click', () => changePage(1));
    
    console.log('Event listeners set up complete');
}

/**
 * Display current page of sections
 */
function displayCurrentPage() {
    const sectionGrid = document.getElementById('sectionGrid');
    if (!sectionGrid) return;
    
    // Clear current display
    sectionGrid.innerHTML = '';
    
    // Calculate start and end indices
    const startIndex = currentPage * sectionsPerPage;
    const endIndex = Math.min(startIndex + sectionsPerPage, filteredSections.length);
    
    // Display sections for current page
    for (let i = startIndex; i < endIndex; i++) {
        const sectionItem = filteredSections[i];
        const clonedElement = sectionItem.element.cloneNode(true);
        
        // Re-attach event listener to cloned element
        clonedElement.addEventListener('click', function() {
            toggleSection(this.dataset.section, this);
        });
        
        // Maintain selection state
        if (selectedSections.has(sectionItem.data.section)) {
            clonedElement.classList.add('selected');
        }
        
        clonedElement.style.display = 'block';
        sectionGrid.appendChild(clonedElement);
    }
    
    // Update pagination info
    updatePaginationInfo();
}

/**
 * Update pagination information and button states
 */
function updatePaginationInfo() {
    // Top pagination elements
    const pageInfo = document.getElementById('pageInfo');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const resultsCounter = document.getElementById('resultsCounter');
    
    // Bottom pagination elements
    const pageInfoBottom = document.getElementById('pageInfoBottom');
    const prevPageBtnBottom = document.getElementById('prevPageBtnBottom');
    const nextPageBtnBottom = document.getElementById('nextPageBtnBottom');
    const resultsCounterBottom = document.getElementById('resultsCounterBottom');
    
    const totalPages = Math.ceil(filteredSections.length / sectionsPerPage);
    const startIndex = currentPage * sectionsPerPage + 1;
    const endIndex = Math.min((currentPage + 1) * sectionsPerPage, filteredSections.length);
    
    const pageText = `Page ${currentPage + 1} of ${totalPages}`;
    const resultsText = `Showing ${startIndex}-${endIndex} of ${filteredSections.length} sections`;
    
    // Update top pagination
    if (pageInfo) pageInfo.textContent = pageText;
    if (resultsCounter) resultsCounter.textContent = resultsText;
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 0;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages - 1;
    
    // Update bottom pagination
    if (pageInfoBottom) pageInfoBottom.textContent = pageText;
    if (resultsCounterBottom) resultsCounterBottom.textContent = resultsText;
    if (prevPageBtnBottom) prevPageBtnBottom.disabled = currentPage === 0;
    if (nextPageBtnBottom) nextPageBtnBottom.disabled = currentPage >= totalPages - 1;
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

/**
 * Toggle section selection
 * @param {string} sectionId - ID of the section
 * @param {HTMLElement} element - The section item element
 */
function toggleSection(sectionId, element) {
    console.log('Toggling section:', sectionId);
    
    if (selectedSections.has(sectionId)) {
        selectedSections.delete(sectionId);
        element.classList.remove('selected');
        console.log('Removed section:', sectionId);
    } else {
        selectedSections.add(sectionId);
        element.classList.add('selected');
        console.log('Added section:', sectionId);
    }
    
    updateSelectedCount();
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
        generateBtn.disabled = selectedSections.size === 0;
    }
}

/**
 * Update the selected sections count display
 */
function updateSelectedCount() {
    const countElement = document.getElementById('selectedCount');
    if (countElement) {
        countElement.textContent = selectedSections.size;
    }
    console.log('Selected sections count:', selectedSections.size);
}

/**
 * Clear all section selections
 */
function clearSelection() {
    console.log('Clearing all selections');
    selectedSections.clear();
    
    // Update display
    displayCurrentPage();
    updateSelectedCount();
    
    const generateBtn = document.getElementById('generateBtn');
    const results = document.getElementById('results');
    
    if (generateBtn) generateBtn.disabled = true;
    if (results) results.style.display = 'none';
}

/**
 * Filter sections based on search term
 * @param {string} searchTerm - The search term
 */
function filterSections(searchTerm) {
    const term = searchTerm.toLowerCase();
    
    if (term === '') {
        filteredSections = [...allSections];
    } else {
        filteredSections = allSections.filter(sectionItem => {
            const data = sectionItem.data;
            return data.courseName.includes(term) || 
                   data.instructor.includes(term) || 
                   data.schedule.includes(term) || 
                   data.sectionCode.includes(term);
        });
    }
    
    // Reset to first page when filtering
    currentPage = 0;
    displayCurrentPage();
}

/**
 * Generate schedules by calling the backend API
 */
async function generateSchedules() {
    if (selectedSections.size === 0) return;
    
    console.log('Generating schedules for:', Array.from(selectedSections));
    
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const results = document.getElementById('results');
    
    if (loading) loading.style.display = 'block';
    if (error) error.style.display = 'none';
    if (results) results.style.display = 'none';
    
    try {
        const response = await fetch('/generate_schedules', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sections: Array.from(selectedSections),
                max_schedules: 50
            })
        });
        
        const data = await response.json();
        console.log('Response received:', data);
        
        if (data.success) {
            allSchedules = data.schedules;
            currentScheduleIndex = 0;
            displaySchedules();
            if (results) results.style.display = 'block';
        } else {
            showError(data.error);
        }
    } catch (error) {
        console.error('Error generating schedules:', error);
        showError('Failed to generate schedules. Please try again.');
    }
    
    if (loading) loading.style.display = 'none';
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
 * Display the current schedule
 */
function displaySchedules() {
    if (allSchedules.length === 0) return;
    
    const schedule = allSchedules[currentScheduleIndex];
    const container = document.getElementById('scheduleContainer');
    
    // Update navigation
    const currentScheduleSpan = document.getElementById('currentSchedule');
    const totalSchedulesSpan = document.getElementById('totalSchedules');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (currentScheduleSpan) currentScheduleSpan.textContent = currentScheduleIndex + 1;
    if (totalSchedulesSpan) totalSchedulesSpan.textContent = allSchedules.length;
    if (prevBtn) prevBtn.disabled = currentScheduleIndex === 0;
    if (nextBtn) nextBtn.disabled = currentScheduleIndex === allSchedules.length - 1;
    
    // Generate HTML for current schedule
    if (container) {
        container.innerHTML = generateScheduleHTML(schedule);
    }
}

/**
 * Generate HTML for a schedule
 * @param {Object} schedule - Schedule object
 * @returns {string} HTML string
 */
function generateScheduleHTML(schedule) {
    const dayOrder = ['M', 'T', 'W', 'R', 'F', 'S'];
    const sortedDays = Object.keys(schedule.days).sort((a, b) => 
        dayOrder.indexOf(a) - dayOrder.indexOf(b)
    );
    
    const dayNames = {
        'M': 'Monday', 'T': 'Tuesday', 'W': 'Wednesday', 
        'R': 'Thursday', 'F': 'Friday', 'S': 'Saturday'
    };
    
    let html = `
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
        
        <h3>Timetable View</h3>
        <table class="timetable">
            <thead>
                <tr>
                    <th class="time-column">Time</th>
    `;
    
    // Add day headers
    sortedDays.forEach(day => {
        html += `<th>${dayNames[day] || day}</th>`;
    });
    
    html += `
                </tr>
            </thead>
            <tbody>
    `;
    
    // Generate time slots
    const timeSlots = generateTimeSlots();
    timeSlots.forEach(timeSlot => {
        html += `<tr><td class="time-column">${formatTime12Hour(timeSlot)}</td>`;
        
        sortedDays.forEach(day => {
            html += '<td>';
            
            const sessions = schedule.days[day] || [];
            sessions.forEach((session, index) => {
                // Only show the course block at its exact start time
                if (session.start === timeSlot) {
                    const duration = (timeToMinutes(session.end) - timeToMinutes(session.start)) / 30;
                    const height = duration * 40 - 4;
                    const color = courseColors[Object.keys(schedule.courses).indexOf(session.course) % courseColors.length];
                    
                    const shortName = session.course.split(' ').filter(w => w.length > 3 || w.match(/^[A-Z]+$/)).join(' ');
                    const displayName = shortName.length > 25 ? shortName.substring(0, 22) + '...' : shortName;
                    
                    // Get instructor name - ensure showing full last name at minimum
                    const instructor = session.teacher;
                    let instructorDisplay;
                    if (instructor.split(' ').length > 1) {
                        instructorDisplay = instructor.split(' ')[0].charAt(0) + ". " + instructor.split(' ').pop();
                        if (instructorDisplay.length > 15) {
                            instructorDisplay = instructor.split(' ').pop(); // Just last name if too long
                        }
                    } else {
                        instructorDisplay = instructor; // Use full name if it's just one word
                    }
                    
                    html += `
                        <div class="course-slot" style="height: ${height}px; background-color: ${color};" 
                             title="${session.course} - Section ${session.section} - ${session.teacher}">
                            <strong>${displayName}</strong><br>
                            ${formatTime12Hour(session.start)} - ${formatTime12Hour(session.end)}<br>
                            <small>Sec: ${session.section}<br>${instructorDisplay}</small>
                        </div>
                    `;
                }
            });
            
            html += '</td>';
        });
        
        html += '</tr>';
    });
    
    html += `
            </tbody>
        </table>
        
        <div class="course-details">
            <h3>Selected Sections</h3>
            <div class="course-list">
    `;
    
    // Add course details
    Object.entries(schedule.courses).forEach(([courseName, courseInfo]) => {
        html += `
            <div class="course-card">
                <h4>${courseName}</h4>
                <p><strong>Section:</strong> ${courseInfo.section}</p>
                <p><strong>Teacher:</strong> ${courseInfo.teacher}</p>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

/**
 * Generate time slots for the timetable
 * @returns {Array} Array of time slots
 */
function generateTimeSlots() {
    const slots = [];
    for (let hour = 8; hour < 19; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
}

/**
 * Convert time string to minutes
 * @param {string} timeStr - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
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