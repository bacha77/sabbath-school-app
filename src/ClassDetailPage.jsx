import React, { useState, useEffect, useRef } from 'react';
import { supabase, isPlaceholder } from './supabaseClient';
import { getClassesForChurch } from './constants';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = () => fmt(new Date());

const weekRange = () => {
  const d = new Date(); const dow = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: fmt(mon), end: fmt(sun) };
};
const monthRange = () => {
  const d = new Date();
  return { start: fmt(new Date(d.getFullYear(), d.getMonth(), 1)), end: fmt(new Date(d.getFullYear(), d.getMonth()+1, 0)) };
};
const lastMonthRange = () => {
  const d = new Date();
  return { start: fmt(new Date(d.getFullYear(), d.getMonth()-1, 1)), end: fmt(new Date(d.getFullYear(), d.getMonth(), 0)) };
};
const statusColor = s => ({ Present:'bg-emerald-100 text-emerald-800', 'Present+Study':'bg-teal-100 text-teal-800', Absent:'bg-rose-100 text-rose-800' }[s] || 'bg-slate-100 text-slate-500');
const statusShort = s => ({ Present:'P', 'Present+Study':'P+S', Absent:'A' }[s] || '–');

const formatBirthdate = (dStr) => {
  if (!dStr) return '—';
  // Assumes format like 2000-05-15 or YYYY-MM-DD
  const parts = dStr.split('-');
  if (parts.length < 3) return dStr;
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(2000, month, day).toLocaleString('default', { month: 'short', day: 'numeric' });
};

