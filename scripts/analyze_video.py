import csv
import os
import cv2
import mediapipe as mp
import numpy as np

VIDEO_PATH = os.path.join('src', 'videos', 'exercise_samples.mp4')
OUT_CSV = 'video_analysis.csv'

# Some mediapipe builds may expose solutions differently; try safe import
# If classic `mp.solutions` isn't available, leave mp_pose as None and
# let the analysis function attempt the Tasks API (.task) model instead.
try:
    mp_pose = mp.solutions.pose
except Exception:
    mp_pose = None

def angle(a, b, c):
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    rads = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    ang = np.abs(rads * 180.0 / np.pi)
    if ang > 180.0:
        ang = 360 - ang
    return ang

def landmark_to_xy(lm, w, h):
    return [lm.x * w, lm.y * h]

def score_rule(elbow_avg, knee_avg, torso_tilt):
    scores = {'bicep':0, 'squat':0, 'pushup':0, 'latpulldown':0}
    if knee_avg is not None:
        if knee_avg < 120: scores['squat'] += 0.9
        elif knee_avg < 140: scores['squat'] += 0.4
        else: scores['squat'] += 0.1
    if elbow_avg is not None:
        if elbow_avg < 100:
            if torso_tilt < 45: scores['pushup'] += 0.9
            else: scores['bicep'] += 0.9
        elif elbow_avg < 140:
            scores['bicep'] += 0.3
        else:
            scores['latpulldown'] += 0.2
    if torso_tilt < 40: scores['pushup'] += 0.3
    else: scores['bicep'] += 0.1
    return scores

def analyze():
    if not os.path.exists(VIDEO_PATH):
        print('Video not found at', VIDEO_PATH)
        return

    cap = cv2.VideoCapture(VIDEO_PATH)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 640)
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 480)

    # Try to use MediaPipe Tasks PoseLandmarker with a .task model if available
    landmarker = None
    use_tasks = False
    model_path = os.path.join('models', 'pose_landmarker.task')
    try:
        from mediapipe.tasks.python.vision import pose_landmarker
        from mediapipe.tasks.python.vision.core import image as mp_image
        if os.path.exists(model_path):
            landmarker = pose_landmarker.PoseLandmarker.create_from_model_path(model_path)
            use_tasks = True
    except Exception:
        landmarker = None
        use_tasks = False

    # Fallback to classic solutions API if Tasks API not available
    pose = None
    if not use_tasks:
        try:
            pose = mp_pose.Pose(static_image_mode=False, min_detection_confidence=0.5, min_tracking_confidence=0.5)
        except Exception:
            pose = None

    rows = []
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        left_el = right_el = left_knee = right_knee = None
        torso_tilt = None

        lm = None
        # Use Tasks API landmarker if available
        if use_tasks and landmarker is not None:
            try:
                mp_img = mp_image.Image(image_format=mp_image.ImageFormat.SRGB, data=rgb.astype(np.uint8))
                res = landmarker.detect(mp_img)
                # result may contain pose_landmarks as a list; handle a few shapes
                pose_landmarks = None
                if hasattr(res, 'pose_landmarks') and res.pose_landmarks:
                    pose_landmarks = res.pose_landmarks
                elif hasattr(res, 'landmarks') and res.landmarks:
                    pose_landmarks = res.landmarks
                if pose_landmarks:
                    first = pose_landmarks[0]
                    if hasattr(first, 'landmark'):
                        lm = first.landmark
                    else:
                        lm = first
            except Exception:
                lm = None
        elif pose is not None:
            try:
                res = pose.process(rgb)
                if res and res.pose_landmarks:
                    lm = res.pose_landmarks.landmark
            except Exception:
                lm = None

        if lm:
            try:
                le = angle(landmark_to_xy(lm[11], w, h), landmark_to_xy(lm[13], w, h), landmark_to_xy(lm[15], w, h))
                re = angle(landmark_to_xy(lm[12], w, h), landmark_to_xy(lm[14], w, h), landmark_to_xy(lm[16], w, h))
                lk = angle(landmark_to_xy(lm[23], w, h), landmark_to_xy(lm[25], w, h), landmark_to_xy(lm[27], w, h))
                rk = angle(landmark_to_xy(lm[24], w, h), landmark_to_xy(lm[26], w, h), landmark_to_xy(lm[28], w, h))
                left_el, right_el, left_knee, right_knee = le, re, lk, rk
                sMidX = (lm[11].x + lm[12].x) / 2
                sMidY = (lm[11].y + lm[12].y) / 2
                hMidX = (lm[23].x + lm[24].x) / 2
                hMidY = (lm[23].y + lm[24].y) / 2
                dx = sMidX - hMidX
                dy = sMidY - hMidY
                torso_tilt = abs(np.arctan2(dy, dx)) * 180 / np.pi
            except Exception:
                pass

        elbow_avg = None if left_el is None and right_el is None else np.mean([v for v in [left_el, right_el] if v is not None])
        knee_avg = None if left_knee is None and right_knee is None else np.mean([v for v in [left_knee, right_knee] if v is not None])

        scores = score_rule(elbow_avg, knee_avg, torso_tilt if torso_tilt is not None else 90)
        best = max(scores.items(), key=lambda x: x[1])

        rows.append({
            'frame': frame_idx,
            'time_s': frame_idx / fps,
            'left_elbow': left_el,
            'right_elbow': right_el,
            'left_knee': left_knee,
            'right_knee': right_knee,
            'torso_tilt': torso_tilt,
            'suggested': best[0],
            'score': best[1]
        })

        frame_idx += 1

    cap.release()
    if pose is not None:
        try:
            pose.close()
        except Exception:
            pass
    if landmarker is not None:
        try:
            landmarker.close()
        except Exception:
            pass

    with open(OUT_CSV, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['frame','time_s','left_elbow','right_elbow','left_knee','right_knee','torso_tilt','suggested','score'])
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    print('Analysis complete — wrote', OUT_CSV)

if __name__ == '__main__':
    analyze()
