# core/session.py
from core.schemas import FinalAssessment
from modules.speech_stt import transcribe_audio
from modules.speech_nlp import analyze_speech
from modules.memory import generate_words, execute_immediate_recall, execute_delayed_recall
from modules.naming import execute_naming_test
from modules.attention import execute_attention_test
from modules.fluency import execute_fluency_test
from scoring.risk_engine import calculate_risk

class AssessmentSession:
    def __init__(self, patient_id: str):
        self.assessment = FinalAssessment(patient_id=patient_id)
        
    def run_step_1_to_4_speech(self, audio_file_path: str):
        transcript = transcribe_audio(audio_file_path)
        metrics = analyze_speech(transcript)
        self.assessment.speech = metrics
        
    def run_step_5_immediate_memory(self, user_input: str):
        words = generate_words(3)
        self.assessment.memory.words_assigned = words
        score, recalled = execute_immediate_recall(words, user_input)
        self.assessment.memory.immediate_score = score
        self.assessment.memory.immediate_recalled = recalled
        
    def run_step_6_naming(self, answers: dict):
        metrics = execute_naming_test(answers)
        self.assessment.naming = metrics

    def run_step_7_attention(self, forward_input: str, backward_input: str):
        metrics = execute_attention_test(forward_input, backward_input)
        self.assessment.attention = metrics

    def run_step_8_fluency(self, words_input: str):
        metrics = execute_fluency_test(words_input)
        self.assessment.fluency = metrics

    def run_step_9_delayed_memory(self, user_input: str):
        score, recalled = execute_delayed_recall(self.assessment.memory.words_assigned, user_input)
        self.assessment.memory.delayed_score = score
        self.assessment.memory.delayed_recalled = recalled

    def run_step_10_and_11_scoring(self) -> FinalAssessment:
        self.assessment = calculate_risk(self.assessment)
        return self.assessment
