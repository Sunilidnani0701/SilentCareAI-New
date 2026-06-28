from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os
from dotenv import load_dotenv

# Load environment variables from .env (checks backend/ and root directories)
load_dotenv()
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

import uuid

import json
from datetime import datetime
import cv2
import numpy as np
from ultralytics import YOLO

from core.database import engine, get_db
import models.db_models as db_models
import models.schemas as schemas
import nlp_engine
import speech_module
import services.face_service as face_service
import services.fall_service as fall_service
from reporting.pdf_builder import generate_pdf
from core.schemas import FinalAssessment, SpeechMetrics, MemoryMetrics, AttentionMetrics, NamingMetrics, FluencyMetrics


IS_RENDER = os.environ.get("RENDER") == "true"


try:
    if not IS_RENDER:
        model_paths = [
            os.path.join(os.path.dirname(__file__), "yolov8n-pose.pt"),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "yolov8n-pose.pt"),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "vision", "yolov8n-pose.pt"),
            "yolov8n-pose.pt"
        ]
        pose_model = None
        for p in model_paths:
            if os.path.exists(p):
                pose_model = YOLO(p)
                print(f"Loaded YOLO model from: {p}")
                break
        if pose_model is None:
            pose_model = YOLO("yolov8n-pose.pt")
    else:
        print("Cloud Environment (Render) detected. Bypassing YOLO model loading to save RAM.")
        pose_model = None
except Exception as e:
    print(f"Warning: YOLO model not found: {e}")
    pose_model = None

def get_cropped_face(img):
    if not pose_model:
        return None
    results = pose_model(img, verbose=False, imgsz=320)
    if len(results[0].keypoints.data) > 0:
        kp = results[0].keypoints.data[0]
        if len(kp) >= 3:
            nose, left_eye, right_eye = kp[0], kp[1], kp[2]
            face_visible = (nose[2] > 0.5 and left_eye[2] > 0.5 and right_eye[2] > 0.5)
            if face_visible:
                h, w, _ = img.shape
                x_min = max(0, int(min(left_eye[0], right_eye[0]) - 60))
                x_max = min(w, int(max(left_eye[0], right_eye[0]) + 60))
                y_min = max(0, int(min(left_eye[1], right_eye[1]) - 60))
                y_max = min(h, int(nose[1] + 100))
                if x_max > x_min and y_max > y_min:
                    return img[y_min:y_max, x_min:x_max]
    return None

def verify_face_presence(image_bytes):
    if IS_RENDER or not pose_model:
        # Mock face check success for cloud demo (saves 512MB RAM)
        return True, 0.95
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return False, 0.0
    results = pose_model(img, verbose=False, imgsz=320)
    if len(results[0].keypoints.data) > 0:
        kp = results[0].keypoints.data[0]
        if len(kp) >= 3:
            nose, left_eye, right_eye = kp[0], kp[1], kp[2]
            verified = bool(nose[2] > 0.5 and left_eye[2] > 0.5 and right_eye[2] > 0.5)
            return verified, (0.90 if verified else 0.0)
    return False, 0.0

# Create database tables
db_models.Base.metadata.create_all(bind=engine)

# Seed default patients if empty
from core.database import SessionLocal
db = SessionLocal()
try:
    if db.query(db_models.Patient).count() == 0:
        default_patients = [
            db_models.Patient(
                patient_id="PAT-0001",
                full_name="John Doe",
                age=72,
                gender="Male",
                reminder_time="08:00",
                caregiver_name="Jane Doe",
                caregiver_contact="555-0199",
                streak_days=5,
                compliance_percentage=92.0
            ),
            db_models.Patient(
                patient_id="PAT-0002",
                full_name="Alice Smith",
                age=79,
                gender="Female",
                reminder_time="09:30",
                caregiver_name="Bob Smith",
                caregiver_contact="555-0244",
                streak_days=12,
                compliance_percentage=98.0
            )
        ]
        db.add_all(default_patients)
        db.commit()
        print("Database seeded with default patients: PAT-0001, PAT-0002")
finally:
    db.close()


app = FastAPI(title="CareMonitor Ambient Backend API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directories exist
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
AUDIO_DIR = os.path.join(UPLOAD_DIR, "audio")
FACES_DIR = os.path.join(UPLOAD_DIR, "faces")
FALLS_DIR = os.path.join(UPLOAD_DIR, "falls")

os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(FACES_DIR, exist_ok=True)
os.makedirs(FALLS_DIR, exist_ok=True)

# Mount uploads directory so files are accessible at /uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Maintain backward compatibility for snapshots
SNAPSHOTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "vision_node", "alerts_snapshots")
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)
app.mount("/snapshots", StaticFiles(directory=SNAPSHOTS_DIR), name="snapshots")


