// Play 페이지 컴포넌트 (게임 플레이)
// 기존 app.js의 로직을 컴포넌트로 통합

// IIFE로 감싸서 스코프 분리 (API_BASE 중복 선언 방지)
(function() {
    'use strict';
    
    // API_BASE는 전역 변수로 한 번만 선언
    if (typeof window.API_BASE === 'undefined') {
        window.API_BASE = '';
    }
    // window.API_BASE를 직접 사용하거나 로컬 변수로 참조
    const API_BASE = window.API_BASE || '';

// 게임 상태 (컴포넌트 내부 변수)
let gameState = null;
let currentDate = null;
let encounterData = null;
let lastEncounterOutcome = null;

const PlayComponent = {
    async init() {
        if (window.DebugLogger) {
            window.DebugLogger.info('Play 컴포넌트 초기화');
        }

        // 게임 상태 로드
        await this.loadGameState();
        await this.loadEncounterData();
    },

    render() {
        return `
            <div id="start-section" class="start-section"></div>
            <div id="prologue-section" class="prologue-section" style="display: none;">
                <div class="prologue-content">
                    <h2>프롤로그</h2>
                    <div id="prologue-text"></div>
                    <button id="start-game-btn" class="btn btn-primary">게임 시작</button>
                </div>
            </div>
            <div id="game-section" class="game-section" style="display: none;">
                <h2 id="current-month-name"></h2>
                <div class="calendar-month">
                    <div class="month-grid" id="month-grid"></div>
                </div>
                <div class="encounter-selection" style="display: none;">
                    <h2>조우 선택</h2>
                    <div id="encounter-form">
                        <input type="hidden" id="target-date-hidden">
                        <div class="form-group">
                            <label>대상 묘사:</label>
                            <input type="text" id="visual-description" placeholder="예: 검은 고양이" required>
                        </div>
                        <div class="form-group">
                            <label>필요한 행동:</label>
                            <select id="required-symbol" required>
                                <option value="COMBAT">권총 (전투)</option>
                                <option value="INVESTIGATION">돋보기 (조사)</option>
                                <option value="SEARCH">손전등 (수색)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>기본 난이도:</label>
                            <input type="number" id="base-difficulty" min="5" max="20" value="10" required>
                        </div>
                    </div>
                </div>
                <h2>모험 진행</h2>
                <div class="dice-controls">
                    <div class="dice-group">
                        <div class="slider-container">
                            <div class="wheel-picker">
                                <div class="wheel-picker-wrapper">
                                    <div class="wheel-picker-items" id="wheel-picker-items"></div>
                                    <div class="wheel-picker-selection"></div>
                                </div>
                            </div>
                            <input type="hidden" id="black-dice-sum-value" value="9">
                        </div>
                    </div>
                    <div class="dice-group">
                        <label>광기 체크</label>
                        <div class="cthulhu-button-container">
                            <button type="button" id="cthulhu-count-btn" class="cthulhu-button" title="클릭 시 광기 수가 변경됩니다.">
                                <span class="icon-container cthulhu-icon"></span>
                                <span id="cthulhu-count-display" class="cthulhu-count-display">0</span>
                            </button>
                            <input type="hidden" id="cthulhu-count" value="0" required>
                        </div>
                    </div>
                    <div class="dice-group">
                        <label>조우 유형</label>
                        <div class="green-dice-icons">
                            <button type="button" class="icon-button" data-symbol="COMBAT" title="권총">
                                <span class="icon-container"></span>
                            </button>
                            <button type="button" class="icon-button" data-symbol="INVESTIGATION" title="돋보기">
                                <span class="icon-container"></span>
                            </button>
                            <button type="button" class="icon-button" data-symbol="SEARCH" title="손전등">
                                <span class="icon-container"></span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="calendar-week">
                    <h2>금주의 조우 기록</h2>
                    <div class="week-grid" id="week-grid"></div>
                </div>
                <button id="roll-dice-btn" class="btn btn-primary">일기장 읽기</button>
                <div id="story-section" class="story-section" style="display: none;">
                    <h2>존 밀러의 일기</h2>
                    <div class="entry-tags" id="story-entry-tags"></div>
                    <div class="story-content" id="story-content"></div>
                    <div class="story-summary" id="story-summary"></div>
                </div>
            </div>
        `;
    },

    async mount() {
        await this.checkGameStart();
        this.initializeGreenDiceIcons();
        this.initializeBlackDiceSlider();
        this.initializeCthulhuButton();
        this.setupEventListeners();
    },

    async loadGameState() {
        const startTime = Date.now();
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('loadGameState');
        }
        
        try {
            if (typeof window.StorageModule === 'undefined') {
                throw new Error('StorageModule이 로드되지 않았습니다.');
            }

            await window.StorageModule.initDB();
            const activeSlotId = await window.StorageModule.getActiveSlot();
            
            if (!activeSlotId) {
                if (window.DebugLogger) {
                    window.DebugLogger.debug('활성 슬롯이 없습니다.');
                }
                return;
            }

            const gameData = await window.StorageModule.getSaveSlot(activeSlotId);
            
            if (gameData) {
                gameState = gameData.current_state || {};
                currentDate = gameState.today_date;
                
                // AppState에도 동기화
                window.AppState.setState('gameState', gameState);
                window.AppState.setState('currentDate', currentDate);
                window.AppState.setState('campaignYear', gameData.save_file_info?.campaign_year || 1925);
                
                if (window.DebugLogger) {
                    window.DebugLogger.info('게임 상태 로드 완료', {
                        activeSlotId,
                        todayDate: currentDate
                    });
                }
                
                this.updateUI();
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('게임 상태 로드 실패', error);
                window.DebugLogger.logFunctionExit('loadGameState', error, startTime);
            }
            console.error('게임 상태 로드 실패:', error);
            throw error;
        } finally {
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('loadGameState', null, startTime);
            }
        }
    },

    async loadEncounterData() {
        const startTime = Date.now();
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('loadEncounterData');
        }
        
        try {
            if (typeof window.EncounterCache !== 'undefined') {
                if (window.DebugLogger) window.DebugLogger.debug('EncounterCache 모듈을 사용하여 조우 데이터 로드');
                encounterData = await window.EncounterCache.load();
                if (window.DebugLogger) {
                    window.DebugLogger.info('조우 데이터 로드 완료 (캐시)', { 
                        encounterCount: encounterData?.encounters ? Object.keys(encounterData.encounters).length : 0 
                    });
                }
            } else {
                if (window.DebugLogger) {
                    window.DebugLogger.logAPIRequest('GET', `${API_BASE}/api/game/encounter-data`);
                }
                const requestStartTime = Date.now();
                const response = await fetch(`${API_BASE}/api/game/encounter-data`);
                const data = await response.json();
                const requestDuration = Date.now() - requestStartTime;
                
                if (window.DebugLogger) {
                    window.DebugLogger.logAPIResponse('GET', `${API_BASE}/api/game/encounter-data`, data, requestDuration);
                }
                
                if (data.success) {
                    encounterData = data.data;
                    if (window.DebugLogger) {
                        window.DebugLogger.info('조우 데이터 로드 완료 (서버)', { 
                            encounterCount: encounterData?.encounters ? Object.keys(encounterData.encounters).length : 0 
                        });
                    }
                }
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('조우 데이터 로드 실패', error);
            }
            console.error('조우 데이터 로드 실패:', error);
            throw error;
        } finally {
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('loadEncounterData', null, startTime);
            }
        }
    },

    async checkGameStart() {
        const startTime = Date.now();
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('checkGameStart');
        }
        
        const startSection = document.getElementById('start-section');
        const prologueSection = document.getElementById('prologue-section');
        const gameSection = document.getElementById('game-section');
        
        try {
            if (typeof window.StorageModule === 'undefined') {
                throw new Error('StorageModule이 로드되지 않았습니다.');
            }

            await window.StorageModule.initDB();
            const activeSlotId = await window.StorageModule.getActiveSlot();
            
            if (activeSlotId) {
                if (window.DebugLogger) window.DebugLogger.debug('활성 슬롯 발견', { activeSlotId });
                const gameData = await window.StorageModule.getSaveSlot(activeSlotId);
                
                if (gameData && gameData.current_state) {
                    if (window.DebugLogger) window.DebugLogger.info('기존 게임 발견, 게임 섹션 표시');
                    gameState = gameData.current_state;
                    currentDate = gameState.today_date;
                    
                    const subtitle = document.querySelector('.subtitle');
                    if (subtitle) {
                        const campaignYear = gameData.save_file_info?.campaign_year || 1925;
                        subtitle.textContent = `${campaignYear}년 아컴의 그림자`;
                    }
                    
                    startSection.style.display = 'none';
                    prologueSection.style.display = 'none';
                    gameSection.style.display = 'block';
                    await this.initializeMonthCalendar();
                    await this.initializeWeekCalendar();
                    this.updateUI();
                } else {
                    // 프롤로그 표시
                    if (gameData && gameData.campaign_history?.prologue) {
                        const prologueText = document.getElementById('prologue-text');
                        if (prologueText) {
                            prologueText.innerHTML = window.Utils.renderMarkdown(gameData.campaign_history.prologue.content);
                        }
                        startSection.style.display = 'none';
                        prologueSection.style.display = 'block';
                        gameSection.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('게임 시작 확인 실패', error);
                window.DebugLogger.logFunctionExit('checkGameStart', error, startTime);
            }
            console.error('게임 시작 확인 실패:', error);
            throw error;
        } finally {
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('checkGameStart', null, startTime);
            }
        }
    },

    updateUI() {
        if (!gameState) return;

        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('updateUI');
        }

        const currentDateElement = document.getElementById('current-date');
        if (currentDateElement) {
            currentDateElement.textContent = currentDate || '1925-01-01';
        }

        const madnessLevel = gameState.madness_tracker?.current_level || 0;
        const madnessLevelElement = document.getElementById('madness-level');
        if (madnessLevelElement) {
            madnessLevelElement.textContent = madnessLevel;
        }

        const weeklySuccess = gameState.weekly_progress?.success_count || 0;
        const weeklySuccessElement = document.getElementById('weekly-success');
        if (weeklySuccessElement) {
            weeklySuccessElement.textContent = weeklySuccess;
        }

        const madnessFill = document.getElementById('madness-fill');
        if (madnessFill) {
            const madnessPercent = Math.min((madnessLevel / 10) * 100, 100);
            madnessFill.style.width = `${madnessPercent}%`;
        }
        
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('updateUI');
        }
    },

    // 일기 태그 생성 함수
    async createStoryEntryTags(outcome, requiredSymbol, blackDiceSum, cthulhuCount) {
        const tagsContainer = document.getElementById('story-entry-tags');
        if (!tagsContainer) return;
        
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
        await window.Utils.loadActionIconSmall(actionIconContainer, requiredSymbol);
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
                await window.Utils.loadCthulhuIconSmall(cthulhuIconContainer);
                cthulhuTag.appendChild(cthulhuIconContainer);
                tagsContainer.appendChild(cthulhuTag);
            }
        }
    },

    // 검은 주사위 휠 피커 초기화
    initializeBlackDiceSlider() {
        const valueDisplay = document.getElementById('black-dice-sum-value');
        const itemsContainer = document.getElementById('wheel-picker-items');
        const wrapper = document.querySelector('.wheel-picker-wrapper');
        
        if (!valueDisplay || !itemsContainer || !wrapper) return;
        
        const min = 0;
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
        
        // 값 업데이트 함수
        const self = this;
        function updateValue(newValue, smooth = true) {
            const clampedValue = Math.max(min, Math.min(max, newValue));
            valueDisplay.value = clampedValue;
            updatePosition(clampedValue, smooth);
            valueDisplay.dispatchEvent(new Event('change', { bubbles: true }));
            // 주사위 값 변경 시 주간 달력 업데이트
            self.updateWeekCalendarByDiceValues();
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
    },

    // 크툴루 기호 버튼 초기화
    async initializeCthulhuButton() {
        const cthulhuButton = document.getElementById('cthulhu-count-btn');
        const cthulhuCountDisplay = document.getElementById('cthulhu-count-display');
        const cthulhuCountInput = document.getElementById('cthulhu-count');
        
        if (cthulhuButton && cthulhuCountDisplay && cthulhuCountInput) {
            // 크툴루 아이콘 로드
            const iconContainer = cthulhuButton.querySelector('.icon-container');
            if (iconContainer) {
                await window.Utils.loadCthulhuIcon(iconContainer);
            }
            
            // 초기 카운트 설정 (버튼의 data 속성에 저장)
            if (!cthulhuButton.dataset.currentCount) {
                cthulhuButton.dataset.currentCount = '0';
            }
            
            // 버튼 클릭 이벤트: 0 → 1 → 2 → 3 → 0 순환
            const self = this;
            cthulhuButton.addEventListener('click', () => {
                let currentCount = parseInt(cthulhuButton.dataset.currentCount || '0');
                currentCount = (currentCount + 1) % 4; // 0, 1, 2, 3 순환
                cthulhuButton.dataset.currentCount = currentCount.toString();
                cthulhuCountDisplay.textContent = currentCount;
                cthulhuCountInput.value = currentCount;
                // 주사위 값 변경 시 주간 달력 업데이트
                self.updateWeekCalendarByDiceValues();
            });
        }
    },

    // 크툴루 버튼 리셋 함수
    resetCthulhuButton() {
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
    },

    // 초록 주사위 아이콘 초기화
    async initializeGreenDiceIcons() {
        const iconButtons = document.querySelectorAll('.icon-button');
        
        const self = this;
        iconButtons.forEach(async (button) => {
            const symbol = button.dataset.symbol;
            const iconContainer = button.querySelector('.icon-container');
            
            // 아이콘 로드
            if (symbol === 'COMBAT') {
                await window.Utils.loadPistolIcon(iconContainer);
            } else if (symbol === 'INVESTIGATION') {
                await window.Utils.loadSearchIcon(iconContainer);
            } else if (symbol === 'SEARCH') {
                await window.Utils.loadFlashlightIcon(iconContainer);
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
                self.updateWeekCalendarByDiceValues();
            });
        });
    },

    // 월간 달력 초기화
    async initializeMonthCalendar() {
        if (!currentDate) {
            currentDate = '1925-01-01';
        }
        
        const dateObj = new Date(currentDate + 'T00:00:00');
        const monthGrid = document.getElementById('month-grid');
        if (!monthGrid) return;
        
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
        let madnessInfo = new Map();
        try {
            // IndexedDB에서 게임 데이터 가져오기
            let gameData = null;
            if (typeof window.StorageModule !== 'undefined') {
                await window.StorageModule.initDB();
                const activeSlotId = await window.StorageModule.getActiveSlot();
                if (activeSlotId) {
                    gameData = await window.StorageModule.getSaveSlot(activeSlotId);
                }
            }
            
            const monthResponse = await fetch(`${API_BASE}/api/narrative/month/${currentMonthName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_data: gameData
                })
            });
            const monthData = await monthResponse.json();
            if (monthData.success && monthData.entries) {
                monthData.entries.forEach(entry => {
                    const targetDate = entry.game_logic_snapshot?.target_date;
                    if (targetDate) {
                        if (entry.is_success) {
                            completedDates.add(targetDate);
                        }
                        if (entry.madness_triggered) {
                            madnessInfo.set(targetDate, entry.cthulhu_symbol_count || 0);
                        }
                    }
                });
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('완료된 날짜 확인 실패', error);
            }
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
        
        // 첫 주의 빈 칸 추가
        const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        for (let i = 0; i < daysToMonday; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'month-day-cell empty';
            monthGrid.appendChild(emptyCell);
        }
        
        // 날짜 셀 추가
        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(currentYear, currentMonth, day);
            const dateStr = window.Utils.formatDate(dayDate);
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
                difficulty = currentEncounter.base_difficulty || '';
                
                const iconSpan = document.createElement('span');
                iconSpan.className = 'action-icon';
                
                if (currentEncounter.required_action === 1) {
                    await window.Utils.loadPistolIcon(iconSpan);
                } else if (currentEncounter.required_action === 2) {
                    await window.Utils.loadSearchIcon(iconSpan);
                } else if (currentEncounter.required_action === 3) {
                    await window.Utils.loadFlashlightIcon(iconSpan);
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
            
            // 월간 달력은 클릭 불가능하게 설정
            dayCell.style.cursor = 'default';
            dayCell.style.pointerEvents = 'none';
            
            monthGrid.appendChild(dayCell);
        }
        
        // 현재 날짜 오버레이 추가
        async function addTodayDateOverlay() {
            let todayDateStr = null;
            
            if (gameState && gameState.today_date) {
                todayDateStr = gameState.today_date;
            } else {
                try {
                    const response = await fetch(`${API_BASE}/api/game/state`);
                    const data = await response.json();
                    if (data.success && data.game_state && data.game_state.today_date) {
                        todayDateStr = data.game_state.today_date;
                    }
                } catch (error) {
                    if (window.DebugLogger) {
                        window.DebugLogger.error('현재 날짜 가져오기 실패', error);
                    }
                    console.error('현재 날짜 가져오기 실패:', error);
                }
            }
            
            if (todayDateStr) {
                const todayCell = monthGrid.querySelector(`[data-date="${todayDateStr}"]`);
                
                if (todayCell) {
                    const overlayCell = document.createElement('div');
                    overlayCell.className = 'today-date-overlay';
                    overlayCell.dataset.date = todayDateStr;
                    
                    todayCell.style.position = 'relative';
                    todayCell.appendChild(overlayCell);
                }
            }
        }
        
        await addTodayDateOverlay();
    },

    // 주간 달력 초기화
    async initializeWeekCalendar() {
        if (!currentDate) {
            currentDate = '1925-01-01';
        }
        
        const dateObj = new Date(currentDate + 'T00:00:00');
        const weekGrid = document.getElementById('week-grid');
        if (!weekGrid) return;
        
        weekGrid.innerHTML = '';
        
        // 현재 월 추출
        const currentYear = dateObj.getFullYear();
        const currentMonth = dateObj.getMonth();
        
        // 성공한 날짜 목록 가져오기
        let completedDates = new Set();
        try {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December'];
            const currentMonthName = monthNames[currentMonth];
            
            // IndexedDB에서 게임 데이터 가져오기
            let gameData = null;
            if (typeof window.StorageModule !== 'undefined') {
                await window.StorageModule.initDB();
                const activeSlotId = await window.StorageModule.getActiveSlot();
                if (activeSlotId) {
                    gameData = await window.StorageModule.getSaveSlot(activeSlotId);
                }
            }
            
            const monthResponse = await fetch(`${API_BASE}/api/narrative/month/${currentMonthName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_data: gameData
                })
            });
            const monthData = await monthResponse.json();
            if (monthData.success && monthData.entries) {
                monthData.entries.forEach(entry => {
                    if (entry.is_success) {
                        const targetDate = entry.game_logic_snapshot?.target_date;
                        if (targetDate) {
                            completedDates.add(targetDate);
                        }
                    }
                });
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('성공한 날짜 확인 실패', error);
            }
            console.error('성공한 날짜 확인 실패:', error);
        }
        
        const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
        const weekStart = new Date(dateObj);
        const dayOfWeek = dateObj.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        weekStart.setDate(dateObj.getDate() - daysToMonday);
        
        const isCurrentDateSunday = dayOfWeek === 0;
        const weeklySuccess = gameState?.weekly_progress?.success_count || 0;
        
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + i);
            
            const dayYear = dayDate.getFullYear();
            const dayMonth = dayDate.getMonth();
            const isCurrentMonth = (dayYear === currentYear && dayMonth === currentMonth);
            
            const dateStr = window.Utils.formatDate(dayDate);
            const isCompleted = completedDates.has(dateStr);
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
            const month = String(dayDate.getMonth() + 1).padStart(2, '0');
            const day = String(dayDate.getDate()).padStart(2, '0');
            const dateKey = `${month}-${day}`;
            
            // 조우 데이터에서 정보 가져오기
            let difficulty = '';
            let baseDifficulty = '';
            let currentEncounter = null;
            if (encounterData && encounterData.encounters && encounterData.encounters[dateKey]) {
                currentEncounter = encounterData.encounters[dateKey];
                baseDifficulty = currentEncounter.base_difficulty || '';
                
                if (isSunday) {
                    difficulty = Math.max(0, baseDifficulty - weeklySuccess);
                } else {
                    difficulty = baseDifficulty;
                }
                
                const iconSpan = document.createElement('span');
                iconSpan.className = 'action-icon';
                
                if (currentEncounter.required_action === 1) {
                    await window.Utils.loadPistolIcon(iconSpan);
                } else if (currentEncounter.required_action === 2) {
                    await window.Utils.loadSearchIcon(iconSpan);
                } else if (currentEncounter.required_action === 3) {
                    await window.Utils.loadFlashlightIcon(iconSpan);
                }
                
                const difficultySpan = document.createElement('span');
                difficultySpan.className = 'difficulty-value';
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
                    if (!isSunday) {
                        isSelectable = false;
                    }
                } else {
                    if (isSunday) {
                        isSelectable = false;
                    }
                }
            }
            
            // 모험 결과에 따라 선택 가능 여부 제한
            if (isSelectable && lastEncounterOutcome) {
                isSelectable = this.isEncounterSelectable(dayDate, currentEncounter, lastEncounterOutcome);
            }
            
            // 현재 주사위 값으로 성공 가능 여부 확인
            if (isSelectable && !lastEncounterOutcome && currentEncounter) {
                if (!isCurrentDateSunday && isSunday) {
                    isSelectable = false;
                } else {
                    isSelectable = this.canEncounterSucceed(currentEncounter, dayDate);
                }
            }
            
            if (isSelectable) {
                const clickHandler = () => this.selectDate(dayDate);
                dayCell.addEventListener('click', clickHandler);
                dayCell._clickHandler = clickHandler;
                dayCell.style.cursor = 'pointer';
                dayCell.classList.remove('disabled-by-dice');
            } else {
                dayCell.style.cursor = 'not-allowed';
                if (!isCurrentMonth) {
                    dayCell.style.opacity = '0.5';
                } else if (!isCompleted) {
                    if (lastEncounterOutcome) {
                        dayCell.style.opacity = '0.4';
                        dayCell.classList.add('disabled-by-outcome');
                    } else {
                        dayCell.style.opacity = '0.4';
                        dayCell.classList.add('disabled-by-dice');
                    }
                }
            }
            
            weekGrid.appendChild(dayCell);
        }
    },

    // 선택된 날짜 초기화
    clearSelectedDate() {
        document.querySelectorAll('.day-cell, .month-day-cell').forEach(c => {
            c.classList.remove('selected');
        });
        
        const hiddenDateInput = document.getElementById('target-date-hidden');
        if (hiddenDateInput) {
            hiddenDateInput.value = '';
        }
        
        const visualDescriptionInput = document.getElementById('visual-description');
        if (visualDescriptionInput) {
            visualDescriptionInput.value = '';
        }
        const requiredSymbolSelect = document.getElementById('required-symbol');
        if (requiredSymbolSelect) {
            requiredSymbolSelect.value = 'COMBAT';
        }
        const baseDifficultyInput = document.getElementById('base-difficulty');
        if (baseDifficultyInput) {
            baseDifficultyInput.value = '10';
        }
    },

    // 날짜 선택
    selectDate(date) {
        const dateStr = window.Utils.formatDate(date);
        
        const weekCell = document.querySelector(`.week-grid [data-date="${dateStr}"]`);
        const monthCell = document.querySelector(`.month-grid [data-date="${dateStr}"]`);
        
        if ((weekCell && weekCell.classList.contains('completed')) || 
            (monthCell && monthCell.classList.contains('completed'))) {
            return;
        }
        
        if (weekCell && weekCell.classList.contains('other-month')) {
            return;
        }
        
        document.querySelectorAll('.day-cell, .month-day-cell').forEach(c => {
            c.classList.remove('selected');
        });
        
        if (weekCell) {
            weekCell.classList.add('selected');
        }
        if (monthCell) {
            monthCell.classList.add('selected');
        }
        
        const hiddenDateInput = document.getElementById('target-date-hidden');
        if (hiddenDateInput) {
            hiddenDateInput.value = dateStr;
        }
        
        this.fillEncounterData(date);
    },

    // 조우 데이터 자동 채우기
    fillEncounterData(date) {
        if (!encounterData || !encounterData.encounters) {
            if (window.DebugLogger) {
                window.DebugLogger.warn('조우 데이터가 로드되지 않았습니다.');
            }
            console.warn('조우 데이터가 로드되지 않았습니다.');
            return;
        }
        
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateKey = `${month}-${day}`;
        
        const encounter = encounterData.encounters[dateKey];
        if (!encounter) {
            if (window.DebugLogger) {
                window.DebugLogger.warn(`날짜 ${dateKey}에 대한 조우 데이터가 없습니다.`);
            }
            console.warn(`날짜 ${dateKey}에 대한 조우 데이터가 없습니다.`);
            return;
        }
        
        const visualDescriptionInput = document.getElementById('visual-description');
        const requiredSymbolSelect = document.getElementById('required-symbol');
        const baseDifficultyInput = document.getElementById('base-difficulty');
        
        if (visualDescriptionInput) {
            visualDescriptionInput.value = encounter.visual_description;
        }
        
        if (requiredSymbolSelect) {
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
    },

    // 현재 주사위 값으로 조우 성공 가능 여부 계산
    canEncounterSucceed(encounter, dayDate) {
        if (!encounter) {
            return false;
        }
        
        const blackDiceSum = parseInt(document.getElementById('black-dice-sum-value')?.value) || 10;
        const greenDiceSymbols = [];
        document.querySelectorAll('.icon-button.selected').forEach(button => {
            greenDiceSymbols.push(button.dataset.symbol);
        });
        
        if (greenDiceSymbols.length === 0) {
            return false;
        }
        
        const encounterActionMap = {
            1: 'COMBAT',
            2: 'INVESTIGATION',
            3: 'SEARCH'
        };
        const requiredSymbol = encounterActionMap[encounter.required_action];
        
        const symbolMatch = greenDiceSymbols.includes(requiredSymbol);
        if (!symbolMatch) {
            return false;
        }
        
        let effectiveDifficulty = encounter.base_difficulty || 10;
        
        const dayOfWeek = dayDate.getDay();
        if (dayOfWeek === 0) {
            const weeklySuccess = gameState?.weekly_progress?.success_count || 0;
            effectiveDifficulty = Math.max(0, effectiveDifficulty - weeklySuccess);
        }
        
        const numberMatch = blackDiceSum >= effectiveDifficulty;
        
        return numberMatch;
    },

    // 조우 선택 가능 여부 판단 (모험 결과 기반)
    isEncounterSelectable(dayDate, encounter, lastOutcome) {
        if (!encounter || !lastOutcome) {
            return true;
        }
        
        const dateStr = window.Utils.formatDate(dayDate);
        
        if (dateStr === lastOutcome.target_date) {
            return false;
        }
        
        const encounterActionMap = {
            1: 'COMBAT',
            2: 'INVESTIGATION',
            3: 'SEARCH'
        };
        
        const encounterAction = encounterActionMap[encounter.required_action];
        const lastAction = lastOutcome.required_symbol;
        
        if (lastOutcome.is_success) {
            return encounterAction === lastAction;
        } else {
            return encounterAction !== lastAction;
        }
    },

    // 주간 달력의 선택 가능 여부 업데이트
    async updateWeekCalendarAvailability() {
        await this.initializeWeekCalendar();
    },

    // 주사위 값 변경에 따른 주간 달력 업데이트
    updateWeekCalendarByDiceValues() {
        this.clearSelectedDate();
        
        const weekGrid = document.getElementById('week-grid');
        if (!weekGrid) return;
        
        if (!currentDate) {
            currentDate = '1925-01-01';
        }
        const currentDateObj = new Date(currentDate + 'T00:00:00');
        const isCurrentDateSunday = currentDateObj.getDay() === 0;
        
        const dayCells = weekGrid.querySelectorAll('.day-cell');
        const self = this;
        dayCells.forEach(dayCell => {
            if (dayCell.classList.contains('completed') || 
                dayCell.classList.contains('other-month')) {
                return;
            }
            
            if (dayCell.classList.contains('disabled-by-outcome')) {
                return;
            }
            
            const dateStr = dayCell.dataset.date;
            if (!dateStr) return;
            
            const dayDate = new Date(dateStr + 'T00:00:00');
            const isSunday = dayDate.getDay() === 0;
            
            if (isCurrentDateSunday) {
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
            
            const month = String(dayDate.getMonth() + 1).padStart(2, '0');
            const day = String(dayDate.getDate()).padStart(2, '0');
            const dateKey = `${month}-${day}`;
            
            let currentEncounter = null;
            if (encounterData && encounterData.encounters && encounterData.encounters[dateKey]) {
                currentEncounter = encounterData.encounters[dateKey];
            }
            
            if (!currentEncounter) return;
            
            const canSucceed = self.canEncounterSucceed(currentEncounter, dayDate);
            
            const existingClickHandler = dayCell._clickHandler;
            if (existingClickHandler) {
                dayCell.removeEventListener('click', existingClickHandler);
            }
            
            if (canSucceed) {
                const clickHandler = () => self.selectDate(dayDate);
                dayCell.addEventListener('click', clickHandler);
                dayCell._clickHandler = clickHandler;
                dayCell.style.cursor = 'pointer';
                dayCell.style.opacity = '1';
                dayCell.classList.remove('disabled-by-dice');
            } else {
                dayCell.style.cursor = 'not-allowed';
                dayCell.style.opacity = '0.4';
                dayCell.classList.add('disabled-by-dice');
            }
        });
    },

    // '전문 읽기' 버튼 업데이트
    updateReadFullButton() {
        const storySummary = document.getElementById('story-summary');
        const storySection = document.getElementById('story-section');
        
        if (!storySummary || !storySection) return;
        
        // 기존 버튼 제거
        const existingButton = document.getElementById('read-full-btn');
        if (existingButton) {
            existingButton.remove();
        }
        
        // story-summary에 내용이 있는지 확인
        const summaryText = storySummary.textContent?.trim() || '';
        const summaryHTML = storySummary.innerHTML?.trim() || '';
        const hasContent = summaryText.length > 0 || (summaryHTML.length > 0 && summaryHTML !== '<p></p>');
        
        if (hasContent) {
            // '전문 읽기' 버튼 생성
            const readFullBtn = document.createElement('button');
            readFullBtn.id = 'read-full-btn';
            readFullBtn.className = 'btn btn-primary';
            readFullBtn.textContent = '전문 읽기';
            readFullBtn.style.marginTop = '20px';
            
            // 버튼 클릭 시 일기장 페이지로 이동
            readFullBtn.addEventListener('click', () => {
                if (window.Router) {
                    window.Router.navigate('diary');
                }
            });
            
            // story-section에 버튼 추가
            storySection.appendChild(readFullBtn);
        }
    },

    setupEventListeners() {
        const startGameBtn = document.getElementById('start-game-btn');
        if (startGameBtn) {
            const self = this;
            startGameBtn.addEventListener('click', async () => {
                const startSection = document.getElementById('start-section');
                const prologueSection = document.getElementById('prologue-section');
                const gameSection = document.getElementById('game-section');
                
                startSection.style.display = 'none';
                prologueSection.style.display = 'none';
                gameSection.style.display = 'block';
                
                await self.initializeMonthCalendar();
                await self.initializeWeekCalendar();
            });
        }

        const rollDiceBtn = document.getElementById('roll-dice-btn');
        if (rollDiceBtn) {
            const self = this;
            rollDiceBtn.addEventListener('click', async () => {
                await self.processEncounter();
            });
        }
    },

    // 조우 처리
    async processEncounter() {
        const startTime = Date.now();
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('processEncounter');
        }
        
        const targetDateInput = document.getElementById('target-date-hidden');
        let targetDate = targetDateInput?.value;
        let isForcedFailure = false;
        
        if (!targetDate) {
            const confirmMessage = '선택된 조우가 없습니다. \n실패로 기록하시겠습니까?';
            if (!confirm(confirmMessage)) {
                return;
            }
            if (gameState && gameState.today_date) {
                targetDate = gameState.today_date;
                isForcedFailure = true;
            } else {
                alert('게임 상태를 불러올 수 없습니다.');
                return;
            }
        }
        
        const visualDescription = document.getElementById('visual-description')?.value || '선택되지 않은 조우';
        const requiredSymbol = document.getElementById('required-symbol')?.value || 'COMBAT';
        const baseDifficulty = parseInt(document.getElementById('base-difficulty')?.value) || 10;
        const blackDiceSum = parseInt(document.getElementById('black-dice-sum-value')?.value) || 0;
        const cthulhuCount = parseInt(document.getElementById('cthulhu-count')?.value) || 0;
        
        const greenDiceSymbols = [];
        document.querySelectorAll('.icon-button.selected').forEach(button => {
            greenDiceSymbols.push(button.dataset.symbol);
        });
        
        if (!isForcedFailure && (!targetDate || !visualDescription || greenDiceSymbols.length === 0)) {
            alert('모든 필드를 입력해주세요.');
            return;
        }
        
        if (isForcedFailure && greenDiceSymbols.length === 0) {
            greenDiceSymbols.push('COMBAT');
        }
        
        let finalBlackDiceSum = blackDiceSum;
        let finalGreenDiceSymbols = [...greenDiceSymbols];
        
        if (isForcedFailure) {
            finalBlackDiceSum = 0;
        }
        
        let currentGameData = null;
        if (typeof window.StorageModule !== 'undefined') {
            await window.StorageModule.initDB();
            const activeSlotId = await window.StorageModule.getActiveSlot();
            if (activeSlotId) {
                currentGameData = await window.StorageModule.getSaveSlot(activeSlotId);
            }
        }

        if (!currentGameData) {
            if (window.DebugLogger) window.DebugLogger.error('게임 데이터를 불러올 수 없습니다');
            alert('게임 데이터를 불러올 수 없습니다. 게임을 다시 시작해주세요.');
            return;
        }

        const requestData = {
            target_date: targetDate,
            visual_description: visualDescription,
            required_symbol: requiredSymbol,
            base_difficulty: baseDifficulty,
            black_dice_sum: finalBlackDiceSum,
            green_dice_symbols: finalGreenDiceSymbols,
            cthulhu_symbol_count: cthulhuCount,
            is_forced_failure: isForcedFailure,
            game_data: currentGameData
        };
        
        const storySection = document.getElementById('story-section');
        if (storySection) {
            storySection.style.display = 'block';
        }
        const storyContent = document.getElementById('story-content');
        if (storyContent) {
            storyContent.style.display = 'block';
            storyContent.innerHTML = '<div class="loading">스토리를 생성하는 중...</div>';
        }
        const storySummary = document.getElementById('story-summary');
        if (storySummary) {
            storySummary.textContent = '';
            // story-summary가 비워지면 버튼도 제거
            this.updateReadFullButton();
        }
        
        try {
            if (window.DebugLogger) {
                window.DebugLogger.logAPIRequest('POST', `${API_BASE}/api/game/encounter`, requestData);
            }
            const requestStartTime = Date.now();
            const response = await fetch(`${API_BASE}/api/game/encounter`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            const data = await response.json();
            const requestDuration = Date.now() - requestStartTime;
            
            if (window.DebugLogger) {
                window.DebugLogger.logAPIResponse('POST', `${API_BASE}/api/game/encounter`, data, requestDuration);
            }
            
            if (data.success) {
                const outcome = data.outcome;
                await this.createStoryEntryTags(outcome, requiredSymbol, finalBlackDiceSum, cthulhuCount);
                
                if (storyContent) {
                    storyContent.style.display = 'none';
                }
                if (storySummary) {
                    storySummary.innerHTML = window.Utils.renderMarkdown(data.narrative.summary_line);
                    // story-summary에 내용이 있으면 '전문 읽기' 버튼 표시
                    this.updateReadFullButton();
                }
                
                if (data.updated_state) {
                    const oldMadnessLevel = gameState.madness_tracker?.current_level;
                    const oldWeeklySuccess = gameState.weekly_progress?.success_count;
                    
                    if (window.DebugLogger) {
                        window.DebugLogger.info('조우 처리 후 상태 업데이트', data.updated_state);
                    }
                    
                    if (!gameState.madness_tracker) {
                        gameState.madness_tracker = {};
                    }
                    if (!gameState.weekly_progress) {
                        gameState.weekly_progress = {};
                    }
                    gameState.madness_tracker.current_level = data.updated_state.madness_level;
                    gameState.weekly_progress.success_count = data.updated_state.weekly_success_count;
                    
                    if (window.DebugLogger) {
                        if (oldMadnessLevel !== data.updated_state.madness_level) {
                            window.DebugLogger.info('광기 수치 변경', {
                                old: oldMadnessLevel,
                                new: data.updated_state.madness_level
                            });
                        }
                        if (oldWeeklySuccess !== data.updated_state.weekly_success_count) {
                            window.DebugLogger.info('주간 성공 횟수 변경', {
                                old: oldWeeklySuccess,
                                new: data.updated_state.weekly_success_count
                            });
                        }
                    }
                    
                    this.updateUI();
                }
                
                this.resetCthulhuButton();
                
                if (data.game_data && typeof window.StorageModule !== 'undefined') {
                    await window.StorageModule.initDB();
                    const activeSlotId = await window.StorageModule.getActiveSlot();
                    if (activeSlotId) {
                        await window.StorageModule.autoSave(data.game_data, activeSlotId);
                        if (window.DebugLogger) window.DebugLogger.info('게임 데이터 저장 완료', { activeSlotId });
                    }
                }
                
                await this.loadGameState();
                
                if (outcome.is_success) {
                    if (storySection) {
                        storySection.style.borderColor = '#d4af37';
                    }
                    if (window.DebugLogger) window.DebugLogger.info('조우 성공');
                } else {
                    if (storySection) {
                        storySection.style.borderColor = '#8b0000';
                    }
                    if (window.DebugLogger) window.DebugLogger.info('조우 실패');
                }
                
                lastEncounterOutcome = {
                    is_success: outcome.is_success,
                    target_date: targetDate,
                    required_symbol: requiredSymbol,
                    green_dice_symbols: greenDiceSymbols
                };
                
                await this.updateWeekCalendarAvailability();
            } else {
                throw new Error('조우 처리 실패');
            }
        } catch (error) {
            if (window.DebugLogger) window.DebugLogger.error('조우 처리 오류', error);
            console.error('조우 처리 오류:', error);
            if (storyContent) {
                storyContent.style.display = 'block';
                storyContent.innerHTML = 
                    '<div class="error">스토리 생성 중 오류가 발생했습니다. 다시 시도해주세요.</div>';
            }
            if (storySummary) {
                storySummary.textContent = '';
                // 오류 발생 시에도 버튼 제거
                this.updateReadFullButton();
            }
        } finally {
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('processEncounter', null, startTime);
            }
        }
    },

    destroy() {
        // 정리 로직
        if (window.DebugLogger) {
            window.DebugLogger.info('Play 컴포넌트 정리');
        }
    }
};

// 라우터에 등록
if (window.Router) {
    window.Router.register('play', PlayComponent);
}

})(); // IIFE 종료
