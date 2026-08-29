import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MaintainedSwitch } from "@/components/HardwareControls";

export type PolisherTarget = "A" | "B";
export type RegenStage = "ready" | "water" | "water-done" | "air" | "air-done" | "refill" | "regen-hold" | "regenerating";
export type RegenTank = { id: 1 | 2 | 3; stage: RegenStage; progress: number; target: PolisherTarget | null };

type Props = {
  trainA: boolean; trainB: boolean; auto: boolean; bypass: boolean; target: PolisherTarget;
  tanks: RegenTank[]; selectedTank: 1 | 2 | 3; resinA: number; resinB: number;
  onTrainA: (value: boolean) => void; onTrainB: (value: boolean) => void; onAuto: (value: boolean) => void;
  onBypass: (value: boolean) => void; onTarget: (value: PolisherTarget) => void; onSelectTank: (id: 1 | 2 | 3) => void;
  onWater: () => void; onAir: () => void; onRefill: () => void; onContinueRegen: () => void;
};

const STAGE_LABEL: Record<RegenStage, string> = {
  ready: "READY / GREEN", water: "WATER FLUSH", "water-done": "WATER COMPLETE", air: "AIR FLUSH", "air-done": "AIR COMPLETE", refill: "RESIN REFILL", "regen-hold": "CONFIRM REGEN", regenerating: "REGENERATING",
};
const stageTone = (stage: RegenStage) => stage === "ready" ? "bg-emerald-700" : stage.endsWith("done") || stage === "regen-hold" ? "bg-amber-600" : "bg-red-700";

export const PolisherPanel = (p: Props) => {
  const activeTank = p.tanks.find((tank) => tank.id === p.selectedTank) || p.tanks[0];
  const targetRunning = p.target === "A" ? p.trainA : p.trainB;
  const bypassReady = p.bypass && !targetRunning;
  const action = activeTank.stage === "ready" ? "WATER" : activeTank.stage === "water-done" ? "AIR" : activeTank.stage === "air-done" ? "REFILL" : activeTank.stage === "regen-hold" ? "CONTINUE" : null;
  const startAction = () => { if (action === "WATER") p.onWater(); else if (action === "AIR") p.onAir(); else if (action === "REFILL") p.onRefill(); else if (action === "CONTINUE") p.onContinueRegen(); };

  return <div className="space-y-6">
    <Card className="border-violet-500/30 bg-slate-900/70"><CardHeader><CardTitle className="text-violet-200">CIX / condensate polisher regeneration</CardTitle></CardHeader><CardContent className="space-y-5">
      <p className="text-sm text-slate-300">Polishers clean condensate through ion-exchange resin. To regenerate a train, bypass it first, stop that train, then use a ready regeneration tank for water flush, air flush, resin refill, and the final regeneration confirmation.</p>
      <div className="grid gap-3 md:grid-cols-4"><MaintainedSwitch label="CIX BYPASS" on={p.bypass} onChange={p.onBypass}/><MaintainedSwitch label="POLISHER TRAIN A" on={p.trainA} onChange={p.onTrainA}/><MaintainedSwitch label="POLISHER TRAIN B" on={p.trainB} onChange={p.onTrainB}/><MaintainedSwitch label="CIX AUTO" on={p.auto} onChange={p.onAuto}/></div>
      <div className="flex flex-wrap items-center gap-3 rounded border border-violet-400/30 bg-violet-950/20 p-3"><span className="text-xs font-bold text-violet-100">TARGET POLISHER</span><Button size="sm" variant={p.target === "A" ? "default" : "outline"} onClick={() => p.onTarget("A")}>POLISHER 1 / A</Button><Button size="sm" variant={p.target === "B" ? "default" : "outline"} onClick={() => p.onTarget("B")}>POLISHER 2 / B</Button><Badge className={bypassReady ? "bg-emerald-700" : "bg-amber-700"}>{bypassReady ? "BYPASS ALIGNED" : "BYPASS + TARGET STOP REQUIRED"}</Badge></div>
      <div className="grid gap-3 md:grid-cols-3">{p.tanks.map((tank) => <button key={tank.id} className={`rounded border p-4 text-left transition ${tank.id === activeTank.id ? "border-violet-300 bg-violet-950/40" : "border-slate-700 bg-slate-950 hover:border-violet-500"}`} onClick={() => p.onSelectTank(tank.id)}><div className="flex items-center justify-between"><strong>REGEN TANK {tank.id}</strong><Badge className={stageTone(tank.stage)}>{STAGE_LABEL[tank.stage]}</Badge></div><div className="mt-3 h-2 overflow-hidden rounded bg-slate-800"><div className="h-full bg-violet-400 transition-all" style={{ width: `${tank.progress.toFixed(0)}%` }}/></div><p className="mt-2 text-xs text-slate-400">{tank.target ? `Aligned to Polisher ${tank.target}` : "Available for alignment"} · {tank.progress.toFixed(0)}%</p></button>)}</div>
      <div className="flex flex-wrap items-center gap-3 rounded border border-cyan-500/30 bg-cyan-950/20 p-4"><div className="min-w-52 flex-1"><strong className="text-cyan-100">ACTIVE TANK {activeTank.id}: {STAGE_LABEL[activeTank.stage]}</strong><p className="mt-1 text-xs text-cyan-100/75">Timed stages are 30 s water flush, 30 s air flush, 30 s resin refill, and 60 s final regeneration. Total active time: 2 minutes.</p></div>{action && <Button disabled={action === "WATER" && (!bypassReady || activeTank.stage !== "ready")} onClick={startAction}>{action === "WATER" ? "START WATER FLUSH" : action === "AIR" ? "START AIR FLUSH" : action === "REFILL" ? "START RESIN REFILL" : "CONTINUE REGENERATION"}</Button>}{!action && <Badge className={activeTank.stage === "ready" ? "bg-emerald-700" : "bg-cyan-700"}>{activeTank.stage === "ready" ? "SELECT TANK, THEN START" : "STAGE IN PROGRESS"}</Badge>}</div>
    </CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2"><Card className="border-slate-700 bg-slate-900/70"><CardContent className="p-4"><small>POLISHER 1 RESIN CAPACITY</small><strong className="block text-3xl text-emerald-300">{p.resinA.toFixed(0)}%</strong></CardContent></Card><Card className="border-slate-700 bg-slate-900/70"><CardContent className="p-4"><small>POLISHER 2 RESIN CAPACITY</small><strong className="block text-3xl text-emerald-300">{p.resinB.toFixed(0)}%</strong></CardContent></Card></div>
  </div>;
};
