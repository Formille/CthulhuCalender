// Diary 페이지 컴포넌트 (일기장)

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

const DiaryComponent = {
    async init() {
        if (window.DebugLogger) {
            window.DebugLogger.info('Diary 컴포넌트 초기화');
        }
        
        // 캠페인 연도 로드
        await this.loadCampaignYear();
    },

    render() {
        return `
            <div class="diary-container">
                <div class="month-tabs" id="month-tabs"></div>
                <div id="chapter-summary" class="chapter-summary" style="display: none;"></div>
                <div id="month-conclusion-section" class="month-conclusion-section" style="display: none;">
                    <button id="conclusion-button" class="conclusion-button">월의 이야기 결산</button>
                    <div id="conclusion-result" class="conclusion-result" style="display: none;"></div>
                </div>
                <div class="diary-entries" id="diary-entries">
                    <div class="loading">로딩 중...</div>
                </div>
            </div>
        `;
    },

    async mount() {
        await this.loadAllChapters();
        this.setupConclusionButton();
    },

    async loadCampaignYear() {
        const startTime = Date.now();
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('loadCampaignYear');
        }
        
        try {
            // StorageModule에서 게임 데이터 가져오기
            if (typeof window.StorageModule === 'undefined') {
                throw new Error('StorageModule이 로드되지 않았습니다.');
            }

            await window.StorageModule.initDB();
            const activeSlotId = await window.StorageModule.getActiveSlot();
            
            let campaignYear = 1925; // 기본값
            
            if (activeSlotId) {
                const gameData = await window.StorageModule.getSaveSlot(activeSlotId);
                if (gameData && gameData.save_file_info) {
                    campaignYear = gameData.save_file_info.campaign_year || 1925;
                }
            }

            const subtitle = document.querySelector('.subtitle');
            if (subtitle) {
                subtitle.textContent = `${campaignYear}년의 기록`;
                if (window.DebugLogger) window.DebugLogger.info('캠페인 연도 로드 완료', { campaignYear });
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('캠페인 연도 로드 실패', error);
            }
            console.error('캠페인 연도 로드 실패:', error);
            // 오류가 발생해도 기본값 사용
            const subtitle = document.querySelector('.subtitle');
            if (subtitle) {
                subtitle.textContent = '1925년의 기록';
            }
        } finally {
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('loadCampaignYear', null, startTime);
            }
        }
    },

    async loadAllChapters() {
        const startTime = Date.now();
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('loadAllChapters');
            window.DebugLogger.logAPIRequest('POST', `${API_BASE}/api/narrative/all-chapters`);
        }
        
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
            
            const requestStartTime = Date.now();
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
            const requestDuration = Date.now() - requestStartTime;
            
            if (window.DebugLogger) {
                window.DebugLogger.logAPIResponse('POST', `${API_BASE}/api/narrative/all-chapters`, data, requestDuration);
            }
            
            if (data.success) {
                if (window.DebugLogger) window.DebugLogger.info('챕터 로드 완료', { chapterCount: data.chapters?.length || 0 });
                const monthTabs = document.getElementById('month-tabs');
                monthTabs.innerHTML = '';
                
                if (data.chapters.length === 0) {
                    if (window.DebugLogger) window.DebugLogger.info('작성된 일기 없음');
                    document.getElementById('diary-entries').innerHTML = 
                        '<div class="error">아직 작성된 일기가 없습니다.</div>';
                    return;
                }
                
                // 프롤로그와 일반 챕터 분리
                const prologueChapter = data.chapters.find(c => c.is_prologue);
                const regularChapters = data.chapters.filter(c => !c.is_prologue);
                
                // 일반 챕터를 역순으로 정렬 (최신월이 앞에 오도록)
                const sortedChapters = [...regularChapters].reverse();
                
                // 첫 번째 월을 기본으로 선택 (최신월 또는 프롤로그)
                if (sortedChapters.length > 0) {
                    currentMonth = sortedChapters[0].month;
                } else if (prologueChapter) {
                    currentMonth = 'Prologue';
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
                
                // 프롤로그 탭 추가 (맨 오른쪽)
                if (prologueChapter) {
                    const tab = document.createElement('div');
                    tab.className = 'month-tab';
                    tab.textContent = '프롤로그';
                    tab.dataset.month = 'Prologue';
                    
                    if (currentMonth === 'Prologue') {
                        tab.classList.add('active');
                    }
                    
                    tab.addEventListener('click', () => this.loadPrologue());
                    monthTabs.appendChild(tab);
                }
                
                // 가장 최신 월의 일기를 먼저 표시
                if (sortedChapters.length > 0) {
                    await this.loadMonth(currentMonth);
                } else if (prologueChapter) {
                    currentMonth = 'Prologue';
                    await this.loadPrologue();
                }
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('챕터 로드 실패', error);
            }
            console.error('챕터 로드 실패:', error);
            document.getElementById('diary-entries').innerHTML = 
                '<div class="error">일기를 불러오는 중 오류가 발생했습니다.</div>';
            throw error;
        } finally {
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('loadAllChapters', null, startTime);
            }
        }
    },

    async loadMonth(month) {
        currentMonth = month;
        
        // 탭 활성화
        document.querySelectorAll('.month-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.month === month);
        });
        
        // 결산 섹션 숨기기
        document.getElementById('month-conclusion-section').style.display = 'none';
        document.getElementById('conclusion-result').style.display = 'none';
        
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
            
            const response = await fetch(`${API_BASE}/api/narrative/month/${month}`, {
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
                // 챕터 요약 숨기기
                const summaryDiv = document.getElementById('chapter-summary');
                summaryDiv.style.display = 'none';
                
                // 완료 상태 확인
                let isCompleted = false;
                try {
                    const completionResponse = await fetch(`${API_BASE}/api/narrative/month/${month}/completion-status`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            game_data: gameData
                        })
                    });
                    const completionData = await completionResponse.json();
                    isCompleted = completionData.success && completionData.is_completed;
                    
                    if (isCompleted) {
                        // 완료된 경우 결산 버튼 표시 (결산이 없을 때만)
                        if (!data.chapter_summary) {
                            const conclusionSection = document.getElementById('month-conclusion-section');
                            const conclusionButton = document.getElementById('conclusion-button');
                            conclusionButton.textContent = `${window.Utils.getMonthName(month)}의 이야기 결산`;
                            conclusionButton.dataset.month = month;
                            conclusionSection.style.display = 'block';
                        }
                    }
                } catch (error) {
                    if (window.DebugLogger) {
                        window.DebugLogger.error('완료 상태 확인 실패', error);
                    }
                    console.error('완료 상태 확인 실패:', error);
                }
                
                // 일기 목록 표시
                const entriesDiv = document.getElementById('diary-entries');
                entriesDiv.innerHTML = '';
                
                // 결산이 있으면 일기 엔트리 스타일로 표시
                if (data.chapter_summary) {
                    const conclusionEntry = document.createElement('div');
                    conclusionEntry.className = 'diary-entry';
                    
                    const header = document.createElement('div');
                    header.className = 'entry-header';
                    
                    const dateSpan = document.createElement('div');
                    dateSpan.className = 'entry-date';
                    dateSpan.textContent = `${window.Utils.getMonthName(month)}의 이야기 결산`;
                    header.appendChild(dateSpan);
                    
                    const tagsDiv = document.createElement('div');
                    tagsDiv.className = 'entry-tags';
                    const conclusionTag = document.createElement('span');
                    conclusionTag.className = 'tag';
                    conclusionTag.textContent = '결산';
                    tagsDiv.appendChild(conclusionTag);
                    header.appendChild(tagsDiv);
                    
                    const content = document.createElement('div');
                    content.className = 'entry-content';
                    content.innerHTML = window.Utils.renderMarkdown(data.chapter_summary);
                    
                    conclusionEntry.appendChild(header);
                    conclusionEntry.appendChild(content);
                    entriesDiv.appendChild(conclusionEntry);
                }
                
                if (data.entries.length === 0) {
                    if (!data.chapter_summary) {
                        entriesDiv.innerHTML = '<div class="error">이 달에는 작성된 일기가 없습니다.</div>';
                    }
                    return;
                }
                
                // 일기를 날짜 기준 역순으로 정렬 (최신 일기가 위에 오도록)
                const sortedEntries = [...data.entries].sort((a, b) => {
                    const dateA = new Date(a.diary_write_date);
                    const dateB = new Date(b.diary_write_date);
                    return dateB - dateA;
                });
                
                sortedEntries.forEach(entry => {
                    const entryDiv = document.createElement('div');
                    entryDiv.className = 'diary-entry';
                    
                    const header = document.createElement('div');
                    header.className = 'entry-header';
                    
                    const dateSpan = document.createElement('div');
                    dateSpan.className = 'entry-date';
                    dateSpan.textContent = `${entry.diary_write_date} (${entry.day_of_week})`;
                    
                    const tagsDiv = document.createElement('div');
                    tagsDiv.className = 'entry-tags';
                    
                    // 성공/실패 태그
                    const successTag = document.createElement('span');
                    successTag.className = `tag ${entry.is_success ? 'success' : 'failure'}`;
                    successTag.textContent = entry.is_success ? '성공' : '실패';
                    tagsDiv.appendChild(successTag);
                    
                    // 조우 유형 아이콘 태그
                    if (entry.action_type) {
                        const actionTag = document.createElement('span');
                        actionTag.className = 'tag';
                        const actionIconContainer = document.createElement('span');
                        actionIconContainer.className = 'tag-icon';
                        window.Utils.loadActionIconSmall(actionIconContainer, entry.action_type);
                        actionTag.appendChild(actionIconContainer);
                        tagsDiv.appendChild(actionTag);
                    }
                    
                    // 주사위 수 태그
                    if (entry.dice_sum !== undefined && entry.dice_sum > 0) {
                        const diceTag = document.createElement('span');
                        diceTag.className = 'tag';
                        diceTag.textContent = `${entry.dice_sum}`;
                        tagsDiv.appendChild(diceTag);
                    }
                    
                    // 광기 수만큼 크툴루 아이콘 표시
                    if (entry.cthulhu_symbol_count && entry.cthulhu_symbol_count > 0) {
                        for (let i = 0; i < entry.cthulhu_symbol_count; i++) {
                            const cthulhuTag = document.createElement('span');
                            cthulhuTag.className = 'tag cthulhu-tag';
                            const cthulhuIconContainer = document.createElement('span');
                            cthulhuIconContainer.className = 'cthulhu-icon-small';
                            window.Utils.loadCthulhuIconSmall(cthulhuIconContainer);
                            cthulhuTag.appendChild(cthulhuIconContainer);
                            tagsDiv.appendChild(cthulhuTag);
                        }
                    }
                    
                    header.appendChild(dateSpan);
                    header.appendChild(tagsDiv);
                    
                    const content = document.createElement('div');
                    content.className = 'entry-content';
                    const markdownText = entry.full_text || entry.summary || '(내용 없음)';
                    content.innerHTML = window.Utils.renderMarkdown(markdownText);
                    
                    entryDiv.appendChild(header);
                    entryDiv.appendChild(content);
                    
                    entriesDiv.appendChild(entryDiv);
                });
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('월별 일기 로드 실패', error);
            }
            console.error('월별 일기 로드 실패:', error);
            document.getElementById('diary-entries').innerHTML = 
                '<div class="error">일기를 불러오는 중 오류가 발생했습니다.</div>';
            throw error;
        }
    },

    async loadPrologue() {
        const startTime = Date.now();
        currentMonth = 'Prologue';
        
        // 탭 활성화
        document.querySelectorAll('.month-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.month === 'Prologue');
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
            
            const response = await fetch(`${API_BASE}/api/narrative/prologue`, {
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
                // 챕터 요약 숨기기
                document.getElementById('chapter-summary').style.display = 'none';
                
                // 일기 목록 표시
                const entriesDiv = document.getElementById('diary-entries');
                entriesDiv.innerHTML = '';
                
                const entryDiv = document.createElement('div');
                entryDiv.className = 'diary-entry';
                
                const header = document.createElement('div');
                header.className = 'entry-header';
                
                const dateSpan = document.createElement('div');
                dateSpan.className = 'entry-date';
                dateSpan.textContent = `프롤로그 - ${data.prologue.date}`;
                
                header.appendChild(dateSpan);
                
                const content = document.createElement('div');
                content.className = 'entry-content';
                content.innerHTML = window.Utils.renderMarkdown(data.prologue.content);
                
                entryDiv.appendChild(header);
                entryDiv.appendChild(content);
                
                entriesDiv.appendChild(entryDiv);
                
                if (window.DebugLogger) window.DebugLogger.info('프롤로그 로드 완료');
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('프롤로그 로드 실패', error);
            }
            console.error('프롤로그 로드 실패:', error);
            document.getElementById('diary-entries').innerHTML = 
                '<div class="error">프롤로그를 불러오는 중 오류가 발생했습니다.</div>';
            throw error;
        } finally {
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('loadPrologue', null, startTime);
            }
        }
    },

    setupConclusionButton() {
        const conclusionButton = document.getElementById('conclusion-button');
        if (conclusionButton) {
            conclusionButton.addEventListener('click', async function() {
                const month = this.dataset.month;
                if (!month) return;
                
                // 버튼 비활성화
                this.disabled = true;
                this.textContent = '결산 생성 중...';
                
                try {
                    const response = await fetch(`${API_BASE}/api/game/month-conclusion`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ month: month })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        if (window.DebugLogger) window.DebugLogger.info('결산 생성 완료', { month });
                        // 결산 버튼 숨기기
                        document.getElementById('month-conclusion-section').style.display = 'none';
                        
                        // 페이지 새로고침하여 결산 결과를 일기 엔트리로 표시
                        await DiaryComponent.loadMonth(month);
                    } else {
                        if (window.DebugLogger) {
                            window.DebugLogger.error('결산 생성 실패', { month, detail: data.detail });
                        }
                        alert('결산 생성에 실패했습니다.');
                        this.disabled = false;
                        this.textContent = `${window.Utils.getMonthName(month)}의 이야기 결산`;
                    }
                } catch (error) {
                    if (window.DebugLogger) {
                        window.DebugLogger.error('결산 생성 실패', error);
                    }
                    console.error('결산 생성 실패:', error);
                    alert('결산 생성 중 오류가 발생했습니다.');
                    this.disabled = false;
                    this.textContent = `${window.Utils.getMonthName(month)}의 이야기 결산`;
                }
            });
        }
    },

    destroy() {
        // 정리 로직
        if (window.DebugLogger) {
            window.DebugLogger.info('Diary 컴포넌트 정리');
        }
    }
};

// 라우터에 등록
if (window.Router) {
    window.Router.register('diary', DiaryComponent);
}

})(); // IIFE 종료
