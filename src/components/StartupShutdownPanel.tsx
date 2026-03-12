import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface StartupShutdownPanelProps {
  isRunning: boolean;
  temperature: number;
  scramPressed: boolean;
  onStartReactor: () => void;
  onStopReactor: () => void;
  onEmergencyShutdown: () => void;
}

export const StartupShutdownPanel: React.FC<StartupShutdownPanelProps> = ({
  isRunning,
  temperature,
  scramPressed,
  onStartReactor,
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button onClick={onStartReactor} disabled={isRunning} className="bg-green-600 hover:bg-green-700 h-16 text-lg font-bold border-2 border-green-500/50">
              START REACTOR
            </Button>
            <Button onClick={onStopReactor} disabled={!isRunning} className="bg-red-600 hover:bg-red-700 h-16 text-lg font-bold border-2 border-red-500/50">
              STOP REACTOR
            </Button>
            <Button 
              onClick={onEmergencyShutdown}
              className={`
                h-16 text-lg font-bold border-2
                ${scramPressed ? 'bg-red-600 hover:bg-red-700 border-red-500/50' : 
                  temperature > 3000 ? 'bg-orange-600 hover:bg-orange-700 border-orange-500/50' : 
                  'bg-gray-600 hover:bg-gray-700 border-gray-500/50'}
              `}
            >
              SCRAM
            </Button>
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