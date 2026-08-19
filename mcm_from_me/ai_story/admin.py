from django.contrib import admin
from .models import Product, Option, UserStyleSelection, JourneyCard, HesitationReason, JourneyCardTemplate, ProductRecommendation


@admin.register(JourneyCardTemplate)
class JourneyCardTemplateAdmin(admin.ModelAdmin):
    list_display = ['theme_name', 'subtitle', 'is_active']
    
admin.site.register(Product)
admin.site.register(Option)
admin.site.register(UserStyleSelection)
admin.site.register(JourneyCard)
admin.site.register(HesitationReason)
admin.site.register(ProductRecommendation)