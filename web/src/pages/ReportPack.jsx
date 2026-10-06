import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import FirstHourPanel from "../components/reportpack/FirstHourPanel.jsx";
import HistoryPicker from "../components/reportpack/HistoryPicker.jsx";
import IncidentForm from "../components/reportpack/IncidentForm.jsx";
import ComplaintPreview from "../components/reportpack/ComplaintPreview.jsx";
import FollowUpSection from "../components/reportpack/FollowUpSection.jsx";
import {
  mergePrefill,
  prefillFromRouterState,
  prefillFromPickerItem,
  buildReportPack,
  sanitizeInput,
} from "../utils/reportPack.js";
import { getChecks, getPayments, getLocalReports, useStoreValue } from "../utils/store";
import "../styles/reportPack.css";

const FORM_STORAGE_KEY = "ss_report_pack_form";

const EMPTY_INCIDENT = {
  incidentAt: "",
  discoveredAt: "",
  channel: "",
  scammerPhone: "",
  scammerUpi: "",
  scammerUrl: "",
  amountLost: 0,
  paymentMode: "",
  txnRef: "",
  bank: "",
  description: "",
  evidence: {
    chatScreenshots: false,
    paymentConfirmation: false,
    utr: false,
    callerNumberScreenshot: false,
    bankSms: false,
  },
};

function loadForm() {
  try {
    const raw = localStorage.getItem(FORM_STORAGE_KEY);
    return raw ? { ...EMPTY_INCIDENT, ...JSON.parse(raw), evidence: { ...EMPTY_INCIDENT.evidence, ...JSON.parse(raw).evidence } } : null;
  } catch {
    return null;
  }
}

function saveForm(data) {
  try {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export default function ReportPack() {
  const location = useLocation();
  const checks = useStoreValue(getChecks);
  const payments = useStoreValue(getPayments);
  const reports = useStoreValue(getLocalReports);

  const [data, setData] = useState(() => {
    const saved = loadForm();
    const router = prefillFromRouterState(location.state);
    const merged = mergePrefill(saved || {}, router);
    if (!merged.incidentAt) merged.incidentAt = new Date().toISOString();
    return { ...EMPTY_INCIDENT, ...merged, evidence: { ...EMPTY_INCIDENT.evidence, ...merged.evidence } };
  });
  const [step, setStep] = useState(0);
  const [pickerId, setPickerId] = useState("");

  useEffect(() => {
    saveForm(data);
  }, [data]);

  const errors = useMemo(() => {
    const pack = buildReportPack(data);
    const map = {};
    for (const m of pack.missingFields.filter((f) => f.severity === "critical")) {
      map[m.field] = m.message;
    }
    return map;
  }, [data]);

  function applyPicker(item) {
    setPickerId(item.id);
    const prefilled = prefillFromPickerItem(item);
    setData((prev) => ({
      ...prev,
      ...prefilled,
      evidence: { ...prev.evidence, ...(prefilled.evidence || {}) },
    }));
  }

  const printPack = buildReportPack(data);

  return (
    <div className="stack report-pack-page report-pack-print">
      <section className="panel stack no-print">
        <div>
          <span className="eyebrow">Recovery guide</span>
          <h1 style={{ margin: "0.35rem 0" }}>Cybercrime Report Pack</h1>
          <p className="muted" style={{ margin: 0 }}>
            Organise your response in minutes — complaint drafts for 1930 and cybercrime.gov.in.
          </p>
        </div>
        <p className="report-pack-privacy" role="note">
          🔒 Everything stays on this device. No data is sent to any server.
        </p>
      </section>

      <FirstHourPanel incidentAt={data.incidentAt} />

      <div className="report-pack-grid">
        <section className="panel stack span-full no-print">
          <h2 style={{ margin: 0 }}>Use my recent checks</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Tap a history item to prefill scammer details and description.
          </p>
          <HistoryPicker
            checks={checks}
            payments={payments}
            reports={reports}
            selectedId={pickerId}
            onSelect={applyPicker}
          />
        </section>

        <IncidentForm
          data={data}
          onChange={(next) =>
            setData({
              ...next,
              scammerPhone: sanitizeInput(next.scammerPhone, 20),
              scammerUpi: sanitizeInput(next.scammerUpi, 80),
              scammerUrl: sanitizeInput(next.scammerUrl, 200),
              txnRef: sanitizeInput(next.txnRef, 60),
              bank: sanitizeInput(next.bank, 80),
              description: sanitizeInput(next.description, 800),
            })
          }
          step={step}
          onStepChange={setStep}
          errors={errors}
        />

        <ComplaintPreview data={data} />
      </div>

      <FollowUpSection />

      <div className="print-only-section" aria-hidden="true">
        <h2>Print summary</h2>
        <p>Time since incident: {printPack.timeSince?.label || "—"}</p>
        <h3>English complaint</h3>
        <pre>{printPack.complaintEnglish}</pre>
        <h3>हिन्दी शिकायत</h3>
        <pre>{printPack.complaintHindi}</pre>
      </div>
    </div>
  );
}
