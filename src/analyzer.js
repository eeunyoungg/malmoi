import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(
  join(__dirname, "../prompts/MALMOI_RULES.md"),
  "utf-8"
);

const client = new Anthropic();

/**
 * Step 1-6: 필터링 + 추출 (Opus — 품질이 전부)
 * 하루 대화 로그 전체를 받아 가치 있는 항목만 JSON으로 반환
 */
export async function filterAndExtract(conversationLog) {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    system: RULES,
    messages: [
      {
        role: "user",
        content: `아래는 오늘 하루의 Claude Code 대화 로그입니다.
MALMOI_RULES.md의 Step 1–6을 순서대로 실행하세요.

최종 출력은 반드시 다음 JSON 형식으로만 응답하세요:
\`\`\`json
{
  "summary": {
    "total_conversations": 0,
    "kept": 0,
    "discarded": 0,
    "discard_reasons": { "casual": 0, "simple_lookup": 0, "no_conclusion": 0, "duplicate": 0, "other": 0 }
  },
  "topics": [ ...추출 구조 배열... ]
}
\`\`\`

---
${conversationLog}`,
      },
    ],
  });

  const raw = response.content[0].text;
  const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) throw new Error("Opus가 JSON 형식으로 응답하지 않음");

  return JSON.parse(jsonMatch[1]);
}

/**
 * Step 7: 블로그 포스트 생성 (Sonnet — 비용 절감)
 * 추출된 구조화 데이터를 읽기 좋은 마크다운으로 변환
 */
export async function generateBlogPost(extractedData, date) {
  const { topics, summary } = extractedData;

  if (topics.length === 0) {
    return `# ${date} — 기록할 인사이트 없음\n\n오늘은 블로그로 남길 만한 내용이 없었습니다.\n`;
  }

  // 점수 기준으로 정렬: 높은 것부터
  const sorted = [...topics].sort(
    (a, b) => b.value_score.total - a.value_score.total
  );

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
    system: `당신은 개발자 기술 블로그 작가입니다.
구조화된 JSON 데이터를 자연스럽고 읽기 좋은 마크다운 블로그 포스트로 변환합니다.

글쓰기 톤:
- 1인칭 ("오늘 겪은", "알게 됐다", "선택했다")
- 기술적으로 정확하되 딱딱하지 않게
- 코드 블록은 항상 언어 명시
- 독자는 나 자신 (6개월 뒤의 나)`,
    messages: [
      {
        role: "user",
        content: `날짜: ${date}
총 대화 수: ${summary.total_conversations} (보존: ${summary.kept}, 폐기: ${summary.discarded})

아래 JSON 데이터로 블로그 포스트를 작성하세요.

포스트 구조:
1. 날짜 + 오늘의 한 줄 요약 (헤더)
2. 카테고리별 섹션 (### 사용)
3. 각 토픽: 배경 → 과정 → 결론 순서
4. 코드가 있으면 반드시 포함
5. 마지막에 "오늘의 핵심 인사이트" 섹션 (bullet point 3개 이내)

---
${JSON.stringify(sorted, null, 2)}`,
      },
    ],
  });

  return response.content[0].text;
}
