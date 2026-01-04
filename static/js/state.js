// 전역 상태 관리 모듈
// 게임 상태를 중앙에서 관리하고 구독 패턴으로 상태 변경을 알림

class AppState {
    constructor() {
        this.gameState = null;
        this.currentDate = null;
        this.encounterData = null;
        this.campaignYear = null;
        this.chapters = null;
        this.listeners = new Map();
        this.apiCache = new Map(); // API 호출 캐시
    }

    /**
     * 상태 업데이트
     */
    setState(key, value) {
        const oldValue = this[key];
        this[key] = value;
        this.notify(key, value, oldValue);
        
        if (window.DebugLogger) {
            window.DebugLogger.info('상태 업데이트', { key, hasValue: value !== null && value !== undefined });
        }
    }

    /**
     * 상태 구독
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
        
        // 즉시 현재 값 반환
        if (this[key] !== undefined) {
            callback(this[key], this[key]);
        }
        
        // 구독 해제 함수 반환
        return () => {
            const callbacks = this.listeners.get(key);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * 알림
     */
    notify(key, newValue, oldValue) {
        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    if (window.DebugLogger) {
                        window.DebugLogger.error('상태 구독 콜백 오류', error);
                    }
                    console.error('상태 구독 콜백 오류:', error);
                }
            });
        }
    }

    /**
     * 게임 상태 로드
     */
    async loadGameState() {
        const startTime = Date.now();
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('loadGameState');
        }

        try {
            if (typeof window.StorageModule === 'undefined') {
                const error = new Error('StorageModule이 로드되지 않았습니다.');
                if (window.DebugLogger) {
                    window.DebugLogger.error('게임 상태 로드 실패', error);
                    window.DebugLogger.logFunctionExit('loadGameState', error, startTime);
                }
                throw error;
            }

            await window.StorageModule.initDB();
            const activeSlotId = await window.StorageModule.getActiveSlot();
            
            if (!activeSlotId) {
                if (window.DebugLogger) {
                    window.DebugLogger.debug('활성 슬롯이 없습니다.');
                    window.DebugLogger.logFunctionExit('loadGameState', null, startTime);
                }
                return;
            }

            const gameData = await window.StorageModule.getSaveSlot(activeSlotId);
            
            if (gameData) {
                this.setState('gameState', gameData.current_state || {});
                this.setState('currentDate', gameData.current_state?.today_date);
                this.setState('campaignYear', gameData.save_file_info?.campaign_year || 1925);
                
                if (window.DebugLogger) {
                    window.DebugLogger.info('게임 상태 로드 완료', {
                        activeSlotId,
                        todayDate: this.currentDate,
                        campaignYear: this.campaignYear
                    });
                }
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
    }

    /**
     * 챕터 데이터 로드 (캐시 사용)
     */
    async loadChapters() {
        const cacheKey = 'chapters';
        const cacheTime = 60000; // 1분 캐시

        // 캐시 확인
        if (this.apiCache.has(cacheKey)) {
            const cached = this.apiCache.get(cacheKey);
            if (Date.now() - cached.timestamp < cacheTime) {
                if (window.DebugLogger) {
                    window.DebugLogger.debug('챕터 데이터 캐시 사용');
                }
                this.setState('chapters', cached.data);
                return cached.data;
            }
        }

        const startTime = Date.now();
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('loadChapters');
            window.DebugLogger.logAPIRequest('POST', '/api/narrative/all-chapters');
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
            const response = await fetch('/api/narrative/all-chapters', {
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
                window.DebugLogger.logAPIResponse('POST', '/api/narrative/all-chapters', data, requestDuration);
            }
            
            if (data.success) {
                this.setState('chapters', data.chapters);
                
                // 캐시 저장
                this.apiCache.set(cacheKey, {
                    data: data.chapters,
                    timestamp: Date.now()
                });
                
                if (window.DebugLogger) {
                    window.DebugLogger.info('챕터 로드 완료', { chapterCount: data.chapters?.length || 0 });
                    window.DebugLogger.logFunctionExit('loadChapters', null, startTime);
                }
                
                return data.chapters;
            } else {
                throw new Error(data.detail || '챕터 로드 실패');
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.error('챕터 로드 실패', error);
                window.DebugLogger.logFunctionExit('loadChapters', error, startTime);
            }
            console.error('챕터 로드 실패:', error);
            throw error;
        }
    }

    /**
     * 캐시 클리어
     */
    clearCache(key = null) {
        if (key) {
            this.apiCache.delete(key);
        } else {
            this.apiCache.clear();
        }
        
        if (window.DebugLogger) {
            window.DebugLogger.info('캐시 클리어', { key: key || 'all' });
        }
    }
}

// 전역 인스턴스
window.AppState = new AppState();

