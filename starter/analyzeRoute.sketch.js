/**
 * Express-style analyze route sketch for Grok.
 * Copy into server/routes/analyze.js and wire GROK_API_KEY.
 *
 * NOTE: Confirm current xAI endpoint/model names in official docs
 * before hackathon day (APIs can change).
 */

import { SYSTEM_PROMPT, buildUserPrompt, pickMockByText } from "../starter/mockResponses.js";

export async function analyzeHandler(req, res) {
  try {
    const text = (req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }

    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) {
      return res.json(pickMockByText(text));
    }

    const grokRes = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || "grok-2-latest",
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(text) },
        ],
      }),
    });

    if (!grokRes.ok) {
      console.error("Grok error", await grokRes.text());
      return res.json(pickMockByText(text));
    }

    const data = await grokRes.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = safeParseJson(content);
    if (!parsed) {
      return res.json(pickMockByText(text));
    }
    return res.json(parsed);
  } catch (err) {
    console.error(err);
    return res.json(pickMockByText(req.body?.text || ""));
  }
}

function safeParseJson(content) {
  try {
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
