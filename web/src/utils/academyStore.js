import { useEffect, useState } from "react";
import { emptyMastery } from "./academyEngine.js";

const KEY = "ss_academy_v1";
const EVENT = "ss-academy-store";

export const DEFAULT_STATE = {
  version: 1,
  xp: 0,
  dayStreak: 0,
  lastPlayDate: null,
  badges: [],
  mastery: emptyMastery(),
  fastCorrectCount: 0,
  dailyCompleted: {},
  totalRounds: 0,
  totalCorrect: 0,
  totalAnswered: 0,
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE, mastery: emptyMastery() };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      mastery: { ...emptyMastery(), ...(parsed.mastery || {}) },
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
      dailyCompleted: parsed.dailyCompleted || {},
    };
  } catch {
    return { ...DEFAULT_STATE, mastery: emptyMastery() };
  }
}

function write(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage blocked or full */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function getAcademyState() {
  return read();
}

export function setAcademyState(next) {
  write(next);
  return next;
}

export function patchAcademyState(patch) {
  const current = read();
  const next = { ...current, ...patch };
  write(next);
  return next;
}

export function resetAcademyState() {
  const fresh = { ...DEFAULT_STATE, mastery: emptyMastery() };
  write(fresh);
  return fresh;
}

export function useAcademyState() {
  const [state, setState] = useState(read);
  useEffect(() => {
    const update = () => setState(read());
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return state;
}
