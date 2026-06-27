// Transactional email via Resend's HTTP API (no SDK, no deps). Entirely optional
// and env-gated, same pattern as the AI/billing steps: set RESEND_API_KEY (and
// optionally BT_MAIL_FROM) to turn it on. Without a key, mailConfigured() is
// false and callers degrade gracefully — nothing breaks if email isn't wired.
const KEY = () => process.env.RESEND_API_KEY || "";
// Use your own verified domain in prod, e.g. "Bidtranslator <bids@yourdomain.com>".
// resend.dev works out of the box for testing.
const FROM = () => process.env.BT_MAIL_FROM || "Bidtranslator <onboarding@resend.dev>";

export function mailConfigured() { return !!KEY(); }

// attachments: [{ filename, content }] where content is base64 (no data: prefix).
export async function sendMail({ to, subject, html, text, attachments, replyTo } = {}) {
  if (!mailConfigured()) { const e = new Error("Email isn't configured on the server."); e.status = 503; e.code = "MAIL_UNCONFIGURED"; throw e; }
  const body = { from: FROM(), to: Array.isArray(to) ? to : [to], subject: String(subject || "") };
  if (html) body.html = html;
  if (text) body.text = text;
  if (replyTo) body.reply_to = replyTo;
  if (attachments && attachments.length) body.attachments = attachments;
  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + KEY(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch { const e = new Error("Could not reach the email provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("Email send failed (" + res.status + ")."); e.status = 502; e.detail = await res.text().catch(() => ""); throw e; }
  return res.json().catch(() => ({}));
}
