"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "../../../config";

interface Patient {
  patient_id: string;
  full_name: string;
  age: number;
  reminder_time: string;
  caregiver_name: string;
}

export default function ProfilePage() {
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    const pid = localStorage.getItem("patient_id");
    if (!pid) return;
    fetch(`${API_BASE_URL}/api/patient/${pid}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load patient from server");
        return res.json();
      })
      .then(data => setPatient(data))
      .catch(err => {
        console.warn("Profile API unreachable, falling back to local database:", err);
        const localPatients = JSON.parse(localStorage.getItem("mock_patients") || "[]");
        const matched = localPatients.find((p: any) => p.patient_id === pid);
        if (matched) {
          setPatient(matched);
        } else {
          setPatient({
            patient_id: pid,
            full_name: localStorage.getItem("patient_name") || "Demo Patient",
            age: 75,
            reminder_time: "08:00",
            caregiver_name: "John Doe (Caregiver)"
          });
        }
      });
  }, []);

  if (!patient) return <div className="p-8 text-center">Loading Profile...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-800">Patient Profile</h2>
        
        <div className="space-y-4">
          <div className="border-b pb-2">
            <span className="text-sm text-gray-500 uppercase tracking-wide">Patient ID</span>
            <div className="text-lg font-semibold">{patient.patient_id}</div>
          </div>
          <div className="border-b pb-2">
            <span className="text-sm text-gray-500 uppercase tracking-wide">Full Name</span>
            <div className="text-lg font-semibold">{patient.full_name} (Age: {patient.age})</div>
          </div>
          <div className="border-b pb-2">
            <span className="text-sm text-gray-500 uppercase tracking-wide">Caregiver</span>
            <div className="text-lg font-semibold">{patient.caregiver_name}</div>
          </div>
          <div className="border-b pb-2">
            <span className="text-sm text-gray-500 uppercase tracking-wide">Daily Reminder Time</span>
            <div className="text-lg font-semibold">{patient.reminder_time}</div>
          </div>
        </div>

        <div className="pt-4 flex gap-4">
          <Link href="/patient/checkin" className="w-1/2 text-center bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700">
            Check-In
          </Link>
          <Link href="/patient/history" className="w-1/2 text-center bg-gray-100 text-gray-700 p-3 rounded font-bold hover:bg-gray-200 border">
            History
          </Link>
        </div>
      </div>
    </div>
  );
}
