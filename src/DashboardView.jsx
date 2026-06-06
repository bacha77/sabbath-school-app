import React, { useState, useEffect } from 'react';
import { supabase, isPlaceholder } from './supabaseClient';
import { getClassesForChurch, getSchoolName } from './constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Download } from 'lucide-react';
import LessonWidget from './LessonWidget';

export default function DashboardView({ navigateToClass, currentChurch, onNavigate, currentUser }) {
  const getTodayDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayDate = getTodayDateString();
  const isTeacher = currentUser?.role === 'teacher';

  // Metrics state
  const [stats, setStats] = useState({
    totalStudents: 0,
    classCounts: {},
    todayLogsCount: 0,
    todayPresent: 0,
    todayAbsent: 0,
    todayExcused: 0,
    todayMoneyCollected: 0,
    attendanceRate: 0,
    history: [], // [{ label: 'This Week', present: 0, absent: 0, excused: 0, money: 0 }]
    upcomingBirthdays: [], // [{ name, class_level, birth_date, isToday }]
    atRiskStudents: [],
    forecastedAttendance: 0
  });

  const [allStudents, setAllStudents] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBirthdayReport, setShowBirthdayReport] = useState(false);

  // New teacher form state
  const [newTeacher, setNewTeacher] = useState({ name: '', pin: '', assigned_class: getClassesForChurch(currentChurch)[0] });
  const [addingTeacher, setAddingTeacher] = useState(false);

  const getBirthdaysByMonth = () => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const grouped = Object.fromEntries(months.map(m => [m, []]));
    
    allStudents.forEach(s => {
      if (!s.birthdate) return;
      const [y, m, d] = s.birthdate.split('-');
      const monthIdx = parseInt(m) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        grouped[months[monthIdx]].push({
          name: `${s.first_name} ${s.last_name}`,
          date: `${m}/${d}`,
          class_level: s.class_level,
          day: parseInt(d)
        });
      }
    });
    
    months.forEach(m => {
      grouped[m].sort((a, b) => a.day - b.day);
    });
    
    return grouped;
  };

  const handleExportCSV = () => {
    try {
      // Create CSV headers
      let csvContent = "Date,Class Level,Student Name,Status,Amount Collected ($)\n";
      
      // We will loop through the logs and map them to students
      // Sort logs by date descending
      const sortedLogs = [...allLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
      
      sortedLogs.forEach(log => {
        const student = allStudents.find(s => s.id === log.student_id);
        if (student) {
          const name = `"${student.first_name} ${student.last_name}"`; // Quote to handle commas in names
          const money = (log.money_collected || 0).toFixed(2);
          csvContent += `${log.date},${student.class_level},${name},${log.status},${money}\n`;
        }
      });

      // Create a Blob and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${currentChurch.name.replace(/\s+/g, '_')}_Attendance_Report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export CSV:", err);
      alert("Failed to export data. Please try again.");
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacher.name || !newTeacher.pin) return;
    setAddingTeacher(true);
    try {
      if (isPlaceholder) {
        const existing = JSON.parse(localStorage.getItem('teachers') || '[]');
        const toAdd = { ...newTeacher, church_id: currentChurch.id, id: `local-t-${Date.now()}` };
        localStorage.setItem('teachers', JSON.stringify([...existing, toAdd]));
        setTeachers([...teachers, toAdd]);
      } else {
        const { data, error } = await supabase.from('teachers').insert([{ ...newTeacher, church_id: currentChurch.id }]).select();
        if (error) throw error;
        if (data) setTeachers([...teachers, ...data]);
      }
      setNewTeacher({ name: '', pin: '', assigned_class: getClassesForChurch(currentChurch)[0] });
    } catch (err) {
      alert("Failed to add teacher: " + err.message);
    } finally {
      setAddingTeacher(false);
    }
  };

  const handleDeleteTeacher = async (id) => {
    if (!window.confirm("Are you sure you want to remove this teacher?")) return;
    try {
      if (isPlaceholder) {
        const existing = JSON.parse(localStorage.getItem('teachers') || '[]');
        const updated = existing.filter(t => t.id !== id);
        localStorage.setItem('teachers', JSON.stringify(updated));
        setTeachers(teachers.filter(t => t.id !== id));
      } else {
        const { error } = await supabase.from('teachers').delete().eq('id', id);
        if (error) throw error;
        setTeachers(teachers.filter(t => t.id !== id));
      }
    } catch (err) {
      alert("Failed to delete teacher.");
    }
  };

  useEffect(() => {
    fetchStats();
  }, [currentChurch]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      let studentsData = [];
      let logsData = [];
      let colData = [];
      let allLogsData = [];
      let allColData = [];

      // Calculate the date 21 days ago
      const d21 = new Date();
      d21.setDate(d21.getDate() - 21);
      const past21Date = `${d21.getFullYear()}-${String(d21.getMonth() + 1).padStart(2, '0')}-${String(d21.getDate()).padStart(2, '0')}`;

      if (isPlaceholder) {
        // --- Local Storage Fallback Mode ---
        studentsData = JSON.parse(localStorage.getItem('students') || '[]').filter(s => s.church_id === currentChurch.id);
        const allLogsLocal = JSON.parse(localStorage.getItem('attendance_logs') || '[]').filter(l => l.church_id === currentChurch.id);
        logsData = allLogsLocal.filter(log => log.date === todayDate);
        allLogsData = allLogsLocal.filter(log => log.date >= past21Date);

        const allCols = JSON.parse(localStorage.getItem('collections') || '[]').filter(c => c.church_id === currentChurch.id);
        colData = allCols.filter(col => col.date === todayDate);
        allColData = allCols.filter(col => col.date >= past21Date);

        const allTeachers = JSON.parse(localStorage.getItem('teachers') || '[]').filter(t => t.church_id === currentChurch.id);
        setTeachers(allTeachers);
      } else {
        // --- Supabase Live Connection Mode ---
        const [studentsRes, logsRes, colRes] = await Promise.all([
          supabase.from('students').select('*').eq('church_id', currentChurch.id),
          supabase.from('attendance_logs').select('*').eq('church_id', currentChurch.id).gte('date', past21Date),
          supabase.from('collections').select('*').eq('church_id', currentChurch.id).gte('date', past21Date)
        ]);

        if (studentsRes.error) throw studentsRes.error;
        if (logsRes.error) throw logsRes.error;
        if (colRes.error) throw colRes.error;

        studentsData = studentsRes.data || [];
        allLogsData = logsRes.data || [];
        allColData = colRes.data || [];
        
        logsData = allLogsData.filter(log => log.date === todayDate);
        colData = allColData.filter(col => col.date === todayDate);

        const { data: teacherData, error: teacherError } = await supabase
          .from('teachers')
          .select('*')
          .eq('church_id', currentChurch.id);
        if (!teacherError) setTeachers(teacherData || []);
      }

      if (currentUser?.role === 'teacher') {
        const teacherClass = currentUser.assigned_class;
        studentsData = studentsData.filter(s => s.class_level === teacherClass);
        const studentIds = studentsData.map(s => s.id);
        allLogsData = allLogsData.filter(log => studentIds.includes(log.student_id));
        logsData = logsData.filter(log => studentIds.includes(log.student_id));
        allColData = allColData.filter(col => col.class_name === teacherClass);
        colData = colData.filter(col => col.class_name === teacherClass);
      }
      
      setAllStudents(studentsData);
      setAllLogs(allLogsData);

      // Calculate Student stats
      const totalStudents = studentsData.length;
      // Build classCounts dynamically from getClassesForChurch
      const dynamicClasses = getClassesForChurch(currentChurch);
      const classCounts = Object.fromEntries(dynamicClasses.map(c => [c, 0]));
      studentsData.forEach(s => {
        if (classCounts[s.class_level] !== undefined) {
          classCounts[s.class_level]++;
        }
      });

      // Calculate Attendance stats for today
      const todayLogsCount = logsData.length;
      let todayPresent = 0;
      let todayAbsent = 0;
      let todayExcused = 0;

      logsData.forEach(log => {
        if (log.status === 'Present' || log.status === 'Present+Study') todayPresent++;
        else if (log.status === 'Absent') todayAbsent++;
        if (log.status === 'Present+Study') todayExcused++; // todayExcused = 7 Days Study count
      });

      // Attendance Rate: count Present and 7 Days Study as attending
      const attendanceRate = todayLogsCount > 0 
        ? Math.round(((todayPresent + todayExcused) / todayLogsCount) * 100) 
        : 0;

      // Calculate Total Money Collected for today
      let todayMoneyCollected = 0;
      colData.forEach(col => {
        todayMoneyCollected += parseFloat(col.amount_collected) || 0;
      });

      // Build History Grouping (Last 3 weeks)
      // week 0 = last 7 days (including today)
      // week 1 = 8 to 14 days ago
      // week 2 = 15 to 21 days ago
      const history = [
        { label: 'This Week', present: 0, absent: 0, excused: 0, money: 0 },
        { label: 'Last Week', present: 0, absent: 0, excused: 0, money: 0 },
        { label: '2 Weeks Ago', present: 0, absent: 0, excused: 0, money: 0 }
      ];

      const getDaysAgo = (dateStr) => {
        const diffTime = Math.abs(new Date(todayDate) - new Date(dateStr));
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
      };

      allLogsData.forEach(log => {
        const daysAgo = getDaysAgo(log.date);
        let wIdx = -1;
        if (daysAgo <= 6) wIdx = 0;
        else if (daysAgo <= 13) wIdx = 1;
        else if (daysAgo <= 20) wIdx = 2;

        if (wIdx > -1) {
          if (log.status === 'Present' || log.status === 'Present+Study') history[wIdx].present++;
          else if (log.status === 'Absent') history[wIdx].absent++;
          if (log.status === 'Present+Study') history[wIdx].excused++;
        }
      });

      allColData.forEach(col => {
        const daysAgo = getDaysAgo(col.date);
        let wIdx = -1;
        if (daysAgo <= 6) wIdx = 0;
        else if (daysAgo <= 13) wIdx = 1;
        else if (daysAgo <= 20) wIdx = 2;

        if (wIdx > -1) {
          history[wIdx].money += parseFloat(col.amount_collected) || 0;
        }
      });

      // Calculate Upcoming Birthdays
      const upcomingBirthdays = [];
      const today = new Date();
      
      studentsData.forEach(student => {
        if (!student.birthdate) return;
        
        // Parse "YYYY-MM-DD"
        const [y, m, d] = student.birthdate.split('-');
        if (!m || !d) return;
        
        // Set birthday to current year to calculate difference
        const bdayThisYear = new Date(today.getFullYear(), parseInt(m) - 1, parseInt(d));
        
        // If birthday already passed this year, look at next year
        if (bdayThisYear < today && (today - bdayThisYear) > (7 * 24 * 60 * 60 * 1000)) {
          bdayThisYear.setFullYear(today.getFullYear() + 1);
        }
        
        const diffDays = Math.round((bdayThisYear - today) / (1000 * 60 * 60 * 24));
        
        // Check if within the next 7 days (or passed in the last 2 days)
        if (diffDays >= -2 && diffDays <= 7) {
          upcomingBirthdays.push({
            name: `${student.first_name} ${student.last_name}`,
            class_level: student.class_level,
            birth_date: `${m}/${d}`,
            isToday: diffDays === 0
          });
        }
      });
      
      // Sort upcoming birthdays
      upcomingBirthdays.sort((a, b) => {
        if (a.isToday) return -1;
        if (b.isToday) return 1;
        return a.birth_date.localeCompare(b.birth_date);
      });

      // Phase 6: Calculate At-Risk Students
      const atRiskStudents = [];
      studentsData.forEach(student => {
        // Get logs for this student, sorted by date descending
        const studentLogs = allLogsData
          .filter(log => log.student_id === student.id)
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Check if the last 3 logs are 'Absent'
        if (studentLogs.length >= 3) {
          const last3 = studentLogs.slice(0, 3);
          const allAbsent = last3.every(log => log.status === 'Absent');
          if (allAbsent) {
            atRiskStudents.push(student);
          }
        }
      });

      // Phase 6: Calculate Forecasted Attendance
      const totalHistoryPresent = history.reduce((sum, w) => sum + w.present + w.excused, 0);
      const forecastedAttendance = Math.round(totalHistoryPresent / 3);

      setStats({
        totalStudents,
        classCounts,
        todayLogsCount,
        todayPresent,
        todayAbsent,
        todayExcused,
        todayMoneyCollected,
        attendanceRate,
        history,
        upcomingBirthdays,
        atRiskStudents,
        forecastedAttendance
      });

    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const setView = (viewId) => {
    if (onNavigate) {
      onNavigate(viewId);
    }
  };

  const chartData = [...stats.history].reverse();

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased">
      <div className="mx-auto max-w-5xl">
        
        {/* Dashboard Title & Connection Status */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8 border-b border-slate-200 pb-5">
          <div className="flex justify-between items-center w-full sm:w-auto">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Dashboard Overview
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Real-time summary of roster counts and attendance rates.
              </p>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button 
              onClick={handleExportCSV}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition-colors print:hidden"
            >
              <Download className="w-5 h-5" />
              Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm font-medium text-slate-500">
            <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Analyzing class statistics...
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* 5 Metric Card Grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
              
              {/* Total Registered Card */}
              <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Total Registered
                    </p>
                    <h3 className="text-4xl font-extrabold text-slate-800 mt-2">
                      {stats.totalStudents}
                    </h3>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-4">
                  Students enrolled across all classes.
                </p>
              </div>

              {/* Today's Attendance Rate Card */}
              <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Attendance Rate (Today)
                    </p>
                    <h3 className="text-4xl font-extrabold text-slate-800 mt-2">
                      {stats.todayLogsCount > 0 ? `${stats.attendanceRate}%` : 'N/A'}
                    </h3>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                
                {/* Progress bar */}
                {stats.todayLogsCount > 0 ? (
                  <div className="mt-4">
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${stats.attendanceRate}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      {stats.todayPresent + stats.todayExcused} / {stats.todayLogsCount} students present/7-day-study today.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-5">
                    No attendance records logged for today.
                  </p>
                )}
              </div>

              {/* Status Breakdown Card */}
              <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Today's Activity
                    </p>
                    <h3 className="text-4xl font-extrabold text-slate-800 mt-2">
                      {stats.todayLogsCount} <span className="text-sm font-medium text-slate-400">marked</span>
                    </h3>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                {stats.todayLogsCount > 0 ? (
                  <div className="grid grid-cols-3 gap-2 text-center mt-4">
                    <div className="bg-emerald-50 rounded-lg p-1.5">
                      <span className="block text-xs font-bold text-emerald-800">{stats.todayPresent}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold uppercase">Pres</span>
                    </div>
                    <div className="bg-rose-50 rounded-lg p-1.5">
                      <span className="block text-xs font-bold text-rose-800">{stats.todayAbsent}</span>
                      <span className="text-[10px] text-rose-600 font-semibold uppercase">Abs</span>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-1.5">
                      <span className="block text-xs font-bold text-amber-800">{stats.todayExcused}</span>
                       <span className="text-[10px] text-amber-600 font-semibold uppercase">7DS</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-5">
                    Rosters have not been submitted for today.
                  </p>
                )}
              </div>

              {/* Sabbath Money Card */}
              <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Money Collected (Today)
                    </p>
                    <h3 className="text-4xl font-extrabold text-slate-800 mt-2 flex items-center">
                      <span className="text-2xl text-emerald-500 font-bold mr-1">$</span>
                      {stats.todayMoneyCollected.toFixed(2)}
                    </h3>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-4">
                  Total Sabbath money collected across all classes today.
                </p>
              </div>

              {/* AI Forecast Card */}
              <div className="glass-panel p-6 rounded-3xl relative overflow-hidden bg-gradient-to-br from-indigo-50 to-white border border-indigo-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      AI Forecast
                    </p>
                    <h3 className="text-4xl font-extrabold text-slate-800 mt-2">
                      ~{stats.forecastedAttendance}
                    </h3>
                  </div>
                  <div className="p-3 bg-indigo-100/50 rounded-xl text-indigo-600">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-4">
                  Predicted attendance for next week based on historical moving average.
                </p>
              </div>

            </div>

            {/* Roster Distribution & Quick Links Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-5">
              
              {!isTeacher ? (
                /* Class roster distribution bar chart card */
                <div className="glass-panel p-6 rounded-3xl sm:col-span-3">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6">
                    Class Enrollment Distribution
                  </h3>
                  
                  <div className="space-y-5">
                    {getClassesForChurch(currentChurch).map(className => {
                      const count = stats.classCounts[className] || 0;
                      const pct = stats.totalStudents > 0 ? Math.round((count / stats.totalStudents) * 100) : 0;
                      
                      return (
                        <div key={className} className="group cursor-pointer" onClick={() => navigateToClass && navigateToClass(className)}>
                          <div className="flex justify-between items-center text-sm font-semibold text-slate-700 mb-1.5">
                            <span className="group-hover:text-indigo-600 transition-colors">{className}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">{count} students ({pct}%)</span>
                              <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold">Go →</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500 group-hover:bg-indigo-500" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Teacher Mode: Show class birthdays this week directly at the top */
                <div className="glass-panel p-6 rounded-3xl sm:col-span-3">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      🎂 Class Birthdays This Week
                    </h3>
                    <button 
                      onClick={() => setShowBirthdayReport(true)}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                    >
                      📊 Birthday Report
                    </button>
                  </div>
                  {stats.upcomingBirthdays && stats.upcomingBirthdays.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {stats.upcomingBirthdays.map((bday, idx) => (
                        <div key={idx} className={`p-4 rounded-2xl border ${bday.isToday ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-white/60 border-slate-200'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-slate-800 text-xs">{bday.name}</span>
                            {bday.isToday && (
                              <span className="bg-amber-100 text-amber-800 text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                Today!
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                            <span>{bday.class_level}</span>
                            <span className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-md">{bday.birth_date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-100 text-xs">
                      No birthdays coming up in the next 7 days.
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions Card */}
              <div className="glass-panel p-6 rounded-3xl sm:col-span-2 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
                    Quick Navigation
                  </h3>
                  <p className="text-xs text-slate-400">
                    Quickly toggle view elements to edit records or check class log entries.
                  </p>
                </div>
                
                <div className="space-y-3 mt-6">
                  {!isTeacher && (
                    <>
                      <button
                        onClick={() => setView('classes')}
                        className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-violet-50 rounded-lg text-violet-600">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <span className="block text-xs font-bold text-slate-800">Manage Classes</span>
                            <span className="text-[10px] text-slate-400">Rosters, teachers & reports</span>
                          </div>
                        </div>
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setView('register')}
                        className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <span className="block text-xs font-bold text-slate-800">Register Student</span>
                            <span className="text-[10px] text-slate-400">Add new placements</span>
                          </div>
                        </div>
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setView('attendance')}
                    className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <span className="block text-xs font-bold text-slate-800">Take Attendance</span>
                        <span className="text-[10px] text-slate-400">Log presence lists</span>
                      </div>
                    </div>
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

            </div>

            {/* Visual Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              <div className="glass-panel p-6 rounded-3xl">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6">Attendance Trends</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" />
                      <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="absent" name="Absent" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="glass-panel p-6 rounded-3xl">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6">Financial Trends</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                      <Tooltip cursor={{fill: 'transparent'}} formatter={(value) => `$${value}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" />
                      <Bar dataKey="money" name="Amount Collected" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* At-Risk Students Widget (Attention Needed) */}
            {stats.atRiskStudents && stats.atRiskStudents.length > 0 && (
              <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden mt-8 border border-rose-200 bg-rose-50/30">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-extrabold text-rose-800 flex items-center gap-2">
                    <span className="text-2xl">⚠️</span>
                    Attention Needed
                  </h2>
                  <span className="inline-flex items-center bg-rose-100 text-rose-700 text-xs font-bold px-3 py-1 rounded-full">
                    {stats.atRiskStudents.length} Students At Risk
                  </span>
                </div>
                <p className="text-sm text-rose-600 mb-4 font-medium">
                  The following students have been absent for 3 consecutive weeks. Consider reaching out to check on them.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {stats.atRiskStudents.map((student, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-white border border-rose-100 shadow-sm flex justify-between items-center group cursor-pointer" onClick={() => navigateToClass && navigateToClass(student.class_level)}>
                      <div>
                        <span className="block font-bold text-slate-800">{student.first_name} {student.last_name}</span>
                        <span className="text-xs text-slate-500">{student.class_level}</span>
                      </div>
                      <div className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Birthdays Widget (Only for admins, teachers see it at the top) */}
            {!isTeacher && (
              <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden mt-8 print:hidden">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                    <span className="text-2xl">🎂</span>
                    Upcoming Birthdays This Week
                  </h2>
                  <button 
                    onClick={() => setShowBirthdayReport(true)}
                    className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    📊 Birthday Calendar Report
                  </button>
                </div>
                {stats.upcomingBirthdays && stats.upcomingBirthdays.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {stats.upcomingBirthdays.map((bday, idx) => (
                      <div key={idx} className={`p-4 rounded-2xl border ${bday.isToday ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-white/60 border-slate-200'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-slate-800">{bday.name}</span>
                          {bday.isToday && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full animate-pulse">
                              Today!
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                          <span>{bday.class_level}</span>
                          <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">{bday.birth_date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p>No birthdays coming up in the next 7 days.</p>
                  </div>
                )}
              </div>
            )}

            {/* Historical 3-Week Visual Trend Chart */}
            <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden mt-8">
              <h2 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
                <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                3-Week Trend Report
              </h2>
              
              {/* Bar Chart Container */}
              <div className="h-[300px] w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.history ? [...stats.history].reverse() : []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} />
                    <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `$${val}`} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 600, color: '#475569'}} />
                    <Bar yAxisId="left" dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="excused" name="7 Days Study" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="absent" name="Absent" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="money" name="Money Collected ($)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Data Table Fallback / Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-200/50">
                {stats.history && stats.history.map((week, idx) => (
                  <div key={idx} className="bg-white/60 border border-white/20 rounded-2xl p-4 shadow-sm text-sm">
                    <span className="block font-bold text-slate-500 uppercase tracking-wider mb-2">{week.label}</span>
                    <div className="flex justify-between items-center"><span className="text-slate-600">Total Attendance:</span><span className="font-bold text-slate-800">{week.present + week.excused}</span></div>
                    <div className="flex justify-between items-center mt-1"><span className="text-slate-600">Total Money:</span><span className="font-bold text-emerald-600">${week.money.toFixed(2)}</span></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Smart Sabbath School Widget */}
            <LessonWidget currentChurch={currentChurch} />

          </div>
        )}

        {/* Teacher Management Section (Only for admins) */}
        {!isTeacher && (
          <div className="bg-white p-6 shadow-sm border border-slate-200 rounded-2xl print:hidden mt-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Teacher Management</h2>
            <p className="text-sm text-slate-500 mb-6">Create restricted Teacher PINs so teachers can only take attendance for their assigned class.</p>
            
            <form onSubmit={handleAddTeacher} className="flex flex-wrap gap-4 items-end mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Teacher Name</label>
                <input type="text" required value={newTeacher.name} onChange={e => setNewTeacher({...newTeacher, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="John Doe" />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Assigned Class</label>
                <select value={newTeacher.assigned_class} onChange={e => setNewTeacher({...newTeacher, assigned_class: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  {getClassesForChurch(currentChurch).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Teacher PIN</label>
                <input type="text" required value={newTeacher.pin} onChange={e => setNewTeacher({...newTeacher, pin: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="e.g. 1234" />
              </div>
              <button type="submit" disabled={addingTeacher} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm disabled:opacity-50 text-sm cursor-pointer">
                {addingTeacher ? 'Adding...' : 'Add Teacher'}
              </button>
            </form>

            {teachers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-xs">
                      <th className="pb-3 px-4 font-semibold">Name</th>
                      <th className="pb-3 px-4 font-semibold">Class</th>
                      <th className="pb-3 px-4 font-semibold">PIN</th>
                      <th className="pb-3 px-4 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teachers.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-800">{t.name}</td>
                        <td className="py-3 px-4 text-indigo-600 font-semibold">{t.assigned_class}</td>
                        <td className="py-3 px-4 font-mono text-slate-500 tracking-widest">{t.pin}</td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => handleDeleteTeacher(t.id)} className="text-rose-500 hover:text-rose-700 font-semibold text-xs bg-rose-50 px-2 py-1 rounded cursor-pointer">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-sm italic border-2 border-dashed border-slate-100 rounded-xl">
                No teachers added yet. All users currently log in with the Admin PIN.
              </div>
            )}
          </div>
        )}

        {/* Birthday Report Modal */}
        {showBirthdayReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static print:z-0">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-full print:shadow-none print:rounded-none">
              
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center print:hidden">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800">🎉 Birthday Calendar Report</h3>
                  <p className="text-xs text-slate-400">All registered students sorted by birth month</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.print()} 
                    className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    🖨️ Print Report
                  </button>
                  <button 
                    onClick={() => setShowBirthdayReport(false)} 
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* Print Header */}
              <div className="hidden print:block text-center mb-8">
                <h1 className="text-3xl font-extrabold tracking-tight uppercase text-slate-900">{currentChurch.name}</h1>
                <p className="text-sm font-semibold text-slate-500 mt-1">Sabbath School Birthday Calendar Report</p>
                {isTeacher && (
                  <p className="text-xs text-slate-400 mt-0.5">Class: {currentUser.assigned_class} | Teacher: {currentUser.name}</p>
                )}
                <hr className="mt-4 border-slate-200" />
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 print:overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
                  {Object.entries(getBirthdaysByMonth()).map(([month, bdays]) => (
                    <div key={month} className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-4 print:bg-white print:border-slate-100">
                      <h4 className="font-extrabold text-indigo-700 border-b border-indigo-100 pb-1.5 mb-3 text-sm tracking-tight uppercase flex justify-between items-center">
                        <span>{month}</span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">{bdays.length}</span>
                      </h4>
                      {bdays.length === 0 ? (
                        <p className="text-xs text-slate-300 italic py-2">No birthdays this month</p>
                      ) : (
                        <ul className="space-y-2">
                          {bdays.map((b, idx) => (
                            <li key={idx} className="flex justify-between items-center text-xs">
                              <div>
                                <span className="font-bold text-slate-800">{b.name}</span>
                                {!isTeacher && (
                                  <span className="block text-[10px] text-slate-400 mt-0.5">{b.class_level}</span>
                                )}
                              </div>
                              <span className="font-mono bg-white border border-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-500 font-semibold">{b.date}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 print:hidden">
                <button 
                  type="button" 
                  onClick={() => setShowBirthdayReport(false)} 
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
