import { Terminal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface SimulatorCliModeProps {
  open: boolean;
  onClose: () => void;
  onCommand: (command: string) => string;
  liveStatus: string;
}

export function SimulatorCliMode({ open, onClose, onCommand, liveStatus }: SimulatorCliModeProps) {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("rbwr-cli-history") || "null") || [
        "UNIT 2 SIMULATOR // CLI MODE",
        "Live controls are connected. Type HELP for the command index.",
        "Use STATUS or VALUES for a plant snapshot; GET <value> for one reading.",
      ];
    } catch {
      return ["UNIT 2 SIMULATOR // CLI MODE", "Type HELP for available commands."];
    }
  });
  const outputRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sessionStorage.setItem("rbwr-cli-history", JSON.stringify(history.slice(-80)));
    requestAnimationFrame(() => {
      if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    });
  }, [history]);
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  const execute = () => {
    const text = command.trim();
    if (!text) return;
    if (text.toLowerCase() === "clear") {
      setHistory(["UNIT 2 SIMULATOR // CLI MODE", "Buffer cleared."]);
    } else if (text.toLowerCase() === "watch") {
      setHistory((previous) => [...previous, "> watch", liveStatus]);
    } else {
      setHistory((previous) => [...previous, `> ${text}`, onCommand(text)]);
    }
    setCommand("");
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950 p-2 sm:bg-slate-950/75 sm:p-6 sm:backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Simulator CLI mode">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-xl border border-emerald-400/40 bg-[#020a08] shadow-[0_0_80px_rgba(16,185,129,.2)]">
        <header className="flex items-center justify-between border-b border-emerald-400/25 bg-emerald-950/20 px-4 py-3 font-mono">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-300"><Terminal className="h-4 w-4" /> UNIT 2 // LIVE CLI</div>
          <Button size="sm" variant="ghost" className="text-emerald-200 hover:bg-emerald-900/40" onClick={onClose}><X className="mr-1 h-4 w-4" /> RETURN TO PANEL</Button>
        </header>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_290px]">
          <section className="flex min-h-0 flex-col border-b border-emerald-400/20 lg:border-b-0 lg:border-r">
            <pre ref={outputRef} className="rbwr-selectable min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-emerald-300 sm:text-sm">{history.join("\n")}</pre>
            <form className="flex border-t border-emerald-400/25 bg-black/30 p-3" onSubmit={(event) => { event.preventDefault(); execute(); }}>
              <span className="mr-2 pt-2 font-mono font-black text-emerald-400">&gt;</span>
              <input ref={inputRef} value={command} onChange={(event) => setCommand(event.target.value)} className="min-w-0 flex-1 bg-transparent font-mono text-sm text-emerald-100 outline-none placeholder:text-emerald-800" placeholder="status · get reactor.pressure · turbine.bypass set 0" autoComplete="off" spellCheck={false} />
              <Button type="submit" size="sm" className="ml-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400">RUN</Button>
            </form>
          </section>
          <aside className="overflow-auto bg-[#06130e] p-4 font-mono sm:bg-emerald-950/10">
            <p className="text-[11px] font-black tracking-[.2em] text-emerald-400">LIVE STATUS</p>
            <pre className="rbwr-selectable mt-3 whitespace-pre-wrap text-xs leading-relaxed text-emerald-100">{liveStatus}</pre>
            <div className="mt-5 border-t border-emerald-400/20 pt-4 text-xs leading-relaxed text-emerald-300/80">
              <p className="font-bold text-emerald-300">Quick commands</p>
              <p className="mt-2">HELP / HELP VALUES — command reference</p><p>VALUES / STATUS — full snapshot</p><p>GET &lt;value&gt; — one live value</p><p>WATCH — append current snapshot</p><p>PAUSE / UNPAUSE — simulation clock</p><p>SCENARIO turbine-synced — preset state</p><p>SRV 1 ON · RPS RESET — protection actions</p><p>CLEAR — clear terminal buffer</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
