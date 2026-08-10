#에러코드 미리 정리해둠

ERROR_CODES = {
    'E-06': {'code': 'E-06', 'message': '카메라 권한이 허용되지 않았습니다.'},
    'E-07': {'code': 'E-07', 'message': '카메라 실행에 실패했습니다.'},
    'E-08': {'code': 'E-08', 'message': '제품 또는 사용자가 프레임을 벗어났습니다.'},
    'E-09': {'code': 'E-09', 'message': '촬영 환경이 너무 어둡습니다.'},
    'E-10': {'code': 'E-10', 'message': '이미지가 흐릿합니다. 다시 촬영해주세요.'},
    'E-11': {'code': 'E-11', 'message': '사진 저장에 실패했습니다.'},
}

def error_response(code):
    return ERROR_CODES.get(code, {'code': code, 'message': '알 수 없는 오류가 발생했습니다.'})