# scoring/risk_engine.py
from core.schemas import FinalAssessment
from core.config import SCORING_WEIGHTS, get_risk_level

def calculate_risk(assessment: FinalAssessment) -> FinalAssessment:
    """
    Calculates the final unified score based on the weights in config.py
    and assigns a risk level.
    """
    # Assuming each module's score is out of 100
    speech_score = min(100.0, assessment.speech.vocabulary_richness * 100) # Mock metric for speech score
    
    total_score = (
        speech_score * SCORING_WEIGHTS["speech"] +
        assessment.memory.immediate_score * SCORING_WEIGHTS["immediate_recall"] +
        assessment.memory.delayed_score * SCORING_WEIGHTS["delayed_recall"] +
        assessment.attention.total_score * SCORING_WEIGHTS["attention"] +
        assessment.naming.score * SCORING_WEIGHTS["naming"] +
        assessment.fluency.score * SCORING_WEIGHTS["fluency"]
    )
    
    assessment.overall_score = round(total_score, 2)
    assessment.risk_level = get_risk_level(total_score)
    
    return assessment
