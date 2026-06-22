# modules/attention.py
from core.schemas import AttentionMetrics

def execute_attention_test(forward_input: str, backward_input: str) -> AttentionMetrics:
    # TODO: Implement digit span scoring
    return AttentionMetrics(
        forward_score=100.0,
        backward_score=100.0,
        total_score=100.0
    )
