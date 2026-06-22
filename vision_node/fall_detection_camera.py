from ultralytics import YOLO
import cv2
import time
import requests
import os

# Load YOLO Pose Model
try:
    model = YOLO(os.path.join(os.path.dirname(os.path.dirname(__file__)), "vision", "yolov8n-pose.pt"))
except Exception as e:
    print(f"Error loading YOLO model: {e}")
    exit(1)

API_URL = "http://localhost:8000/api/events/fall"
PATIENT_ID = "PAT-0001" # Hardcoded for demo/standalone node

# Webcam (DirectShow for Windows stability)
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

fall_start_time = None
fall_detected = False
last_alert_time = 0

print("🎥 SilentCare Fall Detection Node Started...")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame, verbose=False)
    annotated = results[0].plot()

    if len(results[0].keypoints.data) > 0:
        kp = results[0].keypoints.data[0]
        if len(kp) >= 17:
            left_shoulder, right_shoulder = kp[5], kp[6]
            left_ankle, right_ankle = kp[15], kp[16]

            ankle_visible = (left_ankle[2] > 0.5 and right_ankle[2] > 0.5)

            if ankle_visible:
                shoulder_y = (left_shoulder[1] + right_shoulder[1]) / 2
                ankle_y = (left_ankle[1] + right_ankle[1]) / 2
                body_height = abs(ankle_y - shoulder_y)
                body_width = abs(right_shoulder[0] - left_shoulder[0])
                
                ratio = body_width / body_height if body_height > 0 else 0

                if ratio > 0.5:
                    status = "LYING"
                    color = (0, 0, 255)
                    if fall_start_time is None:
                        fall_start_time = time.time()
                    elapsed = time.time() - fall_start_time
                    if elapsed > 3:
                        fall_detected = True
                else:
                    status = "STANDING"
                    color = (0, 255, 0)
                    fall_start_time = None
                    fall_detected = False

                cv2.putText(annotated, f"Status: {status}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)

                # TRIGGER ALERT
                if fall_detected and (time.time() - last_alert_time > 10):
                    print("🚨 FALL DETECTED! Sending alert to Backend API...")
                    # Save temporary image
                    img_path = "temp_fall.jpg"
                    cv2.imwrite(img_path, frame)
                    
                    try:
                        with open(img_path, "rb") as img_file:
                            files = {"image_file": img_file}
                            res = requests.post(f"{API_URL}?patient_id={PATIENT_ID}", files=files)
                            print(f"✅ Backend Response: {res.status_code}")
                    except Exception as e:
                        print(f"❌ Failed to send alert: {e}")
                        
                    last_alert_time = time.time()
                    fall_detected = False # Reset

            else:
                cv2.putText(annotated, "FULL BODY NOT VISIBLE", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)

    cv2.imshow("SilentCare Fall Detection Node", annotated)

    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
