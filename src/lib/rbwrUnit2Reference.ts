/**
 * Small, dependency-free reference functions transcribed from RBWR V2 Unit 2.
 *
 * These are deliberately kept separate from the simulator's game tuning. The
 * process/UI can evolve without silently changing the source thresholds and
 * thermodynamic reference curves we compare it against.
 */

export type Unit2RpsInputs = {
  aprm: number;
  previousAprm: number;
  reactorLevelM: number;
  pressureKpa: number;
  reactorPeriodSeconds: number;
  mode: "SD" | "SRM" | "IPR" | "RUN";
  offsitePowerAvailable: boolean;
};

/** Unit 2 RPS full-trip initiating conditions (TripConditions.lua). */
export const getUnit2RpsTrips = (input: Unit2RpsInputs) => ({
  "REACTOR LEVEL": input.reactorLevelM < -4,
  "APRM UPSCALE": input.aprm > 125,
  // The source inhibits the low-power trip during the startup programme.
  "APRM DOWNSCALE": input.mode === "RUN" && input.aprm < 5,
  "RPV PRESSURE": input.pressureKpa >= 10_000,
  "LOW REACTOR PERIOD":
    input.reactorPeriodSeconds > 0 && input.reactorPeriodSeconds < 20,
  // Offsite loss is intentionally blocked below 50% APRM in Unit 2.
  "OFFSITE LOSS": !input.offsitePowerAvailable && input.aprm >= 50,
});

/**
 * Unit 2's pressure-to-saturation-temperature polynomial. Pressure is in MPa
 * and the result is degrees C. The source clamps the pressure input before
 * evaluating this curve.
 */
export const unit2SaturationTemperatureC = (pressureMpa: number) => {
  const p = Math.min(Math.max(pressureMpa, 0), 12);
  return (
    -0.0040964052 * p ** 6 +
    0.1417383107 * p ** 5 -
    1.9430568125 * p ** 4 +
    13.5042849307 * p ** 3 -
    51.2737887815 * p ** 2 +
    118.6853712464 * p +
    100.1541546689
  );
};

/** Unit 2 water-density polynomial, used for its level indication. */
export const unit2WaterDensityKgM3 = (temperatureC: number) =>
  -0.000004467711 * temperatureC ** 3 -
  0.000560288485 * temperatureC ** 2 -
  0.429148844451 * temperatureC +
  1010.035413387815;

/** Converts conserved vessel inventory to the density-corrected U2 level. */
export const unit2DisplayedLevelM = (
  baseLevel: number,
  temperatureC: number,
) => baseLevel / Math.max(0.1, unit2WaterDensityKgM3(temperatureC) / 1000) - 18;
