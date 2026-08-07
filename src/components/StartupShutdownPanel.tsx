import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SpringButton } from "@/components/HardwareControls";

interface StartupShutdownPanelProps {
  isRunning: boolean;
  temperature: number;
  scramPressed: boolean;
  onStartReactor: () => void;
  onInstantStartup?: () => void;
  onStopReactor: () => void;
  onEmergencyShutdown: () => void;
}

export const StartupShutdownPanel: React.FC<StartupShutdownPanelProps> = ({
  isRunning,
  temperature,
  scramPressed,
  onStartReactor,
  onInstantStartup,
  onStopReactor,
  onEmergencyShutdown
}) => {
  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-cyan-500/30">
        <CardHeader>
          <CardTitle className="text-cyan-400 flex items-center gap-2">
            Reactor Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex justify-center"><SpringButton onClick={onStartReactor} disabled={isRunning} label="START REACTOR" /></div>
            <div className="flex justify-center"><SpringButton onClick={onInstantStartup} disabled={isRunning} label="INSTANT STARTUP" /></div>
            <div className="flex justify-center"><SpringButton onClick={onStopReactor} disabled={!isRunning} variant="danger" label="NORMAL STOP" /></div>
            <div className="flex justify-center"><SpringButton onClick={onEmergencyShutdown} variant="danger" label={scramPressed ? "SCRAM LATCHED" : "SCRAM"} /></div>
          </div>
          <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-cyan-500/30">
            <h3 className="text-cyan-400 font-bold mb-2">Reactor Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>State:</span>
                <span className={isRunning ? "text-green-400" : "text-yellow-400"}>
                  {isRunning ? "OPERATIONAL" : "SHUTDOWN"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Critical Systems:</span>
                <span className="text-green-400">NOMINAL</span>
              </div>
              <div className="flex justify-between">
                <span>Containment:</span>
                <span className="text-green-400">SECURE</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