@app.get("/")
def read_root():
    return {"message": "CareMonitor Ambient Backend API is running"}

# --- Patient Management ---

@app.post("/register", response_model=schemas.PatientResponse)
async def register_patient(
    full_name: str = Form(...),
    age: int = Form(...),
    gender: str = Form(...),
    reminder_time: str = Form(...),
    caregiver_name: str = Form(...),
    caregiver_contact: str = Form(...),
    image_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    # Generate unique patient ID
    existing_count = db.query(db_models.Patient).count()
    generated_id = f"PAT-{existing_count + 1:04d}"
    while db.query(db_models.Patient).filter(db_models.Patient.patient_id == generated_id).first():
        existing_count += 1
        generated_id = f"PAT-{existing_count + 1:04d}"
    
    # Save reference image in uploads/faces/
    ref_image_path = None
    if image_file:
        img_bytes = await image_file.read()
        img_filename = f"ref_{generated_id}.jpg"
        ref_image_path_full = os.path.join(FACES_DIR, img_filename)
        with open(ref_image_path_full, "wb") as f:
            f.write(img_bytes)
        ref_image_path = f"/uploads/faces/{img_filename}"
    
    new_patient = db_models.Patient(
        patient_id=generated_id,
        full_name=full_name,
        age=age,
        gender=gender,
        reminder_time=reminder_time,
        caregiver_name=caregiver_name,
        caregiver_contact=caregiver_contact,
        reference_image_path=ref_image_path
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    return new_patient

@app.post("/checkin/face")
async def checkin_face(
    patient_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # 1. Verify patient exists
    db_patient = db.query(db_models.Patient).filter(db_models.Patient.patient_id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # 2. Save check-in image in uploads/faces/
    image_bytes = await image.read()
    timestamp_int = int(datetime.utcnow().timestamp())
    img_filename = f"checkin_face_{patient_id}_{timestamp_int}.jpg"
    checkin_image_path = os.path.join(FACES_DIR, img_filename)
    with open(checkin_image_path, "wb") as f:
        f.write(image_bytes)
    db_image_path = f"/uploads/faces/{img_filename}"
    
    # 3. Perform Face Verification
    verified = False
    confidence = 0.0
    
    # Check if patient has a reference image
    if db_patient.reference_image_path:
        ref_path_rel = db_patient.reference_image_path
        if ref_path_rel.startswith("/uploads/"):
            ref_full_path = os.path.join(UPLOAD_DIR, ref_path_rel.replace("/uploads/", "", 1).replace("/", os.sep))
        else:
            ref_filename = os.path.basename(ref_path_rel)
            ref_full_path = os.path.join(SNAPSHOTS_DIR, ref_filename)
            
        if os.path.exists(ref_full_path):
            img_ref = cv2.imread(ref_full_path)
            nparr = np.frombuffer(image_bytes, np.uint8)
            img_checkin = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img_ref is not None and img_checkin is not None:
                face_ref = get_cropped_face(img_ref)
                face_checkin = get_cropped_face(img_checkin)
                
                if face_ref is not None and face_checkin is not None:
                    face_ref = cv2.resize(face_ref, (150, 150))
                    face_checkin = cv2.resize(face_checkin, (150, 150))
                    gray_ref = cv2.cvtColor(face_ref, cv2.COLOR_BGR2GRAY)
                    gray_checkin = cv2.cvtColor(face_checkin, cv2.COLOR_BGR2GRAY)
                    
                    res = cv2.matchTemplate(gray_checkin, gray_ref, cv2.TM_CCOEFF_NORMED)
                    _, max_val, _, _ = cv2.minMaxLoc(res)
                    confidence = max(0.0, float(max_val))
                    verified = confidence > 0.4
                else:
                    h, w, _ = img_ref.shape
                    img_checkin_resized = cv2.resize(img_checkin, (w, h))
                    gray_ref = cv2.cvtColor(img_ref, cv2.COLOR_BGR2GRAY)
                    gray_checkin = cv2.cvtColor(img_checkin_resized, cv2.COLOR_BGR2GRAY)
                    res = cv2.matchTemplate(gray_checkin, gray_ref, cv2.TM_CCOEFF_NORMED)
                    _, max_val, _, _ = cv2.minMaxLoc(res)
                    confidence = max(0.0, float(max_val))
                    verified = confidence > 0.35
        else:
            verified, confidence = verify_face_presence(image_bytes)
    else:
        verified, confidence = verify_face_presence(image_bytes)
        
    # Perform repository Face Analysis (Head direction & Responsiveness)
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_checkin = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    analysis_res = face_service.run_face_analysis(img_checkin, pose_model)
    
    # 4. Save to FaceVerification table
    verification_id = str(uuid.uuid4())
    db_verification = db_models.FaceVerification(
        id=verification_id,
        patient_id=patient_id,
        timestamp=datetime.utcnow(),
        image_path=db_image_path,
        verified=verified,
        confidence=confidence,
        analysis_output=json.dumps(analysis_res)
    )
    db.add(db_verification)
    db.commit()
    
    return {
        "verified": verified,
        "confidence": round(confidence, 2),
        "patient_id": patient_id,
        "image_path": db_image_path,
        "timestamp": db_verification.timestamp.isoformat(),
        "face_verification_id": verification_id,
        "face_analysis": analysis_res
    }

@app.post("/login")
def login(data: dict, db: Session = Depends(get_db)):
    pid = data.get("patient_id")
    name = data.get("full_name")
    if not pid or not name:
        raise HTTPException(status_code=400, detail="Missing patient_id or full_name")
        
    db_patient = db.query(db_models.Patient).filter(
        db_models.Patient.patient_id == pid,
        db_models.Patient.full_name == name
    ).first()
    
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found or name mismatch")
        
    return {"message": "Login successful", "patient": {"id": db_patient.patient_id, "name": db_patient.full_name}}

@app.get("/api/patient/{patient_id}", response_model=schemas.PatientResponse)
def get_patient(patient_id: str, db: Session = Depends(get_db)):
    db_patient = db.query(db_models.Patient).filter(db_models.Patient.patient_id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return db_patient


# --- Face Verification ---

@app.post("/verify_identity", response_model=schemas.VerifyIdentityResponse)
async def verify_identity(patient_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    db_patient = db.query(db_models.Patient).filter(db_models.Patient.patient_id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"verified": True, "message": "Identity Verified"}


# --- Speech Assessment ---

@app.post("/api/transcribe_audio")
async def transcribe_audio(file: UploadFile = File(...)):
    """Accepts a WAV file and returns the transcribed text and acoustic metrics"""
    audio_bytes = await file.read()
    transcript, acoustic_metrics = speech_module.transcribe_audio_bytes(audio_bytes)
    return {"transcript": transcript, "acoustic_metrics": acoustic_metrics}

@app.post("/checkin/speech")
async def checkin_speech(
    patient_id: str = Form(...),
    audio_file: UploadFile = File(...),
    face_verification_id: str = Form(None),
    db: Session = Depends(get_db)
):
    # 1. Verify patient exists
    db_patient = db.query(db_models.Patient).filter(db_models.Patient.patient_id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # 2. Save check-in audio in uploads/audio/
    audio_bytes = await audio_file.read()
    timestamp_int = int(datetime.utcnow().timestamp())
    audio_filename = f"audio_{patient_id}_{timestamp_int}.wav"
    audio_path_full = os.path.join(AUDIO_DIR, audio_filename)
    with open(audio_path_full, "wb") as f:
        f.write(audio_bytes)
    db_audio_path = f"/uploads/audio/{audio_filename}"
    
    # 3. Perform Whisper Transcription and Phenotyping
    transcript, speech_metrics = speech_module.transcribe_and_analyze(audio_path_full)
    
    if transcript.startswith("ERROR:"):
        raise HTTPException(status_code=500, detail=transcript)
        
    duration = speech_metrics.get("duration_seconds", 0.0)
    analysis = nlp_engine.analyze_digital_phenotype(transcript, duration_seconds=duration)
    
    # Merge metrics
    combined_metrics = {**speech_metrics, **analysis}
    overall = max(0, 100 - analysis.get("risk_score", 0))
    
    # 4. Save to DB
    assessment_id = str(uuid.uuid4())
    new_assessment = db_models.DailyAssessment(
        assessment_id=assessment_id,
        patient_id=patient_id,
        timestamp=datetime.utcnow(),
        transcript=transcript,
        speech_metrics=json.dumps(combined_metrics),
        overall_score=overall,
        speech_score=int(speech_metrics.get("vocabulary_richness", 0.0) * 100),
        memory_score=80,
        attention_score=85,
        fluency_score=70,
        face_verified=(face_verification_id is not None),
        face_verification_id=face_verification_id,
        device_source="WEB_APP",
        audio_file_path=db_audio_path
    )
    db.add(new_assessment)
    
    # 5. Update patient compliance tracking
    db_patient.last_checkin = datetime.utcnow()
    db_patient.streak_days += 1
    total_days = db_patient.streak_days + db_patient.missed_checkins
    db_patient.compliance_percentage = round((db_patient.streak_days / total_days) * 100, 1) if total_days > 0 else 100.0
    
    db.commit()
    db.refresh(new_assessment)
    
    return {
        "assessment_id": assessment_id,
        "patient_id": patient_id,
        "transcript": transcript,
        "speech_metrics": combined_metrics,
        "audio_file_path": db_audio_path,
        "timestamp": new_assessment.timestamp.isoformat(),
        "overall_score": overall
    }

@app.post("/register_assessment")
async def register_assessment(
    patient_id: str,
    audio_file: UploadFile = File(...),
    image_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    db_patient = db.query(db_models.Patient).filter(db_models.Patient.patient_id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # 1. Face Verification (save in uploads/faces)
    face_verified = False
    face_verification_id = None
    image_path = None
    if image_file and pose_model:
        image_bytes = await image_file.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            results = pose_model(img, verbose=False, imgsz=320)
            if len(results[0].keypoints.data) > 0:
                kp = results[0].keypoints.data[0]
                if len(kp) >= 3:
                    nose, left_eye, right_eye = kp[0], kp[1], kp[2]
                    face_verified = bool(nose[2] > 0.5 and left_eye[2] > 0.5 and right_eye[2] > 0.5)
            
            img_filename = f"face_{patient_id}_{int(datetime.utcnow().timestamp())}.jpg"
            image_path_full = os.path.join(FACES_DIR, img_filename)
            cv2.imwrite(image_path_full, img)
            image_path = f"/uploads/faces/{img_filename}"
            
            # Create FaceVerification entry with analysis metrics
            face_verification_id = str(uuid.uuid4())
            analysis_res = face_service.run_face_analysis(img, pose_model)
            db_verification = db_models.FaceVerification(
                id=face_verification_id,
                patient_id=patient_id,
                timestamp=datetime.utcnow(),
                image_path=image_path,
                verified=face_verified,
                confidence=0.90 if face_verified else 0.0,
                analysis_output=json.dumps(analysis_res)
            )
            db.add(db_verification)
            
    # 2. Save Raw Audio in uploads/audio/
    audio_bytes = await audio_file.read()
    audio_filename = f"audio_{patient_id}_{int(datetime.utcnow().timestamp())}.wav"
    audio_path_full = os.path.join(AUDIO_DIR, audio_filename)
    with open(audio_path_full, "wb") as f:
        f.write(audio_bytes)
    db_audio_path = f"/uploads/audio/{audio_filename}"
        
    # 3. Transcribe & Analyze Speech
    transcript, speech_metrics = speech_module.transcribe_and_analyze(audio_path_full)
    duration = speech_metrics.get("duration_seconds", 0.0)
    
    analysis = nlp_engine.analyze_digital_phenotype(transcript, duration_seconds=duration)
    combined_metrics = {**speech_metrics, **analysis}
    overall = max(0, 100 - analysis.get("risk_score", 0))
    
    # 4. Save to DB
    new_assessment = db_models.DailyAssessment(
        assessment_id=str(uuid.uuid4()),
        patient_id=patient_id,
        transcript=transcript,
        speech_metrics=json.dumps(combined_metrics),
        overall_score=overall,
        speech_score=int(speech_metrics.get("vocabulary_richness", 0.0) * 100),
        memory_score=80,
        attention_score=85,
        fluency_score=70,
        face_verified=face_verified,
        face_verification_id=face_verification_id,
        face_image_path=image_path,
        device_source="WEB_APP",
        audio_file_path=db_audio_path
    )
    db.add(new_assessment)
    
    # 5. Update patient compliance tracking
    db_patient.last_checkin = datetime.utcnow()
    db_patient.streak_days += 1
    total_days = db_patient.streak_days + db_patient.missed_checkins
    db_patient.compliance_percentage = round((db_patient.streak_days / total_days) * 100, 1) if total_days > 0 else 100.0
    
    db.commit()
    db.refresh(new_assessment)
    
    return {
        "message": "Assessment Completed",
        "assessment_id": new_assessment.assessment_id,
        "transcript": transcript,
        "overall_score": overall
    }

# --- Unified Vision Alert Dispatch ---

@app.post("/api/vision/alert")
def receive_vision_alert(payload: dict, db: Session = Depends(get_db)):
    """
    Receives JSON alerts dispatched asynchronously by AlertWorker (camera_streamer).
    """
    result = fall_service.handle_vision_alert(payload, db, UPLOAD_DIR)
    return result

@app.post("/api/events/fall")
async def register_fall_event(
    patient_id: str,
    image_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    db_patient = db.query(db_models.Patient).filter(db_models.Patient.patient_id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    image_path = None
    if image_file:
        image_bytes = await image_file.read()
        img_filename = f"fall_{patient_id}_{int(datetime.utcnow().timestamp())}.jpg"
        save_path = os.path.join(FALLS_DIR, img_filename)
        with open(save_path, "wb") as f:
            f.write(image_bytes)
        image_path = f"/uploads/falls/{img_filename}"
        
    new_event = db_models.SafetyEvent(
        event_id=str(uuid.uuid4()),
        patient_id=patient_id,
        timestamp=datetime.utcnow(),
        event_source="CAMERA",
        event_type="FALL",
        snapshot_path=image_path,
        confidence=1.0,
        alert_status="DISPATCHED"
    )
    db.add(new_event)
    db.commit()
    
    # Notify caregiver via Telegram
    alert_msg = f"⚠️ WARNING: Fall Detected!\nPatient: {db_patient.full_name} ({patient_id})\nTime: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    full_snapshot_path = save_path if image_file else None
    fall_service.send_telegram_notification(alert_msg, full_snapshot_path)
    
    return {"message": "Fall event registered successfully"}

@app.put("/api/events/{event_id}/resolve")
def resolve_safety_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(db_models.SafetyEvent).filter(db_models.SafetyEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.alert_status = "RESOLVED"
    db.commit()
    return {"message": "Event resolved successfully"}

# --- Patient Report API ---

@app.get("/patient/{patient_id}/report")
def get_patient_report(patient_id: str, db: Session = Depends(get_db)):
    db_patient = db.query(db_models.Patient).filter(db_models.Patient.patient_id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    latest_assessment = db.query(db_models.DailyAssessment).filter(
        db_models.DailyAssessment.patient_id == patient_id
    ).order_by(db_models.DailyAssessment.timestamp.desc()).first()
    
    # If no assessment exists, create default values so we can still generate a report
    if latest_assessment:
        try:
            metrics = json.loads(latest_assessment.speech_metrics) if latest_assessment.speech_metrics else {}
        except Exception:
            metrics = {}
            
        speech_score = latest_assessment.speech_score or 80
        memory_score = latest_assessment.memory_score or 80
        face_verified = latest_assessment.face_verified or False
        
        # Check safety events
        latest_fall = db.query(db_models.SafetyEvent).filter(
            db_models.SafetyEvent.patient_id == patient_id
        ).order_by(db_models.SafetyEvent.timestamp.desc()).first()
        no_active_falls = True
        if latest_fall and latest_fall.event_type == "FALL" and latest_fall.alert_status == "DISPATCHED":
            no_active_falls = False
            
        derived_score = round((speech_score * 0.40) + (memory_score * 0.30) + (10 if face_verified else 0) + (20 if no_active_falls else 0))
    else:
        metrics = {}
        derived_score = 90
        face_verified = True
        no_active_falls = True
        
    # Build SpeechMetrics
    speech_rate = metrics.get("speech_rate_wpm", 120.0)
    vocab = metrics.get("vocabulary_richness", 0.75)
    total_w = metrics.get("total_words", 45)
    duration = metrics.get("duration_seconds", 15.0)
    
    # Risk Level
    if derived_score >= 85:
        risk_level = "Low Risk"
    elif derived_score >= 70:
        risk_level = "Moderate Risk"
    else:
        risk_level = "High Risk"
        
    final_assessment = FinalAssessment(
        patient_id=patient_id,
        speech=SpeechMetrics(
            total_words=total_w,
            unique_words=metrics.get("unique_words", int(total_w * vocab)),
            vocabulary_richness=vocab,
            speech_rate_wpm=speech_rate,
            filler_word_count=metrics.get("filler_words", 0),
            duration_seconds=duration
        ),
        memory=MemoryMetrics(
            words_assigned=["apple", "table", "penny", "candle", "folder"],
            immediate_recalled=["apple", "table", "penny"],
            delayed_recalled=["apple", "table"],
            immediate_score=60.0,
            delayed_score=40.0
        ),
        attention=AttentionMetrics(
            forward_score=80.0,
            backward_score=60.0,
            total_score=70.0
        ),
        naming=NamingMetrics(
            total_questions=3,
            correct_answers=3,
            score=100.0
        ),
        fluency=FluencyMetrics(
            total_valid_words=12,
            repetition_count=0,
            score=80.0
        ),
        overall_score=float(derived_score),
        risk_level=risk_level
    )
    
    # Generate PDF in a temporary file or uploads/reports
    reports_dir = os.path.join(UPLOAD_DIR, "reports")
    os.makedirs(reports_dir, exist_ok=True)
    report_filename = f"report_{patient_id}.pdf"
    report_path = os.path.join(reports_dir, report_filename)
    
    try:
        generate_pdf(final_assessment, report_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
        
    return FileResponse(
        path=report_path,
        filename=report_filename,
        media_type="application/pdf"
    )

# --- Patient History APIs ---


@app.get("/patient/{patient_id}/history")
def get_patient_history(patient_id: str, db: Session = Depends(get_db)):
    db_patient = db.query(db_models.Patient).filter(db_models.Patient.patient_id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    face_verifications = db.query(db_models.FaceVerification).filter(db_models.FaceVerification.patient_id == patient_id).order_by(db_models.FaceVerification.timestamp.desc()).all()
    speech_assessments = db.query(db_models.DailyAssessment).filter(db_models.DailyAssessment.patient_id == patient_id).order_by(db_models.DailyAssessment.timestamp.desc()).all()
    fall_events = db.query(db_models.SafetyEvent).filter(db_models.SafetyEvent.patient_id == patient_id).order_by(db_models.SafetyEvent.timestamp.desc()).all()
    
    # Process speech metrics
    processed_speech = []
    for a in speech_assessments:
        try:
            metrics = json.loads(a.speech_metrics) if a.speech_metrics else {}
        except Exception:
            metrics = {}
            
        processed_speech.append({
            "assessment_id": a.assessment_id,
            "timestamp": a.timestamp.isoformat(),
            "transcript": a.transcript,
            "audio_file_path": a.audio_file_path,
            "overall_score": a.overall_score,
            "speech_score": a.speech_score,
            "face_verified": a.face_verified,
            "face_verification_id": a.face_verification_id,
            "speech_rate_wpm": metrics.get("speech_rate_wpm", 0.0),
            "vocabulary_richness": metrics.get("vocabulary_richness", 0.0),
            "total_words": metrics.get("total_words", 0),
            "unique_words": metrics.get("unique_words", 0),
            "repeated_words": metrics.get("repeated_words", 0),
            "filler_words": metrics.get("filler_words", 0),
            "duration_seconds": metrics.get("duration_seconds", 0.0)
        })
        
    processed_faces = []
    for f in face_verifications:
        try:
            analysis = json.loads(f.analysis_output) if f.analysis_output else {}
        except Exception:
            analysis = {}
            
        processed_faces.append({
            "id": f.id,
            "timestamp": f.timestamp.isoformat(),
            "image_path": f.image_path,
            "verified": f.verified,
            "confidence": round(f.confidence, 2),
            "head_direction": analysis.get("head_direction", "Unknown"),
            "responsiveness": analysis.get("responsiveness", "Unknown")
        })
        
    processed_falls = []
    for event in fall_events:
        processed_falls.append({
            "event_id": event.event_id,
            "timestamp": event.timestamp.isoformat(),
            "event_source": event.event_source,
            "event_type": event.event_type,
            "snapshot_path": event.snapshot_path,
            "confidence": event.confidence,
            "alert_status": event.alert_status
        })
        
    wearable_data = db.query(db_models.WearableSensorData).filter(db_models.WearableSensorData.patient_id == patient_id).order_by(db_models.WearableSensorData.timestamp.desc()).first()
    processed_wearable = None
    if wearable_data:
        processed_wearable = {
            "timestamp": wearable_data.timestamp,
            "acc_x": wearable_data.acc_x,
            "acc_y": wearable_data.acc_y,
            "acc_z": wearable_data.acc_z,
            "gyro_x": wearable_data.gyro_x,
            "gyro_y": wearable_data.gyro_y,
            "gyro_z": wearable_data.gyro_z,
            "battery_level": wearable_data.battery_level,
            "fall_detected": wearable_data.fall_detected,
            "created_at": wearable_data.created_at.isoformat()
        }

    return {
        "patient": {
            "patient_id": db_patient.patient_id,
            "name": db_patient.full_name,
            "age": db_patient.age,
            "gender": db_patient.gender,
            "reminder_time": db_patient.reminder_time,
            "caregiver_name": db_patient.caregiver_name,
            "caregiver_contact": db_patient.caregiver_contact,
            "streak_days": db_patient.streak_days,
            "compliance_percentage": db_patient.compliance_percentage,
            "reference_image_path": db_patient.reference_image_path
        },
        "face_verifications": processed_faces,
        "speech_assessments": processed_speech,
        "fall_events": processed_falls,
        "wearable_status": processed_wearable
    }


@app.get("/assessment_history/{patient_id}")
def get_assessment_history(patient_id: str, db: Session = Depends(get_db)):
    db_patient = db.query(db_models.Patient).filter(db_models.Patient.patient_id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    assessments = db.query(db_models.DailyAssessment).filter(db_models.DailyAssessment.patient_id == patient_id).order_by(db_models.DailyAssessment.timestamp.asc()).all()
    
    trends = []
    for a in assessments:
        try:
            metrics = json.loads(a.speech_metrics) if a.speech_metrics else {}
        except Exception:
            metrics = {}
        trends.append({
            "timestamp": a.timestamp.isoformat(),
            "overall_score": a.overall_score,
            "speech_score": a.speech_score,
            "lexical_diversity": metrics.get("vocabulary_richness", 0.0),
            "face_verified": a.face_verified,
            "speech_rate_wpm": metrics.get("speech_rate_wpm", 0.0),
            "vocabulary_richness": metrics.get("vocabulary_richness", 0.0),
            "total_words": metrics.get("total_words", 0),
            "unique_words": metrics.get("unique_words", 0),
            "repeated_words": metrics.get("repeated_words", 0),
            "filler_words": metrics.get("filler_words", 0),
            "duration_seconds": metrics.get("duration_seconds", 0.0)
        })
        
    return {
        "patient": {
            "name": db_patient.full_name,
            "streak_days": db_patient.streak_days,
            "compliance_percentage": db_patient.compliance_percentage
        },
        "trends": trends
    }

@app.get("/admin/patients")
def get_all_patients(db: Session = Depends(get_db)):
    patients = db.query(db_models.Patient).all()
    results = []
    for p in patients:
        # Get latest face verification status
        latest_face = db.query(db_models.FaceVerification).filter(
            db_models.FaceVerification.patient_id == p.patient_id
        ).order_by(db_models.FaceVerification.timestamp.desc()).first()
        
        face_status = "No Data"
        if latest_face:
            try:
                analysis = json.loads(latest_face.analysis_output) if latest_face.analysis_output else {}
                face_status = analysis.get("responsiveness", "RESPONSIVE")
            except Exception:
                face_status = "RESPONSIVE"
                
        # Get latest fall status
        latest_fall = db.query(db_models.SafetyEvent).filter(
            db_models.SafetyEvent.patient_id == p.patient_id
        ).order_by(db_models.SafetyEvent.timestamp.desc()).first()
        
        fall_status = "No Active Alerts"
        if latest_fall:
            if latest_fall.event_type == "FALL" and latest_fall.alert_status == "DISPATCHED":
                fall_status = "Fall Detected"
            elif latest_fall.event_type == "UNRESPONSIVE" and latest_fall.alert_status == "DISPATCHED":
                fall_status = "Unresponsive Alert"
                
        speech_error = None
        if p.patient_id in active_speech_errors:
            speech_error = active_speech_errors[p.patient_id]["error"]
            
        results.append({
            "patient_id": p.patient_id,
            "full_name": p.full_name,
            "age": p.age,
            "caregiver_contact": p.caregiver_contact,
            "streak_days": p.streak_days,
            "compliance_percentage": p.compliance_percentage,
            "last_checkin": p.last_checkin.isoformat() if p.last_checkin else None,
            "face_status": face_status,
            "fall_status": fall_status,
            "room_safety_active": p.patient_id in active_senders,
            "speech_error": speech_error
        })
    return results

# Global tracking states for Room Safety camera stream and Check-In Speech errors
active_senders = set()
active_speech_errors = {}

@app.post("/api/checkin/error")
def report_checkin_error(data: dict):
    patient_id = data.get("patient_id")
    error_message = data.get("error")
    if patient_id:
        active_speech_errors[patient_id] = {
            "error": error_message,
            "timestamp": datetime.utcnow().isoformat()
        }
    return {"status": "success"}

@app.post("/api/checkin/clear-errors")
def clear_checkin_errors(data: dict):
    patient_id = data.get("patient_id")
    if patient_id in active_speech_errors:
        del active_speech_errors[patient_id]
    return {"status": "success"}

# Real-time WebSocket live-streaming broadcasting state
active_receivers = {}

@app.websocket("/api/vision/stream")
async def vision_stream_endpoint(websocket: WebSocket):
    await websocket.accept()
    query_params = websocket.query_params
    role = query_params.get("role")  # "sender" or "receiver"
    patient_id = query_params.get("patient_id", "PAT-0001")
    
    if role == "receiver":
        # Register this socket as a receiver for this patient
        if patient_id not in active_receivers:
            active_receivers[patient_id] = []
        active_receivers[patient_id].append(websocket)
        try:
            while True:
                # Keep socket open and listen for heartbeat/messages (none expected)
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            if patient_id in active_receivers and websocket in active_receivers[patient_id]:
                active_receivers[patient_id].remove(websocket)
                if not active_receivers[patient_id]:
                    del active_receivers[patient_id]
            print(f"Receiver disconnected for patient {patient_id}")
            
    elif role == "sender":
        # Sender streams base64 JPEG frames
        from core.database import SessionLocal
        import base64
        from services.vision_processor import process_frame
        
        active_senders.add(patient_id)
        db = SessionLocal()
        try:
            while True:
                data = await websocket.receive_text()
                
                # Strip prefix if present
                if data.startswith("data:image/jpeg;base64,"):
                    base64_data = data.split(",")[1]
                else:
                    base64_data = data
                
                try:
                    img_bytes = base64.b64decode(base64_data)
                    nparr = np.frombuffer(img_bytes, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                except Exception as e:
                    print(f"Error decoding base64 frame: {e}")
                    continue
                
                if frame is not None:
                    # Process frame with YOLOv8-pose
                    annotated_frame, status = process_frame(frame, patient_id, pose_model, db, UPLOAD_DIR)
                    
                    # Encode processed frame back to jpeg base64
                    _, buffer = cv2.imencode(".jpg", annotated_frame)
                    encoded_annotated = base64.b64encode(buffer).decode("utf-8")
                    data_url = f"data:image/jpeg;base64,{encoded_annotated}"
                    
                    # Send feedback status and image to sender
                    await websocket.send_text(json.dumps({"status": status, "image": data_url}))
                    
                    # Broadcast to all active receivers (caregiver safety monitors)
                    if patient_id in active_receivers:
                        for rx in list(active_receivers[patient_id]):
                            try:
                                await rx.send_text(json.dumps({"status": status, "image": data_url}))
                            except Exception:
                                # In case of send failure, let it be cleaned up
                                pass
        except WebSocketDisconnect:
            print(f"Sender disconnected for patient {patient_id}")
        finally:
            active_senders.discard(patient_id)
            db.close()
    else:
        await websocket.close(code=4000, reason="Invalid role parameter")


@app.post("/api/iot/data")
def submit_wearable_telemetry(data: schemas.WearableTelemetrySubmit, db: Session = Depends(get_db)):
    import time
    # 1. Verify if patient exists
    db_patient = db.query(db_models.Patient).filter(db_models.Patient.patient_id == data.patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # 2. Save wearable sensor data
    sensor_data = db_models.WearableSensorData(
        patient_id=data.patient_id,
        timestamp=data.timestamp,
        acc_x=data.acceleration.x,
        acc_y=data.acceleration.y,
        acc_z=data.acceleration.z,
        gyro_x=data.gyroscope.x,
        gyro_y=data.gyroscope.y,
        gyro_z=data.gyroscope.z,
        battery_level=data.battery,
        fall_detected=data.fall_detected
    )
    db.add(sensor_data)
    
    # 3. If a fall is detected, register a SafetyEvent and send a Telegram alert
    if data.fall_detected:
        event_id = f"evt_wearable_{data.patient_id}_{int(time.time())}"
        safety_event = db_models.SafetyEvent(
            event_id=event_id,
            patient_id=data.patient_id,
            timestamp=datetime.now(),
            event_source="WEARABLE",
            event_type="FALL",
            snapshot_path=None,
            confidence=1.0,
            alert_status="DISPATCHED"
        )
        db.add(safety_event)
        
        # Trigger Telegram Notification
        from services.fall_service import send_telegram_notification
        patient_name = db_patient.full_name
        alert_msg = (
            "🚨 <b>EMERGENCY ALERT</b> 🚨\n\n"
            "⚠️ <b>Wearable Fall Detected!</b>\n"
            f"👤 <b>Patient:</b> {patient_name} ({data.patient_id})\n"
            f"🔋 <b>Battery Level:</b> {data.battery}%\n"
            f"📅 <b>Time:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} (IST)\n\n"
            "🔴 Please check the patient immediately."
        )
        send_telegram_notification(alert_msg)
        
    db.commit()
    return {"status": "success", "message": "Wearable sensor telemetry recorded successfully"}


@app.get("/api/test-telegram")
def test_telegram():
    from services.fall_service import send_telegram_notification
    success = send_telegram_notification("🔔 SilentCare AI: This is a test notification from the backend!")
    if success:
        return {"status": "success", "message": "Test Telegram message sent successfully!"}
    else:
        return {"status": "error", "message": "Failed to send Telegram message. Check backend logs for missing env variables."}


