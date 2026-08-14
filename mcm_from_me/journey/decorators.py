from functools import wraps
from rest_framework.response import Response
from rest_framework import status
from .models import JourneySession

def validate_chapter_access(required_chapter):
    """
    기획서 E-14 대응: 
    사용자가 올바른 단계(Chapter)를 거치지 않고 직접 들어오는 것을 막는 데코레이터
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            session_id = request.data.get('session_id') or request.GET.get('session_id')
            
            if not session_id:
                return Response({
                    "error_code": "E-01",
                    "message": "session_id가 필요합니다."
                }, status=status.HTTP_400_BAD_REQUEST)

            try:
                session = JourneySession.objects.get(id=session_id)
            except JourneySession.DoesNotExist:
                return Response({
                    "error_code": "E-01",
                    "message": "유효하지 않은 세션입니다."
                }, status=status.HTTP_404_NOT_FOUND)

            # 현재 진행 중인 chapter보다 높은 단계를 직접 호출하려 할 때 차단
            if session.current_chapter < required_chapter:
                return Response({
                    "error_code": "E-14",
                    "message": "이전 단계를 먼저 완료해야 합니다.",
                    "last_active_screen": session.last_active_screen
                }, status=status.HTTP_403_FORBIDDEN)

            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator