import { useEffect, useRef } from "react";

interface UseReactorPhysicsProps {
  isRunning: boolean;
  valveValue: number;
  rodPercentage: number;
  pump1Online: boolean;
  pump2Online: boolean;
  pressure: number;
  coolantPumpOn: boolean;
  coolantFlow: number;
  onTemperatureChange: (temp: number | ((prev: number) => number)) => void;
  onPressureChange: (pressure: number | ((prev: number) => number)) => void;
  onFuelLevelChange: (fuel: number | ((prev: number) => number)) => void;
  onGridSyncChange: (sync: number | ((prev: number) => number)) => void;
}

export const useReactorPhysics = ({
  isRunning,
  valveValue,
  rodPercentage,
  pump1Online,
  pump2Online,
  pressure,
  coolantPumpOn,
  coolantFlow,
  onTemperatureChange,
  onPressureChange,
  onFuelLevelChange,
  onGridSyncChange
}: UseReactorPhysicsProps) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        // Calculate online pump count for cooling effect
        const onlinePumpCount = (pump1Online ? 1 : 0) + (pump2Online ? 1 : 0);
        
        // Temperature increase components
        const baseTempRise = valveValue * 0.01 * (1 - rodPercentage / 100);
        const pressureTempRise = pressure * 0.001;
        const coolingEffect = onlinePumpCount * 0.5;
        const coolantCooling = coolantPumpOn ? (coolantFlow * 0.04) : 0;
        
        // Net temperature change
        const netTempChange = baseTempRise + pressureTempRise - coolingEffect - coolantCooling;
        
        onTemperatureChange(prev => Math.max(0, Math.min(prev + netTempChange, 4500)));
        
        // Pressure decreases when temperature is going down
        if (netTempChange < 0) {
          onPressureChange(prev => Math.max(1, prev - 0.1));
        } else {
          onPressureChange(prev => Math.min(200, prev + 0.1));
        }
        
        // Fuel depletes with power (valveValue)
        onFuelLevelChange(prev => Math.max(prev - valveValue * 0.001, 0));
      }, 100);
      
      intervalRef.current = interval;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, valveValue, rodPercentage, pump1Online, pump2Online, pressure, coolantPumpOn, coolantFlow, onTemperatureChange, onPressureChange, onFuelLevelChange, onGridSyncChange]);
};