from django.urls import path
from .views import (Chapter4ReadyView, Chapter4CaptureUploadView, Chapter4PhotoActionView)
from .views import (Chapter4OpenCameraView, Chapter4ContinueWithoutPhotoView, Chapter4CameraRetryView)

urlpatterns = [
    path('chapter4/ready/<int:selection_id>/', Chapter4ReadyView.as_view(), name="chapter4-ready"),
    path('chapter4/capture/', Chapter4CaptureUploadView.as_view(), name="chapter4-capture"),
    path('chapter4/photo/<int:photo_id>/action/', Chapter4PhotoActionView.as_view(), name="chapter4-photo-action"),
    path('chapter4/camera/open/', Chapter4OpenCameraView.as_view()),
    path('chapter4/camera/continue-without-photo/', Chapter4ContinueWithoutPhotoView.as_view()),
    path('chapter4/camera/retry/', Chapter4CameraRetryView.as_view()),
]


#템플릿 확인용 url
from .views import (chapter4_ready_view, chapter4_camera_view, chapter4_review_view)

urlpatterns += [
    path('view/chapter4/ready/<int:selection_id>/', chapter4_ready_view, name='chapter4-ready-view'),
    path('view/chapter4/camera/<int:selection_id>/', chapter4_camera_view, name='chapter4-camera-view'),
    path('view/chapter4/review/<int:photo_id>/', chapter4_review_view, name='chapter4-review-view'),
]