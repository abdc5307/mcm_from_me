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
from product.views import chapter4_page_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/ai_story/', include('ai_story.urls')),
    path('api/product/', include('product.urls')),
    path('', TemplateView.as_view(template_name='landing.html'), name='landing'),
    path('chapter1/', TemplateView.as_view(template_name='chapter1.html'), name='chapter1'),
    path(
        'tag-scan/',
        TemplateView.as_view(
            template_name='tag_scan.html',
            extra_context={
                'is_development': settings.DEBUG,
                'development_tag_code': 'NFC_ELLA_001',
            },
        ),
        name='tag_scan',
    ),
    path('chapter2/', TemplateView.as_view(template_name='chapter2.html'), name='chapter2'),
    path('chapter3/', TemplateView.as_view(template_name='chapter3.html'), name='chapter3'),
    path('chapter4/', chapter4_page_view, name='chapter4'),  # <- 변경된 부분
    path('chapter5/', TemplateView.as_view(template_name='chapter5_discover.html'), name='chapter5'),
    path('errors/network/', TemplateView.as_view(template_name='e01_network_error.html'), name='error_e01'),
    path('errors/tag-not-recognized/', TemplateView.as_view(template_name='e02_qr_scan_failed.html'), name='error_e02'),
    path('errors/unsupported-product/', TemplateView.as_view(template_name='e03_unsupported_product.html'), name='error_e03'),
    path('errors/product-unavailable/', TemplateView.as_view(template_name='e04_product_details_unavailable.html'), name='error_e04'),
    path('errors/resume-session/', TemplateView.as_view(template_name='e13_resume_session.html'), name='error_e13'),
    path('errors/step-locked/', TemplateView.as_view(template_name='e14_step_locked.html'), name='error_e14'),
    path(
        'hamburger-menu/',
        xframe_options_sameorigin(TemplateView.as_view(template_name='hamburger_menu.html')),
        name='hamburger_menu',
    ),
    path('api/journey/', include('journey.urls')),
    path('final/', TemplateView.as_view(template_name='final.html'), name='final'),
    path('preparing/', TemplateView.as_view(template_name='preparing.html'), name='preparing'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
