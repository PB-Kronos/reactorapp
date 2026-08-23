import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, GripHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TUTORIAL_LEVELS } from "@/lib/tutorialProgram";

export type TutorialProgress = {
  level: number;
  objectiveMet: boolean;
  aprmHeld?: number | null;
};

export function TutorialCoach({ progress, onAdvance, onExit }: { progress: TutorialProgress; onAdvance: () => void; onExit: () => void }) {
  const [popup, setPopup] = useState(0);
  const [windowRect, setWindowRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const coachRef = useRef<HTMLElement>(null);
  const pointerRef = useRef<{ kind: "move" | "resize"; x: number; y: number; rect: { left: number; top: number; width: number; height: number } } | null>(null);
  const lesson = TUTORIAL_LEVELS[Math.min(TUTORIAL_LEVELS.length - 1, Math.max(0, progress.level - 1))];
  const slide = lesson.slides[Math.min(lesson.slides.length - 1, popup)];
  const finalPopup = popup >= lesson.slides.length - 1;
  const finalLesson = progress.level >= TUTORIAL_LEVELS.length;
  useEffect(() => setPopup(0), [progress.level]);
  const beginPointer = (kind: "move" | "resize", event: React.PointerEvent) => {
    const box = coachRef.current?.getBoundingClientRect();
    if (!box) return;
    event.preventDefault();
    pointerRef.current = { kind, x: event.clientX, y: event.clientY, rect: { left: box.left, top: box.top, width: box.width, height: box.height } };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePointer = (event: React.PointerEvent) => {
    const pointer = pointerRef.current;
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    const maxWidth = Math.max(320, window.innerWidth - pointer.rect.left - 8);
    const maxHeight = Math.max(280, window.innerHeight - pointer.rect.top - 8);
    if (pointer.kind === "move") {
      setWindowRect({ ...pointer.rect, left: Math.max(8, Math.min(window.innerWidth - pointer.rect.width - 8, pointer.rect.left + dx)), top: Math.max(8, Math.min(window.innerHeight - pointer.rect.height - 8, pointer.rect.top + dy)) });
    } else {
      setWindowRect({ ...pointer.rect, width: Math.max(320, Math.min(maxWidth, pointer.rect.width + dx)), height: Math.max(280, Math.min(maxHeight, pointer.rect.height + dy)) });
    }
  };
  const endPointer = () => { pointerRef.current = null; };
  const rectStyle = windowRect ? { left: windowRect.left, top: windowRect.top, width: windowRect.width, height: windowRect.height, right: "auto", bottom: "auto" } : undefined;
  return <aside ref={coachRef} style={rectStyle} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={endPointer} className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-h-[calc(100vh-1.5rem)] w-auto max-w-2xl flex-col overflow-y-auto rounded-2xl border border-cyan-400/50 bg-slate-950/98 p-5 shadow-2xl backdrop-blur sm:bottom-6 sm:right-6 sm:left-auto sm:max-h-[calc(100vh-3rem)] sm:w-[min(42rem,calc(100vw-3rem))] sm:p-6">
    <div onPointerDown={event => beginPointer("move", event)} className="flex cursor-move touch-none items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-[10px] font-black tracking-[.22em] text-cyan-300"><GripHorizontal className="h-3.5 w-3.5 text-slate-500" /><BookOpen className="h-3.5 w-3.5" /> TRAINING MODE · LEVEL {progress.level}/{TUTORIAL_LEVELS.length} · POPUP {popup + 1}/{lesson.slides.length}</p><h2 className="mt-1 text-lg font-black text-slate-100">{slide.title}</h2></div><Button size="icon" variant="ghost" className="text-slate-400 hover:text-white" onPointerDown={event => event.stopPropagation()} onClick={onExit} title="Exit training"><X className="h-4 w-4" /></Button></div>
    <p className="mt-3 text-xs font-bold text-cyan-200">{lesson.title.toUpperCase()} · SYSTEM: {slide.system}</p><p className="mt-2 text-base leading-7 text-slate-200">{slide.text}</p>
    {slide.why && <div className="mt-3 rounded-lg border border-violet-400/20 bg-violet-400/10 p-3"><p className="text-xs font-black tracking-wide text-violet-200">WHY THIS MATTERS</p><p className="mt-1 text-sm leading-6 text-slate-200">{slide.why}</p></div>}
    {slide.mechanics?.length ? <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3"><p className="text-xs font-black tracking-wide text-amber-100">WHAT THE SIMULATOR IS CALCULATING</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-5 text-slate-200">{slide.mechanics.map(item => <li key={item}>{item}</li>)}</ul></div> : null}
    {slide.watch?.length ? <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/80 p-3"><p className="text-xs font-black tracking-wide text-slate-200">WATCH FOR</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-5 text-slate-300">{slide.watch.map(item => <li key={item}>{item}</li>)}</ul></div> : null}
    {slide.action && <p className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-100"><strong>NEXT ACTION:</strong> {slide.action}</p>}
    {progress.aprmHeld && <p className="mt-3 rounded border border-emerald-400/30 bg-emerald-500/10 p-2 text-xs font-bold text-emerald-200">CONTROLLED ENVIRONMENT: APRM held at {progress.aprmHeld.toFixed(0)}%</p>}
    <div className="mt-3 rounded bg-slate-900 p-3 text-xs"><div className="flex items-center gap-2 font-bold text-slate-200"><CheckCircle2 className={progress.objectiveMet ? "h-4 w-4 text-emerald-400" : "h-4 w-4 text-slate-500"} />{lesson.objective}</div></div>
    <p className="mt-4 text-[11px] text-slate-400">Take your time: training does not auto-advance and the objective remains available after you review every popup.</p><div className="mt-3 flex gap-2">{popup > 0 && <Button variant="outline" className="border-slate-600 text-slate-200" onClick={() => setPopup(value => value - 1)}><ChevronLeft className="mr-1 h-4 w-4" />BACK</Button>}{!finalPopup ? <Button className="flex-1 bg-cyan-400 font-bold text-slate-950 hover:bg-cyan-300" onClick={() => setPopup(value => value + 1)}>NEXT POPUP<ChevronRight className="ml-1 h-4 w-4" /></Button> : !finalLesson && <Button className="flex-1 bg-cyan-400 font-bold text-slate-950 hover:bg-cyan-300" disabled={!progress.objectiveMet} onClick={onAdvance}>CONTINUE TO LEVEL {progress.level + 1}<ChevronRight className="ml-1 h-4 w-4" /></Button>}</div>
    <div onPointerDown={event => beginPointer("resize", event)} className="absolute bottom-1 right-1 h-7 w-7 cursor-se-resize touch-none after:absolute after-bottom-1 after-right-1 after:h-3 after:w-3 after:border-b-2 after:border-r-2 after:border-cyan-300/80" title="Drag to resize" />
  </aside>;
}
