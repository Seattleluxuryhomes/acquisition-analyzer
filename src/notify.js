// Outbound confirmations (contractor + customer) on key proposal events.
//
// There's no mail/SMS provider wired in this build, so this is a single, optional
// seam: if BT_NOTIFY_WEBHOOK is set it POSTs a JSON payload there (route it to
// email/SMS/Follow Up Boss via Zapier/Make/your own handler); otherwise it's a
// no-op. The contractor is ALSO notified in-app via the "good news" inbox
// (analytics.notifications), so this is purely the external fan-out.
const WEBHOOK = () => process.env.BT_NOTIFY_WEBHOOK || "";

export function notifyConfigured() { return !!WEBHOOK(); }

// Fire-and-forget — never throws into the caller, never blocks the response.
export function notify(type, payload = {}) {
  const url = WEBHOOK();
  if (!url) return Promise.resolve({ skipped: true });
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, at: Date.now(), ...payload }),
  }).then(() => ({ ok: true })).catch(() => ({ error: true }));
}

// A proposal was signed/accepted by the customer.
export function notifySigned({ owner, job, signerName, total, paid }) {
  return notify("proposal_signed", {
    contractor: { id: owner?.id, email: owner?.email, company: owner?.company },
    customer: { name: signerName, jobCustomer: job?.customer || "" },
    job: { id: job?.id, title: job?.title },
    acceptedTotal: total,
    depositPaid: !!paid,
  });
}
