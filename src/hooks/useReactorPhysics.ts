import { useEffect, useRef } from "react";

interface UseReactorPhysicsProps {
  isRunning: boolean;
  temperature: number;
  valveValue: number;
  rodPercentage: number;
  pump1Online: boolean;
  pump2Online: boolean;
  coolantPumpOn: boolean;
  coolantFlow: number;
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

      const pumps = Number(state.pump1Online) + Number(state.pump2Online);
      const reactivity = (100 - state.rodPercentage) / 100;
      const coolant = (state.coolantPumpOn ? state.coolantFlow * 0.065 : 0) + pumps * 0.45;
      const heat = 3.1 * reactivity;
      const temperatureDelta = (heat - coolant) * 0.25;

      const nextTemperature = clamp(state.temperature + temperatureDelta, 20, 1800);
      const insufficientCooling = nextTemperature > 850 && coolant < 1.2;
      if ((nextTemperature >= 1200 || insufficientCooling) && !scramLatched.current) {
        scramLatched.current = true;
        state.onAutomaticScram();
      }
      state.onTemperatureChange(nextTemperature);
      state.onPressureChange(previous => {
        const target = 1 + (state.valveValue / 100) * 3 + Math.max(0, heat * 2.4 - coolant * 0.5);
        return clamp(previous + (target - previous) * 0.06, 1, 120);
      });
      state.onFuelLevelChange(previous => clamp(previous - (0.0015 + reactivity * 0.004) * 0.25, 0, 100));
      state.onTurbineSpeedChange(previous => {
        const target = state.isLocked ? 66.67 : state.targetTurbineSpeed;
        return previous + (target - previous) * 0.08;
      });
      state.onGridSyncChange(previous => clamp(previous + (state.isLocked ? 2.5 : -1.2), 0, 100));
    }, 250);

    return () => window.clearInterval(clock);
  }, []);
};
