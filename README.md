# Malmoi

> 하루의 Claude 대화 로그에서 가치 있는 인사이트만 추려 Notion에 자동 발행합니다.

Product Designer / 기획자를 위한 일일 AI 대화 큐레이터.  
코드 디버깅이나 단순 질문은 버리고, **제품 결정·구조 설계·제약 발견·UX 수정** 등 나중에 다시 꺼내볼 내용만 남깁니다.

---

## 작동 방식

```
매일 23:00
OS crontab → claude -p "/malmoi"
    │
    ├── Log Reader (서브에이전트)
    │     JSONL + LevelDB → 오늘의 대화 수집
    │
    ├── Extractor (claude-opus-4-6)
    │     MALMOI_RULES.md 기준으로 KEEP / DISCARD 판정
    │     가치 점수 산정 → 구조화 JSON 추출
    │
    ├── Writer (claude-sonnet-4-6)
    │     JSON → 마크다운 블로그 포스트
    │
    └── Notion API
          오늘 날짜 페이지로 발행
```

**로그 소스:**
- Claude Code CLI: `~/.claude/projects/**/*.jsonl`
- Claude 데스크탑 앱: `~/Library/Application Support/Claude/IndexedDB/` (LevelDB)

---

## 설치

```bash
/plugin marketplace add github:seowon/malmoi
```

최초 1회 설정:

```bash
/malmoi:setup
```

설정 항목:
- Anthropic API 키
- Notion Integration 토큰
- Notion 데이터베이스 ID

설정 완료 후 매일 23:00에 자동 실행됩니다.

---

## 수동 실행

```bash
/malmoi
```

---

## 스킬 목록

| 스킬 | 설명 |
|------|------|
| `/malmoi` | 오늘의 대화 분석 + Notion 발행 |
| `/malmoi:setup` | 최초 설치 및 환경 설정 |

---

## 필터링 기준 (MALMOI_RULES.md)

보존 (`KEEP`):
- 제품/기능 결정 — "왜 이렇게 결정했는가"의 근거가 있는 결론
- 구조/설계 결정 — IA, 메뉴 구조, 화면 흐름 변경
- 범위/우선순위 결정 — 1차 포함/제외 결정
- 제약 조건 발견 — 라이선스, 기술, 비즈니스 한계
- UX 오류 발견 및 수정 — 설계 허점 발견 후 방향 전환
- 조사/검증 결과 — 레퍼런스 분석, 기술 조사

폐기 (`DISCARD`):
- 구현 디버깅, 단순 확인, 파일 작업, 코드 생성, 미완결 탐색

---

## 요구사항

- Claude Code CLI
- Node.js 18+
- Notion 계정 + Integration

---

## 라이선스

MIT
