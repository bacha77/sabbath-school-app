import React, { useState, useEffect } from 'react'
import DashboardView from './DashboardView'
import RegisterForm from './RegisterForm'
import AttendancePage from './AttendancePage'
import ClassesOverviewPage from './ClassesOverviewPage'
import ClassDetailPage from './ClassDetailPage'
import StudentDirectoryPage from './StudentDirectoryPage'
import LandingPage from './LandingPage'
import TeacherManagementPage from './TeacherManagementPage'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'classes',   label: 'Classes'   },
  { id: 'directory', label: 'Directory' },
  { id: 'register',  label: 'Register'  },
  { id: 'attendance',label: 'Attendance'},
  { id: 'teachers',  label: 'Accounts'  },
]

function App() {
  const [currentChurch, setCurrentChurch] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [currentView, setCurrentView] = useState('dashboard')
  const [classDetailTarget, setClassDetailTarget] = useState(null)

  useEffect(() => {
    try {
      const savedChurch = sessionStorage.getItem('currentChurch')
      if (savedChurch && savedChurch !== 'undefined' && savedChurch !== 'null') {
        setCurrentChurch(JSON.parse(savedChurch))
      }
    } catch (e) {
      console.error("Failed to restore church session:", e)
      sessionStorage.removeItem('currentChurch')
    }

    try {
      const savedUser = sessionStorage.getItem('currentUser')
      if (savedUser && savedUser !== 'undefined' && savedUser !== 'null') {
        const user = JSON.parse(savedUser)
        if (user && typeof user === 'object') {
          setCurrentUser(user)
          if (user.role === 'teacher') {
            setCurrentView('dashboard')
          }
        } else {
          sessionStorage.removeItem('currentUser')
        }
      }
    } catch (e) {
      console.error("Failed to restore user session:", e)
      sessionStorage.removeItem('currentUser')
    }
  }, [])

  const handleLogin = (church, user) => {
    const activeUser = user || { role: 'admin' }
    setCurrentChurch(church)
    setCurrentUser(activeUser)
    sessionStorage.setItem('currentChurch', JSON.stringify(church))
    sessionStorage.setItem('currentUser', JSON.stringify(activeUser))
    if (activeUser.role === 'teacher') {
      setCurrentView('dashboard')
    }
  }

  const handleLogout = () => {
    setCurrentChurch(null)
    setCurrentUser(null)
    sessionStorage.removeItem('currentChurch')
    sessionStorage.removeItem('currentUser')
    setCurrentView('dashboard')
  }

  const handleChurchUpdate = (updatedChurch) => {
    setCurrentChurch(updatedChurch)
    sessionStorage.setItem('currentChurch', JSON.stringify(updatedChurch))
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
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => handleNavClick('dashboard')}
            title="Go to Dashboard"
          >
            {currentChurch.logo_url ? (
              <img src={currentChurch.logo_url.startsWith('/') ? `${import.meta.env.BASE_URL}${currentChurch.logo_url.replace(/^\//, '')}` : currentChurch.logo_url} alt={`${currentChurch.name} Logo`} className="h-10 w-10 object-contain rounded-xl shadow-lg border border-white/10 bg-white" />
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

          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50 overflow-x-auto max-w-[55vw] sm:max-w-none scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
            {(isTeacher 
              ? [ { id: 'dashboard', label: 'Dashboard' }, { id: 'attendance', label: 'Attendance' } ]
              : NAV_ITEMS
            ).map(item => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-[0.96] ${
                  activeNavId === item.id
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button 
              onClick={handleLogout}
              className="px-3 sm:px-4 py-1.5 ml-2 rounded-lg text-[10px] sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap bg-slate-200 text-slate-700 hover:bg-rose-100 hover:text-rose-700 active:scale-[0.96]"
              title="Logout"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {currentView === 'dashboard' && <DashboardView navigateToClass={navigateToClass} currentChurch={currentChurch} onNavigate={handleNavClick} currentUser={currentUser} />}
        {!isTeacher && currentView === 'classes' && <ClassesOverviewPage navigateToClass={navigateToClass} currentChurch={currentChurch} onChurchUpdate={handleChurchUpdate} setView={handleNavClick} />}
        {!isTeacher && currentView === 'classDetail' && <ClassDetailPage className={classDetailTarget} onBack={() => handleNavClick('classes')} currentChurch={currentChurch} />}
        {!isTeacher && currentView === 'directory' && <StudentDirectoryPage currentChurch={currentChurch} />}
        {!isTeacher && currentView === 'register' && <RegisterForm currentChurch={currentChurch} />}
        {!isTeacher && currentView === 'teachers' && <TeacherManagementPage currentChurch={currentChurch} />}
        {currentView === 'attendance' && <AttendancePage currentChurch={currentChurch} currentUser={currentUser} />}
      </main>
    </div>
  )
}

export default App
