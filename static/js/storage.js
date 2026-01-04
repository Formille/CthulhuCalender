// IndexedDB 저장 모듈
// 게임 데이터를 IndexedDB에 저장하고 관리하는 모듈

const DB_NAME = 'CalendarAIGameDB';
const DB_VERSION = 1;
const STORE_NAME = 'saveSlots';
const ACTIVE_SLOT_KEY = 'activeSlotId';

// localStorage 키 접두사
const LS_PREFIX = 'CalendarAIGameDB_';
const LS_SLOTS_KEY = `${LS_PREFIX}slots`;
const LS_STORAGE_TYPE_KEY = `${LS_PREFIX}storageType`;

/**
 * IndexedDB 지원 여부 및 보안 컨텍스트 확인 (개선된 버전)
 * @returns {Object} 지원 여부 및 환경 정보
 */
function checkIndexedDBSupport() {
    // 보안 컨텍스트 체크 개선: IP 주소도 개발 환경으로 인식
    const isSecureContext = window.isSecureContext || 
                           location.protocol === 'https:' || 
                           location.hostname === 'localhost' || 
                           location.hostname === '127.0.0.1' ||
                           /^192\.168\.\d+\.\d+$/.test(location.hostname) || // 로컬 네트워크 IP
                           /^10\.\d+\.\d+\.\d+$/.test(location.hostname) || // 사설 IP
                           /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/.test(location.hostname); // 사설 IP 범위
    
    const isIndexedDBAvailable = typeof indexedDB !== 'undefined' && indexedDB !== null;
    
    const isPrivateMode = (() => {
        // 시크릿 모드 감지 시도
        try {
            localStorage.setItem('__test_private__', '1');
            localStorage.removeItem('__test_private__');
            return false;
        } catch (e) {
            return true; // localStorage 접근 실패 시 시크릿 모드로 간주
        }
    })();
    
    const userAgent = navigator.userAgent || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    return {
        isSecureContext,
        isIndexedDBAvailable,
        isPrivateMode,
        isMobile,
        protocol: location.protocol,
        hostname: location.hostname
    };
}

/**
 * 저장소 타입 열거형
 */
const StorageType = {
    INDEXEDDB: 'indexeddb',
    LOCALSTORAGE: 'localstorage'
};

/**
 * 저장소 추상화 어댑터 클래스
 * IndexedDB와 localStorage를 모두 지원하며, IndexedDB 실패 시 자동으로 localStorage로 폴백
 */
class StorageAdapter {
    constructor() {
        this.storageType = null;
        this.dbInstance = null;
        this.initAttempted = false;
        this.supportInfo = null;
    }

    /**
     * 저장소 초기화
     * @returns {Promise<void>}
     */
    async init() {
        // 이미 초기화된 경우 체크 (IndexedDB 또는 localStorage 모두)
        if (this.storageType && this.dbInstance) {
            return;
        }

        if (this.initAttempted) {
            // 이미 시도 중이면 짧은 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 100));
            if (this.storageType && this.dbInstance) {
                return;
            }
        }

        this.initAttempted = true;
        this.supportInfo = checkIndexedDBSupport();

        // 먼저 IndexedDB 시도
        try {
            if (window.DebugLogger) window.DebugLogger.debug('IndexedDB 초기화 시도');
            await this._initIndexedDB();
            this.storageType = StorageType.INDEXEDDB;
            localStorage.setItem(LS_STORAGE_TYPE_KEY, StorageType.INDEXEDDB);
            if (window.DebugLogger) window.DebugLogger.info('IndexedDB 초기화 성공', { 
                dbName: this.dbInstance?.name,
                version: this.dbInstance?.version 
            });
            console.log('✅ IndexedDB 초기화 성공');
            return;
        } catch (indexedDBError) {
            if (window.DebugLogger) window.DebugLogger.warn('IndexedDB 초기화 실패, localStorage로 폴백', indexedDBError);
            console.warn('IndexedDB 초기화 실패, localStorage로 폴백:', indexedDBError);
            
            // localStorage로 폴백
            try {
                if (window.DebugLogger) window.DebugLogger.debug('localStorage 초기화 시도 (폴백)');
                await this._initLocalStorage();
                this.storageType = StorageType.LOCALSTORAGE;
                localStorage.setItem(LS_STORAGE_TYPE_KEY, StorageType.LOCALSTORAGE);
                if (window.DebugLogger) window.DebugLogger.info('localStorage 초기화 성공 (폴백)');
                console.log('✅ localStorage 초기화 성공 (폴백)');
                
                // 모바일 환경에서 사용자에게 알림 (선택적)
                if (this.supportInfo.isMobile) {
                    if (window.DebugLogger) window.DebugLogger.info('모바일 환경에서 localStorage 사용');
                    console.info('💡 모바일 환경에서 localStorage를 사용합니다. 저장 용량 제한이 있을 수 있습니다.');
                }
                return;
            } catch (localStorageError) {
                if (window.DebugLogger) window.DebugLogger.error('localStorage 초기화도 실패', localStorageError);
                console.error('localStorage 초기화도 실패:', localStorageError);
                this.initAttempted = false;
                throw new Error('모든 저장소 초기화에 실패했습니다.');
            }
        }
    }

