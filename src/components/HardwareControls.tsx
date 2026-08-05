import { Power } from "lucide-react";
import type { KeyboardEvent } from "react";

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
  const bind = (next: number) => ({ onPointerDown: () => onDirectionChange(next), onPointerUp: () => onDirectionChange(0), onPointerLeave: () => onDirectionChange(0), onPointerCancel: () => onDirectionChange(0), onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => { if (event.key === " " || event.key === "Enter") onDirectionChange(next); }, onKeyUp: () => onDirectionChange(0) });
  return <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-center"><div className="mb-3 text-[10px] font-bold tracking-[.2em] text-slate-400">{label}</div><div className="flex items-center justify-center gap-4"><button type="button" {...bind(-1)} className={`rounded-lg border px-4 py-3 text-xs font-bold transition ${direction === -1 ? "border-red-400 bg-red-700 text-white" : "border-slate-600 bg-slate-800 text-slate-300"}`}>{negativeLabel}</button><div className="relative flex h-16 w-10 items-end justify-center rounded-full border border-slate-600 bg-slate-800 p-1"><span className={`h-8 w-5 rounded bg-gradient-to-b from-slate-200 to-slate-500 shadow transition-transform ${direction === -1 ? "-translate-y-5" : direction === 1 ? "translate-y-0" : "-translate-y-2"}`} /></div><button type="button" {...bind(1)} className={`rounded-lg border px-4 py-3 text-xs font-bold transition ${direction === 1 ? "border-emerald-400 bg-emerald-700 text-white" : "border-slate-600 bg-slate-800 text-slate-300"}`}>{positiveLabel}</button></div><p className="mt-3 text-[10px] text-slate-500">SPRING RETURN TO NEUTRAL</p></div>;
};

export const SpringButton = ({ label, onClick, variant = "default", disabled = false }: { label: string; onClick: () => void; variant?: "default" | "danger"; disabled?: boolean }) => <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-4 px-6 text-sm font-black shadow-[0_5px_0_rgba(0,0,0,.5)] transition active:translate-y-1 active:shadow-none disabled:opacity-40 ${variant === "danger" ? "border-red-950 bg-red-600 text-white" : "border-emerald-950 bg-emerald-500 text-slate-950"}`}><Power size={16}/>{label}</button>;
