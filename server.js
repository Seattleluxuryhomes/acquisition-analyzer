import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchProperty } from "./attom.js";
import { analyze } from "./analyze.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "256kb" }));
app.use(express.static(__dirname));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    attomKey: !!process.env.ATTOM_API_KEY,
    anthropicKey: !!process.env.ANTHROPIC_API_KEY,
  });
});

app.post("/api/analyze", async (req, res) => {
  const address = (req.body?.address || "").trim();
  if (!address) return res.status(400).json({ error: "Enter a property address." });

  let normalized;
  try {
    normalized = await fetchProperty(address);
  } catch (err) {
    const map = { BAD_ADDRESS: 400, NOT_FOUND: 404, AUTH: 502, UPSTREAM: 502 };
    const code = map[err.code] || 500;
    return res.status(code).json({ error: err.message, stage: "attom", detail: err.detail || err.attomStatus || null });
  }

  let report;
  try {
    report = await analyze(normalized);
  } catch (err) {
    return res.status(200).json({ data: normalized, report: null, analysisError: err.message });
  }

  res.json({ data: normalized, report });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Acquisition Analyzer on http://localhost:${PORT}`);
});