    /**
     * IndexedDB 초기화
     * @private
     */
    _initIndexedDB() {
        return new Promise((resolve, reject) => {
            // 보안 컨텍스트 확인
            if (!this.supportInfo.isSecureContext) {
                reject(new Error(`IndexedDB는 보안 컨텍스트(HTTPS)에서만 사용 가능합니다. 현재 프로토콜: ${this.supportInfo.protocol}`));
                return;
            }

            // IndexedDB 지원 여부 확인
            if (!this.supportInfo.isIndexedDBAvailable) {
                reject(new Error('이 브라우저는 IndexedDB를 지원하지 않습니다.'));
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                const error = request.error || event.target?.error;
                console.error('IndexedDB 열기 실패:', {
                    error: error,
                    name: error?.name,
                    message: error?.message,
                    code: error?.code
                });
                reject(error);
            };

            request.onsuccess = (event) => {
                this.dbInstance = request.result;
                
                // 연결 종료 이벤트 처리
                this.dbInstance.onclose = () => {
                    console.warn('IndexedDB 연결이 종료되었습니다.');
                    this.dbInstance = null;
                };
                
                // 에러 이벤트 처리
                this.dbInstance.onerror = (event) => {
                    console.error('IndexedDB 에러:', event.target?.error);
                };
                
                console.log('IndexedDB 초기화 성공:', {
                    name: this.dbInstance.name,
                    version: this.dbInstance.version,
                    objectStores: Array.from(this.dbInstance.objectStoreNames)
                });
                
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('IndexedDB 업그레이드 시작:', {
                    oldVersion: event.oldVersion,
                    newVersion: event.newVersion
                });

                // 기존 object store가 있으면 삭제
                if (db.objectStoreNames.contains(STORE_NAME)) {
                    try {
                        db.deleteObjectStore(STORE_NAME);
                        console.log('기존 object store 삭제 완료');
                    } catch (e) {
                        console.warn('기존 object store 삭제 실패:', e);
                    }
                }

                // 새 object store 생성
                try {
                    const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
                    objectStore.createIndex('savedAt', 'savedAt', { unique: false });
                    objectStore.createIndex('campaignYear', 'campaignYear', { unique: false });
                    console.log('Object store 및 인덱스 생성 완료');
                } catch (e) {
                    console.error('Object store 생성 실패:', e);
                    reject(e);
                }
            };

            request.onblocked = () => {
                console.warn('IndexedDB 연결이 차단되었습니다. 다른 탭에서 데이터베이스를 사용 중일 수 있습니다.');
            };
        });
    }

    /**
     * localStorage 초기화
     * @private
     */
    async _initLocalStorage() {
        // localStorage 사용 가능 여부 확인
        try {
            const testKey = '__test_storage__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
        } catch (e) {
            throw new Error('localStorage를 사용할 수 없습니다. 시크릿 모드일 수 있습니다.');
        }

        // 기존 슬롯 목록이 없으면 초기화
        if (!localStorage.getItem(LS_SLOTS_KEY)) {
            localStorage.setItem(LS_SLOTS_KEY, JSON.stringify([]));
        }

        this.dbInstance = true; // localStorage는 별도 인스턴스가 필요 없음
    }

