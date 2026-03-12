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
  onTurbineSpeedChange: (speed: number | ((prev: number) => number)) => void;
  targetTurbineSpeed: number;
  isLocked: boolean;
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
  onGridSyncChange,
  onTurbineSpeedChange,
  targetTurbineSpeed,
  isLocked
}: UseReactorPhysicsProps) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isRunning) {
      const interval = setInterval(() => {
        // Calculate online pump count for cooling effect
        const onlinePumpCount = (pump1Online ? 1 : 0) + (pump2Online ? 1 : 0);
        
        // Temperature calculations
        const baseTempRise = valveValue * 0.01 * (1 - rodPercentage / 100);
        const pressureTempRise = pressure * 0.001;
        const coolingEffect = onlinePumpCount * 0.5;
        const coolantCooling = coolantPumpOn ? (coolantFlow * 0.04) : 0;
        const netTempChange = baseTempRise + pressureTempRise - coolingEffect - coolantCooling;
        
        // Update temperature
        onTemperatureChange(prev => Math.max(0, Math.min(prev + netTempChange, 4500)));
        
        // Pressure changes
        const pressureChange = netTempChange < 0 ? -0.1 : 0.1;
        onPressureChange(prev => Math.max(1, Math.min(prev + pressureChange, 200)));
        
        // Fuel depletion
        onFuelLevelChange(prev => Math.max(prev - valveValue * 0.001, 0));

        // Turbine speed
        onTurbineSpeedChange(prev => {
          const currentTarget = isLocked ? 66.67 : targetTurbineSpeed;
          const diff = currentTarget - prev;
          return Math.abs(diff) < 0.01 ? currentTarget : prev + diff * 0.025;
        });

        // Grid sync
        onGridSyncChange(prev => {
          const syncChange = isLocked ? 0.5 : -0.5;
          return Math.max(0, Math.min(prev + syncChange, 100));
        });
      }, 100);
      
      intervalRef.current = interval;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    isRunning,
    valveValue,
    rodPercentage,
    pump1Online,
    pump2Online,
    pressure,
    coolantPumpOn,
    coolantFlow,
    targetTurbineSpeed,
    isLocked,
    onTemperatureChange,
    onPressureChange,
    onFuelLevelChange,
    onGridSyncChange,
    onTurbineSpeedChange
  ]);
};