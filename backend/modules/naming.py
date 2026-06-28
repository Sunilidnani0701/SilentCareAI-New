# modules/naming.py
from core.schemas import NamingMetrics

def execute_naming_test(answers: dict) -> NamingMetrics:
    # Implement validation against expected answers
    total = len(answers)
    correct = 0
    
    EXPECTED = {
        "Which animal barks?": "dog",
        "What do you use to tell time?": "clock",
        "What is the color of the sky?": "blue"
    }
    
    for q, ans in answers.items():
        expected = EXPECTED.get(q)
        if expected and expected.lower() in str(ans).lower():
            correct += 1
        elif not expected and ans: 
            correct += 1 # mock fallback
            
    score = (correct / total) * 100 if total > 0 else 0.0
    
    return NamingMetrics(
        total_questions=total,
        correct_answers=correct,
        score=score
    )
