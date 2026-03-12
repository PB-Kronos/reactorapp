import { useEffect, useRef } from "react";  

const TURBINE_RPM_SCALE = 45;  
const SYNC_RPM = 3000;  
const SYNC_TURBINE_SPEED = SYNC_RPM / TURBINE_RPM_SCALE;  

interface UseTurbineControlProps {  
  isRunning: boolean;  
  targetTurbineSpeed: number;  
  isLocked: boolean;  
  onTurbineSpeedChange: (speed: number | ((prev: number) => number)) => void;  
}  

export const useTurbineControl = ({  
  isRunning,  
  targetTurbineSpeed,  
  isLocked,  
  onTurbineSpeedChange,  
}: UseTurbineControlProps) => {  
  // This hook is now simplified since turbine control is handled in useReactorPhysics  
  // We just need to provide the calculation functions  
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
    SYNC_TURBINE_SPEED,  
  };  
};