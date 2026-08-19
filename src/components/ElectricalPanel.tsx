import { Cable } from "lucide-react";
import type { ReactNode } from "react";
import { MaintainedSwitch } from "@/components/HardwareControls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ElectricalMachine = { name: string; commanded: boolean; powered: boolean; demand: number };
interface Props {
  startupBusA: boolean; busATransformer: boolean; turbineBusB: boolean; safetyBusS: boolean; edgBreaker: boolean;
  acDcInterlock: boolean; safetyToDcBreaker: boolean; busEToDcBreaker: boolean; busEAvailable: boolean; dcBusAvailable: boolean;
  mainBatteryCharge: number; batteryCharging: boolean;
  rolldownProtection: boolean; turbineOnline: boolean; turbineBusEligible: boolean; startupLoad?: number; busBLoad?: number; safetyLoad?: number;
  sharedTurbineCapacityActive?: boolean; sharedTurbineLoad?: number;
  startupMachines?: ElectricalMachine[]; busBMachines?: ElectricalMachine[]; safetyMachines?: ElectricalMachine[];
  onStartupBusAChange: (value: boolean) => void; onBusATransformerChange: (value: boolean) => void; onTurbineBusBChange: (value: boolean) => void;
  onSafetyBusSChange: (value: boolean) => void; onEdgBreakerChange: (value: boolean) => void; onAcDcInterlockChange: (value: boolean) => void;
  onSafetyToDcBreakerChange: (value: boolean) => void; onBusEToDcBreakerChange: (value: boolean) => void; onRolldownProtectionChange: (value: boolean) => void;
}
type Tone = "amber" | "green" | "blue" | "red" | "white";
const nodeStyle: Record<Tone, string> = { amber: "border-amber-400 bg-amber-950/70 text-amber-100", green: "border-emerald-400 bg-emerald-950/70 text-emerald-100", blue: "border-sky-400 bg-sky-950/70 text-sky-100", red: "border-red-400 bg-red-950/70 text-red-100", white: "border-slate-200 bg-slate-950/80 text-slate-100" };
const wire: Record<Tone, string> = { amber: "text-amber-300", green: "text-emerald-300", blue: "text-sky-300", red: "text-red-300", white: "text-slate-100" };
const Node = ({ label, active, tone = "amber", compact = false }: { label: string; active: boolean; tone?: Tone; compact?: boolean }) => <div className={`${compact ? "min-w-20 px-2 py-1" : "min-w-28 px-3 py-2"} rounded border text-center text-[10px] font-bold shadow ${active ? nodeStyle[tone] : "border-slate-700 bg-slate-950/80 text-slate-500"}`} style={active && tone === "white" ? { color: "#f8fafc" } : undefined}><i className={`mr-1 inline-block h-2 w-2 rounded-full ${active ? "bg-emerald-400" : "bg-red-500"}`} />{label}</div>;
const R = ({ tone = "amber" }: { tone?: Tone }) => <span className={`font-mono text-lg leading-none ${wire[tone]}`}>━━━━▶</span>;
const L = ({ tone = "amber" }: { tone?: Tone }) => <span className={`font-mono text-lg leading-none ${wire[tone]}`}>◀━━━━</span>;
const ShortL = ({ tone = "amber" }: { tone?: Tone }) => <span className={`font-mono text-sm leading-none ${wire[tone]}`}>◀━━</span>;
const D = ({ tone = "amber" }: { tone?: Tone }) => <span className={`block h-9 text-center font-mono text-lg leading-4 ${wire[tone]}`}>┃<br />▼</span>;
const U = ({ tone = "amber" }: { tone?: Tone }) => <span className={`block h-9 text-center font-mono text-lg leading-4 ${wire[tone]}`}>▲<br />┃</span>;
const Breaker = ({ label, on, onChange }: { label: string; on: boolean; onChange: (value: boolean) => void }) => <div className="min-w-28"><MaintainedSwitch label={label} on={on} onChange={onChange} /></div>;

