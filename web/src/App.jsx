import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import Analyze from "./pages/Analyze.jsx";
import ConfirmPay from "./pages/ConfirmPay.jsx";
import Success from "./pages/Success.jsx";
import Verify from "./pages/Verify.jsx";
import Blocked from "./pages/Blocked.jsx";
import History from "./pages/History.jsx";
import ComplaintSent from "./pages/ComplaintSent.jsx";
import ThreatMap from "./pages/ThreatMap.jsx";
import ModelCard from "./pages/ModelCard.jsx";
import FraudLab from "./pages/FraudLab.jsx";
import FamilyGuard from "./pages/FamilyGuard.jsx";
import { getSettings, useStoreValue } from "./utils/store";

export default function App() {
  const { theme } = useStoreValue(getSettings);
  const wide = ["/lab", "/demo"].includes(useLocation().pathname);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  }, [theme]);

  return (
    <div className={`app-shell${wide ? " wide" : ""}`}>
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/threats" element={<ThreatMap />} />
          <Route path="/model" element={<ModelCard />} />
          <Route path="/lab" element={<FraudLab />} />
          <Route path="/demo" element={<FraudLab />} />
          <Route path="/history" element={<History />} />
          <Route path="/complaint-sent" element={<ComplaintSent />} />
          <Route path="/confirm-pay" element={<ConfirmPay />} />
          <Route path="/success" element={<Success />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/blocked" element={<Blocked />} />
          <Route path="/family" element={<FamilyGuard />} />
          <Route path="/family/:id" element={<FamilyGuard />} />
          <Route path="/mock-pay" element={<Success />} />
        </Routes>
      </main>
      <footer className="app-footer">
        Hackathon demo · Advisory only · No real payments · Scam? Call 1930
      </footer>
    </div>
  );
}
