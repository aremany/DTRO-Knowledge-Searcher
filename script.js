// script.js
let dataset = [];
let filteredData = [];
let keywords = JSON.parse(localStorage.getItem('searchKeywords') || '[]');
let currentWords = [];

// 하이라이트 함수
function highlightText(text, words) {
    if (!words || words.length === 0) return text;
    let highlighted = text;
    words.forEach(word => {
        const regex = new RegExp(`(${word})`, 'gi');
        highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    return highlighted;
}

// 데이터 로드
async function loadData() {
    try {
        // localStorage에 임시 데이터가 있는지 확인
        const localData = localStorage.getItem('dataset');
        if (localData) {
            console.log('localStorage에서 데이터 복원 중...');
            dataset = JSON.parse(localData);
            filteredData = [];
            renderResults();
        }

        // 서버에서 최신 데이터 로드
        const response = await fetch('/api/data');
        const rawData = await response.json();

        if (Array.isArray(rawData)) {
            dataset = rawData.map(item => ({
                instruction: (item.instruction || '').toString(),
                output: (item.output || '').toString()
            })).filter(i => i.instruction.trim() && i.output.trim());
        } else {
            dataset = [];
        }

        filteredData = [];
        renderResults();
        console.log(`데이터 로드 완료: ${dataset.length}개 항목`);
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        alert('데이터 로드 실패: ' + error.message);
    }
}

// 검색 로직
function search() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const mode = document.getElementById('searchMode').value;
    if (!query.trim()) {
        filteredData = [...dataset];
        currentWords = [];
    } else {
        const words = query.split(/\s+/).filter(word => word.length > 0);
        currentWords = words;
        filteredData = dataset.filter(item => {
            const target = mode.startsWith('question') ? item.instruction.toLowerCase() : item.output.toLowerCase();
            if (mode.includes('and')) {
                return words.every(word => target.includes(word));
            } else {
                return words.some(word => target.includes(word));
            }
        });
    }
    // 정렬: 알파벳순 + 한글 자음-모음순
    filteredData.sort((a, b) => {
        const aText = a.instruction;
        const bText = b.instruction;
        return aText.localeCompare(bText, 'ko');
    });
    renderResults();
    // 캐싱
    if (query && !keywords.includes(query)) {
        keywords.unshift(query);
        if (keywords.length > 10) keywords.pop();
        localStorage.setItem('searchKeywords', JSON.stringify(keywords));
    }
}

// 결과 렌더링
function renderResults() {
    document.getElementById('resultsTitle').textContent = `검색 결과 (${filteredData.length}개)`;
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    filteredData.forEach(item => {
        const highlightedInstruction = highlightText(item.instruction.substring(0, 100), currentWords);
        const highlightedOutput = highlightText(item.output.substring(0, 100), currentWords);
        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerHTML = `
            <h3>${highlightedInstruction}...</h3>
            <p>${highlightedOutput}...</p>
            <button class="detail-btn" onclick="showPopup('${item.instruction.replace(/'/g, "\\'")}')">상세</button>
            <button class="edit-btn" onclick="editItem('${item.instruction.replace(/'/g, "\\'")}')">수정</button>
        `;
        resultsDiv.appendChild(div);
    });
}

// 팝업 표시 (상세 모드)
function showPopup(instruction) {
    const item = dataset.find(i => i.instruction === instruction);
    if (item) {
        document.getElementById('detailView').style.display = 'block';
        document.getElementById('editView').style.display = 'none';
        document.getElementById('popupTitle').innerHTML = highlightText(item.instruction, currentWords);
        document.getElementById('popupContent').innerHTML = highlightText(item.output.replace(/\n/g, '<br>'), currentWords);
        document.getElementById('popup').style.display = 'block';
    }
}

// 편집 모드 팝업
function editItem(instruction) {
    const item = dataset.find(i => i.instruction === instruction);
    if (item) {
        document.getElementById('detailView').style.display = 'none';
        document.getElementById('editView').style.display = 'block';
        document.getElementById('itemId').value = item.instruction;
        document.getElementById('question').value = item.instruction;
        document.getElementById('answer').value = item.output;
        document.getElementById('popup').style.display = 'block';
    }
}

// 추가 모드 팝업
function addItem() {
    document.getElementById('detailView').style.display = 'none';
    document.getElementById('editView').style.display = 'block';
    document.getElementById('itemId').value = '';
    document.getElementById('question').value = '';
    document.getElementById('answer').value = '';
    document.getElementById('popup').style.display = 'block';
}

// 데이터 저장
async function saveData() {
    try {
        // 로컬 스토리지에 임시 저장 (백업용)
        localStorage.setItem('dataset', JSON.stringify(dataset));

        // 서버에 실제 파일로 저장
        const response = await fetch('/api/data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataset)
        });

        const result = await response.json();

        if (result.success) {
            console.log('데이터 저장 성공:', result.message);
            showSaveNotification('저장되었습니다!');
        } else {
            throw new Error(result.error || '저장 실패');
        }
    } catch (error) {
        console.error('데이터 저장 실패:', error);
        alert('저장 실패: ' + error.message);
    }
}

