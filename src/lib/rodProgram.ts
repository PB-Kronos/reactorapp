export type ReactorMode = "SD" | "SRM" | "IPR" | "RUN";
export type AutoSpeed = "slow" | "medium" | "fast";
export type RodSelectionScope = "rod" | "group" | "all";

export interface ControlRod { id: string; row: number; column: number; group: string; position: number; temperature: number; angle: number; radius: number; }
export const AUTO_ROD_RATES: Record<AutoSpeed, number> = { slow: 0.5, medium: 1, fast: 2 };
export const WITHDRAWAL_RATES = { startup: 5 / 3.5, run: 3 };

/** Temporary circular 36-rod core. Replace this map when an exact U2 pattern becomes available. */
export const createInitialRods = (): ControlRod[] => Array.from({ length: 36 }, (_, index) => ({ id: `${String.fromCharCode(65 + Math.floor(index / 6))}${index % 6 + 1}`, row: Math.floor(index / 6), column: index % 6, group: `G${index % 6 + 1}`, position: 100, temperature: 25, angle: index * 10, radius: 43 }));
export const cycleLimit = (mode: ReactorMode, iprCycle: number) => mode === "SRM" ? 95 : mode === "IPR" ? 95 - iprCycle * 5 : 0;
export const isCycleComplete = (rods: ControlRod[], mode: ReactorMode, iprCycle: number) => rods.every(rod => rod.position <= cycleLimit(mode, iprCycle) + .01);
export const nextWithdrawableRod = (rods: ControlRod[], mode: ReactorMode, iprCycle: number) => mode === "SD" ? undefined : rods.find(rod => rod.position > cycleLimit(mode, iprCycle) + .01);
export const getAprm = (rods: ControlRod[]) => Math.min(100, rods.reduce((sum, rod) => sum + (100 - rod.position), 0) / rods.length * .5);
