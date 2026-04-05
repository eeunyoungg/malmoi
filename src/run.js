import { readFileSync } from "fs";
import { filterAndExtract, generateBlogPost } from "./analyzer.js";

const conversationLog = readFileSync("/dev/stdin", "utf-8").trim();

if (!conversationLog) {
  process.stderr.write("입력이 없습니다. 대화 로그를 stdin으로 전달하세요.\n");
  process.exit(1);
}

const date = new Date().toISOString().split("T")[0];

process.stderr.write(`[Malmoi] 분석 시작 — ${date}\n`);

const extracted = await filterAndExtract(conversationLog);

process.stderr.write(
  `[Malmoi] 추출 완료 — 보존 ${extracted.summary.kept}개 / 폐기 ${extracted.summary.discarded}개\n`
);

const blogPost = await generateBlogPost(extracted, date);

process.stderr.write(`[Malmoi] 블로그 생성 완료\n`);

process.stdout.write(blogPost);
