import mediapipe as mp
import pkgutil, os
mp_path = os.path.dirname(mp.__file__)
print('mediapipe path:', mp_path)
for root, dirs, files in os.walk(mp_path):
    for f in files:
        if f.endswith('.task') or 'pose' in f.lower():
            print(os.path.join(root, f))
