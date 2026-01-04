// 조우 데이터 캐시 모듈
// 정적 데이터를 클라이언트에 캐싱하여 오프라인 지원 및 성능 향상

const ENCOUNTER_CACHE_KEY = 'CalendarAI_EncounterData';
const ENCOUNTER_CACHE_VERSION = '1.0.0'; // 데이터 업데이트 시 버전 변경
const CACHE_DB_NAME = 'CalendarAICacheDB';
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = 'static_data';

/**
 * 조우 데이터 캐시 클래스
 */
class EncounterDataCache {
    constructor() {
        this.dbInstance = null;
        this.initAttempted = false;
    }

    /**
     * IndexedDB 지원 여부 확인
     */
    async _isIndexedDBAvailable() {
        return typeof indexedDB !== 'undefined' && indexedDB !== null &&
               (window.isSecureContext || 
                location.protocol === 'https:' || 
                location.hostname === 'localhost' || 
                location.hostname === '127.0.0.1');
    }

    /**
     * IndexedDB 열기
     */
    async _openIndexedDB() {
        if (this.dbInstance) {
            return this.dbInstance;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.dbInstance = request.result;
                resolve(this.dbInstance);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
                    db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * IndexedDB에서 데이터 가져오기
     */
    async _getFromIndexedDB(db, key) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CACHE_STORE_NAME], 'readonly');
            const store = transaction.objectStore(CACHE_STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * IndexedDB에 데이터 저장
     */
    async _saveToIndexedDB(db, key, data) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(CACHE_STORE_NAME);
            const request = store.put({ key, ...data });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * IndexedDB에서 데이터 삭제
     */
    async _deleteFromIndexedDB(db, key) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(CACHE_STORE_NAME);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 캐시에서 조우 데이터 로드
     */
    async _loadFromCache() {
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('_loadFromCache');
        }
        
        try {
            // IndexedDB 우선 시도
            if (await this._isIndexedDBAvailable()) {
                try {
                    const db = await this._openIndexedDB();
                    const cached = await this._getFromIndexedDB(db, ENCOUNTER_CACHE_KEY);
                    if (cached && cached.version === ENCOUNTER_CACHE_VERSION) {
                        if (window.DebugLogger) window.DebugLogger.info('IndexedDB에서 조우 데이터 캐시 로드', { version: cached.version });
                        console.log('✅ IndexedDB에서 조우 데이터 캐시 로드');
                        return cached.content;
                    }
                } catch (error) {
                    if (window.DebugLogger) window.DebugLogger.warn('IndexedDB 캐시 로드 실패, localStorage로 폴백', error);
                    console.warn('IndexedDB 캐시 로드 실패, localStorage로 폴백:', error);
                }
            }

            // localStorage 폴백
            const cached = localStorage.getItem(ENCOUNTER_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.version === ENCOUNTER_CACHE_VERSION) {
                    if (window.DebugLogger) window.DebugLogger.info('localStorage에서 조우 데이터 캐시 로드', { version: parsed.version });
                    console.log('✅ localStorage에서 조우 데이터 캐시 로드');
                    return parsed.content;
                } else {
                    // 버전이 다르면 캐시 무효화
                    if (window.DebugLogger) window.DebugLogger.warn('캐시 버전 불일치, 캐시 무효화', { cached: parsed.version, expected: ENCOUNTER_CACHE_VERSION });
                    localStorage.removeItem(ENCOUNTER_CACHE_KEY);
                }
            }
        } catch (error) {
            if (window.DebugLogger) window.DebugLogger.error('캐시 로드 실패', error);
            console.warn('캐시 로드 실패:', error);
        }
        
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('_loadFromCache', null);
        }
        return null;
    }

    /**
     * 서버에서 조우 데이터 가져오기
     */
    async _loadFromServer() {
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('_loadFromServer');
            window.DebugLogger.logAPIRequest('GET', '/api/game/encounter-data');
        }
        
        try {
            const requestStartTime = Date.now();
            const response = await fetch('/api/game/encounter-data');
            if (!response.ok) {
                throw new Error(`서버 응답 오류: ${response.status}`);
            }
            const result = await response.json();
            const requestDuration = Date.now() - requestStartTime;
            
            if (window.DebugLogger) {
                window.DebugLogger.logAPIResponse('GET', '/api/game/encounter-data', result, requestDuration);
            }
            
            if (result.success && result.data) {
                const encounterCount = result.data?.encounters ? Object.keys(result.data.encounters).length : 0;
                if (window.DebugLogger) window.DebugLogger.info('서버에서 조우 데이터 로드', { encounterCount });
                console.log('✅ 서버에서 조우 데이터 로드');
                return result.data;
            }
            throw new Error('서버에서 유효한 데이터를 받지 못했습니다.');
        } catch (error) {
            if (window.DebugLogger) window.DebugLogger.error('서버에서 조우 데이터 로드 실패', error);
            console.error('서버에서 조우 데이터 로드 실패:', error);
            throw error;
        } finally {
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('_loadFromServer', null);
            }
        }
    }

    /**
     * 캐시에 조우 데이터 저장
     */
    async _saveToCache(data) {
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('_saveToCache');
        }
        
        const cacheData = {
            version: ENCOUNTER_CACHE_VERSION,
            content: data,
            cachedAt: new Date().toISOString()
        };

        try {
            // IndexedDB 우선
            if (await this._isIndexedDBAvailable()) {
                try {
                    const db = await this._openIndexedDB();
                    await this._saveToIndexedDB(db, ENCOUNTER_CACHE_KEY, cacheData);
                    if (window.DebugLogger) window.DebugLogger.info('IndexedDB에 조우 데이터 캐시 저장', { version: ENCOUNTER_CACHE_VERSION });
                    console.log('✅ IndexedDB에 조우 데이터 캐시 저장');
                    return;
                } catch (error) {
                    if (window.DebugLogger) window.DebugLogger.warn('IndexedDB 캐시 저장 실패, localStorage로 폴백', error);
                    console.warn('IndexedDB 캐시 저장 실패, localStorage로 폴백:', error);
                }
            }

            // localStorage 폴백
            localStorage.setItem(ENCOUNTER_CACHE_KEY, JSON.stringify(cacheData));
            if (window.DebugLogger) window.DebugLogger.info('localStorage에 조우 데이터 캐시 저장', { version: ENCOUNTER_CACHE_VERSION });
            console.log('✅ localStorage에 조우 데이터 캐시 저장');
        } catch (error) {
            if (window.DebugLogger) window.DebugLogger.error('캐시 저장 실패', error);
            console.warn('캐시 저장 실패:', error);
        } finally {
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('_saveToCache', null);
            }
        }
    }

    /**
     * 조우 데이터 로드 (캐시 우선, 없으면 서버에서 가져와서 캐싱)
     * @returns {Promise<Object>} 조우 데이터
     */
    async load() {
        const startTime = Date.now();
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('load');
        }
        
        // 1. 캐시에서 확인
        const cached = await this._loadFromCache();
        if (cached) {
            if (window.DebugLogger) {
                window.DebugLogger.info('조우 데이터 로드 완료 (캐시)', { 
                    encounterCount: cached?.encounters ? Object.keys(cached.encounters).length : 0 
                });
                window.DebugLogger.logFunctionExit('load', null, startTime);
            }
            return cached;
        }

        // 2. 서버에서 가져오기
        const data = await this._loadFromServer();

        // 3. 캐시에 저장
        await this._saveToCache(data);

        if (window.DebugLogger) {
            window.DebugLogger.info('조우 데이터 로드 완료 (서버)', { 
                encounterCount: data?.encounters ? Object.keys(data.encounters).length : 0 
            });
            window.DebugLogger.logFunctionExit('load', null, startTime);
        }
        return data;
    }

    /**
     * 캐시 무효화 (데이터 업데이트 시)
     */
    async clearCache() {
        const startTime = Date.now();
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionEntry('clearCache');
        }
        
        try {
            if (await this._isIndexedDBAvailable()) {
                try {
                    const db = await this._openIndexedDB();
                    await this._deleteFromIndexedDB(db, ENCOUNTER_CACHE_KEY);
                    if (window.DebugLogger) window.DebugLogger.info('IndexedDB 캐시 삭제 완료');
                    console.log('✅ IndexedDB 캐시 삭제 완료');
                } catch (error) {
                    if (window.DebugLogger) window.DebugLogger.warn('IndexedDB 캐시 삭제 실패', error);
                    console.warn('IndexedDB 캐시 삭제 실패:', error);
                }
            }
            localStorage.removeItem(ENCOUNTER_CACHE_KEY);
            if (window.DebugLogger) window.DebugLogger.info('localStorage 캐시 삭제 완료');
            console.log('✅ localStorage 캐시 삭제 완료');
        } catch (error) {
            if (window.DebugLogger) window.DebugLogger.error('캐시 삭제 실패', error);
            console.warn('캐시 삭제 실패:', error);
        } finally {
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('clearCache', null, startTime);
            }
        }
    }

    /**
     * 캐시 상태 확인
     */
    async getCacheStatus() {
        try {
            if (await this._isIndexedDBAvailable()) {
                try {
                    const db = await this._openIndexedDB();
                    const cached = await this._getFromIndexedDB(db, ENCOUNTER_CACHE_KEY);
                    if (cached && cached.version === ENCOUNTER_CACHE_VERSION) {
                        return {
                            exists: true,
                            version: cached.version,
                            cachedAt: cached.cachedAt,
                            storage: 'indexeddb'
                        };
                    }
                } catch (error) {
                    // IndexedDB 실패 시 localStorage 확인
                }
            }

            const cached = localStorage.getItem(ENCOUNTER_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.version === ENCOUNTER_CACHE_VERSION) {
                    return {
                        exists: true,
                        version: parsed.version,
                        cachedAt: parsed.cachedAt,
                        storage: 'localstorage'
                    };
                }
            }

            return { exists: false };
        } catch (error) {
            return { exists: false, error: error.message };
        }
    }
}

// 전역 인스턴스
const encounterCache = new EncounterDataCache();

// 모듈 내보내기
if (typeof window !== 'undefined') {
    window.EncounterCache = {
        load: () => encounterCache.load(),
        clearCache: () => encounterCache.clearCache(),
        getCacheStatus: () => encounterCache.getCacheStatus()
    };
}

