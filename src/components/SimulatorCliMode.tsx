import { Terminal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type PlantAssignment,
  type PlantPhoneCall,
  type PlantPhoneCallMessage,
  type PlantPhoneMessage,
  acknowledgePlantPhoneMessage,
  createPlantPhoneCall,
  getPlantPhoneCallMessages,
  getPlantPhoneCalls,
  getPlantPhoneMessages,
  queuePlantRemoteCommand,
  sendPlantPhoneCallMessage,
  sendPlantPhoneMessage,
  updatePlantPhoneCall,
} from "@/lib/plantOperations";
import {
  type PhoneEndpoint,
  automatedPhoneCommand,
  getPhoneEndpoint,
  phoneConversationId,
  phoneDirectoryText,
  stationPhoneIdentity,
} from "@/lib/plantPhone";

interface SimulatorCliModeProps {
  open: boolean;
  onClose: () => void;
  onCommand: (command: string) => string;
  liveStatus: string;
  plantAssignment?: PlantAssignment | null;
  onIncomingCall?: () => void;
}

export function SimulatorCliMode({ open, onClose, onCommand, liveStatus, plantAssignment, onIncomingCall }: SimulatorCliModeProps) {
  const [command, setCommand] = useState("");
  const [terminalMode, setTerminalMode] = useState<"entry" | "editor">("entry");
  const [department, setDepartment] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const [callRequest, setCallRequest] = useState("");
  const [callTranscript, setCallTranscript] = useState<string[]>([]);
  const [activePhoneEndpoint, setActivePhoneEndpoint] = useState<PhoneEndpoint | null>(null);
  const [phoneMessages, setPhoneMessages] = useState<PlantPhoneMessage[]>([]);
  const [activePrivateCall, setActivePrivateCall] = useState<PlantPhoneCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<PlantPhoneCall | null>(null);
  const [privateCallMessages, setPrivateCallMessages] = useState<PlantPhoneCallMessage[]>([]);
  const [pmsExtension, setPmsExtension] = useState(plantAssignment?.unitNumber === 1 ? "0020" : "0010");
  const [pmsMessage, setPmsMessage] = useState("");
  const [pmsUrgent, setPmsUrgent] = useState(false);
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
  const ownPhone = plantAssignment ? stationPhoneIdentity(plantAssignment.unitNumber, plantAssignment.stationId) : null;

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
  useEffect(() => {
    if (!plantAssignment) return;
    let active = true;
    const refresh = () => {
      void getPlantPhoneMessages(plantAssignment.roomCode).then((messages) => {
        if (active) setPhoneMessages(messages);
      }).catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 2_500);
    return () => { active = false; window.clearInterval(timer); };
  }, [plantAssignment]);
  useEffect(() => {
    if (!activePrivateCall) { setPrivateCallMessages([]); return; }
    let active = true;
    const refresh = () => {
      void getPlantPhoneCallMessages(activePrivateCall.id).then((messages) => {
        if (active) setPrivateCallMessages(messages);
      }).catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 1_500);
    return () => { active = false; window.clearInterval(timer); };
  }, [activePrivateCall?.id]);
  useEffect(() => {
    if (!plantAssignment || !ownPhone) return;
    let active = true;
    const refresh = () => {
      void getPlantPhoneCalls(plantAssignment.roomCode).then((calls) => {
        if (!active) return;
        const mine = calls.filter((call) => call.source_extension === ownPhone.extension || call.target_extension === ownPhone.extension);
        const fresh = mine.find((call) => call.target_extension === ownPhone.extension && call.status === "ringing");
        if (fresh && fresh.id !== activePrivateCall?.id) {
          setIncomingCall(fresh);
          onIncomingCall?.();
        }
        if (activePrivateCall) {
          const updated = mine.find((call) => call.id === activePrivateCall.id);
          if (updated) setActivePrivateCall(updated);
          if (updated && (updated.status === "declined" || updated.status === "ended")) {
            setHistory((previous) => [...previous, `CALL ${updated.target_extension} ${updated.status.toUpperCase()}.`]);
            setActiveCall(null); setDepartment(null); setActivePhoneEndpoint(null); setActivePrivateCall(null); setCallRequest("");
          }
        }
      }).catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 1_500);
    return () => { active = false; window.clearInterval(timer); };
  }, [plantAssignment, ownPhone?.extension, activePrivateCall?.id]);
  useEffect(() => {
    setCallTranscript(privateCallMessages.map((message) => `${message.source_label}: ${message.body}`));
  }, [privateCallMessages]);

  if (!open) return null;
  const departmentPrompt = (code: string) => {
    const endpoint = getPhoneEndpoint(code);
    if (endpoint?.type === "manual")
      return `${endpoint.extension} // ${endpoint.label.toUpperCase()}\nMANUAL LINE — ${endpoint.purpose}. State a message to start plant chat.`;
    const menus: Record<string, string> = {
      "0019": "0019 // U1 MAINTENANCE\nCommands: REFUEL\nAutomated Unit 1 maintenance line.",
      "0027": "0027 // EDG MAINTENANCE\nCommands: REFUEL\nFuture EDG maintenance terminal.",
      "0028": "0028 // TCR MAINTENANCE\nCommands: OIL LEAK CHECK · REPAIR\nFuture turbine-condition terminal.",
      "0029": "0029 // UNIT 2 MAINTENANCE\nCommands: REPAIR · REFUEL\nREPAIR clears active random malfunctions.",
      "0100": "0100 // HUMAN RESOURCES\nCommands: POINTS\nView the current operator performance score.",
      "5682": "5682 // GRID CONTROL\nCommands: DISCONNECT\nOpens the grid breaker; unit remains available for island operation.",
      "*#99": "*#99 // FSS MASTER PANEL\nCommands: SILENCE · RESET · TEST\nTEST initiates a turbine smoke/fire exercise.",
    };
    return menus[code];
  };
  const runDepartmentCommand = async (code: string, commandText: string) => {
    const endpoint = getPhoneEndpoint(code);
    if (endpoint?.type === "automated") {
      if (code === "0100" && (commandText === "points" || commandText === "status")) return onCommand("hr points");
      const action = automatedPhoneCommand(endpoint, commandText, plantAssignment?.unitNumber);
      if (!action) return `AUTOMATED ${endpoint.label.toUpperCase()} — request unavailable. Check the service procedure for this extension.`;
      if (!plantAssignment) return "A shared Unit plant room is required to route this automated service request.";
      if (action.targetUnit === plantAssignment.unitNumber) return onCommand(action.command);
      await queuePlantRemoteCommand(plantAssignment.roomCode, action.targetUnit, action.command);
      return `REQUEST ROUTED TO UNIT ${action.targetUnit} — ${action.command.toUpperCase()}. Await remote unit acknowledgement.`;
    }
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
    const endpoint = getPhoneEndpoint(code);
    if (endpoint?.type === "manual") return `${endpoint.label}, this is a manual plant line. What do you need?`;
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
      return `PLANT PHONE DIRECTORY\n${phoneDirectoryText()}\n\nCALL <extension> [message] — dial a manual or automated line.\nManual lines support live chat when the receiving unit opens its CLI.\nEDITOR Simulation editor\n\nSESSION\nLOGIN <name> records point scoring\nLOGOUT enters guest mode (no points)\nLEADERBOARD shows the top operators`;
    if (normalized === "status") return onCommand("operations status");
    if (normalized === "pms") return "PMS: use PMS <extension> <message> to send without opening a live call. Manual extensions are listed in DIRECTORY.";
    if (normalized.startsWith("pms ")) {
      const [, extension = "", ...messageParts] = text.trim().split(/\s+/);
      const endpoint = getPhoneEndpoint(extension);
      const body = messageParts.join(" ").trim();
      if (!endpoint || endpoint.type !== "manual") return "PMS requires an active manual extension. Use DIRECTORY.";
      if (!body) return "Usage: PMS <manual-extension> <message>.";
      if (!plantAssignment || !ownPhone) return "PMS requires a shared Unit plant room.";
      void sendPlantPhoneMessage({
        room_code: plantAssignment.roomCode,
        conversation_id: phoneConversationId(plantAssignment.roomCode, ownPhone.extension, endpoint.extension),
        source_extension: ownPhone.extension,
        source_label: `PMS ${ownPhone.label}`,
        target_extension: endpoint.extension,
        target_label: endpoint.label,
        body,
      });
      return `PMS TRANSMITTED TO ${endpoint.extension} ${endpoint.label}.`;
    }
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
      const call = text.trim().match(/^(?:call\s+)?(\*#99|\d{4})(?:\s+(.+))?$/i);
      if (call && !department) {
        const code = call[1].toUpperCase();
        const endpoint = getPhoneEndpoint(code);
        if (!endpoint) {
          setHistory((previous) => [...previous, `> ${text}`, "UNAVAILABLE EXTENSION — this number is reserved or not installed in the Unit 2 phone network."]);
          setCommand("");
          return;
        }
        const requestedCommand = call[2]?.trim().toLowerCase().replace(/\s+/g, " ");
        setCalling(true);
        setHistory((previous) => [...previous, `> ${text}`, `DIALING ${code}...`]);
        setCommand("");
        callTimer.current = window.setTimeout(() => {
          setDepartment(code);
          setActiveCall(code);
          setCallRequest("");
          if (endpoint.type === "manual" && plantAssignment && ownPhone) {
            void createPlantPhoneCall({
              room_code: plantAssignment.roomCode,
              source_extension: ownPhone.extension,
              source_label: ownPhone.label,
              target_extension: endpoint.extension,
              target_label: endpoint.label,
            }).then((privateCall) => {
              setActivePhoneEndpoint(endpoint);
              setActivePrivateCall(privateCall);
              setCallTranscript([`RINGING ${endpoint.label} — awaiting pickup.`]);
              setHistory((previous) => [...previous, `PRIVATE CALL RINGING // ${endpoint.extension} ${endpoint.label}.${requestedCommand ? " Enter the message after pickup." : ""}`]);
            }).catch((cause) => {
              setHistory((previous) => [...previous, `PHONE NETWORK ERROR — ${cause instanceof Error ? cause.message : "call could not be placed"}`]);
              setActiveCall(null); setDepartment(null); setActivePhoneEndpoint(null);
            });
          } else {
            setActivePhoneEndpoint(null);
            setCallTranscript([callGreeting(code)]);
          }
          const result = requestedCommand ? `\nRequested command: ${requestedCommand}` : "";
          if (endpoint.type !== "manual") setHistory((previous) => [...previous, `CONNECTED // ${departmentPrompt(code)}${result}\nUse the phone dialog to continue.`]);
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
  const phoneThreads = ownPhone
    ? [...new Map(phoneMessages
      .filter((message) => message.source_extension === ownPhone.extension || message.target_extension === ownPhone.extension)
      .map((message) => [message.conversation_id, message])).values()]
    : [];
  const openManualThread = (message: PlantPhoneMessage) => {
    if (!ownPhone) return;
    const remoteExtension = message.source_extension === ownPhone.extension ? message.target_extension : message.source_extension;
    const endpoint = getPhoneEndpoint(remoteExtension);
    if (!endpoint || endpoint.type !== "manual") return;
    setPmsExtension(endpoint.extension);
    setHistory((previous) => [...previous, `PMS THREAD SELECTED // ${endpoint.extension} ${endpoint.label}.`]);
  };
  const sendPms = () => {
    const endpoint = getPhoneEndpoint(pmsExtension);
    const body = pmsMessage.trim();
    if (!endpoint || endpoint.type !== "manual" || !body || !plantAssignment || !ownPhone) return;
    void sendPlantPhoneMessage({
      room_code: plantAssignment.roomCode,
      conversation_id: phoneConversationId(plantAssignment.roomCode, ownPhone.extension, endpoint.extension),
      source_extension: ownPhone.extension,
      source_label: `PMS ${ownPhone.label}`,
      target_extension: endpoint.extension,
      target_label: endpoint.label,
      body,
      priority: pmsUrgent ? "urgent" : "normal",
    }).then(() => { setPmsMessage(""); setPmsUrgent(false); });
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
            {ownPhone && <div className="mb-5 border-b border-emerald-400/20 pb-4">
              <p className="text-[11px] font-black tracking-[.2em] text-emerald-400">PLANT PHONE NETWORK</p>
              <p className="mt-2 text-xs text-emerald-200">THIS STATION: {ownPhone.extension} · {ownPhone.label}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-emerald-300/75">PMS delivers messages without pickup. Select a thread to address PMS, or use CALL for a private pickup line.</p>
              <div className="mt-3 space-y-2">{phoneThreads.length ? phoneThreads.slice(-6).reverse().map((message) => <div key={message.conversation_id} className={`rounded border px-2 py-2 text-[11px] ${message.priority === "urgent" && !message.acknowledged_at ? "border-red-400/70 bg-red-950/30" : "border-emerald-500/25 bg-black/20"}`}><button type="button" onClick={() => openManualThread(message)} className="block w-full text-left text-emerald-100"><b>{message.priority === "urgent" && !message.acknowledged_at ? "URGENT · " : ""}{message.source_extension === ownPhone.extension ? message.target_label : message.source_label}</b><br/><span className="text-emerald-300/75">{message.body.slice(0, 80)}</span></button>{message.target_extension === ownPhone.extension && message.priority === "urgent" && !message.acknowledged_at && <Button size="sm" type="button" onClick={() => void acknowledgePlantPhoneMessage(message.id)} className="mt-2 h-7 bg-red-400 text-slate-950 hover:bg-red-300">ACKNOWLEDGE</Button>}</div>) : <p className="text-xs text-emerald-300/55">No manual plant calls.</p>}</div>
              <form className="mt-3 space-y-2 border-t border-emerald-400/15 pt-3" onSubmit={(event) => { event.preventDefault(); sendPms(); }}>
                <label className="block text-[10px] font-black tracking-[.16em] text-emerald-400">PMS ADDRESS</label>
                <select value={pmsExtension} onChange={(event) => setPmsExtension(event.target.value)} className="w-full rounded border border-emerald-500/30 bg-black/30 px-2 py-1 text-xs text-emerald-100">
                  {["0001", "0010", "0020", "0021", "0022", "0023", "0024", "0025", "0040"].map((extension) => { const endpoint = getPhoneEndpoint(extension); return endpoint ? <option key={extension} value={extension}>{extension} · {endpoint.label}</option> : null; })}
                </select>
                <input value={pmsMessage} onChange={(event) => setPmsMessage(event.target.value)} placeholder="Send PMS message…" className="w-full rounded border border-emerald-500/30 bg-black/30 px-2 py-1 text-xs text-emerald-100 outline-none placeholder:text-emerald-800" />
                <label className="flex items-center gap-2 text-[11px] text-red-200"><input type="checkbox" checked={pmsUrgent} onChange={(event) => setPmsUrgent(event.target.checked)} /> URGENT PMS — requires recipient acknowledgement</label>
                <Button type="submit" size="sm" className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">SEND PMS</Button>
              </form>
            </div>}
            <p className="text-[11px] font-black tracking-[.2em] text-emerald-400">LIVE STATUS</p>
            <pre className="rbwr-selectable mt-3 whitespace-pre-wrap text-xs leading-relaxed text-emerald-100">{liveStatus}</pre>
            <div className="mt-5 border-t border-emerald-400/20 pt-4 text-xs leading-relaxed text-emerald-300/80">
              <p className="font-bold text-emerald-300">{terminalMode === "editor" ? "Simulation editor" : "Department entry"}</p>
              {terminalMode === "editor" ? <><p className="mt-2">HELP / HELP VALUES — command reference</p><p>VALUES / STATUS — full snapshot</p><p>GET &lt;value&gt; — one live value</p><p>WATCH — append current snapshot</p><p>PAUSE / UNPAUSE — simulation clock</p><p>SCENARIO turbine-synced — preset state</p><p>EXIT — return to department entry</p></> : <><p className="mt-2">0027 EDG maintenance</p><p>0028 TCR maintenance</p><p>0029 Unit 2 maintenance</p><p>0100 operator points</p><p>5682 grid control</p><p>*#99 fire suppression</p><p>EDITOR — live simulator control</p></>}
            </div>
          </aside>
        </div>
        {incomingCall && <div className="absolute inset-0 z-20 grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-xl border border-amber-300/60 bg-[#130f04] p-5 font-mono shadow-[0_0_42px_rgba(251,191,36,.22)]">
            <p className="text-[11px] font-black tracking-[.24em] text-amber-300">INCOMING PRIVATE CALL</p>
            <h2 className="mt-2 text-lg font-black text-amber-50">{incomingCall.source_label} IS CALLING</h2>
            <p className="mt-3 text-sm leading-relaxed text-amber-100/80">Extension {incomingCall.source_extension} is requesting a private operations line. Only the calling and receiving stations can view the conversation.</p>
            <div className="mt-5 flex gap-2">
              <Button type="button" className="flex-1 bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={() => {
                void updatePlantPhoneCall(incomingCall.id, "connected").then(() => {
                  setActivePrivateCall({ ...incomingCall, status: "connected", answered_at: new Date().toISOString() });
                  setActiveCall(incomingCall.source_extension);
                  setActivePhoneEndpoint(getPhoneEndpoint(incomingCall.source_extension) || null);
                  setDepartment(incomingCall.source_extension);
                  setIncomingCall(null);
                  setHistory((previous) => [...previous, `PRIVATE CALL ACCEPTED // ${incomingCall.source_label}.`]);
                });
              }}>PICK UP</Button>
              <Button type="button" variant="outline" className="flex-1 border-red-400/60 text-red-200 hover:bg-red-950/50" onClick={() => {
                void updatePlantPhoneCall(incomingCall.id, "declined");
                setIncomingCall(null);
                setHistory((previous) => [...previous, `PRIVATE CALL DECLINED // ${incomingCall.source_label}.`]);
              }}>DECLINE</Button>
            </div>
          </section>
        </div>}
        {activeCall && <div className="absolute inset-0 z-10 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-xl border border-emerald-400/50 bg-[#06130e] p-5 font-mono shadow-[0_0_42px_rgba(16,185,129,.25)]">
            <p className="text-[11px] font-black tracking-[.24em] text-emerald-400">{activePrivateCall?.status === "ringing" ? "PRIVATE LINE RINGING" : "SECURE LINE CONNECTED"}</p>
            <h2 className="mt-2 text-lg font-black text-emerald-100">{activePrivateCall ? `${activePrivateCall.source_label} // ${activePrivateCall.target_label}` : `${activeCall} // ${activeCall === "0027" ? "EDG MAINTENANCE" : activeCall === "0028" ? "TCR MAINTENANCE" : activeCall === "0029" ? "UNIT 2 MAINTENANCE" : activeCall === "0100" ? "HUMAN RESOURCES" : activeCall === "5682" ? "GRID CONTROL" : "FSS MASTER PANEL"}`}</h2>
            <div className="mt-5 max-h-52 space-y-3 overflow-auto rounded border border-emerald-400/20 bg-black/30 p-3 text-sm leading-relaxed text-emerald-200">
              {callTranscript.map((line, index) => <p key={`${line}-${index}`} className={line.startsWith("YOU:") ? "text-emerald-400" : "text-emerald-100"}>{line}</p>)}
            </div>
            {activePrivateCall?.status === "ringing" ? <Button type="button" className="mt-4 w-full bg-red-500 text-white hover:bg-red-400" onClick={() => {
              void updatePlantPhoneCall(activePrivateCall.id, "ended");
              setHistory((previous) => [...previous, `CALL ${activePrivateCall.target_extension} CANCELLED.`]);
              setActiveCall(null); setDepartment(null); setActivePhoneEndpoint(null); setActivePrivateCall(null); setCallRequest("");
            }}>CANCEL CALL</Button> : <form className="mt-4 flex gap-2 border-t border-emerald-400/20 pt-4" onSubmit={(event) => {
              event.preventDefault();
              const spoken = callRequest.trim();
              const request = spoken.toLowerCase().replace(/\s+/g, " ");
              if (!request) return;
              if (["end", "hang up", "goodbye", "bye"].includes(request)) {
                setHistory((previous) => [...previous, `CALL ${activeCall} ENDED.`]);
                if (activePrivateCall) void updatePlantPhoneCall(activePrivateCall.id, "ended");
                setActiveCall(null); setDepartment(null); setActivePhoneEndpoint(null); setActivePrivateCall(null); setCallRequest("");
                return;
              }
              if (activePrivateCall && plantAssignment && ownPhone) {
                setCallTranscript((previous) => [...previous, `YOU: ${spoken}`]);
                void sendPlantPhoneCallMessage({
                  call_id: activePrivateCall.id,
                  source_extension: ownPhone.extension,
                  source_label: ownPhone.label,
                  body: spoken,
                }).then(() => {
                  setHistory((previous) => [...previous, `[${activeCall}] ${spoken}`, "LIVE LINE MESSAGE SENT — line remains open."]);
                }).catch((cause) => {
                  setHistory((previous) => [...previous, `[${activeCall}] ${spoken}`, `PHONE NETWORK ERROR — ${cause instanceof Error ? cause.message : "message could not be sent"}`]);
                });
                setCallRequest("");
                return;
              }
              void runDepartmentCommand(activeCall, request).then((response) => {
                setCallTranscript((previous) => [...previous, `YOU: ${spoken}`, response]);
                setHistory((previous) => [...previous, `[${activeCall}] ${request}`, response]);
              });
              setCallRequest("");
            }}>
              <input autoFocus value={callRequest} onChange={(event) => setCallRequest(event.target.value)} placeholder="State your request… (type 'end' to hang up)" className="min-w-0 flex-1 bg-transparent font-mono text-sm text-emerald-100 outline-none placeholder:text-emerald-800" />
              <Button type="submit" size="sm" className="bg-emerald-500 font-mono text-slate-950 hover:bg-emerald-400">SEND</Button>
            </form>}
          </section>
        </div>}
      </div>
    </div>
  );
}
