from rest_framework import serializers
from .models import (
    Product, Option, StyleCombination, UserStyleSelection,
    JourneyCard, HesitationReason, ProductRecommendation, JourneyCardTemplate
)

class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'group', 'name', 'code_name']

class StyleCombinationSerializer(serializers.ModelSerializer):
    carry_option = OptionSerializer()
    detail_option = OptionSerializer()

    class Meta:
        model = StyleCombination
        fields = ['id', 'carry_option', 'detail_option', 'image_url', 'ai_narration']

class UserStyleSelectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserStyleSelection
        fields = ['id', 'product', 'carry_option', 'detail_option', 'ai_narration', 'created_at']
        read_only_fields = ['created_at']

class JourneyCardSerializer(serializers.ModelSerializer):
    # 프론트엔드가 즉시 <img> 태그에 꽂을 수 있도록 절대/상대 URL 제공
    card_image_url = serializers.SerializerMethodField()

    class Meta:
        model = JourneyCard
        fields = [
            'id', 'style_selection', 'captured_photo',
            'card_image', 'card_image_url', # <- 새로 추가된 이미지 필드
            'title', 'card_text', 'order',
            'is_selected', 'status', 'created_at'
        ]
        read_only_fields = ['status', 'created_at']

    def get_card_image_url(self, obj):
        # 1. AI가 생성/합성한 카드의 이미지가 있으면 반환
        if obj.card_image:
            return obj.card_image.url
        # 2. 카드 이미지가 아직 없을 때 촬영 원본 사진 fallback
        if obj.captured_photo and obj.captured_photo.image:
            return obj.captured_photo.image.url
        return None

class HesitationReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = HesitationReason
        fields = ['id', 'style_selection', 'reason', 'ai_reconsidered_card', 'created_at']
        read_only_fields = ['ai_reconsidered_card', 'created_at']

class ProductRecommendationSerializer(serializers.ModelSerializer):
    reason_tags_list = serializers.SerializerMethodField()

    class Meta:
        model = ProductRecommendation
        fields = [
            'id', 'hesitation', 'recommended_product',
            'analysis_text', 'reason_tags_list', 'created_at'
        ]

    def get_reason_tags_list(self, obj):
        return obj.get_reason_tags_list()

class JourneyCardTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = JourneyCardTemplate
        fields = ['id', 'theme_name', 'subtitle', 'card_text', 'background_image']