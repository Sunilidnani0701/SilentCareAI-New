from pydantic import BaseModel, Field
from typing import List, Optional

class SpeechMetrics(BaseModel):
    total_words: int = 0
    unique_words: int = 0
    vocabulary_richness: float = 0.0
    speech_rate_wpm: float = 0.0
    filler_word_count: int = 0
    duration_seconds: float = 0.0

class MemoryMetrics(BaseModel):
    words_assigned: List[str] = Field(default_factory=list)
    immediate_recalled: List[str] = Field(default_factory=list)
    delayed_recalled: List[str] = Field(default_factory=list)
    immediate_score: float = 0.0
    delayed_score: float = 0.0

class AttentionMetrics(BaseModel):
    forward_score: float = 0.0
    backward_score: float = 0.0
    total_score: float = 0.0

class NamingMetrics(BaseModel):
    total_questions: int = 0
    correct_answers: int = 0
    score: float = 0.0

class FluencyMetrics(BaseModel):
    total_valid_words: int = 0
    repetition_count: int = 0
    score: float = 0.0

class FinalAssessment(BaseModel):
    patient_id: str
    speech: SpeechMetrics = Field(default_factory=SpeechMetrics)
    memory: MemoryMetrics = Field(default_factory=MemoryMetrics)
    attention: AttentionMetrics = Field(default_factory=AttentionMetrics)
    naming: NamingMetrics = Field(default_factory=NamingMetrics)
    fluency: FluencyMetrics = Field(default_factory=FluencyMetrics)
    overall_score: float = 0.0
    risk_level: str = "Pending"
