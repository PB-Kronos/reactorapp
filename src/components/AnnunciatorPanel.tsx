import { useEffect, useRef, useState } from "react";
import { BellRing, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Annunciator = { id: string; label: string; active: boolean; priority: "amber" | "red"; tone: "low" | "high" | "pulse" | "warble" | "chime" | "double" };

interface Props { annunciators: Annunciator[]; }

const toneMap: Record<Annunciator["tone"], number[]> = {
  low: [330], high: [880], pulse: [540, 540, 540], warble: [620, 780, 620, 780], chime: [740, 988], double: [420, 420],
};

export const AnnunciatorPanel = ({ annunciators }: Props) => {
  const context = useRef<AudioContext | null>(null);
  const previous = useRef(new Set<string>());
  const [armed, setArmed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const active = annunciators.filter(item => item.active);

  const sound = (item: Annunciator) => {
    if (!context.current) context.current = new AudioContext();
    const audio = context.current;
    if (audio.state === "suspended") void audio.resume();
    toneMap[item.tone].forEach((frequency, index) => {
      const oscillator = audio.createOscillator(); const gain = audio.createGain();
      const start = audio.currentTime + index * .16;
      oscillator.type = item.priority === "red" ? "square" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(item.priority === "red" ? .11 : .07, start + .015); gain.gain.exponentialRampToValueAtTime(.0001, start + .13);
      oscillator.connect(gain).connect(audio.destination); oscillator.start(start); oscillator.stop(start + .14);
    });
  };

  useEffect(() => {
    const current = new Set(active.map(item => item.id));
    const newAlarm = active.find(item => !previous.current.has(item.id));
    if (armed && !acknowledged && newAlarm) sound(newAlarm);
    if (newAlarm) setAcknowledged(false);
    previous.current = current;
  }, [active, armed, acknowledged]);

  return <section className="mb-5 rounded-xl border border-amber-500/30 bg-slate-900/80 p-3">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 font-bold text-amber-100"><BellRing className="h-4 w-4"/>ANNUNCIATOR WINDOW</div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setArmed(value => !value); if (!armed) sound({ id: "test", label: "TEST", active: true, priority: "amber", tone: "chime" }); }}>{armed ? <Volume2 className="mr-1 h-4 w-4"/> : <VolumeX className="mr-1 h-4 w-4"/>}{armed ? "SOUND ARMED" : "ARM SOUND"}</Button><Button size="sm" variant="outline" disabled={!active.length} onClick={() => setAcknowledged(true)}>ACK</Button><Button size="sm" variant="outline" onClick={() => annunciators.forEach(sound)}>LAMP TEST</Button></div></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{annunciators.map(item => <div key={item.id} className={`rounded border px-2 py-2 text-center text-[10px] font-black tracking-wide ${item.active ? item.priority === "red" ? "animate-pulse border-red-400 bg-red-600 text-white" : "border-amber-300 bg-amber-400 text-slate-950" : "border-slate-700 bg-slate-950 text-slate-500"}`}>{item.label}</div>)}</div>
    {active.length > 0 && <p className="mt-2 text-xs text-slate-300">{acknowledged ? "Alarm acknowledged — lamps remain lit until their conditions clear." : "New annunciation active — use ACK to silence the horn."}</p>}
  </section>;
};
