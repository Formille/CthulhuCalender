// Dexie.js 기반 IndexedDB 저장 모듈
// 게임 데이터를 Dexie.js를 사용하여 IndexedDB에 저장하고 관리하는 모듈

const DB_NAME = 'CalendarAIGameDB';
const DB_VERSION = 2; // slotId 인덱스 추가를 위해 버전 업그레이드
const ACTIVE_SLOT_KEY = 'activeSlotId';

// Dexie 데이터베이스 인스턴스
let db = null;

/**
 * Dexie 데이터베이스 초기화
 */
async function initDexieDB() {
    if (typeof Dexie === 'undefined') {
        const error = new Error('Dexie.js가 로드되지 않았습니다. CDN을 확인해주세요.');
        if (window.DebugLogger) window.DebugLogger.error('Dexie 초기화 실패', error);
        console.error('Dexie 초기화 실패:', error);
        throw error;
    }

    // 이미 열려있으면 재사용 (버전은 Dexie가 자동으로 관리)
    if (db && db.isOpen()) {
        return db;
    }

    db = new Dexie(DB_NAME);
    
    // 버전 1: 초기 스키마 (기존 데이터 마이그레이션용)
    db.version(1).stores({
        gameInfo: 'id',
        weeklyLogs: 'week_number',
        dailyLogs: 'diary_write_date',
        monthlyChapters: 'month',
        prologue: 'id'
    });
    
    // 버전 2: slotId 인덱스 추가
    db.version(DB_VERSION).stores({
        gameInfo: 'id', // id: 'current_save'
        weeklyLogs: 'week_number, slotId', // week_number를 기본 키로, slotId를 인덱스로 추가
        dailyLogs: 'diary_write_date, slotId', // diary_write_date를 기본 키로, slotId를 인덱스로 추가
        monthlyChapters: 'month, slotId', // month를 기본 키로, slotId를 인덱스로 추가
        prologue: 'id' // id: 'prologue'
    }).upgrade(async (tx) => {
        // 버전 1에서 2로 마이그레이션: 기존 데이터에 slotId 추가
        const defaultSlotId = 'slot_default';
        
        // weeklyLogs에 slotId 추가
        await tx.table('weeklyLogs').toCollection().modify(record => {
            if (!record.slotId) {
                record.slotId = defaultSlotId;
            }
        });
        
        // dailyLogs에 slotId 추가
        await tx.table('dailyLogs').toCollection().modify(record => {
            if (!record.slotId) {
                record.slotId = defaultSlotId;
            }
        });
        
        // monthlyChapters에 slotId 추가
        await tx.table('monthlyChapters').toCollection().modify(record => {
            if (!record.slotId) {
                record.slotId = defaultSlotId;
            }
        });
    });

    try {
        await db.open();
        if (window.DebugLogger) window.DebugLogger.info('Dexie 데이터베이스 초기화', { dbName: DB_NAME, version: DB_VERSION });
        console.log('Dexie 데이터베이스 초기화:', { dbName: DB_NAME, version: DB_VERSION });
        return db;
    } catch (error) {
        if (window.DebugLogger) window.DebugLogger.error('Dexie 데이터베이스 열기 실패', error);
        console.error('Dexie 데이터베이스 열기 실패:', error);
        throw error;
    }
}

/**
 * 데이터베이스 초기화 (기존 StorageModule API 호환)
 */
async function initDB() {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('initDB');
    }

    try {
        await initDexieDB();
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('initDB', null, startTime);
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('initDB 실패', error);
            window.DebugLogger.logFunctionExit('initDB', error, startTime);
        }
        console.error('initDB 실패:', error);
        throw error;
    }
}

/**
 * JSON 데이터를 Dexie 구조로 변환하여 저장
 */
