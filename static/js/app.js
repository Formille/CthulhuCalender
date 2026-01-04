const API_BASE = '';

// 게임 상태
let gameState = null;
let currentDate = null;
let encounterData = null; // 조우 데이터 캐시
let lastEncounterOutcome = null; // 마지막 조우 결과 저장

// 마크다운을 HTML로 변환하는 함수
function renderMarkdown(markdownText) {
    if (!markdownText) return '';
    try {
        // 이스케이프된 따옴표를 일반 따옴표로 변환 (JSON에서 온 경우)
        let processedText = markdownText.replace(/\\"/g, '"');
        
        // 따옴표가 포함된 마크다운 패턴을 먼저 처리
        // *"텍스트"* 패턴을 *텍스트*로 변환 (따옴표 제거)
        processedText = processedText.replace(/\*"([^"]+)"\*/g, '*$1*');
        
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
            return processedText
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
        }
    } catch (error) {
        console.error('마크다운 변환 오류:', error);
        // 오류 발생 시 기본 변환 시도
        let fallbackText = markdownText.replace(/\\"/g, '"');
        return fallbackText
            .replace(/\*"([^"]+)"\*/g, '<em>$1</em>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }
}

// 권총 SVG 아이콘 로드 함수
async function loadPistolIcon(container) {
    try {
        const response = await fetch(`${API_BASE}/static/images/pistol.svg`);
        const svgText = await response.text();
        // SVG 크기 조정 및 currentColor 적용
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('width', '14');
            svgElement.setAttribute('height', '14');
            svgElement.setAttribute('style', 'display: inline-block; vertical-align: middle;');
            // currentColor로 fill 변경
            const path = svgElement.querySelector('path');
            if (path) {
                path.setAttribute('fill', 'currentColor');
            }
            container.innerHTML = '';
            container.appendChild(svgElement);
        }
    } catch (error) {
        console.error('권총 아이콘 로드 실패:', error);
        // 폴백으로 이모지 사용
        container.textContent = '🔫';
    }
}

// 손전등 SVG 아이콘 로드 함수
async function loadFlashlightIcon(container) {
    try {
        const response = await fetch(`${API_BASE}/static/images/flashlight.svg`);
        const svgText = await response.text();
        // SVG 크기 조정 및 currentColor 적용
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('width', '14');
            svgElement.setAttribute('height', '14');
            svgElement.setAttribute('style', 'display: inline-block; vertical-align: middle;');
            // currentColor로 fill 변경
            const path = svgElement.querySelector('path');
            if (path) {
                path.setAttribute('fill', 'currentColor');
            }
            container.innerHTML = '';
            container.appendChild(svgElement);
        }
    } catch (error) {
        console.error('손전등 아이콘 로드 실패:', error);
        // 폴백으로 이모지 사용
        container.textContent = '🔦';
    }
}

// 돋보기 SVG 아이콘 로드 함수
async function loadSearchIcon(container) {
    try {
        const response = await fetch(`${API_BASE}/static/images/search.svg`);
        const svgText = await response.text();
        // SVG 크기 조정 및 currentColor 적용
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('width', '14');
            svgElement.setAttribute('height', '14');
            svgElement.setAttribute('style', 'display: inline-block; vertical-align: middle;');
            // currentColor로 stroke 변경
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
        console.error('돋보기 아이콘 로드 실패:', error);
        // 폴백으로 이모지 사용
        container.textContent = '🔍';
    }
}

// 크툴루 SVG 아이콘 로드 함수
async function loadCthulhuIcon(container) {
    try {
        const response = await fetch(`${API_BASE}/static/images/cthulhu.svg`);
        const svgText = await response.text();
        // SVG 크기 조정 및 currentColor 적용
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('width', '48');
            svgElement.setAttribute('height', '48');
            svgElement.setAttribute('style', 'display: inline-block; vertical-align: middle;');
            // currentColor로 fill과 stroke 변경
            const path = svgElement.querySelector('path');
            if (path) {
                path.setAttribute('fill', 'currentColor');
                path.setAttribute('stroke', 'currentColor');
            }
            container.innerHTML = '';
            container.appendChild(svgElement);
        }
    } catch (error) {
        console.error('크툴루 아이콘 로드 실패:', error);
        // 폴백으로 이모지 사용
        container.textContent = '🐙';
    }
}

// 작은 크기의 크툴루 아이콘 로드 함수 (태그용)
async function loadCthulhuIconSmall(container) {
    try {
        const response = await fetch(`${API_BASE}/static/images/cthulhu.svg`);
        const svgText = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('width', '20');
            svgElement.setAttribute('height', '20');
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
        console.error('크툴루 아이콘 로드 실패:', error);
        container.textContent = '🐙';
    }
}

// 작은 크기의 조우 유형 아이콘 로드 함수 (태그용)
async function loadActionIconSmall(container, symbol) {
    try {
        let iconPath = '';
        if (symbol === 'COMBAT') {
            iconPath = `${API_BASE}/static/images/pistol.svg`;
        } else if (symbol === 'INVESTIGATION') {
            iconPath = `${API_BASE}/static/images/search.svg`;
        } else if (symbol === 'SEARCH') {
            iconPath = `${API_BASE}/static/images/flashlight.svg`;
        } else {
            return;
        }
        
        const response = await fetch(iconPath);
        const svgText = await response.text();
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('width', '20');
            svgElement.setAttribute('height', '20');
            svgElement.setAttribute('style', 'display: inline-block; vertical-align: middle;');
            const path = svgElement.querySelector('path');
            const circle = svgElement.querySelector('circle');
            const line = svgElement.querySelector('line');
            if (path) {
                path.setAttribute('fill', 'currentColor');
                path.setAttribute('stroke', 'currentColor');
            }
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
        console.error('아이콘 로드 실패:', error);
        // 폴백 이모지
        const emojiMap = {
            'COMBAT': '🔫',
            'INVESTIGATION': '🔍',
            'SEARCH': '🔦'
        };
        container.textContent = emojiMap[symbol] || '❓';
    }
}

