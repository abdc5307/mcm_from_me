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

#피사체 사진 확인
def check_in_frame(image_file, center_ratio=0.6):

    image_file.seek(0)
    img = Image.open(image_file).convert('L')
    w, h = img.size

    cx0, cy0 = int(w * (1 - center_ratio) / 2), int(h * (1 - center_ratio) / 2)
    cx1, cy1 = w - cx0, h - cy0
    center_crop = img.crop((cx0, cy0, cx1, cy1))

    edges = center_crop.filter(ImageFilter.FIND_EDGES)
    arr = np.array(edges, dtype=np.float64)
    edge_density = float(arr.mean())

    return edge_density >= 8.0