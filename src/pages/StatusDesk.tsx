import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Snapshot = Record<string, any>;
type Widget = { id: string; key: string; x: number; y: number; width: number; height: number };
const LIVE_KEY = "rbwr-live-plant-state";
const LAYOUT_KEY = "unit2-status-desk-current";
const SAVES_KEY = "unit2-status-desk-saves";

const defaults: Widget[] = [
  { id: "aprm", key: "aprm", x: 28, y: 28, width: 220, height: 130 },
  { id: "pressure", key: "pressure", x: 270, y: 28, width: 220, height: 130 },
  { id: "level", key: "reactorLevel", x: 512, y: 28, width: 220, height: 130 },
  { id: "mw", key: "turbineOutputMW", x: 754, y: 28, width: 220, height: 130 },
  { id: "rpm", key: "turbineSpeed", x: 28, y: 184, width: 220, height: 130 },
  { id: "condenser", key: "condenserVacuum", x: 270, y: 184, width: 220, height: 130 },
];

const labelFor = (key: string) => key
  .replace(/^controls\./, "")
  .replace(/([A-Z])/g, " $1")
  .replace(/[._]/g, " ")
  .replace(/\b\w/g, char => char.toUpperCase())
  .trim();

const unitFor = (key: string) => {
  if (/pressure$/i.test(key)) return "kPa";
  if (/temperature$/i.test(key)) return "°C";
  if (/level$/i.test(key)) return "m";
  if (/vacuum$/i.test(key)) return "bar";
  if (/speed|rpm/i.test(key)) return "RPM";
  if (/flow/i.test(key)) return "kg/s";
  if (/aprm/i.test(key)) return "%";
  if (/outputmw/i.test(key)) return "MW";
  return "";
};

const readSnapshot = (): Snapshot => {
  try { return JSON.parse(localStorage.getItem(LIVE_KEY) || "{}"); } catch { return {}; }
};
const readWidgets = (): Widget[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "[]");
    return Array.isArray(parsed) && parsed.length ? parsed : defaults;
  } catch { return defaults; }
};
const readSaves = (): Record<string, Widget[]> => {
  try { return JSON.parse(localStorage.getItem(SAVES_KEY) || "{}"); } catch { return {}; }
};

const valuesFrom = (snapshot: Snapshot) => {
  const values: Record<string, string | number | boolean> = {};
  const add = (key: string, value: unknown) => {
    if (["string", "number", "boolean"].includes(typeof value)) values[key] = value as string | number | boolean;
  };
  Object.entries(snapshot).forEach(([key, value]) => {
    if (key !== "controls") add(key, value);
  });
  Object.entries(snapshot.controls || {}).forEach(([key, value]) => add(`controls.${key}`, value));
  values.averageRodWithdrawal = Array.isArray(snapshot.rods) && snapshot.rods.length
    ? snapshot.rods.reduce((sum: number, rod: { position?: number }) => sum + (100 - Number(rod.position || 0)), 0) / snapshot.rods.length
    : 0;
  values.reactorStatus = snapshot.isRunning ? "RUNNING" : "STANDBY";
  values.lastSnapshot = snapshot.updatedAt ? new Date(snapshot.updatedAt).toLocaleTimeString() : "NO DATA";
  return values;
};

