import { Power } from "lucide-react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { ReactorMode } from "@/lib/rodProgram";

export const MaintainedSwitch = ({ label, on, onChange, disabled = false }: { label: string; on: boolean; onChange: (value: boolean) => void; disabled?: boolean }) => (
  <button type="button" disabled={disabled} onClick={() => onChange(!on)} aria-pressed={on} className="group flex min-w-28 flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
    <span className="text-[10px] font-bold tracking-widest text-slate-400">{label}</span>
    <span className={`relative h-14 w-8 rounded-md border-2 p-1 shadow-inner transition-colors ${on ? "border-emerald-400 bg-emerald-950" : "border-slate-600 bg-slate-950"}`}>
      <span className={`block h-5 w-full rounded-sm shadow transition-transform ${on ? "translate-y-6 bg-emerald-400" : "translate-y-0 bg-slate-400"}`} />
    </span>
    <span className={on ? "text-xs font-bold text-emerald-400" : "text-xs font-bold text-slate-500"}>{on ? "ON" : "OFF"}</span>
  </button>
);

export const SpringLever = ({ label, negativeLabel, positiveLabel, direction, onDirectionChange }: { label: string; negativeLabel: string; positiveLabel: string; direction: number; onDirectionChange: (direction: number) => void }) => {
  const release = () => onDirectionChange(0);
  const bind = (next: number) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => { event.currentTarget.setPointerCapture(event.pointerId); onDirectionChange(next); },
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => { if (event.key === " " || event.key === "Enter") onDirectionChange(next); },
    onKeyUp: release,
    onBlur: release,
  });
  return <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-center sm:p-4"><div className="mb-3 text-[10px] font-bold tracking-[.2em] text-slate-400">{label}</div><div className="flex items-center justify-center gap-2 sm:gap-4"><button type="button" {...bind(-1)} className={`min-h-12 touch-manipulation rounded-lg border px-3 py-3 text-xs font-bold transition sm:px-4 ${direction === -1 ? "border-red-400 bg-red-700 text-white" : "border-slate-600 bg-slate-800 text-slate-300"}`}>{negativeLabel}</button><div className="relative hidden h-16 w-10 items-end justify-center rounded-full border border-slate-600 bg-slate-800 p-1 sm:flex"><span className={`h-8 w-5 rounded bg-gradient-to-b from-slate-200 to-slate-500 shadow transition-transform ${direction === -1 ? "-translate-y-5" : direction === 1 ? "translate-y-0" : "-translate-y-2"}`} /></div><button type="button" {...bind(1)} className={`min-h-12 touch-manipulation rounded-lg border px-3 py-3 text-xs font-bold transition sm:px-4 ${direction === 1 ? "border-emerald-400 bg-emerald-700 text-white" : "border-slate-600 bg-slate-800 text-slate-300"}`}>{positiveLabel}</button></div><p className="mt-3 text-[10px] text-slate-500">HOLD TO MOVE · RELEASE TO STOP</p></div>;
};

export const SpringButton = ({ label, onClick, variant = "default", disabled = false }: { label: string; onClick: () => void; variant?: "default" | "danger"; disabled?: boolean }) => <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-4 px-6 text-sm font-black shadow-[0_5px_0_rgba(0,0,0,.5)] transition active:translate-y-1 active:shadow-none disabled:opacity-40 ${variant === "danger" ? "border-red-950 bg-red-600 text-white" : "border-emerald-950 bg-emerald-500 text-slate-950"}`}><Power size={16}/>{label}</button>;

export const ModeSelector = ({ value, onChange }: { value: ReactorMode; onChange: (mode: ReactorMode) => void }) => <div className="rounded-xl border border-slate-600 bg-gradient-to-b from-slate-700 to-slate-950 p-4 shadow-inner"><div className="mb-3 text-center text-[10px] font-bold tracking-[.22em] text-slate-300">REACTOR MODE</div><div className="grid grid-cols-4 gap-2">{(["SD", "SRM", "IPR", "RUN"] as ReactorMode[]).map(mode => <button key={mode} type="button" onClick={() => onChange(mode)} aria-pressed={value === mode} className={`rounded border px-2 py-3 text-xs font-black transition ${value === mode ? "border-amber-200 bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,.7)]" : "border-slate-600 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}>{mode}</button>)}</div><div className="mt-3 h-1 rounded bg-slate-950"><div className="h-1 rounded bg-amber-300 transition-all" style={{ width: `${(["SD", "SRM", "IPR", "RUN"] as ReactorMode[]).indexOf(value) * 33.33 + 2}%` }} /></div></div>;
