import React, { useState } from 'react';
import { supabase, isPlaceholder } from './supabaseClient';
import { getClassesForChurch } from './constants';


export default function RegisterForm({ currentChurch }) {
  // Form State
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birth_month: '',
    birth_day: '',
    email: '',
    phone: '',
    class_level: ''
  });

  // UI Status State
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  // Handle Input Changes & Apply Phone Format Mask
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      // Basic phone format mask: clean non-digits and limit length
      const cleaned = value.replace(/\D/g, '').slice(0, 10);
      let formatted = cleaned;
      if (cleaned.length > 3 && cleaned.length <= 6) {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
      } else if (cleaned.length > 6) {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }
      setFormData(prev => ({ ...prev, [name]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Submit Logic
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: 'loading', message: 'Submitting registration...' });

    // Validate that a class level was selected
    if (!formData.class_level) {
      setStatus({ type: 'error', message: 'Please select an educational class level.' });
      return;
    }

    // Demo Mode fallback using LocalStorage if Supabase configuration is placeholder
    if (isPlaceholder) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate network latency
        
        const existingStudents = JSON.parse(localStorage.getItem('students') || '[]');
        const newStudent = {
          id: Date.now(),
          church_id: currentChurch?.id,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          birthdate: `2000-${formData.birth_month}-${formData.birth_day}`,
          email: formData.email.trim(),
          phone: formData.phone,
          class_level: formData.class_level,
          created_at: new Date().toISOString()
        };
        existingStudents.push(newStudent);
        localStorage.setItem('students', JSON.stringify(existingStudents));

        setStatus({ 
          type: 'success', 
          message: 'Registration submitted successfully (Saved in Local Storage Demo Mode)!' 
        });
        setFormData({
          first_name: '',
          last_name: '',
          birth_month: '',
          birth_day: '',
          email: '',
          phone: '',
          class_level: ''
        });
      } catch (err) {
        setStatus({ type: 'error', message: 'Failed to write to LocalStorage.' });
      }
      return;
    }

    // Real Supabase write
    try {
      const { error } = await supabase
        .from('students')
        .insert([
          {
            church_id: currentChurch.id,
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            birthdate: `2000-${formData.birth_month}-${formData.birth_day}`,
            email: formData.email.trim(),
            phone: formData.phone,
            class_level: formData.class_level
          }
        ]);

      if (error) throw error;

      // Reset state on successful database write
      setStatus({ type: 'success', message: 'Registration submitted successfully to Supabase!' });
      setFormData({
        first_name: '',
        last_name: '',
        birth_month: '',
        birth_day: '',
        email: '',
        phone: '',
        class_level: ''
      });

    } catch (err) {
      console.error(err);
      setStatus({ 
        type: 'error', 
        message: err.message || 'An error occurred while connecting to the database server.' 
      });
    }
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased flex flex-col items-center">
      <div className="sm:mx-auto w-full max-w-md">
        {/* App Mini Icon Banner */}
        <div className="mx-auto h-24 w-24 rounded-2xl flex items-center justify-center bg-white shadow-xl border border-slate-100 overflow-hidden">
          <img src="/logo.png" alt="Philadelphie Logo" className="h-full w-full object-cover" />
        </div>
        <h1 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">
          Student Registration
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Please fill out the student details below to reserve a placement tier.
        </p>
        <div className="mt-4 flex justify-center">
        </div>
      </div>

      <div className="mt-8 sm:mx-auto w-full max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          
          {/* Form UI Alerts banner block */}
          {status.type !== 'idle' && status.type !== 'loading' && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-medium border ${
              status.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                : 'bg-rose-50 text-rose-800 border-rose-100'
            }`}>
              {status.type === 'success' ? '✅ ' : '❌ '} {status.message}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* First Name Field */}
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-slate-700">
                First Name
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                required
                value={formData.first_name}
                onChange={handleChange}
                placeholder="John"
                className="mt-1 block w-full px-3 py-2.5 border border-slate-300 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Last Name Field */}
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-slate-700">
                Last Name
              </label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                required
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Doe"
                className="mt-1 block w-full px-3 py-2.5 border border-slate-300 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Birthdate Field (Month & Day only) */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Birthdate
              </label>
              <div className="mt-1 flex gap-3">
                <select
                  name="birth_month"
                  required
                  value={formData.birth_month}
                  onChange={handleChange}
                  className="block w-full px-3 py-2.5 border border-slate-300 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="" disabled>Month</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, '0');
                    const label = new Date(2000, i, 1).toLocaleString('default', { month: 'long' });
                    return <option key={m} value={m}>{label}</option>;
                  })}
                </select>
                <select
                  name="birth_day"
                  required
                  value={formData.birth_day}
                  onChange={handleChange}
                  className="block w-full px-3 py-2.5 border border-slate-300 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="" disabled>Day</option>
                  {Array.from({ length: 31 }, (_, i) => {
                    const d = String(i + 1).padStart(2, '0');
                    return <option key={d} value={d}>{d}</option>;
                  })}
                </select>
              </div>
            </div>

            {/* Phone Contact Field */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                Contact Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="(614) 555-0100"
                className="mt-1 block w-full px-3 py-2.5 border border-slate-300 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Email Field (Optional) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email Address <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="student@example.com"
                className="mt-1 block w-full px-3 py-2.5 border border-slate-300 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Class Level Radio Selector Segment */}
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                Class Level Selection
              </span>
              <div className="space-y-2">
                {getClassesForChurch(currentChurch).map((option) => (
                  <label 
                    key={option}
                    className={`flex items-center justify-between px-4 py-3 border rounded-xl cursor-pointer text-sm font-medium transition-all ${
                      formData.class_level === option
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{option}</span>
                    <input
                      type="radio"
                      name="class_level"
                      value={option}
                      checked={formData.class_level === option}
                      onChange={handleChange}
                      className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Interactive Submission Call-to-Action */}
            <button
              type="submit"
              disabled={status.type === 'loading'}
              className="w-full mt-2 flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {status.type === 'loading' ? 'Processing Transaction...' : 'Complete Registration'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
