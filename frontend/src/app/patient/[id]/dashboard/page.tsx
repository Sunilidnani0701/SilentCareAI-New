"use client";
import { useEffect, useState, use } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Link from "next/link";
import { API_BASE_URL } from "../../../../config";

export default function PatientDashboard({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Helper to compute derived health score
  const calculateDerivedScore = (speechScore: number, memoryScore: number, faceVerified: boolean, noActiveFalls: boolean) => {
    return Math.round(
      (speechScore * 0.40) + 
      (memoryScore * 0.30) + 
      (faceVerified ? 10 : 0) + 
      (noActiveFalls ? 20 : 0)
    );
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/patient/${id}/history`)
      .then(res => {
        if (!res.ok) throw new Error("API dashboard fetch failed");
        return res.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.warn("Dashboard fetch error, falling back to local database (Demo Mode):", err);
        
        const localPatients = JSON.parse(localStorage.getItem("mock_patients") || "[]");
        const matchedPatient = localPatients.find((p: any) => p.patient_id === id) || {
          name: localStorage.getItem("patient_name") || "Patient",
          age: 72,
          gender: "Male",
          caregiver_name: "Caregiver",
          caregiver_contact: "555-0122",
          streak_days: 1,
          compliance_percentage: 100
        };
        
        const localCheckins = JSON.parse(localStorage.getItem(`mock_checkins_${id}`) || "[]");
        
        const mockFaceChecks = localCheckins.length > 0 ? localCheckins.map((c: any) => ({
          timestamp: c.timestamp,
          image_path: "",
          head_direction: "forward",
          responsiveness: "active",
          confidence: 0.95,
          verified: c.face_verified
        })) : [{
          timestamp: new Date().toISOString(),
          image_path: "",
          head_direction: "forward",
          responsiveness: "active",
          confidence: 0.95,
          verified: true
        }];

        setData({
          patient: {
            name: matchedPatient.name || matchedPatient.full_name,
            age: matchedPatient.age,
            gender: matchedPatient.gender,
            caregiver_name: matchedPatient.caregiver_name,
            caregiver_contact: matchedPatient.caregiver_contact,
            streak_days: localCheckins.length > 0 ? localCheckins.length : matchedPatient.streak_days,
            compliance_percentage: matchedPatient.compliance_percentage
          },
          speech_assessments: localCheckins,
          face_verifications: mockFaceChecks,
          fall_events: [
            {
              event_id: "evt-mock-1",
              event_type: "FALL_DETECTION",
              event_source: "WEARABLE_IOT",
              timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
              alert_status: "RESOLVED",
              snapshot_path: ""
            }
          ]
        });
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Loading Caregiver Dashboard...</div>;

  if (!data || data.detail || !data.patient) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-4 animate-scale-in">
          <h2 className="text-2xl font-bold text-red-600">Error Loading Dashboard</h2>
          <p className="text-slate-600">{data?.detail || "Patient data could not be retrieved."}</p>
          <Link href="/admin/dashboard" className="inline-block px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">
            Back to Directory
          </Link>
        </div>
      </div>
    );
  }

  const speechAssessments = data.speech_assessments || [];
  const latestCheckin = speechAssessments[0] || null;
  const previousCheckin = speechAssessments[1] || null;
  const faceVerifications = data.face_verifications || [];
  const latestFace = faceVerifications[0] || null;
  const fallEvents = data.fall_events || [];

  // Derived calculations
  const faceVerified = latestFace ? latestFace.verified : false;
  const activeFalls = fallEvents.filter((f: any) => f.event_type === "FALL" && f.alert_status === "DISPATCHED");
  const noActiveFalls = activeFalls.length === 0;

  const speechScore = latestCheckin ? (latestCheckin.speech_score ?? 80) : 0;
  const memoryScore = latestCheckin ? (latestCheckin.memory_score ?? 80) : 0;

  // Derived Health Score
  const derivedScore = latestCheckin 
    ? calculateDerivedScore(speechScore, memoryScore, faceVerified, noActiveFalls)
    : 0;

  // Assessment Reliability
  const reliability = faceVerified ? "High" : "Moderate";

  // Speech Metrics
  const speechRate = latestCheckin?.speech_rate_wpm || 0;
  const totalWords = latestCheckin?.total_words || 0;
  const vocabularyRichness = latestCheckin?.vocabulary_richness || latestCheckin?.lexical_diversity || 0;

  // Status color & Label
  let statusColor = "health-badge-green";
  let statusLabel = "Stable";
  if (derivedScore < 75 || !noActiveFalls) {
    statusColor = "health-badge-red";
    statusLabel = "Alert";
  } else if (derivedScore < 85) {
    statusColor = "health-badge-amber";
    statusLabel = "Monitor";
  }

  // AI Insights Generation (Compare latest 2 checkins)
  let speechRateInsight = "No historical speech baseline available yet.";
  let vocabInsight = "No historical vocabulary baseline available yet.";
  let fallInsight = noActiveFalls 
    ? "No falls have been detected during today's monitoring."
    : "Fall safety alarm active. Alert dispatched.";

  if (latestCheckin && previousCheckin) {
    const prevRate = previousCheckin.speech_rate_wpm || 0;
    if (prevRate > 0) {
      const diff = ((speechRate - prevRate) / prevRate) * 100;
      if (diff < -5) {
        speechRateInsight = `Speech rate decreased by ${Math.abs(Math.round(diff))}% compared to the previous assessment.`;
      } else if (diff > 5) {
        speechRateInsight = `Speech rate increased by ${Math.round(diff)}% compared to the previous assessment.`;
      } else {
        speechRateInsight = "Speech rate remained consistent compared to the previous assessment.";
      }
    } else {
      speechRateInsight = "Speech rate remains stable.";
    }

    const prevVocab = previousCheckin.vocabulary_richness || previousCheckin.lexical_diversity || 0;
    if (prevVocab > 0) {
      const diffVocab = Math.abs(vocabularyRichness - prevVocab);
      if (diffVocab > 0.08) {
        vocabInsight = "Vocabulary richness changed slightly.";
      } else {
        vocabInsight = "Vocabulary richness remains stable.";
      }
    } else {
      vocabInsight = "Vocabulary richness remains stable.";
    }
  }

  // Rule-Based Recommendations
  let recommendationsList: string[] = [];
  if (!noActiveFalls) {
    recommendationsList.push("Contact caregiver immediately. Fall safety alarm triggered.");
  }
  if (speechScore < 75 && latestCheckin) {
    recommendationsList.push("Repeat tomorrow's Daily Check-in in a quiet environment.");
  }
  if (memoryScore < 75 && latestCheckin) {
    recommendationsList.push("Consider consulting a healthcare professional for a detailed cognitive review.");
  }
  if (recommendationsList.length === 0) {
    recommendationsList.push("Continue your normal daily routine and stay active.");
  }

  // Trend Chart Setup
  const hasMultipleCheckins = speechAssessments.length >= 2;
  const chartData = speechAssessments 
    ? [...speechAssessments].reverse().map((c: any) => ({
        timestamp: c.timestamp,
        overall_score: calculateDerivedScore(c.speech_score ?? 80, c.memory_score ?? 80, c.face_verified ?? false, true),
        speech_score: c.speech_score ?? 80,
        memory_score: c.memory_score ?? 80
      }))
    : [];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">{data.patient.name}'s Medical Profile</h1>
            <p className="text-slate-500">ID: {id}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <a 
              href={`${API_BASE_URL}/patient/${id}/report`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm font-bold text-center text-sm transition"
            >
              📄 Download PDF Report
            </a>
            <Link href="/admin/dashboard" className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-700 hover:bg-slate-50 font-semibold text-center text-sm transition">
              Back to Caregiver Dashboard
            </Link>
          </div>
        </div>

        {/* Profile Info Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm card-hover">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Compliance</p>
            <p className="text-3xl font-extrabold text-slate-800 mt-1">{data.patient.compliance_percentage}%</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm card-hover">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Current Streak</p>
            <p className="text-3xl font-extrabold text-green-600 mt-1">{data.patient.streak_days} Days</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm card-hover">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Age & Gender</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1.5">{data.patient.age}y / {data.patient.gender}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm card-hover">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Caregiver Contact</p>
            <p className="text-base font-bold text-slate-800 mt-1.5 leading-tight">{data.patient.caregiver_name}</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">{data.patient.caregiver_contact}</p>
          </div>
        </div>

        {/* 1. Today's Health Summary Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-fade-in-up delay-100">
          <h2 className="text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            Today's Health Summary
          </h2>
          {latestCheckin ? (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-6 items-center">
              
              {/* Score / Status Block */}
              <div className="md:col-span-2 flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-2xl p-5 text-center">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Health Score</span>
                <p className="text-5xl font-black text-blue-600 my-2">{derivedScore}%</p>
                <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${statusColor}`}>
                  {statusLabel}
                </div>
              </div>

              {/* Individual Parameters */}
              <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-center">
                  <span className="text-xxs font-bold text-slate-400 uppercase">Speech Health</span>
                  <p className={`text-base font-extrabold mt-1 ${speechScore >= 80 ? 'text-green-600' : speechScore >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                    {speechScore >= 80 ? 'Excellent' : speechScore >= 70 ? 'Good' : 'Needs Review'}
                  </p>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-center">
                  <span className="text-xxs font-bold text-slate-400 uppercase">Memory</span>
                  <p className="text-base font-extrabold text-slate-800 mt-1">Normal</p>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-center">
                  <span className="text-xxs font-bold text-slate-400 uppercase">Fall Status</span>
                  <p className={`text-base font-extrabold mt-1 ${noActiveFalls ? 'text-green-600' : 'text-red-500 animate-pulse'}`}>
                    {noActiveFalls ? 'No Fall' : 'Fall Alert!'}
                  </p>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-center">
                  <span className="text-xxs font-bold text-slate-400 uppercase">Reliability</span>
                  <p className={`text-base font-extrabold mt-1 ${reliability === 'High' ? 'text-green-600' : 'text-amber-500'}`}>
                    {reliability}
                  </p>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-slate-50 p-8 rounded-2xl text-center text-slate-500 text-sm border border-dashed border-slate-200">
              No health records yet. Complete today's Daily Check-in to begin tracking your health.
            </div>
          )}
        </div>

        {/* IoT Wearable Smart Belt Status */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-fade-in-up delay-150">
          <h2 className="text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
            🔌 IoT Wearable Smart Belt
          </h2>
          {data.wearable_status ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                <span className="text-xxs font-bold text-slate-400 uppercase">Device Connection</span>
                <p className="text-base font-extrabold text-green-600 mt-1">Connected</p>
                <span className="text-xxs text-slate-400 mt-1">Last Sync: {new Date(data.wearable_status.timestamp * 1000).toLocaleTimeString()}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                <span className="text-xxs font-bold text-slate-400 uppercase">Battery Level</span>
                <p className={`text-2xl font-black mt-1 ${data.wearable_status.battery_level > 20 ? 'text-indigo-600' : 'text-red-500 animate-pulse'}`}>
                  {data.wearable_status.battery_level}%
                </p>
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${data.wearable_status.battery_level > 20 ? 'bg-indigo-600' : 'bg-red-500'}`} 
                    style={{ width: `${data.wearable_status.battery_level}%` }}
                  ></div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                <span className="text-xxs font-bold text-slate-400 uppercase">Accelerometer (G)</span>
                <p className="text-sm font-extrabold text-slate-800 mt-1 font-mono">
                  X: {data.wearable_status.acc_x.toFixed(2)}
                </p>
                <p className="text-sm font-extrabold text-slate-800 font-mono">
                  Y: {data.wearable_status.acc_y.toFixed(2)}
                </p>
                <p className="text-sm font-extrabold text-slate-800 font-mono">
                  Z: {data.wearable_status.acc_z.toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                <span className="text-xxs font-bold text-slate-400 uppercase">Wearable Fall Status</span>
                <p className={`text-base font-extrabold mt-1 ${!data.wearable_status.fall_detected ? 'text-green-600' : 'text-red-500 animate-pulse'}`}>
                  {!data.wearable_status.fall_detected ? 'Safe / No Fall' : '🚨 FALL DETECTED!'}
                </p>
                <span className="text-xxs text-slate-400 mt-1">Gyro: {data.wearable_status.gyro_x.toFixed(1)}, {data.wearable_status.gyro_y.toFixed(1)}, {data.wearable_status.gyro_z.toFixed(1)}</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-6 rounded-2xl text-center text-slate-500 text-sm border border-dashed border-slate-200">
              No Smart Belt telemetry received yet. Turn on the wearable device to stream live sensor data.
            </div>
          )}
        </div>

        {/* 2. Explainable AI 2.0 (Real Data Only) */}
        {latestCheckin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in-up delay-200">
            
            {/* XAI Panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                Why was this Health Score generated?
              </h2>
              
              <div className="space-y-3.5">
                
                {/* Speech Rate Factor */}
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                  <span className="text-lg mt-0.5">🔊</span>
                  <div>
                    <span className="font-bold text-slate-800 block">Speech Rate: {speechRate} WPM</span>
                    <span className="text-slate-500 text-xs">Paced speech indicates cognitive processing stability.</span>
                  </div>
                </div>

                {/* Vocabulary Richness Factor */}
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                  <span className="text-lg mt-0.5">📚</span>
                  <div>
                    <span className="font-bold text-slate-800 block">Vocabulary Richness: {(vocabularyRichness * 100).toFixed(0)}%</span>
                    <span className="text-slate-500 text-xs">Measures lexical diversity based on Type-Token Ratio.</span>
                  </div>
                </div>

                {/* Face Verification Factor */}
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                  <span className="text-lg mt-0.5">🔐</span>
                  <div>
                    <span className="font-bold text-slate-800 block">Face Identity Status: {faceVerified ? 'Verified' : 'Unverified'}</span>
                    <span className="text-slate-500 text-xs">Confirms patient presence and head pose stability.</span>
                  </div>
                </div>

                {/* Fall Detection Factor */}
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                  <span className="text-lg mt-0.5">🛡️</span>
                  <div>
                    <span className="font-bold text-slate-800 block">Ambient Room Safety: {noActiveFalls ? 'Secure' : 'Alert'}</span>
                    <span className="text-slate-500 text-xs">Continuous ambient monitoring for physical safety.</span>
                  </div>
                </div>

              </div>
            </div>

            {/* AI Insights & Recommendations */}
            <div className="space-y-6">
              
              {/* Dynamic Observations */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-base font-extrabold text-slate-900">AI Health Insights</h3>
                <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  <p className="flex gap-2"><span className="text-blue-500 font-bold">•</span> {speechRateInsight}</p>
                  <p className="flex gap-2"><span className="text-blue-500 font-bold">•</span> {vocabInsight}</p>
                  <p className="flex gap-2"><span className="text-blue-500 font-bold">•</span> {fallInsight}</p>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-base font-extrabold text-slate-900">Recommendations</h3>
                <div className="space-y-2.5">
                  {recommendationsList.map((rec, idx) => (
                    <div key={idx} className="p-3 bg-blue-50/50 text-blue-800 rounded-xl border border-blue-100 text-xs font-semibold">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* 3. Trend Visualization */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-fade-in-up delay-300">
          <h2 className="text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            Longitudinal Assessment Trends
          </h2>
          
          {hasMultipleCheckins ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(val: any) => val ? new Date(val).toLocaleDateString() : ""}
                    stroke="#94A3B8"
                  />
                  <YAxis stroke="#94A3B8" />
                  <Tooltip 
                    labelFormatter={(val: any) => val ? new Date(val).toLocaleString() : ""}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="overall_score" stroke="#3B82F6" strokeWidth={3} name="Overall Health" activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="speech_score" stroke="#10B981" strokeWidth={3} name="Speech Richness" />
                  <Line type="monotone" dataKey="memory_score" stroke="#F59E0B" strokeWidth={3} name="Memory Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-slate-50 p-8 rounded-2xl text-center text-slate-500 text-sm border border-dashed border-slate-200">
              Complete additional Daily Check-ins to unlock trend analysis.
            </div>
          )}
        </div>

        {/* 4. Timeline & Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in-up delay-400">
          
          {/* Timeline */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-4">
            <h2 className="text-lg font-extrabold text-slate-900">Health History Timeline</h2>
            
            {speechAssessments.length > 0 ? (
              <div className="relative border-l border-slate-200 ml-3 pl-5 space-y-6">
                {speechAssessments.map((item: any, idx: number) => {
                  const itemScore = calculateDerivedScore(item.speech_score ?? 80, item.memory_score ?? 80, item.face_verified ?? false, true);
                  
                  let dotColor = "bg-green-500";
                  if (itemScore < 75) dotColor = "bg-red-500 animate-pulse";
                  else if (itemScore < 85) dotColor = "bg-amber-500";

                  return (
                    <div key={idx} className="relative">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[26px] mt-1 w-3 h-3 rounded-full ${dotColor}`} />
                      
                      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-slate-500 font-bold font-mono">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                          <span className="text-xs font-extrabold text-blue-700">
                            Health Score: {itemScore}%
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 italic">
                          "{item.transcript || 'Check-in completed without speech transcription.'}"
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No health records yet.</p>
            )}
          </div>

          {/* Safety & Face Verifications Logs */}
          <div className="space-y-6">
            
            {/* Face Log */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Identity Verification Logs</h3>
              {faceVerifications.length > 0 ? (
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {faceVerifications.slice(0, 5).map((f: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs border-b pb-2 last:border-0 last:pb-0">
                      <span className="font-medium text-slate-600">{new Date(f.timestamp).toLocaleDateString()}</span>
                      <span className={`px-2 py-0.5 rounded text-xxs font-bold ${f.verified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {f.verified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-xs">No verification logs.</p>
              )}
            </div>

            {/* Fall Alerts Log */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Safety Event Logs</h3>
              {fallEvents.length > 0 ? (
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {fallEvents.map((fall: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs border-b pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-bold text-slate-800">{fall.event_type}</p>
                        <p className="text-xxs text-slate-400">{new Date(fall.timestamp).toLocaleTimeString()}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xxs font-bold ${fall.alert_status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {fall.alert_status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-xs">No safety events logged.</p>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
