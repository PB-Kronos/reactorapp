import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Synchronoscope } from "./Synchronoscope";
import { MaintainedSwitch, SpringButton, SpringLever } from "@/components/HardwareControls";
import { useState } from "react";

interface Props {
  actualRPM: number; targetRPM: number; isSynchronized: boolean; turbineOutputMW: number; turbineSteamFlow?: number;
  gridBreakerClosed?: boolean; exciterOn?: boolean; mainSteamInletOpen?: boolean;
  mainValve?: number; bypassValve?: number; mainValveDirection?: number; bypassValveDirection?: number;
  pressure?: number; pressureRate?: number;
  turbinePressureAuto?: boolean; onTurbinePressureAutoChange?: (value: boolean) => void;
  turbineRpmAuto?: boolean; onTurbineRpmAutoChange?: (value: boolean) => void;
  onMainSteamInletChange?: (value: boolean) => void; onMainValveDirection?: (value: number) => void;
  onBypassValveDirection?: (value: number) => void; onExciterChange?: (value: boolean) => void;
  onGridBreaker?: () => void; isLocked?: boolean; valveValue?: number; valveDirection?: number;
  onValvePress?: (value: number) => void; onSyncPress?: () => void;
  mcrControlScope?: boolean;
}

export const PowerGridPanel = (input: Props) => {
  const [closeupOpen, setCloseupOpen] = useState(false);
  const p = {
    inletOpen: input.mainSteamInletOpen ?? false, mainValve: input.mainValve ?? input.valveValue ?? 0,
    bypassValve: input.bypassValve ?? 0, mainDirection: input.mainValveDirection ?? input.valveDirection ?? 0,
    bypassDirection: input.bypassValveDirection ?? 0, exciter: input.exciterOn ?? false,
    gridClosed: input.gridBreakerClosed ?? input.isLocked ?? false, pressure: input.pressure ?? 101,
    rate: input.pressureRate ?? 0, inlet: input.onMainSteamInletChange ?? (() => {}),
    main: input.onMainValveDirection ?? input.onValvePress ?? (() => {}),
    bypass: input.onBypassValveDirection ?? (() => {}), exciterChange: input.onExciterChange ?? (() => {}),
    grid: input.onGridBreaker ?? input.onSyncPress ?? (() => {}),
  };
  return <div className="grid gap-6 lg:grid-cols-2">
    <Card className="border-blue-500/30 bg-slate-900/70"><CardHeader><CardTitle className="text-blue-300">Steam / turbine control</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-950 p-3"><small>MAIN STEAM PRESSURE</small><strong className={Math.abs(p.pressure - 7100) < 400 ? "block text-2xl text-emerald-300" : "block text-2xl text-amber-300"}>{p.pressure.toFixed(0)} kPa</strong><span className="text-xs text-slate-400">Nominal 7100 kPa</span></div><div className="rounded-lg bg-slate-950 p-3"><small>PRESSURE RATE</small><strong className={`block text-2xl ${Math.abs(p.rate) > 120 ? "text-red-300" : "text-cyan-300"}`}>{p.rate >= 0 ? "+" : ""}{p.rate.toFixed(0)} kPa/s</strong></div></div>
      <div className="grid grid-cols-3 gap-4"><MaintainedSwitch label="MAIN STEAM INLET" on={p.inletOpen} onChange={p.inlet}/><MaintainedSwitch label="TURBINE RPM AUTO" on={input.turbineRpmAuto ?? false} onChange={value => input.onTurbineRpmAutoChange?.(value)}/><MaintainedSwitch label="TURBINE PRESSURE AUTO" on={input.turbinePressureAuto ?? false} onChange={value => input.onTurbinePressureAutoChange?.(value)}/></div>
      {input.turbineRpmAuto && <p className="rounded border border-cyan-500/30 bg-cyan-950/30 p-2 text-xs text-cyan-100">RPM governor targeting 3000 RPM before synchronization. It holds main-valve motion after the grid breaker closes.</p>}
      <div className="grid gap-4 md:grid-cols-2"><div><div className="mb-2 text-center font-bold">MAIN VALVE {p.mainValve.toFixed(1)}%</div><SpringLever label="MAIN STEAM VALVE" negativeLabel="CLOSE" positiveLabel="OPEN" extended direction={p.mainDirection} onDirectionChange={p.main}/></div><div><div className="mb-2 text-center font-bold">BYPASS VALVE {p.bypassValve.toFixed(1)}%</div><SpringLever label="TURBINE BYPASS" negativeLabel="CLOSE" positiveLabel="OPEN" extended direction={p.bypassDirection} onDirectionChange={p.bypass}/></div></div>
    </CardContent></Card>
    <Card className="border-emerald-500/30 bg-slate-900/70"><CardHeader><CardTitle className="text-emerald-300">Generator / grid</CardTitle></CardHeader><CardContent className="space-y-5"><div className="flex justify-center"><Synchronoscope actualRPM={input.actualRPM} isSynchronized={input.isSynchronized} syncMargin={5} targetRPM={input.targetRPM}/></div><div className="flex justify-center"><Button variant="outline" onClick={() => setCloseupOpen(true)}>OPEN CLOSE-UP SYNCHROSCOPE</Button></div><Dialog open={closeupOpen} onOpenChange={setCloseupOpen}><DialogContent className="max-w-2xl border-cyan-500/40 bg-slate-950 text-slate-100"><DialogHeader><DialogTitle className="text-cyan-300">Generator synchronizing instrument</DialogTitle><DialogDescription className="text-slate-400">Close the grid breaker only as the needle enters the green window and the phase difference approaches 0°.</DialogDescription></DialogHeader><div className="flex justify-center"><Synchronoscope closeup actualRPM={input.actualRPM} isSynchronized={input.isSynchronized} syncMargin={5} targetRPM={input.targetRPM}/></div></DialogContent></Dialog><div className="grid grid-cols-3 gap-3"><div className="rounded bg-slate-950 p-3">RPM<br/><strong>{input.actualRPM.toFixed(0)}</strong></div><div className="rounded bg-slate-950 p-3">TURBINE FLOW<br/><strong>{(input.turbineSteamFlow ?? 0).toFixed(0)} kg/s</strong></div><div className="rounded bg-slate-950 p-3">OUTPUT<br/><strong>{input.turbineOutputMW.toFixed(1)} MW</strong></div></div><p className="text-xs text-slate-400">Shaft speed follows turbine steam flow before synchronizing; the grid holds 3,000 RPM after the breaker closes.</p><div className="grid grid-cols-2 gap-4"><MaintainedSwitch label="EXCITER BREAKER" on={p.exciter} onChange={p.exciterChange}/><div className="flex flex-col items-center"><SpringButton disabled={!p.exciter || !input.isSynchronized} onClick={p.grid} label={p.gridClosed ? "OPEN GRID BREAKER" : "CLOSE GRID BREAKER"}/><span className={p.gridClosed ? "mt-2 text-xs text-emerald-400" : "mt-2 text-xs text-amber-400"}>{p.gridClosed ? "GRID CONNECTED" : "GRID OPEN"}</span></div></div></CardContent></Card>
  </div>;
};
