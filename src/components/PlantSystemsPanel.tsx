import { Activity, Fan, RadioTower, Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { MaintainedSwitch, SpringLever } from "@/components/HardwareControls";

export type ProcessPanel = "condenser" | "feedwater" | "mcc" | "rps";

interface Props {
  panel: ProcessPanel;
  condenserVacuum: number; condenserPumpOn: boolean; condenserPumpB: boolean; condenserValve: number; condenserValveDirection?: number; condenserCirculationPumpOn?: boolean; condenserCirculationPumpB?: boolean; onCondenserCirculationPumpBChange?: (v: boolean) => void; condenserAuto?: boolean; onCondenserAutoChange?: (v: boolean) => void; onCondenserCirculationPumpChange?: (v: boolean) => void; busBAvailable: boolean; sjaeOn: boolean; carAOn?: boolean; carBOn?: boolean;
  deaeratorLevel: number; feedwaterDemand: number; feedwaterPumpBFlow?: number; pump1Online?: boolean; pump2Online?: boolean; mccLevel: number; mccPumpOn: boolean; mccAutoOn?: boolean; simpleMode?: boolean;
  rpsTrips: Record<string, boolean>; reactorLevel: number; hotwellLevel: number; condensateFlow: number; condensatePumpBFlow?: number; hotwellOutflowKgS?: number; daOutflowKgS?: number; steamFlow: number;
  onCondenserPumpChange: (v: boolean) => void; onCondenserPumpBChange: (v: boolean) => void; onCondenserValveChange: (v: number) => void; onCondenserValveDirectionChange?: (v: number) => void; onSjaeChange: (v: boolean) => void; onCarAChange?: (v: boolean) => void; onCarBChange?: (v: boolean) => void;
  onFeedwaterDemandChange: (v: number) => void; onFeedwaterPumpBFlowChange?: (v: number) => void; onPump1Change?: (v: boolean) => void; onPump2Change?: (v: boolean) => void; onCondensateFlowChange: (v: number) => void; onCondensatePumpBFlowChange?: (v: number) => void; onMccPumpChange: (v: boolean) => void; onMccAutoChange?: (v: boolean) => void; onManualTrip: () => void; onResetTrips: () => void;
}

const Meter = ({ label, value, suffix = "%" }: { label: string; value: number; suffix?: string }) => <div><div className="mb-1 flex justify-between text-sm"><span className="text-slate-400">{label}</span><strong>{value.toFixed(1)}{suffix}</strong></div><Progress value={Math.max(0, Math.min(value, 100))} className="bg-slate-700"/></div>;
const FlowMeter = ({ label, value }: { label: string; value: number }) => <div className="rounded border border-cyan-500/20 bg-slate-950/60 p-3"><div className="mb-2 flex justify-between text-xs tracking-wide text-slate-300"><span>{label}</span><strong className="text-cyan-300">{value.toFixed(0)} kg/s</strong></div><Progress value={Math.min(100, value / 10)} className="h-2 bg-slate-700"/></div>;

export const PlantSystemsPanel = (p: Props) => {
  const hotwellOutflow = p.hotwellOutflowKgS ?? p.condensateFlow * 10;
  const daOutflow = p.daOutflowKgS ?? p.feedwaterDemand * 20;
  const busBNote = p.busBAvailable ? undefined : "Bus B must be energized and synchronized.";

  if (p.panel === "condenser") return <div className="grid gap-6 lg:grid-cols-2">
    <Card className="border-sky-500/30 bg-slate-900/60"><CardHeader><CardTitle className="flex gap-2 text-sky-300"><Fan/>Condenser controls</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="rounded-xl border border-sky-500/20 bg-slate-950/50 p-5 text-center"><div className="text-xs tracking-widest text-slate-400">CONDENSER VACUUM</div><div className="mt-2 text-5xl font-bold text-sky-300">{Math.round(p.condenserVacuum * 1000)} <span className="text-lg">mbar</span></div></div>
      <div className="grid grid-cols-2 gap-4"><MaintainedSwitch label="CONDENSER CIRCULATION A" on={p.condenserCirculationPumpOn ?? false} onChange={value => p.onCondenserCirculationPumpChange?.(value)}/><MaintainedSwitch label="CONDENSER CIRCULATION B" on={p.condenserCirculationPumpB ?? false} disabled={!p.busBAvailable} onChange={value => p.onCondenserCirculationPumpBChange?.(value)}/><MaintainedSwitch label="CONDENSER AUTO" on={p.condenserAuto ?? false} onChange={value => p.onCondenserAutoChange?.(value)}/></div>
      <div className="grid grid-cols-2 gap-4"><MaintainedSwitch label="CAR A" on={p.carAOn ?? false} disabled={p.condenserVacuum <= .85} onChange={value => p.onCarAChange?.(value)}/><MaintainedSwitch label="CAR B" on={p.carBOn ?? false} disabled={p.condenserVacuum <= .85} onChange={value => p.onCarBChange?.(value)}/></div>
      <MaintainedSwitch label="STEAM JET AIR EJECTOR" on={p.sjaeOn} onChange={p.onSjaeChange}/>
      <div><div className="mb-2 text-center font-bold">CONDENSER VACUUM VALVE {p.condenserValve}%</div><SpringLever label="CONDENSER VACUUM CONTROL" negativeLabel="CLOSE" positiveLabel="OPEN" direction={p.condenserValveDirection ?? 0} onDirectionChange={value => p.onCondenserValveDirectionChange?.(value)}/></div>
    </CardContent></Card>
    <Card className="border-slate-700 bg-slate-900/60"><CardHeader><CardTitle>Condenser status</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex justify-between"><span>Pump B supply</span><Badge className={p.busBAvailable ? "bg-emerald-700" : "bg-red-700"}>{p.busBAvailable ? "BUS B AVAILABLE" : "NO BUS B"}</Badge></div><p className="rounded border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">Normal condenser vacuum is 40–70 mbar. Steam flow and circulating-water capacity determine the vacuum; valve authority is damped near the normal band to prevent hunting.</p></CardContent></Card>
  </div>;

  if (p.panel === "feedwater") return <Card className="border-amber-500/30 bg-slate-900/60"><CardHeader><CardTitle className="flex gap-2 text-amber-300"><Waves/>Deaerator / feedwater</CardTitle></CardHeader><CardContent className="space-y-5"><Meter label="DA level" value={5 + p.deaeratorLevel} suffix=" m"/><FlowMeter label="DA OUTFLOW TO REACTOR" value={daOutflow}/></CardContent></Card>;

  if (p.panel === "mcc") return <div className="grid gap-6 lg:grid-cols-2">
    <Card className="border-blue-500/30 bg-slate-900/60"><CardHeader><CardTitle className="flex gap-2 text-blue-300"><Activity/>MCC water inventory</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="grid grid-cols-3 gap-3">{[["REACTOR", p.reactorLevel], ["HOTWELL", p.hotwellLevel], ["DA", p.deaeratorLevel]].map(([label, level]) => <div key={label as string} className="rounded border border-slate-700 bg-slate-950/60 p-3 text-center"><div className="mx-auto mb-2 flex h-28 w-8 items-end overflow-hidden rounded border border-slate-500"><div className="w-full bg-cyan-400" style={{ height: `${Math.max(0, Math.min(100, 50 + Number(level) * 10))}%` }}/></div><small>{label as string}</small><strong className="block">{Number(level).toFixed(2)} m</strong></div>)}</div>
      <div className="grid grid-cols-2 gap-4"><MaintainedSwitch label="MCC CIRCULATION PUMP" on={p.mccPumpOn} onChange={p.onMccPumpChange}/><MaintainedSwitch label="MCC AUTO" on={p.mccAutoOn ?? false} onChange={value => p.onMccAutoChange?.(value)}/></div>
      <div className="rounded border border-cyan-500/20 bg-slate-950/45 p-3"><div className="mb-3 text-xs font-bold tracking-wider text-cyan-300">PUMP BREAKERS</div><div className="grid gap-3 sm:grid-cols-2"><MaintainedSwitch label="CONDENSATE PUMP A" on={p.condenserPumpOn} onChange={p.onCondenserPumpChange}/><MaintainedSwitch label="CONDENSATE PUMP B" on={p.condenserPumpB} disabled={!p.busBAvailable} onChange={p.onCondenserPumpBChange}/><MaintainedSwitch label="FEEDWATER PUMP A" on={p.pump1Online ?? false} onChange={value => p.onPump1Change?.(value)}/><MaintainedSwitch label="FEEDWATER PUMP B" on={p.pump2Online ?? false} disabled={!p.busBAvailable} onChange={value => p.onPump2Change?.(value)}/></div>{busBNote && <p className="mt-3 text-xs text-amber-300">{busBNote}</p>}</div>
      <p className="text-xs text-slate-400">AUTO trims actual condensate and feedwater pump commands to match steam flow and restore vessel levels.</p>
    </CardContent></Card>
    <Card className="border-slate-700 bg-slate-900/60"><CardHeader><CardTitle>Mass-flow balance</CardTitle></CardHeader><CardContent className="space-y-4">
      <FlowMeter label="TOTAL STEAM FLOW" value={p.steamFlow}/><FlowMeter label="HOTWELL OUTFLOW" value={hotwellOutflow}/><FlowMeter label={p.simpleMode ? "FEEDWATER OUTFLOW" : "DEAERATOR OUTFLOW"} value={daOutflow}/>
      <div className="rounded border border-slate-700 p-3"><div className="mb-2 flex justify-between"><span>CONDENSATE PUMP A</span><strong>{p.condensateFlow.toFixed(1)}% / {(p.condensateFlow * 20).toFixed(0)} kg/s</strong></div><Slider value={[p.condensateFlow]} max={100} step={0.1} disabled={!p.condenserPumpOn} onValueChange={v => p.onCondensateFlowChange(v[0])}/><div className="mt-3 flex justify-between"><span>CONDENSATE PUMP B</span><strong>{(p.condensatePumpBFlow ?? 0).toFixed(1)}% / {((p.condensatePumpBFlow ?? 0) * 20).toFixed(0)} kg/s</strong></div><Slider value={[p.condensatePumpBFlow ?? 0]} max={100} step={0.1} disabled={!p.busBAvailable || !p.condenserPumpB} onValueChange={v => p.onCondensatePumpBFlowChange?.(v[0])}/></div>
      <div className="rounded border border-slate-700 p-3"><div className="mb-2 flex justify-between"><span>FEEDWATER PUMP A</span><strong>{p.feedwaterDemand.toFixed(1)}% / {(p.feedwaterDemand * 20).toFixed(0)} kg/s</strong></div><Slider value={[p.feedwaterDemand]} max={100} step={0.1} disabled={!p.pump1Online} onValueChange={v => p.onFeedwaterDemandChange(v[0])}/><div className="mt-3 flex justify-between"><span>FEEDWATER PUMP B</span><strong>{(p.feedwaterPumpBFlow ?? 0).toFixed(1)}% / {((p.feedwaterPumpBFlow ?? 0) * 20).toFixed(0)} kg/s</strong></div><Slider value={[p.feedwaterPumpBFlow ?? 0]} max={100} step={0.1} disabled={!p.busBAvailable || !p.pump2Online} onValueChange={v => p.onFeedwaterPumpBFlowChange?.(v[0])}/></div>
      <p className="text-xs text-slate-400">Feedwater and condensate pumps each supply up to 2,000 kg/s at 100.0%. {p.simpleMode ? "This early training lesson routes condensate directly to the reactor feedwater train." : "Guide equations: ΔH = TF − HF, ΔD = HF − DF, ΔR = DF − TF."}</p>
    </CardContent></Card>
  </div>;

  return <Card className="border-red-500/30 bg-slate-900/60"><CardHeader><CardTitle className="flex gap-2 text-red-300"><RadioTower/>Reactor Protection System</CardTitle></CardHeader><CardContent><div className="grid gap-2 md:grid-cols-2">{Object.entries(p.rpsTrips).map(([name, trip]) => <div key={name} className="flex justify-between rounded bg-slate-950 p-3"><span>{name}</span><strong className={trip ? "text-red-400" : "text-emerald-400"}>{trip ? "TRIP" : "CLEAR"}</strong></div>)}</div><div className="mt-4 flex gap-3"><Button onClick={p.onManualTrip}>MANUAL TRIP</Button><Button variant="outline" onClick={p.onResetTrips}>RESET NODES</Button></div></CardContent></Card>;
};
