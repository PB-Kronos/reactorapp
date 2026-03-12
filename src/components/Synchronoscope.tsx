import React from "react";

interface SynchronoscopeProps {
  actualRPM: number;
  isSynchronized: boolean;
  syncMargin: number;
  targetRPM: number;
}

const SYNC_RPM = 3000;
const MAX_RPM = 4500;

export const Synchronoscope: React.FC<SynchronoscopeProps> = ({
  actualRPM,
  isSynchronized,
  syncMargin,
  targetRPM
}) => {
  const centerX = 150;
  const centerY = 150;
  const radius = 120;
  const normalizedRPM = Math.max(0, Math.min(MAX_RPM, actualRPM));
  const angle = ((normalizedRPM - SYNC_RPM) / (MAX_RPM - SYNC_RPM) * 90);
  const needleX = centerX + radius * 0.8 * Math.cos(angle * Math.PI / 180);
  const needleY = centerY + radius * 0.8 * Math.sin(angle * Math.PI / 180);

  const marks = [];
  for (let rpm = 0; rpm <= 4500; rpm += 500) {
    const markAngle = ((rpm - SYNC_RPM) / (MAX_RPM - SYNC_RPM) * 90);
    const x1 = centerX + radius * 0.9 * Math.cos(markAngle * Math.PI / 180);
    const y1 = centerY + radius * 0.9 * Math.sin(markAngle * Math.PI / 180);
    const x2 = centerX + radius * 1.0 * Math.cos(markAngle * Math.PI / 180);
    const y2 = centerY + radius * 1.0 * Math.sin(markAngle * Math.PI / 180);
    marks.push(
      <line key={`mark-${rpm}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="2" />
    );
    const labelX = centerX + radius * 1.1 * Math.cos(markAngle * Math.PI / 180);
    const labelY = centerY + radius * 1.1 * Math.sin(markAngle * Math.PI / 180);
    marks.push(
      <text key={`label-${rpm}`} x={labelX} y={labelY} fill="white" fontSize="12" textAnchor="middle" dominantBaseline="middle">
        {rpm}
      </text>
    );
  }

  const syncStartAngle = -syncMargin / (MAX_RPM - SYNC_RPM) * 90;
  const syncEndAngle = syncMargin / (MAX_RPM - SYNC_RPM) * 90;

  return (
    <svg width="300" height="300" viewBox="0 0 300 300">
      <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#333" strokeWidth="2" />
      <path 
        d={`M ${centerX} ${centerY} L ${centerX + radius * 0.95 * Math.cos(syncStartAngle * Math.PI / 180)} ${centerY + radius * 0.95 * Math.sin(syncStartAngle * Math.PI / 180)} A ${radius * 0.95} ${radius * 0.95} 0 0 1 ${centerX + radius * 0.95 * Math.cos(syncEndAngle * Math.PI / 180)} ${centerY + radius * 0.95 * Math.sin(syncEndAngle * Math.PI / 180)} Z`} 
        fill="rgba(34, 197, 94, 0.2)" 
        stroke="rgb(34, 197, 94)" 
        strokeWidth="2" 
      />
      {marks}
      <circle cx={centerX} cy={centerY} r="5" fill="white" />
      <line 
        x1={centerX} y1={centerY} x2={needleX} y2={needleY} 
        stroke={isSynchronized ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"} 
        strokeWidth="3" 
        strokeLinecap="round" 
      />
      <text x={centerX} y={centerY - 40} fill="white" fontSize="14" textAnchor="middle" dominantBaseline="middle">
        {isSynchronized ? "SYNC" : "OUT OF SYNC"}
      </text>
      <text x={centerX} y={centerY + 40} fill="white" fontSize="12" textAnchor="middle" dominantBaseline="middle">
        {actualRPM.toFixed(0)} RPM
      </text>
      <text x={centerX} y={centerY + 60} fill="white" fontSize="10" textAnchor="middle" dominantBaseline="middle">
        Target: {SYNC_RPM} ± {syncMargin}
      </text>
    </svg>
  );
};