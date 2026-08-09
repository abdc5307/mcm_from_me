from django.urls import path
from .views import Chapter3DefaultOptionView, Chapter3SelectOptionView, Chapter3CompleteView, Chapter3SummaryView

urlpatterns = [
    path('Chapter3/option', Chapter3DefaultOptionView.as_view(), name='chapter3-option'),
    path('Chapter3/select', Chapter3SelectOptionView.as_view(), name='chapter3-select'),
    path('Chapter3/complete', Chapter3CompleteView.as_view(), name='chapter3-complete'),
    path('chapter3/summary/<int:selection_id>/', Chapter3SummaryView.as_view(), name="chapter3-summary"),
]