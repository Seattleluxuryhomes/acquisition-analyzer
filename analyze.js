// src/analyze.js — send normalized ATTOM data to Claude, get a structured report
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM = `You are an acquisition analyst for Builder Buy Box, a real estate acquisition platform.
You receive normalized public-record property data and produce an Acquisition Analyzer report.

Rules:
- Base every statement only on the data provided. If a field is null/missing, say "Not available" — never invent figures.
- You are NOT giving legal, investment, or appraisal advice. This is a research summary for a licensed professional.
- Be concrete and concise. No hype.
- Return ONLY a JSON object (no markdown, no prose outside JSON) with EXACTLY this shape:
{
  "propertySummary": "string",
  "ownershipSummary": "string",
  "valueAnalysis": "string",
  "developmentPotential": "string",
  "buyBoxMatchScore": { "score": 0-100, "rationale": "string" },
  "acquisitionScore": { "score": 0-100, "rationale": "string" },
  "offerStrategy": "string",
  "risks": ["string", "..."],
  "nextSteps": ["string", "..."],
  "dataGaps": ["string", "..."]
}
Scoring guidance: acquisitionScore reflects overall opportunity given value vs. assessed/AVM spread, lot/development upside, ownership signals (corporate/absentee), and data completeness. Lower the score when key data is missing and list it in dataGaps. buyBoxMatchScore reflects fit for an infill/development buyer (lot size, zoning, redevelopment headroom).`;

export async function analyze(normalized) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set in the environment.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: "Property data:\n" + JSON.stringify(normalized, null, 2) }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    const e = new Error("Anthropic API error " + res.status);
    e.detail = t.slice(0, 300);
    throw e;
  }
  const data = await res.json();
  let raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  raw = raw.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const s = raw.indexOf("{"), eIdx = raw.lastIndexOf("}");
  if (s < 0 || eIdx < 0) throw new Error("Claude did not return JSON.");
  return JSON.parse(raw.slice(s, eIdx + 1));
}
