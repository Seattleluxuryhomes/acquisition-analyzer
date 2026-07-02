// Transactional email via Resend's HTTP API (no SDK, no deps). Entirely optional
// and env-gated, same pattern as the AI/billing steps: set RESEND_API_KEY (and
// optionally BT_MAIL_FROM) to turn it on. Without a key, mailConfigured() is
// false and callers degrade gracefully — nothing breaks if email isn't wired.
const KEY = () => process.env.RESEND_API_KEY || "";
// Use your own verified domain in prod, e.g. "BidVoice <bids@yourdomain.com>".
// resend.dev works out of the box for testing.
const FROM = () => process.env.BT_MAIL_FROM || "BidVoice <onboarding@resend.dev>";

// The bare sender address inside FROM() — "BidVoice <x@y>" → "x@y". Used to swap the
// display NAME for client-facing mail while keeping BidVoice's verified sending domain
// (dual email identity: the client sees the contractor's brand, replies go to the
// contractor, envelope stays BidVoice — see the Commercial Architecture, Layer 1).
const FROM_ADDR = () => { const m = /<([^>]+)>/.exec(FROM()); return m ? m[1].trim() : FROM().trim(); };
// Compose "Display Name <addr>", sanitizing the display name (no quotes/newlines/brackets).
function fromWithName(name) {
  const clean = String(name || "").replace(/["<>\r\n]/g, "").trim().slice(0, 60);
  return clean ? `${clean} <${FROM_ADDR()}>` : FROM();
}

export function mailConfigured() { return !!KEY(); }

// Read-only config diagnostics for the founder admin panel — booleans only, never the
// secret values. `using_default_sender` flags the resend.dev test sender (which only
// delivers to your own Resend account email), so a "configured but nobody gets mail"
// setup is visible at a glance.
export function mailStatus() {
  const fromSet = !!String(process.env.BT_MAIL_FROM || "").trim();
  return {
    mail_configured: !!KEY(),            // RESEND_API_KEY present
    mail_from_configured: fromSet,       // BT_MAIL_FROM explicitly set
    using_default_sender: !fromSet,      // true → onboarding@resend.dev (test-only delivery)
  };
}

// attachments: [{ filename, content }] where content is base64 (no data: prefix).
// fromName: optional display name (client-facing mail sent under the contractor's brand).
export async function sendMail({ to, subject, html, text, attachments, replyTo, fromName } = {}) {
  if (!mailConfigured()) { const e = new Error("Email isn't configured on the server."); e.status = 503; e.code = "MAIL_UNCONFIGURED"; throw e; }
  const body = { from: fromName ? fromWithName(fromName) : FROM(), to: Array.isArray(to) ? to : [to], subject: String(subject || "") };
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
