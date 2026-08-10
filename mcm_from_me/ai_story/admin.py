from django.contrib import admin
from .models import Product, Option, UserStyleSelection, JourneyCard, HesitationReason

admin.site.register(Product)
admin.site.register(Option)
admin.site.register(UserStyleSelection)
admin.site.register(JourneyCard)
admin.site.register(HesitationReason)