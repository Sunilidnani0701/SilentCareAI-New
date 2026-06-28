import os
import shutil
import uuid
import time
import requests
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import models.db_models as db_models

def send_telegram_notification(message: str, image_path: str = None):
    """
    Sends a Telegram notification to the caregiver/user when a safety event occurs.
    """
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    
    if not token or not chat_id:
        print("Telegram Bot config missing. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in environment.")
        return False
        
    try:
        if image_path and os.path.exists(image_path):
            url = f"https://api.telegram.org/bot{token}/sendPhoto"
            with open(image_path, "rb") as photo:
                files = {"photo": photo}
                data = {"chat_id": chat_id, "caption": message, "parse_mode": "HTML"}
                response = requests.post(url, data=data, files=files, timeout=10)
        else:
            url = f"https://api.telegram.org/bot{token}/sendMessage"
            data = {"chat_id": chat_id, "text": message, "parse_mode": "HTML"}
            response = requests.post(url, data=data, timeout=10)
            
        if response.status_code == 200:
            print("Telegram notification sent successfully.")
            return True
        else:
            print(f"Failed to send Telegram notification: {response.text}")
            return False
    except Exception as e:
        print(f"Error sending Telegram notification: {str(e)}")
        return False

def handle_vision_alert(payload: dict, db: Session, upload_dir: str) -> dict:
    """
    Processes incoming vision alerts (e.g. FALL_DETECTED, UNRESPONSIVE) from AlertWorker,
    copies the snapshots, and records the safety event in the SQLite database.
    """
    event_type = payload.get("event_type", "FALL_DETECTED")
    event_id = payload.get("event_id", str(uuid.uuid4()))
    confidence = payload.get("confidence", 1.0)
    snapshot_path_rel = payload.get("snapshot_path") # e.g. "alerts_snapshots/filename.jpg"
    
    # Resolve and Copy Snapshot File
    filename = os.path.basename(snapshot_path_rel) if snapshot_path_rel else f"fall_{int(time.time())}.jpg"
    
    # The snapshots are saved by vision_node in alerts_snapshots
    proj_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    src_path = os.path.join(proj_dir, "vision_node", snapshot_path_rel) if snapshot_path_rel else ""
    
    dest_path = os.path.join(upload_dir, "falls", filename)
    db_snapshot_path = f"/uploads/falls/{filename}"
    
    if src_path and os.path.exists(src_path):
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        shutil.copy(src_path, dest_path)
        print(f"Copied snapshot from {src_path} to {dest_path}")
    else:
        print(f"Warning: Source snapshot file not found: {src_path}")
        db_snapshot_path = None
        
    db_event_type = "FALL" if "FALL" in event_type else "UNRESPONSIVE"
    
    patient = db.query(db_models.Patient).first()
    patient_id = patient.patient_id if patient else "PAT-0001"
    
    new_event = db_models.SafetyEvent(
        event_id=event_id,
        patient_id=patient_id,
        timestamp=datetime.utcnow(),
        event_source="CAMERA",
        event_type=db_event_type,
        snapshot_path=db_snapshot_path,
        confidence=confidence,
        alert_status="DISPATCHED"
      )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    
    # Notify caregiver via Telegram
    patient_name = patient.full_name if patient else "Patient"
    alert_msg = (
        "🚨 <b>EMERGENCY ALERT</b> 🚨\n\n"
        "⚠️ <b>Fall Detected!</b>\n"
        f"👤 <b>Patient:</b> {patient_name} ({patient_id})\n"
        f"🎯 <b>Confidence:</b> {confidence * 100:.0f}%\n"
        f"📅 <b>Time:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} (IST)\n\n"
        "🔴 Please check the Safety Monitoring live feed immediately."
    )
    
    full_snapshot_path = dest_path if db_snapshot_path else None
    send_telegram_notification(alert_msg, full_snapshot_path)
    
    return {
        "event_id": event_id,
        "patient_id": patient_id,
        "event_type": db_event_type,
        "snapshot_path": db_snapshot_path,
        "status": "DISPATCHED"
    }