    /**
     * 슬롯 저장
     * @param {Object} slotData - 슬롯 데이터
     * @returns {Promise<void>}
     */
    async save(slotData) {
        await this.init();

        if (this.storageType === StorageType.INDEXEDDB) {
            return this._saveToIndexedDB(slotData);
        } else {
            return this._saveToLocalStorage(slotData);
        }
    }

    /**
     * IndexedDB에 저장
     * @private
     */
    _saveToIndexedDB(slotData) {
        return new Promise((resolve, reject) => {
            const transaction = this.dbInstance.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(slotData);

            request.onsuccess = () => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * localStorage에 저장
     * @private
     */
    _saveToLocalStorage(slotData) {
        try {
            // 슬롯 데이터 저장
            const slotKey = `${LS_PREFIX}slot_${slotData.slotId}`;
            const dataStr = JSON.stringify(slotData);
            
            // 용량 체크 (대략 5MB 제한)
            const sizeInBytes = new Blob([dataStr]).size;
            if (sizeInBytes > 5 * 1024 * 1024) {
                throw new Error('슬롯 데이터가 너무 큽니다. localStorage 용량 제한을 초과했습니다.');
            }

            // localStorage에 저장 시도 (QuotaExceededError 처리)
            try {
                localStorage.setItem(slotKey, dataStr);
            } catch (setError) {
                if (setError.name === 'QuotaExceededError' || 
                    setError.code === 22 || 
                    setError.message && setError.message.toLowerCase().includes('quota')) {
                    throw new Error('저장 공간이 부족합니다. 브라우저 설정에서 저장 공간을 확보해주세요.');
                }
                throw setError;
            }

            // 슬롯 목록 업데이트
            const slotsList = JSON.parse(localStorage.getItem(LS_SLOTS_KEY) || '[]');
            const existingIndex = slotsList.findIndex(s => s.slotId === slotData.slotId);
            const metadata = {
                slotId: slotData.slotId,
                campaignYear: slotData.campaignYear,
                playerName: slotData.playerName,
                latestDiaryDate: slotData.latestDiaryDate,
                savedAt: slotData.savedAt,
                createdAt: slotData.createdAt
            };

            if (existingIndex >= 0) {
                slotsList[existingIndex] = metadata;
            } else {
                slotsList.push(metadata);
            }

            // 저장일시 기준 내림차순 정렬
            slotsList.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

            // 슬롯 목록 저장 시도 (QuotaExceededError 처리)
            try {
                localStorage.setItem(LS_SLOTS_KEY, JSON.stringify(slotsList));
            } catch (setError) {
                if (setError.name === 'QuotaExceededError' || 
                    setError.code === 22 || 
                    setError.message && setError.message.toLowerCase().includes('quota')) {
                    throw new Error('저장 공간이 부족합니다. 브라우저 설정에서 저장 공간을 확보해주세요.');
                }
                throw setError;
            }
        } catch (error) {
            if (error.message && error.message.includes('용량') || error.message.includes('저장 공간')) {
                throw error; // 이미 적절한 메시지가 있음
            }
            throw error;
        }
    }

    /**
     * 슬롯 로드
     * @param {string} slotId - 슬롯 ID
     * @returns {Promise<Object|null>} 슬롯 데이터 또는 null
     */
    async load(slotId) {
        await this.init();

        if (this.storageType === StorageType.INDEXEDDB) {
            return this._loadFromIndexedDB(slotId);
        } else {
            return this._loadFromLocalStorage(slotId);
        }
    }

    /**
     * IndexedDB에서 로드
     * @private
     */
    _loadFromIndexedDB(slotId) {
        return new Promise((resolve, reject) => {
            const transaction = this.dbInstance.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(slotId);

            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * localStorage에서 로드
     * @private
     */
    _loadFromLocalStorage(slotId) {
        try {
            const slotKey = `${LS_PREFIX}slot_${slotId}`;
            const dataStr = localStorage.getItem(slotKey);
            if (!dataStr) {
                return null;
            }
            return JSON.parse(dataStr);
        } catch (error) {
            console.error('localStorage에서 슬롯 로드 실패:', error);
            return null;
        }
    }

    /**
     * 슬롯 삭제
     * @param {string} slotId - 슬롯 ID
     * @returns {Promise<void>}
     */
    async delete(slotId) {
        await this.init();

        if (this.storageType === StorageType.INDEXEDDB) {
            return this._deleteFromIndexedDB(slotId);
        } else {
            return this._deleteFromLocalStorage(slotId);
        }
    }

    /**
     * IndexedDB에서 삭제
     * @private
     */
    _deleteFromIndexedDB(slotId) {
        return new Promise((resolve, reject) => {
            const transaction = this.dbInstance.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(slotId);

            request.onsuccess = () => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * localStorage에서 삭제
     * @private
     */
    _deleteFromLocalStorage(slotId) {
        try {
            const slotKey = `${LS_PREFIX}slot_${slotId}`;
            localStorage.removeItem(slotKey);

            // 슬롯 목록에서도 제거
            const slotsList = JSON.parse(localStorage.getItem(LS_SLOTS_KEY) || '[]');
            const filtered = slotsList.filter(s => s.slotId !== slotId);
            
            // 슬롯 목록 업데이트 (에러 처리)
            try {
                localStorage.setItem(LS_SLOTS_KEY, JSON.stringify(filtered));
            } catch (setError) {
                console.error('슬롯 목록 업데이트 실패:', setError);
                // 목록 업데이트 실패해도 슬롯 자체는 삭제되었으므로 계속 진행
            }
        } catch (error) {
            console.error('localStorage에서 슬롯 삭제 실패:', error);
            throw error;
        }
    }

    /**
     * 모든 슬롯 목록 조회
     * @returns {Promise<Array>} 슬롯 메타데이터 배열
     */
    async list() {
        await this.init();

        if (this.storageType === StorageType.INDEXEDDB) {
            return this._listFromIndexedDB();
        } else {
            return this._listFromLocalStorage();
        }
    }

    /**
     * IndexedDB에서 목록 조회
     * @private
     */
    _listFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.dbInstance.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const slots = request.result.map(slot => ({
                    slotId: slot.slotId,
                    campaignYear: slot.campaignYear,
                    playerName: slot.playerName,
                    latestDiaryDate: slot.latestDiaryDate,
                    savedAt: slot.savedAt,
                    createdAt: slot.createdAt
                }));

                slots.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
                resolve(slots);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * localStorage에서 목록 조회
     * @private
     */
    _listFromLocalStorage() {
        try {
            const slotsList = JSON.parse(localStorage.getItem(LS_SLOTS_KEY) || '[]');
            return slotsList.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        } catch (error) {
            console.error('localStorage에서 슬롯 목록 조회 실패:', error);
            return [];
        }
    }

    /**
     * 현재 저장소 타입 반환
     * @returns {string|null}
     */
    getStorageType() {
        return this.storageType;
    }
}

// 전역 StorageAdapter 인스턴스
const storageAdapter = new StorageAdapter();

/**
 * 저장소 초기화 (StorageAdapter 사용)
 * @returns {Promise<void>}
 */
async function initDB() {
    await storageAdapter.init();
}

/**
 * 게임 데이터에서 최신 다이어리 날짜 추출
 * @param {Object} gameData - 게임 데이터
 * @returns {string|null} 최신 다이어리 날짜 (YYYY-MM-DD 형식) 또는 null
 */
function getLatestDiaryDate(gameData) {
    if (!gameData || !gameData.campaign_history) {
        return null;
    }

    const chapters = gameData.campaign_history.monthly_chapters || [];
    let latestDate = null;

    for (const chapter of chapters) {
        const entries = chapter.daily_entries || [];
        for (const entry of entries) {
            const diaryDate = entry.diary_write_date;
            if (diaryDate) {
                if (!latestDate || diaryDate > latestDate) {
                    latestDate = diaryDate;
                }
            }
        }
    }

    return latestDate;
}

/**
 * 슬롯 메타데이터 생성
 * @param {Object} gameData - 게임 데이터
 * @param {string} slotId - 슬롯 ID
 * @returns {Object} 메타데이터 객체
 */
function createSlotMetadata(gameData, slotId) {
    const now = new Date().toISOString();
    const latestDiaryDate = getLatestDiaryDate(gameData);

    return {
        slotId: slotId,
        campaignYear: gameData.save_file_info?.campaign_year || 1925,
        playerName: gameData.save_file_info?.player_name || 'John Miller',
        latestDiaryDate: latestDiaryDate,
        savedAt: now,
        createdAt: gameData._metadata?.createdAt || now
    };
}

/**
 * 새 슬롯 생성
 * @param {Object} gameData - 게임 데이터
 * @returns {Promise<string>} 생성된 슬롯 ID
 */
async function createSaveSlot(gameData) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('createSaveSlot', { 
            campaignYear: gameData?.save_file_info?.campaign_year,
            playerName: gameData?.save_file_info?.player_name
        });
    }
    
    try {
        await storageAdapter.init();

        // 슬롯 ID 생성 (타임스탬프 기반)
        const slotId = `slot_${Date.now()}`;

        // 메타데이터 추가
        const metadata = createSlotMetadata(gameData, slotId);
        gameData._metadata = metadata;

        // 마지막 플레이 시간 업데이트
        if (gameData.save_file_info) {
            gameData.save_file_info.last_played = new Date().toISOString();
        }

        // 저장소에 저장
        const slotData = {
            slotId: slotId,
            campaignYear: metadata.campaignYear,
            playerName: metadata.playerName,
            latestDiaryDate: metadata.latestDiaryDate,
            savedAt: metadata.savedAt,
            createdAt: metadata.createdAt,
            gameData: gameData
        };

        await storageAdapter.save(slotData);
        if (window.DebugLogger) {
            window.DebugLogger.info('슬롯 생성 완료', { 
                slotId, 
                storageType: storageAdapter.storageType,
                campaignYear: metadata.campaignYear 
            });
        }
        console.log('슬롯 생성 완료:', slotId);

        // 활성 슬롯으로 설정
        await setActiveSlot(slotId);

        return slotId;
    } catch (error) {
        if (window.DebugLogger) window.DebugLogger.error('슬롯 생성 실패', error);
        console.error('슬롯 생성 실패:', error);
        throw error;
    } finally {
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('createSaveSlot', null, startTime);
        }
    }
}

/**
 * 슬롯 데이터 로드
 * @param {string} slotId - 슬롯 ID
 * @returns {Promise<Object|null>} 게임 데이터 또는 null
 */
async function getSaveSlot(slotId) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('getSaveSlot', { slotId });
    }
    
    try {
        await storageAdapter.init();
        const slotData = await storageAdapter.load(slotId);
        
        if (slotData && slotData.gameData) {
            if (window.DebugLogger) {
                window.DebugLogger.info('슬롯 로드 완료', { 
                    slotId,
                    storageType: storageAdapter.storageType,
                    campaignYear: slotData.gameData?.save_file_info?.campaign_year
                });
            }
            return slotData.gameData;
        }
        if (window.DebugLogger) window.DebugLogger.warn('슬롯 데이터 없음', { slotId });
        return null;
    } catch (error) {
        if (window.DebugLogger) window.DebugLogger.error('슬롯 로드 실패', error);
        console.error('슬롯 로드 실패:', error);
        return null;
    } finally {
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('getSaveSlot', null, startTime);
        }
    }
}

/**
 * 슬롯 업데이트
 * @param {string} slotId - 슬롯 ID
 * @param {Object} gameData - 업데이트할 게임 데이터
 * @returns {Promise<boolean>} 성공 여부
 */
async function updateSaveSlot(slotId, gameData) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('updateSaveSlot', { slotId });
    }
    
    try {
        await storageAdapter.init();

        // 기존 슬롯 데이터 가져오기
        const existingSlot = await storageAdapter.load(slotId);

        // 기존 슬롯이 없으면 새로 생성 (호환성을 위해)
        if (!existingSlot) {
            if (window.DebugLogger) window.DebugLogger.warn('슬롯을 찾을 수 없어 새로 생성합니다', { slotId });
            console.warn(`슬롯을 찾을 수 없어 새로 생성합니다: ${slotId}`);
            // 기존 슬롯 ID를 유지하기 위해 직접 저장
            const metadata = createSlotMetadata(gameData, slotId);
            gameData._metadata = metadata;
            
            if (gameData.save_file_info) {
                gameData.save_file_info.last_played = new Date().toISOString();
            }

            const slotData = {
                slotId: slotId,
                campaignYear: metadata.campaignYear,
                playerName: metadata.playerName,
                latestDiaryDate: metadata.latestDiaryDate,
                savedAt: metadata.savedAt,
                createdAt: metadata.createdAt,
                gameData: gameData
            };

            await storageAdapter.save(slotData);
            if (window.DebugLogger) window.DebugLogger.info('슬롯 생성 완료 (업데이트 시도)', { slotId });
            console.log('슬롯 생성 완료 (업데이트 시도):', slotId);
            return true;
        }

        // 메타데이터 업데이트
        const metadata = createSlotMetadata(gameData, slotId);
        metadata.createdAt = existingSlot.createdAt || metadata.createdAt;
        gameData._metadata = metadata;

        // 마지막 플레이 시간 업데이트
        if (gameData.save_file_info) {
            gameData.save_file_info.last_played = new Date().toISOString();
        }

        // 업데이트된 데이터 저장
        const slotData = {
            slotId: slotId,
            campaignYear: metadata.campaignYear,
            playerName: metadata.playerName,
            latestDiaryDate: metadata.latestDiaryDate,
            savedAt: metadata.savedAt,
            createdAt: metadata.createdAt,
            gameData: gameData
        };

        await storageAdapter.save(slotData);
        if (window.DebugLogger) {
            window.DebugLogger.info('슬롯 업데이트 완료', { 
                slotId,
                storageType: storageAdapter.storageType,
                latestDiaryDate: metadata.latestDiaryDate
            });
        }
        console.log('슬롯 업데이트 완료:', slotId);

        return true;
    } catch (error) {
        if (window.DebugLogger) window.DebugLogger.error('슬롯 업데이트 실패', error);
        console.error('슬롯 업데이트 실패:', error);
        return false;
    } finally {
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('updateSaveSlot', null, startTime);
        }
    }
}

