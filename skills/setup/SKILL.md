---
name: setup
description: Malmoi 최초 설치 — Notion API 키 설정, npm install, crontab 등록
---

# /malmoi:setup

Malmoi 최초 설치를 진행합니다. 단계별로 필요한 정보를 수집하고 환경을 구성합니다.

---

## Step 1: 설치 경로 확인

Bash 툴로 현재 스킬 파일의 위치를 기준으로 설치 경로를 확인하세요:

```bash
# malmoi 레포 위치 탐색 (skills/malmoi-setup.md 기준)
find ~ -name "malmoi-setup.md" -path "*/skills/*" 2>/dev/null | head -1 | xargs dirname | xargs dirname
```

찾은 경로를 `MALMOI_DIR`로 기억하세요.
찾지 못하면 사용자에게 설치 경로를 직접 입력하도록 요청하세요.

---

## Step 2: 의존성 설치

```bash
cd {MALMOI_DIR} && npm install
```

오류 발생 시 출력하고 중단하세요.

---

## Step 3: API 키 수집

사용자에게 순서대로 다음 정보를 요청하세요.

**1. Notion 통합 토큰**
> Notion Integration 토큰을 입력하세요. (https://www.notion.so/my-integrations)
> 형식: `ntn_...` 또는 `secret_...`
> 아직 없다면: 새 Integration 생성 → "Read content" + "Insert content" 권한 부여

**2. Notion 데이터베이스 ID**
> 발행할 Notion 데이터베이스 URL을 입력하세요.
> 형식: `https://www.notion.so/.../{DATABASE_ID}?v=...`
> 또는 32자리 ID만 직접 입력 가능

데이터베이스 ID가 URL 형식으로 입력되면 ID만 추출하세요:
```
URL에서 마지막 / 뒤, ? 앞의 32자리 문자열이 DATABASE_ID입니다.
예: notion.so/myworkspace/abc123def456... → abc123def456...
```

---

## Step 4: 설정 파일 저장

```bash
mkdir -p ~/.malmoi
cat > ~/.malmoi/config << EOF
MALMOI_DIR={MALMOI_DIR}
NOTION_API_KEY={입력받은 Notion 토큰}
NOTION_DATABASE_ID={추출한 데이터베이스 ID}
EOF
chmod 600 ~/.malmoi/config
```

저장 확인:
```bash
cat ~/.malmoi/config
```

---

## Step 5: Notion 데이터베이스 연결 확인

```bash
curl -s -X GET "https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}" \
  -H "Authorization: Bearer {NOTION_API_KEY}" \
  -H "Notion-Version: 2022-06-28" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'id' in data:
    print('✓ Notion 연결 성공:', data.get('title', [{}])[0].get('plain_text', '(제목 없음)'))
else:
    print('✗ 연결 실패:', data.get('message', '알 수 없는 오류'))
    sys.exit(1)
"
```

실패 시:
- Integration이 해당 데이터베이스에 공유되어 있는지 확인 안내
- Notion 데이터베이스 페이지 → Share → Integration 추가

---

## Step 6: crontab 등록

매일 23:00에 자동 실행되도록 crontab을 등록합니다:

```bash
# 기존 malmoi crontab 제거 후 재등록
(crontab -l 2>/dev/null | grep -v "malmoi"; echo "0 23 * * * claude -p \"/malmoi\" >> ~/.malmoi/logs/\$(date +\%Y-\%m-\%d).log 2>&1") | crontab -
```

로그 디렉터리 생성:
```bash
mkdir -p ~/.malmoi/logs
```

등록 확인:
```bash
crontab -l | grep malmoi
```

---

## 완료

모든 단계가 성공하면 다음을 출력하세요:

```
✓ Malmoi 설치 완료

설치 경로: {MALMOI_DIR}
실행 시간: 매일 23:00 (crontab)
로그 위치: ~/.malmoi/logs/

지금 바로 실행하려면: /malmoi
```
