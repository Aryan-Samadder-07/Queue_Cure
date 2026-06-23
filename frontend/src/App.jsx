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

  const fetchData = async () => {
    // 1. Fetch Doctors (replaces settings)
    const { data: doctorsData, error: doctorsError } = await supabase
      .from('doctors')
      .select('*')
      .order('created_at', { ascending: true })
      
    if (!doctorsError && doctorsData) {
      setDoctors(doctorsData)
    }

    // 2. Fetch Queue
    const { data: queueData, error: queueError } = await supabase
      .from('queue')
      .select('*')
      .order('slot_number', { ascending: true })
      
    if (!queueError && queueData) {
      setQueue(queueData)
    }

    // 3. Fetch Sessions
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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center text-blue-600 animate-pulse">
          <Stethoscope size={48} className="mb-4" />
          <h1 className="text-xl font-bold">Loading Queue Cure...</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg text-white">
          <Stethoscope size={24} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Queue Cure</h1>
      </header>
      
      <main className="flex-1 p-6 flex flex-col lg:flex-row gap-6 max-w-screen-2xl mx-auto w-full">
        {/* Left Side: Receptionist & Doctor Dashboards */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Receptionist View (Left Top) */}
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

          {/* Doctor Dashboard View (Left Bottom) */}
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
        </div>

        {/* Patient View (Right Side) */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <PatientWaitingView 
            queue={queue} 
            doctors={doctors}
          />
        </div>
      </main>
    </div>
  )
}

export default App
