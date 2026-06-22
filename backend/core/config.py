# core/config.py

# Weights for the Unified Scoring Engine
SCORING_WEIGHTS = {
    "speech": 0.20,
    "immediate_recall": 0.15,
    "delayed_recall": 0.25,
    "attention": 0.15,
    "naming": 0.10,
    "fluency": 0.15
}

# Risk Thresholds
RISK_THRESHOLDS = {
    "low_min": 80,
    "low_max": 100,
    "moderate_min": 60,
    "moderate_max": 79,
    "high_max": 59
}

def get_risk_level(score: float) -> str:
    if score >= RISK_THRESHOLDS["low_min"]:
        return "Low Risk"
    elif score >= RISK_THRESHOLDS["moderate_min"]:
        return "Moderate Risk"
    else:
        return "High Risk"
