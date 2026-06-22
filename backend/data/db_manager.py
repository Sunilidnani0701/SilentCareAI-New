import sqlite3
import json
import os
from typing import List, Optional
from core.schemas import FinalAssessment

DB_PATH = "silentcare.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            overall_score REAL,
            risk_level TEXT,
            full_data JSON NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def save_assessment(assessment: FinalAssessment):
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Convert Pydantic model to JSON string
    assessment_json = assessment.model_dump_json()
    
    cursor.execute('''
        INSERT INTO assessments (patient_id, overall_score, risk_level, full_data)
        VALUES (?, ?, ?, ?)
    ''', (assessment.patient_id, assessment.overall_score, assessment.risk_level, assessment_json))
    
    conn.commit()
    conn.close()

def get_patient_assessments(patient_id: str) -> List[FinalAssessment]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT full_data FROM assessments WHERE patient_id = ? ORDER BY timestamp DESC
    ''', (patient_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    assessments = []
    for row in rows:
        assessments.append(FinalAssessment.model_validate_json(row[0]))
        
    return assessments
