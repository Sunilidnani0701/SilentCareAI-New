"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "../../../config";

interface TrendData {
  timestamp: string;
  overall_score: number;
  speech_score: number;
  lexical_diversity: number;
  face_verified: boolean;
}

interface DashboardData {
  patient: { name: string; streak_days: number; compliance_percentage: number };
  trends: TrendData[];
}

export default function HistoryPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const patientId = localStorage.getItem("patient_id");
    if (!patientId) return;

    fetch(`${API_BASE_URL}/assessment_history/${patientId}`)
      .then(res => {
        if (!res.ok) throw new Error("History API error");
        return res.json();
      })
      .then(d => setData(d))
      .catch(err => {
        console.warn("History API unreachable, loading local simulation data:", err);
        const localCheckins = JSON.parse(localStorage.getItem(`mock_checkins_${patientId}`) || "[]");
        setData({
          patient: {
            name: localStorage.getItem("patient_name") || "Patient",
            streak_days: localCheckins.length > 0 ? localCheckins.length : 1,
            compliance_percentage: 100
          },
          trends: localCheckins.map((c: any) => ({
            timestamp: c.timestamp,
            overall_score: c.overall_score,
            speech_score: c.speech_score,
            lexical_diversity: c.lexical_diversity,
            face_verified: c.face_verified
          }))
        });
      });
  }, []);

  if (!data) return <div className="p-8 text-center text-slate-500 font-medium">Loading Health History...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{data.patient.name}'s Health History</h1>
            <p className="text-slate-500 text-sm mt-0.5 font-medium">View your cognitive and physical check-in records.</p>
          </div>
          <Link href="/patient/checkin" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 py-2.5 rounded-xl font-bold text-center text-sm transition shadow-md shadow-blue-500/20 w-full sm:w-auto">
            Start Today's Check-in
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Current Streak</span>
            <div className="text-3xl font-black text-blue-600 mt-2">{data.patient.streak_days} Days</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Adherence</span>
            <div className="text-3xl font-black text-green-600 mt-2">{data.patient.compliance_percentage}%</div>
          </div>
        </div>

        {/* History Log */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-xl font-extrabold text-slate-900">Health Timeline</h2>
          {data.trends.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500">
              No health records yet. Complete today's Daily Check-in to begin tracking your health.
            </div>
          ) : (
            <div className="relative border-l border-slate-200 ml-3 pl-5 space-y-6">
              {[...data.trends].reverse().map((t, idx) => {
                let dotColor = "bg-green-500";
                if (t.overall_score < 75) dotColor = "bg-red-500 animate-pulse";
                else if (t.overall_score < 85) dotColor = "bg-amber-500";

                return (
                  <div key={idx} className="relative animate-fade-in-up">
                    {/* Timeline dot */}
                    <span className={`absolute -left-[26px] mt-2.5 w-3 h-3 rounded-full ${dotColor}`} />

                    <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-slate-50/80 border border-slate-100 rounded-xl hover:bg-slate-50 transition gap-4">
                      <div>
                        <div className="font-bold text-slate-850 text-base">{new Date(t.timestamp).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-500 font-medium mt-1">
                          Face Identity: {t.face_verified ? "Verified ✅" : "Unverified ❌"} | Vocabulary Richness: {(t.lexical_diversity * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-lg border border-slate-100 shadow-sm shrink-0 w-fit">
                        <div className="text-right">
                          <div className="text-xl font-black text-blue-900 leading-none">{t.overall_score}</div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Health Score</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
