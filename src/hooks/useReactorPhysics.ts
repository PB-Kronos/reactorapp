import { useEffect, useRef } from "react";

interface UseReactorPhysicsProps {
  isRunning: boolean;
  temperature: number;
  mainValve: number;
  mainSteamInletOpen: boolean;
  bypassValve: number;
  reliefOpen: boolean;
  turbineSteamFlow: number;
  bypassSteamFlow: number;
  aprm: number;
  pump1Online: boolean;
  pump2Online: boolean;
  isLocked: boolean;
  targetTurbineSpeed: number;
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
      if (!state.isRunning) {
        scramLatched.current = false;
        return;
      }

      const reactivity = clamp(state.aprm / 100, 0, 1.15);
      // Tuned bulk-water temperature: about 280 C at 80% APRM with slow thermal inertia.
      const targetTemperature = 25 + reactivity * 320;
      const temperatureDelta = (targetTemperature - state.temperature) * .008;

      const nextTemperature = clamp(state.temperature + temperatureDelta, 20, 1800);
      if (nextTemperature >= 1100 && !scramLatched.current) {
        scramLatched.current = true;
        state.onAutomaticScram();
      }
      state.onTemperatureChange(nextTemperature);
      state.onPressureChange(previous => {
        // Core power creates steam; actual measured steam flow, rather than a
        // valve-position shortcut, removes it from the vessel.
        const steamProduction = reactivity * 25000;
        const steamRemoval = (state.turbineSteamFlow + state.bypassSteamFlow) * 17.5 + (state.reliefOpen ? 8000 : 0);
        const target = clamp(101 + steamProduction - steamRemoval, 101, 12000);
        return clamp(previous + (target - previous) * 0.045, 101, 12000);
      });
      state.onFuelLevelChange(previous => clamp(previous - (0.0015 + reactivity * 0.004) * 0.25, 0, 100));
      state.onTurbineSpeedChange(previous => {
        // About 200 kg/s is sufficient for rated no-load speed. Once the grid
        // breaker closes, grid frequency holds shaft speed regardless of load.
        const flowDrivenTarget = state.mainSteamInletOpen ? clamp(state.turbineSteamFlow / 3, 0, 80) : 0;
        const target = state.isLocked ? 66.67 : state.targetTurbineSpeed;
        return previous + ((state.isLocked ? target : flowDrivenTarget) - previous) * 0.08;
      });
      state.onGridSyncChange(previous => clamp(previous + (state.isLocked ? 2.5 : -1.2), 0, 100));
    }, 250);

    return () => window.clearInterval(clock);
  }, []);
};
