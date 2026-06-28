"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { API_BASE_URL } from "../../config";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    full_name: "", 
    age: 70, 
    gender: "Male",
    caregiver_name: "", 
    caregiver_contact: "", 
    reminder_time: "08:00"
  });
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Use FormData since the backend POST /register expects Form fields
    const form = new FormData();
    form.append("full_name", formData.full_name);
    form.append("age", formData.age.toString());
    form.append("gender", formData.gender);
    form.append("caregiver_name", formData.caregiver_name);
    form.append("caregiver_contact", formData.caregiver_contact);
    form.append("reminder_time", formData.reminder_time);

    try {
      const res = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        body: form // Sends as multipart/form-data
      });
      
      if (res.ok) {
        const data = await res.json();
        // Save locally too for consistency
        const localPatients = JSON.parse(localStorage.getItem("mock_patients") || "[]");
        const newPatient = {
          id: data.patient_id,
          patient_id: data.patient_id,
          full_name: formData.full_name,
          name: formData.full_name,
          age: formData.age,
          gender: formData.gender,
          caregiver_name: formData.caregiver_name,
          caregiver_contact: formData.caregiver_contact,
          reminder_time: formData.reminder_time,
          streak_days: 1,
          compliance_percentage: 100,
          last_checkin: new Date().toISOString()
        };
        localPatients.push(newPatient);
        localStorage.setItem("mock_patients", JSON.stringify(localPatients));
        
        setSuccess(data.patient_id);
        setTimeout(() => router.push("/login"), 2500);
      } else {
        throw new Error("Registration API returned non-ok status");
      }
    } catch (err) {
      console.warn("Registration API unreachable, falling back to LocalStorage (Demo Mode):", err);
      
      const localPatients = JSON.parse(localStorage.getItem("mock_patients") || "[]");
      const nextIdNum = localPatients.length + 1;
      const mockPatientId = `PAT-${nextIdNum.toString().padStart(4, '0')}`;
      
      const newPatient = {
        id: mockPatientId,
        patient_id: mockPatientId,
        full_name: formData.full_name,
        name: formData.full_name,
        age: formData.age,
        gender: formData.gender,
        caregiver_name: formData.caregiver_name,
        caregiver_contact: formData.caregiver_contact,
        reminder_time: formData.reminder_time,
        streak_days: 1,
        compliance_percentage: 100,
        last_checkin: new Date().toISOString()
      };
      
      localPatients.push(newPatient);
      localStorage.setItem("mock_patients", JSON.stringify(localPatients));
      
      setSuccess(mockPatientId);
      setTimeout(() => router.push("/login"), 2500);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 max-w-sm w-full text-center space-y-5 animate-scale-in">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-check-in">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Registration Successful!</h2>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-sm text-slate-600">Your Patient ID is:</p>
            <p className="text-2xl font-extrabold text-blue-700 mt-1">{success}</p>
          </div>
          <p className="text-sm text-slate-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-white p-8 sm:p-10 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 max-w-md w-full space-y-5 animate-fade-in-up">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Register for SilentCare</h1>
          <p className="text-sm text-slate-500">Create your health profile to begin daily monitoring.</p>
        </div>
        
        {/* Full Name */}
        <div>
          <label htmlFor="reg-name" className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
          <input 
            id="reg-name"
            className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder:text-slate-400" 
            placeholder="Enter your full name" 
            required 
            onChange={e => setFormData({...formData, full_name: e.target.value})} 
          />
        </div>

        {/* Age & Gender */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="reg-age" className="block text-sm font-semibold text-slate-700 mb-1.5">Age</label>
            <input 
              id="reg-age"
              type="number" 
              className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
              placeholder="Age" 
              required 
              onChange={e => setFormData({...formData, age: parseInt(e.target.value) || 70})} 
            />
          </div>
          <div className="flex-1">
            <label htmlFor="reg-gender" className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
            <select 
              id="reg-gender"
              className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
              onChange={e => setFormData({...formData, gender: e.target.value})}
            >
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>
        </div>

        {/* Caregiver Info */}
        <div>
          <label htmlFor="reg-caregiver" className="block text-sm font-semibold text-slate-700 mb-1.5">Caregiver Name</label>
          <input 
            id="reg-caregiver"
            className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder:text-slate-400" 
            placeholder="Enter caregiver's name" 
            required 
            onChange={e => setFormData({...formData, caregiver_name: e.target.value})} 
          />
        </div>
        <div>
          <label htmlFor="reg-phone" className="block text-sm font-semibold text-slate-700 mb-1.5">Caregiver Phone</label>
          <input 
            id="reg-phone"
            className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition placeholder:text-slate-400" 
            placeholder="Enter caregiver's phone number" 
            required 
            onChange={e => setFormData({...formData, caregiver_contact: e.target.value})} 
          />
        </div>

        {/* Reminder Time */}
        <div>
          <label htmlFor="reg-time" className="block text-sm font-semibold text-slate-700 mb-1.5">Daily Reminder Time</label>
          <input 
            id="reg-time"
            type="time" 
            className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
            required 
            value={formData.reminder_time} 
            onChange={e => setFormData({...formData, reminder_time: e.target.value})} 
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white p-3.5 rounded-xl font-bold text-base transition shadow-lg shadow-blue-500/25 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Registering...
            </span>
          ) : "Complete Registration"}
        </button>

        <p className="text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="text-blue-600 font-semibold hover:text-blue-700 transition">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
