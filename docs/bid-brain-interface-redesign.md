# Bid Brain — the interface, rethought from first principles (design, no code yet)

> **Core principle:** BidVoice is not an app — it's an AI employee. The contractor should never
> feel like they're using software; they should feel like they're talking to someone who works
> for them. The whole interface must support that. **There is one obvious action: Talk.**

## 0. Honest diagnosis (I built the thing we're replacing)

The current Bid Brain panel (screenshot) is a **chatbot with five competing controls for one
job**:

1. a **green mic** (left of the field)
2. an **orange action key** (send/stop, right of the field) — a *second* control
3. a **text field** with *"Ask Bid Brain anything…"* — which makes typing feel primary
4. **chat bubbles** (you / Bid Brain) — the "I'm in a chat app" frame
5. the **floating orb** glowing behind the panel — decorative, disconnected from the action

And outside the panel: the **orange capture mic in the bottom nav** — a *sixth* voice entry
point, for "new estimate." So a contractor genuinely faces the questions the brief names: *Do I
type? Green mic or orange mic? Press send? What's the orb for? Why is this a chat window?*

That is a failure of the core principle. You don't talk to an employee through a chat box with two
microphones. **This isn't a polish job — the structure is wrong.** Rip it out.

---

## 1. The one decision that fixes everything

**Collapse all six entry points into ONE living Bid Brain, anchored where the thumb already lives
— the bottom-center.** The orange capture mic *becomes* Bid Brain (the living orb). The floating
orb, the in-panel green mic, and the action key all disappear into it. Tapping it does not "open a
chat" — **it wakes the employee up.**

- One voice surface. **Voice is primary; typing is a deliberate, one-tap secondary.**
- No second mic. No send button. No "Ask Bid Brain anything…" No chat-app chrome.
- The mic is no longer "new estimate." It's *"ask the employee"* — and Bid Brain routes the
  intent (start an estimate, schedule, follow up, answer) via the `[[action]]`/`[[schedule]]`
  directives we already built. The single front door, finally singular.

This also resolves a thesis we already wrote down (`product-principles.md`: *conversation is the
single front door; the button bar gets shorter, not longer*). Today it has two mics and an orb.
Tomorrow it has **one** thing that is unmistakably your AI employee.

---

## 2. The wake interaction (the magic — one continuous experience)

Tapping the orb must feel like the assistant *coming to life in place*, not a modal appearing.
The bottom-center orb **lifts and expands upward** into the conversation surface as the app dims
behind it — one continuous morph, no cut. And **it is already listening** (we built hands-free +
the "ready" state). The contractor just talks.

**State choreography (all states already exist on the orb — we're relocating them):**
1. **Resting** — the orb sits in the nav, breathing softly (blue idle). Always present.
2. **Wake** — tap → it lifts and grows into the surface; a soft chime; mic opens (green "ready"
   → "listening").
3. **Listening** — the orb pulses green; a **live transcript** of the contractor's words appears
   large and calm; a waveform shows it's hearing them. *No text field, no buttons.*
4. **Thinking** — orb shifts to the thinking state; the transcript settles.
5. **Speaking** — Bid Brain answers **out loud** (the voice loop) and on-screen, in a calm large
   line — not a chat bubble in a thread.
6. **Continue** — it returns to the ready/listening state automatically (the loop we built), so
   the contractor just keeps talking. A conversation, not a turn-based form.
7. **Rest** — tap away / "done" → the surface collapses back down into the resting orb in the nav.

The feeling: *the employee woke up, listened, answered, and is ready for the next thing.* One
object, one motion, one obvious action.

---

## 3. The surface anatomy (radically minimal)

Top to bottom, almost nothing on screen:

- **The orb** — the living centerpiece and the *only* status indicator (listening / thinking /
  speaking). It replaces the mic button, the action key, and the decorative orb in one stroke.
- **The live exchange** — the contractor's words (as they speak) and Bid Brain's latest reply,
  shown large and spacious. The *current* exchange is the focus; older history scrolls above,
  de-emphasized (not chat-bubble-styled — quieter, like a transcript). The "chat window" feeling
  goes away.
- **Suggested actions** — a *few* large chips, contextual to what was just said (Create the
  estimate · Open the job · Schedule it). Tappable shortcuts to confirm an intent. Not a menu of
  everything — 2–3, relevant, or none.
- **One secondary affordance: ⌨ Type** — a single small control. Tap it to reveal **one** field
  (no mic beside it, no separate send — Enter sends). For when talking won't do (§5).

Gone: the green mic, the orange action key, the placeholder, the persistent text field, the
bubble thread as the frame. **The default surface is: a living orb that's already listening, the
words, the answer, and at most a few chips.**

---

## 4. One surface, two speeds (quick turn vs. long dictation)

The same surface must hold both *"what's on my plate today?"* (a 3-second question) and *"okay,
kitchen remodel — demo the uppers, the customer's keeping the island…"* (a 2-minute job
dictation). Design for both:

- **Quick turn:** speak → silence auto-submits (built) → answer → ready again.
- **Long dictation:** the contractor keeps talking; the live transcript grows; **silence
  auto-submit is suspended while they're clearly still describing a job** (longer pause
  threshold, or a visible "still listening — tap when done"). A **hold-to-talk** option covers
  the loud jobsite where VAD is unreliable. Bid Brain recognizes a job description and routes it
  to estimate-building — the old "capture" flow becomes *one intent of the one surface*, not a
  separate mic.

