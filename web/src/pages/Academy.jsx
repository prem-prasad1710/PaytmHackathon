import { useCallback, useMemo, useState } from "react";
import { ACADEMY_CASES } from "../data/academyCases.js";
import AcademyHub from "../components/academy/AcademyHub.jsx";
import AcademyRound from "../components/academy/AcademyRound.jsx";
import RoundEnd from "../components/academy/RoundEnd.jsx";
import {
  applyRoundResults,
  buildShareText,
  dailyChallenge,
  filterByChannel,
  isDailyComplete,
  hashDate,
  seededShuffle,
  todayStr,
  weakestTactic,
} from "../utils/academyEngine.js";
import { getAcademyState, setAcademyState, useAcademyState } from "../utils/academyStore.js";
import "../styles/academy.css";

const CHANNEL_LABELS = {
  all: "All channels",
  sms: "SMS",
  whatsapp: "WhatsApp",
  call: "Calls",
  qr: "QR codes",
  email: "Email",
  "upi-request": "UPI requests",
};

export default function Academy() {
  const state = useAcademyState();
  const today = todayStr();
  const [screen, setScreen] = useState("hub");
  const [roundCases, setRoundCases] = useState([]);
  const [roundMeta, setRoundMeta] = useState({ mode: "daily", channel: null });
  const [roundResult, setRoundResult] = useState(null);
  const [shareStatus, setShareStatus] = useState("");

  const dailyDone = isDailyComplete(state, today);
  const dailyScore = state.dailyCompleted?.[today];
  const weak = weakestTactic(state.mastery, 2);

  const startDaily = useCallback(() => {
    setRoundCases(dailyChallenge(ACADEMY_CASES, today, 10));
    setRoundMeta({ mode: "daily", channel: null });
    setRoundResult(null);
    setScreen("round");
  }, [today]);

  const startPractice = useCallback((channel) => {
    const pool = filterByChannel(ACADEMY_CASES, channel === "all" ? null : channel);
    const shuffled = seededShuffle(pool, hashDate(`${today}-${channel}`));
    setRoundCases(shuffled.slice(0, Math.min(10, shuffled.length)));
    setRoundMeta({ mode: "practice", channel });
    setRoundResult(null);
    setScreen("round");
  }, [today]);

  const handleComplete = useCallback(
    (answers) => {
      const result = applyRoundResults(getAcademyState(), {
        answers,
        dateStr: today,
        mode: roundMeta.mode,
        channel: roundMeta.channel,
      });
      setAcademyState(result.nextState);
      setRoundResult(result);
      setScreen("end");
    },
    [today, roundMeta]
  );

  const handleShare = useCallback(async () => {
    if (!roundResult) return;
    const text = buildShareText({
      score: roundResult.correctCount,
      total: roundResult.total,
      dayStreak: roundResult.nextState.dayStreak,
      newBadges: roundResult.newBadges,
      mode: roundMeta.mode,
    });
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("Copied!");
    } catch {
      setShareStatus("Copy failed — select text manually");
    }
    setTimeout(() => setShareStatus(""), 2500);
  }, [roundResult, roundMeta.mode]);

  const roundTitle = useMemo(() => {
    if (roundMeta.mode === "daily") return "Daily challenge";
    const ch = roundMeta.channel || "all";
    return `Practice: ${CHANNEL_LABELS[ch] || ch}`;
  }, [roundMeta]);

  if (screen === "round") {
    return (
      <AcademyRound
        cases={roundCases}
        title={roundTitle}
        onComplete={handleComplete}
        onExit={() => setScreen("hub")}
      />
    );
  }

  if (screen === "end" && roundResult) {
    return (
      <RoundEnd
        result={roundResult}
        state={roundResult.nextState}
        mode={roundMeta.mode}
        shareStatus={shareStatus}
        onShare={handleShare}
        onHome={() => setScreen("hub")}
        onPlayAgain={() =>
          roundMeta.mode === "daily" ? startDaily() : startPractice(roundMeta.channel || "all")
        }
      />
    );
  }

  return (
    <AcademyHub
      state={state}
      today={today}
      dailyDone={dailyDone}
      dailyScore={dailyScore}
      onStartDaily={startDaily}
      onStartPractice={startPractice}
      weakest={weak}
    />
  );
}
