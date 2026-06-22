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

  // Poll patients lists for live safety states (polling every 3 seconds)
  useEffect(() => {
    const fetchPatients = () => {
      fetch(`${API_BASE_URL}/admin/patients`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setPatients(data);
          } else {
            setPatients([]);
            console.error("Expected array, got:", data);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    };

    fetchPatients();
    const interval = setInterval(fetchPatients, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Admin Data...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800">Caregiver Admin Portal</h1>
            <p className="text-slate-500 mt-1">Overview of all registered patients across the platform.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/live-feed" className="px-4 py-2 bg-red-50 text-red-700 border border-red-100 rounded-lg shadow-sm hover:bg-red-100 font-semibold transition flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
              Live Safety Feed
            </Link>
            <Link href="/" className="px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-slate-50 font-medium">
              Home
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-slate-500 font-medium">Total Patients</h3>
            <p className="text-4xl font-bold text-slate-800 mt-2">{patients.length}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-slate-500 font-medium">Avg Adherence</h3>
            <p className="text-4xl font-bold text-blue-600 mt-2">
              {patients.length > 0 
                ? Math.round(patients.reduce((acc, p) => acc + p.compliance_percentage, 0) / patients.length) 
                : 0}%
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-slate-500 font-medium">Active Alerts</h3>
            <p className="text-4xl font-bold text-red-500 mt-2">
              {patients.filter(p => p.fall_status === "Fall Detected" || p.face_status === "UNRESPONSIVE").length}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">Patient Directory</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-sm">
                <tr>
                  <th className="p-4 font-medium">Patient ID</th>
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Age</th>
                  <th className="p-4 font-medium">Compliance</th>
                  <th className="p-4 font-medium">Last Check-In</th>
                  <th className="p-4 font-medium">Face Status</th>
                  <th className="p-4 font-medium">Fall Status</th>
                  <th className="p-4 font-medium">Caregiver Contact</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">No patients registered yet.</td>
                  </tr>
                ) : (
                  patients.map(p => (
                    <tr key={p.patient_id} className="hover:bg-slate-50 transition-colors text-sm">
                      <td className="p-4 font-medium text-slate-900">{p.patient_id}</td>
                      <td className="p-4 text-slate-700 font-semibold">{p.full_name}</td>
                      <td className="p-4 text-slate-600">{p.age}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.compliance_percentage >= 80 ? "bg-green-100 text-green-700" :
                          p.compliance_percentage >= 50 ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {p.compliance_percentage}%
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">
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
                      <td className="p-4 text-slate-600">{p.caregiver_contact}</td>
                      <td className="p-4">
                        <Link 
                          href={`/patient/${p.patient_id}/dashboard`}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
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
