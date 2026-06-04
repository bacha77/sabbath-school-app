import React, { useState, useEffect } from 'react'
import DashboardView from './DashboardView'
import RegisterForm from './RegisterForm'
import AttendancePage from './AttendancePage'
import ClassesOverviewPage from './ClassesOverviewPage'
import ClassDetailPage from './ClassDetailPage'
import LandingPage from './LandingPage'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'classes',   label: 'Classes'   },
  { id: 'register',  label: 'Register'  },
  { id: 'attendance',label: 'Attendance'},
]

function App() {
  const [currentChurch, setCurrentChurch] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [currentView, setCurrentView] = useState('dashboard')
  const [classDetailTarget, setClassDetailTarget] = useState(null)

  useEffect(() => {
    const savedChurch = sessionStorage.getItem('currentChurch')
    const savedUser = sessionStorage.getItem('currentUser')
    if (savedChurch) {
      setCurrentChurch(JSON.parse(savedChurch))
    }
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser))
    }
  }, [])

  const handleLogin = (church, user) => {
    setCurrentChurch(church)
    setCurrentUser(user)
    sessionStorage.setItem('currentChurch', JSON.stringify(church))
    sessionStorage.setItem('currentUser', JSON.stringify(user))
    if (user.role === 'teacher') {
      setCurrentView('attendance')
    }
  }

  const handleLogout = () => {
    setCurrentChurch(null)
    setCurrentUser(null)
    sessionStorage.removeItem('currentChurch')
    sessionStorage.removeItem('currentUser')
    setCurrentView('dashboard')
  }

  const navigateToClass = (className) => {
    setClassDetailTarget(className)
    setCurrentView('classDetail')
  }

  const handleNavClick = (viewId) => {
    setCurrentView(viewId)
    setClassDetailTarget(null)
  }

  const isTeacher = currentUser?.role === 'teacher'
  const activeNavId = currentView === 'classDetail' ? 'classes' : currentView

  if (!currentChurch || !currentUser) {
    return <LandingPage onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-mesh-gradient flex flex-col font-sans antialiased text-slate-800 selection:bg-indigo-100 selection:text-indigo-900">
      <header className="sticky top-0 z-40 w-full glass-panel border-b-0 print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div 
            className={`flex items-center gap-2.5 ${!isTeacher ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={() => { if (!isTeacher) handleNavClick('dashboard'); }}
            title={!isTeacher ? "Go to Dashboard" : ""}
          >
            {currentChurch.logo_url ? (
              <img src={currentChurch.logo_url} alt={`${currentChurch.name} Logo`} className="h-10 w-10 object-contain rounded-xl shadow-lg border border-white/10 bg-white" />
            ) : (
              <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center text-xl shadow-inner border border-indigo-200">
                ⛪
              </div>
            )}
            <div>
              <span className="font-bold text-slate-800 tracking-tight text-base leading-tight block uppercase">
                {currentChurch.name}
              </span>
              {isTeacher && (
                <span className="text-xs text-emerald-600 font-bold uppercase tracking-wider block">
                  Teacher: {currentUser.name}
                </span>
              )}
            </div>
          </div>

          {!isTeacher && (
            <nav className="flex space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeNavId === item.id
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button 
                onClick={handleLogout}
                className="px-3 sm:px-4 py-1.5 ml-2 rounded-lg text-[10px] sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap bg-slate-200 text-slate-700 hover:bg-rose-100 hover:text-rose-700"
                title="Logout"
              >
                Logout
              </button>
            </nav>
          )}
          {isTeacher && (
            <button onClick={handleLogout} className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-200 text-slate-700 hover:bg-rose-100 hover:text-rose-700">
              Logout
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {!isTeacher && currentView === 'dashboard' && <DashboardView navigateToClass={navigateToClass} currentChurch={currentChurch} />}
        {!isTeacher && currentView === 'classes' && <ClassesOverviewPage navigateToClass={navigateToClass} currentChurch={currentChurch} />}
        {!isTeacher && currentView === 'classDetail' && <ClassDetailPage className={classDetailTarget} onBack={() => handleNavClick('classes')} currentChurch={currentChurch} />}
        {!isTeacher && currentView === 'register' && <RegisterForm currentChurch={currentChurch} />}
        {currentView === 'attendance' && <AttendancePage currentChurch={currentChurch} currentUser={currentUser} />}
      </main>
    </div>
  )
}

export default App
