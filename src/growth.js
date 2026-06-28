// Sprint 13 — AI Growth Score.
//
// A two-tier score that COACHES instead of just measuring. The key design call
// (Ben's): setup alone caps at 80, so the score never "finishes" — the top 20 is
// earned through ongoing momentum (recent work, activity) and DECAYS if you go
// stale. Pure math on data already in the system; no AI, no external deps.
//
// Every recommendation is shaped as an ACTION OBJECT — the exact shape the Sprint 14
// Approval Inbox renders — so the two are the same machine, not two features.
import db from "./db.js";

const DAY = 24 * 60 * 60 * 1000;

function services(user) { try { return JSON.parse(user.services || "[]"); } catch { return []; } }

// One foundation/momentum check → an action object.
// { id, tier, title, impact, done, cta, route, coming_soon }
function item(id, tier, title, points, done, cta, route, comingSoon = false) {
  return { id, tier, title, impact: "+" + points, points, earned: done ? points : 0, done: !!done, cta: cta || "", route: route || "", coming_soon: !!comingSoon };
}

export function growthScore(user) {
  const uid = user.id;
  const now = Date.now();
  const nProjects = db.prepare("SELECT COUNT(*) c, MAX(created_at) m FROM site_project WHERE user_id=? AND status='published'").get(uid);
  const nPhotos = db.prepare("SELECT COUNT(*) c FROM photo WHERE user_id=?").get(uid).c;
  const sentJobs = db.prepare("SELECT COUNT(*) c, MAX(sent_at) m FROM job WHERE user_id=? AND sent_at IS NOT NULL").get(uid);
  const svc = services(user);

  // ---- Tier 1 — Foundation (one-time climb, fully controllable; caps at 80) ----
  const foundation = [
    item("profile", "foundation", "Add your company name & phone", 15, !!(user.company && user.company !== "Your Company" && user.phone), "Complete profile", "settings"),
    item("services", "foundation", "List the services you offer", 10, svc.length > 0, "Add services", "settings"),
    item("logo", "foundation", "Add your logo", 5, !!user.logo, "Upload logo", "settings"),
    item("website", "foundation", "Publish your website", 15, !!user.site_published, "Publish website", "settings"),
    item("about", "foundation", "Write your About page with AI", 10, !!(user.site_about && user.site_about.trim()), "Write About", "settings"),
    item("project", "foundation", "Publish your first project", 15, (nProjects.c || 0) >= 1, "Publish a project", "jobs"),
    item("photos", "foundation", "Add photos to a job", 10, (nPhotos || 0) >= 3, "Add photos", "jobs"),
  ];

  // ---- Tier 2 — Momentum (earned by staying active; DECAYS; max 20) ----
  // Fresh work: full points if a project published in 30d, half by 60d, none after.
  const lastProj = nProjects.m || 0;
  const projAge = lastProj ? (now - lastProj) / DAY : Infinity;
  const freshPts = projAge <= 30 ? 8 : projAge <= 60 ? 4 : 0;
  const fresh = item("fresh", "momentum", "Publish a recent project to stay sharp", 8, false, "Publish a recent project", "jobs");
  fresh.earned = freshPts; fresh.done = freshPts === 8;
  if (freshPts > 0 && freshPts < 8) fresh.title = "Publish a new project — your last one is going stale";

  // Recent activity: an estimate sent in the last 30 days.
  const lastSent = sentJobs.m || 0;
  const actPts = lastSent && (now - lastSent) / DAY <= 30 ? 6 : 0;
  const activity = item("activity", "momentum", "Send an estimate this month", 6, actPts === 6, "Create an estimate", "jobs");
  activity.earned = actPts;

  // Reviews — the seam (Sprint: reviews). Not yet earnable, so it can't be "failed";
  // it just leaves aspirational headroom and is clearly marked coming soon.
  const reviews = item("reviews", "momentum", "Connect your Google reviews", 6, false, "Connect reviews", "settings", true);
  reviews.earned = 0;

  const momentum = [fresh, activity, reviews];

  const all = [...foundation, ...momentum];
  const earned = all.reduce((s, i) => s + i.earned, 0);
  const foundationEarned = foundation.reduce((s, i) => s + i.earned, 0);
  const score = Math.min(100, Math.round(earned));

  // The single highest-impact next action (skip coming-soon + done).
  const next = all.filter((i) => !i.done && !i.coming_soon).sort((a, b) => b.points - a.points)[0] || null;

  // A short coach line keyed to where they are.
  let coach;
  if (score >= 100) coach = "You're at the top — keep the momentum going.";
  else if (foundationEarned < 80) coach = `You're at ${score}. A few quick wins finish your foundation.`;
  else coach = `Foundation done (80) — now earn the top by staying active.`;

  return {
    score,
    foundation_max: 80,
    foundation_earned: foundationEarned,
    momentum_max: 20,
    momentum_earned: earned - foundationEarned,
    coach,
    next,
    items: all,
    todo: all.filter((i) => !i.done),
    done: all.filter((i) => i.done),
  };
}
