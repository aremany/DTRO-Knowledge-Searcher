@echo off
chcp 65001
echo 지식검색기 서버를 시작합니다...

:: Ollama 서버 시작 (새 창)
start "Ollama Server" cmd /k "ollama serve"

:: 잠시 대기 (Ollama 시작 시간 확보)
timeout /t 3

:: Flask 서버 시작
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://127.0.0.1:8009
python server.py
pause