from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import CapturedPhoto
from .serializers import CapturedPhotoSerializer
from .errors import error_response
from .utils import validate_photo_quality
from ai_story.models import UserStyleSelection

#촬영 준비 화면
class Chapter4ReadyView(APIView):

    def get(self, request, selection_id):
        try:
            selection = UserStyleSelection.objects.select_related(
                'product', 'carry_option', 'detail_option'
            ).get(id=selection_id)
        except UserStyleSelection.DoesNotExist:
            return Response({
                "error": error_response('C3-01'),
                "redirect_to": "C3-01"
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "status": "success",
            "data": {
                "selection_id": selection.id,
                "product_name": selection.product.name,
                "carry_option": selection.carry_option.code_name,
                "detail_option": selection.detail_option.code_name,
                "example_image_url": "/static/chapter4/example_capture.jpg",
            }
        }, status=status.HTTP_200_OK)

#사진 촬영+검사
class Chapter4CaptureUploadView(APIView):

    def post(self, request):
        selection_id = request.data.get('selection_id')
        shot_mode = request.data.get('shot_mode', 'FRONT_45')
        image_file = request.FILES.get('image')

        if not selection_id or not image_file:
            return Response(
                {"error": "selection_id와 image 파일이 필요합니다."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            selection = UserStyleSelection.objects.get(id=selection_id)
        except UserStyleSelection.DoesNotExist:
            return Response({
                "error": error_response('C3-01'),
                "redirect_to": "C3-01"
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            is_valid, error_code, scores = validate_photo_quality(image_file)
        except Exception:
            return Response(
                {"error": error_response('E-07')},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not is_valid:
            return Response({
                "status": "fail",
                "error": error_response(error_code),
                "scores": scores,
                "redirect_to": "C4-05"
            }, status=status.HTTP_400_BAD_REQUEST)

        image_file.seek(0)
        photo = CapturedPhoto.objects.create(
            style_selection=selection,
            image=image_file,
            shot_mode=shot_mode,
            brightness_score=scores['brightness'],
            blur_score=scores['blur'],
            is_in_frame=True,
        )

        serializer = CapturedPhotoSerializer(photo, context={'request': request})
        return Response({
            "status": "success",
            "message": "촬영이 완료되었습니다.",
            "data": serializer.data,
            "redirect_to": "C4-09"
        }, status=status.HTTP_201_CREATED)

#사진 확정, 재촬영
class Chapter4PhotoActionView(APIView):

    def post(self, request, photo_id):
        action = request.data.get('action')

        if action not in ['use', 'retake']:
            return Response(
                {"error": "action 값은 'use' 또는 'retake'여야 합니다."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            photo = CapturedPhoto.objects.get(id=photo_id)
        except CapturedPhoto.DoesNotExist:
            return Response(
                {"error": "사진 데이터를 찾을 수 없습니다."},
                status=status.HTTP_404_NOT_FOUND
            )

        if action == 'retake':
            photo.delete()
            return Response({
                "status": "success",
                "message": "재촬영을 진행합니다.",
                "redirect_to": "C4-05"
            }, status=status.HTTP_200_OK)

        try:
            CapturedPhoto.objects.filter(
                style_selection=photo.style_selection
            ).exclude(id=photo.id).update(is_used=False)

            photo.is_used = True
            photo.save()
        except Exception:
            return Response({
                "error": error_response('E-11')
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            "status": "success",
            "message": "사진이 선택되었습니다.",
            "data": CapturedPhotoSerializer(photo, context={'request': request}).data,
            "redirect_to": "C5-01"
        }, status=status.HTTP_200_OK)