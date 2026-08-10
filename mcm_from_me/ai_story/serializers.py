from rest_framework import serializers
from .models import Product, Option, StyleCombination, UserStyleSelection, JourneyCard, HesitationReason

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
    class Meta:
        model = JourneyCard
        fields = [
            'id', 'style_selection', 'captured_photo',
            'title', 'card_text', 'order',
            'is_selected', 'status', 'created_at'
        ]
        read_only_fields = ['status', 'created_at']

class HesitationReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = HesitationReason
        fields = ['id', 'style_selection', 'reason', 'ai_reconsidered_card', 'created_at']
        read_only_fields = ['ai_reconsidered_card', 'created_at']