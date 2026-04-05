# /malmoi

오늘 하루의 Claude 대화 로그를 수집하고, 가치 있는 인사이트를 추출하여 Notion에 발행합니다.

당신은 Malmoi 오케스트레이터입니다. 아래 단계를 순서대로 실행하세요.

---

## 준비: 환경 확인

Bash 툴로 다음을 실행하세요:

```bash
cat ~/.malmoi/config 2>/dev/null || echo "CONFIG_MISSING"
```

`CONFIG_MISSING`이 출력되면 즉시 중단하고 다음을 안내하세요:
> 설정이 없습니다. `/malmoi:setup`을 먼저 실행하세요.

설정 파일에서 다음 값을 읽어 기억하세요:
- `MALMOI_DIR` — 설치 경로
- `NOTION_API_KEY` — Notion 통합 토큰
- `NOTION_DATABASE_ID` — 발행 대상 데이터베이스 ID

오늘 날짜를 확인하세요:
```bash
date +%Y-%m-%d
```

---

## Step 1: 대화 로그 수집 (Log Reader 서브에이전트)

Agent 툴로 서브에이전트를 호출하세요. 아래 프롬프트를 그대로 전달하세요:

---
**[Log Reader 프롬프트]**

오늘 날짜: `{오늘 날짜}`

오늘 하루의 Claude 대화 로그를 수집해서 하나의 텍스트로 반환하세요.

### 소스 1 — Claude Code CLI (JSONL)

1. Glob 툴로 `~/.claude/projects/**/*.jsonl` 파일 전체를 탐색하세요.
2. 각 파일을 Read 툴로 열어 오늘 날짜(`{오늘 날짜}`)가 `timestamp` 또는 `created_at` 필드에 포함된 항목만 추출하세요.
3. `role`이 `"human"` 또는 `"assistant"`인 항목의 `content`를 시간 순서대로 수집하세요.
4. 프로젝트 경로에서 프로젝트명을 추출하세요 (예: `.claude/projects/myapp/` → `myapp`).

출력 형식:
```
[프로젝트: myapp]
---
human: 사용자 메시지
assistant: 어시스턴트 응답
---
```

### 소스 2 — Claude 데스크탑 앱 (LevelDB)

Bash 툴로 다음을 실행하세요:
```bash
cd {MALMOI_DIR} && node src/read-leveldb.js {오늘 날짜} 2>/dev/null || echo "LEVELDB_SKIP"
```

`LEVELDB_SKIP`이 출력되면 소스 2는 건너뛰세요 (Claude 앱이 실행 중이면 DB가 잠길 수 있음).

### 최종 출력

소스 1과 소스 2의 내용을 하나의 텍스트로 합쳐서 반환하세요.
오늘 대화가 없으면 `"NO_CONVERSATIONS"`를 반환하세요.

---

## Step 2: 결과 확인

서브에이전트가 `"NO_CONVERSATIONS"`를 반환하면:
> 오늘 기록할 대화가 없습니다. 내일 다시 실행됩니다.
출력 후 종료하세요.

수집된 로그를 임시 파일에 저장하세요:
```bash
cat > /tmp/malmoi-today.txt << 'LOGEOF'
{서브에이전트 반환 텍스트}
LOGEOF
```

---

## Step 3: 분석 실행

```bash
cd {MALMOI_DIR} && ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY ~/.malmoi/config | cut -d= -f2) node src/run.js < /tmp/malmoi-today.txt > /tmp/malmoi-post.md
```

오류 발생 시 오류 메시지를 출력하고 중단하세요.

완료되면 `/tmp/malmoi-post.md`의 첫 5줄을 읽어 결과를 확인하세요:
```bash
head -5 /tmp/malmoi-post.md
```

---

## Step 4: Notion 발행

```bash
cd {MALMOI_DIR} && \
  NOTION_API_KEY=$(grep NOTION_API_KEY ~/.malmoi/config | cut -d= -f2) \
  NOTION_DATABASE_ID=$(grep NOTION_DATABASE_ID ~/.malmoi/config | cut -d= -f2) \
  node src/notion.js {오늘 날짜} < /tmp/malmoi-post.md
```

발행 성공 시 출력되는 Notion 페이지 URL을 사용자에게 알려주세요.
발행 실패 시 `/tmp/malmoi-post.md` 경로를 안내하세요 (로컬에서 확인 가능).

---

## 완료

```
✓ Malmoi 실행 완료 ({오늘 날짜})
  수집: {대화 수}개 프로젝트
  보존: {kept}개 인사이트 / 폐기: {discarded}개
  발행: {Notion URL}
```
