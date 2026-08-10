from django.urls import path
from .views import (Chapter4ReadyView, Chapter4CaptureUploadView, Chapter4PhotoActionView)

urlpatterns = [
    path('chapter4/ready/<int:selection_id>/', Chapter4ReadyView.as_view(), name="chapter4-ready"),
    path('chapter4/capture/', Chapter4CaptureUploadView.as_view(), name="chapter4-capture"),
    path('chapter4/photo/<int:photo_id>/action/', Chapter4PhotoActionView.as_view(), name="chapter4-photo-action"),
]