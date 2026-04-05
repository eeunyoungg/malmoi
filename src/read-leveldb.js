/**
 * Claude 데스크탑 앱 대화 로그를 LevelDB에서 읽어 stdout으로 출력
 * 사용법: node src/read-leveldb.js 2025-01-15
 */

import { Level } from "level";
import { join } from "path";

const targetDate = process.argv[2];
if (!targetDate) {
  process.stderr.write("날짜 인수가 필요합니다. 예: node read-leveldb.js 2025-01-15\n");
  process.exit(1);
}

const DB_PATH = join(
  process.env.HOME,
  "Library/Application Support/Claude/IndexedDB/https_claude.ai_0.indexeddb.leveldb"
);

let db;
try {
  db = new Level(DB_PATH, { valueEncoding: "utf8" });
} catch (err) {
  process.stderr.write(`LevelDB 열기 실패: ${err.message}\n`);
  process.exit(1);
}

const conversations = [];

try {
  for await (const [key, value] of db.iterator()) {
    // Claude 데스크탑 앱은 대화를 JSON 형태로 저장
    // key 패턴: 대화 ID 또는 메시지 ID
    if (!value || typeof value !== "string") continue;

    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      continue;
    }

    // 오늘 날짜 필터링
    const createdAt =
      parsed.created_at ||
      parsed.timestamp ||
      parsed.updated_at ||
      parsed.createdAt;

    if (!createdAt) continue;
    if (!String(createdAt).startsWith(targetDate)) continue;

    // 대화 메시지 추출
    const messages = parsed.chat_messages || parsed.messages || [];
    if (!Array.isArray(messages) || messages.length === 0) continue;

    const formatted = messages
      .filter((m) => m.role && m.content)
      .map((m) => {
        const role = m.role === "human" ? "human" : "assistant";
        const content =
          typeof m.content === "string"
            ? m.content
            : m.content
                ?.map?.((c) => c.text || "")
                .filter(Boolean)
                .join("") || "";
        return `${role}: ${content}`;
      })
      .join("\n");

    if (formatted) {
      conversations.push(`[Claude 데스크탑]\n---\n${formatted}\n---`);
    }
  }
} finally {
  await db.close();
}

if (conversations.length === 0) {
  process.stderr.write(`${targetDate}에 해당하는 데스크탑 앱 대화 없음\n`);
  process.exit(0);
}

process.stdout.write(conversations.join("\n\n") + "\n");
