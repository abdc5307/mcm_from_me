from django.urls import path
from .views import (Chapter3DefaultOptionView, Chapter3SelectOptionView, Chapter3CompleteView, Chapter3SummaryView)
from .views import (Chapter5GenerateCardsView, Chapter5CardListView, Chapter5CardSelectView)
from .views import (Chapter5FinalJourneyView, Chapter5AdvisorConnectView, Chapter5ShareView, Chapter5ProductDetailView, Chapter5CompleteJourneyView, Chapter5HesitationReasonView, Chapter5SubmitToAIView,)
from .views import (Chapter5AnalysisResultView, Chapter5RecommendationAdvisorConnectView, Chapter5RecommendationShareView)

urlpatterns = [
    path('Chapter3/option', Chapter3DefaultOptionView.as_view(), name='chapter3-option'),
    path('Chapter3/select', Chapter3SelectOptionView.as_view(), name='chapter3-select'),
    path('Chapter3/complete', Chapter3CompleteView.as_view(), name='chapter3-complete'),
    path('chapter3/summary/<int:selection_id>/', Chapter3SummaryView.as_view(), name="chapter3-summary"),
    path('chapter5/generate/', Chapter5GenerateCardsView.as_view(), name="chapter5-generate"),
    path('chapter5/cards/<int:selection_id>/', Chapter5CardListView.as_view(), name="chapter5-cards"),
    path('chapter5/card/<int:card_id>/select/', Chapter5CardSelectView.as_view(), name="chapter5-card-select"),
    path('chapter5/final/<int:selection_id>/', Chapter5FinalJourneyView.as_view(), name="chapter5-final"),
    path('chapter5/advisor-connect/', Chapter5AdvisorConnectView.as_view(), name="chapter5-advisor-connect"),
    path('chapter5/share/<int:card_id>/', Chapter5ShareView.as_view(), name="chapter5-share"),
    path('chapter5/product/<int:product_id>/', Chapter5ProductDetailView.as_view(), name="chapter5-product-detail"),
    path('chapter5/complete/<int:selection_id>/', Chapter5CompleteJourneyView.as_view(), name="chapter5-complete"),
    path('chapter5/hesitation/', Chapter5HesitationReasonView.as_view(), name="chapter5-hesitation"),
    path('chapter5/submit-to-ai/', Chapter5SubmitToAIView.as_view(), name="chapter5-submit-to-ai"),
    path('chapter5/analysis/<int:hesitation_id>/', Chapter5AnalysisResultView.as_view(), name="chapter5-analysis"),
    path('chapter5/recommendation/advisor-connect/', Chapter5RecommendationAdvisorConnectView.as_view(), name="chapter5-recommendation-advisor-connect"),
    path('chapter5/recommendation/<int:recommendation_id>/share/', Chapter5RecommendationShareView.as_view(), name="chapter5-recommendation-share"),
]


#템플릿 확인용 url
from .views import (chapter3_flow_view, chapter5_discover_view, chapter5_result_view, chapter5_hesitation_view, chapter5_analysis_view)

urlpatterns += [
    path('view/chapter3/', chapter3_flow_view, name='chapter3-flow'),
    path('view/chapter3/<int:selection_id>/', chapter3_flow_view, name='chapter3-flow-detail'),
    path('view/chapter5/discover/<int:selection_id>/', chapter5_discover_view, name='chapter5-discover-view'),
    path('view/chapter5/result/<int:selection_id>/', chapter5_result_view, name='chapter5-result-view'),
    path('view/chapter5/hesitation/<int:selection_id>/', chapter5_hesitation_view, name='chapter5-hesitation-view'),
    path('view/chapter5/analysis/<int:hesitation_id>/', chapter5_analysis_view, name='chapter5-analysis-view'),
]