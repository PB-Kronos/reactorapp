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
  const [terminalMode, setTerminalMode] = useState<"entry" | "editor">("entry");
  const [department, setDepartment] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const [callRequest, setCallRequest] = useState("");
  const [callTranscript, setCallTranscript] = useState<string[]>([]);
  const [calling, setCalling] = useState(false);
  const callTimer = useRef<number | null>(null);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("rbwr-cli-history") || "null") || [
        "UNIT 2 OPERATIONS TERMINAL // ENTRY MODE",
        "CALL 0027 · 0028 · 0029 · 0100 · 5682 · *#99, or enter EDITOR.",
        "Type HELP for the department directory. LOGIN <name>, LOGOUT, and LEADERBOARD are always available.",
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
  useEffect(() => () => {
    if (callTimer.current !== null) window.clearTimeout(callTimer.current);
  }, []);

  if (!open) return null;
  const departmentPrompt = (code: string) => {
    const menus: Record<string, string> = {
      "0027": "0027 // EDG MAINTENANCE\nCommands: REFUEL\nFuture EDG maintenance terminal.",
      "0028": "0028 // TCR MAINTENANCE\nCommands: OIL LEAK CHECK · REPAIR\nFuture turbine-condition terminal.",
      "0029": "0029 // UNIT 2 MAINTENANCE\nCommands: REPAIR · REFUEL\nREPAIR clears active random malfunctions.",
      "0100": "0100 // HUMAN RESOURCES\nCommands: POINTS\nView the current operator performance score.",
      "5682": "5682 // GRID CONTROL\nCommands: DISCONNECT\nOpens the grid breaker; unit remains available for island operation.",
      "*#99": "*#99 // FSS MASTER PANEL\nCommands: SILENCE · RESET · TEST\nTEST initiates a turbine smoke/fire exercise.",
    };
    return menus[code];
  };
  const runDepartmentCommand = (code: string, commandText: string) => {
    if (code === "0027" && commandText === "refuel") return onCommand("maintenance edg refuel");
    if (code === "0028" && commandText === "oil leak check") return onCommand("maintenance turbine oil-check");
    if (code === "0028" && commandText === "repair") return onCommand("maintenance turbine repair");
    if (code === "0029" && commandText === "repair") return onCommand("maintenance repair");
    if (code === "0029" && commandText === "refuel") return onCommand("maintenance unit refuel");
    if (code === "0100" && (commandText === "points" || commandText === "status")) return onCommand("hr points");
    if (code === "5682" && commandText === "disconnect") return onCommand("grid disconnect");
    if (code === "*#99" && ["silence", "reset", "test"].includes(commandText)) return onCommand(`fss ${commandText}`);
    return `Unknown ${code} command. Type BACK to leave this department.`;
  };
  const callGreeting = (code: string) => {
    const greetings: Record<string, string[]> = {
      "0027": ["EDG maintenance, what do you need?", "Emergency diesel desk. State your request.", "Unit 2 EDG maintenance speaking — go ahead."],
      "0028": ["TCR maintenance here. What is the turbine issue?", "Turbine control room maintenance, go ahead.", "TCR desk. What do you need checked?"],
      "0029": ["Unit 2 maintenance, how can we help?", "Maintenance control speaking. State your request.", "U2 maintenance here — what do you need?"],
      "0100": ["Human Resources. How can I assist?", "Operator performance desk, go ahead.", "HR speaking. What information do you need?"],
      "5682": ["Grid Control. State your switching request.", "Grid desk speaking — what do you need?", "Unit 2 Grid Control, go ahead."],
      "*#99": ["FSS Master Panel. State your fire-system request.", "Fire suppression control here. What do you need?", "FSS operator speaking — go ahead."],
    };
    const choices = greetings[code] || ["Operations, what do you need?"];
    return choices[Math.floor(Math.random() * choices.length)];
  };
  const executeEntry = (text: string) => {
    const normalized = text.toLowerCase().trim().replace(/\s+/g, " ");
    if (normalized === "editor") {
      setTerminalMode("editor"); setDepartment(null);
      return "SIMULATION EDITOR ENABLED. Type HELP for live control commands; EXIT returns to entry mode.";
    }
    if (normalized === "help" || normalized === "directory")
      return "DIRECTORY\n0027 EDG Maintenance\n0028 TCR Maintenance\n0029 Unit 2 Maintenance\n0100 Human Resources\n5682 Grid Control\n*#99 FSS Master Panel\nEDITOR Simulation editor\n\nSESSION\nLOGIN <name> records point scoring\nLOGOUT enters guest mode (no points)\nLEADERBOARD shows the top operators";
    if (normalized === "status") return onCommand("operations status");
    if (normalized === "leaderboard" || normalized === "logout" || normalized.startsWith("login ")) return onCommand(text);
    if (["trip status", "trips", "trip"].includes(normalized)) return onCommand("operations trips");
    if (["bus availability", "bus status", "power status"].includes(normalized)) return onCommand("operations buses");
    if (["fuel status", "fuel"].includes(normalized)) return onCommand("operations fuel");
    if (["next demand", "demand"].includes(normalized)) return onCommand("operations demand");
    if (normalized === "exit" || normalized === "back") {
      setDepartment(null);
      return "ENTRY MODE READY. Call a department number or enter EDITOR.";
    }
    if (department) {
      return "Active department calls use the phone dialog. Choose an action or end the call.";
    }
    if (departmentPrompt(normalized)) {
      setDepartment(normalized);
      return departmentPrompt(normalized);
    }
    return "ENTRY MODE: call a department number, enter EDITOR, or type HELP.";
  };
  const execute = () => {
    const text = command.trim();
    if (!text || calling) return;
    if (text.toLowerCase() === "clear") {
      setHistory(["UNIT 2 SIMULATOR // CLI MODE", "Buffer cleared."]);
    } else if (terminalMode === "entry") {
      const call = text.trim().match(/^(?:call\s+)?(0027|0028|0029|0100|5682|\*#99)(?:\s+(.+))?$/i);
      if (call && !department) {
        const code = call[1];
        const requestedCommand = call[2]?.trim().toLowerCase().replace(/\s+/g, " ");
        setCalling(true);
        setHistory((previous) => [...previous, `> ${text}`, `DIALING ${code}...`]);
        setCommand("");
        callTimer.current = window.setTimeout(() => {
          setDepartment(code);
          setActiveCall(code);
          setCallRequest("");
          setCallTranscript([callGreeting(code)]);
          const result = requestedCommand ? `\nRequested command queued: ${requestedCommand}` : "";
          setHistory((previous) => [...previous, `CONNECTED // ${departmentPrompt(code)}${result}\nUse the phone dialog to continue.`]);
          setCalling(false);
          callTimer.current = null;
        }, 850);
        return;
      }
      const result = executeEntry(text);
      setHistory((previous) => [...previous, `> ${text}`, result]);
    } else if (terminalMode === "editor" && text.toLowerCase() === "exit") {
      setTerminalMode("entry"); setDepartment(null);
      setHistory((previous) => [...previous, `> ${text}`, "EDITOR CLOSED. ENTRY MODE READY."]);
    } else if (terminalMode === "editor" && text.toLowerCase() === "watch") {
      setHistory((previous) => [...previous, "> watch", liveStatus]);
    } else {
      const result = terminalMode === "editor" ? onCommand(text) : executeEntry(text);
      setHistory((previous) => [...previous, `> ${text}`, result]);
    }
    setCommand("");
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950 p-2 sm:bg-slate-950/75 sm:p-6 sm:backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Simulator CLI mode">
      <div className="relative mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-xl border border-emerald-400/40 bg-[#020a08] shadow-[0_0_80px_rgba(16,185,129,.2)]">
        <header className="flex items-center justify-between border-b border-emerald-400/25 bg-emerald-950/20 px-4 py-3 font-mono">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-300"><Terminal className="h-4 w-4" /> UNIT 2 // LIVE CLI</div>
          <Button size="sm" variant="ghost" className="text-emerald-200 hover:bg-emerald-900/40" onClick={onClose}><X className="mr-1 h-4 w-4" /> RETURN TO PANEL</Button>
        </header>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_290px]">
          <section className="flex min-h-0 flex-col border-b border-emerald-400/20 lg:border-b-0 lg:border-r">
            <pre ref={outputRef} className="rbwr-selectable min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-emerald-300 sm:text-sm">{history.join("\n")}</pre>
            <form className="flex border-t border-emerald-400/25 bg-black/30 p-3" onSubmit={(event) => { event.preventDefault(); execute(); }}>
              <span className="mr-2 pt-2 font-mono font-black text-emerald-400">&gt;</span>
              <input ref={inputRef} value={command} disabled={calling} onChange={(event) => setCommand(event.target.value)} className="min-w-0 flex-1 bg-transparent font-mono text-sm text-emerald-100 outline-none placeholder:text-emerald-800 disabled:cursor-wait disabled:text-emerald-700" placeholder={calling ? "connecting department line..." : terminalMode === "editor" ? "status · get reactor.pressure · turbine.bypass set 0" : department ? "department command · back" : "call 0029 · editor · help"} autoComplete="off" spellCheck={false} />
              <Button type="submit" size="sm" disabled={calling} className="ml-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400">{calling ? "DIALING" : "RUN"}</Button>
            </form>
          </section>
          <aside className="overflow-auto bg-[#06130e] p-4 font-mono sm:bg-emerald-950/10">
            <p className="text-[11px] font-black tracking-[.2em] text-emerald-400">LIVE STATUS</p>
            <pre className="rbwr-selectable mt-3 whitespace-pre-wrap text-xs leading-relaxed text-emerald-100">{liveStatus}</pre>
            <div className="mt-5 border-t border-emerald-400/20 pt-4 text-xs leading-relaxed text-emerald-300/80">
              <p className="font-bold text-emerald-300">{terminalMode === "editor" ? "Simulation editor" : "Department entry"}</p>
              {terminalMode === "editor" ? <><p className="mt-2">HELP / HELP VALUES — command reference</p><p>VALUES / STATUS — full snapshot</p><p>GET &lt;value&gt; — one live value</p><p>WATCH — append current snapshot</p><p>PAUSE / UNPAUSE — simulation clock</p><p>SCENARIO turbine-synced — preset state</p><p>EXIT — return to department entry</p></> : <><p className="mt-2">0027 EDG maintenance</p><p>0028 TCR maintenance</p><p>0029 Unit 2 maintenance</p><p>0100 operator points</p><p>5682 grid control</p><p>*#99 fire suppression</p><p>EDITOR — live simulator control</p></>}
            </div>
          </aside>
        </div>
        {activeCall && <div className="absolute inset-0 z-10 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-xl border border-emerald-400/50 bg-[#06130e] p-5 font-mono shadow-[0_0_42px_rgba(16,185,129,.25)]">
            <p className="text-[11px] font-black tracking-[.24em] text-emerald-400">SECURE LINE CONNECTED</p>
            <h2 className="mt-2 text-lg font-black text-emerald-100">{activeCall} // {activeCall === "0027" ? "EDG MAINTENANCE" : activeCall === "0028" ? "TCR MAINTENANCE" : activeCall === "0029" ? "UNIT 2 MAINTENANCE" : activeCall === "0100" ? "HUMAN RESOURCES" : activeCall === "5682" ? "GRID CONTROL" : "FSS MASTER PANEL"}</h2>
            <div className="mt-5 max-h-52 space-y-3 overflow-auto rounded border border-emerald-400/20 bg-black/30 p-3 text-sm leading-relaxed text-emerald-200">
              {callTranscript.map((line, index) => <p key={`${line}-${index}`} className={line.startsWith("YOU:") ? "text-emerald-400" : "text-emerald-100"}>{line}</p>)}
            </div>
            <form className="mt-4 flex gap-2 border-t border-emerald-400/20 pt-4" onSubmit={(event) => {
              event.preventDefault();
              const request = callRequest.trim().toLowerCase().replace(/\s+/g, " ");
              if (!request) return;
              if (["end", "hang up", "goodbye", "bye"].includes(request)) {
                setHistory((previous) => [...previous, `CALL ${activeCall} ENDED.`]);
                setActiveCall(null); setDepartment(null); setCallRequest("");
                return;
              }
              const response = runDepartmentCommand(activeCall, request);
              setCallTranscript((previous) => [...previous, `YOU: ${callRequest.trim()}`, response]);
              setHistory((previous) => [...previous, `[${activeCall}] ${request}`, response]);
              setCallRequest("");
            }}>
              <input autoFocus value={callRequest} onChange={(event) => setCallRequest(event.target.value)} placeholder="State your request… (type 'end' to hang up)" className="min-w-0 flex-1 bg-transparent font-mono text-sm text-emerald-100 outline-none placeholder:text-emerald-800" />
              <Button type="submit" size="sm" className="bg-emerald-500 font-mono text-slate-950 hover:bg-emerald-400">SPEAK</Button>
            </form>
          </section>
        </div>}
      </div>
    </div>
  );
}
