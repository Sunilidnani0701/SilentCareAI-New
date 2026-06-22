import cv2
import time
import math
import os
import datetime
from ultralytics import YOLO
from alert_worker import AlertWorker
import threading
from flask import Flask, Response

# 1. Initialize YOLO and Worker
model = YOLO("yolov8n-pose.pt")
worker = AlertWorker()

# 2. Flask Setup for MJPEG Streaming
flask_app = Flask(__name__)
output_frame = None
frame_lock = threading.Lock()

def generate():
    global output_frame, frame_lock
    while True:
        with frame_lock:
            if output_frame is None:
                continue
            (flag, encodedImage) = cv2.imencode(".jpg", output_frame)
            if not flag:
                continue
        yield(b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + bytearray(encodedImage) + b'\r\n')

@flask_app.route("/video_feed")
def video_feed():
    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")

# 3. State Tracking Dictionaries (Mapped by track_id)
# Fall State
fall_start_times = {}
fall_alert_sent = {}

# Face/Responsiveness State
last_nose_positions = {}
last_movement_times = {}
unresponsive_alert_sent = {}

# Ensure snapshots folder exists
SNAPSHOTS_DIR = "alerts_snapshots"
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

def generate_snapshot(frame, track_id, event_type):
    """Saves the current frame to disk and returns the relative path."""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{event_type.lower()}_track{track_id}_{timestamp}.jpg"
    filepath = os.path.join(SNAPSHOTS_DIR, filename)
    cv2.imwrite(filepath, frame)
    return filepath

def main():
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    print("🎥 Starting Unified Computer Vision Stream...")
    
    # Start Flask Server in Background
    flask_thread = threading.Thread(target=lambda: flask_app.run(host="0.0.0.0", port=5001, debug=False, use_reloader=False))
    flask_thread.daemon = True
    flask_thread.start()
    print("🌐 MJPEG Stream running on http://localhost:5001/video_feed")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # 3. Single YOLO Inference Pass with Tracking (ByteTrack/BoT-SORT)
        # Using persist=True tracks individuals across frames
        results = model.track(frame, persist=True, tracker="botsort.yaml", verbose=False)
        annotated = results[0].plot()
        
        # Check if any keypoints exist in the frame
        if len(results[0].keypoints.data) > 0 and results[0].boxes.id is not None:
            
            # 4. Process each detected person
            for i in range(len(results[0].boxes.id)):
                track_id = int(results[0].boxes.id[i].item())
                kp = results[0].keypoints.data[i]
                
                # --- Fall Detection Logic ---
                left_shoulder = kp[5]
                right_shoulder = kp[6]
                left_ankle = kp[15]
                right_ankle = kp[16]
                
                ankle_visible = (left_ankle[2] > 0.5 and right_ankle[2] > 0.5)
                ratio = 0.0
                
                if ankle_visible:
                    shoulder_y = (left_shoulder[1] + right_shoulder[1]) / 2
                    ankle_y = (left_ankle[1] + right_ankle[1]) / 2
                    body_height = abs(ankle_y - shoulder_y)
                    body_width = abs(right_shoulder[0] - left_shoulder[0])
                    
                    if body_height > 0:
                        ratio = body_width / body_height
                    
                    if ratio > 0.5:
                        if track_id not in fall_start_times:
                            fall_start_times[track_id] = time.time()
                            fall_alert_sent[track_id] = False
                            
                        elapsed = time.time() - fall_start_times[track_id]
                        
                        if elapsed > 3.0 and not fall_alert_sent[track_id]:
                            # Trigger Fall Alert
                            snapshot_path = generate_snapshot(annotated, track_id, "FALL_DETECTED")
                            worker.put_alert({
                                "event_id": f"evt_fall_{track_id}_{int(time.time())}",
                                "track_id": track_id,
                                "event_type": "FALL_DETECTED",
                                "confidence": float(results[0].boxes.conf[i].item()),
                                "timestamp": datetime.datetime.now().isoformat(),
                                "snapshot_path": snapshot_path,
                                "metadata": {"body_ratio": float(ratio), "status": "LYING"}
                            })
                            fall_alert_sent[track_id] = True
                            
                        cv2.putText(annotated, f"ID {track_id} FALLING! ({elapsed:.1f}s)", (20, 50 + (track_id * 30)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                    else:
                        # Reset Fall state
                        if track_id in fall_start_times:
                            del fall_start_times[track_id]
                            fall_alert_sent[track_id] = False
                
                # --- Face Analysis / Responsiveness Logic ---
                nose = kp[0]
                left_eye = kp[1]
                right_eye = kp[2]
                
                face_visible = (nose[2] > 0.5 and left_eye[2] > 0.5 and right_eye[2] > 0.5)
                
                if face_visible:
                    current_x, current_y = nose[0].item(), nose[1].item()
                    
                    if track_id not in last_movement_times:
                        last_movement_times[track_id] = time.time()
                        last_nose_positions[track_id] = (current_x, current_y)
                        unresponsive_alert_sent[track_id] = False
                        
                    last_x, last_y = last_nose_positions[track_id]
                    movement = math.sqrt((current_x - last_x) ** 2 + (current_y - last_y) ** 2)
                    
                    if movement > 10:
                        last_movement_times[track_id] = time.time()
                        unresponsive_alert_sent[track_id] = False # Reset alert if they move
                        
                    last_nose_positions[track_id] = (current_x, current_y)
                    
                    still_time = time.time() - last_movement_times[track_id]
                    
                    if still_time > 10.0 and not unresponsive_alert_sent[track_id]:
                        # Trigger Unresponsive Alert
                        snapshot_path = generate_snapshot(annotated, track_id, "UNRESPONSIVE")
                        worker.put_alert({
                            "event_id": f"evt_unresp_{track_id}_{int(time.time())}",
                            "track_id": track_id,
                            "event_type": "UNRESPONSIVE",
                            "confidence": float(results[0].boxes.conf[i].item()),
                            "timestamp": datetime.datetime.now().isoformat(),
                            "snapshot_path": snapshot_path,
                            "metadata": {"still_time_seconds": float(still_time)}
                        })
                        unresponsive_alert_sent[track_id] = True
                        
                    if still_time > 10.0:
                        cv2.putText(annotated, f"ID {track_id} UNRESPONSIVE!", (20, 80 + (track_id * 30)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

        cv2.imshow("SilentCare Unified Vision Node", annotated)
        
        with frame_lock:
            output_frame = annotated.copy()

        if cv2.waitKey(1) & 0xFF == 27:
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
