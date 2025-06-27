from flask import Flask, render_template, request, jsonify
import csv
import os
from collections import defaultdict
from datetime import datetime
from constraint import Problem


app = Flask(__name__)


FILENAME = "sp25-ug-cs.csv"


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


# convert time into minutes from midnight
def time_to_minutes(tstr):
    return int(datetime.strptime(tstr, "%H:%M").hour) * 60 + int(datetime.strptime(tstr, "%H:%M").minute)


# convert minutes from midnight into time
def minutes_to_time(minutes):
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


# check if two set of days are having a conflict 
def days_conflict(day1, day2):
    # handle case where both are 1
    if len(day1) == 1 and len(day2) == 1:
        return day1 == day2
    
    # handle case where either is 2
    expanded_day1 = [day1] if len(day1) == 1 else list(day1)
    expanded_day2 = [day2] if len(day2) == 1 else list(day2)
    
    return any(d in expanded_day2 for d in expanded_day1)



def load_courses(csv_filename):
    # A section has Course, UMS Class No, Teacher and Sessions
    # key is the course name and contains list of all sections of that course
    courses = defaultdict(list) 
    all_sections = []  # Store all individual sections
    
    with open(csv_filename) as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            course_name = row["Course"].strip()
            class_no = row["UMS Class No."].strip()
            teacher = row["Teacher"].strip()
            program = row["Program"].strip()
            campus = row["Campus"].strip()
            day = row["Day"].strip()
            start = time_to_minutes(row["Start Time"].strip())
            end = time_to_minutes(row["End Time"].strip())
            
           
            if day in DAY_MAP:
                actual_days = DAY_MAP[day]
            else:
                actual_days = [day]

            # gets the section with the given id if found
            # otherwise gets set to none
            # added to handle labs as they are for the same course but are listed separately
            section = next((s for s in courses[course_name] if s["UMS Class No."] == class_no), None)
            if section is None:
                section = {
                    "UMS Class No.": class_no,
                    "Teacher": teacher, # TODO: course may have a lab instructor
                    "Course": course_name,
                    "Program": program,
                    "Campus": campus,
                    "Sessions": []
                }
                courses[course_name].append(section)    # add this new section
                all_sections.append(section)  
            
            # add the timings and day for the session
            for actual_day in actual_days:
                section["Sessions"].append((actual_day, start, end))
    
    return courses, all_sections


# returns true if there is a conflict between two sections
def sections_conflict(sec1, sec2):
    for d1, s1, e1 in sec1["Sessions"]:
        for d2, s2, e2 in sec2["Sessions"]:
            if days_conflict(d1, d2):
                if s1 < e2 and s2 < e1:
                    return True
    return False


# build the csp based on the selected sections
def build_csp_for_sections(selected_sections):
    problem = Problem()
    
    # Group sections by course name to ensure only one section per course
    # "Course1" : ["98869", "97545", "99765"]
    courses_sections = defaultdict(list)
    for section in selected_sections:
        courses_sections[section["Course"]].append(section["UMS Class No."])
    
    # Add variables for each course with their selected sections as domains
    for course, section_ids in courses_sections.items():
        problem.addVariable(course, section_ids)
    
    # Add constraints to prevent conflicts between sections
    # similar to cartesian product Sessions x Sessions
    course_names = list(courses_sections.keys())
    for i, c1 in enumerate(course_names):
        for j in range(i + 1, len(course_names)):
            c2 = course_names[j]
            
            # magic code
            # somehow add time constraints
            def make_constraint(sections1, sections2):
                def no_overlap(class_no1, class_no2):
                    sec1 = next(sec for sec in sections1 if sec["UMS Class No."] == class_no1)
                    sec2 = next(sec for sec in sections2 if sec["UMS Class No."] == class_no2)
                    return not sections_conflict(sec1, sec2)
                return no_overlap
        

            
            sections1 = [sec for sec in selected_sections if sec["Course"] == c1]
            sections2 = [sec for sec in selected_sections if sec["Course"] == c2]
            
            problem.addConstraint(make_constraint(sections1, sections2), (c1, c2))
    

    return problem


# returns number of days in the schedule
def count_days_from_sections(solution_sections):
    all_days = set()
    for section in solution_sections:
        for day, _, _ in section["Sessions"]:
            all_days.add(day)
    return len(all_days)


# calculate total gap in minutes for a solution
def calculate_gaps_from_sections(solution_sections):
    day_sessions = defaultdict(list)
    for section in solution_sections:
        for day, start, end in section["Sessions"]:
            day_sessions[day].append((start, end))
    
    total_gap = 0
    for day, sessions in day_sessions.items():
        if len(sessions) <= 1:
            continue
        
        sessions.sort()
        for i in range(len(sessions) - 1):
            _, end_current = sessions[i]
            start_next, _ = sessions[i + 1]
            if start_next > end_current:
                total_gap += start_next - end_current
    
    return total_gap


