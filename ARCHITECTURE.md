# Malmoi Architecture

## 개요

매일 23:00, OS crontab이 `claude -p "/malmoi"`를 실행합니다.
Claude Code CLI가 런타임이 되어 전체 파이프라인을 오케스트레이션합니다.
별도의 앱이나 데몬 프로세스는 없습니다.

---

## 에이전트 구성

```
[OS crontab] claude -p "/malmoi"
        │
        ▼
┌─────────────────────────────────────┐
│  Orchestrator                       │
│  skills/malmoi.md                   │
│  모델: claude-sonnet-4-6            │
│                                     │
│  1. Agent 툴 → Log Reader 호출     │
│  2. 결과 → Bash(node analyzer.js)  │
│  3. 결과 → Notion API              │
└──────────────────┬──────────────────┘
                   │ Agent 툴
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────────┐  ┌──────────────────────┐
│  Log Reader       │  │  analyzer.js         │
│  서브에이전트     │  │                      │
│  sonnet-4-6       │  │  ┌────────────────┐  │
│                   │  │  │ Extractor      │  │
│  툴: Glob, Read   │  │  │ opus-4-6       │  │
│      Bash(level)  │  │  │ Step 1-6       │  │
│                   │  │  │ 필터링 + 추출  │  │
│  출력:            │  │  └───────┬────────┘  │
│  오늘의 대화      │  │          │            │
│  텍스트 (문자열)  │  │  ┌───────▼────────┐  │
└───────────────────┘  │  │ Writer         │  │
                       │  │ sonnet-4-6     │  │
                       │  │ Step 7         │  │
                       │  │ 블로그 작성    │  │
                       │  └───────┬────────┘  │
                       │          │            │
                       │     마크다운 반환     │
                       └──────────────────────┘
```

---

## 에이전트 역할 정의

| 에이전트 | 모델 | 입력 | 출력 | 비고 |
|---------|------|------|------|------|
| Orchestrator | sonnet-4-6 | crontab 트리거 | Notion 발행 | skills/malmoi.md |
| Log Reader | sonnet-4-6 | 로그 파일 경로 | 오늘의 대화 텍스트 | 서브에이전트, 인라인 |
| Extractor | opus-4-6 | 대화 텍스트 | 구조화 JSON | MALMOI_RULES.md 적용 |
| Writer | sonnet-4-6 | 구조화 JSON | 마크다운 | 비용 절감 목적 |

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
  - LevelDB: Bash → node -e (level 패키지)
  - 오늘 날짜 기준 필터링
        │
        ▼
[Extractor — Opus]
  시스템 프롬프트: MALMOI_RULES.md
  Step 1: 대화 단위 분절
  Step 2: KEEP / DISCARD 1차 판정
  Step 3: 가치 점수 산정
  Step 4: 7점 이하 재분류
  Step 5: 카테고리별 그룹화 + 중복 통합
  Step 6: 추출 구조 JSON 생성
        │
        ▼
[Writer — Sonnet]
  Step 7: JSON → 마크다운 블로그 포스트
        │
        ▼
[Notion API]
  오늘 날짜 페이지로 발행
```

---

## 파일 구조

```
malmoi/
├── skills/
│   ├── malmoi.md          ← /malmoi       Orchestrator 스킬 (매일 실행)
│   └── malmoi-setup.md    ← /malmoi:setup 최초 설치 스킬
├── prompts/
│   └── MALMOI_RULES.md    ← Extractor 시스템 프롬프트
├── src/
│   └── analyzer.js        ← Extractor(Opus) + Writer(Sonnet) 호출
├── ARCHITECTURE.md        ← 이 파일
└── package.json           ← level 패키지 의존성
```

---

## 팀원 배포

```bash
# 1. OMC 마켓플레이스에서 플러그인 설치
/plugin marketplace add github:seowon/malmoi

# 2. 최초 1회 설정
/malmoi:setup
# → API 키 입력 (Anthropic, Notion)
# → Notion 데이터베이스 ID 입력
# → OS crontab 자동 등록 (매일 23:00)
```

---

## 모델 선택 근거

| 선택 | 이유 |
|------|------|
| Extractor → Opus | KEEP/DISCARD 판단 품질이 전체 가치를 결정함. 비용보다 정확도 우선 |
| Writer → Sonnet | 구조화된 JSON을 글로 변환하는 작업. Sonnet으로 충분, 비용 절감 |
| 나머지 → Sonnet | 오케스트레이션, 로그 파싱은 판단력보다 툴 실행 능력이 중요 |
