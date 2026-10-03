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

test("Production aliases retain the registered GitHub host when AUTH_URL is unset", () => {
  const previousUrl = process.env.AUTH_URL;
  const previousEnvironment = process.env.VERCEL_ENV;
  delete process.env.AUTH_URL;
  process.env.VERCEL_ENV = "production";
  try {
    assert.equal(proxy(new NextRequest("https://gettokenmaxxer.vercel.app/sign-in")).headers.get("location"), "https://token-maxxer-ten.vercel.app/sign-in");
    assert.equal(proxy(new NextRequest("https://token-maxxer-ten.vercel.app/sign-in")).headers.get("location"), null);
    process.env.VERCEL_ENV = "preview";
    assert.equal(proxy(new NextRequest("https://preview.vercel.app/sign-in")).headers.get("location"), null);
  } finally {
    if (previousUrl === undefined) delete process.env.AUTH_URL; else process.env.AUTH_URL = previousUrl;
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousEnvironment;
  }
});
