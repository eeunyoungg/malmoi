---
name: run
description: 오늘의 Claude 대화 로그를 수집하고 인사이트를 추출하여 Notion에 발행합니다
---

# /malmoi

오늘 하루의 Claude 대화 로그를 수집하고, 가치 있는 인사이트를 추출하여 Notion에 발행합니다.

---

## 준비: 환경 확인

```bash
cat ~/.malmoi/config 2>/dev/null || echo "CONFIG_MISSING"
```

`CONFIG_MISSING`이면 중단하고 `/malmoi:setup`을 안내하세요.

설정에서 읽어야 할 값:
- `MALMOI_DIR` — 설치 경로
- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`

오늘 날짜 확인:
```bash
date +%Y-%m-%d
```

---

## Step 1: MALMOI_RULES.md 읽기

Read 툴로 `{MALMOI_DIR}/prompts/MALMOI_RULES.md`를 읽으세요.
이 규칙이 이후 분석의 기준입니다.

---

## Step 2: 대화 로그 수집 (Log Reader 서브에이전트)

Agent 툴로 서브에이전트를 호출하세요. 아래 프롬프트를 전달하세요:

---
**[Log Reader 프롬프트]**

오늘 날짜: `{오늘 날짜}`

오늘 하루의 Claude 대화 로그를 수집해서 하나의 텍스트로 반환하세요.

**소스 1 — Claude Code CLI (JSONL)**
1. Glob 툴로 `~/.claude/projects/**/*.jsonl` 전체 탐색
2. 각 파일을 Read 툴로 열어 오늘 날짜로 시작하는 `timestamp` 항목만 추출
3. `type`이 `"user"` 또는 `"assistant"`인 항목의 `message.content`를 순서대로 수집
4. content가 배열이면 text 필드만 합쳐서 문자열로 변환
5. 프로젝트 경로 마지막 부분을 프로젝트명으로 사용

출력 형식:
```
[프로젝트: {프로젝트명}]
---
user: {내용}
assistant: {내용}
---
```

**소스 2 — Claude 데스크탑 앱 (LevelDB)**
```bash
cd {MALMOI_DIR} && node src/read-leveldb.js {오늘 날짜} 2>/dev/null || echo "LEVELDB_SKIP"
```
`LEVELDB_SKIP`이면 건너뛰세요.

**최종 출력**: 소스 1 + 소스 2를 합친 텍스트. 오늘 대화 없으면 `"NO_CONVERSATIONS"`.

---

## Step 3: 로그 없으면 종료

`"NO_CONVERSATIONS"`면:
> 오늘 기록할 대화가 없습니다.
출력 후 종료하세요.

---

## Step 4: 분석 — MALMOI_RULES.md 적용 (직접 수행)

Step 1에서 읽은 MALMOI_RULES.md를 기준으로, Step 2에서 수집한 대화 로그 전체를 직접 분석하세요.

Step 1~6을 순서대로 실행하세요:
1. 대화 단위로 분절
2. KEEP / DISCARD 1차 판정
3. KEEP 항목에 가치 점수 산정
4. 7점 이하 DISCARD로 재분류
5. 카테고리별 그룹화 및 중복 통합
6. 각 항목을 추출 구조 JSON으로 작성

결과를 아래 형식으로 정리하세요:
```json
{
  "summary": {
    "total_conversations": 0,
    "kept": 0,
    "discarded": 0
  },
  "topics": [ ...추출 구조 배열... ]
}
```

---

## Step 5: 블로그 포스트 작성 (직접 수행)

Step 4의 JSON을 바탕으로 마크다운 블로그 포스트를 직접 작성하세요.

포스트 구조:
1. `# {날짜} — 오늘의 한 줄 요약` (헤더)
2. 카테고리별 섹션 (`###` 사용)
3. 각 토픽: 배경 → 결정 과정 → 결론 순서
4. 마지막에 "오늘의 핵심 인사이트" 섹션 (bullet 3개 이내)

톤: 1인칭, 기술적으로 정확하되 딱딱하지 않게. 독자는 6개월 뒤의 나 자신.

작성한 마크다운을 `/tmp/malmoi-post.md`에 저장하세요:
```bash
cat > /tmp/malmoi-post.md << 'POSTEOF'
{작성한 마크다운}
POSTEOF
```

---

## Step 6: Notion 발행

```bash
NOTION_API_KEY={NOTION_API_KEY} \
NOTION_DATABASE_ID={NOTION_DATABASE_ID} \
node {MALMOI_DIR}/src/notion.js {오늘 날짜} < /tmp/malmoi-post.md
```

발행 성공 시 출력된 URL을 알려주세요.
실패 시 `/tmp/malmoi-post.md` 경로를 안내하세요.

---

## 완료 메시지

```
Malmoi 완료 ({날짜})
보존: {kept}개 인사이트 / 폐기: {discarded}개
Notion: {URL}
```
