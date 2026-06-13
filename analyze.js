const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM = `You are an acquisition analyst for a real estate acquisition tool.
You receive normalized public-record property data and produce an Acquisition Analyzer report.

Rules:
- Base every statement only on the data provided. If a field is null/missing, say "Not available" — never invent figures.
- You are NOT giving legal, investment, or appraisal advice. This is a research summary for a licensed professional.
- Be concrete and concise. No hype.
- Return ONLY a JSON object. No markdown, no code fences, no text before or after the JSON.
- Do not use trailing commas. Ensure the JSON is strictly valid.
- Use EXACTLY this shape:
{
  "propertySummary": "string",
  "ownershipSummary": "string",
  "valueAnalysis": "string",
  "developmentPotential": "string",
  "buyBoxMatchScore": { "score": 0, "rationale": "string" },
  "acquisitionScore": { "score": 0, "rationale": "string" },
  "offerStrategy": "string",
  "risks": ["string"],
  "nextSteps": ["string"],
  "dataGaps": ["string"]
}
Scores are integers 0-100. Lower the acquisitionScore when key data is missing and list what's missing in dataGaps.`;

function extractJSON(raw) {
  let t = String(raw || "").trim();
  t = t.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("No JSON object found in model response.");
  let body = t.slice(s, e + 1);
  body = body.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(body);
}

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
  const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return extractJSON(raw);
}