// 저장 알림 표시
function showSaveNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #28a745; color: white; padding: 10px 20px; border-radius: 5px; z-index: 10000;';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

// AI 인사이트 요청
async function askAI() {
    if (filteredData.length === 0) {
        alert('검색 결과가 없습니다. 먼저 검색을 수행해주세요.');
        return;
    }

    const container = document.getElementById('aiResultContainer');
    const contentDiv = document.getElementById('aiResultContent');

    container.style.display = 'block';
    contentDiv.innerHTML = `
        <div class="ai-loading">
            <div class="ai-loading-icon">⏳</div>
            <div class="ai-loading-text">
                AI가 상위 50개 결과를<br>
                <span class="blink">분석 중입니다...</span>
            </div>
            <div class="ai-loading-bar"></div>
        </div>`;

    // 상위 50개 항목 추출
    const contextItems = filteredData.slice(0, 50);
    const query = document.getElementById('searchInput').value;

    try {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                context: contextItems
            })
        });

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error);
        }

        // 마크다운 스타일의 텍스트를 HTML로 변환 (간단한 처리)
        let formattedAnswer = result.answer
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        contentDiv.innerHTML = formattedAnswer;

    } catch (error) {
        console.error('AI 요청 실패:', error);
        contentDiv.innerHTML = `<div style="color: red; text-align: center;">분석 실패: ${error.message}</div>`;
    }
}

// AI 인사이트 인쇄
function printInsight() {
    const content = document.getElementById('aiResultContent').innerHTML;
    const printWindow = window.open('', '', 'height=600,width=800');

    printWindow.document.write('<html><head><title>AI 인사이트 분석 결과</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }');
    printWindow.document.write('h3 { color: #0056b3; border-bottom: 1px solid #ddd; padding-bottom: 10px; }');
    printWindow.document.write('.footer { margin-top: 30px; font-size: 12px; color: #666; text-align: right; border-top: 1px solid #ddd; padding-top: 10px; }');
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');

    printWindow.document.write('<h3>🤖 AI 분석 결과</h3>');
    printWindow.document.write(content);
    printWindow.document.write('<div class="footer">위 내용은 검색된 상위 50개 항목을 바탕으로 AI가 생성했습니다.</div>');

    printWindow.document.write('</body></html>');

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    loadData();

    // 이벤트 리스너 등록
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.oninput = search;
        searchInput.onkeydown = (event) => {
            if (event.key === 'Enter') {
                searchInput.value = '';
                filteredData = [];
                renderResults();
            }
        };
    }

    const addBtn = document.getElementById('addBtn');
    if (addBtn) addBtn.onclick = addItem;

    const aiInsightBtn = document.getElementById('aiInsightBtn');
    if (aiInsightBtn) aiInsightBtn.onclick = askAI;

    const printInsightBtn = document.getElementById('printInsightBtn');
    if (printInsightBtn) printInsightBtn.onclick = printInsight;

    // 팝업 닫기 버튼들
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.onclick = () => {
            document.getElementById('popup').style.display = 'none';
            document.getElementById('editForm').reset();
        };
    }

    const closeDetailBtn = document.getElementById('closeDetailBtn');
    if (closeDetailBtn) {
        closeDetailBtn.onclick = () => {
            document.getElementById('popup').style.display = 'none';
        };
    }

    const closeEditBtn = document.getElementById('closeBtn');
    if (closeEditBtn) {
        closeEditBtn.onclick = () => {
            document.getElementById('popup').style.display = 'none';
            document.getElementById('editForm').reset();
        };
    }

    // 인쇄 버튼
    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
        printBtn.onclick = () => {
            window.print();
        };
    }

    // 복사 버튼
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.onclick = async () => {
            const text = document.getElementById('popupContent').textContent;
            try {
                await navigator.clipboard.writeText(text);
                alert('복사되었습니다!');
            } catch (err) {
                alert('복사 실패: ' + err);
            }
        };
    }

    // 편집 폼 제출
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.onsubmit = (e) => {
            e.preventDefault();
            const id = document.getElementById('itemId').value;
            const question = document.getElementById('question').value;
            const answer = document.getElementById('answer').value;
            if (id) {
                // 편집
                const item = dataset.find(i => i.instruction === id);
                if (item) {
                    item.instruction = question;
                    item.output = answer;
                }
            } else {
                // 추가
                dataset.push({ instruction: question, output: answer });
            }
            saveData();
            renderResults();
            document.getElementById('popup').style.display = 'none';
            editForm.reset();
        };
    }

    // 삭제 버튼
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            const id = document.getElementById('itemId').value;
            if (id) {
                dataset = dataset.filter(i => i.instruction !== id);
                saveData();
                renderResults();
                document.getElementById('popup').style.display = 'none';
                document.getElementById('editForm').reset();
            }
        };
    }
});