async function saveGameDataToDexie(gameData, slotId) {
    // 데이터베이스가 열려있는지 확인하고, 열려있지 않으면 초기화
    if (!db || !db.isOpen()) {
        await initDexieDB();
    }
    
    // 데이터베이스가 제대로 열렸는지 재확인
    if (!db || !db.isOpen()) {
        throw new Error('데이터베이스를 열 수 없습니다.');
    }

    try {
        // 1. gameInfo 저장
        const gameInfoData = {
            id: slotId,
            save_file_info: gameData.save_file_info || {},
            current_state: gameData.current_state || {},
            active_rules: gameData.legacy_inventory?.active_rules || [],
            collected_artifacts: gameData.legacy_inventory?.collected_artifacts || []
        };
        await db.gameInfo.put(gameInfoData);
        
        // 저장 확인
        const savedGameInfo = await db.gameInfo.get(slotId);
        if (!savedGameInfo) {
            throw new Error('gameInfo 저장 실패: 저장 후 확인 불가');
        }

        // 2. weeklyLogs 저장 (기존 데이터 삭제 후 재저장)
        if (gameData.legacy_inventory?.weekly_records) {
            // 해당 슬롯의 기존 주간 기록 삭제 (slotId로 필터링 필요 시)
            const existingWeeks = await db.weeklyLogs.toArray();
            const slotWeeks = existingWeeks.filter(w => w.slotId === slotId);
            if (slotWeeks.length > 0) {
                await db.weeklyLogs.bulkDelete(slotWeeks.map(w => w.week_number));
            }

            // 새 주간 기록 저장
            const weeklyRecords = gameData.legacy_inventory.weekly_records.map(record => ({
                ...record,
                slotId: slotId
            }));
            await db.weeklyLogs.bulkPut(weeklyRecords);
        }

        // 3. dailyLogs 저장 (기존 데이터 삭제 후 재저장)
        if (gameData.campaign_history?.monthly_chapters) {
            // 모든 일일 기록 추출
            const allDailyEntries = [];
            gameData.campaign_history.monthly_chapters.forEach(chapter => {
                if (chapter.daily_entries) {
                    chapter.daily_entries.forEach(entry => {
                        allDailyEntries.push({
                            ...entry,
                            slotId: slotId,
                            month: chapter.month
                        });
                    });
                }
            });

            // 해당 슬롯의 기존 일일 기록 삭제
            if (allDailyEntries.length > 0) {
                const existingDailies = await db.dailyLogs.toArray();
                const slotDailies = existingDailies.filter(d => d.slotId === slotId);
                if (slotDailies.length > 0) {
                    await db.dailyLogs.bulkDelete(slotDailies.map(d => d.diary_write_date));
                }

                // 새 일일 기록 저장
                await db.dailyLogs.bulkPut(allDailyEntries);
            }
        }

        // 4. monthlyChapters 저장 (daily_entries 제외)
        if (gameData.campaign_history?.monthly_chapters) {
            // 해당 슬롯의 기존 월별 챕터 삭제
            const existingChapters = await db.monthlyChapters.toArray();
            const slotChapters = existingChapters.filter(c => c.slotId === slotId);
            if (slotChapters.length > 0) {
                await db.monthlyChapters.bulkDelete(slotChapters.map(c => c.month));
            }

            // 새 월별 챕터 저장 (daily_entries 제외)
            const chapters = gameData.campaign_history.monthly_chapters.map(chapter => {
                const { daily_entries, ...chapterWithoutEntries } = chapter;
                return {
                    ...chapterWithoutEntries,
                    slotId: slotId
                };
            });
            await db.monthlyChapters.bulkPut(chapters);
        }

        // 5. prologue 저장
        if (gameData.campaign_history?.prologue) {
            const prologueData = {
                id: `${slotId}_prologue`,
                slotId: slotId,
                ...gameData.campaign_history.prologue
            };
            await db.prologue.put(prologueData);
            
            // 저장 확인
            const savedPrologue = await db.prologue.get(`${slotId}_prologue`);
            if (!savedPrologue) {
                throw new Error('prologue 저장 실패: 저장 후 확인 불가');
            }
        }

        // 최종 검증: 저장된 데이터 확인
        const verifyGameInfo = await db.gameInfo.get(slotId);
        if (!verifyGameInfo) {
            throw new Error('데이터 저장 검증 실패: gameInfo를 찾을 수 없습니다.');
        }
        
        const verifyPrologue = await db.prologue.get(`${slotId}_prologue`);
        const verifyWeeklyLogs = await db.weeklyLogs.where('slotId').equals(slotId).toArray();
        const verifyDailyLogs = await db.dailyLogs.where('slotId').equals(slotId).toArray();
        const verifyMonthlyChapters = await db.monthlyChapters.where('slotId').equals(slotId).toArray();

        if (window.DebugLogger) {
            window.DebugLogger.info('게임 데이터 Dexie 저장 완료', { 
                slotId,
                hasGameInfo: !!verifyGameInfo,
                hasPrologue: !!verifyPrologue,
                prologueContentLength: verifyPrologue?.content?.length || 0,
                weeklyLogsCount: verifyWeeklyLogs.length,
                dailyLogsCount: verifyDailyLogs.length,
                monthlyChaptersCount: verifyMonthlyChapters.length,
                campaignYear: verifyGameInfo?.save_file_info?.campaign_year,
                todayDate: verifyGameInfo?.current_state?.today_date
            });
        }
        
        // 저장 직후 다시 읽어서 검증
        const reloadedData = await loadGameDataFromDexie(slotId);
        if (!reloadedData) {
            throw new Error('저장 후 재로드 검증 실패: 데이터를 다시 읽을 수 없습니다.');
        }
        
        if (window.DebugLogger) {
            window.DebugLogger.info('저장 후 재로드 검증 성공', {
                slotId,
                hasData: !!reloadedData,
                campaignYear: reloadedData?.save_file_info?.campaign_year,
                prologueContentLength: reloadedData?.campaign_history?.prologue?.content?.length || 0
            });
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('게임 데이터 Dexie 저장 실패', error);
        }
        console.error('게임 데이터 Dexie 저장 실패:', error);
        throw error;
    }
}

/**
 * Dexie 구조에서 JSON 형식으로 데이터 복원
 */
