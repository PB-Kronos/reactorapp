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
// SRM is a single 5% source-range step. The IPR withdrawal block is governed
// by the completed startup cycle, never by the operator's IRM display range.
export const cycleLimit = (mode: ReactorMode, startupCycle: number) => {
  if (mode === "SRM") return 95;
  if (mode !== "IPR") return 0;
  const cycle = Math.max(1, Math.min(8, startupCycle));
  // SRM ends at 5% withdrawn. Each completed startup cycle unlocks another
  // 5%; cycle 8 is the final 50% withdrawal window, where rod power reaches
  // 10%+. The selected IRM display range does not appear in this calculation.
  const withdrawnLimit = cycle === 8 ? 50 : 5 + cycle * 5;
  return 100 - withdrawnLimit;
};
export const isCycleComplete = (rods: ControlRod[], mode: ReactorMode, startupCycle: number) => rods.every(rod => rod.position <= cycleLimit(mode, startupCycle) + .01);
export const getIrmEquivalentAprm = (irmRange: number, irmPosition: number) =>
  Math.pow(10, (Math.max(1, Math.min(8, Number.isFinite(irmRange) ? irmRange : 1)) - 6) / 2) * (Math.max(0, Math.min(100, Number.isFinite(irmPosition) ? irmPosition : 0)) / 50);
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
export const nextWithdrawableRod = (rods: ControlRod[], mode: ReactorMode, startupCycle: number) => {
  if (mode === "SD") return undefined;
  const limit = cycleLimit(mode, startupCycle);
  return STARTUP_WITHDRAWAL_ORDER
    .map(id => rods.find(rod => rod.id === id))
    .find((rod): rod is ControlRod => Boolean(rod && rod.position > limit + .01));
};
// Rod flux is independent of the operator's selected IRM display range. It
// rises exponentially from source range, then levels into the R8 scale. The
// active IRM range merely rescales that same flux for its 0–100% indication.
// Above the early source/intermediate response, the core becomes progressively
// more responsive as it enters its normal operating range. The curve is
// anchored at 50% average withdrawal = 20% rod APRM and full withdrawal =
// 75% rod APRM. It preserves the low-power source response before that knee,
// while recirculation remains the complementary power-control path.
export const getAprm = (rods: ControlRod[]) => {
  if (!rods.length) return 0;
  const withdrawn = rods.reduce((sum, rod) => sum + (100 - (Number.isFinite(rod.position) ? rod.position : 100)), 0) / rods.length;
  const physicalRange = Math.max(1, Math.min(8, 1 + Math.max(0, withdrawn - 5) * .43));
  const sourceAndIntermediateAprm = Math.pow(10, (physicalRange - 6) / 2) * (withdrawn / 50);
  if (sourceAndIntermediateAprm <= 5) return sourceAndIntermediateAprm;
  const aboveKnee = sourceAndIntermediateAprm - 5;
  // Smooth cubic: f(5)=5, f(10)=20, f(20)=75. Keeping the first derivative
  // continuous avoids a visible reactivity jump when crossing the knee.
  return Math.min(
    75,
    sourceAndIntermediateAprm + (43 / 90) * aboveKnee ** 2 - (7 / 450) * aboveKnee ** 3,
  );
};
