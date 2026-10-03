import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

test("Public aliases keep OAuth cookies and account pages on the canonical authentication host", () => {
  const previous = process.env.AUTH_URL;
  process.env.AUTH_URL = "https://token-maxxer-ten.vercel.app";
  try {
    for (const path of ["/sign-in", "/dashboard/collector", "/api/auth/callback/github?code=example&state=example"]) {
      const response = proxy(new NextRequest(`https://gettokenmaxxer.vercel.app${path}`));
      assert.equal(response.status, 307);
      assert.equal(response.headers.get("location"), `${process.env.AUTH_URL}${path}`);
    }
    for (const url of ["https://gettokenmaxxer.vercel.app/", "https://gettokenmaxxer.vercel.app/u/builder", "https://token-maxxer-ten.vercel.app/sign-in"]) {
      assert.equal(proxy(new NextRequest(url)).headers.get("location"), null);
    }
  } finally { if (previous === undefined) delete process.env.AUTH_URL; else process.env.AUTH_URL = previous; }
});
