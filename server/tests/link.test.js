import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import {
  analyzeUrl,
  extractUrls,
  analyzeLinkRequest,
} from "../../shared/linkEngine.js";
import { createLinkRouter } from "../link/routes.js";

test("extractUrls finds http, upi and multiple links", () => {
  const text = "Pay here https://bit.ly/abc and upi://pay?pa=test@upi also visit paytm.com";
  const urls = extractUrls(text);
  assert.ok(urls.some((u) => u.includes("bit.ly")));
  assert.ok(urls.some((u) => u.startsWith("upi://")));
  assert.ok(urls.some((u) => u.includes("paytm.com")));
  assert.ok(urls.length <= 10);
});

test("official paytm.com is SAFE", () => {
  const r = analyzeUrl("https://paytm.com");
  assert.equal(r.verdict, "SAFE");
  assert.ok(r.score < 30);
  assert.equal(r.brandMatch, null);
});

test("official pay.google.com is SAFE", () => {
  const r = analyzeUrl("https://pay.google.com/gp/v/some/path");
  assert.equal(r.verdict, "SAFE");
});

test("google.com and wikipedia.org stay SAFE", () => {
  assert.equal(analyzeUrl("https://google.com").verdict, "SAFE");
  assert.equal(analyzeUrl("https://wikipedia.org").verdict, "SAFE");
});

test("plain http example.com is SAFE or low risk", () => {
  const r = analyzeUrl("http://example.com");
  assert.ok(r.verdict === "SAFE" || r.score < 30);
});

test("URL shortener bit.ly is SUSPICIOUS or worse", () => {
  const r = analyzeUrl("https://bit.ly/3abcXYZ");
  assert.ok(r.signals.some((s) => s.id === "url_shortener"));
  assert.ok(r.score >= 30);
});

test("IP literal host is flagged", () => {
  const r = analyzeUrl("http://192.168.0.1/login");
  assert.ok(r.signals.some((s) => s.id === "ip_literal"));
  assert.equal(r.verdict, "DANGEROUS");
});

test("punycode / IDN host is flagged", () => {
  const r = analyzeUrl("https://p\u0430ytm.com/login");
  assert.ok(r.signals.some((s) => s.id === "punycode_idn"));
});

test("paytm typosquat paytrn.com is DANGEROUS", () => {
  const r = analyzeUrl("https://paytrn.com/kyc");
  assert.ok(r.brandMatch?.brand === "paytm");
  assert.equal(r.verdict, "DANGEROUS");
});

test("pay-tm.support look-alike is risky", () => {
  const r = analyzeUrl("https://pay-tm.support/verify");
  assert.ok(r.score >= 30);
  assert.ok(r.brandMatch?.brand === "paytm" || r.signals.some((s) => s.id === "brand_embedded" || s.id === "brand_lookalike"));
});

test("paytm-kyc-verify.xyz is DANGEROUS", () => {
  const r = analyzeUrl("https://paytm-kyc-verify.xyz/login");
  assert.equal(r.verdict, "DANGEROUS");
  assert.ok(r.signals.some((s) => s.id === "scam_keywords" || s.id === "brand_lookalike" || s.id === "brand_embedded"));
});

test("brand embedded in subdomain paytm.com.secure-login.xyz", () => {
  const r = analyzeUrl("https://paytm.com.secure-login.xyz/");
  assert.ok(r.signals.some((s) => s.id === "brand_embedded"));
  assert.equal(r.verdict, "DANGEROUS");
});

test("official sbi.co.in is SAFE", () => {
  const r = analyzeUrl("https://sbi.co.in");
  assert.equal(r.verdict, "SAFE");
});

test("risky TLD .xyz on unknown domain", () => {
  const r = analyzeUrl("https://random-shop.xyz");
  assert.ok(r.signals.some((s) => s.id === "risky_tld"));
});

test("@ userinfo trick is flagged", () => {
  const r = analyzeUrl("https://paytm.com@evil-site.xyz/login");
  assert.ok(r.signals.some((s) => s.id === "at_userinfo"));
});

test("scam keywords in path raise score", () => {
  const r = analyzeUrl("https://totally-unknown.site/verify-kyc-otp");
  assert.ok(r.signals.some((s) => s.id === "scam_keywords"));
});

test("javascript: scheme is DANGEROUS", () => {
  const r = analyzeUrl("javascript:alert(1)");
  assert.equal(r.verdict, "DANGEROUS");
  assert.ok(r.signals.some((s) => s.id === "dangerous_scheme"));
});

test("data: scheme is DANGEROUS", () => {
  const r = analyzeUrl("data:text/html,<script>alert(1)</script>");
  assert.equal(r.verdict, "DANGEROUS");
});

test("upi collect link is flagged", () => {
  const r = analyzeUrl("upi://collect?pa=scammer@upi&pn=Refund&am=500");
  assert.ok(r.signals.some((s) => s.id === "upi_collect"));
  assert.ok(r.score >= 65);
});

test("upi pay with receive-money note is flagged", () => {
  const r = analyzeUrl("upi://pay?pa=test@upi&tn=Please+receive+refund");
  assert.ok(r.signals.some((s) => s.id === "upi_receive_phrase"));
});

test("tel: scheme is suspicious", () => {
  const r = analyzeUrl("tel:+919876543210");
  assert.ok(r.signals.some((s) => s.id === "suspicious_scheme"));
});

test("analyzeLinkRequest validates empty and long input", () => {
  assert.equal(analyzeLinkRequest({ url: "" }).status, 400);
  assert.equal(analyzeLinkRequest({ text: "   " }).status, 400);
  assert.equal(analyzeLinkRequest({ url: "x".repeat(2001) }).status, 400);
  assert.equal(analyzeLinkRequest({ text: 123 }).status, 400);
});

test("analyzeLinkRequest extracts from text", () => {
  const out = analyzeLinkRequest({ text: "See https://paytrn.com and https://paytm.com" });
  assert.equal(out.results.length, 2);
  assert.equal(out.results[0].verdict, "DANGEROUS");
  assert.equal(out.results[1].verdict, "SAFE");
});

test("POST /api/links/check route", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/links", createLinkRouter());
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const bad = await fetch(`http://127.0.0.1:${port}/api/links/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "" }),
  });
  assert.equal(bad.status, 400);

  const ok = await fetch(`http://127.0.0.1:${port}/api/links/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://paytm.com" }),
  });
  assert.equal(ok.status, 200);
  const data = await ok.json();
  assert.ok(Array.isArray(data.results));
  assert.equal(data.results[0].verdict, "SAFE");

  await new Promise((r) => server.close(r));
});

test("result shape has required fields", () => {
  const r = analyzeUrl("https://paytm.com");
  for (const k of ["input", "normalized", "host", "registrableDomain", "verdict", "score", "signals", "advice"]) {
    assert.ok(k in r, k);
  }
  assert.ok(["SAFE", "SUSPICIOUS", "DANGEROUS"].includes(r.verdict));
});
