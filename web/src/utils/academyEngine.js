/** Pure logic for Scam Academy — no DOM, no localStorage. */

export const TACTICS = [
  "urgency",
  "authority",
  "fear",
  "greed",
  "secrecy",
  "otp_request",
  "fee_demand",
  "fake_link",
  "qr_receive_money",
  "remote_access",
  "impersonation_family",
  "fake_refund",
  "job_offer",
  "kyc_block",
];

export const CHANNELS = ["sms", "whatsapp", "call", "qr", "email", "upi-request"];

export const XP_CORRECT = 10;
export const XP_STREAK_BONUS = 2;
export const XP_FAST_BONUS = 5;
export const FAST_THRESHOLD_MS = 6000;

export const LEVEL_THRESHOLDS = [0, 50, 120, 200, 300, 420, 560, 720, 900, 1100];

export const BADGE_DEFS = [
  { id: "otp_guardian", name: "OTP Guardian", desc: "Spot 5 OTP/PIN theft scams", icon: "🔐", tactic: "otp_request", count: 5 },
  { id: "qr_detective", name: "QR Detective", desc: "Spot 5 QR money traps", icon: "▣", tactic: "qr_receive_money", count: 5 },
  { id: "digital_arrest_survivor", name: "Digital Arrest Survivor", desc: "Spot 3 authority/fear scams", icon: "🛡", tactics: ["authority", "fear"], count: 3 },
  { id: "perfect_round", name: "Perfect Round", desc: "Get 10/10 in one round", icon: "⭐" },
  { id: "week_warrior", name: "7-Day Streak", desc: "Train 7 days in a row", icon: "🔥", streakDays: 7 },
  { id: "fast_thinker", name: "Fast Thinker", desc: "5 correct answers under 6 s", icon: "⚡", fastCount: 5 },
];

export function hashDate(dateStr) {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededShuffle(arr, seed) {
  const result = [...arr];
  let s = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function todayStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return todayStr(dt);
}

export function dailyChallenge(cases, dateStr, n = 10) {
  const seed = hashDate(dateStr);
  const shuffled = seededShuffle(cases, seed);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

export function filterByChannel(cases, channel) {
  if (!channel || channel === "all") return cases;
  return cases.filter((c) => c.channel === channel);
}

export function scoreAnswer(caseItem, userSaysScam, timeMs) {
  const correct = userSaysScam === caseItem.isScam;
  let xp = correct ? XP_CORRECT : 0;
  const fast = correct && timeMs < FAST_THRESHOLD_MS;
  if (fast) xp += XP_FAST_BONUS;
  return {
    correct,
    xp,
    fast,
    userSaysScam,
    expectedIsScam: caseItem.isScam,
  };
}

export function inRoundStreakBonus(streak) {
  if (streak <= 1) return 0;
  return (streak - 1) * XP_STREAK_BONUS;
}

export function computeLevel(xp) {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return Math.min(level, LEVEL_THRESHOLDS.length);
}

export function xpProgress(xp) {
  const level = computeLevel(xp);
  const current = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next =
    level < LEVEL_THRESHOLDS.length
      ? LEVEL_THRESHOLDS[level]
      : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 200;
  const span = next - current;
  const pct = span > 0 ? Math.min(100, ((xp - current) / span) * 100) : 100;
  return { level, current, next, pct, xp };
}

export function updateDayStreak(lastPlayDate, dayStreak, dateStr) {
  if (lastPlayDate === dateStr) {
    return { dayStreak, lastPlayDate: dateStr, streakChanged: false };
  }
  const yesterday = addDays(dateStr, -1);
  let newStreak = 1;
  if (!lastPlayDate) {
    newStreak = 1;
  } else if (lastPlayDate === yesterday) {
    newStreak = dayStreak + 1;
  }
  return { dayStreak: newStreak, lastPlayDate: dateStr, streakChanged: true };
}

export function emptyMastery() {
  return Object.fromEntries(TACTICS.map((t) => [t, { correct: 0, total: 0 }]));
}

export function updateMastery(mastery, tactics, correct) {
  const next = { ...mastery };
  for (const t of tactics) {
    const prev = next[t] || { correct: 0, total: 0 };
    next[t] = {
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    };
  }
  return next;
}

export function tacticAccuracy(mastery, tactic) {
  const m = mastery[tactic];
  if (!m || m.total === 0) return null;
  return m.correct / m.total;
}

export function accuracySummary(mastery) {
  const entries = TACTICS.map((t) => {
    const m = mastery[t] || { correct: 0, total: 0 };
    return {
      tactic: t,
      correct: m.correct,
      total: m.total,
      accuracy: m.total > 0 ? m.correct / m.total : null,
    };
  });
  const answered = entries.filter((e) => e.total > 0);
  const overallCorrect = answered.reduce((n, e) => n + e.correct, 0);
  const overallTotal = answered.reduce((n, e) => n + e.total, 0);
  return {
    tactics: entries,
    overall: overallTotal > 0 ? overallCorrect / overallTotal : null,
    overallCorrect,
    overallTotal,
  };
}

export function weakestTactic(mastery, minAttempts = 2) {
  const summary = accuracySummary(mastery);
  const candidates = summary.tactics
    .filter((t) => t.total >= minAttempts)
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1));
  return candidates[0]?.tactic ?? null;
}

