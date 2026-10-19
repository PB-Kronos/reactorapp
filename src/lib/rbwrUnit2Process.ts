import { unit2SaturationTemperatureC } from "@/lib/rbwrUnit2Reference";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export type Unit2ProcessState = {
  temperatureC: number;
  /** Internal one-node thermal energy; UI temperature follows saturation. */
  thermalEnergyC?: number;
  pressureKpa: number;
  fuelPercent: number;
  turbineSpeed: number;
  gridSyncPercent: number;
};

export type Unit2ProcessInputs = {
  isRunning: boolean;
  aprm: number;
  thermalSteamKgS: number;
  turbineSteamKgS: number;
  bypassSteamKgS: number;
  feedwaterKgS: number;
  reliefValvesOpen: number;
  targetTurbineSpeed: number;
  isSynchronized: boolean;
  turningGearActive: boolean;
  thermalResponse: number;
  steamProductionMultiplier: number;
  steamRemovalMultiplier: number;
};

/**
 * A stable, one-node implementation of the Unit 2 RPV steam path.
 *
 * It intentionally retains the web simulator's APRM-to-steam calibration, but
 * substitutes the former arbitrary pressure target for a saturated-vessel
 * balance: delayed heat raises saturated pressure, while turbine/bypass/SRV
 * mass flow removes it. This keeps an open steam path from permanently
 * draining pressure and makes the result independent of render cadence.
 */
export const stepUnit2Process = (
  state: Unit2ProcessState,
  input: Unit2ProcessInputs,
  seconds: number,
): Unit2ProcessState => {
  const dt = clamp(seconds, 0, 1);
  const reliefs = clamp(input.reliefValvesOpen, 0, 6);
  const currentPressure = clamp(state.pressureKpa, 101, 12_000);

  if (!input.isRunning) {
    const pressureLoss = reliefs * 360 * dt;
    const turningTarget = input.turningGearActive ? 50 / 45 : input.targetTurbineSpeed;
    const previousThermalEnergy = state.thermalEnergyC ?? state.temperatureC;
    const thermalEnergyC = Math.max(20, previousThermalEnergy + (30 - previousThermalEnergy) * dt / 120);
    return {
      temperatureC: clamp(Math.min(thermalEnergyC, unit2SaturationTemperatureC(currentPressure / 1_000)), 20, 400),
      thermalEnergyC,
      pressureKpa: clamp(currentPressure - pressureLoss, 101, 12_000),
      fuelPercent: state.fuelPercent,
      turbineSpeed: state.turbineSpeed + (turningTarget - state.turbineSpeed) * 0.08,
      gridSyncPercent: clamp(state.gridSyncPercent - 1.2 * dt * 4, 0, 100),
    };
  }

  const power = clamp(input.aprm / 100, 0, 1.05);
  const feedFraction = clamp(input.feedwaterKgS / 4_000, 0, 1.5);
  // This curve retains the established Unit 2 web calibration that permits a
  // useful steam inventory around 20% APRM, while retaining diminishing
  // temperature gain at high power. Feedwater remains a real heat sink.
  const coreTargetC =
    25 + 290 * (1 - Math.exp(-Math.max(0, input.aprm) / 7.5)) - 16 * feedFraction;
  const previousThermalEnergy = state.thermalEnergyC ?? state.temperatureC;
  const thermalEnergyC = previousThermalEnergy +
    (coreTargetC - previousThermalEnergy) *
      // The web process runs at 4 Hz; an 18-second bulk thermal time keeps
      // startup deliberate while still allowing the documented 5 MPa steam
      // availability during a normal manual run-up.
      clamp(dt / 18 * input.thermalResponse, 0, 0.12);
  const saturationC = unit2SaturationTemperatureC(currentPressure / 1_000);
  const superheatC = Math.max(0, thermalEnergyC - saturationC);
  // Unit 2's display follows saturation while the core retains thermal energy
  // internally. Keeping those values distinct prevents the one-node web
  // model from losing all stored heat every frame.
  const temperatureC = clamp(Math.min(thermalEnergyC, saturationC), 20, 360);

  const totalSteamOut = Math.max(0, input.turbineSteamKgS + input.bypassSteamKgS);
  const nominalSteam = Math.max(1, input.thermalSteamKgS);
  const outletFraction = clamp(totalSteamOut / nominalSteam, 0, 1.35);
  // The driving and removal terms are calibrated on the source's 20 Hz
  // process idea, expressed per second so a backgrounded browser does not
  // acquire a different reactor response. At normal pressure, this balances
  // near 7.1 MPa with roughly 200 kg/s turbine flow at 20% APRM.
  const boilingDriveKpaPerSecond =
    superheatC * 32 * input.steamProductionMultiplier;
  const steamRemovalKpaPerSecond =
    outletFraction * (20 + currentPressure * 0.02) * input.steamRemovalMultiplier +
    reliefs * 1_800;
  const pressureKpa = clamp(
    currentPressure + (boilingDriveKpaPerSecond - steamRemovalKpaPerSecond) * dt,
    101,
    11_000,
  );

  const flowTarget = input.turbineSteamKgS > 0
    ? clamp(input.turbineSteamKgS / 3, 0, 80)
    : 0;
  const targetSpeed = input.isSynchronized
    ? 66.67
    : Math.max(flowTarget, input.targetTurbineSpeed);

  return {
    temperatureC,
    thermalEnergyC,
    pressureKpa,
    fuelPercent: clamp(state.fuelPercent - (0.0015 + power * 0.004) * dt, 0, 100),
    turbineSpeed: state.turbineSpeed + (targetSpeed - state.turbineSpeed) * 0.08,
    gridSyncPercent: clamp(state.gridSyncPercent + (input.isSynchronized ? 2.5 : -1.2) * dt * 4, 0, 100),
  };
};
