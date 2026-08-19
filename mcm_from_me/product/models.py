from django.db import models
from django.core.validators import FileExtensionValidator
from ai_story.models import Product, Option, StyleCombination, UserStyleSelection

# 사진 저장+
class CapturedPhoto(models.Model):

    MODE_CHOICES = [
        ('FRONT_45', 'Front 45°'),
        ('SIDE', 'Side'),
        ('DETAIL', 'Detail'),
    ]

    style_selection = models.ForeignKey(
        UserStyleSelection,
        on_delete=models.CASCADE,
        related_name='captured_photos',
        null=True,     # 추가: 값이 비어 있어도 DB 에러 안 남
        blank=True     # 추가: 폼 유효성 검사 통과 허용
    )
    image = models.ImageField(
        upload_to='chapter4/captures/%Y/%m/%d/',
        validators=[FileExtensionValidator(['jpg', 'jpeg', 'png'])]
    )
    shot_mode = models.CharField(max_length=20, choices=MODE_CHOICES, default='FRONT_45')

    #예외처리에 사용할 내용들 !!
    brightness_score = models.FloatField(null=True, blank=True)
    blur_score = models.FloatField(null=True, blank=True)
    is_in_frame = models.BooleanField(default=True)

    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Photo #{self.id} ({self.shot_mode}) - {self.style_selection_id}"