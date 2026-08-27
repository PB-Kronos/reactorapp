import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Link2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PlantSnapshot,
  createStationId,
  getPlantSnapshot,
  joinPlantRoom,
  readPlantAssignment,
  subscribePlantRoom,
  updatePlantDispatch,
  updateUnitDemand,
} from "@/lib/plantOperations";

const normaliseRoom = (value: string) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
const unitState = (snapshot: PlantSnapshot, unit: 1 | 2) => snapshot.units.find((entry) => entry.unit_number === unit);

export default function Supervisor() {
  const navigate = useNavigate();
  const stored = readPlantAssignment();
  const [roomCode, setRoomCode] = useState(stored?.roomCode || "UNIT2-PLANT");
  const [connectedRoomCode, setConnectedRoomCode] = useState(stored?.roomCode || "UNIT2-PLANT");
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const [snapshot, setSnapshot] = useState<PlantSnapshot>({ room: null, units: [] });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [plantDemand, setPlantDemand] = useState(675);
  const [unitDemand, setUnitDemand] = useState({ 1: 325, 2: 350 });
  const dispatchDirty = useRef(false);
  const demandManagerHandled = useRef<string | null>(null);
  const [managerClock, setManagerClock] = useState(Date.now());

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
        poll = window.setInterval(refresh, 1000);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to open plant room. Run the plant_operations.sql setup first.");
      } finally { if (active) setConnecting(false); }
    })();
    return () => { active = false; channel?.unsubscribe(); if (poll) window.clearInterval(poll); };
  }, [connectedRoomCode, connectionEpoch]);

  const totalOutput = useMemo(() => snapshot.units.reduce((sum, unit) => sum + Number(unit.output_mw || 0), 0), [snapshot.units]);
  const nextDemand = Number(snapshot.room?.next_plant_demand_mw ?? plantDemand);
  const secondsToDemand = snapshot.room?.demand_effective_at
    ? Math.max(0, Math.ceil((Date.parse(snapshot.room.demand_effective_at) - managerClock) / 1000))
    : 0;
  const demandPlanningOpen = secondsToDemand >= 60 && secondsToDemand <= 200;
  const dispatchTarget = demandPlanningOpen ? nextDemand : plantDemand;
  const assignedTotal = unitDemand[1] + unitDemand[2];
  const plantDifference = totalOutput - plantDemand;
  const createInvite = (unit: 1 | 2) => {
    const station = createStationId(unit);
    return `${window.location.origin}/reactor?plant=${encodeURIComponent(roomCode)}&unit=${unit}&station=${station}`;
  };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch { window.prompt("Copy this invite link", text); } };
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

  useEffect(() => {
    const timer = window.setInterval(() => setManagerClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!connectedRoomCode) return;
    const heartbeat = () => {
      void updatePlantDispatch(connectedRoomCode, { demand_manager_last_seen: new Date().toISOString() }).catch(() => {});
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 5000);
    return () => window.clearInterval(timer);
  }, [connectedRoomCode]);
  useEffect(() => {
    const room = snapshot.room;
    if (!room || !connectedRoomCode) return;
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

  return <main className="min-h-screen bg-[#07111d] p-4 font-mono text-slate-100 sm:p-8">
    <section className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-400/30 pb-5">
        <div><p className="text-xs font-black tracking-[.28em] text-violet-300">UNIT 2 // PLANT SUPERVISOR</p><h1 className="text-2xl font-black sm:text-3xl">Plant Dispatch & Unit Interlock</h1></div>
        <Button variant="outline" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4"/>Terminal</Button>
      </header>
      <div className="grid gap-4 rounded-xl border border-violet-400/30 bg-slate-900/70 p-4 md:grid-cols-[1fr_auto]">
        <label className="text-sm font-bold">PLANT ROOM CODE<input value={roomCode} onChange={event => setRoomCode(normaliseRoom(event.target.value))} className="mt-2 block w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-cyan-200" /></label>
        <Button className="self-end bg-violet-500 text-slate-950 hover:bg-violet-400" disabled={connecting} onClick={() => { const next = normaliseRoom(roomCode); if (next.length < 3) { setError("Use a room code with at least three characters."); return; } dispatchDirty.current = false; setConnecting(true); setConnectedRoomCode(next); setConnectionEpoch(current => current + 1); }}><RefreshCw className="mr-2 h-4 w-4"/>{connecting ? "CONNECTING" : "CONNECT"}</Button>
      </div>
      {error && <p className="rounded border border-red-500/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
      <p className="text-xs font-bold tracking-wider text-emerald-300">● LIVE ROOM TELEMETRY · updates every second</p>
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-cyan-400/30 bg-slate-900/70 p-4"><p className="text-xs tracking-widest text-slate-400">PLANT DEMAND</p><strong className="mt-2 block text-4xl text-cyan-200">{plantDemand.toFixed(0)} <small className="text-base">MW</small></strong><p className="mt-2 text-xs text-slate-400">Assigned: {assignedTotal.toFixed(0)} MW</p></article>
        <article className="rounded-xl border border-emerald-400/30 bg-slate-900/70 p-4"><p className="text-xs tracking-widest text-slate-400">COMBINED OUTPUT</p><strong className="mt-2 block text-4xl text-emerald-200">{totalOutput.toFixed(1)} <small className="text-base">MW</small></strong><p className={`mt-2 text-xs ${Math.abs(plantDifference) <= 10 ? "text-emerald-300" : "text-amber-300"}`}>{plantDifference >= 0 ? "+" : ""}{plantDifference.toFixed(1)} MW vs plant demand</p></article>
        <article className="rounded-xl border border-amber-400/30 bg-slate-900/70 p-4"><p className="text-xs tracking-widest text-slate-400">UNIT INTERLOCK</p><strong className={`mt-2 block text-xl ${snapshot.room?.interlock_enabled ? "text-emerald-300" : "text-slate-400"}`}>{snapshot.room?.interlock_enabled ? `ENABLED · U${snapshot.room.interlock_source_unit} → U${snapshot.room.interlock_target_unit}` : "INDEPENDENT"}</strong><p className="mt-2 text-xs text-slate-400">Feeds the target's Bus A from a powered source Bus A and blocks its startup transformer.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void updatePlantDispatch(roomCode, { interlock_enabled: !snapshot.room?.interlock_enabled })}>{snapshot.room?.interlock_enabled ? "DISABLE" : "ENABLE"}</Button><Button variant="outline" onClick={() => void updatePlantDispatch(roomCode, { interlock_source_unit: 1, interlock_target_unit: 2 })}>U1 → U2</Button><Button variant="outline" onClick={() => void updatePlantDispatch(roomCode, { interlock_source_unit: 2, interlock_target_unit: 1 })}>U2 → U1</Button></div></article>
      </section>
      <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"><div className="mb-4 flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-violet-300"/><h2 className="font-black">Demand manager</h2></div><p className={`mb-4 text-sm ${demandPlanningOpen ? "text-emerald-300" : "text-slate-400"}`}>CURRENT SITE DEMAND: {plantDemand.toFixed(0)} MW · NEXT: {nextDemand.toFixed(0)} MW IN {secondsToDemand}s · {demandPlanningOpen ? "DISTRIBUTION WINDOW OPEN" : "Distribution opens at T−200 and closes at T−60."}</p><div className="grid gap-4 md:grid-cols-3"><label>Required dispatch total MW<input type="number" value={dispatchTarget} disabled className="mt-2 block w-full rounded bg-slate-950 p-2 text-slate-400" /></label>{([1, 2] as const).map(unit => <label key={unit}>Unit {unit} demand MW<input type="number" min="0" max="1200" disabled={!demandPlanningOpen} value={unitDemand[unit]} onChange={event => { dispatchDirty.current = true; setUnitDemand(current => ({ ...current, [unit]: Number(event.target.value) || 0 })); }} className="mt-2 block w-full rounded bg-slate-950 p-2 disabled:cursor-not-allowed disabled:text-slate-500" /></label>)}</div><p className={`mt-3 text-xs ${Math.abs(assignedTotal - dispatchTarget) <= .01 ? "text-emerald-300" : "text-amber-300"}`}>ASSIGNED: {assignedTotal.toFixed(0)} / {dispatchTarget.toFixed(0)} MW {Math.abs(assignedTotal - dispatchTarget) <= .01 ? "· COMPLETE" : "· NO DEMAND MAY BE LEFT UNASSIGNED"}</p><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" disabled={!demandPlanningOpen} onClick={balance}>SPLIT EVENLY</Button><Button className="bg-violet-500 text-slate-950 hover:bg-violet-400" disabled={!demandPlanningOpen} onClick={() => void applyDispatch()}>APPLY DISPATCH</Button></div></section>
      <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"><div className="mb-4 flex items-center gap-2"><Link2 className="h-5 w-5 text-cyan-300"/><h2 className="font-black">Unit station invites</h2></div><div className="grid gap-3 md:grid-cols-2">{([1, 2] as const).map(unit => { const row = unitState(snapshot, unit); const invite = createInvite(unit); return <article key={unit} className="rounded border border-slate-700 bg-slate-950 p-3"><div className="flex items-center justify-between"><strong>UNIT {unit}</strong><span className={row?.offsite_available === false ? "text-red-300" : "text-emerald-300"}>{row?.offsite_available === false ? "OFFSITE LOST" : "AVAILABLE"}</span></div><p className="mt-2 text-sm text-slate-300">{Number(row?.output_mw || 0).toFixed(1)} MW output · {Number(row?.assigned_demand_mw || 0).toFixed(0)} MW assigned</p><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => void copy(invite)}><Copy className="mr-2 h-4 w-4"/>COPY INVITE</Button><Button className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => window.open(invite, "_blank", "noopener,noreferrer")}>OPEN UNIT {unit}</Button></div></article>; })}</div></section>
    </section>
  </main>;
}