export function tacticLabel(tactic) {
  return tactic
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function checkNewBadges(state, roundMeta) {
  const earned = new Set(state.badges || []);
  const newBadges = [];

  for (const def of BADGE_DEFS) {
    if (earned.has(def.id)) continue;

    if (def.tactic) {
      const m = state.mastery?.[def.tactic];
      if (m && m.correct >= def.count) {
        newBadges.push(def.id);
      }
    }
    if (def.tactics) {
      const total = def.tactics.reduce(
        (n, t) => n + (state.mastery?.[t]?.correct || 0),
        0
      );
      if (total >= def.count) newBadges.push(def.id);
    }
    if (def.streakDays && state.dayStreak >= def.streakDays) {
      newBadges.push(def.id);
    }
    if (def.fastCount && (state.fastCorrectCount || 0) >= def.fastCount) {
      newBadges.push(def.id);
    }
    if (
      def.id === "perfect_round" &&
      roundMeta?.perfect &&
      roundMeta.total >= 10
    ) {
      newBadges.push(def.id);
    }
  }

  return newBadges;
}

export function applyRoundResults(state, { answers, dateStr, mode, channel }) {
  let xp = state.xp || 0;
  let mastery = { ...emptyMastery(), ...state.mastery };
  let fastCorrectCount = state.fastCorrectCount || 0;
  let inRoundStreak = 0;
  let roundXp = 0;
  let correctCount = 0;
  const answerRecords = [];

  for (const a of answers) {
    const scored = scoreAnswer(a.caseItem, a.userSaysScam, a.timeMs);
    if (scored.correct) {
      correctCount += 1;
      inRoundStreak += 1;
      const bonus = inRoundStreakBonus(inRoundStreak);
      const gained = scored.xp + bonus;
      roundXp += gained;
      xp += gained;
      if (scored.fast) fastCorrectCount += 1;
    } else {
      inRoundStreak = 0;
    }
    mastery = updateMastery(mastery, a.caseItem.tactics || [], scored.correct);
    answerRecords.push({ ...scored, caseId: a.caseItem.id, bonus: inRoundStreakBonus(inRoundStreak) });
  }

  const streakUpdate = updateDayStreak(state.lastPlayDate, state.dayStreak || 0, dateStr);
  const perfect = correctCount === answers.length && answers.length > 0;

  const nextState = {
    ...state,
    xp,
    mastery,
    fastCorrectCount,
    dayStreak: streakUpdate.dayStreak,
    lastPlayDate: streakUpdate.lastPlayDate,
    totalRounds: (state.totalRounds || 0) + 1,
    totalCorrect: (state.totalCorrect || 0) + correctCount,
    totalAnswered: (state.totalAnswered || 0) + answers.length,
  };

  if (mode === "daily") {
    nextState.dailyCompleted = {
      ...(state.dailyCompleted || {}),
      [dateStr]: {
        score: correctCount,
        total: answers.length,
        completedAt: new Date().toISOString(),
      },
    };
  }

  const newBadges = checkNewBadges(nextState, { perfect, total: answers.length });
  if (newBadges.length) {
    nextState.badges = [...(state.badges || []), ...newBadges];
  }

  return {
    nextState,
    roundXp,
    correctCount,
    total: answers.length,
    perfect,
    newBadges,
    answerRecords,
    answers,
    streakUpdate,
    mode,
    channel,
  };
}

export function isDailyComplete(state, dateStr) {
  return Boolean(state.dailyCompleted?.[dateStr]);
}

export function buildShareText({ score, total, dayStreak, newBadges, mode }) {
  const label = mode === "daily" ? "today's Scam Academy challenge" : "Scam Academy practice";
  let text = `I scored ${score}/${total} on ${label}`;
  if (dayStreak > 1) text += `, ${dayStreak}-day streak 🔥`;
  text += "! 🛡️";
  if (newBadges?.length) {
    const names = newBadges
      .map((id) => BADGE_DEFS.find((b) => b.id === id)?.name)
      .filter(Boolean);
    if (names.length) text += ` Earned: ${names.join(", ")}.`;
  }
  return text;
}
