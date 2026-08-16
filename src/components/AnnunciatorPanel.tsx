import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Annunciator = { id: string; label: string; active: boolean; priority: "amber" | "red"; tone: "low" | "high" | "pulse" | "warble" | "chime" | "double" };
interface Props { annunciators: Annunciator[]; }
type WindowState = { active: boolean; acknowledged: boolean; silenced: boolean };

const toneMap: Record<Annunciator["tone"], number[]> = { low: [330], high: [880], pulse: [540, 540, 540], warble: [620, 780, 620, 780], chime: [740, 988], double: [420, 420] };

export const AnnunciatorPanel = ({ annunciators }: Props) => {
  const context = useRef<AudioContext | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [lampTest, setLampTest] = useState(false);
  const [windows, setWindows] = useState<Record<string, WindowState>>({});

  const sound = (item: Annunciator) => {
    if (!context.current) context.current = new AudioContext();
    const audio = context.current;
    if (audio.state === "suspended") void audio.resume();
    toneMap[item.tone].forEach((frequency, index) => {
      const oscillator = audio.createOscillator(); const gain = audio.createGain(); const start = audio.currentTime + index * .16;
      oscillator.type = item.priority === "red" ? "square" : "sine"; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(item.priority === "red" ? .11 : .07, start + .015); gain.gain.exponentialRampToValueAtTime(.0001, start + .13);
      oscillator.connect(gain).connect(audio.destination); oscillator.start(start); oscillator.stop(start + .14);
    });
  };

  useEffect(() => {
    setWindows(previous => Object.fromEntries(annunciators.map(item => {
      const prior = previous[item.id] ?? { active: false, acknowledged: true, silenced: false };
      // A rising sensor condition starts a new, unacknowledged annunciation.
      return [item.id, item.active && !prior.active ? { active: true, acknowledged: false, silenced: false } : { ...prior, active: item.active }];
    })));
  }, [annunciators]);

  const hornAlarms = useMemo(() => annunciators.filter(item => { const state = windows[item.id]; return item.active && state && !state.acknowledged && !state.silenced; }), [annunciators, windows]);
  useEffect(() => {
    if (!audioEnabled || !hornAlarms.length) return;
    sound(hornAlarms[0]);
    const timer = window.setInterval(() => sound(hornAlarms[0]), 1200);
    return () => window.clearInterval(timer);
  }, [audioEnabled, hornAlarms]);

  const acknowledge = () => setWindows(previous => Object.fromEntries(Object.entries(previous).map(([id, state]) => [id, { ...state, acknowledged: true, silenced: false }])));
  const silence = () => setWindows(previous => Object.fromEntries(Object.entries(previous).map(([id, state]) => [id, state.active && !state.acknowledged ? { ...state, silenced: true } : state])));
  const testLamps = () => { setLampTest(true); window.setTimeout(() => setLampTest(false), 1000); };
  const activeCount = annunciators.filter(item => item.active).length;
  const unacknowledged = Object.values(windows).filter(state => !state.acknowledged).length;

  const windowClass = (item: Annunciator) => {
    const state = windows[item.id] ?? { active: item.active, acknowledged: true, silenced: false };
    const color = item.priority === "red" ? "border-red-400 bg-red-600 text-white" : "border-amber-300 bg-amber-400 text-slate-950";
    if (lampTest) return `${color} annunciator-steady`;
    if (state.active && !state.acknowledged) return `${color} annunciator-fast-flash`;
    if (state.active && state.acknowledged) return `${color} annunciator-steady`;
    if (!state.active && !state.acknowledged) return `${color} annunciator-slow-flash`;
    return "border-slate-700 bg-slate-950 text-slate-500";
  };

  return <section className="mb-5 rounded-xl border border-amber-500/30 bg-slate-900/80 p-3"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 font-bold text-amber-100"><BellRing className="h-4 w-4"/>ANNUNCIATOR WINDOW</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setAudioEnabled(value => !value); if (!audioEnabled) sound({ id: "test", label: "TEST", active: true, priority: "amber", tone: "chime" }); }}>{audioEnabled ? <Volume2 className="mr-1 h-4 w-4"/> : <VolumeX className="mr-1 h-4 w-4"/>}{audioEnabled ? "AUDIO ENABLED" : "ENABLE AUDIO"}</Button><Button size="sm" variant="outline" disabled={!hornAlarms.length} onClick={silence}>SILENCE</Button><Button size="sm" variant="outline" disabled={!unacknowledged} onClick={acknowledge}>ACK</Button><Button size="sm" variant="outline" onClick={testLamps}>LAMP TEST</Button></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{annunciators.map(item => <div key={item.id} className={`rounded border px-2 py-2 text-center text-[10px] font-black tracking-wide ${windowClass(item)}`}>{item.label}</div>)}</div><p className="mt-2 text-xs text-slate-300">{activeCount ? `${activeCount} active · ${unacknowledged} unacknowledged. SILENCE stops the horn only; ACK makes active windows steady and clears returned windows.` : unacknowledged ? `${unacknowledged} cleared, unacknowledged window(s) flashing slowly — press ACK to reset.` : "All annunciator windows normal."}</p></section>;
};
