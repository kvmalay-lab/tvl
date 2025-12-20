import os
import mediapipe as mp

mp_path = os.path.dirname(mp.__file__)
print('mediapipe package path:', mp_path)
for root, dirs, files in os.walk(mp_path):
    for f in files:
        if 'pose' in f.lower() or f.lower().endswith('.task'):
            print(os.path.join(root, f))
