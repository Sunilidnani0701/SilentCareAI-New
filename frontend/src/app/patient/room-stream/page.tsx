"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { API_BASE_URL } from "../../../config";

export default function PatientRoomStreamPage() {
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [connStatus, setConnStatus] = useState("Disconnected");
  const [serverStatus, setServerStatus] = useState("Normal");
  const [feedbackImage, setFeedbackImage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    setPatientId(localStorage.getItem("patient_id") || "PAT-0001");
    setPatientName(localStorage.getItem("patient_name") || "John Doe");
  }, []);

  const getWebSocketUrl = () => {
    const base = API_BASE_URL.replace(/^http/, "ws");
    return `${base}/api/vision/stream?role=sender&patient_id=${patientId}`;
  };

  const startStream = async () => {
    if (isStreaming) return;
    
    try {
      // 1. Get webcam video stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: { max: 15 } }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      
      // 2. Open WebSocket connection to backend
      const wsUrl = getWebSocketUrl();
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      setConnStatus("Connecting...");
      
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;
      
      ws.onopen = () => {
        setConnStatus("Connected");
        setIsStreaming(true);
        
        // 3. Start periodic frame sending loop (~10 FPS / every 100ms)
        intervalRef.current = setInterval(() => {
          if (videoRef.current && canvasRef.current && ws.readyState === WebSocket.OPEN) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            
            if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              // Compress to JPEG at 70% quality to save bandwidth
              const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
              ws.send(dataUrl);
            }
          }
        }, 100);
      };
      
      ws.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data);
          setServerStatus(res.status || "Normal");
          if (res.image) {
            setFeedbackImage(res.image);
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };
      
      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        setConnStatus("Error");
      };
      
      ws.onclose = () => {
        setConnStatus("Disconnected");
        stopStream();
      };
      
    } catch (err) {
      console.error("Camera access failed:", err);
      alert("Camera access failed. Please ensure you have granted camera permissions. Note: Browsers require HTTPS or localhost for camera access.");
      setConnStatus("Camera Error");
    }
  };

  const stopStream = () => {
    // Stop intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Close WebSocket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    // Stop camera tracks
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setIsStreaming(false);
    setIsCameraActive(false);
    setConnStatus("Disconnected");
    setFeedbackImage(null);
    setServerStatus("Normal");
  };

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Live Safety Monitoring</h1>
            <p className="text-slate-500 mt-1">Streams real-time room visuals to the caregiver dashboard.</p>
          </div>
          <Link href={`/patient/checkin`} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 font-semibold text-slate-700 transition text-sm">
            Back to Check-in
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Config & Controls */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <h2 className="text-xl font-bold text-slate-800">Monitoring Status</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Patient Name</label>
                <input 
                  type="text" 
                  value={patientName} 
                  disabled 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-850 cursor-not-allowed"
                />
              </div>
              
              <div>
                <label htmlFor="patient-id-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Patient ID (Room Sensor Source)</label>
                <input 
                  id="patient-id-input"
                  type="text" 
                  value={patientId} 
                  disabled
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 cursor-not-allowed opacity-60"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
              {!isStreaming ? (
                <button 
                  onClick={startStream}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-base font-bold shadow-lg shadow-blue-500/20 transition transform hover:-translate-y-0.5"
                >
                  🟢 Start Safety Monitoring
                </button>
              ) : (
                <button 
                  onClick={stopStream}
                  className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl text-base font-bold shadow-lg shadow-red-500/20 transition transform hover:-translate-y-0.5"
                >
                  🔴 Stop Monitoring
                </button>
              )}
            </div>

            {/* Diagnostic stats */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-3.5 text-xs font-medium border border-slate-200/60">
              <div className="flex justify-between">
                <span className="text-slate-500">Connection Status:</span>
                <span className={`font-bold ${connStatus === "Connected" ? "text-green-600" : connStatus === "Connecting..." ? "text-amber-500" : "text-red-500"}`}>
                  {connStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">AI Processing:</span>
                <span className="font-bold text-slate-700">{isStreaming ? "10 frames/sec" : "Idle"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">System Status:</span>
                <span className="font-bold text-green-600">Online</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/80 pt-2.5">
                <span className="text-slate-500">Fall Detection Status:</span>
                <span className={`font-bold ${serverStatus.includes("FALL") || serverStatus.includes("UNRESPONSIVE") ? "text-red-600 animate-pulse" : "text-green-600"}`}>
                  {serverStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Video Feeds Container */}
          <div className="space-y-6">
            
            {/* Real Camera Preview */}
            <div className="bg-slate-900 aspect-video rounded-2xl relative overflow-hidden flex flex-col items-center justify-center text-center p-4 border border-slate-800 shadow-md">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className={`absolute inset-0 w-full h-full object-cover ${isStreaming ? "block" : "hidden"}`} 
              />
              {!isStreaming && (
                <p className="text-slate-400 text-sm font-medium">Waiting for Camera...</p>
              )}
              
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur text-slate-300 px-2.5 py-1 rounded text-xxs font-bold uppercase tracking-wider">
                LOCAL WEBCAM PREVIEW
              </div>
            </div>

            {/* AI Processed Feed (Feedback loop from backend) */}
            <div className="bg-slate-950 aspect-video rounded-2xl relative overflow-hidden flex flex-col items-center justify-center text-center p-4 border-2 border-blue-500 shadow-lg">
              {feedbackImage ? (
                <img 
                  src={feedbackImage} 
                  alt="AI Safety Monitoring" 
                  className="absolute inset-0 w-full h-full object-contain"
                />
              ) : (
                <p className="text-slate-500 text-sm font-medium">Waiting for AI analysis...</p>
              )}
              <div className="absolute top-3 left-3 bg-blue-900/90 text-blue-100 px-2.5 py-1 rounded text-xxs font-bold uppercase tracking-wider">
                AI Safety Monitoring
              </div>
            </div>
            
          </div>
        </div>

        {/* Hidden elements for capturing frame bytes */}
        <canvas ref={canvasRef} width={640} height={480} className="hidden" />
        
      </div>
    </div>
  );
}
