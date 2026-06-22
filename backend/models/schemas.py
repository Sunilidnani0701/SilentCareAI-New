from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class PatientBase(BaseModel):
    patient_id: str
    full_name: str
    age: int
    gender: str
    reminder_time: str
    caregiver_name: str
    caregiver_contact: str
    reference_image_path: Optional[str] = None

class PatientCreate(PatientBase):
    pass

class PatientResponse(PatientBase):
    registration_date: datetime
    last_checkin: Optional[datetime]
    streak_days: int
    compliance_percentage: float
    
    class Config:
        from_attributes = True

class PatientLogin(BaseModel):
    patient_id: str

class VerifyIdentityResponse(BaseModel):
    verified: bool
    message: str

class DailyAssessmentSubmit(BaseModel):
    patient_id: str
    transcript: str
    face_verified: bool
    acoustic_metrics: dict = {}
    device_source: str = "WEB_APP"

class DailyAssessmentResponse(BaseModel):
    assessment_id: str
    timestamp: datetime
    overall_score: int
    speech_score: int
    face_verified: bool

    class Config:
        from_attributes = True
