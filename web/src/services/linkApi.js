import { analyzeUrl, extractUrls } from "./linkEngine.js";

export async function checkLinks({ url, text }) {
  const base = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const endpoint = `${base}/api/links/check`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(url !== undefined ? { url } : { text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Check failed (${res.status})`);
    }
    const data = await res.json();
    return { results: data.results, source: "server" };
  } catch (err) {
    if (url !== undefined) {
      return { results: [analyzeUrl(url)], source: "offline" };
    }
    const urls = extractUrls(text);
    if (!urls.length) throw err;
    return { results: urls.map((u) => analyzeUrl(u)), source: "offline" };
  }
}
