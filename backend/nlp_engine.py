import re
import random

def analyze_digital_phenotype(transcript: str, duration_seconds: float = 0.0) -> dict:
    """
    Extracts cognitive biomarkers (Digital Phenotyping) from a natural conversation transcript.
    """
    if not transcript or len(transcript.strip()) == 0:
        return {
            "word_count": 0,
            "lexical_diversity": 0.0,
            "wpm": 0.0,
            "filler_words": 0,
            "cognitive_risk": "High (No speech detected)",
            "risk_score": 100
        }
    
    # 1. Clean and tokenize
    words = re.findall(r'\b\w+\b', transcript.lower())
    word_count = len(words)
    
    if word_count == 0:
        return {
            "word_count": 0,
            "lexical_diversity": 0.0,
            "wpm": 0.0,
            "filler_words": 0,
            "cognitive_risk": "High (No words detected)",
            "risk_score": 100
        }

    # 2. Advanced Metrics
    unique_words = set(words)
    ttr = len(unique_words) / word_count
    
    fillers = ["um", "uh", "ah", "like", "you know"]
    filler_count = sum(1 for w in words if w in fillers)
    
    wpm = 0.0
    if duration_seconds > 0:
        minutes = duration_seconds / 60.0
        wpm = word_count / minutes
    
    # Risk calculation
    risk_score = 0
    if ttr > 0.6:
        cognitive_risk = "Low (Healthy vocabulary)"
        risk_score = 10
    elif 0.4 <= ttr <= 0.6:
        cognitive_risk = "Moderate (Some repetition detected)"
        risk_score = 50
    else:
        cognitive_risk = "High (Significant lexical degradation)"
        risk_score = 85
        
    if word_count < 5:
        cognitive_risk = "Elevated (Abnormally short response)"
        risk_score = max(risk_score, 60)
        
    # High filler words -> hesitation
    if word_count > 10 and (filler_count / word_count) > 0.1:
        risk_score = min(100, risk_score + 15)

    return {
        "word_count": word_count,
        "lexical_diversity": round(ttr, 2),
        "wpm": round(wpm, 2),
        "filler_words": filler_count,
        "cognitive_risk": cognitive_risk,
        "risk_score": risk_score
    }

def generate_comforting_response(transcript: str) -> str:
    """Mock LLM response for the Patient Companion."""
    responses = [
        "That sounds like a lovely day, John. Thanks for sharing.",
        "I'm glad you told me about that. Have a great afternoon!",
        "It's always nice to hear your stories, John. Make sure to rest well."
    ]
    return random.choice(responses)
