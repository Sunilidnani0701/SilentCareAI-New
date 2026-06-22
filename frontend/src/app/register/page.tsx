"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        alert(`Registration Successful!\n\nYour Patient ID is: ${data.patient_id}\n\nPlease save this ID to login.`);
        router.push("/login");
      } else {
        const errData = await res.json();
        alert(`Registration failed: ${JSON.stringify(errData.detail || "Server error")}`);
      }
    } catch (err) {
      console.error("Registration error:", err);
      alert("Registration failed. Could not connect to backend server.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full space-y-4">
        <h2 className="text-2xl font-bold text-center text-gray-800">Register Patient</h2>
        <input className="w-full p-2 border rounded text-gray-900" placeholder="Full Name" required onChange={e => setFormData({...formData, full_name: e.target.value})} />
        <div className="flex gap-4">
          <input type="number" className="w-1/2 p-2 border rounded text-gray-900" placeholder="Age" required onChange={e => setFormData({...formData, age: parseInt(e.target.value) || 70})} />
          <select className="w-1/2 p-2 border rounded text-gray-900" onChange={e => setFormData({...formData, gender: e.target.value})}>
            <option>Male</option><option>Female</option>
          </select>
        </div>
        <input className="w-full p-2 border rounded text-gray-900" placeholder="Caregiver Name" required onChange={e => setFormData({...formData, caregiver_name: e.target.value})} />
        <input className="w-full p-2 border rounded text-gray-900" placeholder="Caregiver Phone" required onChange={e => setFormData({...formData, caregiver_contact: e.target.value})} />
        <input type="time" className="w-full p-2 border rounded text-gray-900" required value={formData.reminder_time} onChange={e => setFormData({...formData, reminder_time: e.target.value})} />
        
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded font-bold transition">Complete Registration</button>
      </form>
    </div>
  );
}
