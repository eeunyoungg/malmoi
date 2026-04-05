# Malmoi Architecture

## 개요

매일 23:00, OS crontab이 `claude -p "/malmoi"`를 실행합니다.
Claude Code CLI 자체가 AI이므로 별도 API 호출 없이 분석까지 직접 수행합니다.
Node.js 스크립트는 AI가 할 수 없는 작업(LevelDB 파싱, Notion API 발행)에만 사용합니다.

---

## 에이전트 구성

```
[OS crontab] claude -p "/malmoi"
        │
        ▼
┌─────────────────────────────────────────┐
│  Orchestrator                           │
│  skills/malmoi.md                       │
│  Claude Code (추가 과금 없음)            │
│                                         │
│  1. Read → MALMOI_RULES.md 로드        │
│  2. Agent → Log Reader 서브에이전트     │
│  3. 직접 분석 (KEEP/DISCARD + 점수)    │
│  4. 직접 블로그 작성                   │
│  5. Bash → node src/notion.js          │
└──────────────────┬──────────────────────┘
                   │ Agent 툴
                   ▼
        ┌──────────────────────┐
        │  Log Reader          │
        │  서브에이전트        │
        │                      │
        │  Glob: JSONL 탐색    │
        │  Read: JSONL 파싱    │
        │  Bash: read-leveldb  │
        │                      │
        │  → 오늘 대화 텍스트  │
        └──────────────────────┘
```

---

## 에이전트 역할 정의

| 에이전트 | 역할 | 비고 |
|---------|------|------|
| Orchestrator | 전체 흐름 제어, 분석, 블로그 작성 | skills/malmoi.md, 추가 과금 없음 |
| Log Reader | JSONL + LevelDB 수집 | 서브에이전트, 인라인 |

---

## 데이터 흐름

```
[로그 소스]
~/.claude/projects/**/*.jsonl          ← Claude Code CLI 대화
~/Library/Application Support/Claude/
  IndexedDB/https_claude.ai_0.indexeddb.leveldb/  ← Claude 데스크탑 앱 대화
        │
        ▼
[Log Reader 서브에이전트]
  - JSONL: Glob + Read 툴로 직접 파싱
  - LevelDB: Bash → node src/read-leveldb.js
  - 오늘 날짜 기준 필터링
        │
        ▼
[Orchestrator — 직접 분석]
  MALMOI_RULES.md 기준:
  Step 1: 대화 단위 분절
  Step 2: KEEP / DISCARD 1차 판정
  Step 3: 가치 점수 산정
  Step 4: 7점 이하 재분류
  Step 5: 카테고리별 그룹화 + 중복 통합
  Step 6: 추출 구조 JSON 생성
  Step 7: 마크다운 블로그 포스트 작성
        │
        ▼
[node src/notion.js]
  마크다운 → Notion 블록 변환 → API 발행
        │
        ▼
[Notion 페이지]
  오늘 날짜로 발행
```

---

## 파일 구조

```
malmoi/
├── skills/
│   ├── malmoi.md          ← /malmoi       Orchestrator 스킬 (매일 실행)
│   └── malmoi-setup.md    ← /malmoi:setup 최초 설치 스킬
├── prompts/
│   └── MALMOI_RULES.md    ← 분석 기준 (Orchestrator가 직접 읽고 적용)
├── src/
│   ├── read-leveldb.js    ← Claude 데스크탑 앱 LevelDB 파싱
│   └── notion.js          ← 마크다운 → Notion API 발행
├── ARCHITECTURE.md
└── package.json           ← level 패키지만 의존
```

---

## 팀원 배포

```bash
# 1. OMC 마켓플레이스에서 플러그인 설치
/plugin marketplace add github:eeunyoungg/malmoi

# 2. 최초 1회 설정
/malmoi:setup
# → Notion API 키 입력
# → Notion 데이터베이스 ID 입력
# → OS crontab 자동 등록 (매일 23:00)
```

---

## 기존 대비 변경점

| 항목 | 이전 | 현재 |
|------|------|------|
| 분석 주체 | `analyzer.js` (Opus API 호출) | Orchestrator 직접 수행 |
| 블로그 작성 | `run.js` (Sonnet API 호출) | Orchestrator 직접 수행 |
| 추가 API 비용 | Opus + Sonnet 호출 비용 발생 | 없음 |
| 필요 키 | Anthropic API 키 + Notion 키 | Notion 키만 필요 |
| 의존 패키지 | `@anthropic-ai/sdk`, `level` | `level`만 |
