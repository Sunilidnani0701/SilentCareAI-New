# modules/memory.py
import random
from typing import Tuple, List

# Standard clinical words for memory testing
CLINICAL_WORDS = ["Banana", "Elephant", "Airplane", "Sun", "Chair", "River"]

def generate_words(count: int = 3) -> List[str]:
    return random.sample(CLINICAL_WORDS, count)

def execute_immediate_recall(assigned_words: List[str], user_input: str) -> Tuple[float, List[str]]:
    # TODO: Implement proper word matching (e.g. fuzzy matching)
    recalled = []
    user_words = [w.lower().strip() for w in user_input.split()]
    for word in assigned_words:
        if word.lower() in user_words:
            recalled.append(word)
    
    score = (len(recalled) / len(assigned_words)) * 100 if assigned_words else 0.0
    return score, recalled

def execute_delayed_recall(assigned_words: List[str], user_input: str) -> Tuple[float, List[str]]:
    # Similar logic for delayed recall
    return execute_immediate_recall(assigned_words, user_input)
