import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-extrabold text-blue-900 tracking-tight">SilentCare AI</h1>
        <p className="text-xl text-gray-600">The premier ambient health monitoring platform for independent elderly living.</p>
        
        <div className="flex gap-4 justify-center mt-8">
          <Link href="/login" className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
            Patient Login
          </Link>
          <Link href="/register" className="px-6 py-3 bg-white text-blue-600 font-semibold border border-blue-200 rounded-lg hover:bg-blue-50 transition">
            Register New Patient
          </Link>
        </div>
      </div>
    </div>
  );
}
