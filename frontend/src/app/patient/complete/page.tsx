"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AssessmentCompletePage() {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [submissionTime, setSubmissionTime] = useState("");

  useEffect(() => {
    setPatientId(localStorage.getItem("patient_id") || "PAT-0001");
    setSubmissionTime(new Date().toLocaleString());
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md w-full text-center space-y-6">
        
        {/* Success Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900">Assessment Completed Successfully</h1>
          <p className="text-slate-500 text-sm">Patient ID: <span className="font-semibold text-slate-700">{patientId}</span></p>
          <p className="text-slate-500 text-xs">Submitted on: {submissionTime}</p>
        </div>

        <p className="text-slate-600 text-sm leading-relaxed">
          Thank you. Your daily assessment has been submitted successfully. Your report has been saved and is available to your caregiver.
        </p>

        <div className="pt-4 flex flex-col gap-3">
          <Link href="/" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition">
            Return Home
          </Link>
          <button 
            onClick={handleLogout}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
          >
            Logout
          </button>
        </div>

      </div>
    </div>
  );
}
