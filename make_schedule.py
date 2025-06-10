#!/home/hypxr/Repositories/Class-Schedule/.venv/bin/python3


import csv
import os
from constraint import Problem
from collections import defaultdict
from datetime import datetime
import argparse
import webbrowser

# Day mapping to expand day codes
DAY_MAP = {
    "MW": ["M", "W"],
    "TR": ["T", "R"],
    "FS": ["F", "S"]
}

# Day name mapping for display
DAY_NAME_MAP = {
    'M': 'Monday',
    'T': 'Tuesday',
    'W': 'Wednesday',
    'R': 'Thursday',
    'F': 'Friday',
    'S': 'Saturday'
}

# Helper function to convert time string (HH:MM) to minutes since midnight
def time_to_minutes(tstr):
    # Parse time string and calculate total minutes
    return int(datetime.strptime(tstr, "%H:%M").hour) * 60 + int(datetime.strptime(tstr, "%H:%M").minute)

# Helper function to convert minutes back to time string format (HH:MM)
def minutes_to_time(minutes):
    # Format hours and minutes with leading zeros if needed
    return f"{minutes // 60:02d}:{minutes % 60:02d}"

# Helper function to check if two days conflict (considering composite days like TR)
def days_conflict(day1, day2):
    # Handle single-day designations (like "T", "M", etc.)
    if len(day1) == 1 and len(day2) == 1:
        return day1 == day2
    
    # If either day is a composite day string (like "TR" or "MW")
    expanded_day1 = [day1] if len(day1) == 1 else list(day1)
    expanded_day2 = [day2] if len(day2) == 1 else list(day2)
    
    # Check for any overlap in days
    return any(d in expanded_day2 for d in expanded_day1)

# Function to read course data from CSV and organize by course name
def load_courses(csv_filename):
    # Initialize dictionary that will automatically create empty lists for new keys
    courses = defaultdict(list)

    # Open and process the CSV file
    with open(csv_filename, newline='') as csvfile:
        # Create reader that maps column names to values
        reader = csv.DictReader(csvfile)
        for row in reader:
            # Extract and clean data from each row
            course_name = row["Course"].strip()
            class_no = row["UMS Class No."].strip()
            teacher = row["Teacher"].strip()
            day = row["Day"].strip()
            one_day = row.get("One Day", "").strip()
            start = time_to_minutes(row["Start Time"].strip())
            end = time_to_minutes(row["End Time"].strip())
            
            # Determine actual days based on One Day field
            if one_day and one_day.lower() != "no":
                # Use the specified single day
                actual_days = [one_day]
            else:
                # Split composite days into individual days (MW -> M, W)
                if day in DAY_MAP:
                    actual_days = DAY_MAP[day]
                else:
                    actual_days = [day]

            # Find if this section already exists in our data structure
            section = next((s for s in courses[course_name] if s["UMS Class No."] == class_no), None)
            if section is None:
                # Create new section if it doesn't exist
                section = {
                    "UMS Class No.": class_no,
                    "Teacher": teacher,
                    "Sessions": []
                }
                courses[course_name].append(section)  # Add to course's section list
            
            # Add sessions for each actual day
            for actual_day in actual_days:
                section["Sessions"].append((actual_day, start, end))  # Add this session to the section
    
    return courses  # Return organized course data

# Function to check if two course sections have time conflicts
def sections_conflict(sec1, sec2):
    for d1, s1, e1 in sec1["Sessions"]:  # For each session in first section
        for d2, s2, e2 in sec2["Sessions"]:  # For each session in second section
            if days_conflict(d1, d2):  # If sessions might be on the same day
                # Check for time overlap
                if s1 < e2 and s2 < e1:
                    return True  # Conflict exists
    return False  # No conflicts found

# Function to create constraint satisfaction problem for scheduling
def build_csp(courses, selected_course_names):
    problem = Problem()  # Create new CSP instance

    # Add each course as a variable with its available sections as domain values
    for course in selected_course_names:
        class_nos = [section["UMS Class No."] for section in courses[course]]
        problem.addVariable(course, class_nos)

    # Add constraints between each pair of courses to prevent conflicts
    for i, c1 in enumerate(selected_course_names):
        for j in range(i + 1, len(selected_course_names)):  # Avoid duplicate pairs
            c2 = selected_course_names[j]

            # Create constraint function for this course pair
            def make_constraint(course1, course2):
                def no_overlap(class_no1, class_no2):
                    # Get section objects for these class numbers
                    sec1 = next(sec for sec in courses[course1] if sec["UMS Class No."] == class_no1)
                    sec2 = next(sec for sec in courses[course2] if sec["UMS Class No."] == class_no2)
                    return not sections_conflict(sec1, sec2)  # Return True if no conflict
                return no_overlap
            
            # Add the constraint to our problem
            problem.addConstraint(make_constraint(c1, c2), (c1, c2))

    return problem  # Return configured CSP