const MachineBus = ({ label, active, load, limit, machines, children }: { label: string; active: boolean; load: number; limit: number; machines?: ElectricalMachine[]; children?: ReactNode }) => <Card className={active ? "border-emerald-500/40 bg-slate-900/75" : "border-slate-700 bg-slate-900/75"}><CardHeader className="pb-3"><CardTitle className="flex justify-between text-sm"><span>{label}</span><Badge className={active ? "bg-emerald-700" : "bg-slate-700"}>{active ? "ENERGIZED" : "DE-ENERGIZED"}</Badge></CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded bg-slate-950 p-3"><div className="mb-1 flex justify-between text-xs"><span>LIVE LOAD</span><strong>{load.toFixed(1)} / {limit} kW</strong></div><div className="h-2 overflow-hidden rounded bg-slate-800"><div className={load > limit ? "h-full bg-red-500" : "h-full bg-cyan-400"} style={{ width: `${Math.min(100, load / limit * 100)}%` }} /></div></div><div className="rounded border border-slate-700 bg-slate-950/60 p-2">{machines?.map(machine => <div key={machine.name} className="flex items-center justify-between gap-2 py-1 text-xs"><span className="flex items-center gap-2"><i className={`h-2.5 w-2.5 rounded-full ${machine.powered ? "bg-emerald-400" : "bg-red-500"}`} />{machine.name}</span><strong className={machine.powered ? "text-cyan-300" : "text-slate-500"}>{machine.powered ? `${machine.demand.toFixed(1)} kW` : machine.commanded ? "NO POWER" : "OFF"}</strong></div>)}</div>{children}</CardContent></Card>;