async function loadGameDataFromDexie(slotId) {
    if (!db || !db.isOpen()) {
        await initDexieDB();
    }

    try {
        if (window.DebugLogger) {
            window.DebugLogger.info('loadGameDataFromDexie 시작', { slotId, dbIsOpen: db?.isOpen() });
        }
        
        // 1. gameInfo 로드
        const gameInfo = await db.gameInfo.get(slotId);
        if (window.DebugLogger) {
            window.DebugLogger.info('gameInfo 로드 결과', { 
                slotId, 
                found: !!gameInfo,
                hasSaveFileInfo: !!gameInfo?.save_file_info,
                hasCurrentState: !!gameInfo?.current_state
            });
        }
        if (!gameInfo) {
            if (window.DebugLogger) {
                window.DebugLogger.warn('gameInfo를 찾을 수 없음', { slotId });
            }
            return null;
        }

        // 2. weeklyLogs 로드
        const weeklyLogs = await db.weeklyLogs.where('slotId').equals(slotId).toArray();
        weeklyLogs.sort((a, b) => a.week_number - b.week_number);

        // 3. dailyLogs 로드
        const dailyLogs = await db.dailyLogs.where('slotId').equals(slotId).toArray();
        dailyLogs.sort((a, b) => new Date(a.diary_write_date) - new Date(b.diary_write_date));

        // 4. monthlyChapters 로드
        const monthlyChapters = await db.monthlyChapters.where('slotId').equals(slotId).toArray();
        monthlyChapters.sort((a, b) => {
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
            return months.indexOf(a.month) - months.indexOf(b.month);
        });

        // 5. dailyLogs를 월별 챕터에 재배치
        monthlyChapters.forEach(chapter => {
            chapter.daily_entries = dailyLogs
                .filter(entry => entry.month === chapter.month)
                .map(({ slotId, month, ...entry }) => entry); // slotId, month 제거
        });

        // 6. prologue 로드
        const prologueData = await db.prologue.get(`${slotId}_prologue`);
        const prologue = prologueData ? (() => {
            const { id, slotId, ...prologueContent } = prologueData;
            return prologueContent;
        })() : null;

        if (window.DebugLogger) {
            window.DebugLogger.info('데이터 로드 완료', {
                slotId,
                weeklyLogsCount: weeklyLogs.length,
                dailyLogsCount: dailyLogs.length,
                monthlyChaptersCount: monthlyChapters.length,
                hasPrologue: !!prologue,
                prologueContentLength: prologue?.content?.length || 0
            });
        }

        // 7. JSON 구조로 재구성
        const gameData = {
            save_file_info: gameInfo.save_file_info,
            current_state: gameInfo.current_state,
            legacy_inventory: {
                description: "달력이 넘어갈 때마다 추가되어 연말까지 유지되는 요소들",
                active_rules: gameInfo.active_rules || [],
                collected_artifacts: gameInfo.collected_artifacts || [],
                weekly_records: weeklyLogs.map(({ slotId, ...record }) => record) // slotId 제거
            },
            campaign_history: {
                description: "지나간 에피소드들의 요약 및 상세 기록",
                monthly_chapters: monthlyChapters.map(({ slotId, ...chapter }) => chapter), // slotId 제거
                prologue: prologue || {
                    date: "",
                    content: "",
                    is_finalized: false
                }
            }
        };

        if (window.DebugLogger) {
            window.DebugLogger.info('게임 데이터 재구성 완료', {
                slotId,
                hasSaveFileInfo: !!gameData.save_file_info,
                hasCurrentState: !!gameData.current_state,
                hasCampaignHistory: !!gameData.campaign_history,
                prologueContentLength: gameData.campaign_history?.prologue?.content?.length || 0
            });
        }

        return gameData;
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('게임 데이터 Dexie 로드 실패', error);
        }
        console.error('게임 데이터 Dexie 로드 실패:', error);
        throw error;
    }
}

/**
 * 슬롯 생성 (기존 StorageModule API 호환)
 */
async function createSaveSlot(gameData) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('createSaveSlot', { 
            campaignYear: gameData?.save_file_info?.campaign_year 
        });
    }

    try {
        if (!db || !db.isOpen()) {
            await initDexieDB();
        }

        // 슬롯 ID 생성
        const slotId = `slot_${Date.now()}`;
        const savedAt = new Date().toISOString();

        // gameData에 메타데이터 추가
        const slotData = {
            ...gameData,
            slotId: slotId,
            savedAt: savedAt,
            createdAt: savedAt,
            campaignYear: gameData.save_file_info?.campaign_year || 1925,
            playerName: gameData.save_file_info?.player_name || 'John Miller'
        };

        // Dexie에 저장
        await saveGameDataToDexie(slotData, slotId);

        // 최신 일기 날짜 가져오기
        let latestDiaryDate = null;
        try {
            latestDiaryDate = await getLatestDiaryDate(slotId);
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.warn('최신 일기 날짜 조회 실패', error);
            }
        }

        // 슬롯 목록에 추가 (localStorage에 메타데이터만 저장)
        const slotsList = JSON.parse(localStorage.getItem('CalendarAIGameDB_slots') || '[]');
        slotsList.push({
            slotId: slotId,
            campaignYear: slotData.campaignYear,
            playerName: slotData.playerName,
            savedAt: savedAt,
            createdAt: savedAt,
            latestDiaryDate: latestDiaryDate
        });
        slotsList.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        localStorage.setItem('CalendarAIGameDB_slots', JSON.stringify(slotsList));

        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('createSaveSlot', slotId, startTime);
        }

        return slotId;
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('createSaveSlot 실패', error);
            window.DebugLogger.logFunctionExit('createSaveSlot', error, startTime);
        }
        console.error('createSaveSlot 실패:', error);
        throw error;
    }
}

