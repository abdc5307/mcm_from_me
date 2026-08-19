import uuid
import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import (
    Product, Option, StyleCombination, UserStyleSelection,
    JourneyCard, HesitationReason, ProductRecommendation, JourneyCardTemplate
)
from .serializers import (
    StyleCombinationSerializer, UserStyleSelectionSerializer,
    JourneyCardSerializer, HesitationReasonSerializer, ProductRecommendationSerializer
)
from .utils import (
    generate_ai_narration, generate_journey_card_text, generate_ai_analysis_and_recommendation
)
from .services import generate_ai_card_image  # <-- AI 생성 서비스 함수 연동
from .errors import error_response
from product.models import CapturedPhoto

logger = logging.getLogger('journey_save')


# =====================================================
# Chapter 3 REST APIs
# =====================================================

# 초기 기본 세팅
class Chapter3DefaultOptionView(APIView):
    def get(self, request):
        default_combination = StyleCombination.objects.filter(
            carry_option__code_name='top_handle',
            detail_option__code_name='basic_charm'
        ).first()

        if not default_combination:
            return Response({"error": "기본 옵션 데이터를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        serializer = StyleCombinationSerializer(default_combination)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)


# 옵션 변경시
class Chapter3SelectOptionView(APIView):
    def post(self, request):
        carry_code = request.data.get('carry')
        detail_code = request.data.get('detail')
        product_id = request.data.get('product_id')

        if not carry_code or not detail_code:
            return Response({"error": "Carry와 Detail 옵션 값이 모두 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            carry_option = Option.objects.get(code_name=carry_code, group='carry')
            detail_option = Option.objects.get(code_name=detail_code, group='detail')
            product = Product.objects.get(id=product_id)
        except (Option.DoesNotExist, Product.DoesNotExist):
            return Response({"error": "존재하지 않는 옵션 또는 제품입니다."}, status=status.HTTP_404_NOT_FOUND)

        ai_narration_text = generate_ai_narration(product, carry_option, detail_option)
        if not ai_narration_text:
            ai_narration_text = "내레이션을 생성하는 중 문제가 발생했습니다."

        data = {
            "ai_narration": ai_narration_text,
            "style_summary": {
                "product": product.name,
                "carry_option": carry_option.code_name,
                "detail_option": detail_option.code_name,
            }
        }

        return Response({
            "status": "success",
            "data": data
        }, status=status.HTTP_200_OK)


# 작성 완료하고 내용 저장
class Chapter3CompleteView(APIView):
    def post(self, request):
        product_id = request.data.get('product_id')
        carry_id = request.data.get('carry_id')
        detail_id = request.data.get('detail_id')

        if not product_id or not carry_id or not detail_id:
            return Response({"error": "필수 옵션이 선택되지 않았습니다."}, status=status.HTTP_400_BAD_REQUEST)

        data = {
            "product": product_id,
            "carry_option": carry_id,
            "detail_option": detail_id
        }

        serializer = UserStyleSelectionSerializer(data=data)
        if serializer.is_valid():
            instance = serializer.save()

            try:
                narration = generate_ai_narration(
                    instance.product, instance.carry_option, instance.detail_option
                )
                if narration:
                    instance.ai_narration = narration
                    instance.save()
            except Exception as e:
                logger.error(f"나레이션 생성 오류: {e}")

            return Response({
                "status": "success",
                "message": "스타일 선택이 성공적으로 저장되었습니다.",
                "data": UserStyleSelectionSerializer(instance).data,
                "selection_id": instance.id
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Summary 내용 조회
class Chapter3SummaryView(APIView):
    def get(self, request, selection_id):
        try:
            selection = UserStyleSelection.objects.select_related(
                'product', 'carry_option', 'detail_option'
            ).get(id=selection_id)
        except UserStyleSelection.DoesNotExist:
            return Response({"error": "선택 데이터를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        if not selection.carry_option or not selection.detail_option:
            selection.refresh_from_db()
            if not selection.carry_option or not selection.detail_option:
                return Response({"error": "옵션 데이터가 누락되었습니다."}, status=status.HTTP_400_BAD_REQUEST)

        narration = selection.ai_narration if selection.ai_narration else None

        data = {
            "product_image": selection.product.image_url if hasattr(selection.product, 'image_url') else None,
            "ai_narration": narration,
            "style_summary": {
                "product": selection.product.name,
                "carry_option": selection.carry_option.code_name,
                "detail_option": selection.detail_option.code_name,
            }
        }

        return Response({
            "status": "success",
            "data": data
        }, status=status.HTTP_200_OK)


# =====================================================
# Chapter 5 REST APIs
# =====================================================

# 카드 생성 요청시
class Chapter5GenerateCardsView(APIView):
    def post(self, request):
        selection_id = request.data.get('selection_id')
        card_count = int(request.data.get('card_count', 1))

        if not selection_id:
            return Response({"error": "selection_id가 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            selection = UserStyleSelection.objects.select_related(
                'product', 'carry_option', 'detail_option'
            ).get(id=selection_id)
        except UserStyleSelection.DoesNotExist:
            return Response({"error": "선택 데이터를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        captured_photo = CapturedPhoto.objects.filter(style_selection=selection, is_used=True).first()
        templates = list(JourneyCardTemplate.objects.filter(is_active=True)[:card_count])

        created_cards = []
        try:
            for i in range(card_count):
                template = templates[i] if i < len(templates) else None

                card_text = template.card_text if template else generate_journey_card_text(
                    selection.product,
                    selection.carry_option,
                    selection.detail_option,
                    selection.ai_narration
                )
                title = template.theme_name if template else 'My MCM Story Card'

                # 1. 초기 JourneyCard 객체 생성 (기본 processing 상태)
                card = JourneyCard.objects.create(
                    style_selection=selection,
                    captured_photo=captured_photo,
                    template=template,
                    title=title,
                    card_text=card_text,
                    order=i,
                    status='processing'
                )

                # 2. AI 이미지 생성 및 할당 로직 실행
                card = generate_ai_card_image(card)
                created_cards.append(card)

        except Exception as e:
            logger.error(f"카드 생성 실패 (selection_id={selection_id}): {e}")
            return Response({"error": error_response('E-11')}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        valid_cards = [c for c in created_cards if c.status == 'completed']
        if not valid_cards:
            return Response({"error": error_response('E-11')}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = JourneyCardSerializer(valid_cards, many=True, context={'request': request})
        redirect_to = "C5-05" if len(valid_cards) == 1 else "C5-06"

        return Response({
            "status": "success",
            "card_count": len(valid_cards),
            "data": serializer.data,
            "redirect_to": redirect_to
        }, status=status.HTTP_201_CREATED)


# 생성된 카드 목록 조회
class Chapter5CardListView(APIView):
    def get(self, request, selection_id):
        cards = JourneyCard.objects.filter(
            style_selection_id=selection_id,
            status='completed'
        ).order_by('order')

        if not cards.exists():
            return Response({"error": error_response('E-11')}, status=status.HTTP_404_NOT_FOUND)

        serializer = JourneyCardSerializer(cards, many=True, context={'request': request})
        return Response({
            "status": "success",
            "card_count": cards.count(),
            "data": serializer.data
        }, status=status.HTTP_200_OK)


# 카드 선택
class Chapter5CardSelectView(APIView):
    def post(self, request, card_id):
        action = request.data.get('action')
        if action not in ['choose', 'deciding']:
            return Response({"error": "action 값은 'choose' 또는 'deciding'이어야 합니다."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            card = JourneyCard.objects.get(id=card_id)
        except JourneyCard.DoesNotExist:
            return Response({"error": "카드를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        if action == 'deciding':
            return Response({
                "status": "success",
                "redirect_to": "C5-15"
            }, status=status.HTTP_200_OK)

        try:
            JourneyCard.objects.filter(
                style_selection=card.style_selection
            ).exclude(id=card.id).update(is_selected=False)

            card.is_selected = True
            card.save()
        except Exception as e:
            logger.error(f"카드 선택 저장 실패 (card_id={card_id}): {e}")
            return Response({
                "error": error_response('E-11'),
                "redirect_to": None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            "status": "success",
            "message": "카드가 선택되었습니다.",
            "data": JourneyCardSerializer(card, context={'request': request}).data,
            "redirect_to": "C5-09"
        }, status=status.HTTP_200_OK)


# 최종 선택 카드 단일 조회
class Chapter5FinalJourneyView(APIView):
    def get(self, request, selection_id):
        try:
            selection = UserStyleSelection.objects.select_related(
                'product', 'carry_option', 'detail_option'
            ).get(id=selection_id)
        except UserStyleSelection.DoesNotExist:
            return Response({"error": "선택 데이터를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        card = JourneyCard.objects.filter(style_selection=selection, is_selected=True).first()
        if not card:
            return Response({"error": "선택된 카드가 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        image_url = None
        if card.card_image:
            image_url = card.card_image.url
        elif card.captured_photo and card.captured_photo.image:
            image_url = card.captured_photo.image.url

        data = {
            "title": card.title,
            "card_text": card.card_text,
            "image_url": image_url,
            "selection_info": {
                "product_name": selection.product.name,
                "carry_option": selection.carry_option.code_name,
                "detail_option": selection.detail_option.code_name,
            }
        }

        return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)


# 상담원 연결
class Chapter5AdvisorConnectView(APIView):
    def post(self, request):
        selection_id = request.data.get('selection_id')

        try:
            UserStyleSelection.objects.get(id=selection_id)
        except UserStyleSelection.DoesNotExist:
            return Response({"error": "선택 데이터를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        connect_url = "/support/advisor-chat/"
        return Response({
            "status": "success",
            "redirect_to": connect_url
        }, status=status.HTTP_200_OK)


# 결과 공유 URL 생성
class Chapter5ShareView(APIView):
    def post(self, request, card_id):
        try:
            card = JourneyCard.objects.get(id=card_id)
        except JourneyCard.DoesNotExist:
            return Response({"error": "카드를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        try:
            if not card.share_token:
                card.share_token = uuid.uuid4().hex
                card.save()
            share_url = f"/journey/share/{card.share_token}/"
        except Exception:
            return Response({
                "status": "fail",
                "message": "공유에 실패했습니다. 현재 화면을 유지합니다."
            }, status=status.HTTP_200_OK)

        return Response({
            "status": "success",
            "share_url": share_url
        }, status=status.HTTP_200_OK)


# 제품 상세 정보
class Chapter5ProductDetailView(APIView):
    def get(self, request, product_id):
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({"error": error_response('E-04')}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "status": "success",
            "data": {
                "id": product.id,
                "name": product.name,
                "description": product.description,
            }
        }, status=status.HTTP_200_OK)


# Journey 완료 처리
class Chapter5CompleteJourneyView(APIView):
    def post(self, request, selection_id):
        try:
            selection = UserStyleSelection.objects.get(id=selection_id)
        except UserStyleSelection.DoesNotExist:
            return Response({"error": "선택 데이터를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        if selection.is_completed:
            return Response({
                "status": "success",
                "message": "이미 완료 처리된 Journey입니다.",
                "redirect_to": "F-01"
            }, status=status.HTTP_200_OK)

        try:
            selection.is_completed = True
            selection.completed_at = timezone.now()
            selection.save()
        except Exception as e:
            logger.error(f"Journey 완료 저장 실패 (selection_id={selection_id}): {e}")
            return Response({"error": error_response('E-11')}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            "status": "success",
            "message": "Journey가 완료되었습니다.",
            "redirect_to": "F-01"
        }, status=status.HTTP_200_OK)


# 고민 이유 선택
class Chapter5HesitationReasonView(APIView):
    def post(self, request):
        selection_id = request.data.get('selection_id')
        reason = request.data.get('reason')

        valid_reasons = ['SIZE', 'WEIGHT', 'STORAGE', 'COMFORT', 'PRICE', 'DESIGN']
        if not selection_id or reason not in valid_reasons:
            return Response({"error": "selection_id와 유효한 reason이 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            selection = UserStyleSelection.objects.get(id=selection_id)
        except UserStyleSelection.DoesNotExist:
            return Response({"error": error_response('E-11')}, status=status.HTTP_404_NOT_FOUND)

        try:
            hesitation, _ = HesitationReason.objects.update_or_create(
                style_selection=selection,
                defaults={'reason': reason}
            )
        except Exception as e:
            logger.error(f"고민 이유 저장 실패 (selection_id={selection_id}): {e}")
            return Response({"error": error_response('E-11')}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            "status": "success",
            "data": HesitationReasonSerializer(hesitation).data
        }, status=status.HTTP_200_OK)


# AI 카드 재생성 요청
class Chapter5SubmitToAIView(APIView):
    def post(self, request):
        selection_id = request.data.get('selection_id')

        try:
            selection = UserStyleSelection.objects.select_related(
                'product', 'carry_option', 'detail_option'
            ).get(id=selection_id)
        except UserStyleSelection.DoesNotExist:
            return Response({"error": error_response('E-11')}, status=status.HTTP_404_NOT_FOUND)

        hesitation = HesitationReason.objects.filter(style_selection=selection).first()
        if not hesitation:
            return Response({"error": "고민 이유가 선택되지 않았습니다."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            card_text = generate_journey_card_text(
                selection.product,
                selection.carry_option,
                selection.detail_option,
                selection.ai_narration
            )
            if not card_text:
                raise ValueError("카드 텍스트 생성 실패")

            photo = CapturedPhoto.objects.filter(style_selection=selection, is_used=True).first()

            # 1. JourneyCard 생성
            new_card = JourneyCard.objects.create(
                style_selection=selection,
                captured_photo=photo,
                title="RECONSIDERED JOURNEY",
                card_text=card_text,
                order=JourneyCard.objects.filter(style_selection=selection).count(),
                status='processing'
            )

            # 2. AI 이미지 생성 로직 실행
            new_card = generate_ai_card_image(new_card)

            hesitation.ai_reconsidered_card = new_card
            hesitation.save()

        except Exception as e:
            logger.error(f"AI 재생성 실패 (selection_id={selection_id}): {e}")
            return Response({
                "error": error_response('E-11'),
                "redirect_to": None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            "status": "success",
            "data": JourneyCardSerializer(new_card, context={'request': request}).data,
            "redirect_to": "C5-19"
        }, status=status.HTTP_201_CREATED)


# 추천 및 분석 결과 조회
class Chapter5AnalysisResultView(APIView):
    def get(self, request, hesitation_id):
        try:
            hesitation = HesitationReason.objects.select_related('style_selection').get(id=hesitation_id)
        except HesitationReason.DoesNotExist:
            return Response({"error": "고민 이유 데이터를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        recommendation = ProductRecommendation.objects.filter(hesitation=hesitation).first()

        if not recommendation:
            selection = hesitation.style_selection
            all_products = Product.objects.exclude(id=selection.product_id)

            result = generate_ai_analysis_and_recommendation(selection, hesitation.reason, all_products)

            if not result:
                recommendation = ProductRecommendation.objects.create(
                    hesitation=hesitation,
                    recommended_product=None,
                    analysis_text="고객님의 선택을 바탕으로 새로운 여정을 계속 찾아드릴게요.",
                    reason_tags=""
                )
            else:
                product = Product.objects.filter(id=result.get("recommended_product_id")).first()
                recommendation = ProductRecommendation.objects.create(
                    hesitation=hesitation,
                    recommended_product=product,
                    analysis_text=result.get("analysis_text", ""),
                    reason_tags=result.get("reason_tags", "")
                )

        product_image_url = None
        if recommendation.recommended_product and hasattr(recommendation.recommended_product, 'image_url'):
            product_image_url = recommendation.recommended_product.image_url

        data = {
            "analysis_text": recommendation.analysis_text,
            "recommended_product": {
                "id": recommendation.recommended_product.id if recommendation.recommended_product else None,
                "name": recommendation.recommended_product.name if recommendation.recommended_product else "추천 제품 준비 중",
                "image_url": product_image_url,
            },
            "reason_tags": recommendation.get_reason_tags_list(),
            "recommendation_id": recommendation.id,
        }

        return Response({"status": "success", "data": data}, status=status.HTTP_200_OK)


# 추천 결과에서 상담원 연결
class Chapter5RecommendationAdvisorConnectView(APIView):
    def post(self, request):
        recommendation_id = request.data.get('recommendation_id')
        try:
            ProductRecommendation.objects.get(id=recommendation_id)
        except ProductRecommendation.DoesNotExist:
            return Response({"error": "추천 데이터를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        connect_url = "/support/advisor-chat/"
        return Response({
            "status": "success",
            "redirect_to": connect_url
        }, status=status.HTTP_200_OK)


# 추천 결과 공유
class Chapter5RecommendationShareView(APIView):
    def post(self, request, recommendation_id):
        try:
            recommendation = ProductRecommendation.objects.get(id=recommendation_id)
        except ProductRecommendation.DoesNotExist:
            return Response({"error": "추천 데이터를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        try:
            if not recommendation.share_token:
                recommendation.share_token = uuid.uuid4().hex
                recommendation.save()
            share_url = f"/journey/recommendation/share/{recommendation.share_token}/"
        except Exception:
            return Response({
                "status": "fail",
                "message": "공유에 실패했습니다. 현재 화면을 유지합니다."
            }, status=status.HTTP_200_OK)

        return Response({
            "status": "success",
            "share_url": share_url
        }, status=status.HTTP_200_OK)


# =====================================================
# HTML Template Views
# =====================================================

def chapter3_flow_view(request, selection_id=None):
    carry_options = Option.objects.filter(group='carry')
    detail_options = Option.objects.filter(group='detail')
    selection = None

    if selection_id:
        selection = get_object_or_404(UserStyleSelection, id=selection_id)

    if request.method == 'POST':
        if 'complete' in request.POST:
            sel_id = request.POST.get('selection_id')
            if not sel_id:
                return render(request, 'mcm_from_me/flow.html', {
                    'carry_options': carry_options,
                    'detail_options': detail_options,
                    'error_message': "완료할 선택 항목이 없습니다."
                })
            selection = get_object_or_404(UserStyleSelection, id=sel_id)
            selection.is_completed = True
            selection.save()
            return redirect('chapter3-flow-detail', selection_id=selection.id)
        else:
            carry_id = request.POST.get('carry_option')
            detail_id = request.POST.get('detail_option')

            if not carry_id or not detail_id:
                return render(request, 'mcm_from_me/flow.html', {
                    'carry_options': carry_options,
                    'detail_options': detail_options,
                    'error_message': "Carry와 Detail 옵션을 모두 선택해주세요!",
                })

            product = Product.objects.first()
            carry = Option.objects.filter(id=carry_id).first()
            detail = Option.objects.filter(id=detail_id).first()

            selection = UserStyleSelection.objects.create(
                product=product, carry_option=carry, detail_option=detail
            )
            try:
                narration = generate_ai_narration(
                    selection.product, selection.carry_option, selection.detail_option
                )
                if narration:
                    selection.ai_narration = narration
                    selection.save()
            except Exception as e:
                logger.error(f"나레이션 생성 오류: {e}")

            return redirect('chapter3-flow-detail', selection_id=selection.id)

    return render(request, 'ai_story/flow.html', {
        'carry_options': carry_options,
        'detail_options': detail_options,
        'selection': selection,
    })


def chapter5_discover_view(request, selection_id):
    selection = get_object_or_404(UserStyleSelection, id=selection_id)
    templates = JourneyCardTemplate.objects.filter(is_active=True)

    if request.method == 'POST':
        template_id = request.POST.get('template_id')
        template = get_object_or_404(JourneyCardTemplate, id=template_id)
        photo = CapturedPhoto.objects.filter(style_selection=selection, is_used=True).first()

        if 'choose' in request.POST:
            JourneyCard.objects.filter(style_selection=selection).update(is_selected=False)

            card = JourneyCard.objects.create(
                style_selection=selection,
                captured_photo=photo,
                template=template,
                title=template.theme_name,
                card_text=template.card_text,
                is_selected=True,
                status='processing'
            )
            # AI 이미지 생성 로직 실행
            generate_ai_card_image(card)

            return redirect('chapter5-result-view', selection_id=selection_id)

        elif 'deciding' in request.POST:
            return redirect('chapter5-hesitation-view', selection_id=selection_id)

    return render(request, 'chapter5_discover.html', {
        'templates': templates,
        'selection': selection,
    })


def chapter5_result_view(request, selection_id):
    selection = get_object_or_404(UserStyleSelection, id=selection_id)
    card = JourneyCard.objects.filter(style_selection=selection, is_selected=True).first()

    if request.method == 'POST' and 'complete' in request.POST:
        selection.is_completed = True
        selection.save()
        return redirect('chapter5-result-view', selection_id=selection_id)

    return render(request, 'chapter5_result_choose.html', {
        'selection': selection,
        'card': card,
    })


def chapter5_hesitation_view(request, selection_id):
    selection = get_object_or_404(UserStyleSelection, id=selection_id)
    reasons = ['SIZE', 'WEIGHT', 'STORAGE', 'COMFORT', 'PRICE', 'DESIGN']

    if request.method == 'POST':
        reason = request.POST.get('reason')
        hesitation, _ = HesitationReason.objects.update_or_create(
            style_selection=selection, defaults={'reason': reason}
        )
        return redirect('chapter5-analysis-view', hesitation_id=hesitation.id)

    hesitation = HesitationReason.objects.filter(style_selection=selection).first()

    return render(request, 'chapter5_still_deciding.html', {
        'selection': selection,
        'reasons': reasons,
        'hesitation': hesitation,
    })


def chapter5_analysis_view(request, hesitation_id):
    hesitation = get_object_or_404(HesitationReason, id=hesitation_id)
    selection = hesitation.style_selection

    recommendation = ProductRecommendation.objects.filter(hesitation=hesitation).first()

    if not recommendation:
        all_products = Product.objects.exclude(id=selection.product_id)
        result = generate_ai_analysis_and_recommendation(selection, hesitation.reason, all_products)

        if not result:
            recommendation = ProductRecommendation.objects.create(
                hesitation=hesitation,
                recommended_product=None,
                analysis_text="고객님의 선택을 바탕으로 새로운 여정을 계속 찾아드릴게요.",
                reason_tags=""
            )
        else:
            product = Product.objects.filter(id=result.get("recommended_product_id")).first()
            recommendation = ProductRecommendation.objects.create(
                hesitation=hesitation,
                recommended_product=product,
                analysis_text=result.get("analysis_text", ""),
                reason_tags=result.get("reason_tags", "")
            )

    if request.method == 'POST' and 'complete' in request.POST:
        selection.is_completed = True
        selection.save()
        return redirect('chapter5-analysis-view', hesitation_id=hesitation_id)

    return render(request, 'chapter5_still_result.html', {
        'selection': selection,
        'recommendation': recommendation,
    })