import React, { useState, useEffect, useRef } from 'react';
import { supabase, isPlaceholder } from './supabaseClient';
import { getClassesForChurch } from './constants';
import { Upload } from 'lucide-react';

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

export default function ClassesOverviewPage({ navigateToClass, currentChurch, setView }) {
  const [classData, setClassData] = useState({});
  const [loading, setLoading]     = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const today = getTodayStr();

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
          <div className="flex items-center gap-4">
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
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors disabled:opacity-50"
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
    </div>
  );
}
