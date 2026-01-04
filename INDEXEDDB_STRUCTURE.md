# IndexedDB 데이터 구조 문서

이 문서는 Calendar AI 게임에서 IndexedDB에 저장되는 데이터의 구조를 설명합니다.

## 개요

이 프로젝트는 두 가지 방식으로 IndexedDB를 사용합니다:
1. **storage.js**: 기본 IndexedDB API를 사용한 단순 구조
2. **storage_dexie.js**: Dexie.js 라이브러리를 사용한 구조화된 저장 방식
3. **encounter_cache.js**: 조우 데이터 캐싱용 별도 데이터베이스

---

## 1. 게임 저장 슬롯 데이터베이스

### 1.1 storage.js 방식 (CalendarAIGameDB)

**데이터베이스 정보:**
- **이름**: `CalendarAIGameDB`
- **버전**: `1`
- **Object Store**: `saveSlots`
- **Key Path**: `slotId`

**인덱스:**
- `savedAt` (비고유)
- `campaignYear` (비고유)

**슬롯 데이터 구조:**

```javascript
{
  slotId: string,              // 슬롯 고유 ID (예: "slot_1234567890")
  campaignYear: number,        // 캠페인 연도 (예: 1925)
  playerName: string,          // 플레이어 이름 (예: "John Miller")
  latestDiaryDate: string,     // 최신 일기 날짜 (YYYY-MM-DD 형식)
  savedAt: string,             // 저장 시각 (ISO 8601 형식)
  createdAt: string,           // 생성 시각 (ISO 8601 형식)
  gameData: {                  // 전체 게임 데이터 객체
    save_file_info: {
      campaign_year: number,
      player_name: string,
      last_played: string      // 마지막 플레이 시각 (ISO 8601)
    },
    current_state: {
      today_date: string,      // 현재 게임 날짜 (YYYY-MM-DD)
      madness_level: number,   // 광기 수치 (0-10)
      weekly_success_count: number,  // 주간 성공 횟수
      acquired_artifacts: string[]   // 획득한 유물 목록
    },
    legacy_inventory: {
      description: string,
      active_rules: string[],  // 활성화된 규칙 목록
      collected_artifacts: string[],  // 수집한 유물 목록
      weekly_records: [        // 주간 기록 배열
        {
          week_number: number,
          // 기타 주간 기록 데이터
        }
      ]
    },
    campaign_history: {
      description: string,
      prologue: {
        date: string,
        content: string,
        is_finalized: boolean
      },
      monthly_chapters: [      // 월별 챕터 배열
        {
          month: string,       // "January", "February", etc.
          // 기타 챕터 메타데이터
          daily_entries: [     // 일일 일기 항목 배열
            {
              diary_write_date: string,  // 일기 작성 날짜 (YYYY-MM-DD)
              content: string,          // 일기 내용
              // 기타 일기 데이터
            }
          ]
        }
      ]
    },
    _metadata: {               // 내부 메타데이터 (선택적)
      slotId: string,
      campaignYear: number,
      playerName: string,
      latestDiaryDate: string,
      savedAt: string,
      createdAt: string
    }
  }
}
```

### 1.2 storage_dexie.js 방식 (CalendarAIGameDB)

**데이터베이스 정보:**
- **이름**: `CalendarAIGameDB`
- **버전**: `2`
- **라이브러리**: Dexie.js

**Object Stores:**

#### 1.2.1 gameInfo
- **Key Path**: `id` (slotId 값)
- **저장 데이터**:
```javascript
{
  id: string,                  // slotId
  save_file_info: object,      // 게임 저장 파일 정보
  current_state: object,       // 현재 게임 상태
  active_rules: string[],      // 활성화된 규칙
  collected_artifacts: string[] // 수집한 유물
}
```

#### 1.2.2 weeklyLogs
- **Key Path**: `week_number`
- **인덱스**: `slotId`
- **저장 데이터**:
```javascript
{
  week_number: number,         // 주 번호
  slotId: string,              // 슬롯 ID (인덱스)
  // 기타 주간 기록 데이터
}
```

#### 1.2.3 dailyLogs
- **Key Path**: `diary_write_date`
- **인덱스**: `slotId`
- **저장 데이터**:
```javascript
{
  diary_write_date: string,    // 일기 작성 날짜 (YYYY-MM-DD)
  slotId: string,              // 슬롯 ID (인덱스)
  month: string,               // 월 이름 (예: "January")
  content: string,             // 일기 내용
  // 기타 일기 데이터
}
```

#### 1.2.4 monthlyChapters
- **Key Path**: `month`
- **인덱스**: `slotId`
- **저장 데이터**:
```javascript
{
  month: string,               // 월 이름 (예: "January")
  slotId: string,              // 슬롯 ID (인덱스)
  // 기타 챕터 메타데이터 (daily_entries는 제외)
}
```

#### 1.2.5 prologue
- **Key Path**: `id` (형식: `{slotId}_prologue`)
- **저장 데이터**:
```javascript
{
  id: string,                   // "{slotId}_prologue"
  slotId: string,              // 슬롯 ID
  date: string,
  content: string,
  is_finalized: boolean
}
```

**데이터 재구성:**
- Dexie에서 로드할 때는 위의 구조화된 데이터를 다시 JSON 형식으로 재구성합니다.
- `dailyLogs`의 항목들은 `monthlyChapters`의 `daily_entries`로 재배치됩니다.

---

## 2. 조우 데이터 캐시 데이터베이스

