import mediapipe as mp
import mediapipe.tasks as mt
print('mediapipe.tasks file:', getattr(mt, '__file__', 'unknown'))
print('mediapipe.tasks dir:')
print('\n'.join(sorted([k for k in dir(mt) if not k.startswith('_')])))
