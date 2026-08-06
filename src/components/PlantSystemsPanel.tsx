import { Activity, Fan, Gauge, RadioTower, Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";

export type ProcessPanel = "condenser" | "feedwater" | "mcc" | "rps";

interface PlantSystemsPanelProps {
  panel: ProcessPanel;
  condenserVacuum: number;
  condenserPumpOn: boolean;
  sjaeOn: boolean;
  deaeratorLevel: number;
  feedwaterDemand: number;
  mccLevel: number;
  mccPumpOn: boolean;
  rpsTrips: Record<string, boolean>;
  reactorLevel: number;
  hotwellLevel: number;
  condensateFlow: number;
  steamFlow: number;
  onCondenserPumpChange: (value: boolean) => void;
  onSjaeChange: (value: boolean) => void;
  onFeedwaterDemandChange: (value: number) => void;
  onCondensateFlowChange: (value: number) => void;
  onMccPumpChange: (value: boolean) => void;
  onManualTrip: () => void;
  onResetTrips: () => void;
}

const Toggle = ({ active, onChange, label }: { active: boolean; onChange: (value: boolean) => void; label: string }) => <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/40 p-3"><span className="font-medium">{label}</span><div className="flex gap-2"><Button size="sm" disabled={active} onClick={() => onChange(true)} className="bg-emerald-700 hover:bg-emerald-600">ON</Button><Button size="sm" disabled={!active} variant="secondary" onClick={() => onChange(false)}>OFF</Button></div></div>;
const Meter = ({ label, value, suffix }: { label: string; value: number; suffix: string }) => <div><div className="mb-1 flex justify-between text-sm"><span className="text-slate-400">{label}</span><strong>{value.toFixed(1)}{suffix}</strong></div><Progress value={Math.max(0, Math.min(value, 100))} className="bg-slate-700" /></div>;

export const PlantSystemsPanel = (props: PlantSystemsPanelProps) => {
  if (props.panel === "condenser") return <div className="grid gap-6 lg:grid-cols-2">
    <Card className="border-sky-500/30 bg-slate-900/60"><CardHeader><CardTitle className="flex gap-2 text-sky-300"><Fan />Condenser & SJAE</CardTitle></CardHeader><CardContent className="space-y-5"><div className="rounded-xl border border-sky-500/20 bg-slate-950/50 p-5 text-center"><div className="text-xs tracking-widest text-slate-400">CONDENSER VACUUM</div><div className="mt-2 text-5xl font-bold text-sky-300">{props.condenserVacuum.toFixed(0)} <span className="text-lg">kPa</span></div><div className="mt-2 text-sm text-slate-400">{(101.3 - props.condenserVacuum).toFixed(1)} kPa absolute pressure</div></div><Toggle label="Circulating water pump" active={props.condenserPumpOn} onChange={props.onCondenserPumpChange}/><Toggle label="Steam jet air ejector" active={props.sjaeOn} onChange={props.onSjaeChange}/></CardContent></Card>
    <Card className="border-slate-700 bg-slate-900/60"><CardHeader><CardTitle>Operating notes</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-slate-300"><p>Vacuum is expressed as strength below atmosphere, matching the Minecraft control screens.</p><p className={props.condenserVacuum > 85 ? "text-emerald-400" : "text-amber-400"}>{props.condenserVacuum > 85 ? "Vacuum sufficient for turbine operation." : "Vacuum low — turbine efficiency and RPS margin reduced."}</p><Meter label="Vacuum quality" value={props.condenserVacuum} suffix="%"/></CardContent></Card>
  </div>;

  if (props.panel === "feedwater") return <div className="grid gap-6 lg:grid-cols-2"><Card className="border-amber-500/30 bg-slate-900/60"><CardHeader><CardTitle className="flex gap-2 text-amber-300"><Waves/>Deaerator & Feedwater</CardTitle></CardHeader><CardContent className="space-y-6"><Meter label="Deaerator level" value={props.deaeratorLevel} suffix="%"/><div><div className="mb-3 flex justify-between text-sm"><span>Feedwater demand</span><strong>{props.feedwaterDemand}%</strong></div><Slider value={[props.feedwaterDemand]} max={100} step={1} onValueChange={value => props.onFeedwaterDemandChange(value[0])}/></div><div className="rounded-lg bg-slate-950/40 p-3 text-sm text-slate-400">Feedwater follows demand only when a feedwater pump is online. Low DA level limits its availability.</div></CardContent></Card><Card className="border-slate-700 bg-slate-900/60"><CardHeader><CardTitle>Feedwater train</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex justify-between"><span>Feedwater source</span><Badge className={props.deaeratorLevel > 20 ? "bg-emerald-700" : "bg-red-700"}>{props.deaeratorLevel > 20 ? "AVAILABLE" : "LOW LEVEL"}</Badge></div><Meter label="Demand met" value={props.deaeratorLevel > 20 ? props.feedwaterDemand : 0} suffix="%"/></CardContent></Card></div>;

  if (props.panel === "mcc") return <div className="grid gap-6 lg:grid-cols-2"><Card className="border-blue-500/30 bg-slate-900/60"><CardHeader><CardTitle className="flex gap-2 text-blue-300"><Activity/>MCC water inventory</CardTitle></CardHeader><CardContent className="space-y-5"><div className="grid grid-cols-3 gap-3">{[["REACTOR", props.reactorLevel], ["HOTWELL", props.hotwellLevel], ["DA", props.deaeratorLevel]].map(([label, level]) => <div key={label as string} className="rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-center"><div className="mx-auto mb-2 flex h-28 w-8 items-end overflow-hidden rounded border border-slate-500 bg-slate-900"><div className="w-full bg-cyan-400 transition-all" style={{ height: `${Math.max(0, Math.min(100, 50 + Number(level) * 10))}%` }} /></div><div className="text-[10px] text-slate-400">{label}</div><strong>{Number(level).toFixed(2)} m</strong><div className="text-xs text-slate-400">{(50 + Number(level) * 10).toFixed(0)}%</div></div>)}</div><div className="rounded-lg bg-slate-950/40 p-3 text-xs text-slate-400">Closed loop: Reactor steam → Hotwell → DA → Reactor feedwater. Each flow shifts water between two vessels.</div><Toggle label="MCC circulation pump" active={props.mccPumpOn} onChange={props.onMccPumpChange}/></CardContent></Card><Card className="border-slate-700 bg-slate-900/60"><CardHeader><CardTitle>Transfer controls</CardTitle></CardHeader><CardContent className="space-y-5"><div><div className="mb-2 flex justify-between text-sm"><span>Hotwell → DA condensate</span><strong>{props.condensateFlow}%</strong></div><Slider value={[props.condensateFlow]} onValueChange={value => props.onCondensateFlowChange(value[0])} max={100}/></div><div><div className="mb-2 flex justify-between text-sm"><span>DA → Reactor feedwater</span><strong>{props.feedwaterDemand}%</strong></div><Slider value={[props.feedwaterDemand]} onValueChange={value => props.onFeedwaterDemandChange(value[0])} max={100}/></div><div className="flex justify-between text-sm"><span>Reactor steam flow</span><strong>{props.steamFlow.toFixed(1)}%</strong></div><Meter label="MCC reserve" value={props.mccLevel} suffix="%"/><div className="flex justify-between"><span>ECCS readiness</span><Badge className={props.mccLevel > 25 ? "bg-emerald-700" : "bg-red-700"}>{props.mccLevel > 25 ? "ARMED" : "INHIBITED"}</Badge></div></CardContent></Card></div>;

  const nodes = Object.entries(props.rpsTrips);
  return <div className="space-y-6"><Card className="border-red-500/30 bg-slate-900/60"><CardHeader><CardTitle className="flex gap-2 text-red-300"><RadioTower/>Reactor Protection System — dual channel</CardTitle></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-2">{["CHANNEL A", "CHANNEL B"].map(channel => <div key={channel} className="rounded-xl border border-slate-700 bg-slate-950/50 p-4"><div className="mb-4 flex justify-between font-bold"><span>{channel}</span><Badge className={nodes.some(([, tripped]) => tripped) ? "bg-red-700" : "bg-emerald-700"}>{nodes.some(([, tripped]) => tripped) ? "TRIPPED" : "CLEAR"}</Badge></div><div className="space-y-2">{nodes.map(([name, tripped]) => <div key={name} className="flex items-center justify-between rounded bg-slate-900 px-3 py-2 text-sm"><span>{name}</span><span className={tripped ? "text-red-400" : "text-emerald-400"}>{tripped ? "● TRIP" : "● CLEAR"}</span></div>)}</div></div>)}</div><div className="mt-5 flex flex-wrap gap-3"><Button onClick={props.onManualTrip} className="bg-red-700 hover:bg-red-600">MANUAL TRIP</Button><Button variant="outline" onClick={props.onResetTrips} className="border-slate-600">RESET ALL NODES</Button></div></CardContent></Card></div>;
};
