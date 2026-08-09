from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Product, Option, StyleCombination, UserStyleSelection
from .serializers import StyleCombinationSerializer, UserStyleSelectionSerializer
from .utils import generate_ai_narration

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