export default function StatusDesk() {
  const [snapshot, setSnapshot] = useState<Snapshot>(readSnapshot);
  const [widgets, setWidgets] = useState<Widget[]>(readWidgets);
  const [saves, setSaves] = useState<Record<string, Widget[]>>(readSaves);
  const [selectedKey, setSelectedKey] = useState("temperature");
  const [layoutName, setLayoutName] = useState("default");
  const drag = useRef<{ id: string; startX: number; startY: number; x: number; y: number } | null>(null);
  const values = useMemo(() => valuesFrom(snapshot), [snapshot]);
  const keys = useMemo(() => Object.keys(values).sort((a, b) => labelFor(a).localeCompare(labelFor(b))), [values]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(widgets));
  }, [widgets]);
  useEffect(() => {
    const refresh = () => setSnapshot(readSnapshot());
    const onStorage = (event: StorageEvent) => { if (event.key === LIVE_KEY) refresh(); };
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(refresh, 750);
    return () => { window.removeEventListener("storage", onStorage); window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!drag.current) return;
      const current = drag.current;
      setWidgets(items => items.map(item => item.id === current.id ? {
        ...item,
        x: Math.max(0, Math.min(1600, current.x + event.clientX - current.startX)),
        y: Math.max(0, Math.min(1000, current.y + event.clientY - current.startY)),
      } : item));
    };
    const end = () => { drag.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", end); };
  }, []);

  const addWidget = () => setWidgets(items => [...items, {
    id: `${selectedKey}-${Date.now()}`,
    key: selectedKey,
    x: 40 + (items.length % 5) * 235,
    y: 360 + Math.floor(items.length / 5) * 155,
    width: 220,
    height: 130,
  }]);
  const saveNamed = () => {
    const name = layoutName.trim().slice(0, 36) || "default";
    const next = { ...saves, [name]: widgets };
    setSaves(next);
    localStorage.setItem(SAVES_KEY, JSON.stringify(next));
    setLayoutName(name);
  };
  const loadNamed = () => {
    const found = saves[layoutName];
    if (found) setWidgets(found.map(widget => ({ ...widget })));
  };
  const exportLayout = () => {
    const file = new Blob([JSON.stringify({ version: 1, widgets }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "unit2-status-desk-layout.json"; anchor.click();
    URL.revokeObjectURL(url);
  };
  const importLayout = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed.widgets)) setWidgets(parsed.widgets.filter((widget: unknown): widget is Widget => Boolean(widget && typeof widget === "object" && "id" in widget && "key" in widget)));
      } catch { /* invalid layout files leave the desk unchanged */ }
    };
    reader.readAsText(file);
  };

  return <main className="min-h-screen bg-[#07111d] p-3 font-mono text-slate-100 sm:p-5">
    <header className="mx-auto mb-4 max-w-[1700px] border-b border-cyan-500/30 pb-4">
      <p className="text-xs font-bold tracking-[.3em] text-cyan-400">UNIT 2 // PERSONAL STATUS DESK</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-black">Custom Monitoring Window</h1><p className="mt-1 max-w-3xl text-sm text-slate-400">Add any available simulator value, drag fields into position, resize their lower-right corner, then save or export your layout. This desk never removes controls from the main room.</p></div><Button variant="outline" onClick={() => window.close()} className="border-slate-500">CLOSE WINDOW</Button></div>
    </header>
    <section className="mx-auto mb-4 flex max-w-[1700px] flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 p-3">
      <select value={selectedKey} onChange={event => setSelectedKey(event.target.value)} className="min-h-10 max-w-full rounded border border-cyan-700 bg-slate-950 px-3 text-sm text-cyan-100"><option value="">Select value…</option>{keys.map(key => <option key={key} value={key}>{labelFor(key)}</option>)}</select>
      <Button onClick={addWidget} disabled={!selectedKey} className="min-h-10 bg-cyan-500 text-slate-950 hover:bg-cyan-300"><Plus className="mr-1 h-4 w-4" />ADD FIELD</Button>
      <span className="mx-1 hidden h-7 border-l border-slate-700 sm:block" />
      <input value={layoutName} onChange={event => setLayoutName(event.target.value)} aria-label="Layout name" placeholder="Layout name" className="min-h-10 w-36 rounded border border-slate-700 bg-slate-950 px-3 text-sm" />
      <Button variant="outline" onClick={saveNamed}><Save className="mr-1 h-4 w-4" />SAVE</Button>
      <Button variant="outline" onClick={loadNamed} disabled={!saves[layoutName]}>LOAD</Button>
      <Button variant="outline" onClick={exportLayout}><Download className="mr-1 h-4 w-4" />EXPORT</Button>
      <label className="inline-flex min-h-10 cursor-pointer items-center rounded border border-slate-600 px-3 text-sm hover:bg-slate-800"><Upload className="mr-1 h-4 w-4" />IMPORT<input type="file" accept="application/json" className="hidden" onChange={event => importLayout(event.target.files?.[0])} /></label>
    </section>
    <section className="relative mx-auto min-h-[1100px] max-w-[1700px] overflow-auto rounded-xl border border-cyan-500/30 bg-[radial-gradient(circle_at_1px_1px,rgba(34,211,238,.15)_1px,transparent_0)] bg-[size:20px_20px]">
      {widgets.map(widget => {
        const value = values[widget.key];
        const unit = unitFor(widget.key);
        return <article key={widget.id} style={{ left: widget.x, top: widget.y, width: widget.width, height: widget.height }} className="group absolute min-w-[170px] min-h-[105px] resize overflow-auto rounded-lg border border-cyan-500/60 bg-slate-950/95 shadow-xl">
          <div onPointerDown={event => { drag.current = { id: widget.id, startX: event.clientX, startY: event.clientY, x: widget.x, y: widget.y }; }} className="flex cursor-move touch-none items-center justify-between border-b border-cyan-500/30 bg-cyan-950/50 px-3 py-2 text-xs font-bold tracking-wide text-cyan-200"><span className="truncate">{labelFor(widget.key)}</span><button aria-label={`Remove ${labelFor(widget.key)}`} onPointerDown={event => event.stopPropagation()} onClick={() => setWidgets(items => items.filter(item => item.id !== widget.id))} className="ml-2 text-slate-400 hover:text-red-300">×</button></div>
          <div className="p-3"><div className="text-2xl font-black text-emerald-300">{typeof value === "number" ? value.toFixed(/aprm|level|vacuum/i.test(widget.key) ? 2 : 1) : typeof value === "boolean" ? value ? "ON" : "OFF" : value ?? "—"}</div><div className="mt-1 text-xs text-slate-400">{unit || "LIVE STATUS"}</div></div>
        </article>;
      })}
      {!widgets.length && <div className="grid min-h-[600px] place-items-center p-8 text-center text-slate-400">Choose a value above and press <strong className="ml-1 text-cyan-200">ADD FIELD</strong> to begin your personal desk.</div>}
    </section>
  </main>;
}
