from ultralytics import YOLO
import cv2
import time
import math

# Load model
model = YOLO("yolov8n-pose.pt")

cap = cv2.VideoCapture(0)

# Responsiveness variables
last_nose_x = None
last_nose_y = None

last_movement_time = time.time()

while True:

    ret, frame = cap.read()

    if not ret:
        break

    results = model(frame, verbose=False)

    annotated = results[0].plot()

    if len(results[0].keypoints.data) > 0:

        kp = results[0].keypoints.data[0]

        nose = kp[0]
        left_eye = kp[1]
        right_eye = kp[2]
        left_ear = kp[3]
        right_ear = kp[4]

        face_visible = (
            nose[2] > 0.5 and
            left_eye[2] > 0.5 and
            right_eye[2] > 0.5
        )

        if face_visible:

            # -------------------
            # FACE BOX
            # -------------------

            x_min = int(min(left_eye[0], right_eye[0]) - 60)
            x_max = int(max(left_eye[0], right_eye[0]) + 60)

            y_min = int(min(left_eye[1], right_eye[1]) - 60)
            y_max = int(nose[1] + 100)

            cv2.rectangle(
                annotated,
                (x_min, y_min),
                (x_max, y_max),
                (0, 255, 0),
                2
            )

            cv2.putText(
                annotated,
                "FACE DETECTED",
                (x_min, y_min - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 0),
                2
            )

            # -------------------
            # HEAD DIRECTION
            # -------------------

            eye_center = (
                left_eye[0] +
                right_eye[0]
            ) / 2

            diff = nose[0] - eye_center

            if diff > 15:
                direction = "LOOKING RIGHT"

            elif diff < -15:
                direction = "LOOKING LEFT"

            else:
                direction = "LOOKING FORWARD"

            cv2.putText(
                annotated,
                direction,
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 0, 255),
                2
            )

            # -------------------
            # RESPONSIVENESS
            # -------------------

            current_x = nose[0]
            current_y = nose[1]

            if last_nose_x is not None:

                movement = math.sqrt(
                    (current_x - last_nose_x) ** 2 +
                    (current_y - last_nose_y) ** 2
                )

                if movement > 10:
                    last_movement_time = time.time()

            last_nose_x = current_x
            last_nose_y = current_y

            still_time = (
                time.time() -
                last_movement_time
            )

            if still_time < 10:

                status = "RESPONSIVE"
                color = (0, 255, 0)

            else:

                status = "UNRESPONSIVE"
                color = (0, 0, 255)

            cv2.putText(
                annotated,
                status,
                (20, 90),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                color,
                2
            )

            cv2.putText(
                annotated,
                f"No Movement: {still_time:.1f}s",
                (20, 130),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                color,
                2
            )

            # -------------------
            # DRAW LANDMARKS
            # -------------------

            for point in [
                nose,
                left_eye,
                right_eye,
                left_ear,
                right_ear
            ]:

                cv2.circle(
                    annotated,
                    (
                        int(point[0]),
                        int(point[1])
                    ),
                    5,
                    (255, 0, 0),
                    -1
                )

    else:

        cv2.putText(
            annotated,
            "NO FACE DETECTED",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2
        )

    cv2.imshow(
        "SilentCare Face Analysis",
        annotated
    )

    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()