import { useEffect, useRef, useState } from "react";

interface SynchronoscopeProps {
  actualRPM: number;
  isSynchronized: boolean;
  syncMargin: number;
  targetRPM: number;
  closeup?: boolean;
}

const SYNC_RPM = 3000;

/** A phase meter: its needle rotates from the live RPM difference, not a fixed gauge position. */
export const Synchronoscope = ({ actualRPM, isSynchronized, syncMargin, targetRPM, closeup = false }: SynchronoscopeProps) => {
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(0);
  const frameRef = useRef<number>();
  const lastTime = useRef<number>();
  const rpmDifference = actualRPM - SYNC_RPM;

  useEffect(() => {
    const animate = (time: number) => {
      const elapsed = Math.min(.1, ((time - (lastTime.current ?? time)) / 1000));
      lastTime.current = time;
      if (isSynchronized) {
        phaseRef.current += (0 - phaseRef.current) * Math.min(1, elapsed * 10);
      } else if (Math.abs(rpmDifference) <= 50) {
        // Only energize the synchronizing instrument near grid speed. Within
        // that range, greater slip makes the phase needle travel faster.
        // Fast machine = clockwise needle; slow machine = anticlockwise needle.
        const degreesPerSecond = Math.max(-90, Math.min(90, rpmDifference * 1.8));
        phaseRef.current = (phaseRef.current + degreesPerSecond * elapsed + 360) % 360;
      }
      setPhase(phaseRef.current);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [rpmDifference, isSynchronized]);

  const outsideSyncRange = Math.abs(rpmDifference) > 50;
  const direction = isSynchronized ? "IN PHASE" : outsideSyncRange ? rpmDifference > 0 ? "REDUCE SPEED" : "INCREASE SPEED" : rpmDifference > 0 ? "FAST →" : "← SLOW";
  const needleColour = isSynchronized ? "#4ade80" : outsideSyncRange ? "#64748b" : Math.abs(rpmDifference) <= 15 ? "#fbbf24" : "#f87171";
  const signedPhaseDifference = phase > 180 ? phase - 360 : phase;
  // Two-lamp synchronizing scheme: the lamps trade brightness as phase slips.
  // At zero slip they settle, making the phase relation immediately visible.
  const lampA = isSynchronized ? 1 : outsideSyncRange ? .12 : .12 + .88 * ((Math.cos(phase * Math.PI / 180) + 1) / 2);
  const lampB = isSynchronized ? 1 : outsideSyncRange ? .12 : .12 + .88 * ((1 - Math.cos(phase * Math.PI / 180)) / 2);
  const ticks = Array.from({ length: 24 }, (_, index) => {
    const angle = index * 15;
    const major = index % 3 === 0;
    return <line key={angle} x1="150" y1={major ? "24" : "29"} x2="150" y2={major ? "38" : "35"} stroke={major ? "#94a3b8" : "#475569"} strokeWidth={major ? "2" : "1"} transform={`rotate(${angle} 150 150)`}/>;
  });

  return <div className={`w-full ${closeup ? "max-w-[620px] p-4" : "max-w-[360px] p-2"} rounded-full border border-slate-600 bg-slate-950 shadow-[inset_0_0_35px_rgba(0,0,0,.85),0_0_24px_rgba(34,211,238,.12)]`}>
    <svg viewBox="0 0 300 300" role="img" aria-label={`Synchronoscope: ${direction}, phase difference ${signedPhaseDifference.toFixed(0)} degrees, ${actualRPM.toFixed(0)} RPM`} className="h-auto w-full">
      <defs><radialGradient id="syncFace"><stop stopColor="#172554"/><stop offset=".7" stopColor="#0f172a"/><stop offset="1" stopColor="#020617"/></radialGradient></defs>
      <circle cx="150" cy="150" r="145" fill="url(#syncFace)" stroke="#334155" strokeWidth="4"/>
      <circle cx="150" cy="150" r="118" fill="none" stroke="#1e293b" strokeWidth="2"/>
      <path d="M 137 35 A 116 116 0 0 1 163 35 L 150 63 Z" fill="rgba(74,222,128,.28)" stroke="#4ade80" strokeWidth="2"/>
      {ticks}
      <text x="150" y="80" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="700" letterSpacing="2">SYNCHROSCOPE</text>
      <text x="72" y="154" textAnchor="middle" fill="#f87171" fontSize="11" fontWeight="700">SLOW</text>
      <text x="228" y="154" textAnchor="middle" fill="#f87171" fontSize="11" fontWeight="700">FAST</text>
      <g transform={`rotate(${phase} 150 150)`}>
        <path d="M 150 150 L 143 105 L 150 44 L 157 105 Z" fill={needleColour} filter="drop-shadow(0 0 5px currentColor)"/>
        <circle cx="150" cy="150" r="13" fill="#020617" stroke={needleColour} strokeWidth="4"/>
      </g>
      <circle cx="150" cy="150" r="4" fill="#e2e8f0"/>
      <rect x="73" y="184" width="154" height="52" rx="7" fill="#020617" stroke="#334155"/>
      <text x="150" y="204" textAnchor="middle" fill={needleColour} fontSize="15" fontWeight="800">{direction}</text>
      <text x="150" y="222" textAnchor="middle" fill="#e2e8f0" fontSize="12">{actualRPM.toFixed(1)} / {SYNC_RPM} RPM</text>
      <text x="150" y="240" textAnchor="middle" fill={Math.abs(signedPhaseDifference) <= 12 ? "#4ade80" : "#fbbf24"} fontSize="11" fontWeight="700">PHASE {signedPhaseDifference >= 0 ? "+" : ""}{signedPhaseDifference.toFixed(0)}°</text>
      <circle cx="48" cy="258" r="10" fill="#fde047" opacity={lampA} filter="drop-shadow(0 0 6px #fde047)"/>
      <circle cx="252" cy="258" r="10" fill="#fde047" opacity={lampB} filter="drop-shadow(0 0 6px #fde047)"/>
      <text x="48" y="281" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="700">SYNC A</text>
      <text x="252" y="281" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="700">SYNC B</text>
      <text x="150" y="261" textAnchor="middle" fill="#64748b" fontSize="10">{outsideSyncRange ? "BRING SPEED WITHIN ±50 RPM TO SYNCHRONIZE" : `TARGET ${targetRPM.toFixed(0)} · SPEED WINDOW ±${syncMargin} RPM`}</text>
    </svg>
  </div>;
};
