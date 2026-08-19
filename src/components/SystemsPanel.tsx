import { AlertTriangle, Gauge, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MaintainedSwitch } from "@/components/HardwareControls";

export type Malfunctions = {
  enabled: boolean;
  recircAFlowLossActive: boolean;
  recircBFlowLossActive: boolean;
};

interface Props {
  malfunctions: Malfunctions;
  recircAFlow: number;
  recircBFlow: number;
  gridDemandMW: number;
  nextGridDemandMW: number;
  secondsToDemandChange: number;
  netProductionMW: number;
  onDemand: boolean;
  operatorName: string;
  operatorPoints: number;
  operatorRank: number;
  leaderboardSize: number;
  scoreRate: number;
  automationPenaltyCount: number;
  onChange: (next: Malfunctions) => void;
}

const FAULTS: Array<{
  activeKey: "recircAFlowLossActive" | "recircBFlowLossActive";
  label: string;
  description: string;
  severity: number;
}> = [
  {
    activeKey: "recircAFlowLossActive",
    label: "RECIRCULATION PUMP A — FLOW LOSS",
    description: "A possible hidden failure while Pump A is operating.",
    severity: 20,
  },
  {
    activeKey: "recircBFlowLossActive",
    label: "RECIRCULATION PUMP B — FLOW LOSS",
    description: "A possible hidden failure while Pump B is operating.",
    severity: 20,
  },
];

export const SystemsPanel = ({ malfunctions, recircAFlow, recircBFlow, gridDemandMW, nextGridDemandMW, secondsToDemandChange, netProductionMW, onDemand, operatorName, operatorPoints, operatorRank, leaderboardSize, scoreRate, automationPenaltyCount, onChange }: Props) => {
  const malfunctionPercent = FAULTS.reduce(
    (total, fault) => total + (malfunctions[fault.activeKey] ? fault.severity : 0),
    0,
  );
  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
    <div className="space-y-6">
    <Card className="border-emerald-500/30 bg-slate-900/70">
      <CardHeader><CardTitle className="flex items-center gap-2 text-emerald-200"><Gauge />Grid demand / operator score</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded bg-slate-950 p-3"><small>NETWORK DEMAND</small><strong className="block text-xl text-cyan-300">{gridDemandMW.toFixed(0)} MW</strong></div><div className="rounded bg-slate-950 p-3"><small>NET PRODUCTION</small><strong className={`block text-xl ${onDemand ? "text-emerald-300" : "text-amber-300"}`}>{netProductionMW.toFixed(1)} MW</strong></div></div>
        <div className="rounded border border-slate-700 bg-slate-950 p-3 text-xs"><div className="flex justify-between"><span>NEXT NETWORK DEMAND</span><strong>{secondsToDemandChange <= 200 ? `${nextGridDemandMW.toFixed(0)} MW` : "WITHHELD"}</strong></div><p className="mt-1 text-slate-400">Change in {secondsToDemandChange}s. The next target is published for the final 200 seconds.</p></div>
        <div className="rounded border border-slate-700 bg-slate-950 p-3"><div className="flex justify-between text-sm"><span>{operatorName ? `OPERATOR: ${operatorName}` : "OPERATOR LOGIN REQUIRED"}</span><Badge className={onDemand ? "bg-emerald-700" : "bg-slate-700"}>{onDemand ? "ON DEMAND" : "OFF DEMAND"}</Badge></div><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div>POINTS<strong className="block text-lg text-emerald-300">{operatorPoints.toFixed(1)}</strong></div><div>LEADERBOARD<strong className="block text-lg text-cyan-300">#{operatorRank || "—"} / {leaderboardSize || "—"}</strong></div></div><p className="mt-2 text-xs text-slate-400">Base score: 1 point/s while output is within demand tolerance. {automationPenaltyCount ? `${automationPenaltyCount} automation penalty${automationPenaltyCount > 1 ? "ies" : ""} active: ${scoreRate.toFixed(2)} point/s.` : "No automation penalty."}</p></div>
      </CardContent>
    </Card>
    <Card className="border-amber-500/30 bg-slate-900/70">
      <CardHeader><CardTitle className="flex items-center gap-2 text-amber-200"><Gauge />Unit condition</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-300">UNIT MALFUNCTION</span><strong className={malfunctionPercent ? "text-amber-300" : "text-emerald-300"}>{malfunctionPercent.toFixed(0)}%</strong></div>
          <div className="mt-3 h-3 overflow-hidden rounded bg-slate-800"><div className={malfunctionPercent ? "h-full bg-amber-400" : "h-full bg-emerald-400"} style={{ width: `${malfunctionPercent}%` }} /></div>
          <p className="mt-3 text-xs text-slate-400">This is the severity of active faults. With malfunctions enabled, failures occur unpredictably only during the relevant operating conditions.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded bg-slate-950 p-3"><small>PUMP A FLOW</small><strong className="block text-xl text-cyan-300">{recircAFlow.toFixed(1)} kg/s</strong></div><div className="rounded bg-slate-950 p-3"><small>PUMP B FLOW</small><strong className="block text-xl text-cyan-300">{recircBFlow.toFixed(1)} kg/s</strong></div></div>
        <div className="flex items-center gap-2 text-xs text-slate-400"><AlertTriangle className="h-4 w-4 text-amber-300" />The individual failure source is intentionally not disclosed until it occurs.</div>
      </CardContent>
    </Card>
    </div>
    <Card className="border-cyan-500/30 bg-slate-900/70">
      <CardHeader><CardTitle className="flex items-center justify-between gap-2 text-cyan-200"><span className="flex items-center gap-2"><Wrench />Malfunction system</span><Badge className={malfunctionPercent ? "bg-amber-700" : malfunctions.enabled ? "bg-cyan-700" : "bg-emerald-700"}>{malfunctionPercent ? "FAULT ACTIVE" : malfunctions.enabled ? "UNPREDICTABLE" : "NOMINAL"}</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="max-w-xl"><strong className="text-sm">RANDOM PLANT MALFUNCTIONS</strong><p className="mt-1 text-xs text-slate-400">Enable training failures globally. The simulator decides whether, when, and which eligible operating system develops a fault. Disabling the system clears active simulated faults.</p></div><MaintainedSwitch label="MALFUNCTIONS" on={malfunctions.enabled} onChange={(enabled) => onChange({ enabled, recircAFlowLossActive: enabled ? malfunctions.recircAFlowLossActive : false, recircBFlowLossActive: enabled ? malfunctions.recircBFlowLossActive : false })} /></div></div>
      </CardContent>
    </Card>
  </div>;
};
