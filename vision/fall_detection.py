from ultralytics import YOLO
import cv2
import time

# Load YOLO Pose Model
model = YOLO("yolov8n-pose.pt")

# Webcam
cap = cv2.VideoCapture(0)

fall_start_time = None
fall_detected = False

while True:

    ret, frame = cap.read()

    if not ret:
        break

    results = model(frame, verbose=False)

    annotated = results[0].plot()

    if len(results[0].keypoints.data) > 0:

        kp = results[0].keypoints.data[0]

        # Important Keypoints
        left_shoulder = kp[5]
        right_shoulder = kp[6]

        left_ankle = kp[15]
        right_ankle = kp[16]

        # Check if ankles are visible
        ankle_visible = (
            left_ankle[2] > 0.5 and
            right_ankle[2] > 0.5
        )

        if ankle_visible:

            # Mid Shoulder
            shoulder_x = (
                left_shoulder[0] +
                right_shoulder[0]
            ) / 2

            shoulder_y = (
                left_shoulder[1] +
                right_shoulder[1]
            ) / 2

            # Mid Ankle
            ankle_x = (
                left_ankle[0] +
                right_ankle[0]
            ) / 2

            ankle_y = (
                left_ankle[1] +
                right_ankle[1]
            ) / 2

            # Body Measurements
            body_height = abs(
                ankle_y - shoulder_y
            )

            body_width = abs(
                right_shoulder[0] -
                left_shoulder[0]
            )

            ratio = body_width / body_height

            # --------------------
            # POSTURE DETECTION
            # --------------------

            if ratio > 0.5:

                status = "LYING"
                color = (0, 0, 255)

                if fall_start_time is None:
                    fall_start_time = time.time()

                elapsed = (
                    time.time() -
                    fall_start_time
                )

                if elapsed > 3:
                    fall_detected = True

            else:

                status = "STANDING"
                color = (0, 255, 0)

                fall_start_time = None
                fall_detected = False

            # --------------------
            # DISPLAY
            # --------------------

            cv2.putText(
                annotated,
                f"Status: {status}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                color,
                2
            )

            cv2.putText(
                annotated,
                f"Ratio: {ratio:.2f}",
                (20, 80),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                color,
                2
            )

            # Timer

            if fall_start_time is not None:

                elapsed = (
                    time.time() -
                    fall_start_time
                )

                cv2.putText(
                    annotated,
                    f"Timer: {elapsed:.1f}s",
                    (20, 120),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    color,
                    2
                )

            # Body Line

            cv2.line(
                annotated,
                (int(shoulder_x), int(shoulder_y)),
                (int(ankle_x), int(ankle_y)),
                color,
                3
            )

            # --------------------
            # FALL ALERT
            # --------------------

            if fall_detected:

                cv2.rectangle(
                    annotated,
                    (0, 0),
                    (
                        annotated.shape[1],
                        annotated.shape[0]
                    ),
                    (0, 0, 255),
                    10
                )

                cv2.putText(
                    annotated,
                    "FALL DETECTED!",
                    (20, 180),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.2,
                    (0, 0, 255),
                    3
                )

        else:

            cv2.putText(
                annotated,
                "FULL BODY NOT VISIBLE",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 255),
                2
            )

    cv2.imshow(
        "SilentCare Fall Detection",
        annotated
    )

    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()