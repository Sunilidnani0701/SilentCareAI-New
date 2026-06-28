"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const savedUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "admin";
    const savedPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin";
    
    // Simple mock admin login since there isn't a specified admin backend endpoint yet
    if (username === savedUsername && password === savedPassword) {
      localStorage.setItem("admin_logged_in", "true");
      localStorage.removeItem("patient_id");
      localStorage.removeItem("patient_name");
      router.push("/admin/dashboard");
    } else {
      alert("Invalid admin credentials");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-sm w-full space-y-6 border border-gray-700">
        <h2 className="text-2xl font-bold text-center text-white">Admin Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            className="w-full p-3 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
            placeholder="Admin Username" 
            required 
            value={username}
            onChange={e => setUsername(e.target.value)} 
          />
          <input 
            type="password"
            className="w-full p-3 border border-gray-600 rounded bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
            placeholder="Password" 
            required 
            value={password}
            onChange={e => setPassword(e.target.value)} 
          />
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700 transition">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
