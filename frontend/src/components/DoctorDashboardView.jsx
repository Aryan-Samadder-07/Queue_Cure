import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  Play,
  LogOut,
  ShieldAlert,
  CircleDot,
  User,
  Landmark,
  Phone,
  KeyRound,
} from "lucide-react";
export default function DoctorDashboardView({ queue, doctors, sessions }) {
  const [currentDoctor, setCurrentDoctor] = useState(null);

  // Login / Signup Form State
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [chamberNumber, setChamberNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [callingNext, setCallingNext] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [togglingAcceptance, setTogglingAcceptance] = useState(false);
  const [error, setError] = useState(null);
  // Persist doctor session
  useEffect(() => {
    const savedDoctorId = localStorage.getItem("doctor_id");
    if (savedDoctorId && doctors.length > 0) {
      const doc = doctors.find((d) => d.id === savedDoctorId);
      if (doc) {
        setCurrentDoctor(doc);
      } else {
        localStorage.removeItem("doctor_id");
      }
    }
  }, [doctors]);
  // Sync active doctor state with live props (e.g. accepting_patients, current_serving_token updates)
  const doctor = currentDoctor
    ? doctors.find((d) => d.id === currentDoctor.id)
    : null;
  const waitingPatients = queue.filter(
    (q) => q.doctor_id === doctor?.id && q.status === "waiting",
  );
  const hasWaitingPatients = waitingPatients.length > 0;
  const acceptingPatients = doctor?.accepting_patients ?? true;
  const handleAccess = async (e) => {
    e.preventDefault();
    if (!phoneNumber.trim() || !fullName.trim()) {
      setError("Please fill out Name and Phone Number.");
      return;
    }
    setError(null);
    setActionLoading(true);
    try {
      // 1. Check if phone number already exists
      const { data: existingDoc, error: queryError } = await supabase
        .from("doctors")
        .select("*")
        .eq("phone_number", phoneNumber.trim())
        .maybeSingle();
      if (queryError) throw queryError;
      if (existingDoc) {
        // Log in
        localStorage.setItem("doctor_id", existingDoc.id);
        setCurrentDoctor(existingDoc);
      } else {
        // Sign up
        if (!department.trim() || !chamberNumber.trim()) {
          setError("New doctors must specify Department and Chamber Number.");
          setActionLoading(false);
          return;
        }
        const { data: newDoc, error: insertError } = await supabase
          .from("doctors")
          .insert([
            {
              full_name: fullName.trim(),
              department: department.trim(),
              chamber_number: chamberNumber.trim(),
              phone_number: phoneNumber.trim(),
            },
          ])
          .select()
          .single();
        if (insertError) throw insertError;
        localStorage.setItem("doctor_id", newDoc.id);
        setCurrentDoctor(newDoc);
      }
    } catch (err) {
      console.error(err);
      setError("Authentication failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };
  const handleLogout = () => {
    localStorage.removeItem("doctor_id");
    setCurrentDoctor(null);
    setFullName("");
    setDepartment("");
    setChamberNumber("");
    setPhoneNumber("");
  };
  const handleCallNext = async () => {
    if (!hasWaitingPatients || !doctor) return;
    setError(null);
    setCallingNext(true);

    try {
      const { error: rpcError } = await supabase.rpc(
        "call_next_patient_for_doctor",
        { doc_id: doctor.id },
      );
      if (rpcError) throw rpcError;
    } catch (err) {
      console.error(err);
      setError("Failed to call next patient.");
    } finally {
      setCallingNext(false);
    }
  };
  const handleToggleAcceptance = async () => {
    if (!doctor) return;
    setError(null);
    setTogglingAcceptance(true);
    try {
      const { error: updateError } = await supabase
        .from("doctors")
        .update({ accepting_patients: !acceptingPatients })
        .eq("id", doctor.id);
      if (updateError) throw updateError;
    } catch (err) {
      console.error(err);
      setError("Failed to update patient acceptance status.");
    } finally {
      setTogglingAcceptance(false);
    }
  };
  const getDefaultSessionName = () => {
    const d = new Date();
    return `Session ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const downloadWordReport = (name, patientList, created_at) => {
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
            <td><strong>Doctor Name :</strong> ${doctor?.full_name || "N/A"}</td>
            <td><strong>Department :</strong> ${doctor?.department || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Chamber Number :</strong> ${doctor?.chamber_number || "N/A"}</td>
            <td><strong>Phone Number :</strong> ${doctor?.phone_number || "N/A"}</td>
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
  const handleEndSession = async (e) => {
    e.preventDefault();
    if (!doctor) return;
    const name = sessionName.trim() || getDefaultSessionName();

    setError(null);
    setEndingSession(true);
    try {
      const activeQueueForDoctor = queue.filter(
        (q) => q.doctor_id === doctor.id,
      );
      if (activeQueueForDoctor.length > 0) {
        downloadWordReport(name, activeQueueForDoctor, new Date());
      }
      const { error: rpcError } = await supabase.rpc("end_session_for_doctor", {
        doc_id: doctor.id,
        s_name: name,
      });
      if (rpcError) throw rpcError;
      setShowEndModal(false);
      setSessionName("");
    } catch (err) {
      console.error(err);
      setError("Failed to end session properly.");
    } finally {
      setEndingSession(false);
    }
  };
  // Login / Signup Form render
  if (!doctor) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-rose-500" />
          Doctor Login / Registration
        </h3>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleAccess} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Phone Number (Login Key)
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. +91 9876543210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Dr. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>
          <div className="border-t border-dashed border-slate-200 pt-4">
            <p className="text-xs text-slate-500 mb-3">
              If your phone number is not registered, we will automatically sign
              you up using the fields below:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Department
                </label>
                <div className="relative">
                  <Landmark className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Cardiology"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Chamber Number
                </label>
                <div className="relative">
                  <Landmark className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. 101-A"
                    value={chamberNumber}
                    onChange={(e) => setChamberNumber(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={actionLoading}
            className="w-full mt-2 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-lg font-bold transition-all"
          >
            {actionLoading ? "Accessing Dashboard..." : "Access Dashboard"}
          </button>
        </form>
      </div>
    );
  }
  // Active Doctor Dashboard Render
  return (
    <div className="flex flex-col gap-6">
      {/* Doctor Info Banner */}
      <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            {doctor.full_name}
          </h3>
          <p className="text-xs text-slate-500">
            {doctor.department} • Chamber:{" "}
            <strong className="text-slate-700 font-bold">
              {doctor.chamber_number}
            </strong>
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-bold text-slate-500 hover:text-rose-600 border border-slate-300 px-3 py-1.5 rounded-lg bg-white transition-colors"
        >
          Logout
        </button>
      </div>
      {/* Main Section containing Patients Waiting & Controls */}
      <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-xl">
        <p className="text-slate-600 mb-4 text-sm font-semibold text-center">
          {hasWaitingPatients
            ? `${waitingPatients.length} patient(s) waiting in your queue.`
            : "No patients currently waiting for you."}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center items-center">
          <button
            onClick={handleCallNext}
            disabled={!hasWaitingPatients || callingNext}
            className={`flex items-center gap-2 px-8 py-3 rounded-full text-base font-bold transition-all shadow-sm w-full sm:w-auto justify-center
              ${
                !hasWaitingPatients || callingNext
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-green-500 hover:bg-green-600 hover:shadow-md hover:scale-[1.02] active:scale-95 text-white"
              }`}
          >
            {callingNext ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-5 h-5 fill-current" />
            )}
            {callingNext ? "Calling..." : "Call Next Patient"}
          </button>
          <button
            onClick={() => {
              setSessionName(getDefaultSessionName());
              setShowEndModal(true);
            }}
            className="flex items-center gap-2 px-8 py-3 rounded-full text-base font-bold transition-all shadow-sm w-full sm:w-auto justify-center bg-red-500 hover:bg-red-600 hover:shadow-md hover:scale-[1.02] active:scale-95 text-white"
          >
            <LogOut className="w-4 h-4" />
            End Session
          </button>
        </div>
      </div>
      {/* Stop Accepting Patients Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-white border border-slate-200 rounded-xl shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <CircleDot
            className={`w-5 h-5 ${acceptingPatients ? "text-green-500 animate-pulse" : "text-red-500"}`}
          />
          <div>
            <h4 className="font-semibold text-slate-800 text-sm sm:text-base">
              {acceptingPatients
                ? "Accepting New Patients"
                : "Registration Closed"}
            </h4>
            <p className="text-xs text-slate-500">
              {acceptingPatients
                ? "Receptionist can register new entries."
                : "No new check-ins allowed. Remaining queue will be processed."}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggleAcceptance}
          disabled={togglingAcceptance}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all w-full sm:w-auto flex items-center justify-center gap-2
            ${
              acceptingPatients
                ? "bg-amber-100 hover:bg-amber-200 text-amber-800"
                : "bg-green-100 hover:bg-green-200 text-green-800"
            }`}
        >
          <ShieldAlert className="w-4 h-4" />
          {acceptingPatients
            ? "Stop Accepting Patients"
            : "Resume Accepting Patients"}
        </button>
      </div>
      {/* End Session Modal */}
      {showEndModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              End Consultation Session
            </h3>
            <p className="text-slate-500 text-sm mb-4">
              This will reset the token counter, clear all active patients in
              your queue, and save a downloadable Microsoft Word report of this
              session in your history.
            </p>

            <form onSubmit={handleEndSession}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Session Name
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g. Morning Shift"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEndModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-semibold text-sm transition-colors"
                  disabled={endingSession}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                  disabled={endingSession}
                >
                  {endingSession ? "Ending..." : "Confirm & End"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
