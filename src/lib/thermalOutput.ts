export type ThermalOutput = { mw: number; steamKgS: number };
type ThermalRow = ThermalOutput & { aprm: number };

/*
 * Unit 2 load calibration. These are the supplied MW <-> APRM conversion
 * points stored in the direction the simulator needs (APRM -> load). The old
 * table ended at 90.277% APRM, so it understated high-power operation.
 *
 * Steam is calibrated so 100% APRM produces the Unit 2 full-load target of
 * about 1,200 MW with a fully-open main valve at nominal pressure. The
 * published 1,145.52 MW point remains the APRM/load reference; the small
 * normalization factor represents the simulator's nominal generator output.
 */
const NOMINAL_TURBINE_MW_PER_KG_S = 1.8 * 0.34191;
const FULL_LOAD_REFERENCE_MW = 1145.52;
const FULL_LOAD_GENERATOR_MW = 1200;
const GENERATOR_NORMALIZATION = FULL_LOAD_GENERATOR_MW / FULL_LOAD_REFERENCE_MW;
// The automatic governor normally holds roughly 73.5% admission at rated
// pressure. This converts the reference curve to usable plant flow so rated
// APRM produces rated load during normal, regulated operation.
export const U2_OPERATING_FLOW_NORMALIZATION = 1 / 0.735;
const steamForMw = (mw: number) =>
  (mw * GENERATOR_NORMALIZATION * U2_OPERATING_FLOW_NORMALIZATION) /
  NOMINAL_TURBINE_MW_PER_KG_S;

const U2_LOAD_TABLE: ThermalRow[] = [
  { aprm: 0, mw: 0, steamKgS: 0 },
  { aprm: 12.34, mw: 0, steamKgS: 0 },
  { aprm: 20.1, mw: 100, steamKgS: steamForMw(100) },
  { aprm: 20.87, mw: 110, steamKgS: steamForMw(110) },
  { aprm: 50, mw: 484.86, steamKgS: steamForMw(484.86) },
  { aprm: 89.32, mw: 1000, steamKgS: steamForMw(1000) },
  { aprm: 100, mw: 1145.52, steamKgS: steamForMw(1145.52) },
];

export const getU2ThermalOutput = (aprm: number): ThermalOutput => {
  const value = Math.max(0, Math.min(100, aprm));
  const upper = U2_LOAD_TABLE.findIndex(row => row.aprm >= value);
  if (upper <= 0) return { mw: 0, steamKgS: 0 };

  const low = U2_LOAD_TABLE[upper - 1];
  const high = U2_LOAD_TABLE[upper];
  const fraction = (value - low.aprm) / (high.aprm - low.aprm);
  return {
    mw: low.mw + (high.mw - low.mw) * fraction,
    steamKgS: low.steamKgS + (high.steamKgS - low.steamKgS) * fraction,
  };
};

/** Inverse of the calibrated steam/APRM curve, for operator planning tools. */
export const getAprmForSteamKgS = (steamKgS: number): number => {
  const required = Math.max(0, steamKgS);
  const upper = U2_LOAD_TABLE.findIndex(row => row.steamKgS >= required);
  if (upper <= 0) return 0;
  if (upper === -1) return 100 + (required - U2_LOAD_TABLE.at(-1)!.steamKgS) / Math.max(1, U2_LOAD_TABLE.at(-1)!.steamKgS) * 100;

  const low = U2_LOAD_TABLE[upper - 1];
  const high = U2_LOAD_TABLE[upper];
  const fraction = (required - low.steamKgS) / Math.max(.000001, high.steamKgS - low.steamKgS);
  return low.aprm + (high.aprm - low.aprm) * fraction;
};
