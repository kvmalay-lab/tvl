from mediapipe.tasks.python.vision.core import image as img
import inspect
print('Image class:', img.Image)
print('Has create_from_array:', hasattr(img.Image, 'create_from_array'))
print('Available methods:')
print('\n'.join([m for m in dir(img.Image) if not m.startswith('_')]))
