# modules/attention.py
from core.schemas import AttentionMetrics

def execute_attention_test(forward_input: str, backward_input: str) -> AttentionMetrics:
    # Implement digit span scoring logic
    forward_digits = [int(s) for s in forward_input.split() if s.isdigit()]
    backward_digits = [int(s) for s in backward_input.split() if s.isdigit()]
    
    f_score = min(100.0, len(forward_digits) * 20.0)
    b_score = min(100.0, len(backward_digits) * 25.0)
    
    return AttentionMetrics(
        forward_score=f_score,
        backward_score=b_score,
        total_score=(f_score + b_score) / 2
    )
