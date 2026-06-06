import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { getClassesForChurch } from './constants';

export default function StudentDirectoryPage({ currentChurch }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editStudent, setEditStudent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isPlaceholder, setIsPlaceholder] = useState(false);

  const dynamicClasses = getClassesForChurch(currentChurch);

  useEffect(() => {
    fetchStudents();
  }, [currentChurch]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('church_id', currentChurch.id)
        .order('first_name', { ascending: true });

      if (error) {
        if (error.message.includes('fetch')) {
          setIsPlaceholder(true);
          const local = JSON.parse(localStorage.getItem('students') || '[]');
          setStudents(local.filter(s => s.church_id === currentChurch.id));
        } else {
          throw error;
        }
      } else {
        setStudents(data || []);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load students: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isPlaceholder) {
        let allStudents = JSON.parse(localStorage.getItem('students') || '[]');
        const idx = allStudents.findIndex(s => s.id === editStudent.id);
        if (idx !== -1) {
          allStudents[idx] = editStudent;
          localStorage.setItem('students', JSON.stringify(allStudents));
        }
      } else {
        const { error } = await supabase
          .from('students')
          .update({
            first_name: editStudent.first_name,
            last_name: editStudent.last_name,
            gender: editStudent.gender,
            phone: editStudent.phone,
            email: editStudent.email,
            address: editStudent.address,
            class_level: editStudent.class_level
          })
          .eq('id', editStudent.id);
        if (error) throw error;
      }
      setEditStudent(null);
      fetchStudents();
    } catch (err) {
      alert("Failed to update: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this student?")) return;
    try {
      if (isPlaceholder) {
        let allStudents = JSON.parse(localStorage.getItem('students') || '[]');
        allStudents = allStudents.filter(s => s.id !== id);
        localStorage.setItem('students', JSON.stringify(allStudents));
      } else {
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (error) throw error;
      }
      fetchStudents();
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  };

  const filteredStudents = students.filter(student => {
    const term = searchQuery.toLowerCase();
    return (
      student.first_name.toLowerCase().includes(term) ||
      student.last_name.toLowerCase().includes(term) ||
      student.class_level.toLowerCase().includes(term)
    );
  });

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased pb-32">
      <div className="mx-auto max-w-6xl">
        <div className="sm:flex sm:items-center sm:justify-between mb-8 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Student Directory
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage all enrolled students, update their profiles, or graduate them to a new class.
            </p>
          </div>
        </div>

        <div className="bg-white p-5 shadow-sm border border-slate-200 rounded-2xl mb-6">
          <input
            type="text"
            placeholder="Search by name or class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full max-w-md px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-10 text-center text-slate-500 animate-pulse">Loading directory...</div>
          ) : students.length === 0 ? (
            <div className="py-10 text-center text-slate-500">No students registered yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-xs">
                    <th className="py-4 px-6 font-semibold">Name</th>
                    <th className="py-4 px-6 font-semibold">Class Level</th>
                    <th className="py-4 px-6 font-semibold">Contact Info</th>
                    <th className="py-4 px-6 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-800">{student.first_name} {student.last_name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{student.gender}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg whitespace-nowrap">
                          {student.class_level}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-slate-600">{student.phone || 'No phone'}</div>
                        <div className="text-slate-400 text-xs mt-0.5">{student.email || 'No email'}</div>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                        <button onClick={() => setEditStudent(student)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(student.id)} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition-colors">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredStudents.length === 0 && (
                <div className="py-8 text-center text-slate-500">No matching students.</div>
              )}
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Edit Student</h3>
                <button onClick={() => setEditStudent(null)} className="text-slate-400 hover:text-slate-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <form onSubmit={handleUpdate}>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">First Name</label>
                      <input type="text" value={editStudent.first_name} onChange={e => setEditStudent({...editStudent, first_name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Last Name</label>
                      <input type="text" value={editStudent.last_name} onChange={e => setEditStudent({...editStudent, last_name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Class Level</label>
                    <select value={editStudent.class_level} onChange={e => setEditStudent({...editStudent, class_level: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white">
                      {dynamicClasses.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Gender</label>
                      <select value={editStudent.gender} onChange={e => setEditStudent({...editStudent, gender: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Phone</label>
                      <input type="tel" value={editStudent.phone} onChange={e => setEditStudent({...editStudent, phone: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email</label>
                    <input type="email" value={editStudent.email} onChange={e => setEditStudent({...editStudent, email: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Address</label>
                    <input type="text" value={editStudent.address} onChange={e => setEditStudent({...editStudent, address: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-xl" />
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button type="button" onClick={() => setEditStudent(null)} className="px-4 py-2 text-sm font-bold text-slate-600">Cancel</button>
                  <button type="submit" disabled={saving} className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-sm disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
