from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Product, Option, StyleCombination, UserStyleSelection, JourneyCard
from .serializers import StyleCombinationSerializer, UserStyleSelectionSerializer, JourneyCardSerializer
from .utils import generate_ai_narration, generate_journey_card_text
from .errors import error_response

#초기 기본 세팅
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

#옵션 변경시
class Chapter3SelectOptionView(APIView):

    def post(self, request):
        carry_code = request.data.get('carry')
        detail_code = request.data.get('detail')

        if not carry_code or not detail_code:
            return Response({"error": "Carry와 Detail 옵션 값이 모두 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

        combination = StyleCombination.objects.filter(
            carry_option__code_name=carry_code,
            detail_option__code_name=detail_code
        ).first()

        if not combination:
            return Response({"error": "해당하는 옵션 조합을 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        serializer = StyleCombinationSerializer(combination)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

#작성 완료하고 내용 저장
class Chapter3CompleteView(APIView):

    def post(self, request):
        product_id = request.data.get('product_id')
        carry_id = request.data.get('carry_id')
        detail_id = request.data.get('detail_id')

        #필수 옵션 확인
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
                print(f"나레이션 생성 오류: {e}")

            return Response({
                "status": "success",
                "message": "스타일 선택이 성공적으로 저장되었습니다.",
                "data": UserStyleSelectionSerializer(instance).data,
                "selection_id": instance.id
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

#summaty 내용
class Chapter3SummaryView(APIView):

    def get(self, request, selection_id):
        try:
            selection = UserStyleSelection.objects.select_related(
                'product', 'carry_option', 'detail_option'
            ).get(id=selection_id)
        except UserStyleSelection.DoesNotExist:
            return Response(
                {"error": "선택 데이터를 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND
            )

        #누락값 발생 예외 처리
        if not selection.carry_option or not selection.detail_option:
            selection.refresh_from_db()
            if not selection.carry_option or not selection.detail_option:
                return Response(
                    {"error": "옵션 데이터가 누락되었습니다."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        #나래이션 생성 실패 예외
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

#카드 생성 요청시
class Chapter5GenerateCardsView(APIView):

    def post(self, request):
        selection_id = request.data.get('selection_id')
        card_count = int(request.data.get('card_count', 1))

        if not selection_id:
            return Response(
                {"error": "selection_id가 필요합니다."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            selection = UserStyleSelection.objects.select_related(
                'product', 'carry_option', 'detail_option'
            ).get(id=selection_id)
        except UserStyleSelection.DoesNotExist:
            return Response(
                {"error": "선택 데이터를 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND
            )

        captured_photo = selection.captured_photos.filter(is_used=True).first()

        created_cards = []
        try:
            for i in range(card_count):
                card_text = generate_journey_card_text(
                    selection.product,
                    selection.carry_option,
                    selection.detail_option,
                    selection.ai_narration
                )

                card = JourneyCard.objects.create(
                    style_selection=selection,
                    captured_photo=captured_photo,
                    card_text=card_text,
                    order=i,
                    status='completed' if card_text else 'failed'
                )
                created_cards.append(card)
        except Exception:
            return Response(
                {"error": error_response('E-11')},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        valid_cards = [c for c in created_cards if c.status == 'completed']
        if not valid_cards:
            return Response(
                {"error": error_response('E-11')},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        serializer = JourneyCardSerializer(valid_cards, many=True, context={'request': request})

        redirect_to = "C5-05" if len(valid_cards) == 1 else "C5-06"

        return Response({
            "status": "success",
            "card_count": len(valid_cards),
            "data": serializer.data,
            "redirect_to": redirect_to
        }, status=status.HTTP_201_CREATED)

#생성된 카드 조회
class Chapter5CardListView(APIView):

    def get(self, request, selection_id):
        cards = JourneyCard.objects.filter(
            style_selection_id=selection_id,
            status='completed'
        ).order_by('order')

        if not cards.exists():
            return Response(
                {"error": error_response('E-11')},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = JourneyCardSerializer(cards, many=True, context={'request': request})
        return Response({
            "status": "success",
            "card_count": cards.count(),
            "data": serializer.data
        }, status=status.HTTP_200_OK)

#카드 선택
class Chapter5CardSelectView(APIView):

    def post(self, request, card_id):
        action = request.data.get('action')

        if action not in ['choose', 'deciding']:
            return Response(
                {"error": "action 값은 'choose' 또는 'deciding'이어야 합니다."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            card = JourneyCard.objects.get(id=card_id)
        except JourneyCard.DoesNotExist:
            return Response(
                {"error": "카드를 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND
            )

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
        except Exception:
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