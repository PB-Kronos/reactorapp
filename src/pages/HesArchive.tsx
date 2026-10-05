import HesSimulator from "@/archive/hes/App";
import { useState, type FormEvent } from "react";
import "@/archive/hes/styles.css";
import "@/archive/hes/controls.css";
import "@/archive/hes/panel-redesign.css";
import "@/archive/hes/control-state-labels.css";
import "@/archive/hes/control-feedback.css";
import "@/archive/hes/startup-status.css";

/** Preserved standalone HES control room, mounted inside the archive. */
export default function HesArchive() {
  const [passcode, setPasscode] = useState("");
  const [denied, setDenied] = useState(false);
  const [allowed, setAllowed] = useState(
    () => sessionStorage.getItem("hes-archive-access") === "granted",
  );
  const unlock = (event: FormEvent) => {
    event.preventDefault();
    if (passcode === "556134") {
      sessionStorage.setItem("hes-archive-access", "granted");
      setAllowed(true);
      return;
    }
    setDenied(true);
    setPasscode("");
  };
  if (!allowed) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#07100f] p-6 font-mono text-slate-100">
        <form onSubmit={unlock} className="w-full max-w-sm border border-emerald-500/35 bg-slate-950 p-6 shadow-[0_0_40px_rgba(52,211,153,.12)]">
          <p className="text-xs font-black tracking-[.22em] text-emerald-300">RESTRICTED ARCHIVE</p>
          <h1 className="mt-3 text-xl font-black">HES simulator</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">Enter the temporary access passcode to open this archived simulation.</p>
          <label className="mt-5 block text-xs text-emerald-200">
            PASSCODE
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={passcode}
              onChange={(event) => { setPasscode(event.target.value); setDenied(false); }}
              className="mt-2 w-full border border-emerald-500/40 bg-black px-3 py-2 text-emerald-100 outline-none focus:border-emerald-300"
            />
          </label>
          {denied && <p className="mt-3 text-xs text-red-300">Access denied.</p>}
          <button className="mt-5 w-full bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-emerald-300">OPEN ARCHIVE</button>
        </form>
      </main>
    );
  }
  return (
    <div className="hes-archive min-h-screen">
      <HesSimulator />
    </div>
  );
}
