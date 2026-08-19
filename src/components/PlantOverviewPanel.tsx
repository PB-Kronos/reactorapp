import { Activity, ArrowRight, Droplets, Gauge, ShieldAlert, Thermometer, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type OverviewPanel = "control-rods" | "mcc" | "power-grid" | "electrical" | "rps" | "condenser";

interface PlantOverviewPanelProps {
  aprm: number;
  rodAprm: number;
  recirculationAprm: number;
  reactorPeriod: number;
  averageWithdrawal: number;
  reactorMode: string;
  temperature: number;
  pressure: number;
  steamFlow: number;
  turbineRpm: number;
  turbineOutput: number;
  turbineSynced: boolean;
  mainValve: number;
  bypassValve: number;
  reactorLevel: number;
  hotwellLevel: number;
  deaeratorLevel: number;
  cstLevel: number;
  condenserPressure: number;
  recircAFlow: number;
  recircBFlow: number;
  busAAvailable: boolean;
  busBAvailable: boolean;
  safetyBusAvailable: boolean;
  busEAvailable: boolean;
  dcBusAvailable: boolean;
  rpsTrips: Record<string, boolean>;
  event: string;
  isRunning: boolean;
  onNavigate: (panel: OverviewPanel) => void;
  onInstantStartup: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const fmt = (value: number, digits = 0) => Number.isFinite(value) ? value.toFixed(digits) : "--";

function Signal({ label, active, detail }: { label: string; active: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-700/80 bg-slate-950/45 px-3 py-2">
      <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
        <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,.9)]" : "bg-red-500"}`} />
        {label}
      </span>
      {detail && <span className="text-xs tabular-nums text-slate-400">{detail}</span>}
    </div>
  );
}

