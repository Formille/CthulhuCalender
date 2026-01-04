// Landing 페이지 컴포넌트

const LandingComponent = {
    _eventListeners: [], // 이벤트 리스너 추적용

    async init() {
        if (window.DebugLogger) {
            window.DebugLogger.info('Landing 컴포넌트 초기화');
        }
    },

    render() {
        return `
            <div class="landing-container">
                <header class="landing-header">
                    <h1>365 어드벤처: 크툴루</h1>
                    <p class="subtitle">러브크래프트의 공포 세계로 떠나는 <br> 1년의 기록</p>
                    <nav class="main-nav">
                        <a href="#" class="nav-link active" data-route="landing">홈</a>
                        <a href="#" class="nav-link" data-route="play">기록하기</a>
                        <a href="#" class="nav-link" data-route="diary">일기장</a>
                        <a href="#" class="nav-link" data-route="report">보고서</a>
                    </nav>
                </header>

                <div id="main-selection" class="landing-options">
                    <div class="option-card" id="new-game-card">
                        <h2>🆕 새로 시작하기</h2>
                        <p>새로운 모험을 시작합니다. 1925년 아캄의 이야기가 펼쳐집니다.</p>
                    </div>
                    <div class="option-card" id="load-game-card">
                        <h2>📂 불러오기</h2>
                        <p>이전에 저장한 게임을 불러옵니다.</p>
                    </div>
                </div>

                <div id="loading" class="loading">
                    <p>프롤로그를 생성하는 중...</p>
                    <div class="spinner"></div>
                </div>

                <!-- 슬롯 선택 모달 -->
                <div id="slot-selection-modal" class="modal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>저장된 게임 불러오기</h2>
                            <button class="modal-close" id="close-slot-modal">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div id="slot-list" class="slot-list">
                                <!-- 슬롯 목록이 여기에 동적으로 추가됨 -->
                            </div>
                            <div id="no-slots-message" class="no-slots" style="display: none;">
                                <p>저장된 게임이 없습니다.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async mount() {
        const mainSelection = document.getElementById('main-selection');
        const loading = document.getElementById('loading');
        const newGameCard = document.getElementById('new-game-card');
        const loadGameCard = document.getElementById('load-game-card');

        if (!mainSelection || !loading || !newGameCard || !loadGameCard) {
            const error = new Error('Landing 컴포넌트 필수 요소를 찾을 수 없습니다.');
            if (window.DebugLogger) {
                window.DebugLogger.error('Landing 컴포넌트 마운트 실패', error);
            }
            throw error;
        }

        // 기존 이벤트 리스너 제거
        this._eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this._eventListeners = [];

        // 새로 시작하기 클릭 - 바로 게임 시작 (연도 선택 없음)
        const newGameHandler = async () => {
            if (window.DebugLogger) window.DebugLogger.info('새로 시작하기 클릭');
            
            mainSelection.style.display = 'none';
            loading.classList.add('active');

            try {
                if (window.DebugLogger) {
                    window.DebugLogger.logAPIRequest('POST', '/api/game/start', {});
                }
                
                const requestStartTime = Date.now();
                const response = await fetch('/api/game/start', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        player_name: 'John Miller'
                    })
                });

                const data = await response.json();
                const requestDuration = Date.now() - requestStartTime;
                
                if (window.DebugLogger) {
                    window.DebugLogger.logAPIResponse('POST', '/api/game/start', data, requestDuration);
                }

                if (data.success && data.game_data) {
                    // 게임 데이터를 Dexie에 저장 (프롤로그 포함)
                    try {
                        if (typeof window.StorageModule === 'undefined') {
                            throw new Error('StorageModule이 로드되지 않았습니다.');
                        }
                        
                        await window.StorageModule.initDB();
                        const slotId = await window.StorageModule.createSaveSlot(data.game_data);
                        await window.StorageModule.setActiveSlot(slotId);
                        
                        if (window.DebugLogger) {
                            window.DebugLogger.info('게임 데이터 저장 완료 (프롤로그 포함)', { slotId, campaign_year: data.campaign_year });
                        }
                        
                        // 상태 업데이트 후 일기장으로 이동
                        await window.AppState.loadGameState();
                        loading.classList.remove('active');
                        window.Router.navigate('diary');
                    } catch (saveError) {
                        if (window.DebugLogger) {
                            window.DebugLogger.error('게임 데이터 저장 실패', saveError);
                        }
                        throw saveError;
                    }
                } else {
                    const error = new Error(data.detail || '알 수 없는 오류');
                    if (window.DebugLogger) {
                        window.DebugLogger.error('게임 시작 실패', { detail: data.detail });
                    }
                    throw error;
                }
            } catch (error) {
                if (window.DebugLogger) {
                    window.DebugLogger.error('게임 시작 실패', error);
                }
                console.error('게임 시작 실패:', error);
                alert('게임 시작에 실패했습니다: ' + error.message);
                loading.classList.remove('active');
                mainSelection.style.display = 'flex';
            }
        };
        newGameCard.addEventListener('click', newGameHandler);
        this._eventListeners.push({ element: newGameCard, event: 'click', handler: newGameHandler });

        // 불러오기 클릭
        const loadGameHandler = async () => {
            if (window.DebugLogger) window.DebugLogger.info('불러오기 클릭');
            
            try {
                if (typeof window.StorageModule === 'undefined') {
                    throw new Error('StorageModule이 로드되지 않았습니다.');
                }

                await window.StorageModule.initDB();
                
                // 모든 슬롯 목록 조회
                const slots = await window.StorageModule.listSaveSlots();
                
                if (!slots || slots.length === 0) {
                    if (window.DebugLogger) window.DebugLogger.warn('저장된 게임 없음');
                    alert('저장된 게임이 없습니다. 새로 시작해주세요.');
                    return;
                }

                // 슬롯 선택 모달 표시
                this.showSlotSelectionModal(slots);
            } catch (error) {
                if (window.DebugLogger) {
                    window.DebugLogger.error('게임 불러오기 실패', error);
                }
                console.error('게임 불러오기 실패:', error);
                alert('게임을 불러오는데 실패했습니다: ' + error.message);
            }
        };
        loadGameCard.addEventListener('click', loadGameHandler);
        this._eventListeners.push({ element: loadGameCard, event: 'click', handler: loadGameHandler });
    },

    // 슬롯 선택 모달 표시 메서드
    showSlotSelectionModal(slots) {
        const modal = document.getElementById('slot-selection-modal');
        const slotList = document.getElementById('slot-list');
        const noSlotsMessage = document.getElementById('no-slots-message');
        
        if (!modal || !slotList) return;
        
        // 기존 목록 초기화
        slotList.innerHTML = '';
        
        if (slots.length === 0) {
            noSlotsMessage.style.display = 'block';
            slotList.style.display = 'none';
        } else {
            noSlotsMessage.style.display = 'none';
            slotList.style.display = 'block';
            
            // 각 슬롯을 카드로 표시
            slots.forEach((slot) => {
                const slotCard = document.createElement('div');
                slotCard.className = 'slot-card';
                
                const savedDate = slot.savedAt ? new Date(slot.savedAt).toLocaleString('ko-KR') : '알 수 없음';
                const playerName = slot.playerName || 'John Miller';
                const campaignYear = slot.campaignYear || 1925;
                
                // 최신 일기 날짜 포맷팅 함수
                const formatDiaryDate = (latestDiaryDate) => {
                    if (!latestDiaryDate) return '';
                    try {
                        const date = new Date(latestDiaryDate);
                        const year = date.getFullYear();
                        const month = date.getMonth() + 1;
                        const day = date.getDate();
                        return `${year}년 ${month}월 ${day}일까지의 일지`;
                    } catch (error) {
                        // 날짜 파싱 실패 시 원본 문자열 사용
                        return `${latestDiaryDate}까지의 일지`;
                    }
                };
                
                // 먼저 메타데이터에 있는 날짜로 표시
                const initialDiaryDateText = formatDiaryDate(slot.latestDiaryDate) || '새 게임';
                
                slotCard.innerHTML = `
                    <div class="slot-info">
                        <h3>${initialDiaryDateText}</h3>
                        <p class="slot-date">저장일: ${savedDate}</p>
                    </div>
                    <div class="slot-actions">
                        <button class="btn btn-primary load-slot-btn" data-slot-id="${slot.slotId}">불러오기</button>
                        <button class="btn btn-danger delete-slot-btn" data-slot-id="${slot.slotId}">삭제</button>
                    </div>
                `;
                
                slotList.appendChild(slotCard);
                
                // 메타데이터에 최신 일기 날짜가 없으면 게임 데이터에서 가져오기
                if (!slot.latestDiaryDate) {
                    (async () => {
                        try {
                            const gameData = await window.StorageModule.getSaveSlot(slot.slotId);
                            if (gameData) {
                                // 게임 데이터에서 최신 일기 날짜 찾기
                                const chapters = gameData.campaign_history?.monthly_chapters || [];
                                let latestDate = null;
                                for (const chapter of chapters) {
                                    const entries = chapter.daily_entries || [];
                                    for (const entry of entries) {
                                        const entryDate = entry.diary_write_date;
                                        if (!latestDate || entryDate > latestDate) {
                                            latestDate = entryDate;
                                        }
                                    }
                                }
                                
                                // 찾은 날짜로 업데이트
                                if (latestDate) {
                                    const diaryDateText = formatDiaryDate(latestDate);
                                    const titleElement = slotCard.querySelector('.slot-info h3');
                                    if (titleElement) {
                                        titleElement.textContent = diaryDateText;
                                    }
                                }
                            }
                        } catch (error) {
                            if (window.DebugLogger) {
                                window.DebugLogger.warn('최신 일기 날짜 조회 실패', error);
                            }
                        }
                    })();
                }
            });
            
            // 불러오기 버튼 이벤트
            slotList.querySelectorAll('.load-slot-btn').forEach(btn => {
                const handler = async (e) => {
                    const slotId = e.target.dataset.slotId;
                    await this.loadSlot(slotId);
                };
                btn.addEventListener('click', handler);
                this._eventListeners.push({ element: btn, event: 'click', handler: handler });
            });
            
            // 삭제 버튼 이벤트
            slotList.querySelectorAll('.delete-slot-btn').forEach(btn => {
                const handler = async (e) => {
                    const slotId = e.target.dataset.slotId;
                    if (confirm('이 게임을 삭제하시겠습니까?')) {
                        await this.deleteSlot(slotId, slots);
                    }
                };
                btn.addEventListener('click', handler);
                this._eventListeners.push({ element: btn, event: 'click', handler: handler });
            });
        }
        
        modal.style.display = 'flex';
        
        // 모달 닫기 버튼
        const closeBtn = document.getElementById('close-slot-modal');
        if (closeBtn) {
            const closeHandler = () => {
                modal.style.display = 'none';
            };
            closeBtn.onclick = closeHandler;
            // 이벤트 리스너 추적을 위해 저장하지 않음 (onclick 사용)
        }
        
        // 모달 외부 클릭 시 닫기
        const modalClickHandler = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
        modal.onclick = modalClickHandler;
    },

    // 슬롯 불러오기 메서드
    async loadSlot(slotId) {
        try {
            await window.StorageModule.setActiveSlot(slotId);
            const gameData = await window.StorageModule.getSaveSlot(slotId);
            
            if (!gameData) {
                alert('게임 데이터를 불러올 수 없습니다.');
                return;
            }
            
            // 모달 닫기
            const modal = document.getElementById('slot-selection-modal');
            if (modal) modal.style.display = 'none';
            
            // 상태 업데이트 후 게임 플레이 페이지로 이동
            await window.AppState.loadGameState();
            window.Router.navigate('play');
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('슬롯 불러오기 실패', error);
            }
            console.error('슬롯 불러오기 실패:', error);
            alert('게임을 불러오는데 실패했습니다: ' + error.message);
        }
    },

    // 슬롯 삭제 메서드
    async deleteSlot(slotId, slots) {
        try {
            await window.StorageModule.deleteSaveSlot(slotId);
            
            // 목록에서 제거
            const updatedSlots = slots.filter(s => s.slotId !== slotId);
            
            if (updatedSlots.length === 0) {
                // 슬롯이 없으면 모달 닫기
                const modal = document.getElementById('slot-selection-modal');
                if (modal) modal.style.display = 'none';
                alert('모든 게임이 삭제되었습니다.');
            } else {
                // 목록 새로고침
                this.showSlotSelectionModal(updatedSlots);
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('슬롯 삭제 실패', error);
            }
            console.error('슬롯 삭제 실패:', error);
            alert('게임 삭제에 실패했습니다: ' + error.message);
        }
    },

    destroy() {
        // 이벤트 리스너 정리
        if (this._eventListeners) {
            this._eventListeners.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
            this._eventListeners = [];
        }
        
        if (window.DebugLogger) {
            window.DebugLogger.info('Landing 컴포넌트 정리');
        }
    }
};

// 라우터에 등록
if (window.Router) {
    window.Router.register('landing', LandingComponent);
}

