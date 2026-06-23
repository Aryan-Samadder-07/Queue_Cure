import { useState, useEffect } from "react";
import { Clock, Users, Search, HelpCircle } from "lucide-react";

export default function PatientWaitingView({ queue, doctors }) {
  const [searchName, setSearchName] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");

  // Get unique room numbers
  const rooms = [...new Set(doctors.map((d) => d.chamber_number))]
    .filter(Boolean)
    .sort();

  // Keep selectedRoom in sync with available rooms
  useEffect(() => {
    if (rooms.length > 0 && (!selectedRoom || !rooms.includes(selectedRoom))) {
      setSelectedRoom(rooms[0]);
    }
  }, [doctors]);

  // Find latest patient matching searchName (if any)
  const getSearchStatus = () => {
    if (!searchName.trim()) return null;

    const matches = queue
      .filter(
        (q) => q.patient_name.toLowerCase() === searchName.trim().toLowerCase(),
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Sort latest first

    if (matches.length === 0) return { found: false };

    const latestPatient = matches[0];
    const assignedDoc = doctors.find((d) => d.id === latestPatient.doctor_id);

    return {
      found: true,
      patient: latestPatient,
      doctorName: assignedDoc ? assignedDoc.full_name : "Unknown Doctor",
      chamber: assignedDoc ? assignedDoc.chamber_number : "N/A",
    };
  };

  const searchResult = getSearchStatus();

  // Calculate dynamic average consultation time for a specific doctor
  const getCalculatedAvgTime = (doc) => {
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

  // Filter doctors to only show the selected room
  const filteredDoctors = doctors.filter(
    (d) => d.chamber_number === selectedRoom,
  );

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Waiting Room Header with Selector */}
      <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-semibold text-blue-800">Waiting Room</h2>

        {/* Room Selector Dropdown */}
        {rooms.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
              Room:
            </span>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="bg-white border border-blue-200 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {rooms.map((room) => (
                <option key={room} value={room}>
                  Room {room}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-6 flex-1 bg-gradient-to-br from-white to-blue-50/50 flex flex-col gap-6 overflow-y-auto min-h-0">
        {/* Patient Token Lookup Box */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex-shrink-0">
          <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-500" />
            Check Your Token Number
          </h3>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Enter your exact name..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            {searchResult && (
              <div className="p-3.5 rounded-lg border animate-fade-in text-xs bg-slate-50">
                {searchResult.found ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">
                        {searchResult.patient.patient_name}
                      </div>
                      <div className="text-slate-500 mt-1">
                        Doctor: {searchResult.doctorName} (Chamber{" "}
                        {searchResult.chamber})
                      </div>
                      <div className="mt-1 font-medium">
                        Status:{" "}
                        <span
                          className={`capitalize ${
                            searchResult.patient.status === "completed"
                              ? "text-green-600"
                              : searchResult.patient.status ===
                                  "in-consultation"
                                ? "text-blue-600"
                                : "text-amber-600"
                          }`}
                        >
                          {searchResult.patient.status}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                        Your Token
                      </span>
                      <span className="text-lg font-extrabold text-blue-600">
                        {searchResult.patient.token_string}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-500 font-medium">
                    No patient found matching "{searchName}".
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Doctor Queue Card */}
        <div className="flex-1 min-h-0 flex flex-col">
          {filteredDoctors.length === 0 ? (
            <div className="text-center text-slate-400 text-sm italic py-8 bg-white border border-slate-200 rounded-xl">
              {rooms.length === 0
                ? "No active doctors in the clinic."
                : "Please select a room to view the queue."}
            </div>
          ) : (
            filteredDoctors.map((doc) => {
              const currentServingToken = doc.current_serving_token || "--";
              const avgTime = getCalculatedAvgTime(doc);

              // Current serving slot parsed from token string (e.g. JD-101-3 -> 3)
              const currentServingSlot =
                currentServingToken !== "--"
                  ? parseInt(currentServingToken.split("-").pop(), 10)
                  : 0;

              // Filter waiting queue for this doctor
              const docWaitingQueue = queue
                .filter((q) => q.doctor_id === doc.id && q.status === "waiting")
                .sort((a, b) => a.slot_number - b.slot_number);

              const upcomingQueue = docWaitingQueue.slice(0, 10);
              const currentlyServingPatient = queue.find(
                (q) => q.doctor_id === doc.id && q.status === "in-consultation",
              );

              return (
                <div
                  key={doc.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col flex-1 min-h-0"
                >
                  {/* Doctor Header Banner */}
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                        {doc.full_name}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {doc.department} • Room {doc.chamber_number}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                      Avg: {avgTime}m
                    </span>
                  </div>

                  {/* Now Serving Panel */}
                  <div className="p-4 bg-gradient-to-br from-white to-blue-50/20 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        Patient Name
                      </span>
                      <div className="text-xl font-extrabold text-slate-800 mt-1">
                        {currentlyServingPatient ? (
                          currentlyServingPatient.patient_name
                        ) : (
                          <span className="text-slate-400 italic font-normal text-sm">
                            No patient in cabin
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 block">
                        Now Serving
                      </span>
                      <div className="text-3xl font-extrabold text-blue-700 mt-1">
                        {currentServingToken}
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Queue List */}
                  <div className="p-4 flex-1 flex flex-col min-h-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-3 flex-shrink-0">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      Upcoming Queue (Next 10)
                    </div>

                    {upcomingQueue.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4">
                        No patients in line.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1 max-h-[300px]">
                        {upcomingQueue.map((patient) => {
                          // Dynamic wait calculations using slot numbers
                          const waitSlots =
                            patient.slot_number - currentServingSlot;
                          const estimatedWait = Math.max(
                            0,
                            waitSlots * avgTime,
                          );

                          return (
                            <div
                              key={patient.id}
                              className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl flex-shrink-0"
                            >
                              <div>
                                <div className="font-bold text-slate-800 text-sm">
                                  {patient.patient_name}
                                </div>
                                <div className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>
                                    Est. Wait:{" "}
                                    <strong className="text-orange-600 font-bold">
                                      {estimatedWait} min
                                    </strong>
                                  </span>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                                  Token
                                </span>
                                <span className="text-base font-extrabold text-blue-600">
                                  {patient.token_string}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
