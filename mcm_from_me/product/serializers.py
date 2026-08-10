from rest_framework import serializers
from .models import CapturedPhoto

class CapturedPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CapturedPhoto
        fields = [
            'id', 'style_selection', 'image', 'shot_mode',
            'brightness_score', 'blur_score', 'is_in_frame',
            'is_used', 'created_at'
        ]
        read_only_fields = ['brightness_score', 'blur_score', 'is_used', 'created_at']