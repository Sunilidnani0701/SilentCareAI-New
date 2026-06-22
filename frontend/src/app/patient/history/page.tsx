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
      .then(res => res.json())
      .then(d => setData(d))
      .catch(err => console.error(err));
  }, []);

  if (!data) return <div className="p-8 text-center">Loading Assessment History...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{data.patient.name}'s History</h1>
            <p className="text-gray-500">View your cognitive and physical assessment records.</p>
          </div>
          <Link href="/patient/checkin" className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700">
            Take Assessment
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm text-center">
            <div className="text-sm text-gray-500 uppercase tracking-wide">Current Streak</div>
            <div className="text-4xl font-bold text-blue-600 mt-2">{data.patient.streak_days} Days</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm text-center">
            <div className="text-sm text-gray-500 uppercase tracking-wide">Adherence</div>
            <div className="text-4xl font-bold text-green-500 mt-2">{data.patient.compliance_percentage}%</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-bold mb-4">Assessment Log</h2>
          {data.trends.length === 0 ? (
            <p className="text-gray-500">No assessments completed yet.</p>
          ) : (
            <div className="space-y-4">
              {[...data.trends].reverse().map((t, idx) => (
                <div key={idx} className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50">
                  <div>
                    <div className="font-semibold text-gray-800">{new Date(t.timestamp).toLocaleDateString()}</div>
                    <div className="text-sm text-gray-500">
                      Face Verified: {t.face_verified ? "✅" : "❌"} | Lexical TTR: {t.lexical_diversity.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-900">{t.overall_score}</div>
                    <div className="text-xs text-gray-400 uppercase">Overall Score</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
