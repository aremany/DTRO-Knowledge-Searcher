# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__, static_folder='.')
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'dataset_from_data_txt.json')
BACKUP_DIR = os.path.join(BASE_DIR, 'backups')

# 백업 디렉토리 생성
if not os.path.exists(BACKUP_DIR):
    os.makedirs(BACKUP_DIR)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

@app.route('/api/data', methods=['GET'])
def get_data():
    """데이터 가져오기"""
    try:
        if not os.path.exists(DATA_FILE):
            print(f"경고: 데이터 파일 없음 - {DATA_FILE}")
            return jsonify([])
        
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"데이터 로드 성공: {len(data)}개 항목")
        return jsonify(data)
    except json.JSONDecodeError as e:
        error_msg = f"JSON 파싱 오류: {e}"
        print(error_msg)
        return jsonify({'error': error_msg, 'suggestion': 'fix_json.py를 실행하세요'}), 500
    except Exception as e:
        error_msg = f"데이터 로드 오류: {str(e)}"
        print(error_msg)
        return jsonify({'error': error_msg}), 500

@app.route('/api/data', methods=['POST'])
def save_data():
    """데이터 저장"""
    try:
        new_data = request.json
        
        if not isinstance(new_data, list):
            return jsonify({'error': '데이터는 배열 형식이어야 합니다'}), 400
        
        # 백업 생성
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = os.path.join(BACKUP_DIR, f'backup_{timestamp}.json')
        
        # 기존 파일 백업
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                old_data = json.load(f)
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(old_data, f, ensure_ascii=False, indent=2)
            print(f"백업 생성: {backup_file}")
        
        # 새 데이터 저장
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, ensure_ascii=False, indent=2)
        
        print(f"데이터 저장 성공: {len(new_data)}개 항목")
        
        # 오래된 백업 정리 (최근 10개만 유지)
        cleanup_old_backups()
        
        return jsonify({'success': True, 'message': f'{len(new_data)}개 항목이 저장되었습니다.'})
    except Exception as e:
        error_msg = f"저장 실패: {str(e)}"
        print(error_msg)
        return jsonify({'error': error_msg}), 500

def cleanup_old_backups():
    """오래된 백업 파일 정리"""
    try:
        backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.startswith('backup_')])
        if len(backups) > 10:
            for old_backup in backups[:-10]:
                os.remove(os.path.join(BACKUP_DIR, old_backup))
    except Exception as e:
        print(f"백업 정리 실패: {e}")

# Ollama 설정
OLLAMA_BASE_URL = "http://localhost:11434"
ANALYSIS_LLM_MODEL = "hf.co/unsloth/gemma-3n-E2B-it-GGUF:Q4_K_M"

import requests

@app.route('/api/ask', methods=['POST'])
def ask_ai():
    """LLM에 질문하기 (Ollama)"""
    try:
        data = request.json
        query = data.get('query', '')
        context_items = data.get('context', [])
        
        if not query:
            return jsonify({'error': '질문 내용이 없습니다.'}), 400
            
        if not context_items:
            return jsonify({'error': '검색 결과가 없습니다.'}), 400
            
        # 프롬프트 구성
        context = '. '.join([f"{item['instruction']}: {item['output']}" for item in context_items[:50]])
        prompt = f"{query}에 대한 정보를 다음 자료를 바탕으로 객관적이고 포괄적으로 정리해주세요:\n\n{context}\n\n주요 개념, 특징, 원리 등을 중심으로 설명해주세요."
            
        # Ollama API 호출
        try:
            response = requests.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": ANALYSIS_LLM_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.7}
                },
                timeout=300
            )
            
            if response.status_code == 200:
                answer = response.json().get("response", "")
            else:
                error_msg = f"Ollama 오류: {response.status_code} - {response.text}"
                print(error_msg)
                return jsonify({'error': error_msg}), 500
                
        except requests.exceptions.ConnectionError:
            return jsonify({'error': 'Ollama 서버에 연결할 수 없습니다. (http://localhost:11434 확인 필요)'}), 503
        except Exception as e:
            return jsonify({'error': f"LLM 호출 실패: {str(e)}"}), 500
        
        return jsonify({'answer': answer})
        
    except Exception as e:
        error_msg = f"AI 요청 실패: {str(e)}"
        print(error_msg)
        return jsonify({'error': error_msg}), 500

if __name__ == '__main__':
    print("지식검색기 서버 시작...")
    print(f"데이터 파일: {DATA_FILE}")
    app.run(host='0.0.0.0', port=8009, debug=False)
