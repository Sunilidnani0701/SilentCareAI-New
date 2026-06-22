# modules/naming.py
from core.schemas import NamingMetrics

def execute_naming_test(answers: dict) -> NamingMetrics:
    # TODO: Implement validation against expected answers
    # e.g., answers = {"Which animal barks?": "dog", ...}
    total = len(answers)
    correct = total  # Mocking that all are correct
    score = (correct / total) * 100 if total > 0 else 0.0
    
    return NamingMetrics(
        total_questions=total,
        correct_answers=correct,
        score=score
    )
