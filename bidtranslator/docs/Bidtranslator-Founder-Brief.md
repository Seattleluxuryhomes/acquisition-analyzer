# Bidtranslator — Founder Brief

**Domain:** Bidtranslator.com
**Tagline:** Record the conversation. Review it in both languages. Turn it into a bid. Send it for signature.

*This is the single source of truth for the product. It locks what's decided, flags what's still open, and lays out the build order. Conservative by design — the MVP must stand on its own with zero other contractors on the platform.*

---

## 1. What it is

A phone app for small contractors who capture jobs in the field and lose time turning messy conversations into clean bids.

You talk through the job on site, by voice or text, in English or Spanish. The app transcribes it, translates it if needed, and drops it into a job notebook with your photos. From that notebook you build the bid — base price, add-ons, upgrades, exclusions — and send a clean proposal before you leave the driveway.

Three things in one: a **field notebook** so you stop forgetting scope, a **translation layer** so the language gap stops causing confusion, and a **bid builder** so you send something clean instead of a scribbled estimate two days late.

It is not translation software. It is not just an estimator. It's a field notebook that ends in a bid.

## 2. Positioning

For small contractors who capture jobs in the field and lose time cleaning them into bids — Bidtranslator records the whole job, handles the language gap, and builds a send-ready proposal before you leave the site.

**Launch wedge:** the bilingual residential remodeler who captures jobs in one language and sends bids in another. Acute pain, no real competitor, demos in under 60 seconds, tight word-of-mouth community. Land there, then widen to English-only remodelers who still want faster, cleaner bids.

> Note: the name sells the wedge (translation) but may undersell the platform (notebook + bid builder). Fine for launch — "translator" is the door, not the whole house. Just don't let it scare off English-only contractors later.

---

## 3. MVP — three sections

The notebook is the center. Everything feeds it or comes out of it. A contractor must get real value on day one with no network behind it.

### NOTEBOOK (capture + organize)
- Voice capture and text capture
- Transcription
- English ⇄ Spanish translation
- Photo attach
- Scope summary (messy talk → structured points)
- Assumptions
- Exclusions
- Internal reminders (private to contractor)
- Upgrade opportunities flagged during capture
- Pricing notes
- One notebook per job

### BUILD THE BID (private estimating)
- Base bid with line items
- Grouped pricing (show or hide detail)
- Optional add-ons
- Upgrades and alternates
- Internal margin / markup the client never sees

### CLIENT VIEW (clean proposal)
- Polished preview
- Export to clean PDF
- Email or print from the phone
- Simple, trustworthy layout

**Mental model for the user:** Capture here → price here → send here. One job moves left to right through all three.

## 4. Key screens (v1)

1. Job list / home — active jobs, newest first, big "New Job" button
2. New job capture — voice or text, language toggle, record button front and center
3. Notebook view — transcript, translation, photos, scope, exclusions, reminders, upgrade flags
4. Scope summary — cleaned-up structured version, editable
5. Build the Bid — line items, groups, add-ons, upgrades, margin
6. Upgrade / add-on picker — attach optional items fast
7. Client View preview — exactly what the customer sees
8. Send / print — email, share, or PDF, with confirmation

If cutting to ship faster: fold #4 into #3 before cutting #6 (the upsell is core value).

## 5. Onboarding (first-time contractor)

Get them to one finished bid as fast as possible.