/**
 * 슬롯 삭제
 * @param {string} slotId - 슬롯 ID
 * @returns {Promise<boolean>} 성공 여부
 */
async function deleteSaveSlot(slotId) {
    try {
        await storageAdapter.init();
        await storageAdapter.delete(slotId);

        // 삭제된 슬롯이 활성 슬롯이었다면 활성 슬롯 초기화
        const activeSlotId = await getActiveSlot();
        if (activeSlotId === slotId) {
            await setActiveSlot(null);
        }

        return true;
    } catch (error) {
        console.error('슬롯 삭제 실패:', error);
        return false;
    }
}

/**
 * 모든 슬롯 목록 조회 (메타데이터 포함)
 * @returns {Promise<Array>} 슬롯 메타데이터 배열
 */
async function listSaveSlots() {
    try {
        await storageAdapter.init();
        return await storageAdapter.list();
    } catch (error) {
        console.error('슬롯 목록 조회 실패:', error);
        return [];
    }
}

/**
 * 활성 슬롯 ID 가져오기
 * @returns {Promise<string|null>} 활성 슬롯 ID 또는 null
 */
async function getActiveSlot() {
    try {
        const activeSlotId = localStorage.getItem(ACTIVE_SLOT_KEY);
        return activeSlotId;
    } catch (error) {
        console.error('활성 슬롯 조회 실패:', error);
        return null;
    }
}