// 일기 태그 생성 함수
async function createStoryEntryTags(outcome, requiredSymbol, blackDiceSum, cthulhuCount) {
    const tagsContainer = document.getElementById('story-entry-tags');
    tagsContainer.innerHTML = '';
    
    // 성공/실패 태그
    const outcomeTag = document.createElement('div');
    outcomeTag.className = `tag ${outcome.is_success ? 'success' : 'failure'}`;
    outcomeTag.textContent = outcome.is_success ? '성공' : '실패';
    tagsContainer.appendChild(outcomeTag);
    
    // 조우 유형 아이콘 태그
    const actionTag = document.createElement('div');
    actionTag.className = 'tag';
    const actionIconContainer = document.createElement('span');
    actionIconContainer.className = 'tag-icon';
    await loadActionIconSmall(actionIconContainer, requiredSymbol);
    actionTag.appendChild(actionIconContainer);
    tagsContainer.appendChild(actionTag);
    
    // 주사위 수 태그
    const diceTag = document.createElement('div');
    diceTag.className = 'tag';
    diceTag.textContent = `주사위 ${blackDiceSum}`;
    tagsContainer.appendChild(diceTag);
    
    // 광기 수만큼 크툴루 아이콘 표시
    if (cthulhuCount > 0) {
        for (let i = 0; i < cthulhuCount; i++) {
            const cthulhuTag = document.createElement('div');
            cthulhuTag.className = 'tag';
            const cthulhuIconContainer = document.createElement('span');
            cthulhuIconContainer.className = 'cthulhu-icon-small';
            await loadCthulhuIconSmall(cthulhuIconContainer);
            cthulhuTag.appendChild(cthulhuIconContainer);
            tagsContainer.appendChild(cthulhuTag);
        }
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    await loadGameState();
    await loadEncounterData();
    await checkGameStart();
    initializeGreenDiceIcons();
    initializeBlackDiceSlider();
    initializeCthulhuButton();
});

