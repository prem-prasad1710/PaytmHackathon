import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashDate,
  seededShuffle,
  dailyChallenge,
  scoreAnswer,
  computeLevel,
  xpProgress,
  updateDayStreak,
  addDays,
  inRoundStreakBonus,
  updateMastery,
  accuracySummary,
  weakestTactic,
  applyRoundResults,
  checkNewBadges,
  emptyMastery,
  XP_CORRECT,
  XP_FAST_BONUS,
  FAST_THRESHOLD_MS,
} from "./academyEngine.js";

const SAMPLE_CASES = [
  { id: "a", isScam: true, tactics: ["otp_request"] },
  { id: "b", isScam: false, tactics: [] },
  { id: "c", isScam: true, tactics: ["greed"] },
  { id: "d", isScam: true, tactics: ["fear"] },
  { id: "e", isScam: false, tactics: [] },
  { id: "f", isScam: true, tactics: ["urgency"] },
  { id: "g", isScam: true, tactics: ["authority"] },
  { id: "h", isScam: false, tactics: [] },
  { id: "i", isScam: true, tactics: ["qr_receive_money"] },
  { id: "j", isScam: false, tactics: [] },
  { id: "k", isScam: true, tactics: ["kyc_block"] },
  { id: "l", isScam: true, tactics: ["fee_demand"] },
];

describe("hashDate & seededShuffle", () => {
  it("hashDate is deterministic", () => {
    assert.equal(hashDate("2026-10-06"), hashDate("2026-10-06"));
    assert.notEqual(hashDate("2026-10-06"), hashDate("2026-10-07"));
  });

  it("seededShuffle is stable for same seed", () => {
    const a = seededShuffle([1, 2, 3, 4, 5], 42);
    const b = seededShuffle([1, 2, 3, 4, 5], 42);
    assert.deepEqual(a, b);
  });

  it("seededShuffle differs for different seeds", () => {
    const a = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8], 1);
    const b = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8], 2);
    assert.notDeepEqual(a, b);
  });
});

describe("dailyChallenge", () => {
  it("returns deterministic set for same date", () => {
    const d1 = dailyChallenge(SAMPLE_CASES, "2026-10-06", 5);
    const d2 = dailyChallenge(SAMPLE_CASES, "2026-10-06", 5);
    assert.deepEqual(d1.map((c) => c.id), d2.map((c) => c.id));
  });

  it("returns different order for different dates", () => {
    const d1 = dailyChallenge(SAMPLE_CASES, "2026-10-06", 10);
    const d2 = dailyChallenge(SAMPLE_CASES, "2026-10-07", 10);
    assert.notDeepEqual(d1.map((c) => c.id), d2.map((c) => c.id));
  });

  it("respects n limit", () => {
    const d = dailyChallenge(SAMPLE_CASES, "2026-10-06", 3);
    assert.equal(d.length, 3);
  });
});

describe("scoreAnswer", () => {
  const scam = { id: "x", isScam: true, tactics: ["otp_request"] };

  it("marks correct when user spots scam", () => {
    const r = scoreAnswer(scam, true, 8000);
    assert.equal(r.correct, true);
    assert.equal(r.xp, XP_CORRECT);
  });

  it("marks incorrect when user misses scam", () => {
    const r = scoreAnswer(scam, false, 3000);
    assert.equal(r.correct, false);
    assert.equal(r.xp, 0);
  });

  it("awards fast bonus under 6 seconds", () => {
    const r = scoreAnswer(scam, true, FAST_THRESHOLD_MS - 1);
    assert.equal(r.fast, true);
    assert.equal(r.xp, XP_CORRECT + XP_FAST_BONUS);
  });

  it("no fast bonus at or above threshold", () => {
    const r = scoreAnswer(scam, true, FAST_THRESHOLD_MS);
    assert.equal(r.fast, false);
    assert.equal(r.xp, XP_CORRECT);
  });
});

describe("levels", () => {
  it("computeLevel at boundaries", () => {
    assert.equal(computeLevel(0), 1);
    assert.equal(computeLevel(49), 1);
    assert.equal(computeLevel(50), 2);
    assert.equal(computeLevel(119), 2);
    assert.equal(computeLevel(120), 3);
    assert.equal(computeLevel(1100), 10);
  });

  it("xpProgress calculates percentage", () => {
    const p = xpProgress(75);
    assert.equal(p.level, 2);
    assert.ok(p.pct > 0 && p.pct < 100);
  });
});