/**
 * 활성 슬롯 ID 설정
 * @param {string|null} slotId - 슬롯 ID 또는 null
 * @returns {Promise<void>}
 */
async function setActiveSlot(slotId) {
    try {
        if (slotId) {
            localStorage.setItem(ACTIVE_SLOT_KEY, slotId);
        } else {
            localStorage.removeItem(ACTIVE_SLOT_KEY);
        }
    } catch (error) {
        console.error('활성 슬롯 설정 실패:', error);
        throw error;
    }
}

/**
 * 현재 활성 슬롯의 게임 데이터 로드
 * @returns {Promise<Object|null>} 게임 데이터 또는 null
 */
async function loadActiveSlot() {
    const activeSlotId = await getActiveSlot();
    if (!activeSlotId) {
        return null;
    }

    return await getSaveSlot(activeSlotId);
}

/**
 * 슬롯을 JSON 파일로 다운로드
 * @param {string} slotId - 슬롯 ID
 * @returns {Promise<boolean>} 성공 여부
 */
async function exportSlotAsFile(slotId) {
    try {
        const gameData = await getSaveSlot(slotId);
        if (!gameData) {
            throw new Error('슬롯을 찾을 수 없습니다.');
        }

        // 메타데이터 제거 (파일에는 순수 게임 데이터만 저장)
        const exportData = { ...gameData };
        delete exportData._metadata;

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.download = `calendar-ai-slot-${slotId}-${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return true;
    } catch (error) {
        console.error('파일 다운로드 실패:', error);
        throw error;
    }
}

/**
 * JSON 파일에서 슬롯 가져오기
 * @param {File} file - 업로드할 파일
 * @param {boolean} overwrite - 기존 슬롯 덮어쓰기 여부 (false면 새 슬롯 생성)
 * @param {string|null} targetSlotId - 덮어쓸 슬롯 ID (overwrite가 true일 때)
 * @returns {Promise<string>} 저장된 슬롯 ID
 */
async function importSlotFromFile(file, overwrite = false, targetSlotId = null) {
    try {
        const text = await file.text();
        const gameData = JSON.parse(text);

        // 데이터 검증
        if (!gameData.current_state || !gameData.save_file_info) {
            throw new Error('유효하지 않은 게임 데이터 파일입니다.');
        }

        if (overwrite && targetSlotId) {
            // 기존 슬롯 덮어쓰기
            await updateSaveSlot(targetSlotId, gameData);
            await setActiveSlot(targetSlotId);
            return targetSlotId;
        } else {
            // 새 슬롯으로 저장
            const slotId = await createSaveSlot(gameData);
            return slotId;
        }
    } catch (error) {
        console.error('파일 업로드 실패:', error);
        throw error;
    }
}

/**
 * 서버와 동기화 (선택적 백업/복원)
 * @param {string} slotId - 슬롯 ID
 * @param {string} direction - 동기화 방향: 'upload' | 'download' | 'both'
 * @returns {Promise<boolean>} 성공 여부
 */
async function syncWithServer(slotId, direction = 'both') {
    try {
        if (direction === 'upload' || direction === 'both') {
            // 클라이언트 → 서버 업로드
            const gameData = await getSaveSlot(slotId);
            if (gameData) {
                const response = await fetch('/api/game/save-slot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        slot_id: slotId,
                        game_data: gameData
                    })
                });

                if (!response.ok) {
                    throw new Error(`서버 업로드 실패: ${response.status}`);
                }

                const result = await response.json();
                if (result.success) {
                    console.log(`✅ 슬롯 ${slotId} 서버 업로드 완료`);
                } else {
                    throw new Error(result.detail || '서버 업로드 실패');
                }
            }
        }

        if (direction === 'download' || direction === 'both') {
            // 서버 → 클라이언트 다운로드
            const response = await fetch(`/api/game/load-slot/${slotId}`);
            
            if (response.status === 404) {
                // 서버에 슬롯이 없으면 무시 (정상)
                console.log(`ℹ️ 서버에 슬롯 ${slotId}가 없습니다 (새 슬롯)`);
                return true;
            }

            if (!response.ok) {
                throw new Error(`서버 다운로드 실패: ${response.status}`);
            }

            const result = await response.json();
            if (result.success && result.game_data) {
                await updateSaveSlot(slotId, result.game_data);
                console.log(`✅ 슬롯 ${slotId} 서버에서 복원 완료`);
            } else {
                throw new Error(result.detail || '서버 다운로드 실패');
            }
        }

        return true;
    } catch (error) {
        console.warn(`서버 동기화 실패 (오프라인 모드로 계속):`, error);
        // 오프라인에서는 계속 진행 (에러를 throw하지 않음)
        return false;
    }
}

/**
 * 자동 저장 (클라이언트 저장소에 즉시 저장, 서버는 백그라운드 동기화)
 * @param {Object} gameData - 게임 데이터
 * @param {string} slotId - 슬롯 ID
 * @returns {Promise<boolean>} 성공 여부
 */
async function autoSave(gameData, slotId) {
    try {
        // 클라이언트 저장소에 즉시 저장
        const success = await updateSaveSlot(slotId, gameData);
        
        if (success) {
            // 백그라운드에서 서버 동기화 시도 (실패해도 무시)
            syncWithServer(slotId, 'upload').catch(() => {
                // 오프라인이면 무시 (조용히 실패)
            });
        }

        return success;
    } catch (error) {
        console.error('자동 저장 실패:', error);
        return false;
    }
}

/**
 * IndexedDB와 localStorage 간 데이터 동기화
 * @returns {Promise<boolean>} 성공 여부
 */
async function syncStorageData() {
    try {
        await storageAdapter.init();
        const storageType = storageAdapter.getStorageType();
        
        // 이미 동일한 저장소를 사용 중이면 동기화 불필요
        const savedType = localStorage.getItem(LS_STORAGE_TYPE_KEY);
        if (savedType === storageType) {
            return true;
        }

        // IndexedDB에서 localStorage로 마이그레이션 (필요한 경우)
        if (storageType === StorageType.LOCALSTORAGE) {
            try {
                // IndexedDB에 데이터가 있는지 확인 (직접 열기 시도)
                const supportInfo = checkIndexedDBSupport();
                if (!supportInfo.isIndexedDBAvailable) {
                    // IndexedDB를 사용할 수 없으면 마이그레이션 불필요
                    return true;
                }

                const testRequest = indexedDB.open(DB_NAME, DB_VERSION);
                await new Promise((resolve) => {
                    let db = null;
                    
                    testRequest.onsuccess = () => {
                        db = testRequest.result;
                        try {
                            // objectStore가 존재하는지 확인
                            if (!db.objectStoreNames.contains(STORE_NAME)) {
                                db.close();
                                resolve();
                                return;
                            }

                            const transaction = db.transaction([STORE_NAME], 'readonly');
                            const store = transaction.objectStore(STORE_NAME);
                            const getAllRequest = store.getAll();
                            
                            getAllRequest.onsuccess = async () => {
                                const slots = getAllRequest.result;
                                if (slots && slots.length > 0) {
                                    console.log(`IndexedDB에서 ${slots.length}개의 슬롯을 localStorage로 마이그레이션 시작...`);
                                    
                                    // 모든 슬롯을 순차적으로 마이그레이션
                                    for (const slot of slots) {
                                        try {
                                            await storageAdapter.save(slot);
                                        } catch (err) {
                                            console.warn('슬롯 마이그레이션 실패:', slot.slotId, err);
                                        }
                                    }
                                    
                                    console.log('IndexedDB 데이터를 localStorage로 마이그레이션 완료');
                                }
                                db.close();
                                resolve();
                            };
                            
                            getAllRequest.onerror = () => {
                                if (db) db.close();
                                resolve(); // 에러가 나도 계속 진행
                            };
                        } catch (e) {
                            console.warn('IndexedDB 접근 중 오류:', e);
                            if (db) db.close();
                            resolve();
                        }
                    };
                    
                    testRequest.onerror = () => {
                        // IndexedDB가 없거나 열 수 없으면 무시
                        resolve();
                    };
                    
                    testRequest.onupgradeneeded = () => {
                        // 업그레이드 필요하면 무시 (데이터가 없음)
                        resolve();
                    };
                });
            } catch (e) {
                console.warn('데이터 동기화 중 오류 (무시됨):', e);
            }
        }

        return true;
    } catch (error) {
        console.error('저장소 동기화 실패:', error);
        return false;
    }
}

// 모듈 내보내기 (전역 스코프에 함수 추가)
if (typeof window !== 'undefined') {
    window.StorageModule = {
        initDB,
        createSaveSlot,
        getSaveSlot,
        updateSaveSlot,
        deleteSaveSlot,
        listSaveSlots,
        getActiveSlot,
        setActiveSlot,
        loadActiveSlot,
        exportSlotAsFile,
        importSlotFromFile,
        getLatestDiaryDate,
        checkIndexedDBSupport, // 진단 함수도 export
        syncStorageData, // 동기화 함수 추가
        syncWithServer, // 서버 동기화 함수 추가
        autoSave, // 자동 저장 함수 추가
        getStorageType: () => storageAdapter.getStorageType() // 저장소 타입 조회
    };
}

