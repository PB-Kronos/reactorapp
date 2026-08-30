import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Link2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PlantSnapshot,
  type PlantPhoneCall,
  type PlantPhoneCallMessage,
  type PlantPhoneMessage,
  acknowledgePlantPhoneMessage,
  createPlantPhoneCall,
  createStationId,
  getPlantRemoteCommands,
  getPlantPhoneCallMessages,
  getPlantPhoneCalls,
  getPlantPhoneMessages,
  getPlantSnapshot,
  getPlantTransport,
  joinPlantRoom,
  readPlantAssignment,
  setPlantTransport,
  subscribePlantRoom,
  queuePlantRemoteCommand,
  sendPlantPhoneCallMessage,
  sendPlantPhoneMessage,
  updatePlantPhoneCall,
  updatePlantDispatch,
  updateUnitDemand,
} from "@/lib/plantOperations";
import { automatedPhoneCommand, getPhoneEndpoint, phoneConversationId, phoneDirectoryText } from "@/lib/plantPhone";
import { U2_STATIONS } from "@/lib/unitStations";

const normaliseRoom = (value: string) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
const unitState = (snapshot: PlantSnapshot, unit: 1 | 2) => snapshot.units.find((entry) => entry.unit_number === unit);

export default function Supervisor() {
  const navigate = useNavigate();
  const stored = readPlantAssignment();
  const [roomCode, setRoomCode] = useState(stored?.roomCode || "UNIT2-PLANT");
  const [connectedRoomCode, setConnectedRoomCode] = useState(stored?.roomCode || "UNIT2-PLANT");
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const [transport, setTransportState] = useState(() => getPlantTransport());
  const [snapshot, setSnapshot] = useState<PlantSnapshot>({ room: null, units: [] });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [plantDemand, setPlantDemand] = useState(675);
  const [unitDemand, setUnitDemand] = useState({ 1: 325, 2: 350 });
  const dispatchDirty = useRef(false);
  const demandManagerHandled = useRef<string | null>(null);
  const [managerClock, setManagerClock] = useState(Date.now());
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    "UNIT 2 SUPERVISOR TERMINAL // READY",
    "Type HELP. Use CONNECT <1|2>, then SEND <unit terminal command>.",
  ]);
  const [terminalUnit, setTerminalUnit] = useState<1 | 2>(1);
  const terminalOutputRef = useRef<HTMLPreElement>(null);
  const announcedRemoteResponses = useRef(new Set<number>());
  const [phoneMessages, setPhoneMessages] = useState<PlantPhoneMessage[]>([]);
  const [chatExtension, setChatExtension] = useState("0020");
  const [chatMessage, setChatMessage] = useState("");
  const [chatUrgent, setChatUrgent] = useState(false);
  const [privateCalls, setPrivateCalls] = useState<PlantPhoneCall[]>([]);
  const [selectedPrivateCall, setSelectedPrivateCall] = useState<PlantPhoneCall | null>(null);
  const [selectedPrivateMessages, setSelectedPrivateMessages] = useState<PlantPhoneCallMessage[]>([]);
  const [activeSupervisorCall, setActiveSupervisorCall] = useState<PlantPhoneCall | null>(null);
  const [incomingSupervisorCall, setIncomingSupervisorCall] = useState<PlantPhoneCall | null>(null);
  const [supervisorCallMessages, setSupervisorCallMessages] = useState<PlantPhoneCallMessage[]>([]);
  const [supervisorCallInput, setSupervisorCallInput] = useState("");

  const load = async (code = connectedRoomCode) => {
    const normalized = normaliseRoom(code);
    if (normalized.length < 3) throw new Error("Use a room code with at least three characters.");
    const operator = localStorage.getItem("unit2-operator-name") || "SUPERVISOR";
    // Pre-create both independent unit records so dispatch can be assigned
    // before either control-room invite has been opened.
    await Promise.all([
      joinPlantRoom({ roomCode: normalized, unitNumber: 1, stationId: "SUPERVISOR-U1" }, operator, "supervisor"),
      joinPlantRoom({ roomCode: normalized, unitNumber: 2, stationId: "SUPERVISOR-U2" }, operator, "supervisor"),
    ]);
    const next = await getPlantSnapshot(normalized);
    setSnapshot(next);
    setRoomCode(normalized);
    if (!dispatchDirty.current) {
      setPlantDemand(Number(next.room?.plant_demand_mw ?? 675));
      setUnitDemand({
        1: Number(unitState(next, 1)?.assigned_demand_mw ?? 325),
        2: Number(unitState(next, 2)?.assigned_demand_mw ?? 350),
      });
    }
    return normalized;
  };

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof subscribePlantRoom> = null;
    let poll: number | undefined;
    void (async () => {
      try {
        setConnecting(true); setError("");
        const code = await load(connectedRoomCode);
        if (!active) return;
        const refresh = () => {
          void getPlantSnapshot(code).then(next => {
            if (!active) return;
            setSnapshot(next);
            if (!dispatchDirty.current) {
              setPlantDemand(Number(next.room?.plant_demand_mw ?? 0));
              setUnitDemand({ 1: Number(unitState(next, 1)?.assigned_demand_mw ?? 0), 2: Number(unitState(next, 2)?.assigned_demand_mw ?? 0) });
            }
          }).catch(() => {});
        };
        channel = subscribePlantRoom(code, refresh);
        // Realtime is immediate when available. Polling is the reliable
        // fallback for browsers/networks where Supabase Realtime is blocked.
        poll = window.setInterval(refresh, 5_000);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to open plant room. Run the plant_operations.sql setup first.");
      } finally { if (active) setConnecting(false); }
    })();
    return () => { active = false; channel?.unsubscribe(); if (poll) window.clearInterval(poll); };
  }, [connectedRoomCode, connectionEpoch]);
  useEffect(() => {
    if (!connectedRoomCode) return;
    let active = true;
    const readResponses = () => {
      void getPlantRemoteCommands(connectedRoomCode).then((commands) => {
        if (!active) return;
        // Commands arrive newest-first. Replay them oldest-first so a chained
        // CALL → EDITOR → SET procedure reads in the order it ran.
        commands.slice().reverse().forEach((entry) => {
          if (!entry.completed_at || announcedRemoteResponses.current.has(entry.id)) return;
          announcedRemoteResponses.current.add(entry.id);
          setTerminalHistory(previous => [
            ...previous.slice(-60),
            `[UNIT ${entry.target_unit} RESPONSE · #${entry.id}]`,
            entry.result || "Command completed without terminal output.",
          ]);
        });
      }).catch(() => {});
    };
    readResponses();
    const timer = window.setInterval(readResponses, 2_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [connectedRoomCode]);
  useEffect(() => {
    if (!connectedRoomCode) return;
    let active = true;
    const refreshCalls = () => {
      void getPlantPhoneCalls(connectedRoomCode).then((calls) => {
        if (active) setPrivateCalls(calls);
      }).catch(() => {});
    };
    refreshCalls();
    const timer = window.setInterval(refreshCalls, 2_500);
    return () => { active = false; window.clearInterval(timer); };
  }, [connectedRoomCode]);
  useEffect(() => {
    if (!selectedPrivateCall) { setSelectedPrivateMessages([]); return; }
    let active = true;
    const refreshMessages = () => {
      void getPlantPhoneCallMessages(selectedPrivateCall.id).then((messages) => {
        if (active) setSelectedPrivateMessages(messages);
      }).catch(() => {});
    };
    refreshMessages();
    const timer = window.setInterval(refreshMessages, 1_500);
    return () => { active = false; window.clearInterval(timer); };
  }, [selectedPrivateCall?.id]);
  useEffect(() => {
    const ringing = privateCalls.find((call) => call.target_extension === "0001" && call.status === "ringing");
    if (ringing && ringing.id !== activeSupervisorCall?.id) setIncomingSupervisorCall(ringing);
    if (!activeSupervisorCall) return;
    const updated = privateCalls.find((call) => call.id === activeSupervisorCall.id);
    if (updated) setActiveSupervisorCall(updated);
    if (updated && (updated.status === "declined" || updated.status === "ended")) {
      setTerminalHistory(previous => [...previous.slice(-60), `PRIVATE CALL ${updated.target_extension} ${updated.status.toUpperCase()}.`]);
      setActiveSupervisorCall(null); setSupervisorCallInput("");
    }
  }, [privateCalls, activeSupervisorCall?.id]);
  useEffect(() => {
    if (!activeSupervisorCall) { setSupervisorCallMessages([]); return; }
    let active = true;
    const refresh = () => {
      void getPlantPhoneCallMessages(activeSupervisorCall.id).then(messages => {
        if (active) setSupervisorCallMessages(messages);
      }).catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 1_500);
    return () => { active = false; window.clearInterval(timer); };
  }, [activeSupervisorCall?.id]);
  useEffect(() => {
    if (!connectedRoomCode) return;
    let active = true;
    const refreshPhone = () => {
      void getPlantPhoneMessages(connectedRoomCode).then((messages) => {
        if (active) setPhoneMessages(messages);
      }).catch(() => {});
    };
    refreshPhone();
    const timer = window.setInterval(refreshPhone, 2_500);
    return () => { active = false; window.clearInterval(timer); };
  }, [connectedRoomCode]);

  const totalOutput = useMemo(() => snapshot.units.reduce((sum, unit) => sum + Number(unit.output_mw || 0), 0), [snapshot.units]);
  const nextDemand = Number(snapshot.room?.next_plant_demand_mw ?? plantDemand);
  const secondsToDemand = snapshot.room?.demand_effective_at
    ? Math.max(0, Math.ceil((Date.parse(snapshot.room.demand_effective_at) - managerClock) / 1000))
    : 0;
  const demandPlanningOpen = secondsToDemand >= 60 && secondsToDemand <= 200;
  const dispatchTarget = demandPlanningOpen ? nextDemand : plantDemand;
  const assignedTotal = unitDemand[1] + unitDemand[2];
  const plantDifference = totalOutput - plantDemand;
  const createInvite = (unit: 1 | 2, customStation?: string) => {
    const station = (customStation || `U${unit}-UNIT`).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32) || `U${unit}-UNIT`;
    const local = transport === "local" ? "&local=1" : "";
    return `${window.location.origin}/reactor?plant=${encodeURIComponent(roomCode)}&unit=${unit}&station=${station}${local}`;
  };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch { window.prompt("Copy this invite link", text); } };
  const sendSupervisorChat = async () => {
    const endpoint = getPhoneEndpoint(chatExtension);
    const body = chatMessage.trim();
    if (!endpoint || endpoint.type !== "manual" || !body) return;
    try {
      await sendPlantPhoneMessage({
        room_code: roomCode,
        conversation_id: phoneConversationId(roomCode, "0001", endpoint.extension),
        source_extension: "0001",
        source_label: "PMS Supervisor Room",
        target_extension: endpoint.extension,
        target_label: endpoint.label,
        body,
        priority: chatUrgent ? "urgent" : "normal",
      });
      setChatMessage(""); setChatUrgent(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send supervisor phone message.");
    }
  };
  const applyDispatch = async () => {
    try {
      if (!demandPlanningOpen)
        throw new Error("Demand distribution opens 200 to 60 seconds before the scheduled demand change.");
      if (Math.abs(assignedTotal - dispatchTarget) > 0.01)
        throw new Error(`Dispatch must total exactly ${dispatchTarget.toFixed(0)} MW. Current total: ${assignedTotal.toFixed(0)} MW.`);
      setError("");
      await Promise.all([
        updateUnitDemand({ roomCode, unitNumber: 1, stationId: "SUPERVISOR-U1" }, unitDemand[1]),
        updateUnitDemand({ roomCode, unitNumber: 2, stationId: "SUPERVISOR-U2" }, unitDemand[2]),
      ]);
      dispatchDirty.current = false;
      setSnapshot(await getPlantSnapshot(roomCode));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dispatch update failed."); }
  };
  const balance = () => {
    const first = Math.round(dispatchTarget / 2);
    dispatchDirty.current = true;
    setUnitDemand({ 1: first, 2: Math.max(0, dispatchTarget - first) });
  };
  const terminalAppend = (input: string, output: string) => {
    setTerminalHistory(previous => [...previous.slice(-60), `> ${input}`, output]);
    setTerminalInput("");
  };
  const runTerminal = async () => {
    const raw = terminalInput.trim();
    if (!raw) return;
    const [head = "", second = "", ...rest] = raw.split(/\s+/);
    const command = head.toLowerCase();
    const number = Number(second);
    try {
      if (command === "clear") { setTerminalHistory([]); setTerminalInput(""); return; }
      if (command === "help") return terminalAppend(raw, "SUPERVISOR COMMANDS\nSTATUS\nCODE <plant-code>                 connect/create a plant room\nINVITE <1|2> [station-code]       create a unit invite link\nDEMAND <MW>                       set current site demand\nNEXTDEMAND <MW>                   set scheduled next demand\nNEXTTIME <seconds>                set seconds until scheduled demand takes effect\nUNIT <1|2> DEMAND <MW>            assign unit demand\nMANAGER ON|OFF                    enable/disable shared demand manager\nINTERLOCK ON|OFF | 1>2 | 2>1      configure electrical interlock\nINTERLOCK BREAKER ON|OFF          operate the tie breaker\nPHONE                             list active plant phone extensions\nPHONE LOG                         show recent PMS traffic\nCALL <manual-extension>           dial a private pickup line\nCALL <auto-extension> <request>   operate an automated unit service\nCONNECT <1|2>                     select a remote unit terminal\nSEND <command>                    queue a command on selected unit\nREMOTE <1|2> <command>            queue a command directly\n\nExample: NEXTTIME 180\nExample: CALL 0029 refuel\nExample: CONNECT 1, then SEND set auto.aprm 20");
      if (command === "status") return terminalAppend(raw, `PLANT ${roomCode}\nDEMAND ${plantDemand.toFixed(0)} MW · NEXT ${nextDemand.toFixed(0)} MW IN ${secondsToDemand}s · OUTPUT ${totalOutput.toFixed(1)} MW\nU1 ${Number(unitState(snapshot, 1)?.output_mw || 0).toFixed(1)} / ${unitDemand[1].toFixed(0)} MW\nU2 ${Number(unitState(snapshot, 2)?.output_mw || 0).toFixed(1)} / ${unitDemand[2].toFixed(0)} MW\nINTERLOCK ${snapshot.room?.interlock_enabled ? `U${snapshot.room.interlock_source_unit} → U${snapshot.room.interlock_target_unit}` : "OFF"}\nREMOTE TERMINAL: UNIT ${terminalUnit}`);
      if (command === "code") {
        const next = normaliseRoom([second, ...rest].join(" "));
        if (next.length < 3) throw new Error("Use a plant code with at least three characters.");
        dispatchDirty.current = false; setRoomCode(next); setConnectedRoomCode(next); setConnectionEpoch(value => value + 1);
        return terminalAppend(raw, `CONNECTING TO PLANT ${next}…`);
      }
      if (command === "invite") {
        const unit = number === 2 ? 2 : number === 1 ? 1 : null;
        if (!unit) throw new Error("Usage: INVITE <1|2> [station-code]");
        return terminalAppend(raw, createInvite(unit, rest.join(" ")));
      }
      if (command === "phone") {
        if (second.toLowerCase() !== "log") return terminalAppend(raw, `PLANT PHONE DIRECTORY\n${phoneDirectoryText()}\n\nExcluded: *000, 0000, 0002, 3333.`);
        const messages = await getPlantPhoneMessages(roomCode);
        const recent = messages.slice(-16);
        return terminalAppend(raw, recent.length ? recent.map((message) => `[${message.source_extension} → ${message.target_extension}] ${message.source_label}: ${message.body}`).join("\n") : "No manual plant phone messages.");
      }
      if (command === "call") {
        const endpoint = getPhoneEndpoint(second);
        const request = rest.join(" ").trim();
        if (!endpoint) throw new Error("That extension is reserved or unavailable. Use PHONE for the active directory.");
        if (endpoint.type === "manual") {
          if (request) throw new Error("Private calls begin with CALL <extension>. Send your message after the recipient picks up.");
          const privateCall = await createPlantPhoneCall({
            room_code: roomCode,
            source_extension: "0001",
            source_label: "Supervisor Room",
            target_extension: endpoint.extension,
            target_label: endpoint.label,
          });
          setActiveSupervisorCall(privateCall);
          return terminalAppend(raw, `PRIVATE LINE RINGING — ${endpoint.extension} ${endpoint.label}.`);
        }
        if (!request) throw new Error(`State a service request after ${endpoint.extension}.`);
        if (endpoint.extension === "0100" && ["points", "status"].includes(request.toLowerCase())) return terminalAppend(raw, "RBWR HR is available from each unit terminal with CALL 0100, then POINTS.");
        const action = automatedPhoneCommand(endpoint, request);
        if (!action) throw new Error(`${endpoint.label} cannot perform that request yet.`);
        await queuePlantRemoteCommand(roomCode, action.targetUnit, action.command);
        return terminalAppend(raw, `AUTOMATED SERVICE REQUEST ROUTED TO UNIT ${action.targetUnit}: ${action.command.toUpperCase()}.`);
      }
      if (command === "demand") {
        const demand = Number(second); if (!Number.isFinite(demand) || demand < 0) throw new Error("Usage: DEMAND <MW>");
        await updatePlantDispatch(roomCode, { plant_demand_mw: demand }); setPlantDemand(demand);
        return terminalAppend(raw, `SITE DEMAND SET TO ${demand.toFixed(0)} MW.`);
      }
      if (command === "nextdemand") {
        const demand = Number(second); if (!Number.isFinite(demand) || demand < 0) throw new Error("Usage: NEXTDEMAND <MW>");
        await updatePlantDispatch(roomCode, { next_plant_demand_mw: demand });
        return terminalAppend(raw, `NEXT SITE DEMAND SET TO ${demand.toFixed(0)} MW.`);
      }
      if (command === "nexttime") {
        const seconds = Math.round(Number(second));
        if (!Number.isFinite(seconds) || seconds < 1 || seconds > 86400) throw new Error("Usage: NEXTTIME <seconds> (1–86400)");
        const effectiveAt = new Date(Date.now() + seconds * 1000).toISOString();
        await updatePlantDispatch(roomCode, { demand_effective_at: effectiveAt });
        return terminalAppend(raw, `NEXT DEMAND TIMER SET — ${seconds}s remaining; ${nextDemand.toFixed(0)} MW will take effect at ${new Date(effectiveAt).toLocaleTimeString()}.`);
      }
      if (command === "manager") {
        if (!/^(on|off)$/i.test(second)) throw new Error("Usage: MANAGER ON|OFF");
        await updatePlantDispatch(roomCode, {
          demand_manager_enabled: second.toLowerCase() === "on",
          demand_manager_last_seen: second.toLowerCase() === "on" ? new Date().toISOString() : null,
        });
        return terminalAppend(raw, `DEMAND MANAGER ${second.toUpperCase()}.`);
      }
      if (command === "interlock") {
        const value = second.toLowerCase();
        if (value === "breaker" && /^(on|off)$/i.test(rest[0] || "")) {
          const closed = rest[0].toLowerCase() === "on";
          await updatePlantDispatch(roomCode, { interlock_breaker_closed: closed });
          return terminalAppend(raw, `UNIT INTERLOCK BREAKER ${closed ? "CLOSED" : "OPEN"}.`);
        }
        if (value === "on" || value === "off") { await updatePlantDispatch(roomCode, { interlock_enabled: value === "on" }); return terminalAppend(raw, `UNIT INTERLOCK ${value.toUpperCase()}.`); }
        if (value === "1>2" || value === "2>1") { const source = value[0] === "1" ? 1 : 2; await updatePlantDispatch(roomCode, { interlock_source_unit: source, interlock_target_unit: source === 1 ? 2 : 1 }); return terminalAppend(raw, `INTERLOCK ROUTED U${source} → U${source === 1 ? 2 : 1}.`); }
        throw new Error("Usage: INTERLOCK ON|OFF|1>2|2>1 or INTERLOCK BREAKER ON|OFF");
      }
      if (command === "unit" && (number === 1 || number === 2) && second && rest[0]?.toLowerCase() === "demand") {
        const demand = Number(rest[1]); if (!Number.isFinite(demand) || demand < 0) throw new Error("Usage: UNIT <1|2> DEMAND <MW>");
        await updateUnitDemand({ roomCode, unitNumber: number as 1 | 2, stationId: "SUPERVISOR" }, demand);
        setUnitDemand(current => ({ ...current, [number]: demand }));
        return terminalAppend(raw, `UNIT ${number} ASSIGNMENT SET TO ${demand.toFixed(0)} MW.`);
      }
      if (command === "connect") {
        if (number !== 1 && number !== 2) throw new Error("Usage: CONNECT <1|2>");
        setTerminalUnit(number); return terminalAppend(raw, `REMOTE TERMINAL CONNECTED: UNIT ${number}.\nUse SEND <command>, such as SEND editor or SEND set auto.aprm 20.`);
      }
      const remote = command === "remote" ? (number === 1 || number === 2 ? { unit: number as 1 | 2, text: rest.join(" ") } : null) : command === "send" ? { unit: terminalUnit, text: [second, ...rest].join(" ") } : ["call", "editor", "set", "get", "status", "scram"].includes(command) ? { unit: terminalUnit, text: raw } : null;
      if (remote) { if (!remote.text.trim()) throw new Error("Enter a command to send."); await queuePlantRemoteCommand(roomCode, remote.unit, remote.text); return terminalAppend(raw, `QUEUED FOR UNIT ${remote.unit} TERMINAL: ${remote.text}`); }
      throw new Error("Unknown supervisor command. Type HELP.");
    } catch (cause) { terminalAppend(raw, `COMMAND REJECTED — ${cause instanceof Error ? cause.message : "operation failed"}`); }
  };

  useEffect(() => {
    const timer = window.setInterval(() => setManagerClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!connectedRoomCode || snapshot.room?.demand_manager_enabled === false) return;
    const heartbeat = () => {
      void updatePlantDispatch(connectedRoomCode, { demand_manager_last_seen: new Date().toISOString() }).catch(() => {});
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 5000);
    return () => window.clearInterval(timer);
  }, [connectedRoomCode, snapshot.room?.demand_manager_enabled]);
  useEffect(() => {
    const room = snapshot.room;
    if (!room || !connectedRoomCode || room.demand_manager_enabled === false) return;
    const schedule = async () => {
      const now = Date.now();
      const effectiveAt = room.demand_effective_at ? Date.parse(room.demand_effective_at) : 0;
      if (!effectiveAt || Number.isNaN(effectiveAt)) {
        const next = Math.round(300 + Math.random() * 900);
        await updatePlantDispatch(connectedRoomCode, { next_plant_demand_mw: next, demand_effective_at: new Date(now + (360 + Math.random() * 280) * 1000).toISOString() });
        return;
      }
      const remaining = Math.ceil((effectiveAt - now) / 1000);
      if (remaining <= 0) {
        const next = Math.round(300 + Math.random() * 900);
        await updatePlantDispatch(connectedRoomCode, { plant_demand_mw: Number(room.next_plant_demand_mw), next_plant_demand_mw: next, demand_effective_at: new Date(now + (360 + Math.random() * 280) * 1000).toISOString() });
        demandManagerHandled.current = null;
        return;
      }
      if (remaining <= 200 && remaining >= 60 && demandManagerHandled.current !== room.demand_effective_at) {
        const first = Math.round(Number(room.next_plant_demand_mw) / 2);
        demandManagerHandled.current = room.demand_effective_at;
        dispatchDirty.current = false;
        setUnitDemand({ 1: first, 2: Number(room.next_plant_demand_mw) - first });
        await Promise.all([
          updateUnitDemand({ roomCode: connectedRoomCode, unitNumber: 1, stationId: "DEMAND-MANAGER" }, first),
          updateUnitDemand({ roomCode: connectedRoomCode, unitNumber: 2, stationId: "DEMAND-MANAGER" }, Number(room.next_plant_demand_mw) - first),
        ]);
      }
    };
    void schedule().catch(cause => setError(cause instanceof Error ? cause.message : "Demand manager update failed."));
  }, [snapshot.room, managerClock, connectedRoomCode]);
  useEffect(() => { const output = terminalOutputRef.current; if (output) output.scrollTop = output.scrollHeight; }, [terminalHistory]);

  return <main className="min-h-screen bg-[#07111d] p-4 font-mono text-slate-100 sm:p-8">
    <section className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-400/30 pb-5">
        <div><p className="text-xs font-black tracking-[.28em] text-violet-300">UNIT 2 // PLANT SUPERVISOR</p><h1 className="text-2xl font-black sm:text-3xl">Plant Dispatch & Unit Interlock</h1></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => {
          const next = transport === "local" ? "supabase" : "local";
          setPlantTransport(next); setTransportState(next); setConnectionEpoch(current => current + 1);
        }}>{transport === "local" ? "LOCAL / OFFLINE" : "SUPABASE / ONLINE"}</Button><Button variant="outline" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4"/>Terminal</Button></div>
      </header>
      <div className="grid gap-4 rounded-xl border border-violet-400/30 bg-slate-900/70 p-4 md:grid-cols-[1fr_auto]">
        <label className="text-sm font-bold">PLANT ROOM CODE<input value={roomCode} onChange={event => setRoomCode(normaliseRoom(event.target.value))} className="mt-2 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-cyan-200" /></label>
        <Button className="self-end bg-violet-500 text-slate-950 hover:bg-violet-400" disabled={connecting} onClick={() => { const next = normaliseRoom(roomCode); if (next.length < 3) { setError("Use a room code with at least three characters."); return; } dispatchDirty.current = false; setConnecting(true); setConnectedRoomCode(next); setConnectionEpoch(current => current + 1); }}><RefreshCw className="mr-2 h-4 w-4"/>{connecting ? "CONNECTING" : "CONNECT"}</Button>
      </div>
      {error && <p className="rounded border border-red-500/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
      <p className="text-xs font-bold tracking-wider text-emerald-300">● {transport === "local" ? "BROWSER-LOCAL PLANT · no network required" : "LIVE ROOM TELEMETRY · Supabase connected"}</p>
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-cyan-400/30 bg-slate-900/70 p-4"><p className="text-xs tracking-widest text-slate-400">PLANT DEMAND</p><strong className="mt-2 block text-4xl text-cyan-200">{plantDemand.toFixed(0)} <small className="text-base">MW</small></strong><p className="mt-2 text-xs text-slate-400">Assigned: {assignedTotal.toFixed(0)} MW</p></article>
        <article className="rounded-xl border border-emerald-400/30 bg-slate-900/70 p-4"><p className="text-xs tracking-widest text-slate-400">COMBINED OUTPUT</p><strong className="mt-2 block text-4xl text-emerald-200">{totalOutput.toFixed(1)} <small className="text-base">MW</small></strong><p className={`mt-2 text-xs ${Math.abs(plantDifference) <= 10 ? "text-emerald-300" : "text-amber-300"}`}>{plantDifference >= 0 ? "+" : ""}{plantDifference.toFixed(1)} MW vs plant demand</p></article>
        <article className="rounded-xl border border-amber-400/30 bg-slate-900/70 p-4"><p className="text-xs tracking-widest text-slate-400">UNIT INTERLOCK</p><strong className={`mt-2 block text-xl ${snapshot.room?.interlock_enabled ? "text-emerald-300" : "text-slate-400"}`}>{snapshot.room?.interlock_enabled ? `ENABLED · U${snapshot.room.interlock_source_unit} → U${snapshot.room.interlock_target_unit}` : "INDEPENDENT"}</strong><p className="mt-2 text-xs text-slate-400">Feeds the target's Bus A from a powered source Bus A and blocks its startup transformer.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void updatePlantDispatch(roomCode, { interlock_enabled: !snapshot.room?.interlock_enabled })}>{snapshot.room?.interlock_enabled ? "DISABLE" : "ENABLE"}</Button><Button variant="outline" onClick={() => void updatePlantDispatch(roomCode, { interlock_source_unit: 1, interlock_target_unit: 2 })}>U1 → U2</Button><Button variant="outline" onClick={() => void updatePlantDispatch(roomCode, { interlock_source_unit: 2, interlock_target_unit: 1 })}>U2 → U1</Button></div></article>
      </section>
      <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"><div className="mb-4 flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-violet-300"/><h2 className="font-black">Demand manager</h2></div><p className={`mb-4 text-sm ${demandPlanningOpen ? "text-emerald-300" : "text-slate-400"}`}>CURRENT SITE DEMAND: {plantDemand.toFixed(0)} MW · NEXT: {nextDemand.toFixed(0)} MW IN {secondsToDemand}s · {demandPlanningOpen ? "DISTRIBUTION WINDOW OPEN" : "Distribution opens at T−200 and closes at T−60."}</p><div className="grid gap-4 md:grid-cols-3"><label>Required dispatch total MW<input type="number" value={dispatchTarget} disabled className="mt-2 block w-full rounded bg-slate-950 p-2 text-slate-400" /></label>{([1, 2] as const).map(unit => <label key={unit}>Unit {unit} demand MW<input type="number" min="0" max="1200" disabled={!demandPlanningOpen} value={unitDemand[unit]} onChange={event => { dispatchDirty.current = true; setUnitDemand(current => ({ ...current, [unit]: Number(event.target.value) || 0 })); }} className="mt-2 block w-full rounded bg-slate-950 p-2 disabled:cursor-not-allowed disabled:text-slate-500" /></label>)}</div><p className={`mt-3 text-xs ${Math.abs(assignedTotal - dispatchTarget) <= .01 ? "text-emerald-300" : "text-amber-300"}`}>ASSIGNED: {assignedTotal.toFixed(0)} / {dispatchTarget.toFixed(0)} MW {Math.abs(assignedTotal - dispatchTarget) <= .01 ? "· COMPLETE" : "· NO DEMAND MAY BE LEFT UNASSIGNED"}</p><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" disabled={!demandPlanningOpen} onClick={balance}>SPLIT EVENLY</Button><Button className="bg-violet-500 text-slate-950 hover:bg-violet-400" disabled={!demandPlanningOpen} onClick={() => void applyDispatch()}>APPLY DISPATCH</Button></div></section>
      <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"><div className="mb-4 flex items-center gap-2"><Link2 className="h-5 w-5 text-cyan-300"/><h2 className="font-black">Unit station invites</h2></div><div className="grid gap-3 md:grid-cols-2">{([1, 2] as const).map(unit => { const row = unitState(snapshot, unit); const invite = createInvite(unit); return <article key={unit} className="rounded border border-slate-700 bg-slate-950 p-3"><div className="flex items-center justify-between"><strong>UNIT {unit}</strong><span className={row?.offsite_available === false ? "text-red-300" : "text-emerald-300"}>{row?.offsite_available === false ? "OFFSITE LOST" : "AVAILABLE"}</span></div><p className="mt-2 text-sm text-slate-300">{Number(row?.output_mw || 0).toFixed(1)} MW output · {Number(row?.assigned_demand_mw || 0).toFixed(0)} MW assigned</p><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => void copy(invite)}><Copy className="mr-2 h-4 w-4"/>COPY INVITE</Button><Button className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => window.open(invite, "_blank", "noopener,noreferrer")}>OPEN UNIT {unit}</Button></div></article>; })}</div></section>
      <section className="rounded-xl border border-violet-400/35 bg-slate-900/70 p-4"><div className="mb-2"><p className="text-xs font-black tracking-[.22em] text-violet-300">UNIT 2 STATION ASSIGNMENT</p><h2 className="text-lg font-black">Dedicated operator stations</h2></div><p className="mb-4 text-sm text-slate-300">Each link occupies one named station. MCR retains full access; every other station is limited to its assigned panel group and uses its own telephone extension.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{U2_STATIONS.filter(station => station.role !== "unit").map(station => { const invite = createInvite(2, station.stationId); return <article key={station.stationId} className="rounded border border-violet-500/25 bg-slate-950/80 p-3"><p className="text-xs font-black text-violet-200">{station.extension} · {station.label}</p><p className="mt-1 text-[11px] text-slate-400">{station.panels.map(panel => panel.replace("-", " ")).join(" · ")}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" className="flex-1" onClick={() => void copy(invite)}>COPY</Button><Button size="sm" className="flex-1 bg-violet-500 text-slate-950 hover:bg-violet-400" onClick={() => window.open(invite, "_blank", "noopener,noreferrer")}>OPEN</Button></div></article>; })}</div></section>
      <section className="rounded-xl border border-emerald-400/35 bg-black p-4 shadow-inner">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black tracking-[.24em] text-emerald-400">SUPERVISOR COMMAND TERMINAL</p><h2 className="text-lg font-black text-emerald-100">Plant dispatch & remote unit CLI</h2></div><span className="rounded border border-emerald-500/40 px-2 py-1 text-xs text-emerald-300">REMOTE UNIT {terminalUnit}</span></div>
        <pre ref={terminalOutputRef} className="h-64 overflow-y-auto whitespace-pre-wrap border border-emerald-900/70 bg-[#020b07] p-3 text-sm leading-relaxed text-emerald-200">{terminalHistory.join("\n\n")}</pre>
        <form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); void runTerminal(); }}><span className="pt-2 text-emerald-400">&gt;</span><input value={terminalInput} onChange={event => setTerminalInput(event.target.value)} placeholder="help · connect 1 · send editor · remote 2 set auto.aprm 20" className="min-w-0 flex-1 border-b border-emerald-700 bg-transparent px-2 py-2 text-emerald-100 outline-none placeholder:text-emerald-900" autoComplete="off" /><Button type="submit" className="bg-emerald-500 text-slate-950 hover:bg-emerald-300">EXECUTE</Button></form>
      </section>
      <section className="rounded-xl border border-cyan-400/35 bg-slate-950 p-4 shadow-inner">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black tracking-[.24em] text-cyan-300">PMS // LIVE PLANT MESSAGING</p><h2 className="text-lg font-black text-cyan-50">Supervisor message traffic</h2></div><span className="rounded border border-cyan-400/40 px-2 py-1 text-xs text-cyan-200">NO PICKUP REQUIRED</span></div>
        <div className="h-64 overflow-y-auto rounded border border-cyan-950 bg-[#030c12] p-3 text-sm leading-relaxed text-cyan-100">{phoneMessages.length ? phoneMessages.slice(-60).map((message) => <div key={message.id} className={`mb-2 rounded border px-3 py-2 ${message.priority === "urgent" && !message.acknowledged_at ? "border-red-400/70 bg-red-950/35" : "border-cyan-500/15 bg-cyan-950/10"}`}><button type="button" onClick={() => setChatExtension(message.source_extension === "0001" ? message.target_extension : message.source_extension)} className="block w-full text-left hover:text-cyan-200"><span className="font-black text-cyan-300">{message.priority === "urgent" ? "URGENT · " : ""}{message.source_extension} → {message.target_extension}</span><span className="ml-2 text-xs text-cyan-300/65">{message.source_label}</span><p className="mt-1 text-cyan-50">{message.body}</p></button>{message.target_extension === "0001" && message.priority === "urgent" && !message.acknowledged_at && <Button size="sm" type="button" onClick={() => void acknowledgePlantPhoneMessage(message.id)} className="mt-2 h-7 bg-red-400 text-slate-950 hover:bg-red-300">ACKNOWLEDGE</Button>}</div>) : <p className="text-cyan-300/60">No PMS traffic in this plant room.</p>}</div>
        <form className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr_auto]" onSubmit={event => { event.preventDefault(); void sendSupervisorChat(); }}>
          <select value={chatExtension} onChange={event => setChatExtension(event.target.value)} className="rounded border border-cyan-500/35 bg-slate-900 px-2 py-2 text-sm text-cyan-100">{["0010", "0020", "0021", "0022", "0023", "0024", "0025", "0040"].map(extension => { const endpoint = getPhoneEndpoint(extension); return endpoint ? <option key={extension} value={extension}>{extension} · {endpoint.label}</option> : null; })}</select>
          <div className="min-w-0"><input value={chatMessage} onChange={event => setChatMessage(event.target.value)} placeholder="Send a PMS message; it appears immediately for the addressed station." className="w-full rounded border border-cyan-500/35 bg-slate-900 px-3 py-2 text-cyan-50 outline-none placeholder:text-cyan-900" /><label className="mt-1 flex items-center gap-2 text-[11px] text-red-200"><input type="checkbox" checked={chatUrgent} onChange={event => setChatUrgent(event.target.checked)} /> URGENT — recipient must acknowledge</label></div>
          <Button type="submit" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">SEND PMS</Button>
        </form>
      </section>
      <section className="rounded-xl border border-amber-400/35 bg-slate-950 p-4 shadow-inner">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black tracking-[.24em] text-amber-300">PRIVATE CALL AUDIT</p><h2 className="text-lg font-black text-amber-50">Supervisor call logs</h2></div><span className="rounded border border-amber-400/40 px-2 py-1 text-xs text-amber-200">SUPERVISOR VIEW ONLY</span></div>
        <p className="mb-3 text-xs leading-relaxed text-amber-100/75">Private lines are available only to the calling and receiving stations while active. The supervisor can inspect their call log and transcript here after a call ends.</p>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="max-h-64 overflow-y-auto rounded border border-amber-900/70 bg-[#100c03] p-2">{privateCalls.filter(call => call.status === "ended" || call.status === "declined").length ? privateCalls.filter(call => call.status === "ended" || call.status === "declined").map(call => <button type="button" key={call.id} onClick={() => setSelectedPrivateCall(call)} className={`mb-2 block w-full rounded border p-3 text-left text-xs ${selectedPrivateCall?.id === call.id ? "border-amber-300 bg-amber-950/45" : "border-amber-500/20 bg-black/20 hover:border-amber-400/55"}`}><b className="text-amber-200">{call.source_extension} → {call.target_extension}</b><span className="ml-2 text-amber-100/60">{call.status.toUpperCase()}</span><p className="mt-1 text-amber-50/80">{call.source_label} → {call.target_label}</p><p className="mt-1 text-[10px] text-amber-100/45">{new Date(call.created_at).toLocaleString()}</p></button>) : <p className="p-3 text-xs text-amber-100/55">No completed private calls in this room.</p>}</div>
          <div className="max-h-64 overflow-y-auto rounded border border-amber-900/70 bg-black/30 p-3 text-sm leading-relaxed text-amber-100">{selectedPrivateCall ? <><p className="mb-3 text-xs font-black tracking-widest text-amber-300">{selectedPrivateCall.source_label} // {selectedPrivateCall.target_label}</p>{selectedPrivateMessages.length ? selectedPrivateMessages.map(message => <p key={message.id} className="mb-2"><b className="text-amber-300">{message.source_label}:</b> {message.body}</p>) : <p className="text-amber-100/55">No conversation content was sent before hang-up.</p>}</> : <p className="text-amber-100/55">Select a finished call to inspect its transcript.</p>}</div>
        </div>
      </section>
      {incomingSupervisorCall && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
        <section className="w-full max-w-md rounded-xl border border-amber-300/60 bg-[#130f04] p-5 font-mono shadow-[0_0_42px_rgba(251,191,36,.22)]">
          <p className="text-[11px] font-black tracking-[.24em] text-amber-300">INCOMING PRIVATE CALL</p>
          <h2 className="mt-2 text-lg font-black text-amber-50">{incomingSupervisorCall.source_label} IS CALLING</h2>
          <p className="mt-3 text-sm leading-relaxed text-amber-100/80">Extension {incomingSupervisorCall.source_extension} is requesting a private supervisor line.</p>
          <div className="mt-5 flex gap-2"><Button type="button" className="flex-1 bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={() => { void updatePlantPhoneCall(incomingSupervisorCall.id, "connected").then(() => { setActiveSupervisorCall({ ...incomingSupervisorCall, status: "connected", answered_at: new Date().toISOString() }); setIncomingSupervisorCall(null); setTerminalHistory(previous => [...previous.slice(-60), `PRIVATE CALL ACCEPTED // ${incomingSupervisorCall.source_label}.`]); }); }}>PICK UP</Button><Button type="button" variant="outline" className="flex-1 border-red-400/60 text-red-200 hover:bg-red-950/50" onClick={() => { void updatePlantPhoneCall(incomingSupervisorCall.id, "declined"); setIncomingSupervisorCall(null); setTerminalHistory(previous => [...previous.slice(-60), `PRIVATE CALL DECLINED // ${incomingSupervisorCall.source_label}.`]); }}>DECLINE</Button></div>
        </section>
      </div>}
      {activeSupervisorCall && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
        <section className="w-full max-w-md rounded-xl border border-emerald-400/50 bg-[#06130e] p-5 font-mono shadow-[0_0_42px_rgba(16,185,129,.25)]">
          <p className="text-[11px] font-black tracking-[.24em] text-emerald-400">{activeSupervisorCall.status === "ringing" ? "PRIVATE LINE RINGING" : "SUPERVISOR PRIVATE LINE"}</p>
          <h2 className="mt-2 text-lg font-black text-emerald-100">{activeSupervisorCall.source_label} // {activeSupervisorCall.target_label}</h2>
          <div className="mt-5 max-h-52 space-y-3 overflow-auto rounded border border-emerald-400/20 bg-black/30 p-3 text-sm leading-relaxed text-emerald-200">{activeSupervisorCall.status === "ringing" ? <p>RINGING {activeSupervisorCall.target_label} — awaiting pickup.</p> : supervisorCallMessages.length ? supervisorCallMessages.map(message => <p key={message.id}><b className="text-emerald-400">{message.source_label}:</b> {message.body}</p>) : <p className="text-emerald-100/60">Line connected. Awaiting first message.</p>}</div>
          {activeSupervisorCall.status === "ringing" ? <Button type="button" className="mt-4 w-full bg-red-500 text-white hover:bg-red-400" onClick={() => { void updatePlantPhoneCall(activeSupervisorCall.id, "ended"); setActiveSupervisorCall(null); setTerminalHistory(previous => [...previous.slice(-60), `CALL ${activeSupervisorCall.target_extension} CANCELLED.`]); }}>CANCEL CALL</Button> : <form className="mt-4 flex gap-2 border-t border-emerald-400/20 pt-4" onSubmit={event => { event.preventDefault(); const body = supervisorCallInput.trim(); if (!body) return; if (["end", "hang up", "bye", "goodbye"].includes(body.toLowerCase())) { void updatePlantPhoneCall(activeSupervisorCall.id, "ended"); setActiveSupervisorCall(null); setSupervisorCallInput(""); return; } void sendPlantPhoneCallMessage({ call_id: activeSupervisorCall.id, source_extension: "0001", source_label: "Supervisor Room", body }).then(() => setSupervisorCallInput("")).catch(cause => setError(cause instanceof Error ? cause.message : "Unable to send private call message.")); }}><input autoFocus value={supervisorCallInput} onChange={event => setSupervisorCallInput(event.target.value)} placeholder="State your request… (type 'end' to hang up)" className="min-w-0 flex-1 bg-transparent font-mono text-sm text-emerald-100 outline-none placeholder:text-emerald-800"/><Button type="submit" size="sm" className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">SEND</Button></form>}
        </section>
      </div>}
    </section>
  </main>;
}
