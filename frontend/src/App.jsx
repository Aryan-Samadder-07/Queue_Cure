import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import ReceptionistView from './components/ReceptionistView'
import DoctorDashboardView from './components/DoctorDashboardView'
import PatientWaitingView from './components/PatientWaitingView'
import { Stethoscope } from 'lucide-react'

function App() {
  const [queue, setQueue] = useState([])
  const [doctors, setDoctors] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPopupWarning, setShowPopupWarning] = useState(false)

  // Auto-dismiss the popup warning toast after 7 seconds
  useEffect(() => {
    if (showPopupWarning) {
      const timer = setTimeout(() => {
        setShowPopupWarning(false)
      }, 7000)
      return () => clearTimeout(timer)
    }
  }, [showPopupWarning])

  // Dev / Prod view mode state
  const [isDevView, setIsDevView] = useState(() => {
    const saved = localStorage.getItem('queue_cure_dev_view')
    return saved !== null ? JSON.parse(saved) : true
  })

  // Hash state for production individual page view routing
  const [currentHash, setCurrentHash] = useState(window.location.hash || '#receptionist')

  const fetchData = async () => {
    const { data: doctorsData, error: doctorsError } = await supabase
      .from('doctors')
      .select('*')
      .order('created_at', { ascending: true })
      
    if (!doctorsError && doctorsData) {
      setDoctors(doctorsData)
    }

    const { data: queueData, error: queueError } = await supabase
      .from('queue')
      .select('*')
      .order('slot_number', { ascending: true })
      
    if (!queueError && queueData) {
      setQueue(queueData)
    }

    const { data: sessionsData, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })

    if (!sessionsError && sessionsData) {
      setSessions(sessionsData)
    }
    
    setLoading(false)
  }

  useEffect(() => {
    fetchData()

    // Realtime subscriptions
    const channel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue' },
        () => {
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctors' },
        () => {
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => {
          fetchData()
        }
      )
      .subscribe()

    // Listen for hash changes
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '#receptionist')
    }
    window.addEventListener('hashchange', handleHashChange)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  // Persist view mode setting in local storage
  useEffect(() => {
    localStorage.setItem('queue_cure_dev_view', JSON.stringify(isDevView))
  }, [isDevView])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center text-blue-600 animate-pulse">
          <div className="w-16 h-16 mb-4 flex items-center justify-center">
            <img 
              src="/favicon.png" 
              alt="Queue Cure Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl font-bold">Loading Queue Cure...</h1>
        </div>
      </div>
    )
  }

  // Check if opened in standalone new window (for cropped view look)
  const isStandalone = window.location.search.includes('standalone=true')

  if (isStandalone) {
    if (currentHash === '#waiting') {
      return (
        <div className="h-screen w-screen bg-white font-sans animate-fade-in flex flex-col overflow-hidden">
          <PatientWaitingView 
            queue={queue} 
            doctors={doctors}
          />
        </div>
      )
    }

    if (currentHash === '#doctor') {
      return (
        <div className="h-screen w-screen bg-white font-sans animate-fade-in flex flex-col overflow-y-auto">
          <div className="bg-rose-50 px-6 py-4 border-b border-rose-100 flex-shrink-0">
            <h2 className="text-lg font-semibold text-rose-800">Doctor Dashboard</h2>
          </div>
          <div className="p-6 flex-1 min-h-0">
            <DoctorDashboardView 
              queue={queue} 
              doctors={doctors} 
              sessions={sessions}
            />
          </div>
        </div>
      )
    }

    // Default to Receptionist View
    return (
      <div className="h-screen w-screen bg-white font-sans animate-fade-in flex flex-col overflow-y-auto">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-700">Receptionist Dashboard</h2>
        </div>
        <div className="p-6 flex-1 min-h-0">
          <ReceptionistView 
            queue={queue} 
            doctors={doctors} 
            sessions={sessions}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Clinic App Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <img 
              src="/favicon.png" 
              alt="Queue Cure Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Queue Cure</h1>
        </div>

        {/* View Mode Switching Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Production Separate Tabs Selector */}
          {!isDevView && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <a
                href="#receptionist"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentHash === '#receptionist' || !['#doctor', '#waiting'].includes(currentHash)
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Receptionist
              </a>
              <a
                href="#doctor"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentHash === '#doctor'
                    ? 'bg-white text-rose-800 shadow-sm'
                    : 'text-slate-500 hover:text-rose-800'
                }`}
              >
                Doctor
              </a>
              <a
                href="#waiting"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentHash === '#waiting'
                    ? 'bg-white text-blue-800 shadow-sm'
                    : 'text-slate-500 hover:text-blue-800'
                }`}
              >
                Waiting Room
              </a>
            </div>
          )}

          {/* Toggle Switch */}
          <div className="flex items-center gap-2.5 sm:border-l sm:border-slate-200 sm:pl-4">
            <span className={`text-xs font-bold transition-colors ${isDevView ? 'text-blue-600' : 'text-slate-400'}`}>Dev View</span>
            <button
              onClick={() => setIsDevView(!isDevView)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none ${
                isDevView ? 'bg-blue-600' : 'bg-slate-300'
              }`}
              title={isDevView ? 'Switch to Production View (Separate Windows)' : 'Switch to Developer View (All-in-One)'}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                  isDevView ? 'translate-x-0' : 'translate-x-5'
                }`}
              />
            </button>
            <span className={`text-xs font-bold transition-colors ${!isDevView ? 'text-blue-600' : 'text-slate-400'}`}>Prod View</span>
          </div>
        </div>
      </header>
      
      {/* View Content Layout switcher */}
      {isDevView ? (
        /* Developer Mode (All views rendered on a single split-screen) */
        <main className="flex-1 p-6 flex flex-col lg:flex-row gap-6 max-w-screen-2xl mx-auto w-full">
          {/* Left Column: Receptionist Dashboard */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Receptionist View */}
            <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-700">Receptionist Dashboard</h2>
              </div>
              <div className="p-6">
                <ReceptionistView 
                  queue={queue} 
                  doctors={doctors} 
                  sessions={sessions}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Doctor Dashboard & Waiting Room */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Doctor Dashboard View */}
            <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-rose-50 px-6 py-4 border-b border-rose-100">
                <h2 className="text-lg font-semibold text-rose-800">Doctor Dashboard</h2>
              </div>
              <div className="p-6">
                <DoctorDashboardView 
                  queue={queue} 
                  doctors={doctors} 
                  sessions={sessions}
                />
              </div>
            </div>

            {/* Waiting Room */}
            <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <PatientWaitingView 
                queue={queue} 
                doctors={doctors}
              />
            </div>
          </div>
        </main>
      ) : (
        /* Production Mode (Only one individual view rendered based on URL hash routing) */
        <main className="flex-1 flex flex-col w-full h-full bg-white animate-fade-in min-h-0">
          {currentHash === '#doctor' ? (
            <div className="flex-1 flex flex-col overflow-y-auto">
              <div className="bg-rose-50 px-6 py-4 border-b border-rose-100 flex-shrink-0">
                <h2 className="text-lg font-semibold text-rose-800">Doctor Dashboard</h2>
              </div>
              <div className="p-6 flex-1 min-h-0">
                <DoctorDashboardView 
                  queue={queue} 
                  doctors={doctors} 
                  sessions={sessions}
                />
              </div>
            </div>
          ) : currentHash === '#waiting' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <PatientWaitingView 
                queue={queue} 
                doctors={doctors}
                onOpenNewWindow={() => {
                  const url = `${window.location.origin}${window.location.pathname}?standalone=true#waiting`;
                  const popup = window.open(
                    url, 
                    '_blank', 
                    'width=1000,height=800,menubar=no,toolbar=no,location=no,status=no'
                  );
                  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                    setShowPopupWarning(true);
                    // Fallback to opening in a new tab if popup blocker blocked it
                    window.open(url, '_blank');
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-y-auto">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex-shrink-0">
                <h2 className="text-lg font-semibold text-slate-700">Receptionist Dashboard</h2>
              </div>
              <div className="p-6 flex-1 min-h-0">
                <ReceptionistView 
                  queue={queue} 
                  doctors={doctors} 
                  sessions={sessions}
                />
              </div>
            </div>
          )}
        </main>
      )}

      {/* Popup Blocker Warning Toast */}
      {showPopupWarning && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-amber-50 border-l-4 border-amber-500 text-amber-900 p-4 rounded-r-xl shadow-lg flex items-start gap-3 animate-fade-in">
          <div className="flex-1">
            <h4 className="font-bold text-sm">Popup Blocker/Ad Blocker Detected</h4>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              We opened the Waiting Room in a new tab as a fallback. For the premium borderless window experience, please allow popups for this site.
            </p>
          </div>
          <button 
            onClick={() => setShowPopupWarning(false)}
            className="text-amber-500 hover:text-amber-800 text-xs font-bold px-1 focus:outline-none"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export default App
