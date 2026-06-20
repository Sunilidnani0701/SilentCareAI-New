import streamlit as st
import pandas as pd
from datetime import datetime
import random
import time

# Import custom modules
from components import load_css
from dashboard import render_dashboard, render_sidebar, calculate_overall_risk

# --- 1. Page Configuration ---
# Must be the first Streamlit command in the app
st.set_page_config(
    page_title="SilentCare AI Dashboard",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Load external CSS for large fonts and custom colors
load_css("styles.css")

# --- 2. Mock Data Generator ---
# This simulates incoming data from the AI models (Vision, Speech, ESP32)
def generate_mock_data():
    """Generates synthetic data to demonstrate the UI color-coding and layout."""
    
    # Randomly select a scenario to show different UI states
    scenario_weights = [0.6, 0.2, 0.1, 0.1] # Normal, Monitor, Warning, Emergency
    scenario = random.choices(["normal", "monitor", "warning", "emergency"], weights=scenario_weights)[0]
    
    # Initialize variables
    fall_detected = False
    
    if scenario == "normal":
        vision_risk = random.randint(0, 25)
        speech_risk = random.randint(0, 25)
        wearable_risk = random.randint(0, 25)
        transcript = "Today is a beautiful day."
        hr = random.randint(65, 85)
    elif scenario == "monitor":
        vision_risk = random.randint(30, 55)
        speech_risk = random.randint(30, 55)
        wearable_risk = random.randint(30, 55)
        transcript = "I'm feeling a bit tired today."
        hr = random.randint(85, 100)
    elif scenario == "warning":
        vision_risk = random.randint(60, 75)
        speech_risk = random.randint(60, 75)
        wearable_risk = random.randint(60, 75)
        transcript = "I'm feeling dizzy, my head hurts."
        hr = random.randint(100, 115)
    else: # emergency
        vision_risk = random.randint(80, 100)
        speech_risk = random.randint(80, 100)
        wearable_risk = random.randint(80, 100)
        # 50% chance of a fall event during an emergency
        fall_detected = random.choice([True, False])
        transcript = "Help! I can't get up!" if fall_detected else "Someone please help me!"
        hr = random.randint(115, 145)

    # Calculate overall risk
    overall_risk = calculate_overall_risk(vision_risk, speech_risk, wearable_risk)
    
    # Construct the data dictionary payload
    data = {
        "overall_risk": overall_risk,
        "vision": {
            "risk_score": vision_risk,
            "fall_detected": fall_detected,
            "facial_risk": max(0, vision_risk - random.randint(0, 10)),
            "movement_status": "Irregular" if vision_risk > 60 else "Normal"
        },
        "speech": {
            "risk_score": speech_risk,
            "transcript": transcript,
            "clarity_index": "Low" if speech_risk > 60 else "High"
        },
        "wearable": {
            "risk_score": wearable_risk,
            "connection": "Connected",
            "acceleration": round(random.uniform(2.5, 4.0) if fall_detected else random.uniform(0.8, 1.2), 2),
            "gyro_status": "Irregular" if wearable_risk > 70 else "Stable",
            "heart_rate": hr
        }
    }
    return data

def get_mock_timeline(mock_data):
    """Generates a dynamic activity timeline based on current status."""
    now = datetime.now()
    
    events = [
        {"time": now.strftime("%I:%M %p"), "text": "Dashboard data synchronized."}
    ]
    
    if mock_data["overall_risk"] >= 80:
        events.append({"time": (now - pd.Timedelta(minutes=1)).strftime("%I:%M %p"), "text": "Emergency protocols initiated."})
    if mock_data["vision"]["fall_detected"]:
        events.append({"time": (now - pd.Timedelta(minutes=2)).strftime("%I:%M %p"), "text": "Sudden acceleration detected by Wearable."})
    elif mock_data["overall_risk"] < 30:
        events.append({"time": (now - pd.Timedelta(minutes=15)).strftime("%I:%M %p"), "text": "Normal Monitoring routine."})
        events.append({"time": (now - pd.Timedelta(minutes=30)).strftime("%I:%M %p"), "text": "Smile Test Completed: Passed."})
        
    events.append({"time": "System Start", "text": "All modules connected successfully."})
    return events

# --- 3. Main Application Flow ---
def main():
    # Render the Header section
    st.markdown("<h1 style='text-align: center; color: #2c3e50; font-weight: 800; font-size: 3rem; margin-bottom: 0;'>SILENTCARE AI</h1>", unsafe_allow_html=True)
    st.markdown("<h3 style='text-align: center; color: #7f8c8d; margin-top: 5px;'>Early Emergency Detection System</h3>", unsafe_allow_html=True)
    
    # Display Current Timestamp
    current_time = datetime.now().strftime('%Y-%m-%d %I:%M:%S %p')
    st.markdown(f"<p style='text-align: center; color: #95a5a6; font-size: 1.1rem;'>Last Updated: <strong>{current_time}</strong></p>", unsafe_allow_html=True)
    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Initialize session state for data persistence across reruns
    if 'mock_data' not in st.session_state:
        st.session_state.mock_data = generate_mock_data()
        
    # Refresh Logic
    st.sidebar.markdown("### Control Panel")
    if st.sidebar.button("🔄 Simulate New Data Fetch", use_container_width=True):
        st.session_state.mock_data = generate_mock_data()
    
    st.sidebar.markdown("---")
    
    # Fetch Data and Timeline
    current_data = st.session_state.mock_data
    timeline_events = get_mock_timeline(current_data)
    
    # Render Sidebar and Main Dashboard
    render_sidebar(timeline_events)
    render_dashboard(current_data)
    
    # Optional: Display raw data payload for debugging (hidden by default)
    with st.expander("Developer Debug View (Raw Payload)"):
        st.json(current_data)

if __name__ == "__main__":
    main()
