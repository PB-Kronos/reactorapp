import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, ArrowDown, ArrowUp, BellRing, RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReactorStatusPanel } from "@/components/ReactorStatusPanel";
import { ControlRodsPanel } from "@/components/ControlRodsPanel";
import { StartupShutdownPanel } from "@/components/StartupShutdownPanel";
import { PowerCoolantPanel } from "@/components/PowerCoolantPanel";
import { PowerGridPanel } from "@/components/PowerGridPanel";
import { PlantSystemsPanel, ProcessPanel } from "@/components/PlantSystemsPanel";
import { useReactorPhysics } from "@/hooks/useReactorPhysics";
import { useValueControl } from "@/hooks/useValueControl";
import { calculateTurbineData } from "@/hooks/useTurbineControl";

type Panel = "status" | "control-rods" | "startup-shutdown" | "power-coolant" | "power-grid" | ProcessPanel;
const STORAGE_KEY = "rbwr-simulator-state-v3";
const panels: Panel[] = ["status", "startup-shutdown", "control-rods", "power-coolant", "mcc", "feedwater", "condenser", "power-grid", "rps"];
const panelNames: Record<Panel, string> = { status: "Overview", "control-rods": "Control rods", "startup-shutdown": "Reactor", "power-coolant": "CRD cooling", mcc: "MCC / ECCS", feedwater: "DA / feedwater", condenser: "Condenser / SJAE", "power-grid": "Turbine / grid", rps: "RPS" };
const emptyTrips = { "REACTOR LEVEL": false, "MANUAL TRIP": false, "LOOP TRIP": false, "CORE TEMPERATURE": false, "RPV PRESSURE": false, "CONDENSER VACUUM": false, "DA LEVEL": false };

