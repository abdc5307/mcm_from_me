from django.urls import path
from . import views

urlpatterns = [
    # 세션 초기화 및 이탈 복원
    path('session/init/', views.init_or_check_session, name='init_session'),
    path('session/resume/', views.resume_journey, name='resume_session'),
    path('session/reset/', views.start_new_journey, name='reset_session'),

    # C1 ~ C4 단계별 저장
    path('moment/save/', views.save_moment, name='save_moment'),
    path('product/verify/', views.verify_product_tag, name='verify_product_tag'),
    path('style/save/', views.save_style_options, name='save_style_options'),
    path('photo/save/', views.save_photo_url, name='save_photo_url'),

    # 여정 완료 및 Chapter 이동 가드
    path('journey/complete/', views.complete_journey, name='complete_journey'),
    path('chapter/navigate/', views.navigate_chapter, name='navigate_chapter'),

    path('generate-card/', views.generate_journey_card, name='generate_journey_card'),
]