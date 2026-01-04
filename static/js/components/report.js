// Report 페이지 컴포넌트 (보고서)

// IIFE로 감싸서 스코프 분리 (API_BASE 중복 선언 방지)
(function() {
    'use strict';
    
    // API_BASE는 전역 변수로 한 번만 선언
    if (typeof window.API_BASE === 'undefined') {
        window.API_BASE = '';
    }
    // window.API_BASE를 직접 사용하거나 로컬 변수로 참조
    const API_BASE = window.API_BASE || '';

let currentMonth = null;
const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'];
const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월',
                   '7월', '8월', '9월', '10월', '11월', '12월'];

const ReportComponent = {
    async init() {
        if (window.DebugLogger) {
            window.DebugLogger.info('Report 컴포넌트 초기화');
        }
        
        await this.loadCampaignYear();
    },

    render() {
        return `
            <div class="report-container">
                <div class="month-tabs" id="month-tabs"></div>
                <div id="statistics-section" class="statistics-section" style="display: none;">
                    <h2>월별 통계</h2>
                    <div class="stat-grid" id="stat-grid"></div>
                </div>
                <div id="calendar-section" class="statistics-section" style="display: none;">
                    <h2>월간 달력</h2>
                    <div class="calendar-month">
                        <div class="month-grid" id="month-grid"></div>
                    </div>
                </div>
                <div class="report-entries" id="report-entries">
                    <div class="loading">로딩 중...</div>
                </div>
            </div>
        `;
    },

    async mount() {
        await this.loadAllChapters();
    },

    async loadCampaignYear() {
        try {
            const response = await fetch(`${API_BASE}/api/game/state`);
            const data = await response.json();

            if (data.success) {
                const subtitle = document.querySelector('.subtitle');
                if (subtitle) {
                    const campaignYear = data.campaign_year || 1925;
                    subtitle.textContent = `${campaignYear}년의 조사 보고서`;
                }
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('캠페인 연도 로드 실패', error);
            }
            console.error('캠페인 연도 로드 실패:', error);
            throw error;
        }
    },

    async loadAllChapters() {
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
            
            const response = await fetch(`${API_BASE}/api/narrative/all-chapters`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_data: gameData
                })
            });
            const data = await response.json();
            
            if (data.success) {
                const monthTabs = document.getElementById('month-tabs');
                monthTabs.innerHTML = '';
                
                if (data.chapters.length === 0) {
                    document.getElementById('report-entries').innerHTML = 
                        '<div class="error">아직 작성된 일기가 없습니다.</div>';
                    return;
                }
                
                // 프롤로그와 일반 챕터 분리
                const prologueChapter = data.chapters.find(c => c.is_prologue);
                const regularChapters = data.chapters.filter(c => !c.is_prologue);
                
                // 일반 챕터를 역순으로 정렬 (최신월이 앞에 오도록)
                const sortedChapters = [...regularChapters].reverse();
                
                // 첫 번째 월을 기본으로 선택 (최신월)
                if (sortedChapters.length > 0) {
                    currentMonth = sortedChapters[0].month;
                }
                
                // 일반 챕터 탭 추가 (최신월부터)
                sortedChapters.forEach(chapter => {
                    const tab = document.createElement('div');
                    tab.className = 'month-tab';
                    tab.textContent = window.Utils.getMonthName(chapter.month);
                    tab.dataset.month = chapter.month;
                    
                    if (chapter.month === currentMonth) {
                        tab.classList.add('active');
                    }
                    
                    tab.addEventListener('click', () => this.loadMonth(chapter.month));
                    monthTabs.appendChild(tab);
                });
                
                // 가장 최신 월의 보고서를 먼저 표시
                if (sortedChapters.length > 0) {
                    await this.loadMonth(currentMonth);
                }
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('챕터 로드 실패', error);
            }
            console.error('챕터 로드 실패:', error);
            document.getElementById('report-entries').innerHTML = 
                '<div class="error">보고서를 불러오는 중 오류가 발생했습니다.</div>';
            throw error;
        }
    },

    async loadMonth(month) {
        currentMonth = month;
        
        // 탭 활성화
        document.querySelectorAll('.month-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.month === month);
        });
        
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
            
            const response = await fetch(`${API_BASE}/api/narrative/report/${month}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_data: gameData
                })
            });
            const data = await response.json();
            
            if (data.success) {
                // 통계 표시
                this.displayStatistics(data.statistics, data.campaign_year, month);
                
                // 달력 초기화
                await this.initializeMonthCalendar(month, data.campaign_year, data.entries);
                
                // 보고서 목록 숨김 (일일 정보는 표시하지 않음)
                const entriesDiv = document.getElementById('report-entries');
                entriesDiv.innerHTML = '';
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('월별 보고서 로드 실패', error);
            }
            console.error('월별 보고서 로드 실패:', error);
            document.getElementById('report-entries').innerHTML = 
                '<div class="error">보고서를 불러오는 중 오류가 발생했습니다.</div>';
            throw error;
        }
    },

    displayStatistics(stats, campaignYear, month) {
        const statSection = document.getElementById('statistics-section');
        const statGrid = document.getElementById('stat-grid');
        
        statGrid.innerHTML = '';
        
        const statItems = [
            { label: '이번달 점수', value: `${stats.monthly_score || 0}점` },
            { label: '전체 조우', value: `${stats.total_entries}건` },
            { label: '성공', value: `${stats.success_count}건 (${stats.success_rate}%)` },
            { label: '일요일 조우 성공', value: `${stats.sunday_success_count}/${stats.sunday_total_count} (${stats.sunday_success_rate}%)` },
            { label: '광기 발작 횟수', value: `${stats.madness_triggered_count}회` },
            { label: '전투 (권총)', value: `${stats.action_type_counts.COMBAT || 0}건` },
            { label: '조사 (돋보기)', value: `${stats.action_type_counts.INVESTIGATION || 0}건` },
            { label: '수색 (손전등)', value: `${stats.action_type_counts.SEARCH || 0}건` }
        ];
        
        statItems.forEach(item => {
            const statItem = document.createElement('div');
            statItem.className = 'stat-item';
            statItem.innerHTML = `
                <div class="stat-label">${item.label}</div>
                <div class="stat-value">${item.value}</div>
            `;
            statGrid.appendChild(statItem);
        });
        
        statSection.style.display = 'block';
    },

    async initializeMonthCalendar(monthName, campaignYear, entries) {
        const monthGrid = document.getElementById('month-grid');
        monthGrid.innerHTML = '';
        
        // 월 이름을 숫자로 변환
        const monthIndex = months.indexOf(monthName);
        if (monthIndex === -1) return;
        
        const currentYear = campaignYear;
        const currentMonth = monthIndex;
        
        // 완료된 날짜 목록 수집
        let completedDates = new Set();
        if (entries) {
            entries.forEach(entry => {
                if (entry.date && entry.prompt_info?.result?.judgment === '성공') {
                    completedDates.add(entry.date);
                }
            });
        }
        
        // 조우 데이터 로드
        let encounterData = null;
        try {
            const encounterResponse = await fetch(`${API_BASE}/api/game/encounter-data`);
            const encounterResult = await encounterResponse.json();
            if (encounterResult.success) {
                encounterData = encounterResult.data;
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('조우 데이터 로드 실패', error);
            }
            console.error('조우 데이터 로드 실패:', error);
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
                
                // 아이콘과 난이도를 슬래시로 구분하여 표시
                const iconSpan = document.createElement('span');
                iconSpan.className = 'action-icon';
                
                // 권총(COMBAT)인 경우 커스텀 SVG 사용
                if (currentEncounter.required_action === 1) {
                    await window.Utils.loadPistolIcon(iconSpan, 20);
                } else if (currentEncounter.required_action === 2) {
                    // 돋보기(INVESTIGATION)인 경우 커스텀 SVG 사용
                    await window.Utils.loadSearchIcon(iconSpan, 20);
                } else if (currentEncounter.required_action === 3) {
                    // 손전등(SEARCH)인 경우 커스텀 SVG 사용
                    await window.Utils.loadFlashlightIcon(iconSpan, 20);
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
            
            // 읽기 전용이므로 클릭 불가능하게 설정
            dayCell.style.cursor = 'default';
            dayCell.style.pointerEvents = 'none';
            
            monthGrid.appendChild(dayCell);
        }
        
        // 달력 섹션 표시
        document.getElementById('calendar-section').style.display = 'block';
    },

    destroy() {
        // 정리 로직
        if (window.DebugLogger) {
            window.DebugLogger.info('Report 컴포넌트 정리');
        }
    }
};

// 라우터에 등록
if (window.Router) {
    window.Router.register('report', ReportComponent);
}

})(); // IIFE 종료