const ReactorSimulator = () => {
  const [activePanel, setActivePanel] = useState<Panel>("status");
  const [temperature, setTemperature] = useState(25);
  const [pressure, setPressure] = useState(1);
  const [fuelLevel, setFuelLevel] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [gridSync, setGridSync] = useState(0);
  const [turbineSpeed, setTurbineSpeed] = useState(0);
  const [targetTurbineSpeed, setTargetTurbineSpeed] = useState(0);
  const [coolantFlow, setCoolantFlow] = useState(50);
  const [coolantPumpOn, setCoolantPumpOn] = useState(false);
  const [rodPercentage, setRodPercentage] = useState(100);
  const [pump1Online, setPump1Online] = useState(false);
  const [pump2Online, setPump2Online] = useState(false);
  const [valveValue, setValveValue] = useState(0);
  const [scramPressed, setScramPressed] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [valveDirection, setValveDirection] = useState(0);
  const [rodDirection, setRodDirection] = useState(0);
  const [lastEvent, setLastEvent] = useState("System initialized — reactor in cold shutdown.");
  const [condenserVacuum, setCondenserVacuum] = useState(0);
  const [condenserPumpOn, setCondenserPumpOn] = useState(false);
  const [sjaeOn, setSjaeOn] = useState(false);
  const [deaeratorLevel, setDeaeratorLevel] = useState(75);
  const [feedwaterDemand, setFeedwaterDemand] = useState(35);
  const [mccLevel, setMccLevel] = useState(100);
  const [mccPumpOn, setMccPumpOn] = useState(false);
  const [rpsTrips, setRpsTrips] = useState<Record<string, boolean>>(emptyTrips);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const state = JSON.parse(saved);
      setTemperature(state.temperature ?? 25); setPressure(state.pressure ?? 1); setFuelLevel(state.fuelLevel ?? 100);
      setCoolantFlow(state.coolantFlow ?? 50); setRodPercentage(state.rodPercentage ?? 100); setValveValue(state.valveValue ?? 0);
      setPump1Online(Boolean(state.pump1Online)); setPump2Online(Boolean(state.pump2Online)); setCoolantPumpOn(Boolean(state.coolantPumpOn));
      setCondenserVacuum(state.condenserVacuum ?? 0); setCondenserPumpOn(Boolean(state.condenserPumpOn)); setSjaeOn(Boolean(state.sjaeOn));
      setDeaeratorLevel(state.deaeratorLevel ?? 75); setFeedwaterDemand(state.feedwaterDemand ?? 35); setMccLevel(state.mccLevel ?? 100); setMccPumpOn(Boolean(state.mccPumpOn));
      setLastEvent("Previous control-room configuration restored.");
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ temperature, pressure, fuelLevel, coolantFlow, rodPercentage, valveValue, pump1Online, pump2Online, coolantPumpOn, condenserVacuum, condenserPumpOn, sjaeOn, deaeratorLevel, feedwaterDemand, mccLevel, mccPumpOn }));
  }, [temperature, pressure, fuelLevel, coolantFlow, rodPercentage, valveValue, pump1Online, pump2Online, coolantPumpOn, condenserVacuum, condenserPumpOn, sjaeOn, deaeratorLevel, feedwaterDemand, mccLevel, mccPumpOn]);

  useEffect(() => {
    const clock = window.setInterval(() => {
      const vacuumTarget = (condenserPumpOn ? 55 : 0) + (sjaeOn ? 42 : 0);
      setCondenserVacuum(previous => Math.max(0, Math.min(99, previous + (vacuumTarget - previous) * 0.12)));
      setDeaeratorLevel(previous => Math.max(0, Math.min(100, previous + ((pump1Online || pump2Online) ? 0.35 : 0) - (isRunning ? feedwaterDemand * 0.012 : 0))));
      setMccLevel(previous => Math.max(0, previous - (isRunning && mccPumpOn ? 0.08 : 0)));
    }, 1000);
    return () => window.clearInterval(clock);
  }, [condenserPumpOn, sjaeOn, pump1Online, pump2Online, isRunning, feedwaterDemand, mccPumpOn]);

  useEffect(() => {
    const active = {
      "REACTOR LEVEL": deaeratorLevel < 10,
      "MANUAL TRIP": false,
      "LOOP TRIP": mccLevel < 15 || (temperature > 800 && !mccPumpOn),
      "CORE TEMPERATURE": temperature >= 900,
      "RPV PRESSURE": pressure >= 30,
      "CONDENSER VACUUM": isRunning && valveValue > 15 && condenserVacuum < 55,
      "DA LEVEL": deaeratorLevel < 10,
    };
    if (Object.values(active).some(Boolean)) {
      setRpsTrips(previous => Object.fromEntries(Object.keys(previous).map(key => [key, previous[key] || active[key]])));
      if (isRunning) scram(true);
    }
  }, [temperature, pressure, condenserVacuum, deaeratorLevel, mccLevel, mccPumpOn, isRunning, valveValue]);

  const scram = (automatic = false) => {
    setIsRunning(false); setIsLocked(false); setTargetTurbineSpeed(0); setValveDirection(0); setRodDirection(0);
    setRodPercentage(100); setValveValue(0); setScramPressed(true); setGridSync(0);
    setLastEvent(automatic ? "AUTOMATIC SCRAM — unsafe core condition detected." : "Manual SCRAM completed — rods fully inserted.");
  };
  const manualTrip = () => { setRpsTrips(previous => ({ ...previous, "MANUAL TRIP": true })); scram(); };

  useReactorPhysics({ isRunning, temperature, valveValue, rodPercentage, pump1Online, pump2Online, coolantPumpOn, coolantFlow, isLocked, targetTurbineSpeed, onTemperatureChange: setTemperature, onPressureChange: setPressure, onFuelLevelChange: setFuelLevel, onGridSyncChange: setGridSync, onTurbineSpeedChange: setTurbineSpeed, onAutomaticScram: () => scram(true) });
  useValueControl({ initialValue: valveValue, onChange: setValveValue, direction: valveDirection, incrementPerSecond: 3 });
  useValueControl({ initialValue: rodPercentage, onChange: setRodPercentage, direction: rodDirection, incrementPerSecond: 12 });

  useEffect(() => { if (isRunning && !isLocked) setTargetTurbineSpeed(valveValue); }, [valveValue, isRunning, isLocked]);

  const { actualRPM, targetRPM, isSynchronized } = calculateTurbineData(turbineSpeed, targetTurbineSpeed, isLocked);
  const alarms = useMemo(() => [
    temperature > 900 && { label: "CORE TEMPERATURE HIGH", level: "red" },
    pressure > 25 && { label: "REACTOR PRESSURE HIGH", level: "amber" },
    isRunning && !coolantPumpOn && !pump1Online && !pump2Online && { label: "NO ACTIVE COOLING", level: "red" },
    fuelLevel < 15 && { label: "FUEL RESERVE LOW", level: "amber" },
    Object.values(rpsTrips).some(Boolean) && { label: "RPS TRIP NODE LATCHED", level: "red" },
  ].filter(Boolean) as { label: string; level: string }[], [temperature, pressure, isRunning, coolantPumpOn, pump1Online, pump2Online, fuelLevel, rpsTrips]);
  const turbineOutputMW = isRunning ? Math.max(0, valveValue * 1.8 * ((100 - rodPercentage) / 100) * Math.max(0.2, condenserVacuum / 97)) : 0;
  const status = alarms.some(alarm => alarm.level === "red") ? "ALARM" : isRunning ? "OPERATIONAL" : scramPressed ? "SCRAMMED" : "STANDBY";

  const startReactor = () => {
    if (Object.values(rpsTrips).some(Boolean)) { setLastEvent("START INHIBITED — reset active RPS trip nodes first."); return; }
    if (fuelLevel <= 0) { setLastEvent("START INHIBITED — fuel reserve depleted."); return; }
    setScramPressed(false); setIsRunning(true); setTargetTurbineSpeed(valveValue); setLastEvent("Reactor criticality sequence started.");
  };
  const stopReactor = () => { setIsRunning(false); setIsLocked(false); setTargetTurbineSpeed(0); setLastEvent("Normal reactor shutdown initiated."); };
  const resetSimulation = () => { localStorage.removeItem(STORAGE_KEY); setTemperature(25); setPressure(1); setFuelLevel(100); setIsRunning(false); setGridSync(0); setTurbineSpeed(0); setTargetTurbineSpeed(0); setCoolantFlow(50); setCoolantPumpOn(false); setRodPercentage(100); setPump1Online(false); setPump2Online(false); setValveValue(0); setScramPressed(false); setIsLocked(false); setCondenserVacuum(0); setCondenserPumpOn(false); setSjaeOn(false); setDeaeratorLevel(75); setFeedwaterDemand(35); setMccLevel(100); setMccPumpOn(false); setRpsTrips(emptyTrips); setLastEvent("Simulator reset to cold shutdown."); };
  const resetTrips = () => {
    const unsafe = temperature >= 900 || pressure >= 30 || deaeratorLevel < 10 || mccLevel < 15 || (isRunning && condenserVacuum < 55);
    if (unsafe) { setLastEvent("RPS RESET REJECTED — one or more live trip conditions remain unsafe."); return; }
    setRpsTrips(emptyTrips); setScramPressed(false); setLastEvent("RPS reset accepted — all trip nodes clear.");
  };
  const movePanel = (amount: number) => setActivePanel(panels[(panels.indexOf(activePanel) + amount + panels.length) % panels.length]);

  return <div className="min-h-screen bg-[#07111d] text-slate-100 selection:bg-cyan-300/30">
    <div className="fixed inset-0 pointer-events-none opacity-20 [background-image:linear-gradient(rgba(34,211,238,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.08)_1px,transparent_1px)] [background-size:36px_36px]" />
    <main className="relative mx-auto max-w-7xl p-4 md:p-7">
      <header className="mb-5 flex flex-col gap-4 border-b border-cyan-500/20 pb-5 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-bold tracking-[.3em] text-cyan-400">RBWR // WEB SIMULATOR</p><h1 className="mt-1 text-2xl font-bold tracking-tight md:text-4xl">Boiling Water Reactor Control Room</h1><p className="mt-1 text-sm text-slate-400">Game-inspired simulation · training interface</p></div>
        <div className="flex items-center gap-2"><Badge className={status === "ALARM" ? "bg-red-600" : status === "OPERATIONAL" ? "bg-emerald-600" : "bg-slate-600"}>{status}</Badge><Button variant="outline" size="sm" onClick={resetSimulation} className="border-slate-600 bg-slate-900/60"><RotateCcw size={15} className="mr-2" />Reset</Button></div>
      </header>
      <section className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${alarms.length ? "border-red-500/50 bg-red-950/40 text-red-200" : "border-cyan-500/20 bg-slate-900/70 text-slate-300"}`}><BellRing size={18} className={alarms.length ? "text-red-400" : "text-cyan-400"}/><span>{alarms.length ? alarms.map(a => a.label).join(" · ") : lastEvent}</span></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" className="border-slate-600 bg-slate-900/70" onClick={() => setActivePanel("startup-shutdown")}>Controls</Button><Button size="sm" onClick={manualTrip} className="bg-red-700 hover:bg-red-600"><ShieldAlert size={15} className="mr-2"/>SCRAM</Button></div>
      </section>
      <nav className="mb-5 flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/80 p-2">{panels.map(panel => <Button key={panel} variant={activePanel === panel ? "default" : "ghost"} size="sm" onClick={() => setActivePanel(panel)} className={activePanel === panel ? "bg-cyan-600 hover:bg-cyan-500 whitespace-nowrap" : "text-slate-300 whitespace-nowrap"}>{panelNames[panel]}</Button>)}</nav>
      <div className="rounded-2xl border border-slate-700 bg-slate-900/75 p-4 shadow-2xl shadow-cyan-950/20 md:p-6">
        {activePanel === "status" && <ReactorStatusPanel temperature={temperature} pressure={pressure} fuelLevel={fuelLevel} gridSync={gridSync} turbineOutputMW={turbineOutputMW} valveValue={valveValue} isRunning={isRunning} getStatusColor={() => status === "ALARM" ? "destructive" : "default"} getStatusText={() => status} />}
        {activePanel === "control-rods" && <ControlRodsPanel rodPercentage={rodPercentage} rodDirection={rodDirection} onRodPress={setRodDirection} onRodNeutral={() => setRodDirection(0)} />}
        {activePanel === "startup-shutdown" && <StartupShutdownPanel isRunning={isRunning} temperature={temperature} scramPressed={scramPressed} onStartReactor={startReactor} onStopReactor={stopReactor} onEmergencyShutdown={manualTrip} />}
        {activePanel === "power-coolant" && <PowerCoolantPanel pump1Online={pump1Online} pump2Online={pump2Online} coolantPumpOn={coolantPumpOn} coolantFlow={coolantFlow} pressure={pressure} onPump1Change={setPump1Online} onPump2Change={setPump2Online} onCoolantPumpChange={setCoolantPumpOn} onCoolantFlowChange={setCoolantFlow} />}
        {activePanel === "power-grid" && <PowerGridPanel actualRPM={actualRPM} targetRPM={targetRPM} isSynchronized={isSynchronized} isLocked={isLocked} valveValue={valveValue} valveDirection={valveDirection} turbineOutputMW={turbineOutputMW} turbineSpeed={turbineSpeed} onValvePress={setValveDirection} onPausePress={() => setValveDirection(0)} onSyncPress={() => { if (isSynchronized) { setIsLocked(!isLocked); setLastEvent(isLocked ? "Generator breaker opened." : "Generator synchronized to grid."); } }} />}
        {["condenser", "feedwater", "mcc", "rps"].includes(activePanel) && <PlantSystemsPanel panel={activePanel as ProcessPanel} condenserVacuum={condenserVacuum} condenserPumpOn={condenserPumpOn} sjaeOn={sjaeOn} deaeratorLevel={deaeratorLevel} feedwaterDemand={feedwaterDemand} mccLevel={mccLevel} mccPumpOn={mccPumpOn} rpsTrips={rpsTrips} onCondenserPumpChange={setCondenserPumpOn} onSjaeChange={setSjaeOn} onFeedwaterDemandChange={setFeedwaterDemand} onMccPumpChange={setMccPumpOn} onManualTrip={manualTrip} onResetTrips={resetTrips} />}
      </div>
      <div className="mt-5 flex items-center justify-between text-xs text-slate-500"><span><Activity className="mr-1 inline h-3 w-3 text-emerald-400"/>Simulation clock: 4 Hz</span><div className="flex gap-3"><button onClick={() => movePanel(-1)} aria-label="Previous panel"><ArrowLeft size={17}/></button><button onClick={() => movePanel(1)} aria-label="Next panel"><ArrowRight size={17}/></button><ArrowUp size={17}/><ArrowDown size={17}/></div></div>
    </main>
  </div>;
};

export default ReactorSimulator;
