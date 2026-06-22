"use client";
import { useEffect, useState, use } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Link from "next/link";
import { API_BASE_URL } from "../../../../config";

export default function PatientDashboard({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/patient/${id}/history`)
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => {
        console.error("Dashboard fetch error:", err);
        setData({ detail: "Could not reach backend API." });
      });
  }, [id]);

  if (!data) return <div className="p-8 text-center text-gray-500 font-medium">Loading Patient Dashboard...</div>;

  if (data.detail || !data.patient) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-4">
          <h2 className="text-2xl font-bold text-red-600">Error Loading Dashboard</h2>
          <p className="text-slate-600">{data.detail || "Patient data could not be retrieved."}</p>
          <Link href="/admin/dashboard" className="inline-block px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">
            Back to Directory
          </Link>
        </div>
      </div>
    );
  }

  // Reverse speech assessments to show chronological ascending order for trends chart
  const chartData = data.speech_assessments 
    ? [...data.speech_assessments].reverse() 
    : [];

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">{data.patient.name}'s Medical Profile</h1>
            <p className="text-slate-500">ID: {id}</p>
          </div>
          <Link href="/admin/dashboard" className="px-4 py-2 bg-white border rounded shadow-sm text-slate-700 hover:bg-slate-50 font-medium">
            Back to Admin Dashboard
          </Link>
        </div>

        {/* 1. Profile Info */}
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <p className="text-sm text-slate-500">Compliance</p>
            <p className="text-2xl font-bold text-slate-800">{data.patient.compliance_percentage}%</p>
          </div>
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <p className="text-sm text-slate-500">Current Streak</p>
            <p className="text-2xl font-bold text-green-600">{data.patient.streak_days} Days</p>
          </div>
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <p className="text-sm text-slate-500">Age & Gender</p>
            <p className="text-2xl font-bold text-slate-800">{data.patient.age}y / {data.patient.gender}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <p className="text-sm text-slate-500">Caregiver</p>
            <p className="text-lg font-bold text-slate-800 leading-tight">{data.patient.caregiver_name}</p>
            <p className="text-xs text-slate-500 mt-1">{data.patient.caregiver_contact}</p>
          </div>
        </div>

        {/* 2. Assessment Trend Visualization */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="text-xl font-bold mb-4 text-slate-800">Longitudinal Assessment Trends</h2>
          <div className="h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString()}
                    stroke="#94A3B8"
                  />
                  <YAxis stroke="#94A3B8" />
                  <Tooltip 
                    labelFormatter={(val) => new Date(val).toLocaleString()}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="overall_score" stroke="#3B82F6" strokeWidth={3} name="Overall Health" />
                  <Line type="monotone" dataKey="speech_score" stroke="#10B981" strokeWidth={3} name="Speech Richness" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                No trends data available. Perform check-ins first.
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Left Column: Face & Safety Monitoring */}
          <div className="space-y-8">
            
            {/* Face Analysis & Recognition */}
            <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Face Recognition & Analysis</h2>
              {data.face_verifications && data.face_verifications.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    {data.face_verifications[0].image_path ? (
                      <img 
                        src={`${API_BASE_URL}${data.face_verifications[0].image_path}`} 
                        alt="Latest Face Verification" 
                        className="w-24 h-24 object-cover rounded-lg border"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-slate-100 flex items-center justify-center rounded-lg border text-slate-400 text-xs">No Photo</div>
                    )}
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500">Timestamp</p>
                      <p className="font-semibold text-slate-800 text-xs">{new Date(data.face_verifications[0].timestamp).toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Confidence Score</p>
                      <p className="font-bold text-slate-800 text-sm">{(data.face_verifications[0].confidence * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  {/* Pose Analysis Metrics */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg text-xs">
                    <div>
                      <p className="text-slate-500">Head Pose</p>
                      <p className="font-bold text-slate-800 mt-0.5">{data.face_verifications[0].head_direction || "LOOKING FORWARD"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Responsiveness</p>
                      <p className={`font-bold mt-0.5 ${data.face_verifications[0].responsiveness === 'UNRESPONSIVE' ? 'text-red-600' : 'text-green-600'}`}>
                        {data.face_verifications[0].responsiveness || "RESPONSIVE"}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm border-t pt-2">
                    <span className="text-slate-600 font-medium">Verification Status</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${data.face_verifications[0].verified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {data.face_verifications[0].verified ? 'Verified' : 'Failed'}
                    </span>
                  </div>

                  {/* Face History logs */}
                  <div className="border-t pt-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Previous Face Records</h3>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {data.face_verifications.slice(1).map((f: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs text-slate-600 border-b pb-1.5 last:border-0 last:pb-0">
                          <span>{new Date(f.timestamp).toLocaleDateString()}</span>
                          <div className="flex gap-2 items-center">
                            <span>Score: {(f.confidence * 100).toFixed(0)}%</span>
                            <span className={`px-1.5 py-0.5 rounded text-xxs font-bold ${f.verified ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              {f.verified ? 'Verified' : 'Failed'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded text-center text-slate-500 text-sm">
                  No face verification records found.
                </div>
              )}
            </div>
            
            {/* Safety Events */}
            <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Safety Events & Alerts</h2>
                <Link 
                  href="/admin/live-feed" 
                  className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-100 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
                  Live Camera Feed
                </Link>
              </div>

              {/* Recent Alerts Banner */}
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2.5 text-xs text-amber-800">
                <svg className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-semibold">Recent Alerts Status</p>
                  <p className="text-amber-700 mt-0.5 font-normal">Fall detection safety camera is actively connected. System monitoring is live.</p>
                </div>
              </div>

              {/* Fall Event History */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fall Event History</h3>
                {data.fall_events && data.fall_events.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {data.fall_events.map((fall: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center space-x-3">
                          {fall.snapshot_path ? (
                            <img 
                              src={`${API_BASE_URL}${fall.snapshot_path}`} 
                              alt="Fall Snapshot" 
                              className="w-12 h-12 object-cover rounded border"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-red-100 flex items-center justify-center rounded text-red-700 text-xs font-bold">FALL</div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-800">{fall.event_type}</p>
                            <p className="text-xs text-slate-500">{new Date(fall.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                        <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold">{fall.event_source}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded text-center text-slate-500 text-sm">
                    No recent fall events detected.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Speech Monitoring & Playback */}
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h2 className="text-xl font-bold mb-2 text-slate-800">Speech Phenotyping</h2>
            <p className="text-sm text-slate-500 mb-4">Tracking vocabulary richness, hesitations, and audio recording history.</p>
            
            {data.speech_assessments && data.speech_assessments.length > 0 ? (
              <ul className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                {data.speech_assessments.map((t: any, i: number) => (
                  <li key={i} className="text-sm border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex justify-between font-medium text-slate-800 mb-2">
                      <span>{new Date(t.timestamp).toLocaleString()}</span>
                      <span className="text-blue-600 font-semibold">Overall Health: {t.overall_score}</span>
                    </div>
                    
                    {/* Transcript block */}
                    <div className="bg-slate-50 p-3 rounded mb-3 text-slate-600 italic">
                      "{t.transcript || 'No speech transcript recorded.'}"
                    </div>

                    {/* Audio Player */}
                    {t.audio_file_path && (
                      <div className="mb-3">
                        <audio 
                          controls 
                          src={`${API_BASE_URL}${t.audio_file_path}`} 
                          className="w-full h-8"
                        />
                      </div>
                    )}

                    {/* Metrics grid */}
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 bg-slate-100 rounded">
                        <p className="text-slate-500 font-medium">WPM</p>
                        <p className="font-bold text-slate-800 mt-0.5">{t.speech_rate_wpm || 0}</p>
                      </div>
                      <div className="p-2 bg-slate-100 rounded">
                        <p className="text-slate-500 font-medium">Richness</p>
                        <p className="font-bold text-slate-800 mt-0.5">{(t.vocabulary_richness * 100).toFixed(0)}%</p>
                      </div>
                      <div className="p-2 bg-slate-100 rounded">
                        <p className="text-slate-500 font-medium">Fillers</p>
                        <p className="font-bold text-slate-800 mt-0.5">{t.filler_words || 0}</p>
                      </div>
                      <div className="p-2 bg-slate-100 rounded">
                        <p className="text-slate-500 font-medium">Duration</p>
                        <p className="font-bold text-slate-800 mt-0.5">{t.duration_seconds}s</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2">
                      <div className="p-1.5 bg-slate-50 rounded">
                        <span className="text-slate-500">Total Words: </span>
                        <span className="font-bold text-slate-700">{t.total_words}</span>
                      </div>
                      <div className="p-1.5 bg-slate-50 rounded">
                        <span className="text-slate-500">Unique: </span>
                        <span className="font-bold text-slate-700">{t.unique_words}</span>
                      </div>
                      <div className="p-1.5 bg-slate-50 rounded">
                        <span className="text-slate-500">Repeated: </span>
                        <span className="font-bold text-slate-700">{t.repeated_words}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="bg-slate-50 p-4 rounded text-center text-slate-500 text-sm">
                No speech assessment records found.
              </div>
            )}
          </div>
        </div>

        {/* 5. Future Wearable Telemetry (ESP32) */}
        <div className="bg-white p-6 rounded-xl border shadow-sm opacity-60">
          <h2 className="text-xl font-bold mb-2 text-slate-800">ESP32 Wearable Telemetry (Upcoming)</h2>
          <p className="text-slate-500 text-sm">Awaiting integration with ESP32 MPU6050 module.</p>
          <div className="grid grid-cols-3 gap-4 mt-4 text-center text-slate-400">
            <div className="p-3 border rounded border-dashed font-medium">Acceleration X/Y/Z</div>
            <div className="p-3 border rounded border-dashed font-medium">Pitch & Roll</div>
            <div className="p-3 border rounded border-dashed font-medium">Fall Confidence</div>
          </div>
        </div>

      </div>
    </div>
  );
}
