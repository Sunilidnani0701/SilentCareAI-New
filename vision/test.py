'''import cv2
import mediapipe as mp

mp_pose = mp.solutions.pose
pose = mp_pose.Pose()

mp_draw = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)

while True:

    ret, frame = cap.read()

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    results = pose.process(rgb)

    if results.pose_landmarks:

        mp_draw.draw_landmarks(
            frame,
            results.pose_landmarks,
            mp_pose.POSE_CONNECTIONS
        )

    cv2.imshow("Pose Detection", frame)

    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()'''

'''import mediapipe as mp

print(mp)
print(mp.__file__)'''

'''import mediapipe as mp

print(dir(mp))'''

'''import mediapipe as mp

print(mp.__version__)'''

'''from mediapipe.tasks.python import vision

print("Works!")'''
import mediapipe as mp

print(mp.__version__)
print(hasattr(mp, "solutions"))