### 2.1 encounter_cache.js (CalendarAICacheDB)

**데이터베이스 정보:**
- **이름**: `CalendarAICacheDB`
- **버전**: `1`
- **Object Store**: `static_data`
- **Key Path**: `key`

**캐시 데이터 구조:**

```javascript
{
  key: string,                  // "CalendarAI_EncounterData" (고정값)
  version: string,              // 캐시 버전 (예: "1.0.0")
  content: {                   // 조우 데이터 내용
    encounters: {               // 조우 데이터 객체
      // 날짜별 조우 정보
      // 예: "2025-01-01": { ... }
    }
  },
  cachedAt: string             // 캐시 저장 시각 (ISO 8601 형식)
}
```

**사용 목적:**
- 서버에서 받은 조우 데이터를 클라이언트에 캐싱
- 오프라인 지원 및 성능 향상
- IndexedDB 실패 시 localStorage로 폴백

---

## 3. localStorage 보조 데이터

IndexedDB와 함께 사용되는 localStorage 항목들:

### 3.1 슬롯 목록 메타데이터
- **키**: `CalendarAIGameDB_slots`
- **형식**: JSON 배열
- **내용**:
```javascript
[
  {
    slotId: string,
    campaignYear: number,
    playerName: string,
    latestDiaryDate: string,
    savedAt: string,
    createdAt: string
  }
]
```

### 3.2 활성 슬롯 ID
- **키**: `activeSlotId`
- **형식**: string (slotId 값)

### 3.3 저장소 타입
- **키**: `CalendarAIGameDB_storageType`
- **형식**: string
- **값**: `"indexeddb"` 또는 `"localstorage"`

---

## 4. 데이터 흐름

### 4.1 저장 흐름
1. 게임 데이터가 JSON 형식으로 준비됨
2. 슬롯 메타데이터 생성 (`slotId`, `savedAt`, `createdAt` 등)
3. IndexedDB에 저장 (또는 localStorage로 폴백)
4. localStorage에 슬롯 목록 메타데이터 업데이트

### 4.2 로드 흐름
1. 슬롯 ID로 IndexedDB에서 데이터 조회
2. `gameData` 객체 반환
3. 애플리케이션 상태에 로드

### 4.3 Dexie 방식의 특별 처리
- 저장 시: JSON 데이터를 5개의 Object Store로 분리 저장
- 로드 시: 5개의 Object Store에서 데이터를 읽어 JSON 형식으로 재구성

---

## 5. 주의사항

1. **데이터베이스 버전 관리**
   - `storage.js`: 버전 1 사용
   - `storage_dexie.js`: 버전 2 사용 (slotId 인덱스 추가)
   - 버전 업그레이드 시 자동 마이그레이션 수행

2. **폴백 메커니즘**
   - IndexedDB 사용 불가 시 자동으로 localStorage로 폴백
   - localStorage는 용량 제한(약 5MB)이 있음

3. **데이터 동기화**
   - `storage.js`와 `storage_dexie.js`는 서로 다른 구조를 사용
   - 마이그레이션 함수 제공 (`migrateFromJson`)

4. **캐시 무효화**
   - 조우 데이터 캐시는 버전 기반으로 관리
   - 버전이 다르면 자동으로 캐시 무효화

---

## 6. 데이터 접근 예시

### 6.1 storage.js 방식
```javascript
// 저장
const slotData = {
  slotId: "slot_1234567890",
  campaignYear: 1925,
  playerName: "John Miller",
  latestDiaryDate: "1925-01-15",
  savedAt: "2024-01-15T10:30:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
  gameData: { /* 게임 데이터 */ }
};
await StorageModule.createSaveSlot(gameData);

// 로드
const gameData = await StorageModule.getSaveSlot("slot_1234567890");
```

### 6.2 storage_dexie.js 방식
```javascript
// 저장 (내부적으로 5개 Object Store에 분리 저장)
await StorageModule.createSaveSlot(gameData);

// 로드 (내부적으로 5개 Object Store에서 재구성)
const gameData = await StorageModule.getSaveSlot("slot_1234567890");
```

### 6.3 조우 데이터 캐시
```javascript
// 캐시에서 로드 (없으면 서버에서 가져와서 캐싱)
const encounterData = await EncounterCache.load();

// 캐시 무효화
await EncounterCache.clearCache();
```

---

## 7. 데이터 크기 고려사항

- **IndexedDB 용량 제한**: 브라우저별로 다르지만 일반적으로 수백 MB ~ 수 GB
- **localStorage 용량 제한**: 약 5-10MB
- **슬롯 데이터 크기**: 게임 진행에 따라 증가 (일기 내용 포함)
- **캐시 데이터 크기**: 조우 데이터는 상대적으로 작음

---

## 8. 마이그레이션

### 8.1 storage.js → storage_dexie.js
- `migrateFromJson` 함수 사용
- JSON 형식의 게임 데이터를 Dexie 구조로 변환

### 8.2 IndexedDB → localStorage
- `syncStorageData` 함수 사용
- IndexedDB 실패 시 자동으로 localStorage로 마이그레이션

---

## 9. 참고 파일

- `static/js/storage.js`: 기본 IndexedDB 저장 모듈
- `static/js/storage_dexie.js`: Dexie.js 기반 저장 모듈
- `static/js/encounter_cache.js`: 조우 데이터 캐시 모듈
- `app/models/game_models.py`: 게임 데이터 모델 정의

