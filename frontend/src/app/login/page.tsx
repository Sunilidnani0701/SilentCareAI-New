"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { API_BASE_URL } from "../../config";

export default function LoginPage() {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patientId, full_name: fullName })
      });
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("patient_id", data.patient.id);
        localStorage.setItem("patient_name", data.patient.name);
        localStorage.removeItem("admin_logged_in");
        router.push("/patient/checkin");
        return;
      }
    } catch (err) {
      console.warn("Login API unreachable, searching locally in Demo Mode:", err);
    }
    
    // Local storage lookup
    const localPatients = JSON.parse(localStorage.getItem("mock_patients") || "[]");
    const matched = localPatients.find((p: any) => 
      p.patient_id.trim().toLowerCase() === patientId.trim().toLowerCase() && 
      p.full_name.trim().toLowerCase() === fullName.trim().toLowerCase()
    );
    
    if (matched) {
      localStorage.setItem("patient_id", matched.patient_id);
      localStorage.setItem("patient_name", matched.full_name);
      localStorage.removeItem("admin_logged_in");
      router.push("/patient/checkin");
    } else {
      setError("We couldn't find your account. Please check your Patient ID and Full Name, or register as a new patient.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-6">
      <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 max-w-sm w-full space-y-7 animate-fade-in-up">
        
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">SilentCare Login</h1>
          <p className="text-sm text-slate-500 leading-relaxed">Detecting the silent signs before they become emergencies.</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 leading-relaxed animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="patient-id" className="block text-sm font-semibold text-slate-700 mb-1.5">Patient ID</label>
            <input 
              id="patient-id"
              className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 text-base bg-slate-50/50 transition placeholder:text-slate-400" 
              placeholder="e.g. PAT-0001" 
              required 
              value={patientId}
              onChange={e => setPatientId(e.target.value)} 
            />
          </div>
          <div>
            <label htmlFor="full-name" className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
            <input 
              id="full-name"
              className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 text-base bg-slate-50/50 transition placeholder:text-slate-400" 
              placeholder="Enter your full name" 
              required 
              value={fullName}
              onChange={e => setFullName(e.target.value)} 
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white p-3.5 rounded-xl font-bold text-base transition shadow-lg shadow-blue-500/25 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Signing in...
              </span>
            ) : "Sign In"}
          </button>
        </form>

        <div className="text-center space-y-2 pt-1">
          <p className="text-sm text-slate-500">
            New to SilentCare? <Link href="/register" className="text-blue-600 font-semibold hover:text-blue-700 transition">Register here</Link>
          </p>
          <Link href="/admin/login" className="text-xs text-slate-400 hover:text-slate-600 transition">Caregiver Portal</Link>
        </div>
      </div>
    </div>
  );
}
