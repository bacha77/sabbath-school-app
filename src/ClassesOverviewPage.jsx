import React, { useState, useEffect, useRef } from 'react';
import { supabase, isPlaceholder } from './supabaseClient';
import { getClassesForChurch } from './constants';
import { Upload, Settings } from 'lucide-react';

const CLASS_COLORS = [
  { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'bg-indigo-600', text: 'text-indigo-700', bar: 'bg-indigo-500' },
  { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'bg-violet-600', text: 'text-violet-700', bar: 'bg-violet-500' },
  { bg: 'bg-sky-50',    border: 'border-sky-200',    icon: 'bg-sky-600',    text: 'text-sky-700',    bar: 'bg-sky-500'    },
  { bg: 'bg-emerald-50',border: 'border-emerald-200',icon: 'bg-emerald-600',text: 'text-emerald-700',bar: 'bg-emerald-500'},
  { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: 'bg-amber-600',  text: 'text-amber-700',  bar: 'bg-amber-500'  },
  { bg: 'bg-rose-50',   border: 'border-rose-200',   icon: 'bg-rose-600',   text: 'text-rose-700',   bar: 'bg-rose-500'   },
];

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

export default function ClassesOverviewPage({ navigateToClass, currentChurch, onChurchUpdate, setView }) {
  const [classData, setClassData] = useState({});
  const [loading, setLoading]     = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const today = getTodayStr();

  // Custom classes manager state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [classesState, setClassesState] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [savingClasses, setSavingClasses] = useState(false);
  const [classesStatus, setClassesStatus] = useState({ type: 'idle', message: '' });

  const handleOpenSettings = () => {
    const currentClasses = getClassesForChurch(currentChurch);
    setClassesState(currentClasses.map(c => ({ original: c, current: c })));
    setNewClassName('');
    setClassesStatus({ type: 'idle', message: '' });
    setShowSettingsModal(true);
  };

  const handleClassRename = (idx, value) => {
    setClassesState(prev => prev.map((item, i) => i === idx ? { ...item, current: value } : item));
  };

  const handleClassDelete = (idx) => {
    setClassesState(prev => {
      const item = prev[idx];
      if (!item.original) {
        return prev.filter((_, i) => i !== idx);
      }
      return prev.map((item, i) => i === idx ? { ...item, current: '' } : item);
    });
  };

  const handleAddClass = () => {
    if (!newClassName.trim()) return;
    const cleanName = newClassName.trim();
    if (classesState.some(c => c.current.toLowerCase() === cleanName.toLowerCase())) {
      setClassesStatus({ type: 'error', message: 'A class with that name already exists.' });
      return;
    }
    setClassesState(prev => [...prev, { original: '', current: cleanName }]);
    setNewClassName('');
    setClassesStatus({ type: 'idle', message: '' });
  };

  const handleSaveClasses = async () => {
    const finalClasses = classesState.filter(c => c.current.trim() !== '').map(c => c.current.trim());
    if (finalClasses.length === 0) {
      setClassesStatus({ type: 'error', message: 'You must have at least one class.' });
      return;
    }

    setSavingClasses(true);
    setClassesStatus({ type: 'idle', message: '' });

    try {
      const updatedChurch = {
        ...currentChurch,
        classes: finalClasses
      };

      if (isPlaceholder) {
        const churches = JSON.parse(localStorage.getItem('churches') || '[]');
        const updatedChurches = churches.map(ch => ch.id === currentChurch.id ? updatedChurch : ch);
        localStorage.setItem('churches', JSON.stringify(updatedChurches));
        localStorage.setItem(`classes_${currentChurch.id}`, JSON.stringify(finalClasses));

        // Cascade renames/deletes to students
        let students = JSON.parse(localStorage.getItem('students') || '[]');
        classesState.forEach(item => {
          if (item.original) {
            if (item.current === '') {
              students = students.map(s => s.church_id === currentChurch.id && s.class_level === item.original ? { ...s, class_level: '' } : s);
            } else if (item.original !== item.current) {
              students = students.map(s => s.church_id === currentChurch.id && s.class_level === item.original ? { ...s, class_level: item.current } : s);
            }
          }
        });
        localStorage.setItem('students', JSON.stringify(students));

        // Cascade to teachers
        let teachers = JSON.parse(localStorage.getItem('teachers') || '[]');
        classesState.forEach(item => {
          if (item.original) {
            if (item.current === '') {
              teachers = teachers.map(t => t.church_id === currentChurch.id && t.assigned_class === item.original ? { ...t, assigned_class: '' } : t);
            } else if (item.original !== item.current) {
              teachers = teachers.map(t => t.church_id === currentChurch.id && t.assigned_class === item.original ? { ...t, assigned_class: item.current } : t);
            }
          }
        });
        localStorage.setItem('teachers', JSON.stringify(teachers));

        // Cascade to collections
        let collections = JSON.parse(localStorage.getItem('collections') || '[]');
        classesState.forEach(item => {
          if (item.original) {
            if (item.current === '') {
              collections = collections.map(c => c.church_id === currentChurch.id && c.class_name === item.original ? { ...c, class_name: '' } : c);
            } else if (item.original !== item.current) {
              collections = collections.map(c => c.church_id === currentChurch.id && c.class_name === item.original ? { ...c, class_name: item.current } : c);
            }
          }
        });
        localStorage.setItem('collections', JSON.stringify(collections));
      } else {
        const { error: chErr } = await supabase
          .from('churches')
          .update({ classes: finalClasses })
          .eq('id', currentChurch.id);
        
        if (chErr) throw chErr;

        // Perform updates in database for students, teachers, collections
        for (const item of classesState) {
          if (item.original) {
            if (item.current === '') {
              await Promise.all([
                supabase.from('students').update({ class_level: '' }).eq('church_id', currentChurch.id).eq('class_level', item.original),
                supabase.from('teachers').update({ assigned_class: '' }).eq('church_id', currentChurch.id).eq('assigned_class', item.original)
              ]);
            } else if (item.original !== item.current) {
              await Promise.all([
                supabase.from('students').update({ class_level: item.current }).eq('church_id', currentChurch.id).eq('class_level', item.original),
                supabase.from('teachers').update({ assigned_class: item.current }).eq('church_id', currentChurch.id).eq('assigned_class', item.original),
                supabase.from('collections').update({ class_name: item.current }).eq('church_id', currentChurch.id).eq('class_name', item.original)
              ]);
            }
          }
        }
      }

      if (onChurchUpdate) {
        onChurchUpdate(updatedChurch);
      }

      setShowSettingsModal(false);
      fetchAll();
    } catch (err) {
      console.error(err);
      setClassesStatus({ type: 'error', message: 'Failed to save class changes: ' + err.message });
    } finally {
      setSavingClasses(false);
    }
  };

  useEffect(() => { fetchAll(); }, [currentChurch]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      let students = [], logs = [], teachers = [];

      if (isPlaceholder) {
        const allStudents = JSON.parse(localStorage.getItem('students') || '[]');
        students = allStudents.filter(s => s.church_id === currentChurch.id);
        teachers = JSON.parse(localStorage.getItem('teachers') || '[]');
        const allLogs = JSON.parse(localStorage.getItem('attendance_logs') || '[]');
        logs = allLogs.filter(l => l.date === today && students.find(s => s.id === l.student_id));
      } else {
        const [sRes, lRes, tRes] = await Promise.all([
          supabase.from('students').select('id,first_name,last_name,class_level').eq('church_id', currentChurch.id),
          supabase.from('attendance_logs').select('student_id,status').eq('date', today),
          supabase.from('teachers').select('id,name,assigned_class').eq('church_id', currentChurch.id),
        ]);
        if (sRes.error)  throw sRes.error;
        if (lRes.error)  throw lRes.error;
        if (tRes.error)  throw tRes.error;
        students     = sRes.data  || [];
        logs         = lRes.data  || [];
        teachers     = tRes.data  || [];
      }

      // Build per-class summary
      const data = {};
      getClassesForChurch(currentChurch).forEach(cls => {
        const enrolled    = students.filter(s => s.class_level === cls);
        const enrolledIds = enrolled.map(s => s.id);
        const todayLogs   = logs.filter(l => enrolledIds.includes(l.student_id));
        const present     = todayLogs.filter(l => l.status === 'Present' || l.status === 'Present+Study').length;
        const rate        = todayLogs.length > 0 ? Math.round((present / todayLogs.length) * 100) : null;
        const tNames      = teachers.filter(t => t.assigned_class === cls).map(t => t.name);
        data[cls] = { count: enrolled.length, rate, markedCount: todayLogs.length, teachers: tNames };
      });
      setClassData(data);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        
        let startIndex = 0;
        if (rows[0].toLowerCase().includes('name') || rows[0].toLowerCase().includes('first')) {
          startIndex = 1;
        }

        const validClasses = getClassesForChurch(currentChurch);
        const newStudents = [];

        for (let i = startIndex; i < rows.length; i++) {
          const cols = rows[i].split(',').map(c => c.trim());
          if (cols.length >= 2) {
            let firstName = cols[0];
            let lastName = cols[1];
            let classLevel = cols.length > 2 ? cols[2] : validClasses[0];

            if (!validClasses.includes(classLevel)) {
              classLevel = validClasses[0]; 
            }

            newStudents.push({
              church_id: currentChurch.id,
              first_name: firstName,
              last_name: lastName,
              class_level: classLevel
            });
          }
        }

        if (newStudents.length === 0) {
          alert("No valid student rows found. Expected format: First Name, Last Name, Class");
          setImporting(false);
          return;
        }

        if (isPlaceholder) {
          const existing = JSON.parse(localStorage.getItem('students') || '[]');
          const toAdd = newStudents.map(s => ({ ...s, id: `local-${Date.now()}-${Math.random()}` }));
          localStorage.setItem('students', JSON.stringify([...existing, ...toAdd]));
        } else {
          const { error } = await supabase.from('students').insert(newStudents);
          if (error) throw error;
        }

        alert(`Successfully imported ${newStudents.length} students!`);
        fetchAll(); 
      } catch (err) {
        console.error("Import error:", err);
        alert("Failed to import students. Check console for details.");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Classes</h1>
            <p className="mt-1 text-sm text-slate-500">Click any class to manage its roster, teachers and reports.</p>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={handleOpenSettings}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer active:scale-95"
            >
              <Settings className="w-4 h-4" />
              Manage Classes
            </button>
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importing...' : 'Bulk CSV Import'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="text-sm text-slate-500">Loading class data…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {getClassesForChurch(currentChurch).map((cls, i) => {
              const color = CLASS_COLORS[i % CLASS_COLORS.length];
              const d     = classData[cls] || { count: 0, rate: null, markedCount: 0, teachers: [] };
              return (
                <div
                  key={cls}
                  onClick={() => navigateToClass(cls)}
                  className={`group relative glass-panel rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-${color.icon.split('-')[1]}-500/20`}
                >
                  {/* Color accent strip */}
                  <div className={`h-1.5 w-full ${color.icon}`} />

                  <div className="p-6">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={`h-10 w-10 rounded-xl ${color.icon} flex items-center justify-center text-white font-black text-sm shadow-sm`}>
                        {i + 1}
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.bg} ${color.text} border ${color.border}`}>
                        {d.count} student{d.count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">
                      {cls}
                    </h2>

                    {/* Teachers */}
                    <p className="text-xs text-slate-400 mb-4 min-h-[16px]">
                      {d.teachers.length > 0
                        ? `👤 ${d.teachers.join(', ')}`
                        : 'No teacher assigned'}
                    </p>

                    {/* Attendance rate bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                        <span className="text-slate-500">Today's Attendance</span>
                        <span className={d.rate !== null ? color.text : 'text-slate-300'}>
                          {d.rate !== null ? `${d.rate}%` : `${d.markedCount} marked`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-700 ${color.bar}`}
                          style={{ width: d.rate !== null ? `${d.rate}%` : '0%' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action footer */}
                  <div className="border-t border-slate-100 px-6 py-3 flex gap-3">
                    <button
                      onClick={e => { e.stopPropagation(); navigateToClass(cls); }}
                      className="flex-1 text-center text-xs font-bold text-indigo-600 hover:text-indigo-800 py-1 transition-colors"
                    >
                      Manage Class →
                    </button>
                    <div className="w-px bg-slate-100" />
                    <button
                      onClick={e => { e.stopPropagation(); setView('attendance'); }}
                      className="flex-1 text-center text-xs font-bold text-slate-500 hover:text-slate-800 py-1 transition-colors"
                    >
                      Attendance Sheet
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Class Customizer Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800">⚙️ Manage Classes List</h3>
                <p className="text-xs text-slate-400">Rename, add, or delete your Sabbath/Sunday School classes.</p>
              </div>
              <button 
                onClick={() => setShowSettingsModal(false)} 
                disabled={savingClasses}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Status Alert */}
            {classesStatus.message && (
              <div className={`mx-6 mt-4 p-3.5 rounded-xl text-xs font-semibold border ${
                classesStatus.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-100' : 'bg-emerald-50 text-emerald-800 border-emerald-100'
              }`}>
                {classesStatus.message}
              </div>
            )}

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              
              {/* Information Callout */}
              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl text-xs text-indigo-700 leading-relaxed font-medium">
                💡 <strong>Renaming safety</strong>: When you rename a class, the system automatically migrates all associated student registrations, assigned teachers, and collections history to the new name so that no records are orphaned!
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Active Classes</label>
                
                {classesState.filter(c => c.current !== '').length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-2">No active classes. Add one below.</p>
                ) : (
                  <div className="space-y-2">
                    {classesState.map((cls, idx) => {
                      if (cls.current === '') return null; // Marked deleted
                      
                      return (
                        <div key={idx} className="flex gap-2 items-center">
                          <input 
                            type="text" 
                            required 
                            value={cls.current}
                            onChange={e => handleClassRename(idx, e.target.value)}
                            className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-700 transition-all"
                            placeholder="Class Name"
                          />
                          <button 
                            type="button" 
                            onClick={() => handleClassDelete(idx)}
                            className="p-3 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer active:scale-95"
                            title="Delete Class"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add New Class Form */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Create a New Class</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newClassName}
                    onChange={e => setNewClassName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddClass(); } }}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 font-medium transition-all"
                    placeholder="e.g. Primary, Cradle Roll, Youth"
                  />
                  <button 
                    type="button" 
                    onClick={handleAddClass}
                    className="px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-bold rounded-xl transition-colors cursor-pointer active:scale-95 whitespace-nowrap"
                  >
                    + Add Class
                  </button>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowSettingsModal(false)}
                disabled={savingClasses}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSaveClasses}
                disabled={savingClasses}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer active:scale-95 shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {savingClasses ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving Changes...
                  </>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
