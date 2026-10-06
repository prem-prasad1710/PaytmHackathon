import { NavLink } from "react-router-dom";
import { getSettings, setSettings, useStoreValue } from "../utils/store";

const LINKS = [
  { to: "/", label: "Home", icon: "⌂", end: true },
  { to: "/analyze", label: "Check", icon: "▣" },
  { to: "/threats", label: "Map", icon: "🗺" },
  { to: "/lab", label: "Lab", icon: "⚡" },
  { to: "/tools", label: "Tools", icon: "✦" },
  { to: "/family", label: "Family", icon: "👨‍👩‍👧" },
  { to: "/history", label: "History", icon: "☰" },
  { to: "/model", label: "Model", icon: "🧠" },
];

export default function Navbar() {
  const { theme } = useStoreValue(getSettings);
  const dark = theme === "dark";

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="brand">
          <span className="brand-mark">PS</span>
          <span>Paytm Scam Shield</span>
        </NavLink>
        <nav className="nav-links" aria-label="Main">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              <span className="nav-icon" aria-hidden="true">{l.icon}</span>
              <span className="nav-text">{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setSettings({ theme: dark ? "light" : "dark" })}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          title={dark ? "Light mode" : "Dark mode"}
        >
          {dark ? "☀" : "☾"}
        </button>
      </div>
    </header>
  );
}
