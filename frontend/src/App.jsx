import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import ReceptionistView from './components/ReceptionistView'
import PatientWaitingView from './components/PatientWaitingView'
import { Stethoscope } from 'lucide-react'

function App() {
  const [queue, setQueue] = useState([])
  const [settings, setSettings] = useState({ current_serving_token: 0, initial_avg_consultation_time: 15, reset_at: null })
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    // Fetch Settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single()
      
    if (!settingsError && settingsData) {
      setSettings(settingsData)
    }

    // Fetch Queue
    const { data: queueData, error: queueError } = await supabase
      .from('queue')
      .select('*')
      .order('token_number', { ascending: true })
      
    if (!queueError && queueData) {
      setQueue(queueData)
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
        (payload) => {
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        (payload) => {
          if (payload.new && payload.new.id === 1) {
            setSettings(payload.new)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Calculate dynamic average consultation time
  const getCalculatedAvgTime = () => {
    const initialTime = settings?.initial_avg_consultation_time ?? 15
    if (!settings?.reset_at) return initialTime

    const resetTime = new Date(settings.reset_at)

    // Filter patients called after reset_at
    const calledPatients = queue
      .filter(q => q.called_at && new Date(q.called_at) >= resetTime)
      .sort((a, b) => new Date(a.called_at) - new Date(b.called_at))

    if (calledPatients.length < 2) {
      return initialTime
    }

    let totalMinutes = 0
    for (let i = 1; i < calledPatients.length; i++) {
      const diffMs = new Date(calledPatients[i].called_at) - new Date(calledPatients[i - 1].called_at)
      totalMinutes += diffMs / (1000 * 60)
    }

    const calculatedAvg = totalMinutes / (calledPatients.length - 1)
    // Round to nearest integer, minimum 1 min
    return Math.max(1, Math.round(calculatedAvg))
  }

  const calculatedAvgTime = getCalculatedAvgTime()

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
        {/* Receptionist View (Left Side) */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-700">Receptionist Dashboard</h2>
          </div>
          <div className="p-6 flex-1">
            <ReceptionistView 
              queue={queue} 
              settings={settings} 
              calculatedAvgTime={calculatedAvgTime} 
            />
          </div>
        </div>

        {/* Patient View (Right Side) */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
            <h2 className="text-lg font-semibold text-blue-800">Waiting Room</h2>
          </div>
          <div className="p-6 flex-1 bg-gradient-to-br from-white to-blue-50/50">
            <PatientWaitingView 
              queue={queue} 
              settings={settings} 
              calculatedAvgTime={calculatedAvgTime} 
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
