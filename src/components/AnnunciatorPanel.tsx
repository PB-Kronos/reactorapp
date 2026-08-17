import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Annunciator = { id: string; label: string; active: boolean; priority: "amber" | "red" | "blue"; tone: "low" | "high" | "pulse" | "warble" | "chime" | "double"; pan?: "left" | "center" | "right"; page?: string; sample?: string; endingCueSeconds?: number };
interface Props { annunciators: Annunciator[]; page?: string; }
type WindowState = { active: boolean; acknowledged: boolean; silenced: boolean };

const toneMap: Record<Annunciator["tone"], number[]> = { low: [330], high: [880], pulse: [540, 540, 540], warble: [620, 780, 620, 780], chime: [740, 988], double: [420, 420] };

export const AnnunciatorPanel = ({ annunciators, page = document.body.dataset.rbwrPanel || "status" }: Props) => {
  const context = useRef<AudioContext | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [ambienceEnabled, setAmbienceEnabled] = useState(() => localStorage.getItem("rbwr-ambience-enabled") === "true");
  const [lampTest, setLampTest] = useState(false);
  const [windows, setWindows] = useState<Record<string, WindowState>>({});
  const sampleSources = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const pendingSamples = useRef<Map<string, symbol>>(new Map());
  const sampleBuffers = useRef<Map<string, AudioBuffer>>(new Map());
  const sampleLoopRanges = useRef<Map<string, { start: number; end: number }>>(new Map());
  const ambienceSource = useRef<AudioBufferSourceNode | null>(null);
  const annunciatorSignature = annunciators.map(item => `${item.id}:${item.active}:${item.priority}:${item.sample ?? ""}`).join("|");

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
      // Blue windows are advisory status lamps: no horn, acknowledgement, or flashing.
      if (item.priority === "blue") return [item.id, { active: item.active, acknowledged: true, silenced: true }];
      // A rising sensor condition starts a new, unacknowledged annunciation.
      return [item.id, item.active && !prior.active ? { active: true, acknowledged: false, silenced: false } : { ...prior, active: item.active }];
    })));
  }, [annunciatorSignature]);

  useEffect(() => {
    const playEndingCue = (item: Annunciator) => { const buffer = item.sample ? sampleBuffers.current.get(item.sample) : undefined; if (!buffer || !item.endingCueSeconds || !context.current) return; const source = context.current.createBufferSource(); const gain = context.current.createGain(); const duration = Math.min(item.endingCueSeconds, buffer.duration); source.buffer = buffer; gain.gain.value = .28; source.connect(gain).connect(context.current.destination); source.start(0, Math.max(0, buffer.duration - duration), duration); };
    const stopSample = (item: Annunciator) => { pendingSamples.current.delete(item.id); const source = sampleSources.current.get(item.id); if (source) { source.stop(); source.disconnect(); sampleSources.current.delete(item.id); if (item.endingCueSeconds) playEndingCue(item); } };
    annunciators.forEach(item => {
      const state = windows[item.id];
      const shouldLoop = Boolean(item.priority !== "blue" && audioEnabled && item.sample && item.active && state && !state.acknowledged && !state.silenced);
      if (!shouldLoop) { stopSample(item); return; }
      if (sampleSources.current.has(item.id) || pendingSamples.current.has(item.id)) return;
      const request = Symbol(item.id); pendingSamples.current.set(item.id, request);
      void (async () => {
        try {
          if (!context.current) context.current = new AudioContext();
          const audio = context.current;
          if (audio.state === "suspended") await audio.resume();
          let buffer = sampleBuffers.current.get(item.sample!);
          if (!buffer) { const response = await fetch(item.sample!); buffer = await audio.decodeAudioData(await response.arrayBuffer()); sampleBuffers.current.set(item.sample!, buffer); }
          if (pendingSamples.current.get(item.id) !== request) return;
          const source = audio.createBufferSource(); const gain = audio.createGain();
          const cacheKey = `${item.sample}:${item.endingCueSeconds ?? 0}`;
          let loopRange = sampleLoopRanges.current.get(cacheKey);
          if (!loopRange) { const loopLimit = Math.max(.05, buffer.duration - (item.endingCueSeconds ?? 0)); const samples = buffer.getChannelData(0); const limit = Math.min(samples.length, Math.floor(loopLimit * buffer.sampleRate)); const threshold = .0015; let first = 0; let last = Math.max(0, limit - 1); while (first < last && Math.abs(samples[first]) < threshold) first++; while (last > first && Math.abs(samples[last]) < threshold) last--; loopRange = { start: first / buffer.sampleRate, end: Math.max((first + 1) / buffer.sampleRate, (last + 1) / buffer.sampleRate) }; sampleLoopRanges.current.set(cacheKey, loopRange); }
          source.buffer = buffer; source.loop = true; source.loopStart = loopRange.start; source.loopEnd = loopRange.end; gain.gain.value = .28;
          source.connect(gain).connect(audio.destination); source.onended = () => { if (sampleSources.current.get(item.id) === source) sampleSources.current.delete(item.id); };
          pendingSamples.current.delete(item.id); sampleSources.current.set(item.id, source); source.start();
        } catch { pendingSamples.current.delete(item.id); }
      })();
    });
    return () => {};
  }, [annunciators, windows, audioEnabled]);
  useEffect(() => () => { pendingSamples.current.clear(); sampleSources.current.forEach(source => { source.stop(); source.disconnect(); }); sampleSources.current.clear(); }, []);
  useEffect(() => {
    localStorage.setItem("rbwr-ambience-enabled", String(ambienceEnabled));
    ambienceSource.current?.stop(); ambienceSource.current = null;
    if (!ambienceEnabled) return;
    let cancelled = false;
    const startGaplessHum = async () => { try { if (!context.current) context.current = new AudioContext(); const audio = context.current; if (audio.state === "suspended") await audio.resume(); const response = await fetch("/sounds/control-room-hum.mp3"); const buffer = await audio.decodeAudioData(await response.arrayBuffer()); if (cancelled) return; const source = audio.createBufferSource(); const gain = audio.createGain(); source.buffer = buffer; source.loop = true; source.loopStart = 0; source.loopEnd = buffer.duration; gain.gain.value = .16; source.connect(gain).connect(audio.destination); source.start(); ambienceSource.current = source; } catch {} };
    void startGaplessHum();
    return () => { cancelled = true; ambienceSource.current?.stop(); ambienceSource.current = null; };
  }, [ambienceEnabled]);
  useEffect(() => () => { ambienceSource.current?.stop(); ambienceSource.current = null; }, []);

  const localAnnunciators = useMemo(() => annunciators.filter(item => (item.page || "status") === page), [annunciators, page]);
  const localIds = useMemo(() => new Set(localAnnunciators.map(item => item.id)), [localAnnunciators]);
  const hornAlarms = useMemo(() => annunciators.filter(item => { const state = windows[item.id]; return item.priority !== "blue" && !item.sample && item.active && state && !state.acknowledged && !state.silenced; }), [annunciators, windows]);
  const localAudibleAlarms = useMemo(() => localAnnunciators.filter(item => { const state = windows[item.id]; return item.priority !== "blue" && item.active && state && !state.acknowledged && !state.silenced; }), [localAnnunciators, windows]);
  useEffect(() => {
    if (!audioEnabled || !hornAlarms.length) return;
    sound(hornAlarms[0]);
    const timer = window.setInterval(() => sound(hornAlarms[0]), 1200);
    return () => window.clearInterval(timer);
  }, [audioEnabled, hornAlarms]);

  const acknowledge = () => { window.dispatchEvent(new CustomEvent("rbwr-annunciator-ack", { detail: { page, ids: [...localIds] } })); setWindows(previous => Object.fromEntries(Object.entries(previous).map(([id, state]) => [id, localIds.has(id) ? { ...state, acknowledged: true, silenced: false } : state]))); };
  const silence = () => { window.dispatchEvent(new CustomEvent("rbwr-annunciator-silence", { detail: { page, ids: [...localIds] } })); setWindows(previous => Object.fromEntries(Object.entries(previous).map(([id, state]) => [id, localIds.has(id) && state.active && !state.acknowledged ? { ...state, silenced: true } : state]))); };
  const masterAcknowledge = () => { const ids = annunciators.map(item => item.id); window.dispatchEvent(new CustomEvent("rbwr-annunciator-ack", { detail: { page: "master", ids } })); setWindows(previous => Object.fromEntries(Object.entries(previous).map(([id, state]) => [id, { ...state, acknowledged: true, silenced: false }]))); };
  const masterSilence = () => { const ids = annunciators.map(item => item.id); window.dispatchEvent(new CustomEvent("rbwr-annunciator-silence", { detail: { page: "master", ids } })); setWindows(previous => Object.fromEntries(Object.entries(previous).map(([id, state]) => [id, state.active && !state.acknowledged ? { ...state, silenced: true } : state]))); };
  const testLamps = () => { setLampTest(true); window.setTimeout(() => setLampTest(false), 1000); };
  const activeCount = localAnnunciators.filter(item => item.active).length;
  const unacknowledged = localAnnunciators.filter(item => !(windows[item.id]?.acknowledged ?? true)).length;

  const windowClass = (item: Annunciator) => {
    const state = windows[item.id] ?? { active: item.active, acknowledged: true, silenced: false };
    const color = item.priority === "red" ? "border-red-400 bg-red-600 text-white" : item.priority === "blue" ? "border-sky-300 bg-sky-500 text-slate-950" : "border-amber-300 bg-amber-400 text-slate-950";
    if (lampTest) return `${color} annunciator-steady`;
    if (item.priority === "blue") return state.active ? `${color} annunciator-steady` : "border-slate-700 bg-slate-950 text-slate-500";
    if (state.active && !state.acknowledged) return `${color} annunciator-fast-flash`;
    if (state.active && state.acknowledged) return `${color} annunciator-steady`;
    if (!state.active && !state.acknowledged) return `${color} annunciator-slow-flash`;
    return "border-slate-700 bg-slate-950 text-slate-500";
  };

  return <section className="mb-5 rounded-xl border border-amber-500/30 bg-slate-900/80 p-3"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2 font-bold text-amber-100"><BellRing className="h-4 w-4"/>ANNUNCIATOR WINDOW</div><p className="text-[10px] text-slate-400">Local windows shown · all plant sensors remain live and audible</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setAmbienceEnabled(value => !value)}>{ambienceEnabled ? <Volume2 className="mr-1 h-4 w-4"/> : <VolumeX className="mr-1 h-4 w-4"/>}{ambienceEnabled ? "HUM ON" : "HUM OFF"}</Button><Button size="sm" variant="outline" onClick={() => { setAudioEnabled(value => !value); if (!audioEnabled) sound({ id: "test", label: "TEST", active: true, priority: "amber", tone: "chime", pan: "center" }); }}>{audioEnabled ? <Volume2 className="mr-1 h-4 w-4"/> : <VolumeX className="mr-1 h-4 w-4"/>}{audioEnabled ? "AUDIO ENABLED" : "ENABLE AUDIO"}</Button><Button size="sm" variant="outline" disabled={!localAudibleAlarms.length} onClick={silence}>SILENCE</Button><Button size="sm" variant="outline" disabled={!unacknowledged} onClick={acknowledge}>ACK</Button><Button size="sm" variant="secondary" disabled={!hornAlarms.length && !annunciators.some(item => { const state = windows[item.id]; return Boolean(item.sample && item.priority !== "blue" && item.active && state && !state.acknowledged && !state.silenced); })} onClick={masterSilence}>MASTER SILENCE</Button><Button size="sm" variant="secondary" disabled={!Object.values(windows).some(state => !state.acknowledged)} onClick={masterAcknowledge}>MASTER ACK</Button><Button size="sm" variant="outline" onClick={testLamps}>LAMP TEST</Button></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{annunciators.map(item => <div key={item.id} data-annunciator-page={item.page || "status"} className={`rbwr-annunciator rounded border px-2 py-2 text-center text-[10px] font-black tracking-wide ${windowClass(item)}`}>{item.label}</div>)}</div><p className="mt-2 text-xs text-slate-300">{activeCount ? `${activeCount} local active · ${unacknowledged} local unacknowledged. SILENCE and ACK affect this panel only.` : unacknowledged ? `${unacknowledged} local cleared, unacknowledged window(s) flashing slowly — press ACK to reset.` : "All local annunciator windows normal."}</p></section>;
};
