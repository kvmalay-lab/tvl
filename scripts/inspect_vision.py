from mediapipe.tasks.python import vision
print('vision module file:', getattr(vision, '__file__', 'unknown'))
print('\n'.join(sorted([k for k in dir(vision) if not k.startswith('_')])))
