import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeaderboardProjects } from "../src/components/LeaderboardProjects";

test("Large project lists expand without making private names clickable", () => {
  const html = renderToStaticMarkup(createElement(LeaderboardProjects, { projects: [
    { displayName: "Private project", linkUrl: null },
    { displayName: "Public project", linkUrl: "https://example.com" },
    ...Array.from({ length: 5 }, (_, i) => ({ displayName: `Folder ${i}`, linkUrl: null })),
  ] }));
  assert.ok(html.includes("<span>Private project</span>"));
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(html.includes("<summary"));
  assert.ok(html.includes("3 more projects"));
  assert.ok(html.includes("Folder 4"));
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.ok(!html.includes("<details open"));
});
