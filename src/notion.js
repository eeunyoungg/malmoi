/**
 * 마크다운을 stdin으로 받아 Notion 데이터베이스에 페이지로 발행
 * 사용법: node src/notion.js 2025-01-15 < /tmp/malmoi-post.md
 * 환경변수: NOTION_API_KEY, NOTION_DATABASE_ID
 */

import { readFileSync } from "fs";

const date = process.argv[2] || new Date().toISOString().split("T")[0];
const markdown = readFileSync("/dev/stdin", "utf-8").trim();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
  process.stderr.write("NOTION_API_KEY, NOTION_DATABASE_ID 환경변수가 필요합니다.\n");
  process.exit(1);
}

// 마크다운 → Notion 블록 변환
function markdownToBlocks(md) {
  const lines = md.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 코드 블록
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || "plain text";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        object: "block",
        type: "code",
        code: {
          rich_text: [{ type: "text", text: { content: codeLines.join("\n") } }],
          language: lang,
        },
      });
      i++;
      continue;
    }

    // H1
    if (line.startsWith("# ")) {
      blocks.push(heading(1, line.slice(2).trim()));
      i++;
      continue;
    }

    // H2
    if (line.startsWith("## ")) {
      blocks.push(heading(2, line.slice(3).trim()));
      i++;
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      blocks.push(heading(3, line.slice(4).trim()));
      i++;
      continue;
    }

    // 구분선
    if (/^---+$/.test(line.trim())) {
      blocks.push({ object: "block", type: "divider", divider: {} });
      i++;
      continue;
    }

    // 불릿 리스트
    if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: richText(line.slice(2).trim()),
        },
      });
      i++;
      continue;
    }

    // 번호 리스트
    const numMatch = line.match(/^(\d+)\. (.+)/);
    if (numMatch) {
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: richText(numMatch[2].trim()),
        },
      });
      i++;
      continue;
    }

    // 빈 줄
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 일반 문단
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: richText(line),
      },
    });
    i++;
  }

  return blocks;
}

function heading(level, text) {
  const type = `heading_${level}`;
  return {
    object: "block",
    type,
    [type]: { rich_text: richText(text) },
  };
}

// 인라인 마크다운 파싱 (굵게, 코드, 일반)
function richText(text) {
  const result = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|[^`*]+)/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const chunk = match[0];
    if (!chunk) continue;

    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      result.push({
        type: "text",
        text: { content: chunk.slice(1, -1) },
        annotations: { code: true },
      });
    } else if (chunk.startsWith("**") && chunk.endsWith("**")) {
      result.push({
        type: "text",
        text: { content: chunk.slice(2, -2) },
        annotations: { bold: true },
      });
    } else {
      result.push({ type: "text", text: { content: chunk } });
    }
  }

  return result.length > 0 ? result : [{ type: "text", text: { content: text } }];
}

// Notion API 호출
async function notionRequest(method, path, body) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Notion API 오류 (${res.status}): ${data.message}`);
  }
  return data;
}

// 페이지 생성 (블록은 100개 제한으로 나눠서 추가)
async function createPage(title, blocks) {
  // 첫 번째 100개 블록으로 페이지 생성
  const firstBatch = blocks.slice(0, 100);

  const page = await notionRequest("POST", "/pages", {
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      Name: {
        title: [{ type: "text", text: { content: title } }],
      },
    },
    children: firstBatch,
  });

  // 나머지 블록 추가
  for (let i = 100; i < blocks.length; i += 100) {
    const batch = blocks.slice(i, i + 100);
    await notionRequest("PATCH", `/blocks/${page.id}/children`, {
      children: batch,
    });
  }

  return page;
}

// 실행
const blocks = markdownToBlocks(markdown);
const title = `Malmoi — ${date}`;

process.stderr.write(`[Notion] "${title}" 발행 중... (${blocks.length}개 블록)\n`);

const page = await createPage(title, blocks);
const pageUrl = page.url;

process.stderr.write(`[Notion] 발행 완료\n`);
process.stdout.write(pageUrl + "\n");
