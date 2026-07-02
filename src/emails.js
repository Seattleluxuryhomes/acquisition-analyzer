// Branded transactional email templates — premium, responsive (single 600px column,
// table-based for client support), dark-mode-friendly, inline styles. Each builder returns
// { subject, html, text }. No dependencies. Absolute URLs are required in email, so callers
// pass `base` (e.g. https://bidvoice.ai) for the logo and links.

const AMBER = "#CF7F18";
const INK = "#1F252C";
const SUPPORT = "support@bidvoice.ai";

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The shell: header (logo + wordmark), an optional lead line, a body block, an optional
// amber CTA button, then a legal/contact footer. Reads well on light and dark clients.
function shell(base, { preheader = "", heading, lead = "", bodyHtml = "", ctaText = "", ctaUrl = "", footNote = "" }) {
  const b = String(base || "https://bidvoice.ai").replace(/\/+$/, "");
  const cta = ctaText && ctaUrl
    ? `<tr><td style="padding:6px 0 4px"><a href="${ctaUrl}" style="display:inline-block;background:${AMBER};color:#fff;font-weight:700;font-size:16px;text-decoration:none;padding:13px 26px;border-radius:10px;font-family:Arial,Helvetica,sans-serif">${esc(ctaText)}</a></td></tr>
       <tr><td style="padding:10px 0 0;color:#8a8f9a;font-size:12px;font-family:Arial,Helvetica,sans-serif">If the button doesn’t work, copy and paste this link:<br><a href="${ctaUrl}" style="color:${AMBER};word-break:break-all">${esc(ctaUrl)}</a></td></tr>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head>
<body style="margin:0;padding:0;background:#f2efe8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2efe8;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e1d5">
      <tr><td style="padding:22px 28px;border-bottom:1px solid #eee7da">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle"><img src="${b}/brand-orange.png?v=4" width="28" height="28" alt="" style="display:block;border:0"></td>
          <td style="vertical-align:middle;padding-left:9px;font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:19px;color:${INK}">Bid<span style="color:${AMBER}">Voice</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:30px 28px 8px;font-family:Arial,Helvetica,sans-serif">
        <h1 style="margin:0 0 6px;font-size:22px;line-height:1.25;color:${INK};font-weight:800">${esc(heading)}</h1>
        ${lead ? `<p style="margin:0 0 14px;color:#5c6270;font-size:15px;line-height:1.5">${lead}</p>` : ""}
      </td></tr>
      <tr><td style="padding:0 28px 8px;font-family:Arial,Helvetica,sans-serif;color:${INK};font-size:15px;line-height:1.6">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${bodyHtml}${cta}</table>
      </td></tr>
      ${footNote ? `<tr><td style="padding:6px 28px 2px;font-family:Arial,Helvetica,sans-serif;color:#8a8f9a;font-size:12px;line-height:1.5">${footNote}</td></tr>` : ""}
      <tr><td style="padding:22px 28px 26px;border-top:1px solid #eee7da;font-family:Arial,Helvetica,sans-serif;color:#8a8f9a;font-size:12px;line-height:1.6">
        <a href="${b}/terms" style="color:#8a8f9a">Terms</a> &nbsp;·&nbsp;
        <a href="${b}/privacy" style="color:#8a8f9a">Privacy</a> &nbsp;·&nbsp;
        <a href="mailto:${SUPPORT}" style="color:#8a8f9a">Support</a><br>
        © BidVoice AI · Your AI employee for contractors.
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

const row = (html) => `<tr><td style="padding:2px 0 10px">${html}</td></tr>`;
const money = (n) => "$" + (Math.round(Number(n) || 0)).toLocaleString("en-US");

// ---- The 8 templates ---------------------------------------------------------------

export function verifyEmail(base, { link, name } = {}) {
  const hi = name ? `Hi ${esc(name)},` : "Welcome —";
  return {
    subject: "Verify your email for BidVoice",
    html: shell(base, { preheader: "Confirm your email to finish setting up BidVoice.",
      heading: "Confirm your email", lead: `${hi} let’s make sure this inbox is yours.`,
      bodyHtml: row("Tap below to verify your email and finish setting up your account. This link expires in 24 hours."),
      ctaText: "Verify email", ctaUrl: link,
      footNote: "If you didn’t create a BidVoice account, you can safely ignore this email." }),
    text: `Confirm your email for BidVoice:\n${link}\n\nThis link expires in 24 hours. If you didn’t sign up, ignore this email.`,
  };
}

export function welcome(base, { name, appUrl } = {}) {
  const hi = name ? `Welcome, ${esc(name)}.` : "Welcome to BidVoice.";
  return {
    subject: "Welcome to BidVoice — Eden is ready",
    html: shell(base, { preheader: "Your AI employee is ready. Let’s get your first estimate out the door.",
      heading: hi, lead: "Your AI employee, Eden, is ready to get to work.",
      bodyHtml: row("Describe a job out loud and Eden writes the estimate, sends the proposal in your customer’s language, and helps you get paid — in minutes.<br><br>Open BidVoice and walk her through your first job."),
      ctaText: "Open BidVoice", ctaUrl: appUrl || base }),
    text: `Welcome to BidVoice. Your AI employee, Eden, is ready.\nOpen BidVoice: ${appUrl || base}`,
  };
}

export function passwordReset(base, { link } = {}) {
  return {
    subject: "Reset your BidVoice password",
    html: shell(base, { preheader: "Reset your BidVoice password. Link expires in 1 hour.",
      heading: "Reset your password", lead: "We got a request to reset your BidVoice password.",
      bodyHtml: row("Tap below to choose a new password. This link expires in 1 hour and can be used once."),
      ctaText: "Reset password", ctaUrl: link,
      footNote: "Didn’t request this? Ignore this email and your password stays the same." }),
    text: `Reset your BidVoice password:\n${link}\n\nThis link expires in 1 hour. If you didn’t request it, ignore this email.`,
  };
}

export function invitation(base, { link, from, note } = {}) {
  const who = from ? esc(from) : "Your team";
  return {
    subject: `${who ? from + " invited you to" : "You’re invited to"} BidVoice`,
    html: shell(base, { preheader: "You’ve been invited to BidVoice. Set your password to join.",
      heading: "You’re invited to BidVoice", lead: `${who} invited you to join them on BidVoice.`,
      bodyHtml: row((note ? `“${esc(note)}”<br><br>` : "") + "Set your password to join. This invitation link expires in 7 days."),
      ctaText: "Accept invitation", ctaUrl: link }),
    text: `${who} invited you to BidVoice.\n${note ? note + "\n" : ""}Set your password: ${link}\n(expires in 7 days)`,
  };
}

export function estimateShared(base, { link, contractor, customer, title, amount } = {}) {
  const from = contractor ? esc(contractor) : "Your contractor";
  return {
    subject: `${from} sent you an estimate${title ? " — " + title : ""}`,
    html: shell(base, { preheader: `${from} sent you an estimate to review.`,
      heading: "You’ve got a new estimate", lead: `${customer ? esc(customer) + ", " : ""}${from} prepared an estimate for you.`,
      bodyHtml: (title ? row(`<b>${esc(title)}</b>`) : "") + (amount ? row(`Estimated total: <b>${money(amount)}</b>`) : "") + row("Review it on your phone, ask questions, and approve when you’re ready."),
      ctaText: "View estimate", ctaUrl: link }),
    text: `${from} sent you an estimate${title ? " — " + title : ""}.${amount ? " Total: " + money(amount) + "." : ""}\nView: ${link}`,
  };
}

export function proposalViewed(base, { link, customer, title } = {}) {
  return {
    subject: `${customer ? esc(customer) : "Your customer"} opened your proposal`,
    html: shell(base, { preheader: "Your proposal was just opened.",
      heading: "Your proposal was opened", lead: `${customer ? esc(customer) : "Your customer"} just opened${title ? " “" + esc(title) + "”" : " your proposal"}.`,
      bodyHtml: row("Good time for a follow-up — want Eden to check in with them?"),
      ctaText: "Open the job", ctaUrl: link }),
    text: `${customer || "Your customer"} opened your proposal${title ? " (" + title + ")" : ""}.\nOpen: ${link}`,
  };
}

export function proposalSigned(base, { link, customer, title, amount } = {}) {
  return {
    subject: `Signed! ${customer ? esc(customer) : "Your customer"} accepted your proposal`,
    html: shell(base, { preheader: "Your proposal was signed.",
      heading: "🎉 Your proposal was signed", lead: `${customer ? esc(customer) : "Your customer"} accepted${title ? " “" + esc(title) + "”" : " your proposal"}.`,
      bodyHtml: (amount ? row(`Contract value: <b>${money(amount)}</b>`) : "") + row("Nice work. Want Eden to request the deposit and schedule the job?"),
      ctaText: "Open the job", ctaUrl: link }),
    text: `${customer || "Your customer"} signed your proposal${title ? " (" + title + ")" : ""}.${amount ? " Value: " + money(amount) + "." : ""}\nOpen: ${link}`,
  };
}

export function depositReceived(base, { link, customer, amount, title } = {}) {
  return {
    subject: `Paid — ${money(amount)} deposit received`,
    html: shell(base, { preheader: `You received a ${money(amount)} deposit.`,
      heading: `💰 ${money(amount)} deposit received`, lead: `${customer ? esc(customer) : "Your customer"} paid the deposit${title ? " on “" + esc(title) + "”" : ""}.`,
      bodyHtml: row("The money’s in. Eden can schedule the work and keep the customer updated — just say the word."),
      ctaText: "Open the job", ctaUrl: link }),
    text: `${customer || "Your customer"} paid a ${money(amount)} deposit${title ? " on " + title : ""}.\nOpen: ${link}`,
  };
}
