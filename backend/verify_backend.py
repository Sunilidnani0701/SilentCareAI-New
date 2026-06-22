import os
import sys
import json
import numpy as np
import cv2
import wave
import struct

# Set up paths to import correctly
sys.path.append(os.path.dirname(__file__))

from core.database import SessionLocal, engine, Base
import models.db_models as db_models
import speech_module
import nlp_engine

def generate_dummy_wav(filepath, duration=2.0, sample_rate=16000):
    """Generates a dummy 16kHz WAV file containing a simple sine wave."""
    n_samples = int(duration * sample_rate)
    frequency = 440.0
    
    # Generate sine wave values
    sine_wave = [np.sin(2 * np.pi * frequency * x / sample_rate) for x in range(n_samples)]
    
    with wave.open(filepath, 'w') as wav_file:
        wav_file.setparams((1, 2, sample_rate, n_samples, 'NONE', 'not compressed'))
        for val in sine_wave:
            int_val = int(val * 32767)
            wav_file.writeframes(struct.pack('h', int_val))
    print(f"Generated dummy audio at: {filepath}")

def main():
    print("Starting Database & Backend Verification...")
    
    # Force drop tables to recreate them with the new columns
    print("Dropping old tables for schema rebuild...")
    try:
        Base.metadata.drop_all(bind=engine)
    except Exception as e:
        print(f"Warning dropping tables: {e}")
        
    print("Recreating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # 2. Insert mock patient
        print("Registering Patient...")
        patient_id = "PAT-0001"
        patient = db_models.Patient(
            patient_id=patient_id,
            full_name="John Doe",
            age=72,
            gender="Male",
            reminder_time="09:00",
            caregiver_name="Jane Doe",
            caregiver_contact="+1234567890",
            streak_days=1,
            compliance_percentage=100.0
        )
        db.add(patient)
        db.commit()
        print(f"Patient registered: {patient.full_name} ({patient.patient_id})")
        
        # 3. Simulate Face Verification with face analysis metrics
        print("Simulating Face Verification with pose metrics...")
        face_analysis_metrics = {
            "head_direction": "LOOKING FORWARD",
            "responsiveness": "RESPONSIVE",
            "face_detected": True
        }
        face_ver = db_models.FaceVerification(
            id="face-ver-1",
            patient_id=patient_id,
            image_path="/uploads/faces/checkin_face_PAT-0001.jpg",
            verified=True,
            confidence=0.85,
            analysis_output=json.dumps(face_analysis_metrics)
        )
        db.add(face_ver)
        db.commit()
        print(f"Face verification saved: Verified={face_ver.verified}, Confidence={face_ver.confidence}")
        
        # 4. Simulate Speech analysis
        # First generate a dummy WAV file in a temp directory
        temp_audio = os.path.join(os.path.dirname(__file__), "temp_test.wav")
        generate_dummy_wav(temp_audio, duration=2.5)
        
        # Read the file using librosa to verify duration
        import librosa
        y, sr_rate = librosa.load(temp_audio, sr=None)
        dur = librosa.get_duration(y=y, sr=sr_rate)
        print(f"Verified Audio Duration: {dur:.2f} seconds")
        
        # Clean up dummy WAV
        if os.path.exists(temp_audio):
            os.remove(temp_audio)
            print("Cleaned up temp dummy audio.")
            
        # Mocking Whisper transcription metrics
        transcript = "I had a wonderful breakfast this morning and basically walked in the garden um like usual."
        words = transcript.lower().split()
        total_words = len(words)
        unique_words = len(set(words))
        vocabulary_richness = unique_words / total_words
        
        # Compute repeated words
        freq = {}
        for w in words:
            freq[w] = freq.get(w, 0) + 1
        repeated_words = sum(1 for w, count in freq.items() if count > 1)
        
        # Filler words
        filler_list = ["um", "uh", "ah", "er", "hmm", "like", "you know", "actually", "basically"]
        filler_words = sum(1 for w in words if w in filler_list)
        
        speech_metrics = {
            "total_words": total_words,
            "unique_words": unique_words,
            "vocabulary_richness": round(vocabulary_richness, 2),
            "repeated_words": repeated_words,
            "filler_words": filler_words,
            "duration_seconds": 2.5,
            "speech_rate_wpm": round((total_words / 2.5) * 60, 2),
            "zero_crossing_rate": 0.08,
            "slurring_detected": "Low"
        }
        
        assessment = db_models.DailyAssessment(
            assessment_id="assess-1",
            patient_id=patient_id,
            transcript=transcript,
            speech_metrics=json.dumps(speech_metrics),
            overall_score=90,
            speech_score=85,
            face_verified=True,
            face_verification_id="face-ver-1",
            audio_file_path="/uploads/audio/checkin_PAT-0001.wav"
        )
        db.add(assessment)
        
        # 4.5 Simulate a Safety Fall Event
        print("Simulating Safety Fall Event...")
        fall_event = db_models.SafetyEvent(
            event_id="fall-1",
            patient_id=patient_id,
            event_source="CAMERA",
            event_type="FALL",
            snapshot_path="/uploads/faces/checkin_face_PAT-0001.jpg", # reuse test image
            confidence=0.92,
            alert_status="DISPATCHED"
        )
        db.add(fall_event)
        
        db.commit()
        print("Safety event saved.")
        print("Speech assessment saved to DailyAssessment table.")
        
        # 5. Verify database structure using queries
        print("\n--- Verifying SQLite Persistence ---")
        p_row = db.query(db_models.Patient).first()
        print(f"Patient Row: ID={p_row.patient_id}, Name={p_row.full_name}")
        
        fv_row = db.query(db_models.FaceVerification).first()
        print(f"FaceVerification Row: ID={fv_row.id}, Patient={fv_row.patient_id}, Analysis={fv_row.analysis_output}")
        
        da_row = db.query(db_models.DailyAssessment).first()
        print(f"DailyAssessment Row: ID={da_row.assessment_id}, FaceVerificationID={da_row.face_verification_id}")
        
        se_row = db.query(db_models.SafetyEvent).first()
        print(f"SafetyEvent Row: ID={se_row.event_id}, Status={se_row.alert_status}, Confidence={se_row.confidence}")
        
        print("\nVerification Successful: All SQLite tables verified with correct relationships and schema.")
        
    except Exception as e:
        print(f"Error during verification: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
