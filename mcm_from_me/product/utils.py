# product/utils.py
from PIL import Image, ImageFilter
import numpy as np

#밝기 확인
def check_brightness(image_file):
    image_file.seek(0)
    img = Image.open(image_file).convert('L')
    arr = np.array(img)
    brightness = float(arr.mean())
    return brightness

#흐림 확인
def check_blur(image_file):
    image_file.seek(0)
    img = Image.open(image_file).convert('L')
    edges = img.filter(ImageFilter.FIND_EDGES)
    arr = np.array(edges, dtype=np.float64)
    blur_score = float(arr.var())
    return blur_score

#사진 품질 확인
def validate_photo_quality(image_file, brightness_threshold=40, blur_threshold=100):
    brightness = check_brightness(image_file)
    blur = check_blur(image_file)

    scores = {'brightness': brightness, 'blur': blur}

    if brightness < brightness_threshold:
        return False, 'E-09', scores

    if blur < blur_threshold:
        return False, 'E-10', scores

    return True, None, scores