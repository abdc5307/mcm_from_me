from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from .models import JourneySession, Product
from .decorators import validate_chapter_access

# [H-01 / H-02] 세션 초기화 및 Resume 확인 (E-12)
@api_view(['GET'])
def init_or_check_session(request):
    session_id = request.GET.get('session_id')

    if session_id:
        try:
            session = JourneySession.objects.get(id=session_id)
            if not session.is_completed:
                return Response({
                    'status': 'RESUME_AVAILABLE',
                    'errorCode': 'E-12',
                    'message': 'Would you like to continue your journey?',
                    'lastActiveScreen': session.last_active_screen,
                    'session': {
                        'id': str(session.id),
                        'current_chapter': session.current_chapter,
                        'selected_moment': session.selected_moment,
                        'product_id': session.product.id if session.product else None,
                        'product_name': session.product.name if session.product else None
                    }
                }, status=status.HTTP_200_OK)
        except JourneySession.DoesNotExist:
            pass

    # 신규 세션 생성 (C1-01)
    new_session = JourneySession.objects.create(
        current_chapter="C1",
        last_active_screen="C1-01"
    )

    return Response({
        'status': 'NEW_SESSION',
        'sessionId': str(new_session.id),
        'nextScreen': 'C1-01'
    }, status=status.HTTP_201_CREATED)


# [H-08] Resume Journey - 이탈 복원
@api_view(['POST'])
def resume_journey(request):
    session_id = request.data.get('session_id')
    try:
        session = JourneySession.objects.get(id=session_id)
        return Response({
            'status': 'SUCCESS',
            'lastActiveScreen': session.last_active_screen,
            'currentChapter': session.current_chapter
        }, status=status.HTTP_200_OK)
    except JourneySession.DoesNotExist:
        return Response({'errorCode': 'E-01', 'message': 'Save session not found'}, status=status.HTTP_404_NOT_FOUND)


# [E-13] 새로 시작 (Start New Journey)
@api_view(['POST'])
def start_new_journey(request):
    session_id = request.data.get('session_id')
    if session_id:
        JourneySession.objects.filter(id=session_id).update(is_completed=True)

    new_session = JourneySession.objects.create(current_chapter="C1", last_active_screen="C1-01")
    return Response({
        'status': 'SUCCESS',
        'sessionId': str(new_session.id),
        'nextScreen': 'C1-01'
    }, status=status.HTTP_200_OK)


# [C1-06 / C1-07] Moment 선택 저장
@api_view(['POST'])
def save_moment(request):
    session_id = request.data.get('session_id')
    moment = request.data.get('moment')  # URBAN_ESCAPE, NEW_JOURNEY, CREATIVE_FLOW, MIDNIGHT_MOVE

    if not moment:
        return Response({'message': 'Moment selection required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        session = JourneySession.objects.get(id=session_id)
        session.selected_moment = moment
        session.current_chapter = "C2"
        session.last_active_screen = "C2-01"
        session.save()

        return Response({
            'status': 'SUCCESS',
            'nextScreen': 'C2-01'
        }, status=status.HTTP_200_OK)
    except JourneySession.DoesNotExist:
        return Response({'errorCode': 'E-01', 'message': 'Session save failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# [C2-02 / C2-05] NFC/QR 스캔 태그 검증 및 제품 저장
@api_view(['POST'])
def verify_product_tag(request):
    session_id = request.data.get('session_id')
    tag_code = request.data.get('tag_code')

    try:
        product = Product.objects.filter(Q(nfc_tag_id=tag_code) | Q(qr_code_id=tag_code)).first()

        # E-02: 태그 인식 실패
        if not product:
            return Response({'errorCode': 'E-02', 'message': 'Tag Recognition Failed'}, status=status.HTTP_404_NOT_FOUND)

        # E-03: 미지원 제품
        if not product.is_supported:
            return Response({'errorCode': 'E-03', 'message': 'Unsupported Product'}, status=status.HTTP_400_BAD_REQUEST)

        session = JourneySession.objects.get(id=session_id)
        session.product = product
        session.current_chapter = "C2"
        session.last_active_screen = "C2-07"
        session.save()

        return Response({
            'status': 'SUCCESS',
            'nextScreen': 'C2-07',
            'product': {
                'id': product.id,
                'name': product.name,
                'story_title': product.story_title,
                'story_desc': product.story_desc,
                'image_url': product.image_url
            }
        }, status=status.HTTP_200_OK)

    except Exception:
        return Response({'errorCode': 'E-04', 'message': 'Product Details Unavailable'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# [C3-11 / C3-17] Chapter 3 스타일 옵션 저장
@api_view(['POST'])
def save_style_options(request):
    session_id = request.data.get('session_id')
    carry_option = request.data.get('carry_option')    # TOP_HANDLE, CROSSBODY
    detail_option = request.data.get('detail_option')  # BASIC_CHARM, ROCKET_CHARM

    if not carry_option or not detail_option:
        return Response({'errorCode': 'E-05', 'message': 'Option Unavailable'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        session = JourneySession.objects.get(id=session_id)
        session.carry_option = carry_option
        session.detail_option = detail_option
        session.current_chapter = "C4"
        session.last_active_screen = "C4-01"
        session.save()

        return Response({
            'status': 'SUCCESS',
            'nextScreen': 'C4-01'
        }, status=status.HTTP_200_OK)
    except JourneySession.DoesNotExist:
        return Response({'errorCode': 'E-01', 'message': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)


# [C4-10] Chapter 4 촬영 사진 저장
@api_view(['POST'])
def save_photo_url(request):
    session_id = request.data.get('session_id')
    photo_url = request.data.get('photo_url')

    if not photo_url:
        return Response({'errorCode': 'E-11', 'message': 'Photo URL missing'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        session = JourneySession.objects.get(id=session_id)
        session.photo_url = photo_url
        session.current_chapter = "C5"
        session.last_active_screen = "C5-01"
        session.save()

        return Response({
            'status': 'SUCCESS',
            'nextScreen': 'C5-01'
        }, status=status.HTTP_200_OK)
    except JourneySession.DoesNotExist:
        return Response({'errorCode': 'E-11', 'message': 'Save failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# [C5-14 / F-01] 여정 최종 완료
@api_view(['POST'])
def complete_journey(request):
    session_id = request.data.get('session_id')

    try:
        session = JourneySession.objects.get(id=session_id)
        session.is_completed = True
        session.current_chapter = "F1"
        session.last_active_screen = "F-01"
        session.save()

        return Response({
            'status': 'SUCCESS',
            'nextScreen': 'F-01',
            'message': 'Your journey is complete.'
        }, status=status.HTTP_200_OK)
    except JourneySession.DoesNotExist:
        return Response({'errorCode': 'E-11', 'message': 'Completion failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# [H-07] Chapter 이동 유효성 검사 API
@api_view(['POST'])
@validate_chapter_access
def navigate_chapter(request):
    target_chapter = request.data.get('target_chapter')
    return Response({'status': 'SUCCESS', 'targetChapter': target_chapter}, status=status.HTTP_200_OK)