/**
 * 슬롯 로드 (기존 StorageModule API 호환)
 */
async function getSaveSlot(slotId) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('getSaveSlot', { slotId });
    }

    try {
        if (!db || !db.isOpen()) {
            await initDexieDB();
        }

        const gameData = await loadGameDataFromDexie(slotId);
        
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('getSaveSlot', gameData ? 'success' : 'not found', startTime);
            if (gameData) {
                window.DebugLogger.info('getSaveSlot 성공', {
                    slotId,
                    hasGameData: !!gameData,
                    campaignYear: gameData?.save_file_info?.campaign_year,
                    todayDate: gameData?.current_state?.today_date,
                    hasPrologue: !!gameData?.campaign_history?.prologue,
                    prologueContentLength: gameData?.campaign_history?.prologue?.content?.length || 0
                });
            } else {
                window.DebugLogger.warn('getSaveSlot 실패: 데이터 없음', { slotId });
            }
        }

        return gameData;
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('getSaveSlot 실패', error);
            window.DebugLogger.logFunctionExit('getSaveSlot', error, startTime);
        }
        console.error('getSaveSlot 실패:', error);
        throw error;
    }
}

/**
 * 슬롯 업데이트 (기존 StorageModule API 호환)
 */
async function updateSaveSlot(slotId, gameData) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('updateSaveSlot', { slotId });
    }

    try {
        if (!db || !db.isOpen()) {
            await initDexieDB();
        }

        // 기존 슬롯 확인
        const existing = await db.gameInfo.get(slotId);
        if (!existing) {
            throw new Error(`슬롯을 찾을 수 없습니다: ${slotId}`);
        }

        // 업데이트된 데이터 저장
        const updatedData = {
            ...gameData,
            slotId: slotId,
            savedAt: new Date().toISOString(),
            campaignYear: gameData.save_file_info?.campaign_year || existing.campaignYear,
            playerName: gameData.save_file_info?.player_name || existing.playerName
        };

        await saveGameDataToDexie(updatedData, slotId);

        // 최신 일기 날짜 가져오기
        let latestDiaryDate = null;
        try {
            latestDiaryDate = await getLatestDiaryDate(slotId);
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.warn('최신 일기 날짜 조회 실패', error);
            }
        }

        // 슬롯 목록 업데이트
        const slotsList = JSON.parse(localStorage.getItem('CalendarAIGameDB_slots') || '[]');
        const index = slotsList.findIndex(s => s.slotId === slotId);
        if (index >= 0) {
            slotsList[index].savedAt = updatedData.savedAt;
            slotsList[index].campaignYear = updatedData.campaignYear;
            slotsList[index].playerName = updatedData.playerName;
            if (latestDiaryDate) {
                slotsList[index].latestDiaryDate = latestDiaryDate;
            }
            slotsList.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
            localStorage.setItem('CalendarAIGameDB_slots', JSON.stringify(slotsList));
        }

        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('updateSaveSlot', null, startTime);
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('updateSaveSlot 실패', error);
            window.DebugLogger.logFunctionExit('updateSaveSlot', error, startTime);
        }
        console.error('updateSaveSlot 실패:', error);
        throw error;
    }
}

/**
 * 슬롯 삭제 (기존 StorageModule API 호환)
 */
async function deleteSaveSlot(slotId) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('deleteSaveSlot', { slotId });
    }

    try {
        if (!db || !db.isOpen()) {
            await initDexieDB();
        }

        // 모든 관련 데이터 삭제
        await db.gameInfo.delete(slotId);
        await db.weeklyLogs.where('slotId').equals(slotId).delete();
        await db.dailyLogs.where('slotId').equals(slotId).delete();
        await db.monthlyChapters.where('slotId').equals(slotId).delete();
        await db.prologue.delete(`${slotId}_prologue`);

        // 슬롯 목록에서 제거
        const slotsList = JSON.parse(localStorage.getItem('CalendarAIGameDB_slots') || '[]');
        const filtered = slotsList.filter(s => s.slotId !== slotId);
        localStorage.setItem('CalendarAIGameDB_slots', JSON.stringify(filtered));

        // 활성 슬롯이 삭제된 경우 초기화
        const activeSlotId = localStorage.getItem(ACTIVE_SLOT_KEY);
        if (activeSlotId === slotId) {
            localStorage.removeItem(ACTIVE_SLOT_KEY);
        }

        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('deleteSaveSlot', null, startTime);
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('deleteSaveSlot 실패', error);
            window.DebugLogger.logFunctionExit('deleteSaveSlot', error, startTime);
        }
        console.error('deleteSaveSlot 실패:', error);
        throw error;
    }
}

