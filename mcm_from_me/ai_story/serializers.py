from rest_framework import serializers
from .models import Product, Option, StyleCombination, UserStyleSelection

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