function Meter({ label, value, suffix, progress, tone = "cyan" }: { label: string; value: string; suffix: string; progress: number; tone?: "cyan" | "amber" | "emerald" | "violet" }) {
  const tones = {
    cyan: "bg-cyan-400",
    amber: "bg-amber-400",
    emerald: "bg-emerald-400",
    violet: "bg-violet-400",
  };
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/45 p-3">
      <div className="flex items-end justify-between gap-2">
        <span className="text-[11px] font-bold tracking-[.12em] text-slate-400">{label}</span>
        <span className="text-lg font-black tabular-nums text-slate-100">{value}<span className="ml-1 text-xs font-semibold text-slate-400">{suffix}</span></span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full transition-[width] duration-500 ${tones[tone]}`} style={{ width: `${clamp(progress, 0, 100)}%` }} />
      </div>
    </div>
  );
}

export function PlantOverviewPanel(props: PlantOverviewPanelProps) {
  const tripNames = Object.entries(props.rpsTrips).filter(([, active]) => active).map(([name]) => name);
  const operational = props.isRunning && tripNames.length === 0;
  const turbineState = props.turbineSynced ? "GRID SYNC" : props.turbineRpm > 50 ? "RUNNING" : "OFFLINE";
  const periodText = props.reactorPeriod >= 900 ? "STABLE" : `${fmt(props.reactorPeriod, 1)} s`;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-cyan-400/35 bg-gradient-to-r from-cyan-950/55 via-slate-900 to-slate-950 p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-[11px] font-black tracking-[.24em] text-cyan-300">UNIT STATUS BOARD</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-slate-50">{operational ? "Unit operating" : tripNames.length ? "Protection action active" : "Unit standby"}</h2>
              <Badge className={tripNames.length ? "bg-red-600 text-white" : operational ? "bg-emerald-500 text-slate-950" : "bg-amber-400 text-slate-950"}>
                {tripNames.length ? "RPS TRIP" : operational ? "NORMAL" : "STANDBY"}
              </Badge>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">{tripNames.length ? `Active trip nodes: ${tripNames.join(", ")}.` : props.event}</p>
          </div>
          <div className="space-y-2 lg:w-[430px]">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Signal label="BUS A" active={props.busAAvailable} />
              <Signal label="BUS B" active={props.busBAvailable} />
              <Signal label="BUS S" active={props.safetyBusAvailable} />
              <Signal label="DC / E" active={props.dcBusAvailable && props.busEAvailable} />
            </div>
            <Button size="sm" disabled={tripNames.length > 0} onClick={props.onInstantStartup} className="w-full bg-cyan-400 font-black text-slate-950 hover:bg-cyan-300">INSTANT STARTUP / POST-IPR LINE-UP</Button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="space-y-3 rounded-xl border border-cyan-500/25 bg-slate-900/60 p-4 xl:col-span-5">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-black text-cyan-200"><Activity className="h-4 w-4" /> Reactor</h3><Button size="sm" variant="ghost" className="text-cyan-200" onClick={() => props.onNavigate("control-rods")}>RODS <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Meter label="APRM" value={fmt(props.aprm, 1)} suffix="%" progress={props.aprm} />
            <Meter label="ROD APRM" value={fmt(props.rodAprm, 1)} suffix="%" progress={props.rodAprm} tone="violet" />
            <Meter label="RECIRC APRM" value={fmt(props.recirculationAprm, 1)} suffix="%" progress={props.recirculationAprm * 2} tone="emerald" />
            <Meter label="CORE TEMP" value={fmt(props.temperature)} suffix="°C" progress={props.temperature / 4} tone="amber" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Signal label={`MODE ${props.reactorMode}`} active={props.reactorMode === "RUN"} />
            <Signal label="REACTOR PERIOD" active={props.reactorPeriod >= 20 || props.reactorPeriod >= 900} detail={periodText} />
            <Signal label="AVG WITHDRAWN" active={props.averageWithdrawal > 0} detail={`${fmt(props.averageWithdrawal, 1)}%`} />
            <Signal label="RECIRC FLOW" active={props.recircAFlow + props.recircBFlow > 0} detail={`${fmt(props.recircAFlow + props.recircBFlow)} kg/s`} />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-amber-500/25 bg-slate-900/60 p-4 xl:col-span-4">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-black text-amber-200"><Gauge className="h-4 w-4" /> Steam & turbine</h3><Button size="sm" variant="ghost" className="text-amber-200" onClick={() => props.onNavigate("power-grid")}>TURBINE <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></div>
          <div className="grid grid-cols-2 gap-3">
            <Meter label="RPV PRESSURE" value={fmt(props.pressure)} suffix="kPa" progress={props.pressure / 100} tone="amber" />
            <Meter label="STEAM FLOW" value={fmt(props.steamFlow)} suffix="kg/s" progress={props.steamFlow / 13} tone="cyan" />
            <Meter label="TURBINE" value={fmt(props.turbineRpm)} suffix="RPM" progress={props.turbineRpm / 30} tone="violet" />
            <Meter label="GENERATOR" value={fmt(props.turbineOutput, 1)} suffix="MW" progress={props.turbineOutput / 12} tone="emerald" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Signal label={turbineState} active={props.turbineSynced || props.turbineRpm > 50} />
            <Signal label="MAIN VALVE" active={props.mainValve > 0} detail={`${fmt(props.mainValve)}%`} />
            <Signal label="BYPASS" active={props.bypassValve > 0} detail={`${fmt(props.bypassValve)}%`} />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-emerald-500/25 bg-slate-900/60 p-4 xl:col-span-3">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-black text-emerald-200"><Droplets className="h-4 w-4" /> Inventory</h3><Button size="sm" variant="ghost" className="text-emerald-200" onClick={() => props.onNavigate("mcc")}>MCC <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <Meter label="REACTOR LEVEL" value={fmt(props.reactorLevel, 2)} suffix="m" progress={(props.reactorLevel + 5) * 9.1} tone="cyan" />
            <Meter label="HOTWELL" value={fmt(props.hotwellLevel, 2)} suffix="m" progress={(props.hotwellLevel + 5) * 9.1} tone="emerald" />
            <Meter label="DEAERATOR" value={fmt(props.deaeratorLevel, 2)} suffix="m" progress={(props.deaeratorLevel + 5) * 9.1} tone="amber" />
            <Meter label="CST" value={fmt(props.cstLevel, 2)} suffix="m" progress={(props.cstLevel + 5) * 9.1} tone="violet" />
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"><h3 className="flex items-center gap-2 font-black text-slate-100"><Zap className="h-4 w-4 text-yellow-300" /> Electrical line-up</h3><div className="mt-3 grid gap-2"><Signal label="BUS A 6.6 kVAC" active={props.busAAvailable} /><Signal label="BUS B 6.6 kVAC" active={props.busBAvailable} /><Signal label="SAFETY BUS S" active={props.safetyBusAvailable} /><Signal label="CONTROL / DC" active={props.busEAvailable && props.dcBusAvailable} /></div><Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => props.onNavigate("electrical")}>OPEN ELECTRICAL DISTRIBUTION</Button></section>
        <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"><h3 className="flex items-center gap-2 font-black text-slate-100"><Thermometer className="h-4 w-4 text-sky-300" /> Condenser</h3><div className="mt-3 grid gap-2"><Signal label="CONDENSER PRESSURE" active={props.condenserPressure <= .07 && props.condenserPressure >= .04} detail={`${fmt(props.condenserPressure * 1000)} mbar`} /><Signal label="RECIRCULATION A" active={props.recircAFlow > 0} detail={`${fmt(props.recircAFlow)} kg/s`} /><Signal label="RECIRCULATION B" active={props.recircBFlow > 0} detail={`${fmt(props.recircBFlow)} kg/s`} /></div><Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => props.onNavigate("condenser")}>OPEN CONDENSER CONTROLS</Button></section>
        <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"><h3 className="flex items-center gap-2 font-black text-slate-100"><ShieldAlert className="h-4 w-4 text-red-300" /> Protection summary</h3><div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-300">{tripNames.length ? <span className="font-semibold text-red-300">{tripNames.join(" · ")}</span> : "No RPS trip nodes are active."}</div><Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => props.onNavigate("rps")}>OPEN RPS PANEL</Button></section>
      </div>
    </div>
  );
}
