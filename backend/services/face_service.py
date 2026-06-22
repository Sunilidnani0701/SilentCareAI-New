import cv2
import numpy as np

def run_face_analysis(img, pose_model) -> dict:
    """
    Analyzes an OpenCV image frame using the YOLOv8-pose model to extract 
    head orientation and responsiveness metrics.
    """
    if pose_model is None or img is None:
        return {"head_direction": "Unknown", "responsiveness": "Unknown", "face_detected": False}

    results = pose_model(img, verbose=False)
    if len(results[0].keypoints.data) > 0:
        kp = results[0].keypoints.data[0]
        if len(kp) >= 3:
            nose, left_eye, right_eye = kp[0], kp[1], kp[2]
            face_visible = (nose[2] > 0.5 and left_eye[2] > 0.5 and right_eye[2] > 0.5)

            if face_visible:
                # Head Direction
                eye_center = (left_eye[0] + right_eye[0]) / 2
                diff = nose[0] - eye_center
                if diff > 15:
                    direction = "LOOKING RIGHT"
                elif diff < -15:
                    direction = "LOOKING LEFT"
                else:
                    direction = "LOOKING FORWARD"

                return {
                    "head_direction": direction,
                    "responsiveness": "RESPONSIVE",
                    "face_detected": True
                }
    return {
        "head_direction": "Unknown",
        "responsiveness": "NO FACE DETECTED",
        "face_detected": False
    }
