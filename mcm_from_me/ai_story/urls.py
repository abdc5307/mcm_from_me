from django.urls import path
from .views import Chapter3DefaultOptionView, Chapter3SelectOptionView, Chapter3CompleteView, Chapter3SummaryView
from .views import (Chapter5GenerateCardsView, Chapter5CardListView, Chapter5CardSelectView)

urlpatterns = [
    path('Chapter3/option', Chapter3DefaultOptionView.as_view(), name='chapter3-option'),
    path('Chapter3/select', Chapter3SelectOptionView.as_view(), name='chapter3-select'),
    path('Chapter3/complete', Chapter3CompleteView.as_view(), name='chapter3-complete'),
    path('chapter3/summary/<int:selection_id>/', Chapter3SummaryView.as_view(), name="chapter3-summary"),
    path('chapter5/generate/', Chapter5GenerateCardsView.as_view(), name="chapter5-generate"),
    path('chapter5/cards/<int:selection_id>/', Chapter5CardListView.as_view(), name="chapter5-cards"),
    path('chapter5/card/<int:card_id>/select/', Chapter5CardSelectView.as_view(), name="chapter5-card-select"),
]