export const ElectricalPanel = (p: Props) => {
  const busA = p.startupBusA || (p.busATransformer && p.turbineBusEligible);
  const busB = p.turbineBusB && p.turbineBusEligible;
  const busS = p.safetyBusS && busA;
  const sharedTurbinePool = Boolean(p.sharedTurbineCapacityActive);
  const busACapacity = sharedTurbinePool ? 150 : p.busATransformer && p.turbineBusEligible ? 60 : 38;
  return <div className="space-y-6">
    <Card className="border-cyan-500/40 bg-slate-900/80"><CardHeader><CardTitle className="flex items-center gap-2 text-cyan-100"><Cable />Unit 2 electrical distribution</CardTitle></CardHeader><CardContent>
      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-[#07131a] p-5 md:p-8"><div className="mx-auto min-w-[960px] max-w-[1180px] space-y-5">
        <div className="rounded-lg border border-amber-500/25 bg-amber-950/10 p-5">
          <p className="mb-4 text-center text-xs font-bold tracking-[.22em] text-amber-200">AC SOURCE AND UNIT BUS ROUTING</p>
          <div className="space-y-4 rounded border border-amber-400/50 p-5 text-xs font-bold">
            <div className="flex items-center justify-center gap-3">
              <div className="rounded bg-red-600 px-3 py-2 text-red-950">External switchyard</div><R tone="red" />
              <Breaker label="STARTUP TR. BRK" on={p.startupBusA} onChange={p.onStartupBusAChange} /><R tone="amber" />
              <div className="flex items-center gap-2"><Node label="BUS A" active={busA} compact /><R tone="amber" /><div className="rounded border border-amber-400 bg-amber-950/70 px-2 py-1 text-[10px] font-bold text-amber-100">BUS S FEED</div></div>
            </div>
            <div className="relative -translate-x-10 flex items-center justify-center gap-3">
              <div className="rounded bg-red-700 px-3 py-2 text-red-100">Turbine</div><R tone="red" />
              <Breaker label="BUS A TR. BRK" on={p.busATransformer} onChange={p.onBusATransformerChange} /><U tone="amber" />
              <span className="text-[10px] text-amber-200">TO STARTUP / BUS A</span>
            </div>
            <div className="relative -translate-x-10 flex items-center justify-center gap-3">
              <div className="rounded bg-red-700 px-3 py-2 text-red-100">Turbine</div><R tone="red" />
              <Breaker label="BUS B BRK" on={p.turbineBusB} onChange={p.onTurbineBusBChange} /><R tone="amber" /><Node label="BUS B" active={busB} compact />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center border-t border-amber-500/50 pt-4"><span className="-mt-3"><D tone="amber" /></span><Breaker label="BUS A → BUS S" on={p.safetyBusS} onChange={p.onSafetyBusSChange} /><D tone="green" /><Node label="BUS S 480 VAC" active={busS} tone="green" /></div>
        <div className="relative mx-auto grid w-[82%] grid-cols-3 gap-8 pb-24 pt-7">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]" />
          <div className="flex flex-col items-center gap-2"><D tone="green" /><Breaker label="BUS S → DC" on={p.safetyToDcBreaker} onChange={p.onSafetyToDcBreakerChange} /><D tone="blue" /><Node label="DC BUS 125 VDC" active={p.dcBusAvailable} tone="blue" /></div>
          <div className="flex translate-x-4 flex-col items-center gap-2"><D tone="green" /><Breaker label="AC-DC 1 INTERLOCK" on={p.acDcInterlock} onChange={p.onAcDcInterlockChange} /><D tone="white" /><Node label="BUS E 125 VDC" active={p.busEAvailable} tone="white" /></div>
          <div className="mt-6 flex -translate-x-10 flex-col items-center gap-2"><D tone="green" /><Node label={p.batteryCharging ? "MAIN BATTERY CHARGER — CHARGING" : "MAIN BATTERY CHARGER — OFF"} active={p.batteryCharging} tone="green" /><D tone="white" /><Node label={`MAIN BATTERY ${p.mainBatteryCharge.toFixed(0)}%`} active={p.mainBatteryCharge > .5} tone="white" /><span className={p.batteryCharging ? "text-[10px] font-bold text-emerald-300" : "text-[10px] font-bold text-amber-200"}>{p.batteryCharging ? "CHARGING" : "DISCHARGING"}</span><div className="mt-2 flex items-center gap-2"><L tone="white" /><span className="text-[10px] font-bold text-slate-100">FEED TO BUS E</span></div></div>
          <div className="w-28" style={{ position: "absolute", left: "calc(33.333% - 56px)", top: "145px" }}>
            <span style={{ position: "absolute", left: -18, top: 62 }}><ShortL tone="blue" /></span>
            <Breaker label="BUS E → DC" on={p.busEToDcBreaker} onChange={p.onBusEToDcBreakerChange} />
            <span style={{ position: "absolute", right: -18, top: 62 }}><ShortL tone="blue" /></span>
          </div>
        </div>
      </div></div>
      <p className="mt-4 text-xs text-slate-400">EDG is intentionally excluded. White is the Bus E route and blue is the DC route. Downward flow routes use downward arrowheads.</p>
    </CardContent></Card>
    <section><div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-100">Bus machinery monitors</h2><span className="text-xs text-slate-400">Live LED and kW draw per connected machine</span></div>{sharedTurbinePool && <div className="mb-3 rounded border border-amber-400/50 bg-amber-950/30 px-3 py-2 text-center text-xs font-bold text-amber-100">TURBINE AUXILIARY POOL — BUS A + BUS B SHARE {(p.sharedTurbineLoad ?? 0).toFixed(1)} / 150 kW</div>}<div className="grid gap-5 xl:grid-cols-3"><MachineBus label={sharedTurbinePool ? "BUS A (SHARED)" : "BUS A"} active={busA} load={p.startupLoad ?? 0} limit={busACapacity} machines={p.startupMachines} /><MachineBus label={sharedTurbinePool ? "BUS B (SHARED)" : "BUS B"} active={busB} load={p.busBLoad ?? 0} limit={sharedTurbinePool ? 150 : 60} machines={p.busBMachines} /><MachineBus label="SAFETY BUS S" active={busS} load={p.safetyLoad ?? 0} limit={30} machines={p.safetyMachines} /></div></section>
    <Card className="border-red-500/30 bg-slate-900/70"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div><strong>ROLLDOWN PROTECTION</strong><p className="text-xs text-slate-400">RPS Channel B turbine-trip path.</p></div><MaintainedSwitch label="PROTECTION BREAKER" on={p.rolldownProtection} onChange={p.onRolldownProtectionChange} /></CardContent></Card>
  </div>;
};
