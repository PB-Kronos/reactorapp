import { useEffect, useRef } from "react";
import { stepUnit2Process } from "@/lib/rbwrUnit2Process";

interface UseReactorPhysicsProps {
  simulationPaused?: boolean;
  isRunning: boolean;
  temperature: number;
  pressure: number;
  fuelLevel: number;
  turbineSpeed: number;
  gridSync: number;
  mainValve: number;
  mainSteamInletOpen: boolean;
  bypassValve: number;
  reliefOpen: boolean;
  reliefValvesOpen?: number;
  turbineSteamFlow: number;
  bypassSteamFlow: number;
  aprm: number;
  thermalSteamKgS: number;
  feedwaterKgS?: number;
  pump1Online: boolean;
  pump2Online: boolean;
  isLocked: boolean;
  targetTurbineSpeed: number;
  thermalResponse?: number;
  steamProductionMultiplier?: number;
  steamRemovalMultiplier?: number;
  automaticScramTemperature?: number;
  onTemperatureChange: (value: number | ((previous: number) => number)) => void;
  onPressureChange: (value: number | ((previous: number) => number)) => void;
  onFuelLevelChange: (value: number | ((previous: number) => number)) => void;
  onGridSyncChange: (value: number | ((previous: number) => number)) => void;
  onTurbineSpeedChange: (value: number | ((previous: number) => number)) => void;
  onAutomaticScram: () => void;
}

/** A bounded, low-frequency Unit 2 process clock. It deliberately uses a single 4 Hz clock. */
export const useReactorPhysics = (props: UseReactorPhysicsProps) => {
  const current = useRef(props);
  current.current = props;
  const scramLatched = useRef(false);
  const statePressure = useRef(props.pressure);
  const stateFuel = useRef(props.fuelLevel);
  const stateTurbineSpeed = useRef(props.turbineSpeed);
  const stateGridSync = useRef(props.gridSync);
  const stateThermalEnergy = useRef(props.temperature);
  // External actions such as reset, scenario loading, and synchronization
  // remain authoritative over the clock's internal continuity values.
  statePressure.current = props.pressure;
  stateFuel.current = props.fuelLevel;
  stateTurbineSpeed.current = props.turbineSpeed;
  stateGridSync.current = props.gridSync;
  // A cold reset/scenario reload is the only external action that should
  // discard stored vessel heat; saturated display updates must not.
  if (props.temperature <= 35 && stateThermalEnergy.current > 80) {
    stateThermalEnergy.current = props.temperature;
  }

  useEffect(() => {
    const clock = window.setInterval(() => {
      const state = current.current;
      if (state.simulationPaused) return;
      const openReliefValves = state.reliefValvesOpen ?? (state.reliefOpen ? 1 : 0);
      const next = stepUnit2Process({
        temperatureC: state.temperature,
        thermalEnergyC: stateThermalEnergy.current,
        pressureKpa: statePressure.current,
        fuelPercent: stateFuel.current,
        turbineSpeed: stateTurbineSpeed.current,
        gridSyncPercent: stateGridSync.current,
      }, {
        isRunning: state.isRunning,
        aprm: state.aprm,
        thermalSteamKgS: state.thermalSteamKgS,
        turbineSteamKgS: state.turbineSteamFlow,
        bypassSteamKgS: state.bypassSteamFlow,
        feedwaterKgS: state.feedwaterKgS ?? 0,
        reliefValvesOpen: openReliefValves,
        targetTurbineSpeed: state.targetTurbineSpeed,
        isSynchronized: state.isLocked,
        turningGearActive: !state.isRunning && state.targetTurbineSpeed > 0,
        thermalResponse: state.thermalResponse ?? 1,
        steamProductionMultiplier: state.steamProductionMultiplier ?? 1,
        steamRemovalMultiplier: state.steamRemovalMultiplier ?? 1,
      }, .25);
      statePressure.current = next.pressureKpa;
      stateFuel.current = next.fuelPercent;
      stateTurbineSpeed.current = next.turbineSpeed;
      stateGridSync.current = next.gridSyncPercent;
      stateThermalEnergy.current = next.thermalEnergyC ?? next.temperatureC;
      if (next.temperatureC >= (state.automaticScramTemperature ?? 1100) && !scramLatched.current) {
        scramLatched.current = true;
        state.onAutomaticScram();
      }
      state.onTemperatureChange(next.temperatureC);
      state.onPressureChange(next.pressureKpa);
      state.onFuelLevelChange(next.fuelPercent);
      state.onTurbineSpeedChange(next.turbineSpeed);
      state.onGridSyncChange(next.gridSyncPercent);
      if (!state.isRunning) scramLatched.current = false;
    }, 250);

    return () => window.clearInterval(clock);
  }, []);
};
