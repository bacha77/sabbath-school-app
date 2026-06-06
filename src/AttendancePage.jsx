import React, { useState, useEffect } from 'react';
import { supabase, isPlaceholder } from './supabaseClient';
import { getClassesForChurch } from './constants';
import LessonWidget from './LessonWidget';


// Helpers for the two-tier attendance logic
// Valid stored values: 'Present' | 'Present+Study' | 'Absent'
const isPresent = v => v === 'Present' || v === 'Present+Study';
const hasStudy  = v => v === 'Present+Study';

export default function AttendancePage({ currentChurch, currentUser }) {
  const getTodayDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Filters State
  const dynamicClasses = getClassesForChurch(currentChurch);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [selectedClass, setSelectedClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // History State
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'history'
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Data State
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { [student_id]: 'Present' | 'Present+Study' | 'Absent' }
  const [collectionAmount, setCollectionAmount] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  // Add Student Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({ first_name: '', last_name: '', gender: 'Male', phone: '', email: '', address: '' });
  const [addingStudent, setAddingStudent] = useState(false);

  // Load class on mount based on role
  useEffect(() => {
    if (currentUser?.role === 'teacher' && currentUser.assigned_class) {
      setSelectedClass(currentUser.assigned_class);
    } else {
      setSelectedClass(getClassesForChurch(currentChurch)[0]);
    }
  }, [currentChurch, currentUser]);

  // Load students and their attendance logs
  useEffect(() => {
    if (selectedClass) fetchData();
  }, [selectedDate, selectedClass]);

  const fetchData = async () => {
    setLoading(true);
    setStatus({ type: 'idle', message: '' });

    try {
      let studentsData = [];
      let logsData = [];

      if (isPlaceholder) {
        // --- Local Storage Demo Mode ---
        // Fetch Students
        const allStudents = JSON.parse(localStorage.getItem('students') || '[]');
        studentsData = allStudents.filter(s => s.class_level === selectedClass && s.church_id === currentChurch.id);

        // Fetch Attendance Logs
        const allLogs = JSON.parse(localStorage.getItem('attendance_logs') || '[]');
        logsData = allLogs.filter(log => log.date === selectedDate && log.church_id === currentChurch.id);

        // Fetch Collection
        const allCollections = JSON.parse(localStorage.getItem('collections') || '[]');
        const classCollection = allCollections.find(c => c.date === selectedDate && c.class_name === selectedClass && c.church_id === currentChurch.id);
        setCollectionAmount(classCollection ? classCollection.amount_collected : '');
        setGuestCount(classCollection && classCollection.guest_count ? classCollection.guest_count : '');
      } else {
        // --- Supabase Mode ---
        // Fetch Students
        const { data: studentsResponse, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('church_id', currentChurch.id)
          .eq('class_level', selectedClass)
          .order('first_name', { ascending: true });

        if (studentsError) throw studentsError;
        studentsData = studentsResponse;

        // Fetch Attendance Logs
        const { data: logsResponse, error: logsError } = await supabase
          .from('attendance_logs')
          .select('*')
          .eq('church_id', currentChurch.id)
          .eq('date', selectedDate);

        if (logsError) throw logsError;
        logsData = logsResponse;

        // Fetch Collection
        const { data: colResponse, error: colError } = await supabase
          .from('collections')
          .select('amount_collected, guest_count')
          .eq('church_id', currentChurch.id)
          .eq('date', selectedDate)
          .eq('class_name', selectedClass)
          .maybeSingle();
        
        if (colError) throw colError;
        setCollectionAmount(colResponse ? colResponse.amount_collected : '');
        setGuestCount(colResponse && colResponse.guest_count ? colResponse.guest_count : '');
      }

      setStudents(studentsData);

      // Prepopulate attendance state
      // Map loaded logs into student_id -> status dictionary
      const attendanceMapping = {};
      
      // Default each student to 'Present' if there are no existing logs
      studentsData.forEach(student => {
        const existingLog = logsData.find(log => log.student_id === student.id);
        attendanceMapping[student.id] = existingLog ? existingLog.status : 'Present';
      });

      setAttendance(attendanceMapping);

    } catch (err) {
      console.error(err);
      setStatus({
        type: 'error',
        message: err.message || 'An error occurred while fetching database records.'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryData = async () => {
    setLoadingHistory(true);
    try {
      if (isPlaceholder) {
        const allCols = JSON.parse(localStorage.getItem('collections') || '[]');
        const allLogs = JSON.parse(localStorage.getItem('attendance_logs') || '[]');
        const allStudents = JSON.parse(localStorage.getItem('students') || '[]');
        
        let cols = allCols.filter(c => c.church_id === currentChurch.id).sort((a, b) => new Date(b.date) - new Date(a.date));
        cols = cols.map(c => {
          const matchingLogs = allLogs.filter(l => l.church_id === currentChurch.id && l.date === c.date && allStudents.find(s => s.id === l.student_id)?.class_level === c.class_name);
          return {
             ...c,
             present_count: matchingLogs.filter(l => l.status === 'Present' || l.status === 'Present+Study').length,
             absent_count: matchingLogs.filter(l => l.status === 'Absent').length
          };
        });
        setHistoryData(cols);
      } else {
        const { data: cols, error: colError } = await supabase
          .from('collections')
          .select('*')
          .eq('church_id', currentChurch.id)
          .order('date', { ascending: false });
        if (colError) throw colError;

        const { data: logs, error: logsError } = await supabase
          .from('attendance_logs')
          .select(`
            date,
            status,
            students!inner(class_level)
          `)
          .eq('church_id', currentChurch.id);
        
        if (logsError) throw logsError;

        const enriched = (cols || []).map(c => {
           const classLogs = (logs || []).filter(l => l.date === c.date && l.students?.class_level === c.class_name);
           return {
             ...c,
             present_count: classLogs.filter(l => l.status === 'Present' || l.status === 'Present+Study').length,
             absent_count: classLogs.filter(l => l.status === 'Absent').length
           };
        });
        setHistoryData(enriched);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'history') {
      fetchHistoryData();
    }
  }, [viewMode, currentChurch]);

  const handleDeleteHistory = async (recordDate, recordClass) => {
    if (!window.confirm(`Are you sure you want to permanently delete all attendance and collection records for ${recordClass} on ${recordDate}?`)) return;
    try {
      if (isPlaceholder) {
        let allCols = JSON.parse(localStorage.getItem('collections') || '[]');
        allCols = allCols.filter(c => !(c.date === recordDate && c.class_name === recordClass && c.church_id === currentChurch.id));
        localStorage.setItem('collections', JSON.stringify(allCols));
        fetchHistoryData();
      } else {
        await supabase.from('collections').delete().eq('church_id', currentChurch.id).eq('date', recordDate).eq('class_name', recordClass);
        const { data: classStudents } = await supabase.from('students').select('id').eq('church_id', currentChurch.id).eq('class_level', recordClass);
        if (classStudents && classStudents.length > 0) {
          const studentIds = classStudents.map(s => s.id);
          await supabase.from('attendance_logs').delete().eq('church_id', currentChurch.id).eq('date', recordDate).in('student_id', studentIds);
        }
        fetchHistoryData();
      }
    } catch (err) {
      alert("Failed to delete records.");
    }
  };

  const handleEditHistory = (recordDate, recordClass) => {
    setSelectedDate(recordDate);
    setSelectedClass(recordClass);
    setViewMode('daily');
  };

  // Toggle single student attendance status
  const handleStatusChange = (studentId, statusValue) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: statusValue
    }));
  };

  // Bulk action: set status for all currently listed students
  const handleMarkAll = (statusValue) => {
    const updated = { ...attendance };
    filteredStudents.forEach(student => {
      updated[student.id] = statusValue;
    });
    setAttendance(updated);
  };

  // Save changes to database / localStorage
  const handleSaveAttendance = async () => {
    setSaving(true);
    setStatus({ type: 'idle', message: '' });

    try {
      const logsPayload = Object.keys(attendance).map(studentId => ({
        church_id: currentChurch.id,
        student_id: studentId,
        date: selectedDate,
        status: attendance[studentId]
      }));

      if (logsPayload.length === 0) {
        setStatus({ type: 'success', message: 'No records to save.' });
        setSaving(false);
        return;
      }

      if (isPlaceholder) {
        // --- Local Storage Demo Mode ---
        await new Promise((resolve) => setTimeout(resolve, 800)); // Latency Simulation
        
        let allLogs = JSON.parse(localStorage.getItem('attendance_logs') || '[]');
        
        // Remove existing logs for these students on this specific date (to prevent constraint duplicates)
        allLogs = allLogs.filter(log => !(log.date === selectedDate && Object.keys(attendance).includes(log.student_id)));
        
        // Append new logs
        const timestamp = new Date().toISOString();
        const logsWithMetadata = logsPayload.map((log, index) => ({
          id: `local-log-${Date.now()}-${index}`,
          ...log,
          marked_at: timestamp
        }));

        allLogs.push(...logsWithMetadata);
        localStorage.setItem('attendance_logs', JSON.stringify(allLogs));

        // Save Collection
        if (collectionAmount !== '') {
          let allCol = JSON.parse(localStorage.getItem('collections') || '[]');
          allCol = allCol.filter(c => !(c.date === selectedDate && c.class_name === selectedClass));
          allCol.push({
            id: `local-col-${Date.now()}`,
            church_id: currentChurch.id,
            class_name: selectedClass,
            date: selectedDate,
            amount_collected: parseFloat(collectionAmount) || 0,
            guest_count: parseInt(guestCount) || 0,
            created_at: timestamp
          });
          localStorage.setItem('collections', JSON.stringify(allCol));
        }

        setStatus({ type: 'success', message: 'Attendance & money records updated successfully (Saved in Local Storage)!' });
      } else {
        // --- Supabase Mode ---
        // In Supabase, we perform an upsert on unique constraint (student_id, date)
        if (logsPayload.length > 0) {
          const { error } = await supabase
            .from('attendance_logs')
            .upsert(logsPayload, { onConflict: 'church_id,student_id,date' });
          if (error) throw error;
        }

        // Save Collection
        if (collectionAmount !== '' || guestCount !== '') {
          const { error: colErr } = await supabase
            .from('collections')
            .upsert([{
              church_id: currentChurch.id,
              class_name: selectedClass,
              date: selectedDate,
              amount_collected: parseFloat(collectionAmount) || 0,
              guest_count: parseInt(guestCount) || 0
            }], { onConflict: 'church_id,class_name,date' });
          if (colErr) throw colErr;
        }

        setStatus({ type: 'success', message: 'Attendance & money logs synchronized with database!' });
      }
    } catch (err) {
      console.error(err);
      setStatus({
        type: 'error',
        message: err.message || 'An error occurred while saving the attendance list.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setAddingStudent(true);
    try {
      if (isPlaceholder) {
        let allStudents = JSON.parse(localStorage.getItem('students') || '[]');
        const added = {
          id: `local-stu-${Date.now()}`,
          church_id: currentChurch.id,
          class_level: selectedClass,
          ...newStudent,
          created_at: new Date().toISOString()
        };
        allStudents.push(added);
        localStorage.setItem('students', JSON.stringify(allStudents));
      } else {
        const { error } = await supabase.from('students').insert([{
          church_id: currentChurch.id,
          class_level: selectedClass,
          ...newStudent
        }]);
        if (error) throw error;
      }
      setShowAddModal(false);
      setNewStudent({ first_name: '', last_name: '', gender: 'Male', phone: '', email: '', address: '' });
      fetchData(); // reload students list
    } catch (err) {
      alert("Failed to add student: " + err.message);
    } finally {
      setAddingStudent(false);
    }
  };

  const exportToCSV = () => {
    if (historyData.length === 0) {
      alert("No records to export.");
      return;
    }
    const headers = ['Date', 'Class', 'Present Count', 'Absent Count', 'Amount Collected ($)', 'Guest Count'];
    const rows = historyData.map(record => [
      record.date,
      `"${record.class_name}"`,
      record.present_count || 0,
      record.absent_count || 0,
      (record.amount_collected || 0).toFixed(2),
      record.guest_count || 0
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Sabbath_School_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter students based on search query
  const filteredStudents = students.filter(student => {
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased pb-32">
      <div className="mx-auto max-w-4xl">
        
        {/* Smart Widget at top */}
        <div className="mb-8">
          <LessonWidget currentChurch={currentChurch} />
        </div>

        {/* Header Block */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-4">
              Attendance Sheet
              <button onClick={() => setShowAddModal(true)} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-sm font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                New Student
              </button>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Select date and tier level to record student presence.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-2">
            <button onClick={() => setViewMode('daily')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${viewMode === 'daily' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Daily Attendance</button>
            <button onClick={() => setViewMode('history')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${viewMode === 'history' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Past Records (History)</button>
          </div>
        </div>

        {viewMode === 'daily' ? (
          <>
            {/* Filter Toolbar Card */}
        <div className="bg-white p-5 shadow-sm border border-slate-200 rounded-2xl mb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            
            {/* Date Input */}
            <div>
              <label htmlFor="date" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Date selection
              </label>
              <input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-800"
              />
            </div>

            {/* Class Dropdown */}
            <div>
              <label htmlFor="class_level" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Class Level
              </label>
              <select
                id="class_level"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={currentUser?.role === 'teacher'}
                className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-800 bg-white disabled:opacity-50 disabled:bg-slate-50"
              >
                {dynamicClasses.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div>
              <label htmlFor="search" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Search Students
              </label>
              <input
                id="search"
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-800"
              />
            </div>

            {/* Money Collection & Guests Input */}
            <div className="sm:col-span-3 lg:col-span-2 pt-2 sm:pt-0 sm:border-t-0 border-t border-slate-100 grid grid-cols-2 gap-4">
              
              <div>
                <label htmlFor="money" className="block text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sabbath Money
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">$</span>
                  <input
                    id="money"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={collectionAmount}
                    onChange={(e) => setCollectionAmount(e.target.value)}
                    className="block w-full pl-7 pr-3.5 py-2.5 border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold text-emerald-800 bg-emerald-50/30"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="guests" className="block text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">👋</span> Guests Today
                </label>
                <input
                  id="guests"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-indigo-800 bg-indigo-50/30"
                />
              </div>

            </div>

          </div>

          {/* Bulk Actions Bar */}
          {students.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-2 items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Bulk Actions:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleMarkAll('Present')}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  Mark All Present
                </button>
                <button
                  onClick={() => handleMarkAll('Absent')}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  Mark All Absent
                </button>
              </div>
            </div>
          )}
        </div>

        {/* UI Alert banner block */}
        {status.type !== 'idle' && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-medium border ${
            status.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
              : 'bg-rose-50 text-rose-800 border-rose-100'
          }`}>
            {status.type === 'success' ? '✅ ' : '❌ '} {status.message}
          </div>
        )}

        {/* Main Attendance List */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-sm font-medium text-slate-500">
              <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading class roster...
            </div>
          ) : students.length === 0 ? (
            <div className="py-16 text-center">
              <span className="text-4xl">👥</span>
              <h3 className="mt-4 text-base font-semibold text-slate-800">No students registered</h3>
              <p className="mt-1 text-sm text-slate-400 max-w-xs mx-auto">
                No students found in the "{selectedClass}" tier. Go to Registration Form to add new students.
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No students match your query "{searchQuery}".
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredStudents.map(student => (
                <div key={student.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-800">
                      {student.first_name} {student.last_name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Phone: {student.phone || 'N/A'}
                    </p>
                  </div>

                  {/* Attendance Buttons */}
                  <div className="flex flex-col gap-2 items-end">
                    {/* Row 1: Main status — Present | Absent */}
                    <div className="flex gap-2">
                      {/* PRESENT */}
                      <button
                        onClick={() => {
                          const cur = attendance[student.id];
                          // Toggle: if already present (with or without study), clear it; else set Present
                          handleStatusChange(student.id, isPresent(cur) ? null : 'Present');
                        }}
                        className={`px-5 py-3 sm:px-6 sm:py-3.5 border rounded-xl text-sm font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer shadow-sm ${
                          isPresent(attendance[student.id])
                            ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/30'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        Present
                      </button>

                      {/* ABSENT */}
                      <button
                        onClick={() => {
                          const cur = attendance[student.id];
                          // Absent clears any study flag; toggle if already Absent
                          handleStatusChange(student.id, cur === 'Absent' ? null : 'Absent');
                        }}
                        className={`px-5 py-3 sm:px-6 sm:py-3.5 border rounded-xl text-sm font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer shadow-sm ${
                          attendance[student.id] === 'Absent'
                            ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-500/30'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        Absent
                      </button>
                    </div>

                    {/* Row 2: Add-on — 7 Days Study (only enabled when Present is active) */}
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold transition-colors ${
                        isPresent(attendance[student.id]) ? 'text-slate-400' : 'text-slate-200'
                      }`}>
                        Add-on:
                      </span>
                      <button
                        disabled={!isPresent(attendance[student.id])}
                        onClick={() => {
                          const cur = attendance[student.id];
                          // Toggle study on/off (only works when Present is active)
                          if (cur === 'Present') handleStatusChange(student.id, 'Present+Study');
                          else if (cur === 'Present+Study') handleStatusChange(student.id, 'Present');
                        }}
                        className={`px-4 py-2 sm:px-5 sm:py-2.5 border rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-all duration-150 shadow-sm ${
                          hasStudy(attendance[student.id])
                            ? 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-400/30 cursor-pointer'
                            : isPresent(attendance[student.id])
                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 cursor-pointer'
                              : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60'
                        }`}
                      >
                        📖 7 Days Study
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sticky Floating Action Bar for Tablets */}
        {students.length > 0 && !loading && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 p-4 sm:p-5 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50 flex justify-center">
            <button
              onClick={handleSaveAttendance}
              disabled={saving}
              className="w-full max-w-4xl px-8 py-4 sm:py-5 rounded-2xl shadow-lg text-base sm:text-lg font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-[0.98]"
            >
              {saving ? 'Synchronizing records...' : '💾 Save Attendance Sheet'}
            </button>
          </div>
        )}
          </>
        ) : (
          <div className="bg-white p-6 shadow-sm border border-slate-200 rounded-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800">Past Class Records</h2>
              <button 
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
                title="Download as CSV (Excel)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
            </div>
            {loadingHistory ? (
              <div className="py-10 text-center"><span className="animate-pulse text-slate-500">Loading history...</span></div>
            ) : historyData.length === 0 ? (
              <div className="py-10 text-center text-slate-500 italic">No past records found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-xs">
                      <th className="pb-3 px-4 font-semibold">Date</th>
                      <th className="pb-3 px-4 font-semibold">Class</th>
                      <th className="pb-3 px-4 font-semibold">Present</th>
                      <th className="pb-3 px-4 font-semibold">Absent</th>
                      <th className="pb-3 px-4 font-semibold">Collected</th>
                      <th className="pb-3 px-4 font-semibold">Guests</th>
                      <th className="pb-3 px-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyData.map(record => (
                      <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-700">{record.date}</td>
                        <td className="py-3 px-4 font-semibold text-indigo-600">{record.class_name}</td>
                        <td className="py-3 px-4 font-bold text-emerald-600">{record.present_count !== undefined ? record.present_count : '-'}</td>
                        <td className="py-3 px-4 font-bold text-rose-500">{record.absent_count !== undefined ? record.absent_count : '-'}</td>
                        <td className="py-3 px-4 text-emerald-600 font-bold">${(record.amount_collected || 0).toFixed(2)}</td>
                        <td className="py-3 px-4 text-slate-600">{record.guest_count || 0}</td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button onClick={() => handleEditHistory(record.date, record.class_name)} className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs bg-indigo-50 px-2 py-1 rounded">Edit</button>
                          <button onClick={() => handleDeleteHistory(record.date, record.class_name)} className="text-rose-500 hover:text-rose-700 font-semibold text-xs bg-rose-50 px-2 py-1 rounded">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Add Student Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Add New Student to {selectedClass}</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <form id="add-student-form" onSubmit={handleAddStudent} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">First Name *</label>
                      <input type="text" required value={newStudent.first_name} onChange={e => setNewStudent({...newStudent, first_name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Last Name *</label>
                      <input type="text" required value={newStudent.last_name} onChange={e => setNewStudent({...newStudent, last_name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Gender</label>
                      <select value={newStudent.gender} onChange={e => setNewStudent({...newStudent, gender: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Phone</label>
                      <input type="tel" value={newStudent.phone} onChange={e => setNewStudent({...newStudent, phone: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                    <input type="email" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Address</label>
                    <input type="text" value={newStudent.address} onChange={e => setNewStudent({...newStudent, address: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                  </div>
                </form>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800">Cancel</button>
                <button type="submit" form="add-student-form" disabled={addingStudent} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm disabled:opacity-50 transition-colors">
                  {addingStudent ? 'Saving...' : 'Add Student'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