1. One-line promise: "Capture the job. Build the bid. Send it from your phone."
2. Language preference — English / Spanish / both
3. Two basics — company name, how bids are signed (name, phone, license # if used)
4. Guided first job — "Hit record and describe a real job." Their job, not a fake demo.
5. Show the payoff — structured scope appears. The "oh, this is useful" moment.
6. Build and send one bid — complete the loop once.

No pricing-database import, no account wizard up front. First session ends with a real, sendable bid.

---

## 6. Revenue model

| Idea | Verdict |
|---|---|
| **Contractor subscription** | **Primary engine.** Monthly fee for a tool that saves time and wins bids. Aligns our revenue with their success. This is the business. |
| Affiliate as the business model | No. Home-improvement affiliate rates are low and leaky; contractors buy wholesale on Pro accounts and mark materials up — an affiliate link asks them to surrender both their sourcing and their margin. Wrong market. |
| Affiliate on **client-furnished** items only | Minor secondary stream. Legitimate only when the *homeowner* is buying the item and was going to buy retail anyway. Never on contractor-supplied lines. |

Add a saved "my common items" list early — contractors will want reusable rates fast.

---

## 7. Decided but post-MVP (fast-follow / v1.1)

### Split bid ("who furnishes")
Let the client supply their own finish materials (fixtures, tile, appliances) while the contractor bids labor plus the materials they keep on their side. This is a real, accepted trade practice ("owner-furnished materials").

- Implement as a single **"who furnishes" field** on each bid line: contractor-supplied or client-supplied. That one field unlocks the whole flow.
- Client view shows clearly: "Labor: $X — you provide the materials below."
- This is where homeowner-facing product links legitimately live.
- Make it **optional, not default.** Many contractors avoid client-supplied materials on purpose — it's often a headache. Contractor-supplied stays the standard path.

### E-signature ("send for signature")
The tagline promises it, the original scope ended at email/print. Signature turns a bid into an accepted agreement — valuable, but adds legal weight and build work. **Recommendation: fast-follow, not MVP**, unless signing is core to the launch-wedge pain. Ship sending first, add signing once people are already sending.

### Optional delay / standby clause
When client-supplied materials show up late, the contractor shouldn't eat the cost. But handle this carefully:

- **Do not call it a "penalty."** In US construction contracts a "penalty" is often unenforceable. The enforceable version is **liquidated damages** — a pre-agreed amount that reasonably estimates the *actual* cost of delay.
- Tie it to a **real number** (what an idle crew day actually costs), not an arbitrary figure.
- The strongest protection is often **the right to reschedule**, not a dollar charge — a small contractor can't park a crew, they need to move on and come back.
- **The app must not auto-impose contract terms.** Make it a contractor-controlled, optional clause they fill in themselves. Offer a plain-language template framed as "many contractors add a standby-cost clause," clearly marked as a starting point to adapt — not legal advice.

> Not legal advice. Enforceability of liquidated-damages and delay clauses varies by state and by wording. Contractors should run anything serious past someone licensed in their state.

---

## 8. Future premium layer — Builder Box

**Not in the MVP. Not a reason the app exists.** A paid layer that only makes sense after the core tool has real adoption and enough trusted, active contractors for a network to mean anything.

Future concept: builders post projects; approved GCs receive opportunities; a curated, controlled, trusted network (not an open marketplace); contractors can be paused, removed, or suspended for non-compliance or underperformance.

The MVP's job is to prove the notebook + translation + bid loop is valuable on its own — which is exactly the foundation Builder Box would need.

---

## 9. Still open — decide before or shortly after launch

- **Pricing/cost data source** — manual entry for MVP; plan the "common items" list early.
- **Edit trust** — transcription and translation will be imperfect. Every auto-generated field must be easily editable, and it must be obvious what's machine-generated vs. contractor-confirmed (critical for exclusions and assumptions).
- **Offline capture** — jobsites have bad signal. Voice and photos must capture offline and sync later. If capture fails in a basement, the product fails.
- **Bid legal framing** — validity dates, "estimate not a contract" language on the client view.
- **Spanish quality** — generic translation is table stakes; *construction* Spanish (trade terms, regional usage) is the real differentiator. Budget real effort.
- **Bid versioning** — a revised bid shouldn't silently overwrite the record of what was sent.
- **Data ownership / consent** — contractors are recording client conversations. Be clear about consent, storage, and that recordings are theirs.

---

## 10. Build sequence

1. **MVP** — Notebook → Build the Bid → Client View → send/print as PDF. English ⇄ Spanish. Offline capture. Editable everything.
2. **v1.1** — "who furnishes" field + split-bid client view; e-signature; optional standby clause; saved common items.
3. **Later** — homeowner-facing product links on client-furnished items; bid versioning; analytics.
4. **Future** — Builder Box, only after real adoption.

## 11. Immediate next steps

1. **Lock this brief.** Treat it as the spec.
2. **Decide signature timing** — MVP or fast-follow (recommended: fast-follow).
3. **Choose the first build artifact:** landing page to collect signups, or a clickable screen flow for a developer to quote.
4. **Start sourcing construction-Spanish quality** — it's the moat, and the longest lead-time item.
5. **Find 5 bilingual remodelers** to talk to before a line of code ships. The wedge community is small and reachable; their input now is worth more than features later.
