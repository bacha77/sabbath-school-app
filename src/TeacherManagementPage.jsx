import React, { useState, useEffect } from 'react';
import { supabase, isPlaceholder } from './supabaseClient';
import { getClassesForChurch } from './constants';

export default function TeacherManagementPage({ currentChurch }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  // Form states
  const [newTeacher, setNewTeacher] = useState({
    name: '',
    pin: '',
    assigned_class: getClassesForChurch(currentChurch)[0] || 'Class 1'
  });

  const fetchTeachers = async () => {
    setLoading(true);
    if (isPlaceholder) {
      const allTeachers = JSON.parse(localStorage.getItem('teachers') || '[]');
      setTeachers(allTeachers.filter(t => t.church_id === currentChurch.id));
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('church_id', currentChurch.id)
        .order('name');
      
      if (error) throw error;
      setTeachers(data || []);
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to load teachers.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, [currentChurch]);

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    setStatus({ type: 'idle', message: '' });

    if (newTeacher.pin.length < 4) {
      setStatus({ type: 'error', message: 'PIN must be at least 4 digits.' });
      return;
    }

    const teacherToAdd = {
      ...newTeacher,
      church_id: currentChurch.id,
      is_active: true
    };

    if (isPlaceholder) {
      const allTeachers = JSON.parse(localStorage.getItem('teachers') || '[]');
      teacherToAdd.id = Date.now().toString();
      allTeachers.push(teacherToAdd);
      localStorage.setItem('teachers', JSON.stringify(allTeachers));
      setNewTeacher({ name: '', pin: '', assigned_class: getClassesForChurch(currentChurch)[0] });
      fetchTeachers();
      setStatus({ type: 'success', message: 'Teacher added successfully.' });
      return;
    }

    try {
      const { error } = await supabase
        .from('teachers')
        .insert([teacherToAdd]);
      
      if (error) throw error;
      setNewTeacher({ name: '', pin: '', assigned_class: getClassesForChurch(currentChurch)[0] });
      fetchTeachers();
      setStatus({ type: 'success', message: 'Teacher added successfully.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleToggleActive = async (teacherId, currentActiveStatus) => {
    if (isPlaceholder) {
      const allTeachers = JSON.parse(localStorage.getItem('teachers') || '[]');
      const updated = allTeachers.map(t => t.id === teacherId ? { ...t, is_active: !currentActiveStatus } : t);
      localStorage.setItem('teachers', JSON.stringify(updated));
      fetchTeachers();
      return;
    }

    try {
      const { error } = await supabase
        .from('teachers')
        .update({ is_active: !currentActiveStatus })
        .eq('id', teacherId);
      
      if (error) throw error;
      fetchTeachers();
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to update status.' });
    }
  };

  const handleResetPin = async (teacherId) => {
    const newPin = prompt('Enter new PIN (at least 4 digits):');
    if (!newPin) return;
    if (newPin.length < 4) {
      alert('PIN must be at least 4 digits.');
      return;
    }

    if (isPlaceholder) {
      const allTeachers = JSON.parse(localStorage.getItem('teachers') || '[]');
      const updated = allTeachers.map(t => t.id === teacherId ? { ...t, pin: newPin } : t);
      localStorage.setItem('teachers', JSON.stringify(updated));
      fetchTeachers();
      setStatus({ type: 'success', message: 'PIN reset successfully.' });
      return;
    }

    try {
      const { error } = await supabase
        .from('teachers')
        .update({ pin: newPin })
        .eq('id', teacherId);
      
      if (error) throw error;
      fetchTeachers();
      setStatus({ type: 'success', message: 'PIN reset successfully.' });
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to reset PIN.' });
    }
  };

  const handleDeleteTeacher = async (teacherId) => {
    if (!window.confirm("Are you sure you want to permanently delete this teacher account? This action cannot be undone.")) return;
    
    if (isPlaceholder) {
      const allTeachers = JSON.parse(localStorage.getItem('teachers') || '[]');
      const updated = allTeachers.filter(t => t.id !== teacherId);
      localStorage.setItem('teachers', JSON.stringify(updated));
      fetchTeachers();
      setStatus({ type: 'success', message: 'Teacher deleted successfully.' });
      return;
    }

    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacherId);
      
      if (error) throw error;
      fetchTeachers();
      setStatus({ type: 'success', message: 'Teacher deleted successfully.' });
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to delete teacher account.' });
    }
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto font-sans antialiased">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Teacher Accounts</h1>
          <p className="text-sm text-slate-500 mt-1">Manage access for teachers at {currentChurch.name}</p>
        </div>
      </div>

      {status.message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-medium border ${status.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-100' : 'bg-emerald-50 text-emerald-800 border-emerald-100'}`}>
          {status.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 shadow-sm border border-slate-200 rounded-2xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Add New Teacher</h2>
            <form onSubmit={handleAddTeacher} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Name</label>
                <input 
                  type="text" 
                  required 
                  value={newTeacher.name}
                  onChange={e => setNewTeacher({...newTeacher, name: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  placeholder="e.g. Jane Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">PIN</label>
                <input 
                  type="password" 
                  required 
                  minLength={4}
                  value={newTeacher.pin}
                  onChange={e => setNewTeacher({...newTeacher, pin: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold tracking-[0.2em]"
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Assigned Class</label>
                <select 
                  value={newTeacher.assigned_class}
                  onChange={e => setNewTeacher({...newTeacher, assigned_class: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                >
                  {getClassesForChurch(currentChurch).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button 
                type="submit"
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all text-sm"
              >
                Add Teacher
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Account List</h2>
            </div>
            
            {loading ? (
              <div className="p-8 text-center text-slate-500">Loading accounts...</div>
            ) : teachers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No teachers found. Add one on the left.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {teachers.map(teacher => (
                  <li key={teacher.id} className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">{teacher.name}</h3>
                        {teacher.is_active !== false ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider">Active</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 uppercase tracking-wider">Disabled</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-1">Class: <span className="font-medium text-slate-700">{teacher.assigned_class}</span></p>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => handleResetPin(teacher.id)}
                        className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors active:scale-95 cursor-pointer"
                      >
                        Reset PIN
                      </button>
                      <button 
                        onClick={() => handleToggleActive(teacher.id, teacher.is_active !== false)}
                        className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors active:scale-95 cursor-pointer ${
                          teacher.is_active !== false 
                            ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        {teacher.is_active !== false ? 'Disable' : 'Reactivate'}
                      </button>
                      <button 
                        onClick={() => handleDeleteTeacher(teacher.id)}
                        className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors active:scale-95 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
