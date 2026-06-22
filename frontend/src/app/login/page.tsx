"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { API_BASE_URL } from "../../config";

export default function LoginPage() {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [fullName, setFullName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_id: patientId, full_name: fullName })
    });
    
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("patient_id", data.patient.id);
      localStorage.setItem("patient_name", data.patient.name);
      router.push("/patient/checkin");
    } else {
      alert("Invalid credentials. Please verify your Patient ID and Full Name.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-800">Patient Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            className="w-full p-3 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" 
            placeholder="Enter Patient ID" 
            required 
            value={patientId}
            onChange={e => setPatientId(e.target.value)} 
          />
          <input 
            className="w-full p-3 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" 
            placeholder="Enter Full Name" 
            required 
            value={fullName}
            onChange={e => setFullName(e.target.value)} 
          />
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700">
            Login
          </button>
        </form>
        <div className="text-center text-sm text-gray-500">
          Don't have an account? <Link href="/register" className="text-blue-600 underline">Register here</Link>
        </div>
      </div>
    </div>
  );
}
