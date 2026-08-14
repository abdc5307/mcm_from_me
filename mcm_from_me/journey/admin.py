from django.contrib import admin
from .models import Product, JourneySession

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'nfc_tag_id', 'qr_code_id', 'is_supported')
    search_fields = ('name', 'nfc_tag_id', 'qr_code_id')

@admin.register(JourneySession)
class JourneySessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'current_chapter', 'last_active_screen', 'selected_moment', 'product', 'is_completed', 'created_at')
    list_filter = ('current_chapter', 'is_completed')
    readonly_fields = ('id', 'created_at', 'updated_at')