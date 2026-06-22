import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { PlusCircle, Play, Settings2, Users, RefreshCw } from 'lucide-react'

export default function ReceptionistView({ queue, settings, calculatedAvgTime }) {
  const [patientName, setPatientName] = useState('')
  const [addingPatient, setAddingPatient] = useState(false)
  const [callingNext, setCallingNext] = useState(false)
  const [updatingSettings, setUpdatingSettings] = useState(false)
  const [initialTimeInput, setInitialTimeInput] = useState(settings?.initial_avg_consultation_time || 15)
  const [error, setError] = useState(null)

  const waitingPatients = queue.filter(q => q.status === 'waiting')
  const hasWaitingPatients = waitingPatients.length > 0

  const handleAddPatient = async (e) => {
    e.preventDefault()
    if (!patientName.trim()) {
      setError("Patient name cannot be empty.")
      return
    }
    
    setError(null)
    setAddingPatient(true)
    
    try {
      const { error: insertError } = await supabase
        .from('queue')
        .insert([{ patient_name: patientName.trim(), status: 'waiting' }])
        
      if (insertError) throw insertError
      setPatientName('')
    } catch (err) {
      console.error(err)
      setError("Failed to add patient.")
    } finally {
      setAddingPatient(false)
    }
  }

  const handleCallNext = async () => {
    if (!hasWaitingPatients) return
    
    setError(null)
    setCallingNext(true)
    
    try {
      const { error: rpcError } = await supabase.rpc('call_next_patient')
      if (rpcError) throw rpcError
    } catch (err) {
      console.error(err)
      setError("Failed to call next patient.")
    } finally {
      setCallingNext(false)
    }
  }

  const handleResetSettings = async (e) => {
    e.preventDefault()
    if (!initialTimeInput || initialTimeInput <= 0) {
      setError("Initial time must be greater than 0.")
      return
    }

    setError(null)
    setUpdatingSettings(true)

    try {
      const { error: updateError } = await supabase
        .from('settings')
        .update({ 
          initial_avg_consultation_time: parseInt(initialTimeInput, 10),
          reset_at: new Date().toISOString()
        })
        .eq('id', 1)

      if (updateError) throw updateError
    } catch (err) {
      console.error(err)
      setError("Failed to reset settings.")
    } finally {
      setUpdatingSettings(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 h-full">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Main Action: Call Next */}
      <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-xl">
        <Users className="w-12 h-12 text-slate-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">Queue Controls</h3>
        <p className="text-slate-500 mb-6 text-sm text-center">
          {hasWaitingPatients 
            ? `${waitingPatients.length} patient(s) waiting in queue.`
            : "No patients currently waiting."}
        </p>
        
        <button
          onClick={handleCallNext}
          disabled={!hasWaitingPatients || callingNext}
          className={`flex items-center gap-2 px-8 py-4 rounded-full text-lg font-bold transition-all shadow-sm
            ${!hasWaitingPatients || callingNext
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 hover:shadow-md hover:scale-[1.02] active:scale-95 text-white'
            }`}
        >
          {callingNext ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Play className="w-6 h-6 fill-current" />
          )}
          {callingNext ? 'Calling...' : 'Call Next Patient'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add Patient Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-500" />
            Add Patient
          </h3>
          <form onSubmit={handleAddPatient} className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Patient Name</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                disabled={addingPatient}
              />
            </div>
            <button
              type="submit"
              disabled={addingPatient || !patientName.trim()}
              className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center h-10"
            >
              {addingPatient ? 'Generating Token...' : 'Generate Token'}
            </button>
          </form>
        </div>

        {/* Settings Modifier */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-purple-500" />
              Consultation Time Settings
            </h3>
            <form onSubmit={handleResetSettings} className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Initial / Reset Avg. Time (min)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={initialTimeInput}
                    onChange={(e) => setInitialTimeInput(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    disabled={updatingSettings}
                  />
                  <button
                    type="submit"
                    disabled={updatingSettings}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-10 whitespace-nowrap flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset
                  </button>
                </div>
              </div>
            </form>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-sm">
            <span className="text-slate-500 font-medium">Current Auto-Avg:</span>
            <span className="text-purple-600 font-bold bg-purple-50 px-3 py-1 rounded-full text-base">
              {calculatedAvgTime} min
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