# Calculate the number of unique days in a schedule
def count_days(solution, courses, selected_courses):
    all_days = set()
    for course in selected_courses:
        class_no = solution[course]
        section = next(sec for sec in courses[course] if sec["UMS Class No."] == class_no)
        for day, _, _ in section["Sessions"]:
            all_days.add(day)  # Each day is already individual (M, T, W, etc.)
    return len(all_days)

# Calculate the total gap time between classes on the same day
def calculate_gaps(solution, courses, selected_courses):
    # Organize sessions by day
    day_sessions = defaultdict(list)
    for course in selected_courses:
        class_no = solution[course]
        section = next(sec for sec in courses[course] if sec["UMS Class No."] == class_no)
        for day, start, end in section["Sessions"]:
            day_sessions[day].append((start, end, course))
    
    # Calculate gaps for each day
    total_gap = 0
    for day, sessions in day_sessions.items():
        if len(sessions) <= 1:
            continue  # No gaps with only one session
        
        # Sort sessions by start time
        sessions.sort()
        
        # Calculate gaps between consecutive sessions
        for i in range(len(sessions) - 1):
            _, end_current, _ = sessions[i]
            start_next, _, _ = sessions[i + 1]
            if start_next > end_current:  # There's a gap
                total_gap += start_next - end_current
    
    return total_gap

# Convert solutions to a format suitable for HTML generation
def prepare_schedules_for_html(optimized_solutions, courses, selected_courses):
    schedules = []
    
    for i, (sol, days_count, gap_time) in enumerate(optimized_solutions):
        schedule = {
            'days_count': days_count,
            'gap_time': gap_time,
            'days': defaultdict(list),
            'courses': {}
        }
        
        # Create course details
        for course in selected_courses:
            class_no = sol[course]
            section = next(sec for sec in courses[course] if sec["UMS Class No."] == class_no)
            
            # Add to courses dictionary
            schedule['courses'][course] = {
                'section': class_no,
                'teacher': section['Teacher']
            }
            
            # Add sessions to days dictionary
            for day, start, end in section["Sessions"]:
                schedule['days'][day].append({
                    'start': minutes_to_time(start),
                    'end': minutes_to_time(end),
                    'course': course,
                    'section': class_no,
                    'teacher': section['Teacher']
                })
        
        # Sort sessions within each day
        for day, sessions in schedule['days'].items():
            schedule['days'][day] = sorted(sessions, key=lambda x: x['start'])
        
        schedules.append(schedule)
    
    return schedules