/**
 * 슬롯 목록 조회 (기존 StorageModule API 호환)
 */
async function listSaveSlots() {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('listSaveSlots');
    }

    try {
        const slotsList = JSON.parse(localStorage.getItem('CalendarAIGameDB_slots') || '[]');
        
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('listSaveSlots', { count: slotsList.length }, startTime);
        }

        return slotsList;
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('listSaveSlots 실패', error);
            window.DebugLogger.logFunctionExit('listSaveSlots', error, startTime);
        }
        console.error('listSaveSlots 실패:', error);
        throw error;
    }
}

/**
 * 활성 슬롯 ID 조회 (기존 StorageModule API 호환)
 */
async function getActiveSlot() {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('getActiveSlot');
    }

    try {
        const activeSlotId = localStorage.getItem(ACTIVE_SLOT_KEY);
        
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('getActiveSlot', activeSlotId, startTime);
        }

        return activeSlotId;
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('getActiveSlot 실패', error);
            window.DebugLogger.logFunctionExit('getActiveSlot', error, startTime);
        }
        console.error('getActiveSlot 실패:', error);
        throw error;
    }
}

/**
 * 활성 슬롯 설정 (기존 StorageModule API 호환)
 */
async function setActiveSlot(slotId) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('setActiveSlot', { slotId });
    }

    try {
        localStorage.setItem(ACTIVE_SLOT_KEY, slotId);
        
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('setActiveSlot', null, startTime);
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('setActiveSlot 실패', error);
            window.DebugLogger.logFunctionExit('setActiveSlot', error, startTime);
        }
        console.error('setActiveSlot 실패:', error);
        throw error;
    }
}

/**
 * 활성 슬롯 로드 (기존 StorageModule API 호환)
 */
async function loadActiveSlot() {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('loadActiveSlot');
    }

    try {
        const activeSlotId = await getActiveSlot();
        if (!activeSlotId) {
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('loadActiveSlot', null, startTime);
            }
            return null;
        }

        const gameData = await getSaveSlot(activeSlotId);
        
        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('loadActiveSlot', gameData ? 'success' : 'not found', startTime);
        }

        return gameData;
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('loadActiveSlot 실패', error);
            window.DebugLogger.logFunctionExit('loadActiveSlot', error, startTime);
        }
        console.error('loadActiveSlot 실패:', error);
        throw error;
    }
}

/**
 * 일지 날짜 기준으로 백업 파일명 생성
 * @param {string} latestDiaryDate - 최신 일지 날짜 (YYYY-MM-DD 형식)
 * @returns {string} 파일명 (diary_until_{month}_{day}.json)
 */
function generateBackupFileName(latestDiaryDate) {
    if (!latestDiaryDate) {
        return 'diary_until_unknown.json';
    }
    
    try {
        const date = new Date(latestDiaryDate);
        const month = date.getMonth() + 1; // 0-based이므로 +1
        const day = date.getDate();
        return `diary_until_${month}_${day}.json`;
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.warn('날짜 파싱 실패, 기본 파일명 사용', { latestDiaryDate, error });
        }
        return 'diary_until_unknown.json';
    }
}

/**
 * IndexedDB의 모든 원시 데이터를 가져오기
 * @param {string} slotId - 슬롯 ID
 * @returns {Object} IndexedDB의 모든 테이블 데이터를 포함한 객체
 */
async function getAllIndexedDBData(slotId) {
    if (!db || !db.isOpen()) {
        await initDexieDB();
    }

    try {
        // 모든 테이블에서 해당 slotId의 데이터 가져오기
        const gameInfo = await db.gameInfo.get(slotId);
        const weeklyLogs = await db.weeklyLogs.where('slotId').equals(slotId).toArray();
        const dailyLogs = await db.dailyLogs.where('slotId').equals(slotId).toArray();
        const monthlyChapters = await db.monthlyChapters.where('slotId').equals(slotId).toArray();
        const prologue = await db.prologue.get(`${slotId}_prologue`);

        return {
            gameInfo: gameInfo || null,
            weeklyLogs: weeklyLogs || [],
            dailyLogs: dailyLogs || [],
            monthlyChapters: monthlyChapters || [],
            prologue: prologue || null
        };
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('getAllIndexedDBData 실패', error);
        }
        console.error('getAllIndexedDBData 실패:', error);
        throw error;
    }
}

/**
 * 슬롯을 파일로 내보내기 (IndexedDB의 모든 원시 데이터 포함)
 */
