"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "../../../config";

interface Patient {
  patient_id: string;
  full_name: string;
  age: number;
}

export default function LiveFeedPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [patientHistory, setPatientHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [streamActive, setStreamActive] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  
  // Refactored streaming modes support
  const [streamSource, setStreamSource] = useState<"browser" | "edge">("browser");
  const [wsFrame, setWsFrame] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState("Disconnected");

  // 1. Fetch all patients for the selector
  useEffect(() => {
    fetch(`${API_BASE_URL}/admin/patients`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPatients(data);
          if (data.length > 0) {
            setSelectedPatientId(data[0].patient_id);
          }
        }
        setLoading(false)
      })
      .catch(err => {
        console.error("Error fetching patients list:", err);
        setLoading(false);
      });
  }, []);

  // 2. Fetch specific history & poll for updates (every 2 seconds)
  useEffect(() => {
    if (!selectedPatientId) return;

    const fetchHistory = () => {
      fetch(`${API_BASE_URL}/patient/${selectedPatientId}/history`)
        .then(res => res.json())
        .then(data => {
          setPatientHistory(data);
        })
        .catch(err => {
          console.error("Error fetching patient history:", err);
        });
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 2000);
    return () => clearInterval(interval);
  }, [selectedPatientId]);

  // WebSocket Browser stream connection logic
  useEffect(() => {
    if (streamSource !== "browser" || !selectedPatientId) {
      setWsFrame(null);
      setWsStatus("Disconnected");
      return;
    }

    const base = API_BASE_URL.replace(/^http/, "ws");
    const wsUrl = `${base}/api/vision/stream?role=receiver&patient_id=${selectedPatientId}`;
    console.log("Caregiver WebSocket connecting to:", wsUrl);
    setWsStatus("Connecting...");

    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      setWsStatus("Connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.image) {
          setWsFrame(data.image);
        }
      } catch (e) {
        console.error("Error parsing live feed WebSocket msg:", e);
      }
    };

    ws.onerror = () => {
      setWsStatus("Error");
    };

    ws.onclose = () => {
      setWsStatus("Disconnected");
      setWsFrame(null);
    };

    return () => {
      ws.close();
    };
  }, [streamSource, selectedPatientId]);

  // Test MJPEG stream connection (for Edge mode only)
  useEffect(() => {
    if (streamSource !== "edge") return;
    
    const img = new Image();
    img.src = "http://localhost:5001/video_feed";
    img.onload = () => setStreamActive(true);
    img.onerror = () => setStreamActive(false);
  }, [streamSource]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-semibold text-slate-500">Loading Live Safety Monitoring...</div>;
  }

  const latestSpeech = patientHistory?.speech_assessments?.[0];
  const latestFace = patientHistory?.face_verifications?.[0];
  const fallEvents = patientHistory?.fall_events || [];

  // Determine if there is an active (undismissed) fall alert
  const latestFall = fallEvents.length > 0 ? fallEvents[0] : null;
  const isDismissed = latestFall ? dismissedAlerts.includes(latestFall.event_id) : false;

  const activeFall = latestFall && !isDismissed && 
    (latestFall.alert_status === "DISPATCHED" || 
     (new Date().getTime() - new Date(latestFall.timestamp).getTime() < 30000));

  const handleDismiss = async () => {
    if (!latestFall) return;
    
    // 1. Immediately update local state to hide alert banner
    setDismissedAlerts(prev => [...prev, latestFall.event_id]);
    
    // 2. Persist resolution to SQLite database
    try {
      await fetch(`${API_BASE_URL}/api/events/${latestFall.event_id}/resolve`, {
        method: "PUT"
      });
    } catch (err) {
      console.error("Failed to mark alert as resolved in DB:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8 relative">
      
      {/* CRITICAL ALARM BANNER */}
      {activeFall && (
        <div className="absolute inset-0 bg-red-600/95 backdrop-blur z-50 flex flex-col items-center justify-center text-white p-8 space-y-6 text-center animate-pulse">
          <div className="h-24 w-24 rounded-full bg-white text-red-600 flex items-center justify-center text-5xl font-extrabold animate-bounce">
            ⚠️
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-wider">Fall Detected!</h1>
            <p className="text-xl sm:text-2xl font-bold">Patient: {patientHistory?.patient.name} ({selectedPatientId})</p>
            <p className="text-base sm:text-lg opacity-90">Time: {new Date(latestFall.timestamp).toLocaleTimeString()} | Confidence: {(latestFall.confidence * 100).toFixed(0)}%</p>
          </div>
          
          {latestFall.snapshot_path && (
            <div className="max-w-md w-full rounded-2xl overflow-hidden border-4 border-white shadow-2xl">
              <img 
                src={`${API_BASE_URL}${latestFall.snapshot_path}`} 
                alt="Fall Alert Snapshot" 
                className="w-full h-64 object-cover"
              />
            </div>
          )}

          <button 
            onClick={handleDismiss}
            className="px-8 py-4 bg-white text-red-600 rounded-2xl text-lg font-black hover:bg-slate-100 transition shadow-lg"
          >
            DISMISS / ALARM ACKNOWLEDGED
          </button>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <span className={`w-3.5 h-3.5 rounded-full ${(streamSource === "browser" ? wsStatus === "Connected" : streamActive) ? 'bg-green-500 animate-ping' : 'bg-red-500 animate-pulse'}`}></span>
              Live Safety Monitoring
            </h1>
            <p className="text-slate-500 mt-1">Real-time room visual feeds and fall alarm dispatch.</p>
          </div>
          <Link href="/admin/dashboard" className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 font-semibold text-slate-700 transition w-full md:w-auto text-center text-sm">
            Back to Caregiver Dashboard
          </Link>
        </div>

        {/* Patient Selector & Stream Source Selector */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <label htmlFor="patient-select" className="font-bold text-slate-700 text-sm">Select Patient to Monitor:</label>
            <select 
              id="patient-select"
              value={selectedPatientId} 
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="p-2 border rounded-xl bg-slate-50 font-semibold text-slate-800 focus:outline-none text-sm"
            >
              {patients.map(p => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.full_name} ({p.patient_id})
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Feed Source:</span>
            <button 
              onClick={() => setStreamSource("browser")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${streamSource === "browser" ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
            >
              🌐 Browser Stream (WS)
            </button>
            <button 
              onClick={() => setStreamSource("edge")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${streamSource === "edge" ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
            >
              🎥 Edge Camera (Port 5001)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1 & 2: Camera Feed Container */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-950 aspect-video rounded-2xl relative overflow-hidden flex flex-col items-center justify-center text-center p-8 border-4 border-slate-800 shadow-lg">
              
              {streamSource === "browser" ? (
                wsFrame ? (
                  <img 
                    src={wsFrame} 
                    alt="Live Safety Monitoring" 
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-slate-900/60 flex items-center justify-center text-slate-400">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                      Waiting for Camera...
                    </h3>
                    <p className="text-slate-400 text-xs max-w-xs mx-auto font-medium">
                      Awaiting stream from Patient Room device. Start the camera streaming from "/patient/room-stream" to view here.
                    </p>
                  </div>
                )
              ) : (
                streamActive ? (
                  <img 
                    src="http://localhost:5001/video_feed" 
                    alt="Live Safety Monitoring" 
                    className="absolute inset-0 w-full h-full object-contain"
                    onError={() => setStreamActive(false)}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-slate-900/60 flex items-center justify-center text-slate-400">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                      Waiting for Camera...
                    </h3>
                    <p className="text-slate-400 text-xs max-w-xs mx-auto font-medium">
                      Make sure the local "vision_node/camera_streamer.py" script is running on the patient device.
                    </p>
                  </div>
                )
              )}

              {/* Status Bar */}
              <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur text-slate-300 px-3 py-1 rounded-xl text-xxs font-mono font-bold flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${(streamSource === "browser" ? wsStatus === "Connected" : streamActive) ? 'bg-green-500' : 'bg-red-500'}`}></span>
                STREAM: {streamSource === "browser" ? wsStatus.toUpperCase() : (streamActive ? 'LIVE' : 'OFFLINE')}
              </div>
              <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur text-slate-300 px-3 py-1 rounded-xl text-xxs font-mono font-bold">
                {selectedPatientId || "N/A"}
              </div>
            </div>

            {/* Diagnostics Panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-800">Monitoring Status</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xxs text-slate-500 font-bold uppercase tracking-wider">Connection Status</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">
                    {streamSource === "browser" ? wsStatus : (streamActive ? 'Connected' : 'Offline')}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xxs text-slate-500 font-bold uppercase tracking-wider">Source Type</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">
                    {streamSource === "browser" ? "Websocket" : "Local Edge"}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xxs text-slate-500 font-bold uppercase tracking-wider">AI Processing</p>
                  <p className="text-sm font-bold text-green-650 mt-1">Ready (YOLOv8-Pose)</p>
                </div>
              </div>
            </div>

          </div>

          {/* Column 3: Patient Information and Fall Logs */}
          <div className="space-y-8">
            
            {/* Patient Status Details */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-800">Patient Status</h2>
              
              {patientHistory ? (
                <div className="space-y-3.5 text-sm">
                  <div>
                    <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Name</span>
                    <span className="font-bold text-slate-800 text-base">{patientHistory.patient.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Age / Gender</span>
                    <span className="font-semibold text-slate-800">{patientHistory.patient.age}y / {patientHistory.patient.gender}</span>
                  </div>
                  <div className="border-t pt-3.5">
                    <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Last Check-In Time</span>
                    <span className="font-semibold text-slate-800">
                      {latestSpeech ? new Date(latestSpeech.timestamp).toLocaleString() : "Never"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Last Speech Score</span>
                    <span className="font-semibold text-slate-800">
                      {latestSpeech ? `${latestSpeech.overall_score} (Overall)` : "No Assessment"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs font-bold uppercase tracking-wider">Last Face Verification</span>
                    <span className="font-semibold text-slate-800">
                      {latestFace ? `${latestFace.verified ? 'Verified' : 'Failed'} (${(latestFace.confidence * 100).toFixed(0)}%)` : "No Verification"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No patient selected.</p>
              )}
            </div>

            {/* Fall Alerts panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center justify-between">
                Recent Fall Alarms
                <span className="px-2 py-0.5 bg-red-100 text-red-650 rounded text-xxs font-bold uppercase tracking-wider">Active Monitor</span>
              </h2>

              {fallEvents.length > 0 ? (
                <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                  {fallEvents.map((fall: any, idx: number) => {
                    const isAlertDismissed = dismissedAlerts.includes(fall.event_id);
                    return (
                      <div key={idx} className="p-3 bg-red-50/50 rounded-xl border border-red-100 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-red-700">{fall.event_type} ALERT</span>
                          <span className="text-slate-500 font-mono">{new Date(fall.timestamp).toLocaleTimeString()}</span>
                        </div>
                        
                        {fall.snapshot_path && (
                          <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-150">
                            <img 
                              src={`${API_BASE_URL}${fall.snapshot_path}`} 
                              alt="Fall Snapshot" 
                              className="object-cover w-full h-full"
                            />
                          </div>
                        )}

                        <div className="flex justify-between items-center text-xxs text-slate-500 font-mono">
                          <span>Source: {fall.event_source}</span>
                          <span className={`font-bold px-1.5 py-0.5 rounded ${isAlertDismissed || fall.alert_status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {isAlertDismissed ? 'RESOLVED' : fall.alert_status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded text-center text-slate-500 text-xs">
                  No fall safety alerts registered. Safety monitor channel cleared.
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
