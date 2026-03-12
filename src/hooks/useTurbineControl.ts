import { useEffect, useRef } from "react";

const TURBINE_RPM_SCALE = 45;
const SYNC_RPM = 3000;
const SYNC_TURBINE_SPEED = SYNC_RPM / TURBINE_RPM_SCALE;

interface UseTurbineControlProps {
  isRunning: boolean;
  targetTurbineSpeed: number;
  isLocked: boolean;
  onTurbineSpeedChange: (speed: number) => void;
}

export const useTurbineControl = ({
  isRunning,
  targetTurbineSpeed,
  isLocked,
  onTurbineSpeedChange
}: UseTurbineControlProps) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (isRunning) {
      const interval = setInterval(() => {
        onTurbineSpeedChange(prev => {
          const currentTarget = isLocked ? SYNC_TURBINE_SPEED : targetTurbineSpeed;
          const diff = currentTarget - prev;
          if (Math.abs(diff) < 0.01) return currentTarget;
          return prev + diff * 0.025;
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
  }, [isRunning, targetTurbineSpeed, isLocked, onTurbineSpeedChange]);

  const actualRPM = (speed: number) => speed * TURBINE_RPM_SCALE;
  const targetRPM = targetTurbineSpeed * TURBINE_RPM_SCALE;
  const isSynchronized = Math.abs(actualRPM(targetTurbineSpeed) - SYNC_RPM) <= 3;
  const syncDeviation = actualRPM(targetTurbineSpeed) - SYNC_RPM;

  return {
    actualRPM: actualRPM,
    targetRPM,
    isSynchronized,
    syncDeviation,
    SYNC_RPM,
    SYNC_TURBINE_SPEED
  };
};