async function exportSlotAsFile(slotId) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('exportSlotAsFile', { slotId });
    }

    try {
        if (!db || !db.isOpen()) {
            await initDexieDB();
        }

        // IndexedDB의 모든 원시 데이터 가져오기
        const indexedDBData = await getAllIndexedDBData(slotId);
        
        if (!indexedDBData.gameInfo) {
            throw new Error(`슬롯을 찾을 수 없습니다: ${slotId}`);
        }

        // 최신 일지 날짜 가져오기
        const latestDiaryDate = await getLatestDiaryDate(slotId);
        const fileName = generateBackupFileName(latestDiaryDate);

        // IndexedDB의 모든 원시 데이터를 JSON으로 변환
        const backupData = {
            slotId: slotId,
            exportedAt: new Date().toISOString(),
            indexedDBVersion: DB_VERSION,
            data: indexedDBData
        };

        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('exportSlotAsFile', null, startTime);
            window.DebugLogger.info('백업 데이터 내보내기 완료', {
                slotId,
                gameInfo: !!indexedDBData.gameInfo,
                weeklyLogsCount: indexedDBData.weeklyLogs.length,
                dailyLogsCount: indexedDBData.dailyLogs.length,
                monthlyChaptersCount: indexedDBData.monthlyChapters.length,
                prologue: !!indexedDBData.prologue
            });
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('exportSlotAsFile 실패', error);
            window.DebugLogger.logFunctionExit('exportSlotAsFile', error, startTime);
        }
        console.error('exportSlotAsFile 실패:', error);
        throw error;
    }
}

/**
 * IndexedDB 원시 데이터를 직접 저장소에 복원
 * @param {Object} indexedDBData - IndexedDB 원시 데이터
 * @param {string} targetSlotId - 대상 슬롯 ID (없으면 새로 생성)
 */
async function restoreIndexedDBData(indexedDBData, targetSlotId = null) {
    if (!db || !db.isOpen()) {
        await initDexieDB();
    }

    try {
        const slotId = targetSlotId || `slot_${Date.now()}`;

        // gameInfo 저장
        if (indexedDBData.gameInfo) {
            const gameInfoData = {
                ...indexedDBData.gameInfo,
                id: slotId
            };
            await db.gameInfo.put(gameInfoData);
        }

        // weeklyLogs 저장
        if (indexedDBData.weeklyLogs && indexedDBData.weeklyLogs.length > 0) {
            const weeklyRecords = indexedDBData.weeklyLogs.map(record => ({
                ...record,
                slotId: slotId
            }));
            // 기존 데이터 삭제 후 저장
            const existingWeeks = await db.weeklyLogs.where('slotId').equals(slotId).toArray();
            if (existingWeeks.length > 0) {
                await db.weeklyLogs.bulkDelete(existingWeeks.map(w => w.week_number));
            }
            await db.weeklyLogs.bulkPut(weeklyRecords);
        }

        // dailyLogs 저장
        if (indexedDBData.dailyLogs && indexedDBData.dailyLogs.length > 0) {
            const dailyRecords = indexedDBData.dailyLogs.map(record => ({
                ...record,
                slotId: slotId
            }));
            // 기존 데이터 삭제 후 저장
            const existingDailies = await db.dailyLogs.where('slotId').equals(slotId).toArray();
            if (existingDailies.length > 0) {
                await db.dailyLogs.bulkDelete(existingDailies.map(d => d.diary_write_date));
            }
            await db.dailyLogs.bulkPut(dailyRecords);
        }

        // monthlyChapters 저장
        if (indexedDBData.monthlyChapters && indexedDBData.monthlyChapters.length > 0) {
            const chapters = indexedDBData.monthlyChapters.map(chapter => ({
                ...chapter,
                slotId: slotId
            }));
            // 기존 데이터 삭제 후 저장
            const existingChapters = await db.monthlyChapters.where('slotId').equals(slotId).toArray();
            if (existingChapters.length > 0) {
                await db.monthlyChapters.bulkDelete(existingChapters.map(c => c.month));
            }
            await db.monthlyChapters.bulkPut(chapters);
        }

        // prologue 저장
        if (indexedDBData.prologue) {
            const prologueData = {
                ...indexedDBData.prologue,
                id: `${slotId}_prologue`,
                slotId: slotId
            };
            await db.prologue.put(prologueData);
        }

        // 슬롯 목록에 추가/업데이트
        const slotsList = JSON.parse(localStorage.getItem('CalendarAIGameDB_slots') || '[]');
        const existingIndex = slotsList.findIndex(s => s.slotId === slotId);
        
        const slotMeta = {
            slotId: slotId,
            campaignYear: indexedDBData.gameInfo?.save_file_info?.campaign_year || 1925,
            playerName: indexedDBData.gameInfo?.save_file_info?.player_name || 'John Miller',
            savedAt: new Date().toISOString(),
            createdAt: existingIndex >= 0 ? slotsList[existingIndex].createdAt : new Date().toISOString()
        };

        // 최신 일기 날짜 가져오기
        try {
            const latestDiaryDate = await getLatestDiaryDate(slotId);
            if (latestDiaryDate) {
                slotMeta.latestDiaryDate = latestDiaryDate;
            }
        } catch (error) {
            if (window.DebugLogger) {
                window.DebugLogger.warn('최신 일기 날짜 조회 실패', error);
            }
        }

        if (existingIndex >= 0) {
            slotsList[existingIndex] = slotMeta;
        } else {
            slotsList.push(slotMeta);
        }
        slotsList.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        localStorage.setItem('CalendarAIGameDB_slots', JSON.stringify(slotsList));

        return slotId;
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('restoreIndexedDBData 실패', error);
        }
        console.error('restoreIndexedDBData 실패:', error);
        throw error;
    }
}