# Function to generate HTML content
def generate_html(optimized_solutions, schedules):
    total_schedules = len(optimized_solutions)
    
    # Standard time slots for the timetable
    time_slots = []
    start_hour = 8  # 8 AM
    end_hour = 19   # 7 PM
    
    for hour in range(start_hour, end_hour):
        for minute in [0, 30]:
            time_slots.append(f"{hour:02d}:{minute:02d}")
    
    # Colors for different courses
    course_colors = [
        "#FFD700",  # Gold
        "#FF6347",  # Tomato
        "#20B2AA",  # LightSeaGreen
        "#9370DB",  # MediumPurple
        "#3CB371",  # MediumSeaGreen
        "#4682B4",  # SteelBlue
        "#FF69B4",  # HotPink
        "#8B4513",  # SaddleBrown
        "#2F4F4F",  # DarkSlateGray
        "#800080"   # Purple
    ]
    
    # HTML header
    html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Class Schedules</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        .schedule-nav {
            margin: 20px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .schedule-controls {
            display: flex;
            gap: 10px;
        }
        .btn {
            padding: 8px 16px;
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        .btn:hover {
            background-color: #2980b9;
        }
        .btn:disabled {
            background-color: #95a5a6;
            cursor: not-allowed;
        }
        .schedule-indicator {
            font-size: 18px;
            font-weight: bold;
        }
        .timetable {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background-color: white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .timetable th {
            background-color: #34495e;
            color: white;
            padding: 10px;
            text-align: center;
            font-weight: 500;
        }
        .timetable td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: center;
            height: 30px;
            position: relative;
        }
        .time-column {
            width: 80px;
            background-color: #ecf0f1;
            font-weight: bold;
        }
        .course-slot {
            position: absolute;
            left: 0;
            width: 100%;
            box-sizing: border-box;
            border-radius: 4px;
            padding: 5px;
            font-size: 11px;
            line-height: 1.2;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            z-index: 1;
            text-overflow: ellipsis;
        }
        .course-slot:hover {
            transform: scale(1.02);
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            z-index: 2;
            overflow: visible;
            height: auto !important;
            background-color: rgba(0,0,0,0.85) !important;
            color: white;
        }
        .course-slot strong {
            font-size: 12px;
        }
        .course-slot small {
            font-size: 10px;
            opacity: 0.9;
        }
        .course-details {
            margin-top: 20px;
            background-color: white;
            padding: 20px;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .course-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }
        .course-card {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            background-color: #f9f9f9;
        }
        .metrics {
            display: flex;
            gap: 30px;
            margin-bottom: 20px;
            padding: 15px;
            background-color: white;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .metric {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }
        .metric-label {
            font-size: 14px;
            color: #7f8c8d;
        }
        .tooltip {
            display: none;
            position: absolute;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10;
            max-width: 250px;
            pointer-events: none;
        }
        .filter-section {
            margin: 20px 0;
            padding: 15px;
            background-color: white;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .filter-controls {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        .filter-group {
            margin-bottom: 10px;
        }
        .filter-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .filter-group select {
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #ddd;
        }
        @media print {
            .schedule-nav, .btn, .filter-section {
                display: none;
            }
            .schedule-block {
                page-break-after: always;
            }
            .container {
                padding: 0;
                width: 100%;
                max-width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Class Schedules</h1>
        <p>Total valid schedules found: <strong>""" + str(total_schedules) + """</strong></p>
        
        <div class="filter-section">
            <h3>Filter Schedules</h3>
            <div class="filter-controls">
                <div class="filter-group">
                    <label for="max-days">Maximum Days:</label>
                    <select id="max-days">
                        <option value="0">Any</option>
                        <option value="3">3 days</option>
                        <option value="4">4 days</option>
                        <option value="5">5 days</option>
                        <option value="6">6 days</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="max-gap">Maximum Gap Time:</label>
                    <select id="max-gap">
                        <option value="0">Any</option>
                        <option value="60">1 hour</option>
                        <option value="120">2 hours</option>
                        <option value="180">3 hours</option>
                        <option value="300">5 hours</option>
                    </select>
                </div>
                <button id="apply-filter" class="btn">Apply Filters</button>
                <button id="clear-filter" class="btn">Clear Filters</button>
            </div>
        </div>
        
        <div class="schedule-nav">
            <div class="schedule-controls">
                <button id="prev-btn" class="btn" disabled>Previous</button>
                <button id="next-btn" class="btn">Next</button>
                <button id="print-btn" class="btn">Print Current</button>
            </div>
            <div class="schedule-indicator">
                Schedule <span id="current-schedule">1</span> of <span id="total-schedules">""" + str(total_schedules) + """</span>
                <span id="filtered-text" style="display:none"> (Filtered)</span>
            </div>
        </div>
"""
    
    # Generate HTML for each schedule
    for i, schedule in enumerate(schedules):
        display_style = "block" if i == 0 else "none"
        days_count = schedule['days_count']
        gap_time = schedule['gap_time']
        
        html += f"""
        <div id="schedule-{i+1}" class="schedule-block" style="display: {display_style}" 
             data-days="{days_count}" data-gap="{gap_time}">
            <div class="metrics">
                <div class="metric">
                    <div class="metric-value">{days_count}</div>
                    <div class="metric-label">Days</div>
                </div>
                <div class="metric">
                    <div class="metric-value">{gap_time}</div>
                    <div class="metric-label">Gap Minutes</div>
                </div>
                <div class="metric">
                    <div class="metric-value">{gap_time // 60}h {gap_time % 60}m</div>
                    <div class="metric-label">Total Gap Time</div>
                </div>
            </div>
            
            <h2>Timetable View</h2>
            <table class="timetable">
                <thead>
                    <tr>
                        <th class="time-column">Time</th>
"""
        
        # Get the sorted days of the week
        day_order = {'M': 0, 'T': 1, 'W': 2, 'R': 3, 'F': 4, 'S': 5}
        sorted_days = sorted(schedule['days'].keys(), key=lambda x: day_order.get(x, 99))
        
        # Create day headers
        for day in sorted_days:
            display_day = DAY_NAME_MAP.get(day, day)
            html += f"<th>{display_day}</th>\n"
        
        html += """
                    </tr>
                </thead>
                <tbody>
"""
        
        # Create time slots rows
        for time_slot in time_slots:
            html += f"""
                    <tr>
                        <td class="time-column">{time_slot}</td>
"""
            
            # For each day, check if there's a course at this time
            for day in sorted_days:
                html += "<td>"
                
                # Calculate time in minutes for comparison
                slot_minutes = time_to_minutes(time_slot)
                
                # Check if any session starts at or before this time slot and ends after it
                for session in schedule['days'].get(day, []):
                    session_start_minutes = time_to_minutes(session['start'])
                    session_end_minutes = time_to_minutes(session['end'])
                    
                    # Check if this is the starting time slot for this session
                    if abs(session_start_minutes - slot_minutes) <= 15:
                        # Calculate position and height
                        duration_slots = (session_end_minutes - session_start_minutes) / 30
                        height = duration_slots * 50 - 10  # 50px per slot, minus padding
                        
                        # Assign a color based on the course name
                        course_index = list(schedule['courses'].keys()).index(session['course']) % len(course_colors)
                        color = course_colors[course_index]
                        
                        # Create a shortened course name
                        course_words = session['course'].split()
                        shortened_course = " ".join([w for w in course_words if len(w) > 3 or w.isupper()])
                        if len(shortened_course) > 25:
                            shortened_course = shortened_course[:22] + "..."
                        
                        # Get instructor name - ensure showing full last name at minimum
                        instructor = session['teacher']
                        if len(instructor.split()) > 1:
                            instructor_display = instructor.split()[0][:1] + ". " + instructor.split()[-1]
                            if len(instructor_display) > 15:
                                instructor_display = instructor.split()[-1]  # Just last name if too long
                        else:
                            instructor_display = instructor  # Use full name if it's just one word
                        
                        html += f"""
                        <div class="course-slot" style="height: {height}px; background-color: {color};" 
                             title="{session['course']} - Section {session['section']} - {session['teacher']}">
                            <strong>{shortened_course}</strong><br>
                            {session['start']} - {session['end']}<br>
                            <small>Sec: {session['section']}<br>{instructor_display}</small>
                        </div>
                        """
                
                html += "</td>\n"
            
            html += "                    </tr>\n"
        
        html += """
                </tbody>
            </table>
            
            <div class="course-details">
                <h2>Course Details</h2>
                <div class="course-list">
"""
        
        # Add course details
        for course_name, course_info in schedule['courses'].items():
            html += f"""
                    <div class="course-card">
                        <h3>{course_name}</h3>
                        <p><strong>Section:</strong> {course_info['section']}</p>
                        <p><strong>Teacher:</strong> {course_info['teacher']}</p>
                    </div>
"""
        
        html += """
                </div>
            </div>
        </div>
"""
    
    # Add JavaScript for navigation and filtering
    html += """
        <div id="tooltip" class="tooltip"></div>
    </div>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const totalSchedules = """ + str(total_schedules) + """;
            let currentSchedule = 1;
            let visibleSchedules = [];
            let isFiltered = false;
            
            const prevBtn = document.getElementById('prev-btn');
            const nextBtn = document.getElementById('next-btn');
            const printBtn = document.getElementById('print-btn');
            const currentScheduleSpan = document.getElementById('current-schedule');
            const totalSchedulesSpan = document.getElementById('total-schedules');
            const filteredTextSpan = document.getElementById('filtered-text');
            const applyFilterBtn = document.getElementById('apply-filter');
            const clearFilterBtn = document.getElementById('clear-filter');
            const maxDaysSelect = document.getElementById('max-days');
            const maxGapSelect = document.getElementById('max-gap');
            
            // Initialize with all schedules visible
            updateVisibleSchedules();
            
            // Function to show a specific schedule
            function showSchedule(scheduleNum) {
                // Get the actual schedule to show based on visible schedules
                const scheduleId = visibleSchedules[scheduleNum - 1];
                
                // Hide all schedules
                for (let i = 1; i <= totalSchedules; i++) {
                    document.getElementById(`schedule-${i}`).style.display = 'none';
                }
                
                // Show the selected schedule
                document.getElementById(`schedule-${scheduleId}`).style.display = 'block';
                
                // Update the current schedule indicator
                currentScheduleSpan.textContent = scheduleNum;
                totalSchedulesSpan.textContent = visibleSchedules.length;
                
                // Update button states
                prevBtn.disabled = scheduleNum === 1;
                nextBtn.disabled = scheduleNum === visibleSchedules.length;
            }
            
            // Function to update the list of visible schedules based on filters
            function updateVisibleSchedules() {
                const maxDays = parseInt(maxDaysSelect.value);
                const maxGap = parseInt(maxGapSelect.value);
                
                visibleSchedules = [];
                
                for (let i = 1; i <= totalSchedules; i++) {
                    const schedule = document.getElementById(`schedule-${i}`);
                    const days = parseInt(schedule.dataset.days);
                    const gap = parseInt(schedule.dataset.gap);
                    
                    const daysPass = maxDays === 0 || days <= maxDays;
                    const gapPass = maxGap === 0 || gap <= maxGap;
                    
                    if (daysPass && gapPass) {
                        visibleSchedules.push(i);
                    }
                }
                
                // Check if we're filtered
                isFiltered = visibleSchedules.length !== totalSchedules;
                filteredTextSpan.style.display = isFiltered ? 'inline' : 'none';
                
                // Reset to first schedule if necessary
                currentSchedule = 1;
                
                // Update display
                if (visibleSchedules.length > 0) {
                    showSchedule(currentSchedule);
                } else {
                    // No schedules match the filter
                    for (let i = 1; i <= totalSchedules; i++) {
                        document.getElementById(`schedule-${i}`).style.display = 'none';
                    }
                    currentScheduleSpan.textContent = 0;
                    totalSchedulesSpan.textContent = 0;
                    prevBtn.disabled = true;
                    nextBtn.disabled = true;
                }
            }
            
            // Event listeners for navigation buttons
            prevBtn.addEventListener('click', function() {
                if (currentSchedule > 1) {
                    currentSchedule--;
                    showSchedule(currentSchedule);
                }
            });
            
            nextBtn.addEventListener('click', function() {
                if (currentSchedule < visibleSchedules.length) {
                    currentSchedule++;
                    showSchedule(currentSchedule);
                }
            });
            
            printBtn.addEventListener('click', function() {
                window.print();
            });
            
            // Event listeners for filter controls
            applyFilterBtn.addEventListener('click', function() {
                updateVisibleSchedules();
            });
            
            clearFilterBtn.addEventListener('click', function() {
                maxDaysSelect.value = '0';
                maxGapSelect.value = '0';
                updateVisibleSchedules();
            });
            
            // Handle tooltips for course slots
            const courseSlots = document.querySelectorAll('.course-slot');
            const tooltip = document.getElementById('tooltip');
            
            courseSlots.forEach(slot => {
                slot.addEventListener('mouseover', function(e) {
                    tooltip.innerHTML = this.getAttribute('title');
                    tooltip.style.display = 'block';
                    tooltip.style.left = (e.pageX + 10) + 'px';
                    tooltip.style.top = (e.pageY + 10) + 'px';
                });
                
                slot.addEventListener('mousemove', function(e) {
                    tooltip.style.left = (e.pageX + 10) + 'px';
                    tooltip.style.top = (e.pageY + 10) + 'px';
                });
                
                slot.addEventListener('mouseout', function() {
                    tooltip.style.display = 'none';
                });
            });
        });
    </script>
</body>
</html>
"""
    
    return html

# Function to print a readable schedule solution for console output
def print_solution(solution, courses, selected_courses, index, days_count, gap_time):
    print(f"\n=== Schedule {index+1} ===")
    print(f"Days: {days_count} | Total gap time: {gap_time} minutes\n")
    
    # Organize by day for cleaner output
    day_sessions = defaultdict(list)
    for course in selected_courses:
        class_no = solution[course]
        section = next(sec for sec in courses[course] if sec["UMS Class No."] == class_no)
        for day, start, end in section["Sessions"]:
            # For display purposes, keep the day as is
            day_sessions[day].append((start, end, course, class_no, section["Teacher"]))
    
    # Print schedule by day
    for day in sorted(day_sessions.keys()):
        print(f"Day: {day}")
        # Sort sessions by start time
        sessions = sorted(day_sessions[day])
        for start, end, course, class_no, teacher in sessions:
            print(f"  {minutes_to_time(start)} - {minutes_to_time(end)}: {course}")
            print(f"    Section: {class_no} | Teacher: {teacher}")
        print()  # Empty line between days
    
    # Print course details
    print("Course Details:")
    for course in selected_courses:
        class_no = solution[course]
        section = next(sec for sec in courses[course] if sec["UMS Class No."] == class_no)
        print(f"  {course}")
        print(f"    Section: {class_no}")
        print(f"    Teacher: {section['Teacher']}")
        print(f"    Sessions:")
        for day, start, end in sorted(section["Sessions"]):
            print(f"      {day}: {minutes_to_time(start)} - {minutes_to_time(end)}")
        print()  # Empty line between courses

# Main execution function
def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Generate optimized class schedules with HTML visualization")
    parser.add_argument("--csv", required=True, help="Path to CSV file with course data")
    parser.add_argument("--output", default="schedules.html", help="Output HTML file name")
    parser.add_argument("--courses", nargs="+", required=True, help="List of courses to schedule")
    parser.add_argument("--max-schedules", type=int, default=None, help="Maximum number of schedules to generate")
    args = parser.parse_args()
    
    selected_courses = args.courses
    
    print("Schedule Generator")
    print("=================")
    print(f"Input file: {args.csv}")
    print(f"Output file: {args.output}")
    print("\nSelected courses:")
    for course in selected_courses:
        print(f"- {course}")
    
    # Load course data
    # print("\nLoading course data...")
    courses = load_courses(args.csv)
    
    # Check if all selected courses exist in the data
    missing_courses = [c for c in selected_courses if c not in courses]
    if missing_courses:
        print("\nError: The following courses were not found in the data:")
        for course in missing_courses:
            print(f"- {course}")
        return
    
    # Create constraint problem
    # print("Creating constraint satisfaction problem...")
    problem = build_csp(courses, selected_courses)
    
    # Find all valid scheduling solutions
    # print("Finding valid schedules...")
    solutions = problem.getSolutions()
    
    if not solutions:
        print("\nNo valid schedules found. Try selecting different courses.")
        return
    
    # print(f"Found {len(solutions)} valid schedules.")
    
    # Calculate metrics for each solution
    # print("Optimizing schedules...")
    optimized_solutions = []
    for sol in solutions:
        days_count = count_days(sol, courses, selected_courses)
        gap_time = calculate_gaps(sol, courses, selected_courses)
        optimized_solutions.append((sol, days_count, gap_time))
    
    # Sort solutions by days (ascending) and then by gap time (ascending)
    optimized_solutions.sort(key=lambda x: (x[1], x[2]))
    
    # Limit the number of schedules if requested
    if args.max_schedules and args.max_schedules < len(optimized_solutions):
        # print(f"Limiting output to {args.max_schedules} schedules")
        optimized_solutions = optimized_solutions[:args.max_schedules]
    
    # Print top 3 schedules to console
    # print("\nTop 3 optimized schedules:")
    for i in range(min(3, len(optimized_solutions))):
        sol, days_count, gap_time = optimized_solutions[i]
        # print_solution(sol, courses, selected_courses, i, days_count, gap_time)
    
    # Convert to HTML format
    schedules = prepare_schedules_for_html(optimized_solutions, courses, selected_courses)
    
    # Generate HTML
    html_content = generate_html(optimized_solutions, schedules)
    
    # Write HTML to file
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    with open(args.output, "w") as f:
        f.write(html_content)
    
    # print(f"\nHTML schedule view generated at: {args.output}")
    # print(f"Open this file in your web browser to view your optimized schedules.")

    # After writing the HTML file
    # print(f"Opening {args.output} in your default browser...")
    output_path = os.path.abspath(args.output)
    webbrowser.open('file://' + output_path)

if __name__ == "__main__":
    main()