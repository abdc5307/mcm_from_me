"""
URL configuration for mcm_from_me project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/ai_story/', include('ai_story.urls')),
    path('api/product/', include('product.urls')),
    path('', TemplateView.as_view(template_name='landing.html'), name='landing'),
    path('chapter1/', TemplateView.as_view(template_name='chapter1.html'), name='chapter1'),
    path(
        'hamburger-menu/',
        xframe_options_sameorigin(TemplateView.as_view(template_name='hamburger_menu.html')),
        name='hamburger_menu',
    ),
    path('api/journey/', include('journey.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