// 검은 주사위 휠 피커 초기화
function initializeBlackDiceSlider() {
    const valueDisplay = document.getElementById('black-dice-sum-value');
    const itemsContainer = document.getElementById('wheel-picker-items');
    const wrapper = document.querySelector('.wheel-picker-wrapper');
    
    if (!valueDisplay || !itemsContainer || !wrapper) return;
    
    const min = 3;
    const max = 15;
    const step = 1;
    const itemHeight = 35;
    
    // 숫자 아이템 생성
    function createItems() {
        itemsContainer.innerHTML = '';
        for (let i = min; i <= max; i += step) {
            const item = document.createElement('div');
            item.className = 'wheel-picker-item';
            item.textContent = i;
            item.dataset.value = i;
            itemsContainer.appendChild(item);
        }
    }
    
    // 현재 값에 따라 위치 업데이트
    function updatePosition(value, smooth = true) {
        const clampedValue = Math.max(min, Math.min(max, value));
        const index = (clampedValue - min) / step;
        const offset = -index * itemHeight;
        
        if (smooth) {
            itemsContainer.style.transition = 'transform 0.2s ease-out';
        } else {
            itemsContainer.style.transition = 'none';
        }
        itemsContainer.style.transform = `translateY(${offset}px)`;
        
        // 선택된 아이템 강조
        itemsContainer.querySelectorAll('.wheel-picker-item').forEach((item, idx) => {
            if (idx === index) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }
    
    // 위치에서 값 계산
    function getValueFromPosition(y) {
        const rect = wrapper.getBoundingClientRect();
        const relativeY = y - rect.top;
        const centerY = rect.height / 2;
        const offset = relativeY - centerY;
        const index = Math.round(offset / itemHeight);
        const value = min + (index * step);
        return Math.max(min, Math.min(max, value));
    }
    
    // 값 업데이트 함수
    function updateValue(newValue, smooth = true) {
        const clampedValue = Math.max(min, Math.min(max, newValue));
        valueDisplay.value = clampedValue;
        updatePosition(clampedValue, smooth);
        valueDisplay.dispatchEvent(new Event('change', { bubbles: true }));
        // 주사위 값 변경 시 주간 달력 업데이트
        updateWeekCalendarByDiceValues();
    }
    
    // 초기화
    createItems();
    const initialValue = parseInt(valueDisplay.value) || 10;
    updateValue(initialValue, false);
    
    // 드래그 상태
    let isDragging = false;
    let startY = 0;
    let startOffset = 0.0;
    let currentOffset = 0.0;
    
    // 마우스 이벤트 핸들러
    function handleMouseDown(e) {
        e.preventDefault();
        isDragging = true;
        startY = e.clientY;
        const transform = itemsContainer.style.transform;
        const match = transform.match(/translateY\((-?\d+\.?\d*)px\)/);
        startOffset = match ? parseFloat(match[1]) : 0;
        currentOffset = startOffset;
        itemsContainer.style.transition = 'none';
        wrapper.style.cursor = 'grabbing';
    }
    
    function handleMouseMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const deltaY = e.clientY - startY;
        currentOffset = startOffset + deltaY;
        
        // 제한 적용
        const minOffset = -(itemsContainer.children.length - 1) * itemHeight;
        currentOffset = Math.max(minOffset, Math.min(0, currentOffset));
        
        itemsContainer.style.transform = `translateY(${currentOffset}px)`;
        
        // 가장 가까운 값 계산
        const index = Math.round(-currentOffset / itemHeight);
        const value = min + (index * step);
        const clampedValue = Math.max(min, Math.min(max, value));
        
        // 선택된 아이템 강조
        itemsContainer.querySelectorAll('.wheel-picker-item').forEach((item, idx) => {
            if (idx === index) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }
    
    function handleMouseUp() {
        if (!isDragging) return;
        isDragging = false;
        wrapper.style.cursor = 'grab';
        
        // 스냅 효과
        const index = Math.round(-currentOffset / itemHeight);
        const value = min + (index * step);
        updateValue(value, true);
    }
    
    // 터치 이벤트 핸들러
    function handleTouchStart(e) {
        e.preventDefault();
        isDragging = true;
        startY = e.touches[0].clientY;
        const transform = itemsContainer.style.transform;
        const match = transform.match(/translateY\((-?\d+\.?\d*)px\)/);
        startOffset = match ? parseFloat(match[1]) : 0;
        currentOffset = startOffset;
        itemsContainer.style.transition = 'none';
    }
    
    function handleTouchMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const deltaY = e.touches[0].clientY - startY;
        currentOffset = startOffset + deltaY;
        
        const minOffset = -(itemsContainer.children.length - 1) * itemHeight;
        currentOffset = Math.max(minOffset, Math.min(0, currentOffset));
        
        itemsContainer.style.transform = `translateY(${currentOffset}px)`;
        
        const index = Math.round(-currentOffset / itemHeight);
        const value = min + (index * step);
        const clampedValue = Math.max(min, Math.min(max, value));
        
        itemsContainer.querySelectorAll('.wheel-picker-item').forEach((item, idx) => {
            if (idx === index) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }
    
    function handleTouchEnd() {
        if (!isDragging) return;
        isDragging = false;
        
        const index = Math.round(-currentOffset / itemHeight);
        const value = min + (index * step);
        updateValue(value, true);
    }
    
    // 마우스 휠 이벤트
    function handleWheel(e) {
        e.preventDefault();
        const currentValue = parseInt(valueDisplay.value);
        const delta = e.deltaY > 0 ? step : -step;
        const newValue = currentValue + delta;
        updateValue(newValue, true);
    }
    
    // 이벤트 리스너 등록
    wrapper.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    wrapper.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
    
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    
    // 클릭으로 값 변경
    itemsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('wheel-picker-item')) {
            const value = parseInt(e.target.dataset.value);
            updateValue(value, true);
    }
    });
}

// 크툴루 기호 버튼 초기화
async function initializeCthulhuButton() {
    const cthulhuButton = document.getElementById('cthulhu-count-btn');
    const cthulhuCountDisplay = document.getElementById('cthulhu-count-display');
    const cthulhuCountInput = document.getElementById('cthulhu-count');
    
    if (cthulhuButton && cthulhuCountDisplay && cthulhuCountInput) {
        // 크툴루 아이콘 로드
        const iconContainer = cthulhuButton.querySelector('.icon-container');
        if (iconContainer) {
            await loadCthulhuIcon(iconContainer);
        }
        
        // 초기 카운트 설정 (버튼의 data 속성에 저장)
        if (!cthulhuButton.dataset.currentCount) {
            cthulhuButton.dataset.currentCount = '0';
        }
        
        // 버튼 클릭 이벤트: 0 → 1 → 2 → 3 → 0 순환
        cthulhuButton.addEventListener('click', () => {
            let currentCount = parseInt(cthulhuButton.dataset.currentCount || '0');
            currentCount = (currentCount + 1) % 4; // 0, 1, 2, 3 순환
            cthulhuButton.dataset.currentCount = currentCount.toString();
            cthulhuCountDisplay.textContent = currentCount;
            cthulhuCountInput.value = currentCount;
            // 주사위 값 변경 시 주간 달력 업데이트
            updateWeekCalendarByDiceValues();
        });
    }
}

// 크툴루 버튼 리셋 함수
function resetCthulhuButton() {
    const cthulhuButton = document.getElementById('cthulhu-count-btn');
    const cthulhuCountDisplay = document.getElementById('cthulhu-count-display');
    const cthulhuCountInput = document.getElementById('cthulhu-count');
    
    if (cthulhuButton) {
        cthulhuButton.dataset.currentCount = '0';
    }
    if (cthulhuCountDisplay) {
        cthulhuCountDisplay.textContent = '0';
    }
    if (cthulhuCountInput) {
        cthulhuCountInput.value = '0';
    }
}

// 초록 주사위 아이콘 초기화
async function initializeGreenDiceIcons() {
    const iconButtons = document.querySelectorAll('.icon-button');
    
    iconButtons.forEach(async (button) => {
        const symbol = button.dataset.symbol;
        const iconContainer = button.querySelector('.icon-container');
        
        // 아이콘 로드
        if (symbol === 'COMBAT') {
            await loadPistolIcon(iconContainer);
        } else if (symbol === 'INVESTIGATION') {
            await loadSearchIcon(iconContainer);
        } else if (symbol === 'SEARCH') {
            await loadFlashlightIcon(iconContainer);
        }
        
        // 클릭 이벤트 핸들러
        button.addEventListener('click', () => {
            const isSelected = button.classList.contains('selected');
            const selectedCount = document.querySelectorAll('.icon-button.selected').length;
            
            if (isSelected) {
                // 이미 선택된 경우, 최소 1개는 유지해야 함
                if (selectedCount > 1) {
                    button.classList.remove('selected');
                }
            } else {
                // 선택되지 않은 경우, 최대 2개까지만 선택 가능
                if (selectedCount < 2) {
                    button.classList.add('selected');
                } else {
                    alert('최대 2개까지만 선택할 수 있습니다.');
                }
            }
            // 주사위 값 변경 시 주간 달력 업데이트
            updateWeekCalendarByDiceValues();
        });
    });
}

// 게임 상태 로드
async function loadGameState() {
    try {
        const response = await fetch(`${API_BASE}/api/game/state`);
        const data = await response.json();
        
        if (data.success) {
            console.log('서버에서 로드한 게임 상태:', data.game_state);
            gameState = data.game_state;
            currentDate = gameState.today_date;
            
            // subtitle 업데이트
            const subtitle = document.querySelector('.subtitle');
            if (subtitle) {
                const campaignYear = data.campaign_year || 1926;
                subtitle.textContent = `${campaignYear}년 아컴의 그림자`;
            }
            
            // 완료된 날짜 목록 가져오기
            const completedDays = gameState.weekly_progress?.completed_days_in_week || [];
            if (completedDays.length > 0) {
                // 마지막 완료된 날짜의 결과를 가져와서 제한 적용
                // (실제로는 서버에서 마지막 조우 결과를 가져와야 하지만, 
                //  여기서는 간단히 완료된 날짜가 있으면 제한을 적용하지 않음)
                // 주의: 실제 구현에서는 서버에서 마지막 조우 결과를 가져와야 함
            }
            
            updateUI();
        }
    } catch (error) {
        console.error('게임 상태 로드 실패:', error);
        // 에러 발생 시 기본값 설정
        const subtitle = document.querySelector('.subtitle');
        if (subtitle) {
            subtitle.textContent = '1926년 아컴의 그림자';
        }
    }
}

// 조우 데이터 로드
async function loadEncounterData() {
    try {
        const response = await fetch(`${API_BASE}/api/game/encounter-data`);
        const data = await response.json();
        
        if (data.success) {
            encounterData = data.data;
        }
    } catch (error) {
        console.error('조우 데이터 로드 실패:', error);
    }
}

// 게임 시작 확인
async function checkGameStart() {
    const startSection = document.getElementById('start-section');
    const prologueSection = document.getElementById('prologue-section');
    const gameSection = document.getElementById('game-section');
    
    // 기존 게임이 있는지 확인
    try {
        const stateResponse = await fetch(`${API_BASE}/api/game/state`);
        const stateData = await stateResponse.json();
        
        if (stateData.success && stateData.game_state) {
            // 이미 게임이 시작된 경우
            // subtitle 업데이트
            const subtitle = document.querySelector('.subtitle');
            if (subtitle && stateData.campaign_year) {
                subtitle.textContent = `${stateData.campaign_year}년 아컴의 그림자`;
            }
            
            startSection.style.display = 'none';
            prologueSection.style.display = 'none';
            gameSection.style.display = 'block';
            initializeMonthCalendar();
            await initializeWeekCalendar();
            // 주사위 값에 따라 초기 업데이트
            updateWeekCalendarByDiceValues();
            return;
        }
    } catch (error) {
        console.error('게임 상태 확인 실패:', error);
    }
    
    // 새 게임 시작 - 연도 선택
    document.getElementById('select-year-btn').addEventListener('click', async () => {
        const campaignYear = parseInt(document.getElementById('campaign-year').value);
        
        try {
            const response = await fetch(`${API_BASE}/api/game/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    player_name: 'John Miller',
                    campaign_year: campaignYear
                })
            });
            
            const data = await response.json();
            
            if (data.success && data.prologue) {
                // subtitle 업데이트
                const subtitle = document.querySelector('.subtitle');
                if (subtitle && data.campaign_year) {
                    subtitle.textContent = `${data.campaign_year}년 아컴의 그림자`;
                }
                
                document.getElementById('prologue-text').textContent = data.prologue;
                startSection.style.display = 'none';
                prologueSection.style.display = 'block';
                
                document.getElementById('start-game-btn').addEventListener('click', async () => {
                    prologueSection.style.display = 'none';
                    gameSection.style.display = 'block';
                    initializeMonthCalendar();
                    await initializeWeekCalendar();
                    // 주사위 값에 따라 초기 업데이트
                    updateWeekCalendarByDiceValues();
                });
            }
        } catch (error) {
            console.error('게임 시작 실패:', error);
            alert('게임 시작에 실패했습니다. 다시 시도해주세요.');
        }
    });
}

// UI 업데이트
function updateUI() {
    if (!gameState) {
        console.warn('updateUI: gameState가 없습니다.');
        return;
    }
    
    const madnessLevel = gameState.madness_tracker?.current_level || 0;
    console.log('updateUI: 광기 수치 업데이트', {
        gameState,
        madness_tracker: gameState.madness_tracker,
        current_level: madnessLevel
    });
    
    document.getElementById('current-date').textContent = gameState.today_date || '1926-01-01';
    document.getElementById('madness-level').textContent = madnessLevel;
    document.getElementById('weekly-success').textContent = gameState.weekly_progress?.success_count || 0;
    
    // 광기 게이지 업데이트 (최대 10으로 가정)
    const madnessPercent = Math.min((madnessLevel / 10) * 100, 100);
    document.getElementById('madness-fill').style.width = `${madnessPercent}%`;
}

// 월간 달력 초기화
async function initializeMonthCalendar() {
    if (!currentDate) {
        currentDate = '1926-01-01';
    }
    
    const dateObj = new Date(currentDate + 'T00:00:00');
    const monthGrid = document.getElementById('month-grid');
    monthGrid.innerHTML = '';
    
    // 현재 월 추출
    const currentYear = dateObj.getFullYear();
    const currentMonth = dateObj.getMonth();
    
    // 월 이름 배열
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonthName = monthNames[currentMonth];
    
    // 월 이름 표시 업데이트
    const monthNameElement = document.getElementById('current-month-name');
    if (monthNameElement) {
        monthNameElement.textContent = currentMonthName;
    }
    
    // 완료된 날짜 목록 및 광기 정보 가져오기
    let completedDates = new Set();
    let madnessInfo = new Map(); // 날짜별 광기 정보 저장
    try {
        
        const monthResponse = await fetch(`${API_BASE}/api/narrative/month/${currentMonthName}`);
        const monthData = await monthResponse.json();
        if (monthData.success && monthData.entries) {
            monthData.entries.forEach(entry => {
                // 조우 기록은 target_date를 사용 (조우 타겟이 되었던 날짜)
                const targetDate = entry.game_logic_snapshot?.target_date;
                if (targetDate) {
                    // 성공한 경우에만 완료된 것으로 표시
                    if (entry.is_success) {
                        completedDates.add(targetDate);
                    }
                    // 광기 정보 저장
                    if (entry.madness_triggered) {
                        madnessInfo.set(targetDate, entry.cthulhu_symbol_count || 0);
                    }
                }
            });
        }
    } catch (error) {
        console.error('완료된 날짜 확인 실패:', error);
    }
    
    // 요일 헤더 추가
    const dayHeaders = ['월', '화', '수', '목', '금', '토', '일'];
    dayHeaders.forEach(dayName => {
        const headerCell = document.createElement('div');
        headerCell.className = 'month-header-cell';
        if (dayName === '일') {
            headerCell.classList.add('sunday-header');
        }
        headerCell.textContent = dayName;
        monthGrid.appendChild(headerCell);
    });
    
    // 월의 첫 날짜와 마지막 날짜 계산
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // 첫 날의 요일 (0=일요일, 1=월요일, ...)
    const firstDayOfWeek = firstDay.getDay();
    
    // 첫 주의 빈 칸 추가 (월요일부터 시작하므로 일요일이면 6칸, 월요일이면 0칸)
    const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    for (let i = 0; i < daysToMonday; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'month-day-cell empty';
        monthGrid.appendChild(emptyCell);
    }
    
    // 날짜 셀 추가
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(currentYear, currentMonth, day);
        const dateStr = formatDate(dayDate);
        const isCompleted = completedDates.has(dateStr);
        const dayOfWeek = dayDate.getDay();
        const isSunday = dayOfWeek === 0;
        
        const dayCell = document.createElement('div');
        dayCell.className = 'month-day-cell';
        if (isSunday) {
            dayCell.classList.add('sunday');
        }
        if (isCompleted) {
            dayCell.classList.add('completed');
        }
        dayCell.dataset.date = dateStr;
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        
        const dayDateLabel = document.createElement('div');
        dayDateLabel.className = 'day-date-label';
        const month = String(currentMonth + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateKey = `${month}-${dayStr}`;
        
        // 조우 데이터에서 정보 가져오기
        let difficulty = '';
        let currentEncounter = null;
        if (encounterData && encounterData.encounters && encounterData.encounters[dateKey]) {
            currentEncounter = encounterData.encounters[dateKey];
            // required_action: 1=COMBAT(권총), 2=INVESTIGATION(돋보기), 3=SEARCH(손전등)
            const iconTextMap = {
                1: '🔫',      // 권총
                2: '🔍',      // 돋보기
                3: '🔦'       // 손전등
            };
            difficulty = currentEncounter.base_difficulty || '';
            
            // 아이콘과 난이도를 슬래시로 구분하여 표시
            const iconSpan = document.createElement('span');
            iconSpan.className = 'action-icon';
            const iconText = iconTextMap[currentEncounter.required_action] || '';
            
            // 권총(COMBAT)인 경우 커스텀 SVG 사용
            if (currentEncounter.required_action === 1) {
                // SVG 파일을 비동기로 로드
                loadPistolIcon(iconSpan);
            } else if (currentEncounter.required_action === 2) {
                // 돋보기(INVESTIGATION)인 경우 커스텀 SVG 사용
                loadSearchIcon(iconSpan);
            } else if (currentEncounter.required_action === 3) {
                // 손전등(SEARCH)인 경우 커스텀 SVG 사용
                loadFlashlightIcon(iconSpan);
            }
            
            const difficultySpan = document.createElement('span');
            difficultySpan.className = 'difficulty-value';
            difficultySpan.textContent = difficulty || '';
            
            dayDateLabel.appendChild(iconSpan);
            if (difficulty) {
                const separator = document.createTextNode(' / ');
                dayDateLabel.appendChild(separator);
                dayDateLabel.appendChild(difficultySpan);
            }
        }
        
        dayCell.appendChild(dayNumber);
        dayCell.appendChild(dayDateLabel);
        
        // 완료된 날짜에 광기 태그 추가 (월간 달력에서는 표시하지 않음)
        // if (isCompleted && madnessInfo.has(dateStr)) {
        //     const madnessCount = madnessInfo.get(dateStr);
        //     const madnessTag = document.createElement('span');
        //     madnessTag.className = 'tag madness';
        //     madnessTag.textContent = `광기 ${madnessCount}`;
        //     dayCell.appendChild(madnessTag);
        // }
        
        // 월간 달력은 클릭 불가능하게 설정
        dayCell.style.cursor = 'default';
        dayCell.style.pointerEvents = 'none';
        
        monthGrid.appendChild(dayCell);
    }
    
    // 현재 날짜 오버레이 추가
    async function addTodayDateOverlay() {
        let todayDateStr = null;
        
        // gameState에서 today_date 가져오기
        if (gameState && gameState.today_date) {
            todayDateStr = gameState.today_date;
        } else {
            // gameState가 없으면 API에서 가져오기
            try {
                const response = await fetch(`${API_BASE}/api/game/state`);
                const data = await response.json();
                if (data.success && data.game_state && data.game_state.today_date) {
                    todayDateStr = data.game_state.today_date;
                }
            } catch (error) {
                console.error('현재 날짜 가져오기 실패:', error);
            }
        }
        
        if (todayDateStr) {
            const todayCell = monthGrid.querySelector(`[data-date="${todayDateStr}"]`);
            
            if (todayCell) {
                // 오버레이 셀 생성
                const overlayCell = document.createElement('div');
                overlayCell.className = 'today-date-overlay';
                overlayCell.dataset.date = todayDateStr;
                
                // 오버레이 셀을 해당 셀 위에 배치
                todayCell.style.position = 'relative';
                todayCell.appendChild(overlayCell);
            }
        }
    }
    
    // 오버레이 추가
    await addTodayDateOverlay();
}

// 주간 달력 초기화
async function initializeWeekCalendar() {
    if (!currentDate) {
        currentDate = '1926-01-01';
    }
    
    const dateObj = new Date(currentDate + 'T00:00:00'); // 시간 설정으로 날짜 파싱 정확도 향상
    const weekGrid = document.getElementById('week-grid');
    weekGrid.innerHTML = '';
    
    // 현재 월 추출
    const currentYear = dateObj.getFullYear();
    const currentMonth = dateObj.getMonth();
    
    // 성공한 날짜 목록 가져오기
    let completedDates = new Set();
    try {
        // 현재 월 이름 가져오기
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const currentMonthName = monthNames[currentMonth];
        
        // 현재 월의 일기 확인
        const monthResponse = await fetch(`${API_BASE}/api/narrative/month/${currentMonthName}`);
        const monthData = await monthResponse.json();
        if (monthData.success && monthData.entries) {
            monthData.entries.forEach(entry => {
                if (entry.is_success) {
                    // 조우 기록은 target_date를 사용 (조우 타겟이 되었던 날짜)
                    const targetDate = entry.game_logic_snapshot?.target_date;
                    if (targetDate) {
                        completedDates.add(targetDate);
                    }
                }
            });
        }
    } catch (error) {
        console.error('성공한 날짜 확인 실패:', error);
    }
    
    const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
    const weekStart = new Date(dateObj);
    // 월요일로 조정 (getDay(): 0=일요일, 1=월요일, ...)
    const dayOfWeek = dateObj.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 일요일이면 6일 전, 아니면 dayOfWeek-1일 전
    weekStart.setDate(dateObj.getDate() - daysToMonday);
    
    // 현재 날짜가 일요일인지 확인
    const isCurrentDateSunday = dayOfWeek === 0;
    
    // 주간 성공 횟수 가져오기
    const weeklySuccess = gameState?.weekly_progress?.success_count || 0;
    
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + i);
        
        // 현재 월에 해당하는 날짜만 표시
        const dayYear = dayDate.getFullYear();
        const dayMonth = dayDate.getMonth();
        
        // 다른 월의 날짜는 회색으로 표시하되, 클릭 불가능하게
        const isCurrentMonth = (dayYear === currentYear && dayMonth === currentMonth);
        
        const dateStr = formatDate(dayDate);
        const isCompleted = completedDates.has(dateStr);
        
        // 일요일 체크 (i === 6이면 일요일)
        const isSunday = i === 6;
        
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        if (!isCurrentMonth) {
            dayCell.classList.add('other-month');
        }
        if (isCompleted) {
            dayCell.classList.add('completed');
        }
        if (isSunday) {
            dayCell.classList.add('sunday');
        }
        dayCell.dataset.date = dateStr;
        
        const dayLabel = document.createElement('div');
        dayLabel.className = 'day-label';
        dayLabel.textContent = dayNames[i];
        
        const dayDateSpan = document.createElement('div');
        dayDateSpan.className = 'day-date';
        // 날짜 표시 형식: MM-DD (월-일만)
        const month = String(dayDate.getMonth() + 1).padStart(2, '0');
        const day = String(dayDate.getDate()).padStart(2, '0');
        const dateKey = `${month}-${day}`;
        
        // 조우 데이터에서 정보 가져오기
        let difficulty = '';
        let baseDifficulty = '';
        let currentEncounter = null;
        if (encounterData && encounterData.encounters && encounterData.encounters[dateKey]) {
            currentEncounter = encounterData.encounters[dateKey];
            // required_action: 1=COMBAT(권총), 2=INVESTIGATION(돋보기), 3=SEARCH(손전등)
            const iconTextMap = {
                1: '🔫',      // 권총
                2: '🔍',      // 돋보기
                3: '🔦'       // 손전등
            };
            baseDifficulty = currentEncounter.base_difficulty || '';
            
            // 일요일인 경우 주간 성공 횟수만큼 난이도 차감
            if (isSunday) {
                difficulty = Math.max(0, baseDifficulty - weeklySuccess);
            } else {
                difficulty = baseDifficulty;
            }
            
            // 아이콘과 난이도를 슬래시로 구분하여 표시
            const iconSpan = document.createElement('span');
            iconSpan.className = 'action-icon';
            const iconText = iconTextMap[currentEncounter.required_action] || '';
            
            // 권총(COMBAT)인 경우 커스텀 SVG 사용
            if (currentEncounter.required_action === 1) {
                // SVG 파일을 비동기로 로드
                loadPistolIcon(iconSpan);
            } else if (currentEncounter.required_action === 2) {
                // 돋보기(INVESTIGATION)인 경우 커스텀 SVG 사용
                loadSearchIcon(iconSpan);
            } else if (currentEncounter.required_action === 3) {
                // 손전등(SEARCH)인 경우 커스텀 SVG 사용
                loadFlashlightIcon(iconSpan);
            }
            
            const difficultySpan = document.createElement('span');
            difficultySpan.className = 'difficulty-value';
            // 일요일이고 난이도가 감소한 경우 초록색 클래스 추가
            if (isSunday && weeklySuccess > 0 && difficulty < baseDifficulty) {
                difficultySpan.classList.add('sunday-reduced-difficulty');
            }
            difficultySpan.textContent = difficulty || '';
            
            dayDateSpan.appendChild(iconSpan);
            if (difficulty !== '') {
                const separator = document.createTextNode(' / ');
                dayDateSpan.appendChild(separator);
                dayDateSpan.appendChild(difficultySpan);
            }
        }
        
        dayCell.appendChild(dayLabel);
        dayCell.appendChild(dayDateSpan);
        
        // 선택 가능 여부 결정
        let isSelectable = isCurrentMonth && !isCompleted;
        
        // 일요일 선택 제한 로직
        if (isSelectable) {
            if (isCurrentDateSunday) {
                // 현재 날짜가 일요일이면 오로지 일요일만 선택 가능 (월~토는 비활성화)
                if (!isSunday) {
                    isSelectable = false;
                }
            } else {
                // 현재 날짜가 일요일이 아니면 일요일은 항상 선택 불가 (조건 만족해도)
                if (isSunday) {
                    isSelectable = false;
                }
            }
        }
        
        // 모험 결과에 따라 선택 가능 여부 제한 (일요일 제한 이후에만 체크)
        if (isSelectable && lastEncounterOutcome) {
            isSelectable = isEncounterSelectable(dayDate, currentEncounter, lastEncounterOutcome);
        }
        
        // 현재 주사위 값으로 성공 가능 여부 확인 (일요일 제한과 모험 결과 제한 이후에만 체크)
        if (isSelectable && !lastEncounterOutcome && currentEncounter) {
            // 일요일이 아닌 날에는 일요일 조우는 항상 false
            if (!isCurrentDateSunday && isSunday) {
                isSelectable = false;
            } else {
                isSelectable = canEncounterSucceed(currentEncounter, dayDate);
            }
        }
        
        if (isSelectable) {
            const clickHandler = () => selectDate(dayDate);
            dayCell.addEventListener('click', clickHandler);
            dayCell._clickHandler = clickHandler; // 나중에 제거하기 위해 저장
            dayCell.style.cursor = 'pointer';
            dayCell.classList.remove('disabled-by-dice');
        } else {
            dayCell.style.cursor = 'not-allowed';
            if (!isCurrentMonth) {
                dayCell.style.opacity = '0.5';
            } else if (!isCompleted) {
                if (lastEncounterOutcome) {
                    // 모험 결과로 인해 선택 불가능한 경우
                    dayCell.style.opacity = '0.4';
                    dayCell.classList.add('disabled-by-outcome');
                } else {
                    // 주사위 값으로 인해 선택 불가능한 경우
                    dayCell.style.opacity = '0.4';
                    dayCell.classList.add('disabled-by-dice');
                }
            }
        }
        
        weekGrid.appendChild(dayCell);
    }
}

// 선택된 날짜 초기화
function clearSelectedDate() {
    // 모든 셀에서 selected 클래스 제거
    document.querySelectorAll('.day-cell, .month-day-cell').forEach(c => {
        c.classList.remove('selected');
    });
    
    // 숨겨진 input 초기화
    const hiddenDateInput = document.getElementById('target-date-hidden');
    if (hiddenDateInput) {
        hiddenDateInput.value = '';
    }
    
    // 조우 선택 폼 필드 초기화
    const visualDescriptionInput = document.getElementById('visual-description');
    if (visualDescriptionInput) {
        visualDescriptionInput.value = '';
    }
    const requiredSymbolSelect = document.getElementById('required-symbol');
    if (requiredSymbolSelect) {
        requiredSymbolSelect.value = 'COMBAT'; // 기본값으로 설정
    }
    const baseDifficultyInput = document.getElementById('base-difficulty');
    if (baseDifficultyInput) {
        baseDifficultyInput.value = '10'; // 기본값으로 설정
    }
}

// 날짜 선택
function selectDate(date) {
    const dateStr = formatDate(date);
    
    // 주간 달력과 월간 달력 모두에서 셀 찾기
    const weekCell = document.querySelector(`.week-grid [data-date="${dateStr}"]`);
    const monthCell = document.querySelector(`.month-grid [data-date="${dateStr}"]`);
    
    // 완료된 날짜는 선택 불가
    if ((weekCell && weekCell.classList.contains('completed')) || 
        (monthCell && monthCell.classList.contains('completed'))) {
        return;
    }
    
    // 다른 월의 날짜는 선택 불가 (주간 달력에서만)
    if (weekCell && weekCell.classList.contains('other-month')) {
        return;
    }
    
    // 모든 셀에서 selected 클래스 제거
    document.querySelectorAll('.day-cell, .month-day-cell').forEach(c => {
        c.classList.remove('selected');
    });
    
    // 선택한 셀에 selected 클래스 추가
    if (weekCell) {
        weekCell.classList.add('selected');
    }
    if (monthCell) {
        monthCell.classList.add('selected');
    }
    
    // 숨겨진 input에 날짜 저장
    const hiddenDateInput = document.getElementById('target-date-hidden');
    if (hiddenDateInput) {
        hiddenDateInput.value = dateStr;
    }
    
    // 해당 날짜의 요일에 맞는 조우 데이터 자동 채우기
    fillEncounterData(date);
}

// 조우 데이터 자동 채우기
function fillEncounterData(date) {
    if (!encounterData || !encounterData.encounters) {
        console.warn('조우 데이터가 로드되지 않았습니다.');
        return;
    }
    
    // 월일 키 생성 (MM-DD 형식)
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${month}-${day}`;
    
    // 해당 월일의 조우 데이터 가져오기
    const encounter = encounterData.encounters[dateKey];
    if (!encounter) {
        console.warn(`날짜 ${dateKey}에 대한 조우 데이터가 없습니다.`);
        return;
    }
    
    // 폼 필드에 데이터 채우기
    const visualDescriptionInput = document.getElementById('visual-description');
    const requiredSymbolSelect = document.getElementById('required-symbol');
    const baseDifficultyInput = document.getElementById('base-difficulty');
    
    if (visualDescriptionInput) {
        visualDescriptionInput.value = encounter.visual_description;
    }
    
    if (requiredSymbolSelect) {
        // required_action이 1, 2, 3으로 되어 있으므로 변환 필요
        // 1 = COMBAT, 2 = INVESTIGATION, 3 = SEARCH
        const actionMap = {
            1: 'COMBAT',
            2: 'INVESTIGATION',
            3: 'SEARCH'
        };
        const actionValue = actionMap[encounter.required_action];
        if (actionValue) {
            requiredSymbolSelect.value = actionValue;
        }
    }
    
    if (baseDifficultyInput) {
        baseDifficultyInput.value = encounter.base_difficulty;
    }
}

// 날짜 포맷팅
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 현재 주사위 값으로 조우 성공 가능 여부 계산
function canEncounterSucceed(encounter, dayDate) {
    if (!encounter) {
        return false;
    }
    
    // 현재 주사위 값 가져오기
    const blackDiceSum = parseInt(document.getElementById('black-dice-sum-value').value) || 10;
    const greenDiceSymbols = [];
    document.querySelectorAll('.icon-button.selected').forEach(button => {
        greenDiceSymbols.push(button.dataset.symbol);
    });
    
    if (greenDiceSymbols.length === 0) {
        return false; // 초록 주사위가 선택되지 않았으면 실패
    }
    
    // 조우 유형 매핑
    const encounterActionMap = {
        1: 'COMBAT',
        2: 'INVESTIGATION',
        3: 'SEARCH'
    };
    const requiredSymbol = encounterActionMap[encounter.required_action];
    
    // 기호 일치 확인
    const symbolMatch = greenDiceSymbols.includes(requiredSymbol);
    if (!symbolMatch) {
        return false;
    }
    
    // 유효 난이도 계산
    let effectiveDifficulty = encounter.base_difficulty || 10;
    
    // 일요일인 경우 주간 성공 횟수만큼 난이도 차감
    const dayOfWeek = dayDate.getDay();
    if (dayOfWeek === 0) { // 일요일
        const weeklySuccess = gameState?.weekly_progress?.success_count || 0;
        effectiveDifficulty = Math.max(0, effectiveDifficulty - weeklySuccess);
    }
    
    // 숫자 합계 확인
    const numberMatch = blackDiceSum >= effectiveDifficulty;
    
    return numberMatch;
}

// 조우 선택 가능 여부 판단 (모험 결과 기반)
function isEncounterSelectable(dayDate, encounter, lastOutcome) {
    if (!encounter || !lastOutcome) {
        return true; // 조우 데이터가 없으면 기본적으로 선택 가능
    }
    
    const dateStr = formatDate(dayDate);
    
    // 이미 완료한 날짜는 선택 불가
    if (dateStr === lastOutcome.target_date) {
        return false;
    }
    
    // 모험 결과에 따라 선택 가능 여부 결정
    // 성공한 경우: 같은 조우 유형만 선택 가능
    // 실패한 경우: 다른 조우 유형만 선택 가능
    const encounterActionMap = {
        1: 'COMBAT',
        2: 'INVESTIGATION',
        3: 'SEARCH'
    };
    
    const encounterAction = encounterActionMap[encounter.required_action];
    const lastAction = lastOutcome.required_symbol;
    
    if (lastOutcome.is_success) {
        // 성공한 경우: 같은 조우 유형만 선택 가능
        return encounterAction === lastAction;
    } else {
        // 실패한 경우: 다른 조우 유형만 선택 가능
        return encounterAction !== lastAction;
    }
}

// 주간 달력의 선택 가능 여부 업데이트
async function updateWeekCalendarAvailability() {
    // 주간 달력 재초기화
    await initializeWeekCalendar();
}

// 주사위 값 변경에 따른 주간 달력 업데이트
function updateWeekCalendarByDiceValues() {
    // 선택된 날짜 초기화
    clearSelectedDate();
    
    // 주간 달력의 각 날짜 셀 업데이트
    const weekGrid = document.getElementById('week-grid');
    if (!weekGrid) return;
    
    // 현재 날짜가 일요일인지 확인
    if (!currentDate) {
        currentDate = '1926-01-01';
    }
    const currentDateObj = new Date(currentDate + 'T00:00:00');
    const isCurrentDateSunday = currentDateObj.getDay() === 0;
    
    const dayCells = weekGrid.querySelectorAll('.day-cell');
    dayCells.forEach(dayCell => {
        // 완료된 날짜나 다른 월의 날짜는 건너뛰기
        if (dayCell.classList.contains('completed') || 
            dayCell.classList.contains('other-month')) {
            return;
        }
        
        // 모험 결과 제한이 있는 경우 건너뛰기
        if (dayCell.classList.contains('disabled-by-outcome')) {
            return;
        }
        
        const dateStr = dayCell.dataset.date;
        if (!dateStr) return;
        
        // 날짜 파싱
        const dayDate = new Date(dateStr + 'T00:00:00');
        const isSunday = dayDate.getDay() === 0;
        
        // 일요일 제한 로직 적용
        if (isCurrentDateSunday) {
            // 현재 날짜가 일요일이면 일요일만 선택 가능
            if (!isSunday) {
                dayCell.style.cursor = 'not-allowed';
                dayCell.style.opacity = '0.4';
                dayCell.classList.add('disabled-by-dice');
                const existingClickHandler = dayCell._clickHandler;
                if (existingClickHandler) {
                    dayCell.removeEventListener('click', existingClickHandler);
                    delete dayCell._clickHandler;
                }
                return;
            }
        } else {
            // 현재 날짜가 일요일이 아니면 일요일은 항상 선택 불가
            if (isSunday) {
                dayCell.style.cursor = 'not-allowed';
                dayCell.style.opacity = '0.4';
                dayCell.classList.add('disabled-by-dice');
                const existingClickHandler = dayCell._clickHandler;
                if (existingClickHandler) {
                    dayCell.removeEventListener('click', existingClickHandler);
                    delete dayCell._clickHandler;
                }
                return;
            }
        }
        
        // 조우 데이터 가져오기
        const month = String(dayDate.getMonth() + 1).padStart(2, '0');
        const day = String(dayDate.getDate()).padStart(2, '0');
        const dateKey = `${month}-${day}`;
        
        let currentEncounter = null;
        if (encounterData && encounterData.encounters && encounterData.encounters[dateKey]) {
            currentEncounter = encounterData.encounters[dateKey];
        }
        
        if (!currentEncounter) return;
        
        // 성공 가능 여부 확인
        const canSucceed = canEncounterSucceed(currentEncounter, dayDate);
        
        // 기존 클릭 이벤트 리스너 제거를 위해 새 이벤트 리스너로 교체
        // 셀을 복제하지 않고 기존 셀의 스타일과 클래스만 업데이트
        // 이벤트 리스너는 data 속성에 저장된 날짜를 사용하여 재등록
        const existingClickHandler = dayCell._clickHandler;
        if (existingClickHandler) {
            dayCell.removeEventListener('click', existingClickHandler);
        }
        
        if (canSucceed) {
            const clickHandler = () => selectDate(dayDate);
            dayCell.addEventListener('click', clickHandler);
            dayCell._clickHandler = clickHandler; // 나중에 제거하기 위해 저장
            dayCell.style.cursor = 'pointer';
            dayCell.style.opacity = '1';
            dayCell.classList.remove('disabled-by-dice');
        } else {
            dayCell.style.cursor = 'not-allowed';
            dayCell.style.opacity = '0.4';
            dayCell.classList.add('disabled-by-dice');
        }
    });
}

// 주사위 굴리기 버튼 이벤트
document.getElementById('roll-dice-btn')?.addEventListener('click', async () => {
    await processEncounter();
});

// 조우 처리
async function processEncounter() {
    const targetDateInput = document.getElementById('target-date-hidden');
    let targetDate = targetDateInput?.value;
    let isForcedFailure = false;
    
    // 날짜가 선택되지 않은 경우
    if (!targetDate) {
        const confirmMessage = '선택된 조우가 없습니다. \n실패로 기록하시겠습니까?';
        if (!confirm(confirmMessage)) {
            return; // 사용자가 취소하면 중단
        }
        // 사용자가 확인하면 현재 날짜로 실패 기록
        if (gameState && gameState.today_date) {
            targetDate = gameState.today_date;
            isForcedFailure = true;
        } else {
            alert('게임 상태를 불러올 수 없습니다.');
            return;
        }
    }
    
    const visualDescription = document.getElementById('visual-description').value || '선택되지 않은 조우';
    const requiredSymbol = document.getElementById('required-symbol').value || 'COMBAT';
    const baseDifficulty = parseInt(document.getElementById('base-difficulty').value) || 10;
    const blackDiceSum = parseInt(document.getElementById('black-dice-sum-value').value) || 0;
    const cthulhuCount = parseInt(document.getElementById('cthulhu-count').value) || 0;
    
    // 초록 주사위 기호 수집
    const greenDiceSymbols = [];
    document.querySelectorAll('.icon-button.selected').forEach(button => {
        greenDiceSymbols.push(button.dataset.symbol);
    });
    
    // 강제 실패인 경우 초록 주사위 기호가 없어도 진행
    if (!isForcedFailure && (!targetDate || !visualDescription || greenDiceSymbols.length === 0)) {
        alert('모든 필드를 입력해주세요.');
        return;
    }
    
    // 강제 실패인 경우 기본값 설정
    if (isForcedFailure && greenDiceSymbols.length === 0) {
        greenDiceSymbols.push('COMBAT'); // 기본값
    }
    
    // 강제 실패인 경우 실패가 확실하도록 주사위 값 조정
    let finalBlackDiceSum = blackDiceSum;
    let finalGreenDiceSymbols = [...greenDiceSymbols];
    
    if (isForcedFailure) {
        // 실패가 확실하도록: 검은 주사위 합계를 0으로 설정하거나, 기호를 일치하지 않게 설정
        finalBlackDiceSum = 0; // 난이도보다 낮게 설정하여 실패 보장
        // 기호는 그대로 유지 (이미 일치하지 않을 수 있음)
    }
    
    const requestData = {
        target_date: targetDate,
        visual_description: visualDescription,
        required_symbol: requiredSymbol,
        base_difficulty: baseDifficulty,
        black_dice_sum: finalBlackDiceSum,
        green_dice_symbols: finalGreenDiceSymbols,
        cthulhu_symbol_count: cthulhuCount,
        is_forced_failure: isForcedFailure // 강제 실패 플래그 추가
    };
    
    // 로딩 표시
    const storySection = document.getElementById('story-section');
    storySection.style.display = 'block';
    const storyContent = document.getElementById('story-content');
    storyContent.style.display = 'block'; // 로딩 중에는 표시
    storyContent.innerHTML = '<div class="loading">스토리를 생성하는 중...</div>';
    document.getElementById('story-summary').textContent = '';
    
    try {
        const response = await fetch(`${API_BASE}/api/game/encounter`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 모험 진행 결과 태그 생성
            const outcome = data.outcome;
            await createStoryEntryTags(outcome, requiredSymbol, finalBlackDiceSum, cthulhuCount);
            
            // 스토리 표시 (요약만 표시)
            const storyContent = document.getElementById('story-content');
            storyContent.style.display = 'none'; // 전체 텍스트 숨기기
            const storySummary = document.getElementById('story-summary');
            storySummary.innerHTML = renderMarkdown(data.narrative.summary_line);
            
            // 게임 상태 업데이트
            if (data.updated_state) {
                console.log('조우 처리 후 상태 업데이트:', data.updated_state);
                // gameState 구조가 없을 수 있으므로 안전하게 초기화
                if (!gameState.madness_tracker) {
                    gameState.madness_tracker = {};
                }
                if (!gameState.weekly_progress) {
                    gameState.weekly_progress = {};
                }
                gameState.madness_tracker.current_level = data.updated_state.madness_level;
                gameState.weekly_progress.success_count = data.updated_state.weekly_success_count;
                console.log('gameState 업데이트 후:', gameState);
                updateUI();
            }
            
            // 크툴루 버튼 리셋
            resetCthulhuButton();
            
            // 게임 상태를 서버에서 다시 로드하여 최신 상태 반영
            await loadGameState();
            
            // 성공/실패 표시 (이미 outcome 변수는 위에서 사용됨)
            if (outcome.is_success) {
                storySection.style.borderColor = '#d4af37';
            } else {
                storySection.style.borderColor = '#8b0000';
            }
            
            // 조우 결과 저장 (다음 조우 선택 제한에 사용)
            lastEncounterOutcome = {
                is_success: outcome.is_success,
                target_date: targetDate,
                required_symbol: requiredSymbol,
                green_dice_symbols: greenDiceSymbols
            };
            
            // 주간 달력 업데이트 (선택 가능한 조우 기록만 활성화)
            await updateWeekCalendarAvailability();
        } else {
            throw new Error('조우 처리 실패');
        }
    } catch (error) {
        console.error('조우 처리 오류:', error);
        const storyContent = document.getElementById('story-content');
        storyContent.style.display = 'block'; // 오류 시 표시
        storyContent.innerHTML = 
            '<div class="error">스토리 생성 중 오류가 발생했습니다. 다시 시도해주세요.</div>';
        document.getElementById('story-summary').textContent = '';
    }
}

