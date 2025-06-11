// Global variables
let selectedSections = new Set();
let allSchedules = [];
let currentScheduleIndex = 0;

const courseColors = [
    "#FFD700", "#FF6347", "#20B2AA", "#9370DB", "#3CB371",
    "#4682B4", "#FF69B4", "#8B4513", "#2F4F4F", "#800080"
];

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, setting up event listeners...');
    setupEventListeners();
});

/**
 * Set up all event listeners for the application
 */
function setupEventListeners() {
    // Section selection
    const sectionItems = document.querySelectorAll('.section-item');
    console.log('Found section items:', sectionItems.length);
    
    sectionItems.forEach(item => {
        item.addEventListener('click', function() {
            console.log('Section clicked:', this.dataset.section);
            toggleSection(this.dataset.section, this);
        });
    });
    
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
    
    console.log('Event listeners set up complete');
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
    document.querySelectorAll('.section-item').forEach(item => {
        item.classList.remove('selected');
    });
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
    const items = document.querySelectorAll('.section-item');
    const term = searchTerm.toLowerCase();
    
    items.forEach(item => {
        const courseTitle = item.querySelector('h3').textContent.toLowerCase();
        const instructor = item.querySelector('.instructor').textContent.toLowerCase();
        const schedule = item.querySelector('.schedule').textContent.toLowerCase();
        const sectionCode = item.querySelector('.section-code').textContent.toLowerCase();
        
        const matches = courseTitle.includes(term) || 
                       instructor.includes(term) || 
                       schedule.includes(term) || 
                       sectionCode.includes(term);
        
        item.style.display = matches ? 'block' : 'none';
    });
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
        html += `<tr><td class="time-column">${timeSlot}</td>`;
        
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
                            ${session.start} - ${session.end}<br>
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

