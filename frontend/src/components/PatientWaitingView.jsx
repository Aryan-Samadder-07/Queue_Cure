import { Clock, Users } from 'lucide-react'

export default function PatientWaitingView({ queue, settings, calculatedAvgTime }) {
  const currentServingToken = settings?.current_serving_token || 0

  // Filter only waiting patients and sort by token number
  const waitingPatients = queue
    .filter(q => q.status === 'waiting')
    .sort((a, b) => a.token_number - b.token_number)

  const nextPatients = waitingPatients.slice(0, 3)

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Now Serving Card */}
      <div className="bg-white rounded-2xl p-8 shadow-md border-2 border-blue-200 flex flex-col items-center justify-center relative overflow-hidden group">
        <div className="absolute inset-0 bg-blue-500 opacity-5 group-hover:opacity-10 transition-opacity"></div>
        <h3 className="text-xl font-bold text-blue-800 mb-2 uppercase tracking-wider">
          Now Serving Token : {currentServingToken === 0 ? '--' : currentServingToken}
        </h3>
        <div className="text-4xl font-extrabold text-blue-600 my-4 drop-shadow-sm">
          {queue.find(q => q.status === 'in-consultation')?.patient_name || '--'}
        </div>
        
        {/* Find who is currently in consultation */}
        {queue.find(q => q.status === 'in-consultation') && (
          <div className="mt-2 text-blue-700 font-medium bg-blue-100 px-4 py-1 rounded-full text-sm">
            Please proceed to the doctor's cabin
          </div>
        )}
      </div>

      {/* Upcoming List */}
      <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-slate-200/60">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Upcoming Patients
          </h3>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
            Next {nextPatients.length}
          </span>
        </div>

        {nextPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <Clock className="w-10 h-10 mb-3 opacity-20" />
            <p>No patients in the waiting queue.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {nextPatients.map((patient, index) => {
              // Dynamic Wait Time Calculator using calculatedAvgTime
              const waitTokens = patient.token_number - currentServingToken
              const estimatedWaitTime = Math.max(0, waitTokens * calculatedAvgTime)
              
              return (
                <div 
                  key={patient.id} 
                  className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold text-xl">
                      {patient.token_number}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 text-lg">{patient.patient_name}</div>
                      <div className="text-xs text-slate-500 font-medium">Position: {index + 1}</div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-500 mb-1">Est. Wait</div>
                    <div className="text-lg font-bold text-orange-500 flex items-center justify-end gap-1">
                      <Clock className="w-4 h-4" />
                      {estimatedWaitTime} min
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      
      {/* Footer Info */}
      <div className="text-center text-slate-400 text-xs font-medium px-4 py-2 bg-white rounded-lg border border-slate-100 shadow-sm">
        Wait times are estimates based on auto-calculated average consultation time of {calculatedAvgTime} mins.
      </div>
    </div>
  )
}
