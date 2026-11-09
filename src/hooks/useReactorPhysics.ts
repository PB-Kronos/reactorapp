import { useEffect, useRef } from "react";

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
  thermalSteamKgS: number;
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

      // Unit APRM is limited to 105% (75% rod contribution plus 30%
      // recirculation), so physics must not retain the former 115% range.
      const reactivity = clamp(state.aprm / 100, 0, 1.05);
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
        // The thermal/APRM curve supplies the steam source.  The prior
        // APRM-only source was far too large at 20% APRM, forcing a fully-open
        // main valve simply to hold nominal pressure and letting pressure fall
        // when recirculation changed APRM.  Steam generation and removal now
        // use the same kg/s basis, so a nominal 20% unit balances near a
        // mid-travel main valve with bypass shut.
        // The target equation is expressed as an absolute vessel pressure,
        // so a hot steam header also carries its nominal pressure inventory.
        // It ramps in only once the core is making meaningful steam; a cold
        // shutdown still rests at atmospheric pressure.
        const headerInventory = clamp(state.thermalSteamKgS / 200, 0, 1) * 7100;
        const steamProduction = (headerInventory + state.thermalSteamKgS * 17.5) * (state.steamProductionMultiplier ?? 1);
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
