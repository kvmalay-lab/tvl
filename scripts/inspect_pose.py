from mediapipe.tasks.python import vision
import inspect
print('PoseLandmarker:', vision.PoseLandmarker)
print('\nAttributes:')
print('\n'.join([k for k in dir(vision.PoseLandmarker) if not k.startswith('_')]))
print('\nSignature:')
print(inspect.signature(vision.PoseLandmarker.create_from_model_path))
