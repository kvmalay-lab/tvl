import mediapipe as mp
import sys
print('mediapipe module file:', getattr(mp, '__file__', 'unknown'))
print('mediapipe dir:')
print('\n'.join(sorted([k for k in dir(mp) if not k.startswith('_')])))
sys.exit(0)
