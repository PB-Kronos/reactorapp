export type ThermalOutput = { mw: number; steamKgS: number };
type ThermalRow = ThermalOutput & { thermal: number };

// U2 v1.7.5 measurements: thermal/APRM %, turbine MW, total steam kg/s.
const U2_TABLE: ThermalRow[] = [
  { thermal: 0, mw: 0, steamKgS: 0 }, { thermal: 20, mw: 106.54, steamKgS: 361 },
  { thermal: 25.014, mw: 166.61, steamKgS: 426 }, { thermal: 30.008, mw: 227.77, steamKgS: 490 },
  { thermal: 35.009, mw: 289.11, steamKgS: 554 }, { thermal: 40.066, mw: 351.4, steamKgS: 618 },
  { thermal: 45.066, mw: 413.06, steamKgS: 685 }, { thermal: 50.016, mw: 474.44, steamKgS: 749 },
  { thermal: 55.115, mw: 537.78, steamKgS: 817 }, { thermal: 60.161, mw: 600.82, steamKgS: 882 },
  { thermal: 65.159, mw: 663.46, steamKgS: 949 }, { thermal: 70.157, mw: 726.33, steamKgS: 1016 },
  { thermal: 75.205, mw: 760.64, steamKgS: 1083 }, { thermal: 80.002, mw: 851.47, steamKgS: 1147 },
  { thermal: 85.152, mw: 900.6, steamKgS: 1223 }, { thermal: 90.277, mw: 964.89, steamKgS: 1294 },
];

export const getU2ThermalOutput = (thermal: number): ThermalOutput => {
  const value = Math.max(0, Math.min(90.277, thermal));
  const upper = U2_TABLE.findIndex(row => (row.thermal ?? 0) >= value);
  if (upper <= 0) return { mw: 0, steamKgS: 0 };
  const low = U2_TABLE[upper - 1]; const high = U2_TABLE[upper];
  const fraction = (value - (low.thermal ?? 0)) / ((high.thermal ?? 1) - (low.thermal ?? 0));
  return { mw: low.mw + (high.mw - low.mw) * fraction, steamKgS: low.steamKgS + (high.steamKgS - low.steamKgS) * fraction };
};
