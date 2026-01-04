// 공통 유틸리티 함수 모듈

// API_BASE는 전역 변수로 한 번만 선언
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
const API_BASE = window.API_BASE || '';

/**
 * 마크다운을 HTML로 변환하는 함수
 */
function renderMarkdown(markdownText) {
    if (!markdownText) return '';
    try {
        // 이스케이프된 따옴표를 일반 따옴표로 변환 (JSON에서 온 경우)
        let processedText = markdownText.replace(/\\"/g, '"');
        processedText = processedText.replace(/\\'/g, "'");
        
        // 기울임 패턴을 먼저 처리 (marked.js보다 먼저 처리하여 확실하게 변환)
        // **텍스트** 패턴은 나중에 처리하기 위해 임시로 보호
        processedText = processedText.replace(/\*\*/g, '___DOUBLE_STAR___');
        
        // *"텍스트"* 패턴 처리 (큰따옴표 포함)
        processedText = processedText.replace(/\*"([^"]+)"\*/g, '<em>$1</em>');
        // *'텍스트'* 패턴 처리 (작은따옴표 포함, 중간에 작은따옴표가 있어도 처리)
        processedText = processedText.replace(/\*'(.+?)'\*/g, '<em>$1</em>');
        // 일반 *텍스트* 패턴 처리 (공백이나 문장 부호로 구분된 경우)
        processedText = processedText.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
        
        // **텍스트** 패턴 복원 및 굵게 처리
        processedText = processedText.replace(/___DOUBLE_STAR___(.+?)___DOUBLE_STAR___/g, '<strong>$1</strong>');
        
        // marked.js를 사용하여 마크다운을 HTML로 변환
        if (typeof marked !== 'undefined') {
            // marked.js 옵션 설정 (breaks: true로 줄바꿈 처리)
            const markedOptions = {
                breaks: true,
                gfm: true
            };
            let html = marked.parse(processedText, markedOptions);
            return html;
        } else {
            // marked.js가 로드되지 않은 경우 기본 변환
            return processedText.replace(/\n/g, '<br>');
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('마크다운 변환 오류', error);
        }
        console.error('마크다운 변환 오류:', error);
        // 오류 발생 시 기본 변환 시도
        let fallbackText = markdownText.replace(/\\"/g, '"');
        fallbackText = fallbackText.replace(/\\'/g, "'");
        // **텍스트** 패턴 보호
        fallbackText = fallbackText.replace(/\*\*/g, '___DOUBLE_STAR___');
        // 기울임 패턴 처리
        fallbackText = fallbackText.replace(/\*"([^"]+)"\*/g, '<em>$1</em>');
        fallbackText = fallbackText.replace(/\*'(.+?)'\*/g, '<em>$1</em>');
        fallbackText = fallbackText.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
        // 굵게 처리
        fallbackText = fallbackText.replace(/___DOUBLE_STAR___(.+?)___DOUBLE_STAR___/g, '<strong>$1</strong>');
        // 줄바꿈 처리
        return fallbackText.replace(/\n/g, '<br>');
    }
}

/**
 * 권총 SVG 아이콘 로드 함수
 */
async function loadPistolIcon(container, size = 14) {
    try {
        const response = await fetch(`${API_BASE}/static/images/pistol.svg`);
        const svgText = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('width', String(size));
            svgElement.setAttribute('height', String(size));
            svgElement.setAttribute('style', 'display: inline-block; vertical-align: middle;');
            const path = svgElement.querySelector('path');
            if (path) {
                path.setAttribute('fill', 'currentColor');
            }
            container.innerHTML = '';
            container.appendChild(svgElement);
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('권총 아이콘 로드 실패', error);
        }
        console.error('권총 아이콘 로드 실패:', error);
        container.textContent = '🔫';
    }
}

/**
 * 손전등 SVG 아이콘 로드 함수
 */
async function loadFlashlightIcon(container, size = 14) {
    try {
        const response = await fetch(`${API_BASE}/static/images/flashlight.svg`);
        const svgText = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('width', String(size));
            svgElement.setAttribute('height', String(size));
            svgElement.setAttribute('style', 'display: inline-block; vertical-align: middle;');
            const path = svgElement.querySelector('path');
            if (path) {
                path.setAttribute('fill', 'currentColor');
            }
            container.innerHTML = '';
            container.appendChild(svgElement);
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('손전등 아이콘 로드 실패', error);
        }
        console.error('손전등 아이콘 로드 실패:', error);
        container.textContent = '🔦';
    }
}

