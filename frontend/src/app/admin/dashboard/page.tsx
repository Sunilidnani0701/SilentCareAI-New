"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Patient {
  patient_id: string;
  full_name: string;
  age: number;
  caregiver_contact: string;
  streak_days: number;
  compliance_percentage: number;
  last_checkin: string | null;
  face_status?: string;
  fall_status?: string;
}

import { API_BASE_URL } from "../../../config";

export default function AdminDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatients = () => {
      fetch(`${API_BASE_URL}/admin/patients`)
        .then(res => {
          if (!res.ok) throw new Error("Admin patients fetch failed");
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setPatients(data);
          } else {
            setPatients([]);
          }
          setLoading(false);
        })
        .catch(err => {
          console.warn("Admin patients API unreachable, reading locally registered patients:", err);
          const localPatients = JSON.parse(localStorage.getItem("mock_patients") || "[]");
          setPatients(localPatients);
          setLoading(false);
        });
    };

    fetchPatients();
    const interval = setInterval(fetchPatients, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-semibold text-slate-500">Loading Caregiver Dashboard...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Caregiver Dashboard</h1>
            <p className="text-slate-500 mt-1">Overview of all registered patients across the platform.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Link href="/admin/live-feed" className="px-4 py-2.5 bg-red-50 text-red-700 border border-red-100 rounded-xl shadow-sm hover:bg-red-100 font-bold transition flex items-center gap-2 w-full sm:w-auto justify-center text-sm">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
              Live Safety Monitoring
            </Link>
            <Link href="/" className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 font-semibold w-full sm:w-auto text-center text-sm">
              Home
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 card-hover">
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Total Patients</h3>
            <p className="text-4xl font-black text-slate-850 mt-2">{patients.length}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 card-hover">
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Avg Adherence</h3>
            <p className="text-4xl font-black text-blue-600 mt-2">
              {patients.length > 0 
                ? Math.round(patients.reduce((acc, p) => acc + p.compliance_percentage, 0) / patients.length) 
                : 0}%
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 card-hover">
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Active Alerts</h3>
            <p className="text-4xl font-black text-red-500 mt-2">
              {patients.filter(p => p.fall_status === "Fall Detected" || p.face_status === "UNRESPONSIVE").length}
            </p>
          </div>
        </div>

        {/* Directory Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-xl font-extrabold text-slate-900">Patient Directory</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-4">Patient ID</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Age</th>
                  <th className="p-4">Compliance</th>
                  <th className="p-4">Last Check-In</th>
                  <th className="p-4">Face Status</th>
                  <th className="p-4">Fall Status</th>
                  <th className="p-4">Caregiver Contact</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 font-medium">
                      No patients registered yet. Register a patient to begin monitoring.
                    </td>
                  </tr>
                ) : (
                  patients.map(p => (
                    <tr key={p.patient_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-900">{p.patient_id}</td>
                      <td className="p-4 text-slate-800 font-bold">{p.full_name}</td>
                      <td className="p-4 text-slate-600 font-medium">{p.age}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          p.compliance_percentage >= 80 ? "bg-green-100 text-green-700" :
                          p.compliance_percentage >= 50 ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {p.compliance_percentage}%
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 font-medium">
                        {p.last_checkin ? new Date(p.last_checkin).toLocaleString() : "Never"}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          p.face_status === 'UNRESPONSIVE' ? 'bg-red-100 text-red-700 animate-pulse' :
                          p.face_status === 'No Data' ? 'bg-slate-100 text-slate-600' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {p.face_status || 'RESPONSIVE'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          p.fall_status === 'Fall Detected' ? 'bg-red-600 text-white animate-pulse' :
                          p.fall_status === 'Unresponsive Alert' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {p.fall_status || 'No Active Alerts'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 font-mono font-medium">{p.caregiver_contact}</td>
                      <td className="p-4">
                        <Link 
                          href={`/patient/${p.patient_id}/dashboard`}
                          className="inline-block px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-sm hover:shadow"
                        >
                          View Report
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
