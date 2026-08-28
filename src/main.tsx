import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

createRoot(document.getElementById("root")!).render(<App />);

// Cache the installed control room shell after the first successful visit.
// Plant state itself stays in browser storage; this only lets the UI open
// again when the internet or Supabase is unavailable.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
