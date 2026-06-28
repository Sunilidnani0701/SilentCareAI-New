# modules/fluency.py
from core.schemas import FluencyMetrics

def execute_fluency_test(words_input: str) -> FluencyMetrics:
    # Implement valid animal counting and repetition check
    words = words_input.lower().replace(',', '').replace('.', '').split()
    total_words = len(words)
    unique_words = len(set(words))
    repetition = total_words - unique_words
    
    # Simple logic: assume 11+ unique words is a perfect score
    score = min(100.0, (unique_words / 11.0) * 100)
    
    return FluencyMetrics(
        total_valid_words=unique_words,
        repetition_count=repetition,
        score=score
    )
