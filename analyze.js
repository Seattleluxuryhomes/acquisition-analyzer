const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM = `You are an acquisition analyst for a real estate acquisition tool.
You receive normalized public-record property data and produce an Acquisition Analyzer report.

Rules:
- Base every statement only on the data provided. If a field is null/missing, say "Not available" — never invent figures.
- Comps: when data.comps.status is 'ok', treat data.comps.arv as the comp-derived value and reference how it was derived (data.comps.count comps, data.comps.pricePerSqftMedian, data.comps.radiusMi). If data.comps.status is not 'ok' or data.comps.count is below 3, state that comps are insufficient — do NOT present an ARV as comp-backed.
- Estimated value: when data.valuationModel.status is 'ok', treat data.valuationModel.estimate as THE headline market value (it already reconciles comps, AVM, and assessment). Anchor valueAnalysis to it, citing its range (low–high), confidence, and basis. Anchor offerStrategy to data.valuationModel.offer.point and its range, and explicitly note that figure excludes repairs/rehab so the buyer must adjust down for condition. Never invent a different value or offer than the model provides.
- You are NOT giving legal, investment, or appraisal advice. This is a research summary for a licensed professional.
- Be concrete and concise. No hype.
- Keep each text value under 600 characters. Do not use line breaks, tabs, or double quotes inside any string value — use single quotes if you must quote.`;

const TOOL = {
  name: "acquisition_report",
  description: "Return the structured acquisition analysis.",
  input_schema: {
    type: "object",
    properties: {
      propertySummary: { type: "string" },
      ownershipSummary: { type: "string" },
      compsAnalysis: { type: "string", description: "ARV from comps, how derived, and confidence given comp count/spread. 'Not available' if comps insufficient." },
      valueAnalysis: { type: "string" },
      developmentPotential: { type: "string" },
      buyBoxMatchScore: {
        type: "object",
        properties: { score: { type: "integer" }, rationale: { type: "string" } },
        required: ["score", "rationale"],
      },
      acquisitionScore: {
        type: "object",
        properties: { score: { type: "integer" }, rationale: { type: "string" } },
        required: ["score", "rationale"],
      },
      offerStrategy: { type: "string" },
      risks: { type: "array", items: { type: "string" } },
      nextSteps: { type: "array", items: { type: "string" } },
      dataGaps: { type: "array", items: { type: "string" } },
    },
    required: [
      "propertySummary", "ownershipSummary", "compsAnalysis", "valueAnalysis", "developmentPotential",
      "buyBoxMatchScore", "acquisitionScore", "offerStrategy", "risks", "nextSteps", "dataGaps",
    ],
  },
};

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
      tools: [TOOL],
      tool_choice: { type: "tool", name: "acquisition_report" },
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
  const toolUse = (data.content || []).find((b) => b.type === "tool_use");
  if (toolUse && toolUse.input) return toolUse.input;

  const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
  if (s >= 0 && e >= 0) {
    let body = raw.slice(s, e + 1).replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(body);
  }
  throw new Error("Model did not return a structured report.");
}
