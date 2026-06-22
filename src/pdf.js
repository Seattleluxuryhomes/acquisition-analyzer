// Server-rendered client proposal PDF (spec §9). Built from buildProposal() output,
// so it is structurally incapable of showing margin/notes. pdfkit = pure JS, no
// headless browser needed.
import PDFDocument from "pdfkit";

const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

// Brand colors from the prototype's design tokens.
const INK = "#1F252C", AMBER = "#CF7F18", BLUE = "#1E4259", MUTED = "#8a7f68", RULE = "#d9cdb5";

export function renderProposalPDF(proposal, res) {
  const doc = new PDFDocument({ size: "LETTER", margin: 54 });
  doc.pipe(res);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // ---- Business header band ----
  doc.rect(0, 0, doc.page.width, 96).fill(INK);
  doc.fillColor("#F3EEE3").font("Helvetica-Bold").fontSize(20)
    .text(proposal.business.company || "Your Company", left, 30, { width });
  const meta = [proposal.business.name, proposal.business.phone,
    proposal.business.license ? "Lic. " + proposal.business.license : ""]
    .filter(Boolean).join("  ·  ");
  doc.font("Helvetica").fontSize(9).fillColor("#b9c2cc")
    .text(meta || "", left, 58, { width });
  // Company logo, top-right of the header band. Wrapped so a bad image can never
  // break the PDF.
  if (proposal.business.logo) {
    try {
      const m = /^data:image\/\w+;base64,(.+)$/.exec(proposal.business.logo);
      if (m) {
        const buf = Buffer.from(m[1], "base64");
        doc.image(buf, right - 96, 24, { fit: [96, 48], align: "right", valign: "center" });
      }
    } catch { /* ignore unreadable logo */ }
  }
  doc.y = 120;

  // ---- Proposal heading ----
  sectionLabel(doc, "PROPOSAL FOR", left);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text(proposal.title, left);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(proposal.date, left);
  doc.moveDown(0.8);

  // ---- Scope of work ----
  sectionLabel(doc, "SCOPE OF WORK", left);
  if (proposal.scope.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("No items yet.", left);
  }
  if (proposal.sections && proposal.sections.length) {
    // Multi-room job: a heading + subtotal per room.
    for (const g of proposal.sections) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(BLUE).text(g.name, left, doc.y, { width });
      doc.moveDown(0.2);
      for (const l of g.lines) {
        const sub = l.type === "hourly" ? `${l.hours || 0} hrs @ ${money(l.rate)}/hr` : "";
        lineRow(doc, l.desc, money(l.amount), sub, left, width);
      }
      const sy = doc.y;
      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(g.name + " subtotal", left, sy, { width: width - 110 });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(money(g.subtotal), left, sy, { width, align: "right" });
      doc.moveDown(0.6);
    }
  } else {
    for (const l of proposal.scope) {
      const sub = l.type === "hourly" ? `${l.hours || 0} hrs @ ${money(l.rate)}/hr` : "";
      lineRow(doc, l.desc, money(l.amount), sub, left, width);
    }
  }

  // ---- Total ----
  doc.moveDown(0.4);
  const ty = doc.y;
  doc.moveTo(left, ty).lineTo(right, ty).lineWidth(1.5).strokeColor(INK).stroke();
  doc.moveDown(0.4);
  const rowY = doc.y;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text("Total", left, rowY);
  doc.font("Helvetica-Bold").fontSize(15).fillColor(BLUE)
    .text(money(proposal.total), left, rowY - 2, { width, align: "right" });
  doc.moveDown(1);

  if (proposal.clientFurnished.length) {
    sectionLabel(doc, "PROVIDED BY CLIENT", left);
    for (const l of proposal.clientFurnished) lineRow(doc, l.desc, "by client", "", left, width, MUTED);
    doc.moveDown(0.4);
  }

  if (proposal.upgrades.length) {
    sectionLabel(doc, "OPTIONAL UPGRADES", left);
    for (const u of proposal.upgrades) lineRow(doc, u.desc, "+ " + money(u.price), "", left, width, AMBER);
    doc.moveDown(0.4);
  }

  if (proposal.exclusions.length) {
    sectionLabel(doc, "NOT INCLUDED", left);
    for (const e of proposal.exclusions) {
      doc.font("Helvetica").fontSize(9.5).fillColor("#5a5240").text("✗  " + e, left, doc.y, { width });
    }
    doc.moveDown(0.4);
  }

  if (proposal.assumptions.length) {
    sectionLabel(doc, "NOTES", left);
    for (const a of proposal.assumptions) {
      doc.font("Helvetica").fontSize(9.5).fillColor("#5a5240").text("•  " + a, left, doc.y, { width });
    }
    doc.moveDown(0.4);
  }

  // ---- Footer ----
  doc.moveDown(1);
  const fy = doc.y;
  doc.moveTo(left, fy).lineTo(right, fy).lineWidth(0.5).strokeColor(RULE).stroke();
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(proposal.footer, left, fy + 8, { width });

  doc.end();
}

function sectionLabel(doc, text, left) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor(AMBER)
    .text(text, left, doc.y, { characterSpacing: 1.5 });
  doc.moveDown(0.3);
}

function lineRow(doc, desc, amount, sub, left, width, amtColor = INK) {
  const y = doc.y;
  doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(desc || "Item", left, y, { width: width - 110 });
  const descBottom = doc.y;
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(amtColor).text(amount, left, y, { width, align: "right" });
  if (sub) {
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(sub, left, doc.y, { width: width - 110 });
  }
  doc.y = Math.max(descBottom, doc.y) + 4;
  doc.moveTo(left, doc.y - 2).lineTo(left + width, doc.y - 2).lineWidth(0.5).strokeColor(RULE).stroke();
  doc.moveDown(0.2);
}
