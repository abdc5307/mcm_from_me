from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Product, Option, StyleCombination, UserStyleSelection
from .serializers import StyleCombinationSerializer, UserStyleSelectionSerializer

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
            serializer.save()
            return Response({
                "status": "success",
                "message": "스타일 선택이 성공적으로 저장되었습니다.",
                "data": serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)