import streamlit as st
from components import status_card, emergency_alert, render_gauge, module_panel, timeline_event

def calculate_overall_risk(vision_risk, speech_risk, wearable_risk):
    """Calculates a weighted overall risk score based on module risks."""
    # Weights prioritize Wearable (ESP32) and Vision for immediate physical dangers
    return int((vision_risk * 0.4) + (speech_risk * 0.2) + (wearable_risk * 0.4))

def check_for_alerts(mock_data):
    """Determines if there is an active emergency alert based on current data."""
    alerts = []
    if mock_data["vision"]["fall_detected"]:
        alerts.append("POSSIBLE FALL DETECTED")
    if mock_data["overall_risk"] >= 80:
        alerts.append("CRITICAL RISK SCORE REACHED")
    if mock_data["wearable"]["heart_rate"] > 130 or mock_data["wearable"]["heart_rate"] < 40:
        alerts.append("ABNORMAL HEART RATE")
        
    # Combine multiple alerts if they exist
    return " | ".join(alerts) if alerts else None

def render_dashboard(mock_data):
    """Main function to render the entire dashboard layout."""
    
    # ---------------------------------------------------------
    # Top Row: At-a-Glance Status
    # ---------------------------------------------------------
    status_card(mock_data["overall_risk"])
    
    # Render Emergency Alert Panel ONLY if there's an active alert
    active_alert = check_for_alerts(mock_data)
    if active_alert:
        emergency_alert(active_alert)
        
    st.markdown("<br>", unsafe_allow_html=True)
        
    # ---------------------------------------------------------
    # Middle Row: Risk Visualizations (Gauges)
    # ---------------------------------------------------------
    g1, g2, g3, g4 = st.columns(4)
    with g1:
        render_gauge("Overall Risk", mock_data["overall_risk"])
    with g2:
        render_gauge("Vision Risk", mock_data["vision"]["risk_score"])
    with g3:
        render_gauge("Speech Risk", mock_data["speech"]["risk_score"])
    with g4:
        render_gauge("Wearable Risk", mock_data["wearable"]["risk_score"])
        
    st.markdown("<hr style='border: 1px solid #e9ecef;'>", unsafe_allow_html=True)

    # ---------------------------------------------------------
    # Bottom Row: Module Status & Integrations
    # ---------------------------------------------------------
    st.markdown("<h2 style='color: #2c3e50; font-size: 1.6rem; margin-bottom: 20px;'>Live Module Feeds</h2>", unsafe_allow_html=True)
    m1, m2, m3 = st.columns(3)
    
    with m1:
        # Vision Module mapping
        vision_data = {
            "Fall Status": "Detected" if mock_data["vision"]["fall_detected"] else "Normal",
            "Facial Risk": f"{mock_data['vision']['facial_risk']}%",
            "Movement Analysis": mock_data["vision"]["movement_status"]  # Replaced 'Pose Landmark Index'
        }
        module_panel("👁️ Vision Module", vision_data)
        
    with m2:
        # Speech Module mapping
        speech_data = {
            "Transcript": f'"{mock_data["speech"]["transcript"]}"',
            "Speech Risk": f"{mock_data['speech']['risk_score']}%",
            "Vocal Clarity": mock_data["speech"]["clarity_index"]
        }
        module_panel("🎙️ Speech Module", speech_data)
        
    with m3:
        # Wearable Module mapping
        wearable_data = {
            "Sensor Connection": mock_data["wearable"]["connection"],
            "Acceleration": f"{mock_data['wearable']['acceleration']} g",
            "Gyroscope Status": mock_data["wearable"]["gyro_status"],
            "Heart Rate": f"{mock_data['wearable']['heart_rate']} bpm"
        }
        module_panel("⌚ Wearable Module (ESP32)", wearable_data)

def render_sidebar(timeline_events):
    """Renders the Activity Timeline in the sidebar."""
    st.sidebar.markdown("<h2 style='color: #2c3e50; margin-bottom: 20px;'>Activity Timeline</h2>", unsafe_allow_html=True)
    
    for event in timeline_events:
        timeline_event(event["time"], event["text"])
