import { useState } from "react";
import { supabase } from "../lib/supabase";
import {
  PlusCircle,
  Settings2,
  RefreshCw,
  Calendar,
  Ban,
  Search,
  UserCheck,
  Download,
} from "lucide-react";
export default function ReceptionistView({ queue, doctors, sessions }) {
  const [patientName, setPatientName] = useState("");
  const [prescriptionNumber, setPrescriptionNumber] = useState("");
  const [addingPatient, setAddingPatient] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [initialTimeInput, setInitialTimeInput] = useState(15);
  const [error, setError] = useState(null);

  // Search and selection of doctor
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [lastAddedToken, setLastAddedToken] = useState(null);
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);
  const doctorQueue = queue.filter((q) => q.doctor_id === selectedDoctorId);
  const lastTokenInQueue = doctorQueue.length > 0
    ? doctorQueue.sort((a, b) => b.slot_number - a.slot_number)[0].token_string
    : null;
  const acceptingPatients = selectedDoctor
    ? selectedDoctor.accepting_patients
    : true;
  // Filter doctors based on name/department search query
  const filteredDoctors = doctors.filter(
    (d) =>
      d.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.department.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  // Calculate dynamic average consultation time for selected doctor
  const getCalculatedAvgTime = (doc) => {
    if (!doc) return 15;
    const initialTime = doc.initial_avg_consultation_time ?? 15;
    if (!doc.reset_at) return initialTime;
    const resetTime = new Date(doc.reset_at);
    // Filter patients for this doctor called after reset_at
    const calledPatients = queue
      .filter(
        (q) =>
          q.doctor_id === doc.id &&
          q.called_at &&
          new Date(q.called_at) >= resetTime,
      )
      .sort((a, b) => new Date(a.called_at) - new Date(b.called_at));
    if (calledPatients.length < 2) {
      return initialTime;
    }
    let totalMinutes = 0;
    for (let i = 1; i < calledPatients.length; i++) {
      const diffMs =
        new Date(calledPatients[i].called_at) -
        new Date(calledPatients[i - 1].called_at);
      totalMinutes += diffMs / (1000 * 60);
    }
    const calculatedAvg = totalMinutes / (calledPatients.length - 1);
    return Math.max(1, Math.round(calculatedAvg));
  };
  const handleAddPatient = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      setError("Please select a doctor to assign the patient to.");
      return;
    }
    if (!acceptingPatients) {
      setError("This doctor is currently not accepting new patients.");
      return;
    }
    if (!patientName.trim()) {
      setError("Patient name cannot be empty.");
      return;
    }

    setError(null);
    setAddingPatient(true);
    setLastAddedToken(null);

    try {
      // Call postgres RPC that handles generating token atomically
      const { data: generatedToken, error: rpcError } = await supabase.rpc(
        "add_patient_to_queue",
        {
          p_name: patientName.trim(),
          doc_id: selectedDoctorId,
          p_prescription: prescriptionNumber.trim() || null,
        },
      );

      if (rpcError) throw rpcError;

      setLastAddedToken(generatedToken);
      setPatientName("");
      setPrescriptionNumber("");
    } catch (err) {
      console.error(err);
      setError("Failed to check in patient.");
    } finally {
      setAddingPatient(false);
    }
  };
  const handleResetSettings = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      setError("Please select a doctor first to reset settings.");
      return;
    }
    if (!initialTimeInput || initialTimeInput <= 0) {
      setError("Initial time must be greater than 0.");
      return;
    }
    setError(null);
    setUpdatingSettings(true);
    try {
      const { error: updateError } = await supabase
        .from("doctors")
        .update({
          initial_avg_consultation_time: parseInt(initialTimeInput, 10),
          reset_at: new Date().toISOString(),
        })
        .eq("id", selectedDoctorId);
      if (updateError) throw updateError;
    } catch (err) {
      console.error(err);
      setError("Failed to reset settings.");
    } finally {
      setUpdatingSettings(false);
    }
  };
  // Trigger MS Word File download with clean clinic style
  const downloadWordReport = (name, patientList, created_at, doctorObj) => {
    const d = created_at ? new Date(created_at) : new Date();
    const dateStr = d.toLocaleDateString("en-GB");
    const attendedPatients = patientList.filter((p) => p.status !== "waiting");
    const unattendedPatients = patientList.filter(
      (p) => p.status === "waiting",
    );
    const unattendedCount = unattendedPatients.length;
    const calledPatients = attendedPatients
      .filter((p) => p.called_at)
      .sort((a, b) => new Date(a.called_at) - new Date(b.called_at));
    const startTime =
      calledPatients.length > 0 ? new Date(calledPatients[0].called_at) : null;
    const startTimeStr = startTime
      ? startTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      : "--:--:--";
    const endTimeStr = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Session Report - ${name}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #334155; }
          .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 20pt; font-weight: bold; color: #1d4ed8; margin: 0; }
          .subtitle { font-size: 11pt; color: #64748b; margin: 5px 0 0 0; }
          .section-title { font-size: 14pt; font-weight: bold; color: #1e3a8a; margin-top: 25px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
          .meta-table { width: 100%; border: 1px solid #e2e8f0; border-collapse: collapse; margin-bottom: 25px; background-color: #f8fafc; }
          .meta-table td { padding: 10px; border: 1px solid #e2e8f0; font-size: 10.5pt; }
          .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .table th { background-color: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; text-align: left; color: #475569; font-size: 11pt; }
          .table td { padding: 10px; border: 1px solid #e2e8f0; font-size: 11pt; color: #334155; }
          .footer { margin-top: 40px; text-align: center; font-size: 9pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Queue Cure - Session Report</div>
          <div class="subtitle">Clinic Queue Management System</div>
        </div>
        <table class="meta-table">
          <tr>
            <td><strong>Doctor Name :</strong> ${doctorObj?.full_name || "N/A"}</td>
            <td><strong>Department :</strong> ${doctorObj?.department || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Chamber Number :</strong> ${doctorObj?.chamber_number || "N/A"}</td>
            <td><strong>Phone Number :</strong> ${doctorObj?.phone_number || "N/A"}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>Session Name :</strong> ${name}</td>
          </tr>
          <tr>
            <td><strong>Date :</strong> ${dateStr}</td>
            <td><strong>Time :</strong> ${startTimeStr} - ${endTimeStr}</td>
          </tr>
        </table>
        
        <div class="section-title">Attended Patients</div>
        <table class="table">
          <thead>
            <tr>
              <th style="width: 15%;">Token</th>
              <th>Patient Name</th>
              <th>Prescription No</th>
            </tr>
          </thead>
          <tbody>
            ${attendedPatients
              .map(
                (p) => `
              <tr>
                <td><strong>${p.token_string}</strong></td>
                <td>${p.patient_name}</td>
                <td>${p.prescription_number || "N/A"}</td>
              </tr>
            `,
              )
              .join("")}
            ${
              attendedPatients.length === 0
                ? `
              <tr>
                <td colspan="3" style="text-align: center; color: #94a3b8; padding: 20px;">No patients attended this session.</td>
              </tr>
            `
                : ""
            }
          </tbody>
        </table>
        <div class="section-title">Unattended Patients (${unattendedCount})</div>
        <table class="table">
          <thead>
            <tr>
              <th style="width: 15%;">Token</th>
              <th>Patient Name</th>
              <th>Prescription No</th>
            </tr>
          </thead>
          <tbody>
            ${unattendedPatients
              .map(
                (p) => `
              <tr>
                <td><strong>${p.token_string}</strong></td>
                <td>${p.patient_name}</td>
                <td>${p.prescription_number || "N/A"}</td>
              </tr>
            `,
              )
              .join("")}
            ${
              unattendedPatients.length === 0
                ? `
              <tr>
                <td colspan="3" style="text-align: center; color: #94a3b8; padding: 20px;">No unattended patients.</td>
              </tr>
            `
                : ""
            }
          </tbody>
        </table>
        <div class="footer">
          Generated by Queue Cure &copy; ${new Date().getFullYear()}
        </div>
      </body>
      </html>
    `;
    const blob = new Blob(["\ufeff" + htmlContent], {
      type: "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const element = document.createElement("a");
    element.href = url;
    element.download = `${name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_report.doc`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
  return (
    <div className="flex flex-col gap-6 h-full">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}
      {/* Doctor Search & Select Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-blue-500" />
          Assign a Doctor (Search & Select)
        </h3>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Search doctor by name or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
            {filteredDoctors.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => {
                  setSelectedDoctorId(doc.id);
                  setInitialTimeInput(doc.initial_avg_consultation_time || 15);
                  setLastAddedToken(null);
                  setError(null);
                }}
                className={`p-2.5 rounded-lg border text-left flex items-start justify-between transition-all text-xs
                  ${
                    selectedDoctorId === doc.id
                      ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                      : "border-slate-200 hover:bg-slate-100 bg-white"
                  }`}
              >
                <div>
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    {doc.full_name}
                  </span>
                  <span className="text-slate-500 block">
                    {doc.department} • Room {doc.chamber_number}
                  </span>
                </div>
                {!doc.accepting_patients && (
                  <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    Closed
                  </span>
                )}
              </button>
            ))}
            {filteredDoctors.length === 0 && (
              <p className="text-slate-400 text-xs italic p-2 col-span-2">
                No active doctors match your search.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        {/* Add Patient Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          {!selectedDoctorId && (
            <div className="absolute inset-0 bg-slate-100/70 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 p-4 text-center">
              <UserCheck className="w-8 h-8 text-blue-500 mb-2" />
              <div className="font-bold text-slate-800 text-sm">
                Select a Doctor First
              </div>
              <div className="text-xs text-slate-500 max-w-[200px] mt-1">
                Choose a doctor from the search panel to assign the patient.
              </div>
            </div>
          )}
          {!acceptingPatients && selectedDoctorId && (
            <div className="absolute inset-0 bg-slate-100/70 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 p-4 text-center">
              <Ban className="w-8 h-8 text-red-500 mb-2" />
              <div className="font-bold text-slate-800 text-sm">
                Registration Closed
              </div>
              <div className="text-xs text-slate-500 max-w-[200px] mt-1">
                Dr. {selectedDoctor?.full_name} has paused patient registration.
              </div>
            </div>
          )}

          <div>
            <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-500" />
              Add Patient
            </h3>

            <form onSubmit={handleAddPatient} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    disabled={
                      addingPatient || !acceptingPatients || !selectedDoctorId
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Prescription Number
                  </label>
                  <input
                    type="text"
                    value={prescriptionNumber}
                    onChange={(e) => setPrescriptionNumber(e.target.value)}
                    placeholder="e.g. RX12345"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    disabled={
                      addingPatient || !acceptingPatients || !selectedDoctorId
                    }
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={
                  addingPatient ||
                  !patientName.trim() ||
                  !acceptingPatients ||
                  !selectedDoctorId
                }
                className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center h-10"
              >
                {addingPatient ? "Generating Token..." : "Generate Token"}
              </button>
            </form>
          </div>
          {/* Newly Generated/Last Token display directly below Add Patient form */}
          {(lastAddedToken || lastTokenInQueue) && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg flex flex-col items-center justify-center animate-fade-in shadow-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-green-600">
                {lastAddedToken ? "Patient Added Successfully" : "Last Checked-in Token"}
              </span>
              <span className="text-2xl font-extrabold tracking-tight mt-1">
                {lastAddedToken || lastTokenInQueue}
              </span>
            </div>
          )}
        </div>
        {/* Settings Modifier */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
          {!selectedDoctorId && (
            <div className="absolute inset-0 bg-slate-100/70 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 p-4 text-center">
              <Settings2 className="w-8 h-8 text-purple-500 mb-2" />
              <div className="font-bold text-slate-800 text-sm">
                Select a Doctor First
              </div>
              <div className="text-xs text-slate-500 max-w-[200px] mt-1">
                Choose a doctor to adjust or reset their average consultation
                time.
              </div>
            </div>
          )}
          <div>
            <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-purple-500" />
              Consultation Time Settings
            </h3>
            <form
              onSubmit={handleResetSettings}
              className="flex flex-col gap-3"
            >
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
                    disabled={updatingSettings || !selectedDoctorId}
                  />
                  <button
                    type="submit"
                    disabled={updatingSettings || !selectedDoctorId}
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
            <span className="text-slate-500 font-medium">
              Auto-Avg (Dr. {selectedDoctor?.full_name?.split(" ")[1] || ""}):
            </span>
            <span className="text-purple-600 font-bold bg-purple-50 px-3 py-1 rounded-full text-base">
              {selectedDoctor ? getCalculatedAvgTime(selectedDoctor) : "--"} min
            </span>
          </div>
        </div>
      </div>
      {/* Historical Sessions Section (Professional Logs Storage View) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-500" />
          Session History (Stored Reports)
        </h3>

        {sessions.length === 0 ? (
          <p className="text-slate-400 text-sm italic">
            No completed sessions recorded yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
            {sessions.map((s) => {
              const doc = doctors.find((d) => d.id === s.doctor_id);
              const docName = doc?.full_name || "Doctor";
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm hover:bg-slate-100/80 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-slate-700">
                      {s.session_name}
                    </div>
                    <div className="text-xs text-slate-400">
                      Doctor: {docName} •{" "}
                      {new Date(s.created_at).toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      downloadWordReport(
                        s.session_name,
                        s.patient_list,
                        s.created_at,
                        doc,
                      )
                    }
                    className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1"
                    title="Download Microsoft Word Document"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-xs font-semibold hidden sm:inline">
                      Download DOC
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