describe("day streak", () => {
  it("starts at 1 on first play", () => {
    const r = updateDayStreak(null, 0, "2026-10-06");
    assert.equal(r.dayStreak, 1);
    assert.equal(r.lastPlayDate, "2026-10-06");
  });

  it("increments on consecutive day", () => {
    const r = updateDayStreak("2026-10-05", 3, "2026-10-06");
    assert.equal(r.dayStreak, 4);
  });

  it("resets after missed day", () => {
    const r = updateDayStreak("2026-10-03", 5, "2026-10-06");
    assert.equal(r.dayStreak, 1);
  });

  it("does not increment twice same day", () => {
    const r = updateDayStreak("2026-10-06", 4, "2026-10-06");
    assert.equal(r.dayStreak, 4);
    assert.equal(r.streakChanged, false);
  });

  it("addDays works across month boundary", () => {
    assert.equal(addDays("2026-10-01", -1), "2026-09-30");
    assert.equal(addDays("2026-10-06", 1), "2026-10-07");
  });
});

describe("in-round streak bonus", () => {
  it("no bonus for first correct", () => {
    assert.equal(inRoundStreakBonus(1), 0);
  });

  it("bonus grows with streak", () => {
    assert.equal(inRoundStreakBonus(3), 4);
    assert.equal(inRoundStreakBonus(5), 8);
  });
});

describe("mastery", () => {
  it("tracks per-tactic accuracy", () => {
    let m = emptyMastery();
    m = updateMastery(m, ["otp_request", "fear"], true);
    m = updateMastery(m, ["otp_request"], false);
    const summary = accuracySummary(m);
    const otp = summary.tactics.find((t) => t.tactic === "otp_request");
    assert.equal(otp.correct, 1);
    assert.equal(otp.total, 2);
    assert.equal(otp.accuracy, 0.5);
  });

  it("weakestTactic picks lowest accuracy with min attempts", () => {
    let m = emptyMastery();
    m = updateMastery(m, ["greed"], false);
    m = updateMastery(m, ["greed"], false);
    m = updateMastery(m, ["fear"], true);
    m = updateMastery(m, ["fear"], true);
    assert.equal(weakestTactic(m, 2), "greed");
  });

  it("weakestTactic returns null when insufficient data", () => {
    assert.equal(weakestTactic(emptyMastery(), 2), null);
  });
});

describe("badges", () => {
  it("awards OTP Guardian after 5 otp correct", () => {
    let m = emptyMastery();
    for (let i = 0; i < 5; i++) m = updateMastery(m, ["otp_request"], true);
    const state = { badges: [], mastery: m, dayStreak: 1, fastCorrectCount: 0 };
    const newBadges = checkNewBadges(state, {});
    assert.ok(newBadges.includes("otp_guardian"));
  });

  it("awards perfect round badge", () => {
    const state = { badges: [], mastery: emptyMastery(), dayStreak: 1, fastCorrectCount: 0 };
    const newBadges = checkNewBadges(state, { perfect: true, total: 10 });
    assert.ok(newBadges.includes("perfect_round"));
  });

  it("awards 7-day streak badge", () => {
    const state = { badges: [], mastery: emptyMastery(), dayStreak: 7, fastCorrectCount: 0 };
    const newBadges = checkNewBadges(state, {});
    assert.ok(newBadges.includes("week_warrior"));
  });

  it("does not re-award earned badges", () => {
    const state = { badges: ["otp_guardian"], mastery: emptyMastery(), dayStreak: 7, fastCorrectCount: 0 };
    const newBadges = checkNewBadges(state, {});
    assert.ok(!newBadges.includes("otp_guardian"));
  });
});

describe("applyRoundResults", () => {
  it("accumulates XP with streak bonuses", () => {
    const cases = [
      { id: "1", isScam: true, tactics: ["greed"] },
      { id: "2", isScam: true, tactics: ["fear"] },
      { id: "3", isScam: false, tactics: [] },
    ];
    const answers = [
      { caseItem: cases[0], userSaysScam: true, timeMs: 3000 },
      { caseItem: cases[1], userSaysScam: true, timeMs: 4000 },
      { caseItem: cases[2], userSaysScam: false, timeMs: 5000 },
    ];
    const { nextState, roundXp, correctCount } = applyRoundResults(
      { xp: 0, badges: [], mastery: emptyMastery(), dayStreak: 0, lastPlayDate: null },
      { answers, dateStr: "2026-10-06", mode: "daily" }
    );
    assert.equal(correctCount, 3);
    assert.ok(roundXp > XP_CORRECT * 3);
    assert.equal(nextState.xp, roundXp);
    assert.ok(nextState.dailyCompleted["2026-10-06"]);
  });

  it("resets in-round streak on wrong answer", () => {
    const cases = [
      { id: "1", isScam: true, tactics: ["greed"] },
      { id: "2", isScam: true, tactics: ["fear"] },
    ];
    const answers = [
      { caseItem: cases[0], userSaysScam: true, timeMs: 3000 },
      { caseItem: cases[1], userSaysScam: false, timeMs: 3000 },
    ];
    const { roundXp } = applyRoundResults(
      { xp: 0, badges: [], mastery: emptyMastery(), dayStreak: 0, lastPlayDate: null },
      { answers, dateStr: "2026-10-07", mode: "practice" }
    );
    assert.equal(roundXp, XP_CORRECT + XP_FAST_BONUS);
  });
});
