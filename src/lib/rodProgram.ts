export type ReactorMode = "SD" | "SRM" | "IPR" | "RUN";
export type AutoSpeed = "slow" | "medium" | "fast";
export type ManualSpeed = "slow" | "normal" | "fast";
export type RodSelectionScope = "rod" | "group" | "all";

export interface ControlRod { id: string; row: number; column: number; group: string; position: number; temperature: number; angle: number; radius: number; }
export const AUTO_ROD_RATES: Record<AutoSpeed, number> = { slow: 0.5, medium: 1, fast: 2 };
export const WITHDRAWAL_RATES = { startup: 5 / 3.5, run: 3 };
export const MANUAL_ROD_RATES: Record<ManualSpeed, number> = { slow: .5, normal: 1, fast: 2 };

/** Temporary circular 36-rod core. Replace this map when an exact U2 pattern becomes available. */
export const createInitialRods = (): ControlRod[] => Array.from({ length: 36 }, (_, index) => ({ id: `${String.fromCharCode(65 + Math.floor(index / 6))}${index % 6 + 1}`, row: Math.floor(index / 6), column: index % 6, group: `G${index % 6 + 1}`, position: 100, temperature: 25, angle: index * 10, radius: 43 }));
export const cycleLimit = (mode: ReactorMode, iprCycle: number) => mode === "SRM" ? 95 : mode === "IPR" ? 95 - iprCycle * 5 : 0;
export const isCycleComplete = (rods: ControlRod[], mode: ReactorMode, iprCycle: number) => rods.every(rod => rod.position <= cycleLimit(mode, iprCycle) + .01);
/**
 * Temporary U2-inspired startup order. It begins in the central region and
 * alternates across the core instead of following the display's A1 → F6 order.
 * Replace this data only when an authoritative Unit 2 sequence is available.
 */
export const STARTUP_WITHDRAWAL_ORDER = [
  "C3", "D4", "C4", "D3", "B3", "E4", "B4", "E3", "C2", "D5", "C5", "D2",
  "B2", "E5", "B5", "E2", "A3", "F4", "A4", "F3", "C1", "D6", "C6", "D1",
  "B1", "E6", "B6", "E1", "A2", "F5", "A5", "F2", "A1", "F6", "A6", "F1",
];
export const nextWithdrawableRod = (rods: ControlRod[], mode: ReactorMode, iprCycle: number) => {
  if (mode === "SD") return undefined;
  const limit = cycleLimit(mode, iprCycle);
  return STARTUP_WITHDRAWAL_ORDER
    .map(id => rods.find(rod => rod.id === id))
    .find((rod): rod is ControlRod => Boolean(rod && rod.position > limit + .01));
};
// Rod withdrawal supplies 75 APRM points at full withdrawal. Recirculation
// provides the additional operating margin, with total APRM still protected
// by the simulator's 115% cap.
export const getAprm = (rods: ControlRod[]) => Math.min(100, rods.reduce((sum, rod) => sum + (100 - rod.position), 0) / rods.length * .75);
