import cv2
import time
import math
import os
import datetime
import sqlalchemy.orm as orm
import models.db_models as db_models

# Global state dictionaries for tracking patient states across frames
# Key format: f"{patient_id}_{track_id}"
fall_start_times = {}
fall_alert_sent = {}
last_nose_positions = {}
last_movement_times = {}
unresponsive_alert_sent = {}

def process_frame(frame, patient_id: str, pose_model, db: orm.Session, upload_dir: str):
    """
    Processes a single frame for a specific patient.
    Runs YOLOv8-pose tracking, evaluates fall and responsiveness states,
    creates DB alert events if needed, and returns the annotated frame.
    """
    if pose_model is None:
        return frame, "Model not loaded"

    # YOLO Inference with tracking (using persist=True, optimized with ByteTrack and imgsz=320)
    results = pose_model.track(frame, persist=True, tracker="bytetrack.yaml", verbose=False, imgsz=320)
    annotated = results[0].plot()
    
    # Ensure folder for snapshots exists
    falls_dir = os.path.join(upload_dir, "falls")
    os.makedirs(falls_dir, exist_ok=True)
    
    status_msg = "Normal"
    
    # Check if keypoints and box IDs exist
    if len(results[0].keypoints.data) > 0 and results[0].boxes.id is not None:
        for i in range(len(results[0].boxes.id)):
            track_id = int(results[0].boxes.id[i].item())
            kp = results[0].keypoints.data[i]
            state_key = f"{patient_id}_{track_id}"
            
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
                    if state_key not in fall_start_times:
                        fall_start_times[state_key] = time.time()
                        fall_alert_sent[state_key] = False
                        
                    elapsed = time.time() - fall_start_times[state_key]
                    
                    if elapsed > 3.0 and not fall_alert_sent[state_key]:
                        # Save snapshot
                        timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                        filename = f"fall_{patient_id}_track{track_id}_{timestamp_str}.jpg"
                        snapshot_path = os.path.join(falls_dir, filename)
                        cv2.imwrite(snapshot_path, annotated)
                        db_path = f"/uploads/falls/{filename}"
                        
                        # Create SafetyEvent in DB
                        event_id = f"evt_fall_{patient_id}_{int(time.time())}"
                        new_event = db_models.SafetyEvent(
                            event_id=event_id,
                            patient_id=patient_id,
                            timestamp=datetime.datetime.utcnow(),
                            event_source="CAMERA",
                            event_type="FALL",
                            snapshot_path=db_path,
                            confidence=float(results[0].boxes.conf[i].item()),
                            alert_status="DISPATCHED"
                        )
                        db.add(new_event)
                        db.commit()

                        # Notify caregiver via Telegram
                        from services.fall_service import send_telegram_notification
                        patient_name = "Patient"
                        db_patient = db.query(db_models.Patient).filter(db_models.Patient.patient_id == patient_id).first()
                        if db_patient:
                            patient_name = db_patient.full_name
                        
                        confidence = float(results[0].boxes.conf[i].item())
                        alert_msg = (
                            "🚨 <b>EMERGENCY ALERT</b> 🚨\n\n"
                            "⚠️ <b>Fall Detected!</b>\n"
                            f"👤 <b>Patient:</b> {patient_name} ({patient_id})\n"
                            f"🎯 <b>Confidence:</b> {confidence * 100:.0f}%\n"
                            f"📅 <b>Time:</b> {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} (IST)\n\n"
                            "🔴 Please check the Safety Monitoring live feed immediately."
                        )
                        
                        send_telegram_notification(alert_msg, snapshot_path)
                        
                        fall_alert_sent[state_key] = True
                        print(f"🚨 FALL DETECTED: alert dispatched for patient {patient_id}")
                        
                    status_msg = f"FALL DETECTED ({elapsed:.1f}s)"
                    cv2.putText(annotated, f"ID {track_id} FALLING! ({elapsed:.1f}s)", (20, 50 + (track_id * 30)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                else:
                    if state_key in fall_start_times:
                        del fall_start_times[state_key]
                        fall_alert_sent[state_key] = False
            
            # Face analysis/responsiveness logic disabled per requirements
                    
    return annotated, status_msg
