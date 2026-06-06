import React, { useState } from 'react';
import { supabase, isPlaceholder } from './supabaseClient';

export default function LandingPage({ onLogin }) {
  const [view, setView] = useState('landing'); // 'landing', 'login', 'register', 'recover'
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    adminPin: '',
    email: '',
    logoUrl: '',
    denomination: 'Adventist'
  });
  const [loginName, setLoginName] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [newPin, setNewPin] = useState('');
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [loading, setLoading] = useState(false);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');
        setFormData({ ...formData, logoUrl: dataUrl });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: 'idle', message: '' });

    if (formData.adminPin.length < 4) {
      setStatus({ type: 'error', message: 'PIN must be at least 4 digits.' });
      setLoading(false);
      return;
    }

    try {
      if (isPlaceholder) {
        // Local Storage Demo
        const churches = JSON.parse(localStorage.getItem('churches') || '[]');
        const newChurch = {
          id: `local-church-${Date.now()}`,
          name: formData.name,
          address: formData.address,
          email: formData.email,
          admin_pin: formData.adminPin,
          logo_url: formData.logoUrl || null,
          denomination: formData.denomination
        };
        churches.push(newChurch);
        localStorage.setItem('churches', JSON.stringify(churches));
        onLogin(newChurch);
      } else {
        // Supabase Insert
        const { data, error } = await supabase
          .from('churches')
          .insert([{
            name: formData.name,
            address: formData.address,
            email: formData.email,
            admin_pin: formData.adminPin,
            logo_url: formData.logoUrl || null,
            denomination: formData.denomination
          }])
          .select()
          .single();

        if (error) throw error;
        onLogin(data);
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to register church.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: 'idle', message: '' });

    if (!loginName.trim()) {
      setStatus({ type: 'error', message: 'Please enter your Church Name.' });
      setLoading(false);
      return;
    }

    try {
      if (isPlaceholder) {
        // Handle Philadelphie hardcoded PIN check for demo
        if (loginPin === '43224' && loginName.toLowerCase().includes('philadelphie')) {
          onLogin({
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Philadelphie Sabbath School',
            address: '2169 FERRIS RD COLUMBUS OH 43224',
            admin_pin: '43224'
          }, { role: 'admin' });
          return;
        }

        const churches = JSON.parse(localStorage.getItem('churches') || '[]');
        const church = churches.find(c => c.name.toLowerCase() === loginName.toLowerCase().trim());
        
        if (!church) {
          throw new Error('Church not found.');
        }

        if (church.admin_pin === loginPin) {
          onLogin(church, { role: 'admin' });
        } else {
          // Check local teachers
          const teachers = JSON.parse(localStorage.getItem('teachers') || '[]');
          const teacher = teachers.find(t => t.church_id === church.id && t.pin === loginPin);
          if (teacher) {
            if (teacher.is_active === false) {
              throw new Error('Your account has been disabled by the admin.');
            }
            onLogin(church, { role: 'teacher', ...teacher });
          } else {
            throw new Error('Invalid PIN.');
          }
        }
      } else {
        // Step 1: Find Church by Name
        let query = supabase.from('churches').select('*');
        // Search by exact name (case-insensitive) or partial if it contains wildcards
        query = query.ilike('name', `%${loginName.trim()}%`);

        const { data: church, error: churchError } = await query.limit(1).maybeSingle();

        if (churchError) throw churchError;
        
        if (!church) {
          // Fallback if church not found in DB
          if (loginPin === '43224' && loginName.toLowerCase().includes('philadelphie')) {
            onLogin({
              id: '11111111-1111-1111-1111-111111111111',
              name: 'Philadelphie Sabbath School',
              address: '2169 FERRIS RD COLUMBUS OH 43224',
              admin_pin: '43224',
              denomination: 'Adventist'
            }, { role: 'admin' });
            return;
          }
          throw new Error('No church found with that Name.');
        }

        // Step 2: Check Admin PIN
        if (church.admin_pin === loginPin) {
          onLogin(church, { role: 'admin' });
          return;
        }

        // Step 3: Check Teacher PIN
        const { data: teacher, error: teacherError } = await supabase
          .from('teachers')
          .select('*')
          .eq('church_id', church.id)
          .eq('pin', loginPin)
          .limit(1)
          .maybeSingle();

        if (teacherError) throw teacherError;
        
        if (teacher) {
          if (teacher.is_active === false) {
            throw new Error('Your account has been disabled by the admin.');
          }
          onLogin(church, { role: 'teacher', ...teacher });
          return;
        }

        // Fallback for demo hardcoded if PIN check failed
        if (loginPin === '43224' && loginName.toLowerCase().includes('philadelphie')) {
            onLogin({
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Philadelphie Sabbath School',
            address: '2169 FERRIS RD COLUMBUS OH 43224',
            admin_pin: '43224',
            denomination: 'Adventist'
          }, { role: 'admin' });
          return;
        }

        throw new Error('Invalid PIN.');
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to login.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: 'idle', message: '' });
    try {
      const { data, error } = await supabase
        .from('churches')
        .update({ admin_pin: newPin })
        .eq('name', loginName.trim())
        .eq('email', recoveryEmail.trim())
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Church name or email not found.');
      setStatus({ type: 'success', message: 'PIN updated successfully! Please login.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-mesh-gradient flex flex-col items-center justify-center font-sans antialiased text-slate-800 p-4">
        <div className="glass-panel p-8 sm:p-12 rounded-[2rem] w-full max-w-sm text-center shadow-2xl border border-white/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <button onClick={() => setView('landing')} className="absolute top-6 left-6 text-slate-400 hover:text-slate-700">
            &larr; Back
          </button>
          <div className="relative z-10 mt-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-2 uppercase">Church Login</h1>
            <p className="text-sm text-slate-500 mb-8">Enter your Church Name and Admin PIN.</p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input 
                  type="text" 
                  value={loginName}
                  onChange={e => setLoginName(e.target.value)}
                  className={`w-full text-center text-lg font-semibold py-4 px-4 bg-white/80 border ${status.type === 'error' ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:ring-indigo-500'} rounded-xl focus:outline-none focus:ring-2 transition-all`}
                  placeholder="Church Name"
                  required
                  autoFocus
                />
              </div>
              <div>
                <input 
                  type="password" 
                  value={loginPin}
                  onChange={e => setLoginPin(e.target.value)}
                  className={`w-full text-center tracking-[0.5em] text-2xl font-bold py-4 px-4 bg-white/80 border ${status.type === 'error' ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:ring-indigo-500'} rounded-xl focus:outline-none focus:ring-2 transition-all`}
                  placeholder="PIN"
                  required
                />
                {status.type === 'error' && <p className="text-xs text-rose-500 font-bold mt-2 animate-bounce">{status.message}</p>}
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-4 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <div className="flex justify-between items-center px-1 pt-2">
                <button 
                  type="button" 
                  onClick={() => {setView('recover'); setStatus({type: 'idle', message: ''})}} 
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Forgot PIN?
                </button>
                <button 
                  type="button" 
                  onClick={() => setView('register')} 
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Register New Church &rarr;
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'recover') {
    return (
      <div className="min-h-screen bg-mesh-gradient flex flex-col items-center justify-center font-sans antialiased text-slate-800 p-4">
        <div className="glass-panel p-8 sm:p-12 rounded-[2rem] w-full max-w-sm text-center shadow-2xl border border-white/50 relative overflow-hidden">
          <div className="relative z-10 mt-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-2 uppercase">Recover PIN</h1>
            <p className="text-sm text-slate-500 mb-8">Enter your Church Name and Email to reset your Admin PIN.</p>
            
            <form onSubmit={handleRecover} className="space-y-4">
              <div>
                <input 
                  type="text" 
                  value={loginName}
                  onChange={e => setLoginName(e.target.value)}
                  className="w-full text-center text-lg font-semibold py-4 px-4 bg-white/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Church Name"
                  required
                />
              </div>
              <div>
                <input 
                  type="email" 
                  value={recoveryEmail}
                  onChange={e => setRecoveryEmail(e.target.value)}
                  className="w-full text-center text-lg font-semibold py-4 px-4 bg-white/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Admin Email"
                  required
                />
              </div>
              <div>
                <input 
                  type="password" 
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  className="w-full text-center tracking-[0.5em] text-2xl font-bold py-4 px-4 bg-white/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="New PIN"
                  required
                />
              </div>
              
              {status.message && (
                <p className={`text-xs font-bold mt-2 ${status.type === 'success' ? 'text-emerald-500' : 'text-rose-500 animate-bounce'}`}>
                  {status.message}
                </p>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition-colors shadow-md disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Reset PIN'}
              </button>
              
              <div className="text-center mt-2">
                <button 
                  type="button" 
                  onClick={() => { setView('login'); setStatus({ type: 'idle', message: '' }); }} 
                  className="text-sm text-slate-500 hover:text-slate-700 font-medium"
                >
                  &larr; Back to Login
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'register') {
    return (
      <div className="min-h-screen bg-mesh-gradient flex flex-col items-center justify-center font-sans antialiased text-slate-800 p-4 py-12">
        <div className="glass-panel p-8 sm:p-10 rounded-[2rem] w-full max-w-md shadow-2xl border border-white/50 relative overflow-hidden">
          <button onClick={() => setView('landing')} className="absolute top-6 left-6 text-slate-400 hover:text-slate-700">
            &larr; Back
          </button>
          
          <div className="mt-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-2">Register Your Church</h1>
            <p className="text-sm text-slate-500 mb-8">Create your own secure Sabbath School management workspace.</p>

            {status.type !== 'idle' && (
              <div className={`mb-6 p-4 rounded-xl text-sm font-medium border ${status.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-100' : 'bg-emerald-50 text-emerald-800 border-emerald-100'}`}>
                {status.message}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Church Name</label>
                <input 
                  type="text" 
                  required 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-white/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Philadelphie SDA"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Email (For PIN Recovery)</label>
                <input 
                  type="email" 
                  required 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 bg-white/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="admin@church.org"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Address / Location</label>
                <input 
                  type="text" 
                  required 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full px-4 py-3 bg-white/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. 2169 Ferris Rd"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Church Logo (Optional)</label>
                <div className="flex items-center gap-4 bg-white/80 p-3 rounded-xl border border-slate-200">
                  {formData.logoUrl ? (
                    <div className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 overflow-hidden bg-white flex items-center justify-center relative group">
                      <img src={formData.logoUrl} alt="Logo Preview" className="h-full w-full object-contain" />
                      <button type="button" onClick={() => setFormData({...formData, logoUrl: ''})} className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold transition-opacity cursor-pointer">Remove</button>
                    </div>
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 text-2xl">
                      ⛪
                    </div>
                  )}
                  <div className="flex-1">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Upload an image file (PNG/JPG).</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Denomination / Church Type</label>
                <select 
                  value={formData.denomination}
                  onChange={e => setFormData({...formData, denomination: e.target.value})}
                  className="w-full px-4 py-3 bg-white/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                >
                  <option value="Adventist">Adventist (Sabbath School)</option>
                  <option value="Other">Other (Sunday School)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Master Admin PIN</label>
                <input 
                  type="password" 
                  required 
                  minLength={4}
                  value={formData.adminPin}
                  onChange={e => setFormData({...formData, adminPin: e.target.value})}
                  className="w-full px-4 py-3 bg-white/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none tracking-[0.5em] font-bold"
                  placeholder="••••"
                />
                <p className="text-[10px] text-slate-500 mt-1">This PIN will be required for teachers to access your dashboard.</p>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-4 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                {loading ? 'Creating Workspace...' : 'Create Church Workspace'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // default 'landing'
  return (
    <div className="min-h-screen bg-mesh-gradient flex flex-col font-sans antialiased text-slate-800">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="glass-panel p-10 sm:p-16 rounded-[2.5rem] w-full max-w-3xl text-center shadow-2xl border border-white/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 uppercase">
              Church School <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">Manager</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 mb-12 max-w-2xl mx-auto font-medium">
              The modern, beautiful way to take attendance, track collections, and manage your Sabbath or Sunday School.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => setView('login')}
                className="px-8 py-4 bg-white text-indigo-600 border-2 border-indigo-100 hover:border-indigo-200 font-bold rounded-2xl shadow-sm hover:shadow-md transition-all text-lg"
              >
                Login to Your Church
              </button>
              <button 
                onClick={() => setView('register')}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all text-lg"
              >
                Register New Church
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
