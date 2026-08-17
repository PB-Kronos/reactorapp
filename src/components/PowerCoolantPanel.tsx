import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  pump1Online: boolean; pump2Online: boolean; busBAvailable: boolean;
  daIntakeOpen: boolean; daOutputOpen: boolean; daIntakeValve?: number; daOuttakeValve?: number; daTemperature?: number; daPressure?: number; daIntakeDirection?: number; daOuttakeDirection?: number;
  onPump1Change: (v: boolean) => void; onPump2Change: (v: boolean) => void; onDaIntakeChange: (v: boolean) => void; onDaOutputChange: (v: boolean) => void; onDaIntakeValveChange?: (v: number) => void; onDaOuttakeValveChange?: (v: number) => void; onDaIntakeDirectionChange?: (v: number) => void; onDaOuttakeDirectionChange?: (v: number) => void;
}

export const PowerCoolantPanel: React.FC<Props> = () => <div className="mx-auto max-w-3xl"><Card className="border-cyan-500/30 bg-slate-900/60"><CardHeader><CardTitle className="text-cyan-300">CRD cooling</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-400">CRD cooling is monitored from the control-rod and MCC systems.</p></CardContent></Card></div>;