/**
 * 파일에서 슬롯 가져오기 (새 백업 형식 및 기존 형식 모두 지원)
 */
async function importSlotFromFile(file, overwrite = false, targetSlotId = null) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('importSlotFromFile', { fileName: file.name, overwrite, targetSlotId });
    }

    try {
        const text = await file.text();
        const parsedData = JSON.parse(text);

        // 새 백업 형식인지 확인 (data 필드가 있고 indexedDBVersion이 있는 경우)
        if (parsedData.data && parsedData.indexedDBVersion !== undefined) {
            if (window.DebugLogger) {
                window.DebugLogger.info('새 백업 형식 감지', { 
                    slotId: parsedData.slotId,
                    exportedAt: parsedData.exportedAt,
                    indexedDBVersion: parsedData.indexedDBVersion
                });
            }

            // IndexedDB 원시 데이터 직접 복원
            const slotId = await restoreIndexedDBData(parsedData.data, targetSlotId || parsedData.slotId);
            
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('importSlotFromFile', slotId, startTime);
            }
            return slotId;
        } else {
            // 기존 형식 (게임 데이터 직접)
            if (window.DebugLogger) {
                window.DebugLogger.info('기존 백업 형식 감지');
            }

            if (targetSlotId) {
                if (overwrite) {
                    await updateSaveSlot(targetSlotId, parsedData);
                } else {
                    throw new Error('슬롯이 이미 존재합니다.');
                }
            } else {
                await createSaveSlot(parsedData);
            }

            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('importSlotFromFile', null, startTime);
            }
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('importSlotFromFile 실패', error);
            window.DebugLogger.logFunctionExit('importSlotFromFile', error, startTime);
        }
        console.error('importSlotFromFile 실패:', error);
        throw error;
    }
}

/**
 * 최신 일기 날짜 조회 (기존 StorageModule API 호환)
 */
async function getLatestDiaryDate(slotId) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('getLatestDiaryDate', { slotId });
    }

    try {
        if (!db || !db.isOpen()) {
            await initDexieDB();
        }

        const dailyLogs = await db.dailyLogs.where('slotId').equals(slotId).toArray();
        if (dailyLogs.length === 0) {
            if (window.DebugLogger) {
                window.DebugLogger.logFunctionExit('getLatestDiaryDate', null, startTime);
            }
            return null;
        }

        dailyLogs.sort((a, b) => new Date(b.diary_write_date) - new Date(a.diary_write_date));
        const latestDate = dailyLogs[0].diary_write_date;

        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('getLatestDiaryDate', latestDate, startTime);
        }

        return latestDate;
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('getLatestDiaryDate 실패', error);
            window.DebugLogger.logFunctionExit('getLatestDiaryDate', error, startTime);
        }
        console.error('getLatestDiaryDate 실패:', error);
        throw error;
    }
}

/**
 * IndexedDB 지원 여부 확인 (기존 StorageModule API 호환)
 */
function checkIndexedDBSupport() {
    const isSecureContext = window.isSecureContext || 
                           location.protocol === 'https:' || 
                           location.hostname === 'localhost' || 
                           location.hostname === '127.0.0.1';
    
    const isIndexedDBAvailable = typeof indexedDB !== 'undefined' && indexedDB !== null;
    
    return {
        isSecureContext,
        isIndexedDBAvailable,
        protocol: location.protocol,
        hostname: location.hostname
    };
}

/**
 * 저장소 동기화 (기존 StorageModule API 호환 - 빈 구현)
 */
async function syncStorageData() {
    if (window.DebugLogger) {
        window.DebugLogger.info('syncStorageData 호출 (구현 없음)');
    }
    // Dexie.js는 자동으로 IndexedDB와 동기화되므로 별도 구현 불필요
}

/**
 * 서버 동기화 (기존 StorageModule API 호환 - 빈 구현)
 */
async function syncWithServer(slotId, direction = 'both') {
    if (window.DebugLogger) {
        window.DebugLogger.info('syncWithServer 호출 (구현 없음)', { slotId, direction });
    }
    // 서버 동기화는 별도 구현 필요 시 추가
}

/**
 * 자동 저장 (기존 StorageModule API 호환)
 */
