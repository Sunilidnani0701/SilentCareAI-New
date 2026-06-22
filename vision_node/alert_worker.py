import threading
import queue
import requests
import json
import time

BACKEND_URL = "http://localhost:8000/api/vision/alert"

class AlertWorker:
    def __init__(self):
        self.q = queue.Queue()
        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()
        print("🟢 Alert Worker Thread Started.")

    def put_alert(self, payload: dict):
        """Non-blocking call to queue an alert"""
        self.q.put(payload)

    def _worker_loop(self):
        while True:
            try:
                # Wait for an alert payload
                payload = self.q.get()
                
                print(f"🔄 Sending {payload.get('event_type')} alert to Backend...")
                
                # Send HTTP POST
                response = requests.post(BACKEND_URL, json=payload, timeout=5)
                
                if response.status_code == 200:
                    print(f"✅ Alert successfully sent to Backend!")
                else:
                    print(f"❌ Backend rejected alert: {response.status_code}")
                    
                self.q.task_done()
                
            except Exception as e:
                print(f"⚠️ Failed to send alert: {e}")
            
            time.sleep(0.01) # Small sleep to prevent CPU spin
