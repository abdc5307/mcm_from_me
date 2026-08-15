from rest_framework import serializers
from .models import JourneySession, Product

# 제품 정보 시리얼라이저 (verify_product_tag 등에서 활용)
class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'story_title', 'story_desc', 'image_url']


# 여정 세션 시리얼라이저 (init_or_check_session, resume_journey 등에서 활용)
class JourneySessionSerializer(serializers.ModelSerializer):
    product_id = serializers.ReadOnlyField(source='product.id', default=None)
    product_name = serializers.ReadOnlyField(source='product.name', default=None)

    class Meta:
        model = JourneySession
        fields = [
            'id', 
            'current_chapter', 
            'last_active_screen', 
            'selected_moment', 
            'carry_option', 
            'detail_option', 
            'photo_url', 
            'is_completed', 
            'product_id', 
            'product_name',
            'ai_story_text'
        ]
        read_only_fields = ['id', 'is_completed']