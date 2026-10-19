import { getU2ThermalOutput } from "../src/lib/thermalOutput";
import { stepUnit2Process, type Unit2ProcessState } from "../src/lib/rbwrUnit2Process";
import { getUnit2RpsTrips, unit2SaturationTemperatureC } from "../src/lib/rbwrUnit2Reference";

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

const run = (
  initial: Unit2ProcessState,
  seconds: number,
  input: Parameters<typeof stepUnit2Process>[1],
) => {
  let state = initial;
  for (let elapsed = 0; elapsed < seconds; elapsed += .25) {
    state = stepUnit2Process(state, input, .25);
    assert(Number.isFinite(state.temperatureC), "temperature became non-finite");
    assert(Number.isFinite(state.pressureKpa), "pressure became non-finite");
    assert(Number.isFinite(state.turbineSpeed), "turbine speed became non-finite");
  }
  return state;
};

const cold: Unit2ProcessState = {
  temperatureC: 25,
  pressureKpa: 101,
  fuelPercent: 100,
  turbineSpeed: 0,
  gridSyncPercent: 0,
};
const thermal = getU2ThermalOutput(20.1);
const baseInput = {
  isRunning: true,
  aprm: 20.1,
  thermalSteamKgS: thermal.steamKgS,
  turbineSteamKgS: 0,
  bypassSteamKgS: 0,
  feedwaterKgS: 1_500,
  reliefValvesOpen: 0,
  targetTurbineSpeed: 0,
  isSynchronized: false,
  turningGearActive: false,
  thermalResponse: 1,
  steamProductionMultiplier: 1,
  steamRemovalMultiplier: 1,
};

assert(unit2SaturationTemperatureC(7.1) > 280 && unit2SaturationTemperatureC(7.1) < 295,
  "Unit 2 saturation polynomial is outside its normal 7.1 MPa band");

const pressurized = run(cold, 240, baseInput);
assert(pressurized.pressureKpa > 5_000,
  `20% APRM did not produce usable startup steam (${pressurized.pressureKpa.toFixed(0)} kPa)`);

const admitted = run(pressurized, 90, {
  ...baseInput,
  turbineSteamKgS: 200,
  targetTurbineSpeed: 66.67,
});
assert(admitted.pressureKpa > 3_500 && admitted.pressureKpa < 9_500,
  `admitted steam did not settle within the usable operating band (${admitted.pressureKpa.toFixed(0)} kPa)`);
assert(admitted.turbineSpeed > 55,
  "200 kg/s admission did not run the turbine toward synchronous speed");

const relieved = run(admitted, 20, {
  ...baseInput,
  turbineSteamKgS: 200,
  reliefValvesOpen: 6,
});
assert(relieved.pressureKpa < admitted.pressureKpa,
  "opening MSRVs did not depressurize the vessel");

const synchronized = run(admitted, 5, {
  ...baseInput,
  turbineSteamKgS: 200,
  isSynchronized: true,
  targetTurbineSpeed: 66.67,
});
assert(Math.abs(synchronized.turbineSpeed - 66.67) < 1,
  "synchronized turbine was not held at synchronous speed");

const trips = getUnit2RpsTrips({
  aprm: 60,
  previousAprm: 60,
  reactorLevelM: -4.1,
  pressureKpa: 10_000,
  reactorPeriodSeconds: 19,
  mode: "RUN",
  offsitePowerAvailable: false,
});
assert(trips["REACTOR LEVEL"] && trips["RPV PRESSURE"] && trips["LOW REACTOR PERIOD"] && trips["OFFSITE LOSS"],
  "Unit 2 RPS threshold checks did not latch the required protections");

console.log("RBWR Unit 2 process checks passed.");