This is the honest reason the two mics existed (one for quick chat, one for long capture). The
redesign keeps **both behaviors** while removing the **second control** — the surface adapts to
how long they talk.

---

## 5. Typing is secondary — but first-class, for one critical reason: privacy

Voice-primary is right, but typing cannot be buried, because of a real and important case the
brief doesn't mention: **the contractor is often standing next to the customer.** They must *never*
have to say private things — margin, "what's my cost on this," internal notes — **out loud near a
homeowner.** Margin is a hard-rule private value (#2). So:

- **⌨ Type** is always one tap away (noise, quiet rooms, privacy).
- When the conversation touches anything private (margin, cost, internal strategy), Bid Brain can
  **proactively offer to switch to typing** ("Want to keep this private? Tap to type instead").
  Trust-by-design, applied to the *interface*.

Voice is the hero; typing is the dignified, always-available fallback — not an afterthought.

---

## 6. What we reuse vs. retire (grounded in the actual code)

**Reuse (it's good and built):** the voice loop engine (`bbConvMic` → record → transcribe →
respond → auto-listen, with ready/listening/thinking/speaking states, silence auto-stop,
barge-in), the orb state machine + visuals, the `[[action]]`/`[[schedule]]` directive routing,
the briefing, suggested actions, the contextual intelligence.

**Retire / merge:** the floating orb dock as a *separate* element (it becomes the nav orb); the
in-panel green mic (`#bbMicBtn`); the morphing action key send/stop (`#bbActKey` — the voice loop
+ tap-to-finish replace it); the *"Ask Bid Brain anything…"* placeholder; the persistent text
field (becomes the ⌨ reveal); the chat-bubble framing (becomes a quiet transcript). The bottom-nav
capture FAB *becomes* the Bid Brain orb.

We are not building new infrastructure — we are **removing controls** and relocating the orb. The
hardest part is deletion, which is exactly the discipline our principles demand.

---

## 7. Discoverability, access, accessibility (don't break the basics)

- **Discoverability:** a first-run coach — the orb pulses with a one-time *"Tap and talk to Bid
  Brain."* After that, the wake animation teaches it.
- **Permissions / iOS:** reuse the mic-permission states + the iOS speech-gating fallback we
  built — if auto-listen is blocked, the orb shows "tap to talk" and degrades gracefully.
- **Accessibility:** voice and visual are always paired (a Deaf or hard-of-hearing contractor
  sees the transcript + reply text; the ⌨ path is fully equivalent). `prefers-reduced-motion`
  tones the morph to a fade. Color is never the only state signal (the orb pairs color with
  motion + a word).

## 8. The four gates (every element earns its place)

| Element | Reduces work? | Delight? | Trust? | Feels like an employee? | Verdict |
|---|---|---|---|---|---|
| One living orb (wake + listen) | ✓✓ (one action) | ✓✓ | ✓ | ✓✓ | **The whole design** |
| Live transcript + spoken reply | ✓ | ✓ | ✓ (they see what was heard) | ✓✓ | **Keep** |
| 2–3 contextual action chips | ✓ | ✓ | – | ✓ | **Keep (few)** |
| ⌨ Type (privacy/noise fallback) | ✓ | – | ✓✓ (privacy) | ✓ | **Keep (one tap)** |
| Green mic / orange key / placeholder | ✗ | ✗ | ✗ (confusing) | ✗ | **Remove** |
| Floating orb (separate) | ✗ | ✗ | – | – | **Merge into the nav orb** |
| Chat-bubble thread frame | ✗ | ✗ | – | ✗ | **Replace with a quiet transcript** |

---

## 9. Honest risks & how we de-risk

1. **This is the most-used control in the app.** Changing it is high-stakes. → Ship behind a flag,
   A/B against the current panel, watch task-completion + voice-usage + drop-off before full
   rollout. Reversible.
2. **Jobsite noise breaks VAD/transcription.** → hold-to-talk option; show the transcript so they
   catch errors; the ⌨ fallback; (later) the trade-aware "I heard X — right?" confirm.
3. **Privacy-aloud near customers.** → the one-tap ⌨ path + proactive "switch to private typing"
   on sensitive topics (§5). Non-negotiable.
4. **Losing the dedicated long-capture affordance.** → §4's two-speed design + hold-to-talk keeps
   it; verify a 2-minute dictation feels great, not like a dropped call.
5. **Discoverability of "tap and talk."** → first-run coach + the wake animation.
6. **iOS auto-listen gating** (can't always hot-mic). → graceful "tap to talk" degrade (built).

## 10. MVP — the smallest version that delivers "I'm talking to my employee"

1. The bottom-center orb **becomes** Bid Brain; tapping **wakes it and starts listening
   immediately** (reuse the voice loop). 2. The minimal surface: living orb + live transcript +
spoken/large reply + 2–3 contextual chips + one **⌨ Type** affordance. 3. **Delete** the green
mic, the action key, the placeholder, the persistent field, and the separate floating orb. 4.
First-run "tap and talk" coach. Defer: the cinematic morph polish, the proactive privacy switch,
the hold-to-talk tuning for loud sites (fast-follows).

This is not a better chat box. It's the **deletion** of the chat box in favor of one living
employee you talk to — which is the entire promise of BidVoice, finally expressed in the primary
interface.

---

*No code. Complete first-principles vision for review. The decision to confirm first: that we
**unify the orb + both mics + the action key into the single bottom-center Bid Brain**, make voice
primary with typing one tap away, and retire the chat-window framing — before any implementation,
behind a flag, measured against today's panel.*
