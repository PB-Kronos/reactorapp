import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface PhysicsTuning {
  thermalResponse: number;
  steamProduction: number;
  steamRemoval: number;
  tripTemperature: number;
}

interface Props {
  temperature: number; pressure: number; reactorLevel: number; hotwellLevel: number; deaeratorLevel: number; condenserPressure: number; rodsWithdrawn: number; physics: PhysicsTuning;
  onTemperatureChange: (value: number) => void; onPressureChange: (value: number) => void; onReactorLevelChange: (value: number) => void; onHotwellLevelChange: (value: number) => void; onDeaeratorLevelChange: (value: number) => void; onCondenserPressureChange: (value: number) => void; onRodsWithdrawnChange: (value: number) => void; onPhysicsChange: (value: PhysicsTuning) => void;
  onScram: () => void; onResetTrips: () => void; onEvent: (event: "level-up" | "level-down" | "pressure-up" | "pressure-down") => void;
}

const Field = ({ label, value, unit, min, max, step = .1, onChange }: { label: string; value: number; unit: string; min: number; max: number; step?: number; onChange: (value: number) => void }) => <label className="grid gap-1 rounded border border-slate-700 bg-slate-950/70 p-3 text-xs"><span className="text-slate-400">{label}</span><span className="flex items-center gap-2"><input aria-label={label} className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-2 text-right font-mono text-sm text-cyan-200" type="number" min={min} max={max} step={step} value={Number.isFinite(value) ? value : 0} onChange={event => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next))); }}/><strong className="w-10 text-slate-400">{unit}</strong></span></label>;

export const SimulatorConsolePanel = (p: Props) => {
  const changePhysics = (key: keyof PhysicsTuning, value: number) => p.onPhysicsChange({ ...p.physics, [key]: value });
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-fuchsia-500/40 bg-fuchsia-950/20 p-4"><div><h2 className="font-black text-fuchsia-200">SIMULATOR CONSOLE</h2><p className="text-sm text-slate-300">Public sandbox controls. Changes apply immediately and remain active until reset or changed again.</p></div><Badge className="bg-fuchsia-700">LIVE OVERRIDES</Badge></div>
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="border-cyan-500/30 bg-slate-900/70"><CardHeader><CardTitle className="text-cyan-200">Live plant values</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><Field label="Reactor temperature" value={p.temperature} unit="°C" min={20} max={1800} onChange={p.onTemperatureChange}/><Field label="RPV pressure" value={p.pressure} unit="kPa" min={101} max={12000} step={1} onChange={p.onPressureChange}/><Field label="Reactor level" value={p.reactorLevel} unit="m" min={-5} max={6} onChange={p.onReactorLevelChange}/><Field label="Hotwell level" value={p.hotwellLevel} unit="m" min={-5} max={6} onChange={p.onHotwellLevelChange}/><Field label="DA level" value={p.deaeratorLevel} unit="m" min={-5} max={6} onChange={p.onDeaeratorLevelChange}/><Field label="Condenser pressure" value={p.condenserPressure} unit="bar" min={.001} max={1.5} step={.001} onChange={p.onCondenserPressureChange}/><Field label="All rods withdrawn" value={p.rodsWithdrawn} unit="%" min={0} max={100} onChange={p.onRodsWithdrawnChange}/></CardContent></Card>
      <Card className="border-amber-500/30 bg-slate-900/70"><CardHeader><CardTitle className="text-amber-200">Physics tuning</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><Field label="Thermal response" value={p.physics.thermalResponse} unit="×" min={0} max={3} step={.01} onChange={value => changePhysics("thermalResponse", value)}/><Field label="Steam production" value={p.physics.steamProduction} unit="×" min={0} max={3} step={.01} onChange={value => changePhysics("steamProduction", value)}/><Field label="Steam removal" value={p.physics.steamRemoval} unit="×" min={0} max={3} step={.01} onChange={value => changePhysics("steamRemoval", value)}/><Field label="Auto-SCRAM temperature" value={p.physics.tripTemperature} unit="°C" min={100} max={1800} step={1} onChange={value => changePhysics("tripTemperature", value)}/></CardContent></Card>
    </div>
    <Card className="border-red-500/30 bg-slate-900/70"><CardHeader><CardTitle className="text-red-200">Event injector</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => p.onEvent("level-up")}>+1 m reactor level</Button><Button variant="outline" onClick={() => p.onEvent("level-down")}>−1 m reactor level</Button><Button variant="outline" onClick={() => p.onEvent("pressure-up")}>+1,000 kPa pressure</Button><Button variant="outline" onClick={() => p.onEvent("pressure-down")}>−1,000 kPa pressure</Button><Button className="bg-red-700 hover:bg-red-600" onClick={p.onScram}>TRIGGER SCRAM</Button><Button variant="secondary" onClick={p.onResetTrips}>RESET TRIP NODES</Button></CardContent></Card>
  </div>;
};
