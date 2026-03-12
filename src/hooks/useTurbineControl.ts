const TURBINE_RPM_SCALE = 45;
const SYNC_RPM = 3000;
const SYNC_TURBINE_SPEED = SYNC_RPM / TURBINE_RPM_SCALE;

export const calculateTurbineData = (turbineSpeed: number, targetTurbineSpeed: number, isLocked: boolean) => {
  const actualRPM = turbineSpeed * TURBINE_RPM_SCALE;
  const targetRPM = targetTurbineSpeed * TURBINE_RPM_SCALE;
  const isSynchronized = Math.abs(actualRPM - SYNC_RPM) <= 3;
  const syncDeviation = actualRPM - SYNC_RPM;
  
  return {
    actualRPM,
    targetRPM,
    isSynchronized,
    syncDeviation,
    SYNC_RPM,
    SYNC_TURBINE_SPEED
  };
};