# modules/fluency.py
from core.schemas import FluencyMetrics

def execute_fluency_test(words_input: str) -> FluencyMetrics:
    # TODO: Implement valid animal counting and repetition check
    words = words_input.split()
    total_words = len(words)
    unique_words = len(set(words))
    
    return FluencyMetrics(
        total_valid_words=unique_words,
        repetition_count=total_words - unique_words,
        score=min(100.0, (unique_words / 15.0) * 100) # Assuming 15 is a perfect score
    )
