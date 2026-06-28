from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from core.database import Base
from datetime import datetime

class Patient(Base):
    __tablename__ = 'patients'
    patient_id = Column(String, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    age = Column(Integer)
    gender = Column(String)
    reminder_time = Column(String) # e.g., "08:00"
    caregiver_name = Column(String)
    caregiver_contact = Column(String)
    reference_image_path = Column(String, nullable=True) # Storing captured reference face image path
    registration_date = Column(DateTime, default=datetime.utcnow)
    last_checkin = Column(DateTime, nullable=True)
    streak_days = Column(Integer, default=0)
    missed_checkins = Column(Integer, default=0)
    compliance_percentage = Column(Float, default=100.0)

class DailyAssessment(Base):
    __tablename__ = 'daily_assessments'
    assessment_id = Column(String, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey('patients.patient_id'))
    timestamp = Column(DateTime, default=datetime.utcnow)
    transcript = Column(Text, nullable=True)
    speech_metrics = Column(Text) # JSON string of metrics
    
    # Granular Scores
    overall_score = Column(Integer, nullable=True)
    speech_score = Column(Integer, nullable=True)
    memory_score = Column(Integer, nullable=True)
    attention_score = Column(Integer, nullable=True)
    fluency_score = Column(Integer, nullable=True)
    
    face_verified = Column(Boolean, default=False)
    face_verification_id = Column(String, ForeignKey('face_verifications.id'), nullable=True)
    assessment_completed = Column(Boolean, default=True)
    device_source = Column(String, default="WEB_APP")
    audio_file_path = Column(String, nullable=True)
    face_image_path = Column(String, nullable=True) # Storing captured image path

class SafetyEvent(Base):
    __tablename__ = 'safety_events'
    event_id = Column(String, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey('patients.patient_id'))
    timestamp = Column(DateTime, default=datetime.utcnow)
    event_source = Column(String) # "CAMERA", "WEARABLE"
    event_type = Column(String)   # "FALL", "UNRESPONSIVE"
    snapshot_path = Column(String, nullable=True)
    confidence = Column(Float, default=1.0)
    alert_status = Column(String, default="DISPATCHED")

class WearableTelemetry(Base):
    __tablename__ = 'wearable_telemetry'
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey('patients.patient_id'))
    timestamp = Column(DateTime, default=datetime.utcnow)
    acceleration_x = Column(Float, nullable=True)
    acceleration_y = Column(Float, nullable=True)
    acceleration_z = Column(Float, nullable=True)
    orientation_roll = Column(Float, nullable=True)
    orientation_pitch = Column(Float, nullable=True)
    fall_confidence = Column(Float, nullable=True)
    movement_activity = Column(String, nullable=True)

class FaceVerification(Base):
    __tablename__ = 'face_verifications'
    id = Column(String, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey('patients.patient_id'))
    timestamp = Column(DateTime, default=datetime.utcnow)
    image_path = Column(String, nullable=False)
    verified = Column(Boolean, default=False)
    confidence = Column(Float, default=0.0)
    analysis_output = Column(Text, nullable=True) # JSON string of head_direction, responsiveness, etc.

class WearableSensorData(Base):
    __tablename__ = 'wearable_sensor_data'
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey('patients.patient_id'), nullable=False)
    timestamp = Column(Integer, nullable=False)
    acc_x = Column(Float, nullable=False)
    acc_y = Column(Float, nullable=False)
    acc_z = Column(Float, nullable=False)
    gyro_x = Column(Float, nullable=False)
    gyro_y = Column(Float, nullable=False)
    gyro_z = Column(Float, nullable=False)
    battery_level = Column(Integer, nullable=False)
    fall_detected = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

