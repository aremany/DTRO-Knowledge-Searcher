# -*- coding: utf-8 -*-
import json
import re

def fix_json_file(filename):
    """JSON 파일의 trailing comma 문제 수정"""
    print(f"JSON 파일 수정 중: {filename}")
    
    try:
        # 파일 읽기
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Trailing comma 패턴 수정
        # 1. 배열 끝의 쉼표 제거: ,]
        content = re.sub(r',\s*]', ']', content)
        
        # 2. 객체 끝의 쉼표 제거: ,}
        content = re.sub(r',\s*}', '}', content)
        
        # JSON 검증
        try:
            data = json.loads(content)
            print(f"✓ JSON 검증 성공: {len(data)}개 항목")
        except json.JSONDecodeError as e:
            print(f"✗ JSON 검증 실패: {e}")
            print("수동 수정이 필요할 수 있습니다.")
            return False
        
        # 백업 생성
        backup_file = filename.replace('.json', '_backup_original.json')
        with open(backup_file, 'w', encoding='utf-8') as f:
            # 원본 내용 그대로 백업
            with open(filename, 'r', encoding='utf-8') as orig:
                f.write(orig.read())
        print(f"✓ 원본 백업: {backup_file}")
        
        # 수정된 내용 저장 (pretty print)
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✓ JSON 파일 수정 완료!")
        return True
        
    except Exception as e:
        print(f"✗ 오류 발생: {e}")
        return False

if __name__ == '__main__':
    fix_json_file('dataset_from_data_txt.json')