/**
 * 돋보기 SVG 아이콘 로드 함수
 */
async function loadSearchIcon(container, size = 14) {
    try {
        const response = await fetch(`${API_BASE}/static/images/search.svg`);
        const svgText = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('width', String(size));
            svgElement.setAttribute('height', String(size));
            svgElement.setAttribute('style', 'display: inline-block; vertical-align: middle;');
            const circle = svgElement.querySelector('circle');
            const line = svgElement.querySelector('line');
            if (circle) {
                circle.setAttribute('stroke', 'currentColor');
            }
            if (line) {
                line.setAttribute('stroke', 'currentColor');
            }
            container.innerHTML = '';
            container.appendChild(svgElement);
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('돋보기 아이콘 로드 실패', error);
        }
        console.error('돋보기 아이콘 로드 실패:', error);
        container.textContent = '🔍';
    }
}

/**
 * 크툴루 SVG 아이콘 로드 함수
 */
async function loadCthulhuIcon(container, size = 14) {
    try {
        const response = await fetch(`${API_BASE}/static/images/cthulhu.svg`);
        const svgText = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('width', String(size));
            svgElement.setAttribute('height', String(size));
            svgElement.setAttribute('style', 'display: inline-block; vertical-align: middle;');
            const path = svgElement.querySelector('path');
            if (path) {
                path.setAttribute('fill', 'currentColor');
                path.setAttribute('stroke', 'currentColor');
            }
            container.innerHTML = '';
            container.appendChild(svgElement);
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('크툴루 아이콘 로드 실패', error);
        }
        console.error('크툴루 아이콘 로드 실패:', error);
        container.textContent = '🐙';
    }
}

/**
 * 작은 크기의 크툴루 아이콘 로드 함수 (태그용)
 */
async function loadCthulhuIconSmall(container) {
    return loadCthulhuIcon(container, 20);
}

/**
 * 작은 크기의 조우 유형 아이콘 로드 함수 (태그용)
 */
async function loadActionIconSmall(container, symbol) {
    try {
        if (symbol === 'COMBAT') {
            return loadPistolIcon(container, 20);
        } else if (symbol === 'INVESTIGATION') {
            return loadSearchIcon(container, 20);
        } else if (symbol === 'SEARCH') {
            return loadFlashlightIcon(container, 20);
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('조우 유형 아이콘 로드 실패', error);
        }
        console.error('조우 유형 아이콘 로드 실패:', error);
        const emojiMap = {
            'COMBAT': '🔫',
            'INVESTIGATION': '🔍',
            'SEARCH': '🔦'
        };
        container.textContent = emojiMap[symbol] || '❓';
    }
}

/**
 * 월 이름 변환 (영문 → 한글)
 */
function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월',
                       '7월', '8월', '9월', '10월', '11월', '12월'];
    const index = months.indexOf(month);
    return index !== -1 ? monthNames[index] : month;
}

/**
 * 날짜 포맷팅
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 전역 유틸리티 객체
window.Utils = {
    renderMarkdown,
    loadPistolIcon,
    loadFlashlightIcon,
    loadSearchIcon,
    loadCthulhuIcon,
    loadCthulhuIconSmall,
    loadActionIconSmall,
    getMonthName,
    formatDate
};