async function autoSave(gameData, slotId) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('autoSave', { slotId });
    }

    try {
        if (slotId) {
            await updateSaveSlot(slotId, gameData);
        } else {
            const newSlotId = await createSaveSlot(gameData);
            await setActiveSlot(newSlotId);
        }

        if (window.DebugLogger) {
            window.DebugLogger.logFunctionExit('autoSave', null, startTime);
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('autoSave 실패', error);
            window.DebugLogger.logFunctionExit('autoSave', error, startTime);
        }
        console.error('autoSave 실패:', error);
        throw error;
    }
}

/**
 * 저장소 타입 조회 (기존 StorageModule API 호환)
 */
function getStorageType() {
    return 'dexie';
}

/**
 * JSON 데이터를 Dexie 구조로 마이그레이션
 * @param {Object} jsonData - 기존 JSON 형식의 게임 데이터
 * @param {string} slotId - 슬롯 ID
 */
async function migrateFromJson(jsonData, slotId) {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('migrateFromJson', { slotId });
        window.DebugLogger.info('마이그레이션 시작', { 
            slotId, 
            hasWeeklyRecords: !!jsonData.legacy_inventory?.weekly_records,
            monthlyChaptersCount: jsonData.campaign_history?.monthly_chapters?.length || 0
        });
    }

    try {
        if (!db || !db.isOpen()) {
            await initDexieDB();
        }

        // 기존 데이터가 있는지 확인
        const existing = await db.gameInfo.get(slotId);
        if (existing) {
            if (window.DebugLogger) {
                window.DebugLogger.warn('마이그레이션: 기존 슬롯이 존재합니다. 덮어씁니다.', { slotId });
            }
        }

        // JSON 데이터를 Dexie 구조로 저장
        await saveGameDataToDexie(jsonData, slotId);

        // 마이그레이션 검증
        const migrated = await loadGameDataFromDexie(slotId);
        if (!migrated) {
            throw new Error('마이그레이션 검증 실패: 데이터를 로드할 수 없습니다.');
        }

        // 기본 검증: 필수 필드 확인
        if (!migrated.save_file_info || !migrated.current_state) {
            throw new Error('마이그레이션 검증 실패: 필수 필드가 누락되었습니다.');
        }

        if (window.DebugLogger) {
            window.DebugLogger.info('마이그레이션 완료', { 
                slotId,
                weeklyRecordsCount: migrated.legacy_inventory?.weekly_records?.length || 0,
                monthlyChaptersCount: migrated.campaign_history?.monthly_chapters?.length || 0,
                dailyEntriesCount: migrated.campaign_history?.monthly_chapters?.reduce((sum, ch) => sum + (ch.daily_entries?.length || 0), 0) || 0
            });
            window.DebugLogger.logFunctionExit('migrateFromJson', null, startTime);
        }

        return migrated;
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('마이그레이션 실패', error);
            window.DebugLogger.logFunctionExit('migrateFromJson', error, startTime);
        }
        console.error('마이그레이션 실패:', error);
        throw error;
    }
}

/**
 * 기존 JSON 파일에서 자동 마이그레이션
 * localStorage나 IndexedDB의 기존 저장소에서 데이터를 찾아 마이그레이션
 */
async function autoMigrateFromLegacyStorage() {
    const startTime = Date.now();
    if (window.DebugLogger) {
        window.DebugLogger.logFunctionEntry('autoMigrateFromLegacyStorage');
    }

    try {
        if (!db || !db.isOpen()) {
            await initDexieDB();
        }

        // 기존 localStorage에서 슬롯 목록 확인
        const legacySlots = JSON.parse(localStorage.getItem('CalendarAIGameDB_slots') || '[]');
        if (legacySlots.length === 0) {
            if (window.DebugLogger) {
                window.DebugLogger.info('마이그레이션할 기존 슬롯이 없습니다.');
                window.DebugLogger.logFunctionExit('autoMigrateFromLegacyStorage', null, startTime);
            }
            return;
        }

        // 기존 IndexedDB에서 데이터 확인 (storage.js 방식)
        // 주의: 이 부분은 기존 storage.js가 사용하던 IndexedDB 구조를 확인
        // 실제로는 기존 storage.js의 데이터를 읽어와야 하지만,
        // 여기서는 Dexie로 직접 접근할 수 없으므로 스킵
        // 대신 사용자가 수동으로 import하도록 안내

        if (window.DebugLogger) {
            window.DebugLogger.info('자동 마이그레이션 완료', { 
                legacySlotsCount: legacySlots.length 
            });
            window.DebugLogger.logFunctionExit('autoMigrateFromLegacyStorage', null, startTime);
        }
    } catch (error) {
        if (window.DebugLogger) {
            window.DebugLogger.error('자동 마이그레이션 실패', error);
            window.DebugLogger.logFunctionExit('autoMigrateFromLegacyStorage', error, startTime);
        }
        console.error('자동 마이그레이션 실패:', error);
        throw error;
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
        checkIndexedDBSupport,
        syncStorageData,
        syncWithServer,
        autoSave,
        getStorageType,
        migrateFromJson,
        autoMigrateFromLegacyStorage
    };
}