const isBirthdayThisWeek = (dStr) => {
  if (!dStr) return false;
  const parts = dStr.split('-');
  if (parts.length < 3) return false;
  
  const bMonth = parseInt(parts[1], 10) - 1;
  const bDay = parseInt(parts[2], 10);
  
  const today = new Date();
  const dow = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday
  startOfWeek.setHours(0,0,0,0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
  endOfWeek.setHours(23,59,59,999);
  
  // Create a date for the birthday IN THE CURRENT YEAR to check if it falls in this week
  const bDateThisYear = new Date(today.getFullYear(), bMonth, bDay);
  
  return bDateThisYear >= startOfWeek && bDateThisYear <= endOfWeek;
};

// ── localStorage helpers (demo mode) ─────────────────────────────────────────
const lsGet  = key => JSON.parse(localStorage.getItem(key) || '[]');
const lsSet  = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// ── icons ─────────────────────────────────────────────────────────────────────
const IconUsers    = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;
const IconTeacher  = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;
const IconReport   = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z"/></svg>;
const IconBack     = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>;
const IconTrash    = () => <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
const IconPlus     = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>;
const IconPrint    = () => <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>;

// ══════════════════════════════════════════════════════════════════════════════
export default function ClassDetailPage({ className, onBack, currentChurch, setView }) {
  const [activeTab, setActiveTab] = useState('roster');

  const tabs = [
    { id: 'roster',   label: 'Roster',   Icon: IconUsers   },
    { id: 'teachers', label: 'Teachers', Icon: IconTeacher },
    { id: 'reports',  label: 'Reports',  Icon: IconReport  },
  ];

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* Back + title */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <IconBack /> All Classes
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{className}</h1>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50 w-fit mb-8">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === id
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon />{label}
            </button>
          ))}
        </div>

        {/* Panels */}
        {activeTab === 'roster'   && <RosterTab   className={className} currentChurch={currentChurch} />}
        {activeTab === 'teachers' && <TeachersTab className={className} currentChurch={currentChurch} />}
        {activeTab === 'reports'  && <ReportsTab  className={className} currentChurch={currentChurch} />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SMART FOLLOW UP MODAL
// ══════════════════════════════════════════════════════════════════════════════
function SmartFollowUpModal({ student, isAtRisk, onClose }) {
  const [message, setMessage] = useState('');

  React.useEffect(() => {
    if (student) {
      generateMessage();
    }
  }, [student]);

  const generateMessage = () => {
    const parentName = "Parent/Guardian";
    const greetings = [
      `Hi ${parentName},`,
      `Hello ${parentName},`,
      `Warm greetings ${parentName},`
    ];
    
    const context = isAtRisk
      ? `We noticed that ${student.first_name} hasn't been at class for a few weeks now.`
      : `We missed ${student.first_name} in class today!`;
      
    const encouragements = [
      `We hope everything is going well. Please let us know if there is anything we can pray for or help with.`,
      `We are praying for your family and hope to see ${student.first_name} again soon!`,
      `The class isn't the same without them. Hope you're all having a blessed week!`
    ];
    
    const signOffs = [
      `Blessings,\nThe Team`,
      `With love,\nYour Teachers`,
      `Take care,\nThe Team`
    ];

    const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
    setMessage(`${random(greetings)}\n\n${context} ${random(encouragements)}\n\n${random(signOffs)}`);
  };

  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2">
            <span className="text-xl">✨</span> Smart Follow-Up
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <p className="text-sm text-slate-500 mb-4">
            Generated draft for <strong>{student.first_name} {student.last_name}</strong>. Feel free to edit before sending!
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={generateMessage} className="px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer">
              Regenerate 🔄
            </button>
            <a 
              href={`sms:${student.phone || ''}?body=${encodeURIComponent(message)}`}
              className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              Send SMS
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROSTER TAB
// ══════════════════════════════════════════════════════════════════════════════
function RosterTab({ className, currentChurch }) {
  const [students, setStudents]       = useState([]);
  const [search,   setSearch]         = useState('');
  const [loading,  setLoading]        = useState(true);
  const [movingId, setMovingId]       = useState(null);
  const [moveTarget, setMoveTarget]   = useState('');
  const [status, setStatus]           = useState({ type: 'idle', message: '' });
  const [atRiskIds, setAtRiskIds]     = useState(new Set());
  const [absentTodayIds, setAbsentTodayIds] = useState(new Set());
  const [followUpStudent, setFollowUpStudent] = useState(null);

  useEffect(() => { fetchStudents(); }, [className, currentChurch]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let studentData = [];
      let logsData = [];
      
      const d21 = new Date(); d21.setDate(d21.getDate() - 21);
      const past21Date = fmt(d21);
      const todayStr = fmt(new Date());

      if (isPlaceholder) {
        const all = lsGet('students');
        studentData = all.filter(s => s.class_level === className && s.church_id === currentChurch.id);
        const allLogs = lsGet('attendance_logs');
        logsData = allLogs.filter(l => l.class_name === className && l.church_id === currentChurch.id && l.date >= past21Date);
      } else {
        const [studentRes, logRes] = await Promise.all([
          supabase.from('students').select('*').eq('church_id', currentChurch.id).eq('class_level', className).order('last_name'),
          supabase.from('attendance_logs').select('*').eq('church_id', currentChurch.id).eq('class_name', className).gte('date', past21Date)
        ]);
        if (studentRes.error) throw studentRes.error;
        if (logRes.error) throw logRes.error;
        studentData = studentRes.data || [];
        logsData = logRes.data || [];
      }
      
      setStudents(studentData);

      // Calculate At-Risk and Absent Today
      const riskSet = new Set();
      const absentSet = new Set();
      
      studentData.forEach(student => {
        const studentLogs = logsData
          .filter(log => log.student_id === student.id)
          .sort((a, b) => new Date(b.date) - new Date(a.date));
          
        if (studentLogs.length > 0 && studentLogs[0].date === todayStr && studentLogs[0].status === 'Absent') {
          absentSet.add(student.id);
        }
        
        if (studentLogs.length >= 3) {
          const last3 = studentLogs.slice(0, 3);
          if (last3.every(log => log.status === 'Absent')) {
            riskSet.add(student.id);
          }
        }
      });
      
      setAtRiskIds(riskSet);
      setAbsentTodayIds(absentSet);

    } catch(e) { console.error(e); }
    finally    { setLoading(false); }
  };

  const moveStudent = async (studentId) => {
    if (!moveTarget) return;
    setStatus({ type: 'loading', message: '' });
    try {
      if (isPlaceholder) {
        const all = lsGet('students');
        lsSet('students', all.map(s => s.id === studentId ? { ...s, class_level: moveTarget } : s));
      } else {
        const { error } = await supabase.from('students').update({ class_level: moveTarget }).eq('id', studentId);
        if (error) throw error;
      }
      setMovingId(null); setMoveTarget('');
      setStatus({ type: 'success', message: 'Student moved successfully.' });
      fetchStudents();
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 2500);
    } catch(e) {
      setStatus({ type: 'error', message: 'Failed to move student.' });
    }
  };

  const filtered = students.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const birthdayStudents = students.filter(s => isBirthdayThisWeek(s.birthdate));

  return (
    <div>
      {/* Birthday Reminder Banner */}
      {!loading && birthdayStudents.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-100 to-amber-50 border border-amber-200 shadow-sm flex items-start sm:items-center gap-4">
          <div className="text-3xl">🎉</div>
          <div>
            <h3 className="text-amber-900 font-bold text-sm tracking-tight">Birthdays This Week!</h3>
            <p className="text-amber-800 text-xs mt-0.5">
              Make sure to wish a happy birthday to: <span className="font-bold">{birthdayStudents.map(s => `${s.first_name} ${s.last_name}`).join(', ')}</span>
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-grow max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7 7 0 1016.65 16.65z"/>
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search students…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        </div>
        <span className="text-sm text-slate-500 font-medium">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {status.type !== 'idle' && status.type !== 'loading' && (
        <div className={`mb-4 text-sm px-4 py-2.5 rounded-xl font-medium ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {status.message}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading roster…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">🎒</div>
          <p className="text-slate-500 font-medium">{search ? 'No students match your search.' : 'No students are enrolled in this class yet.'}</p>
          <p className="text-slate-400 text-sm mt-1">Register students and assign them to <strong>{className}</strong>.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Date of Birth</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Phone</th>
                <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => (
                <React.Fragment key={s.id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800 flex items-center gap-2">
                            {s.first_name} {s.last_name}
                            {atRiskIds.has(s.id) && (
                              <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">At Risk</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 hidden sm:table-cell">{formatBirthdate(s.birthdate)}</td>
                    <td className="px-5 py-3.5 text-slate-500 hidden md:table-cell">{s.phone || '—'}</td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      {(atRiskIds.has(s.id) || absentTodayIds.has(s.id)) && (
                        <button
                          onClick={() => setFollowUpStudent(s)}
                          className="text-xs font-bold text-rose-600 hover:text-rose-800 px-3 py-1.5 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                          Send Check-in
                        </button>
                      )}
                      <button
                        onClick={() => { setMovingId(movingId === s.id ? null : s.id); setMoveTarget(''); }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                      >
                        Move
                      </button>
                    </td>
                  </tr>
                  {movingId === s.id && (
                    <tr className="bg-indigo-50/50">
                      <td colSpan={4} className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600">Move to:</span>
                          <select
                            value={moveTarget}
                            onChange={e => setMoveTarget(e.target.value)}
                            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                          >
                            <option value="">Select class…</option>
                            {getClassesForChurch(currentChurch).filter(c => c !== className).map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => moveStudent(s.id)}
                            disabled={!moveTarget}
                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg disabled:opacity-40 hover:bg-indigo-700 transition-colors cursor-pointer"
                          >
                            Confirm Move
                          </button>
                          <button onClick={() => setMovingId(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Smart Follow-Up Modal */}
      {followUpStudent && (
        <SmartFollowUpModal 
          student={followUpStudent} 
          onClose={() => setFollowUpStudent(null)} 
          isAtRisk={atRiskIds.has(followUpStudent.id)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEACHERS TAB
// ══════════════════════════════════════════════════════════════════════════════
function TeachersTab({ className, currentChurch }) {
  const [classTeachers, setClassTeachers] = useState([]);
  const [allTeachers,   setAllTeachers]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [assignId,      setAssignId]      = useState('');
  const [status,        setStatus]        = useState({ type: 'idle', message: '' });
  const [form, setForm] = useState({ name: '', pin: '' });

  useEffect(() => { fetchTeachers(); }, [className, currentChurch]);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      if (isPlaceholder) {
        const teachers = JSON.parse(localStorage.getItem('teachers') || '[]');
        setClassTeachers(teachers.filter(t => t.assigned_class === className && t.church_id === currentChurch.id));
        setAllTeachers(teachers.filter(t => t.church_id === currentChurch.id));
      } else {
        const { data, error } = await supabase
          .from('teachers')
          .select('*')
          .eq('church_id', currentChurch.id)
          .order('name');
        
        if (error) throw error;
        setAllTeachers(data || []);
        setClassTeachers((data || []).filter(t => t.assigned_class === className));
      }
    } catch(e) { console.error(e); }
    finally    { setLoading(false); }
  };

  const handleAddNew = async () => {
    if (!form.name.trim()) {
      setStatus({ type: 'error', message: 'Teacher name is required.' }); return;
    }
    if (!form.pin.trim() || form.pin.length < 4) {
      setStatus({ type: 'error', message: 'PIN must be at least 4 digits.' }); return;
    }
    setStatus({ type: 'loading', message: '' });
    try {
      const teacherToAdd = {
        name: form.name.trim(),
        pin: form.pin.trim(),
        assigned_class: className,
        church_id: currentChurch.id,
        is_active: true
      };

      if (isPlaceholder) {
        const newT = { id: `t_${Date.now()}`, ...teacherToAdd, created_at: new Date().toISOString() };
        const existing = JSON.parse(localStorage.getItem('teachers') || '[]');
        localStorage.setItem('teachers', JSON.stringify([...existing, newT]));
      } else {
        const { error: tErr } = await supabase.from('teachers').insert([teacherToAdd]);
        if (tErr) throw tErr;
      }
      setForm({ name: '', pin: '' });
      setShowForm(false);
      setStatus({ type: 'success', message: 'Teacher added and assigned.' });
      fetchTeachers();
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 2500);
    } catch(e) {
      setStatus({ type: 'error', message: 'Failed to add teacher.' });
    }
  };

  const handleAssignExisting = async () => {
    if (!assignId) return;
    setStatus({ type: 'loading', message: '' });
    try {
      if (isPlaceholder) {
        const teachers = JSON.parse(localStorage.getItem('teachers') || '[]');
        const updated = teachers.map(t => t.id === assignId ? { ...t, assigned_class: className } : t);
        localStorage.setItem('teachers', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('teachers')
          .update({ assigned_class: className })
          .eq('id', assignId);
        if (error) throw error;
      }
      setAssignId('');
      setStatus({ type: 'success', message: 'Teacher assigned.' });
      fetchTeachers();
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 2500);
    } catch(e) {
      setStatus({ type: 'error', message: 'Failed to assign teacher.' });
    }
  };

  const handleRemove = async (teacherId) => {
    setStatus({ type: 'loading', message: '' });
    try {
      if (isPlaceholder) {
        const teachers = JSON.parse(localStorage.getItem('teachers') || '[]');
        const updated = teachers.map(t => t.id === teacherId ? { ...t, assigned_class: '' } : t);
        localStorage.setItem('teachers', JSON.stringify(updated));
      } else {
        const { error } = await supabase
          .from('teachers')
          .update({ assigned_class: '' })
          .eq('id', teacherId);
        if (error) throw error;
      }
      setStatus({ type: 'success', message: 'Teacher removed from class.' });
      fetchTeachers();
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 2500);
    } catch(e) {
      setStatus({ type: 'error', message: 'Failed to remove teacher.' });
    }
  };

  const unassigned = allTeachers.filter(t => t.assigned_class !== className);

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400";

  return (
    <div className="max-w-2xl space-y-6">
      {status.type !== 'idle' && status.type !== 'loading' && (
        <div className={`text-sm px-4 py-2.5 rounded-xl font-medium ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {status.message}
        </div>
      )}

      {/* Current Teachers */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Assigned Teachers</h3>
          <span className="text-xs text-slate-400">{classTeachers.length} assigned</span>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : classTeachers.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-slate-400 text-sm">No teachers assigned to this class yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {classTeachers.map(t => (
              <li key={t.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                    {t.name ? t.name[0] : '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-400">PIN: {t.pin}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(t.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <IconTrash /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Assign existing */}
      {unassigned.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <h3 className="font-bold text-slate-800 mb-3">Assign Existing Teacher</h3>
          <div className="flex gap-2">
            <select value={assignId} onChange={e => setAssignId(e.target.value)} className={`${inputCls} flex-1`}>
              <option value="">Select teacher…</option>
              {unassigned.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button
              onClick={handleAssignExisting}
              disabled={!assignId}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Assign
            </button>
          </div>
        </div>
      )}

      {/* Add new teacher */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <IconPlus /> Add New Teacher
          </div>
          <svg className={`h-4 w-4 text-slate-400 transition-transform ${showForm ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        {showForm && (
          <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Teacher Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputCls} placeholder="Jean Dupont" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Teacher PIN *</label>
                <input type="password" value={form.pin} onChange={e => setForm({...form, pin: e.target.value})} className={inputCls} placeholder="••••" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleAddNew} className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer">
                Add & Assign
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REPORTS TAB
// ══════════════════════════════════════════════════════════════════════════════
function ReportsTab({ className, currentChurch }) {
  const [preset, setPreset]     = useState('week');
  const [startDate, setStart]   = useState(weekRange().start);
  const [endDate,   setEnd]     = useState(weekRange().end);
  const [students,  setStudents]= useState([]);
  const [matrix,    setMatrix]  = useState({});   // { studentId: { date: status } }
  const [dates,     setDates]   = useState([]);   // sorted unique dates
  const [loading,   setLoading] = useState(false);
  const [summary,   setSummary] = useState({ total: 0, present: 0, absent: 0, excused: 0, sessions: 0, money: 0 });
  const printRef = useRef();

  useEffect(() => { applyPreset('week'); }, [className]);

  const applyPreset = (p) => {
    setPreset(p);
    const ranges = { week: weekRange(), month: monthRange(), lastMonth: lastMonthRange() };
    if (ranges[p]) { setStart(ranges[p].start); setEnd(ranges[p].end); }
  };

  useEffect(() => {
    if (startDate && endDate && startDate <= endDate) fetchReport();
  }, [startDate, endDate, className, currentChurch]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let studentsData = [], logs = [], cols = [];
      if (isPlaceholder) {
        const all = lsGet('students');
        studentsData = all.filter(s => s.class_level === className && s.church_id === currentChurch.id);
        const allLogs = lsGet('attendance_logs');
        const ids = studentsData.map(s => s.id);
        logs = allLogs.filter(l => ids.includes(l.student_id) && l.date >= startDate && l.date <= endDate && l.church_id === currentChurch.id);
        const allCols = lsGet('collections');
        cols = allCols.filter(c => c.class_name === className && c.date >= startDate && c.date <= endDate && c.church_id === currentChurch.id);
      } else {
        const { data: sData, error: sErr } = await supabase.from('students').select('*').eq('church_id', currentChurch.id).eq('class_level', className).order('last_name');
        if (sErr) throw sErr;
        studentsData = sData || [];
        if (studentsData.length > 0) {
          const ids = studentsData.map(s => s.id);
          const { data: lData, error: lErr } = await supabase.from('attendance_logs').select('*').eq('church_id', currentChurch.id).in('student_id', ids).gte('date', startDate).lte('date', endDate).order('date');
          if (lErr) throw lErr;
          logs = lData || [];
        }
        
        const { data: cData, error: cErr } = await supabase.from('collections').select('*').eq('church_id', currentChurch.id).eq('class_name', className).gte('date', startDate).lte('date', endDate);
        if (cErr) throw cErr;
        cols = cData || [];
      }

      // Build matrix & unique dates
      const uniqueDates = [...new Set(logs.map(l => l.date))].sort();
      const mat = {};
      studentsData.forEach(s => { mat[s.id] = {}; });
      logs.forEach(l => { if (mat[l.student_id]) mat[l.student_id][l.date] = l.status; });

      // Summary
      const total   = logs.length;
      const present = logs.filter(l => l.status === 'Present').length;
      const absent  = logs.filter(l => l.status === 'Absent').length;
      const excused = logs.filter(l => l.status === 'Present+Study').length;
      const money   = cols.reduce((sum, c) => sum + (parseFloat(c.amount_collected) || 0), 0);

      setStudents(studentsData);
      setMatrix(mat);
      setDates(uniqueDates);
      setSummary({ total, present, absent, excused, sessions: uniqueDates.length, money });
    } catch(e) { console.error(e); }
    finally    { setLoading(false); }
  };

  const attendanceRate = summary.total > 0 ? Math.round(((summary.present + summary.excused) / summary.total) * 100) : null;

  const shortDate = d => {
    const parts = d.split('-');
    return `${parts[1]}/${parts[2]}`;
  };

  return (
    <div>
      {/* Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[['week','This Week'],['month','This Month'],['lastMonth','Last Month'],['custom','Custom']].map(([p, label]) => (
              <button key={p} onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${preset === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2 text-sm">
              <input type="date" value={startDate} onChange={e => setStart(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              <span className="text-slate-400">–</span>
              <input type="date" value={endDate} onChange={e => setEnd(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
          )}
          <button onClick={fetchReport} className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer">
            Refresh
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
            <IconPrint /> Print
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'Students', value: students.length, color: 'text-slate-800' },
          { label: 'Sessions', value: summary.sessions, color: 'text-slate-800' },
          { label: 'Present', value: summary.present, color: 'text-emerald-700' },
          { label: 'Absent', value: summary.absent, color: 'text-rose-700' },
          { label: '7D Study', value: summary.excused, color: 'text-amber-700' },
          { label: 'Collected', value: `$${summary.money.toFixed(2)}`, color: 'text-emerald-600' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
            <p className={`text-2xl font-extrabold ${card.color}`}>{loading ? '…' : card.value}</p>
            <p className="text-[10px] sm:text-xs text-slate-400 font-semibold mt-0.5 uppercase tracking-wide">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Attendance Rate bar */}
      {!loading && attendanceRate !== null && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-6">
          <div className="flex justify-between items-center text-sm font-bold mb-2">
            <span className="text-slate-700">Overall Attendance Rate</span>
            <span className={attendanceRate >= 80 ? 'text-emerald-600' : attendanceRate >= 60 ? 'text-amber-600' : 'text-rose-600'}>{attendanceRate}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div className={`h-3 rounded-full transition-all duration-700 ${attendanceRate >= 80 ? 'bg-emerald-500' : attendanceRate >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${attendanceRate}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{summary.present + summary.excused} present/excused out of {summary.total} total records · {startDate} → {endDate}</p>
        </div>
      )}

      {/* Attendance Matrix */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden" ref={printRef}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Attendance by Student</h3>
          <span className="text-xs text-slate-400">{startDate} — {endDate}</span>
        </div>
        {loading ? (
          <div className="py-14 text-center">
            <svg className="animate-spin h-6 w-6 text-indigo-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="text-sm text-slate-400">Loading attendance data…</p>
          </div>
        ) : students.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-sm">No students enrolled in this class.</div>
        ) : dates.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-slate-500 font-medium">No attendance records found.</p>
            <p className="text-slate-400 text-sm mt-1">Try a wider date range or take attendance first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 min-w-[160px]">Student</th>
                  {dates.map(d => (
                    <th key={d} className="px-3 py-3 text-xs font-bold text-slate-500 text-center min-w-[52px]">{shortDate(d)}</th>
                  ))}
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 text-center min-w-[64px]">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map(s => {
                  const row     = matrix[s.id] || {};
                  const marked  = dates.filter(d => row[d]);
                  const present = dates.filter(d => row[d] === 'Present' || row[d] === 'Present+Study').length;
                  const rate    = marked.length > 0 ? Math.round((present / marked.length) * 100) : null;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-800 sticky left-0 bg-white group-hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px] shrink-0">
                            {s.first_name[0]}{s.last_name[0]}
                          </div>
                          {s.first_name} {s.last_name}
                        </div>
                      </td>
                      {dates.map(d => (
                        <td key={d} className="px-3 py-3 text-center">
                          {row[d] ? (
                            <span className={`inline-block w-7 text-center text-[11px] font-bold py-0.5 rounded-md ${statusColor(row[d])}`}>
                              {statusShort(row[d])}
                            </span>
                          ) : (
                            <span className="text-slate-200 text-xs">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center">
                        {rate !== null ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rate >= 80 ? 'bg-emerald-100 text-emerald-700' : rate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                            {rate}%
                          </span>
                        ) : <span className="text-slate-300 text-xs">N/A</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        {!loading && dates.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
            <span className="font-semibold">Legend:</span>
            <span className="inline-flex items-center gap-1"><span className="w-5 h-4 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">P</span> Present</span>
            <span className="inline-flex items-center gap-1"><span className="w-7 h-4 rounded bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[10px]">P+S</span> Present + 7 Days Study</span>
            <span className="inline-flex items-center gap-1"><span className="w-5 h-4 rounded bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-[10px]">A</span> Absent</span>
            <span className="inline-flex items-center gap-1"><span className="text-slate-200">—</span> Not Recorded</span>
          </div>
        )}
      </div>
    </div>
  );
}
