import { useEffect, useRef } from "react";
import { U2_OPERATING_FLOW_NORMALIZATION } from "@/lib/thermalOutput";

interface UseReactorPhysicsProps {
  simulationPaused?: boolean;
  isRunning: boolean;
  temperature: number;
  mainValve: number;
  mainSteamInletOpen: boolean;
  bypassValve: number;
  reliefOpen: boolean;
  reliefValvesOpen?: number;
  turbineSteamFlow: number;
  bypassSteamFlow: number;
  aprm: number;
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

const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);

/** A bounded, low-frequency game simulation. It deliberately uses a single 4 Hz clock. */
export const useReactorPhysics = (props: UseReactorPhysicsProps) => {
  const current = useRef(props);
  current.current = props;
  const scramLatched = useRef(false);

  useEffect(() => {
    const clock = window.setInterval(() => {
      const state = current.current;
      if (state.simulationPaused) return;
      const openReliefValves = state.reliefValvesOpen ?? (state.reliefOpen ? 1 : 0);
      if (!state.isRunning) {
        // SRVs remain connected to the vessel following a SCRAM. This lets ADS
        // depressurize a shut-down reactor instead of freezing its pressure.
        if (openReliefValves > 0) state.onPressureChange(previous => clamp(previous - openReliefValves * 90, 101, 12000));
        // Turning gear is available during shutdown. Its low-speed target is
        // supplied by the turbine panel and must not depend on reactor power.
        state.onTurbineSpeedChange(previous =>
          previous + (state.targetTurbineSpeed - previous) * 0.08,
        );
        scramLatched.current = false;
        return;
      }

      const reactivity = clamp(state.aprm / 100, 0, 1.15);
      // Tuned bulk-water temperature: about 280 C at 80% APRM with slow thermal inertia.
      const targetTemperature = 25 + reactivity * 320;
      const temperatureDelta = (targetTemperature - state.temperature) * .008 * (state.thermalResponse ?? 1);

      const nextTemperature = clamp(state.temperature + temperatureDelta, 20, 1800);
      if (nextTemperature >= (state.automaticScramTemperature ?? 1100) && !scramLatched.current) {
        scramLatched.current = true;
        state.onAutomaticScram();
      }
      state.onTemperatureChange(nextTemperature);
      state.onPressureChange(previous => {
        // Core power creates steam; actual measured steam flow, rather than a
        // valve-position shortcut, removes it from the vessel.
        // At 20% APRM this supports a ~200 kg/s no-load turbine run-up while
        // holding the main-steam header near 7,100 kPa. Higher-power
        // operation is governed by actual steam removal through the valves.
        const steamProduction = reactivity * 52500 * U2_OPERATING_FLOW_NORMALIZATION * (state.steamProductionMultiplier ?? 1);
        const steamRemoval = ((state.turbineSteamFlow + state.bypassSteamFlow) * 17.5 + openReliefValves * 8000) * (state.steamRemovalMultiplier ?? 1);
        const target = clamp(101 + steamProduction - steamRemoval, 101, 12000);
        return clamp(previous + (target - previous) * 0.045, 101, 12000);
      });
      state.onFuelLevelChange(previous => clamp(previous - (0.0015 + reactivity * 0.004) * 0.25, 0, 100));
      state.onTurbineSpeedChange(previous => {
        // About 200 kg/s is sufficient for rated no-load speed. Once the grid
        // breaker closes, grid frequency holds shaft speed regardless of load.
        const flowDrivenTarget = state.mainSteamInletOpen ? clamp(state.turbineSteamFlow / 3, 0, 80) : 0;
        // Keep a low-speed turning-gear target alive before steam admission;
        // once steam is flowing, its higher physical flow target takes over.
        const target = state.isLocked
          ? 66.67
          : Math.max(flowDrivenTarget, state.targetTurbineSpeed);
        return previous + ((state.isLocked ? target : flowDrivenTarget) - previous) * 0.08;
      });
      state.onGridSyncChange(previous => clamp(previous + (state.isLocked ? 2.5 : -1.2), 0, 100));
    }, 250);

    return () => window.clearInterval(clock);
  }, []);
};
