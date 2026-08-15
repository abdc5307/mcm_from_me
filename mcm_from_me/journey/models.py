import uuid
from django.db import models

class Product(models.Model):
    id = models.CharField(max_length=50, primary_key=True, help_text="예: ELLA_BOSTON_BAG")
    nfc_tag_id = models.CharField(max_length=100, unique=True)
    qr_code_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=100)  # 예: "Ella Boston Bag"
    image_url = models.URLField(max_length=500)
    story_title = models.CharField(max_length=200)  # "A timeless shape for what comes next."
    story_desc = models.TextField()
    is_supported = models.BooleanField(default=True)  # E-03 미지원 제품 구분용

    def __str__(self):
        return f"[{self.id}] {self.name}"


class JourneySession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    current_chapter = models.CharField(max_length=10, default="C1")  # C1, C2, C3, C4, C5, F1
    last_active_screen = models.CharField(max_length=20, default="C1-01")  # H-08 복원용
    
    # Chapter 1: Moment (URBAN_ESCAPE, NEW_JOURNEY, CREATIVE_FLOW, MIDNIGHT_MOVE)
    selected_moment = models.CharField(max_length=50, null=True, blank=True)
    
    # Chapter 2: Product Tag
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name="sessions")
    
    # Chapter 3: Style Options
    carry_option = models.CharField(max_length=50, null=True, blank=True)   # TOP_HANDLE, CROSSBODY
    detail_option = models.CharField(max_length=50, null=True, blank=True)  # BASIC_CHARM, ROCKET_CHARM
    
    # Chapter 4: Photo
    photo_url = models.URLField(max_length=500, null=True, blank=True)
    
    # Chapter 5 & Hesitate (개발자 B가 활용)
    chosen_story_card_id = models.CharField(max_length=50, null=True, blank=True)
    hesitate_reason = models.CharField(max_length=50, null=True, blank=True)  # SIZE, WEIGHT, STORAGE, COMFORT, PRICE, DESIGN
    
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    ai_story_text = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"Session {self.id} | {self.current_chapter} ({self.last_active_screen})"