def prepare_schedules_for_web_sections(optimized_solutions):
    schedules = []
    
    for i, (solution_sections, days_count, gap_time) in enumerate(optimized_solutions):
        schedule = {
            'id': i + 1,
            'days_count': days_count,
            'gap_time': gap_time,
            'days': defaultdict(list),
            'courses': {}
        }
        
        for section in solution_sections:
            course_name = section["Course"]
            schedule['courses'][course_name] = {
                'section': section["UMS Class No."],
                'teacher': section['Teacher'],
                'program': section['Program'],
                'campus': section['Campus']
            }
            
            for day, start, end in section["Sessions"]:
                schedule['days'][day].append({
                    'start': minutes_to_time(start),
                    'end': minutes_to_time(end),
                    'course': course_name,
                    'section': section["UMS Class No."],
                    'teacher': section['Teacher'],
                    'program': section['Program'],
                    'campus': section['Campus']
                })
        
        for day, sessions in schedule['days'].items():
            schedule['days'][day] = sorted(sessions, key=lambda x: x['start'])
        
        schedule['days'] = dict(schedule['days'])
        schedules.append(schedule)
    
    return schedules

# Load courses data once at startup
COURSES_DATA, ALL_SECTIONS = load_courses(f'data/{FILENAME}')

@app.route('/')
def index():
    # only sending the section cards at this point
    # Prepare sections with detailed information for display
    sections_for_display = []
    for section in ALL_SECTIONS:
        # Format session times and days
        session_info = []
        for day, start, end in section["Sessions"]:
            day_name = DAY_NAME_MAP.get(day, day)
            start_time = minutes_to_time(start)
            end_time = minutes_to_time(end)
            session_info.append(f"{day_name} {start_time}-{end_time}")
        
        sections_for_display.append({
            'course_name': section["Course"],
            'ums_class_no': section["UMS Class No."],
            'teacher': section["Teacher"],
            'program': section["Program"],
            'campus': section["Campus"],
            'sessions': ", ".join(session_info),
            'section_id': f"{section['Course']}_{section['UMS Class No.']}"
        })
    
    # Sort by course name then by section
    sections_for_display.sort(key=lambda x: (x['course_name'], x['ums_class_no']))
    
    return render_template('index.html', sections=sections_for_display)


@app.route('/generate_schedules', methods=['POST'])
def generate_schedules():
    try:
        data = request.get_json()
        selected_section_ids = data.get('sections', [])
        max_schedules = data.get('max_schedules', 50)
        
        if not selected_section_ids:
            return jsonify({'error': 'No sections selected'}), 400
        
        # Find the actual section objects
        selected_sections = []
        for section_id in selected_section_ids:
            course_name, ums_class_no = section_id.split('_', 1)
            section = next((s for s in ALL_SECTIONS if s["Course"] == course_name and s["UMS Class No."] == ums_class_no), None)
            if section:
                selected_sections.append(section)
        
        if not selected_sections:
            return jsonify({'error': 'Selected sections not found'}), 400
        
        # Check if we have sections from different courses
        course_names = list(set(section["Course"] for section in selected_sections))
        if len(course_names) < 2:
            # If only one course selected, return the sections as individual schedules
            optimized_solutions = []
            for section in selected_sections:
                days_count = count_days_from_sections([section])
                gap_time = calculate_gaps_from_sections([section])
                optimized_solutions.append(([section], days_count, gap_time))
        else:
            # Create CSP and find solutions
            problem = build_csp_for_sections(selected_sections)
            solutions = problem.getSolutions()
            
            if not solutions:
                return jsonify({'error': 'No valid schedules found for the selected sections'}), 400
            
            # Convert solutions to section objects and calculate metrics
            optimized_solutions = []
            for sol in solutions:
                solution_sections = []
                for course, class_no in sol.items():
                    section = next(s for s in selected_sections if s["Course"] == course and s["UMS Class No."] == class_no)
                    solution_sections.append(section)
                
                days_count = count_days_from_sections(solution_sections)
                gap_time = calculate_gaps_from_sections(solution_sections)
                optimized_solutions.append((solution_sections, days_count, gap_time))
        
        # Sort by days then gap time
        optimized_solutions.sort(key=lambda x: (x[1], x[2]))
        
        # Limit schedules
        if max_schedules and max_schedules < len(optimized_solutions):
            optimized_solutions = optimized_solutions[:max_schedules]
        
        # Prepare for web display
        schedules = prepare_schedules_for_web_sections(optimized_solutions)
        
        return jsonify({
            'success': True,
            'total_schedules': len(schedules),
            'schedules': schedules
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
