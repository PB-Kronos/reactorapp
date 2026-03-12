import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Synchronoscope } from "./Synchronoscope";

interface PowerGridPanelProps {
  actualRPM: number;
  targetRPM: number;
  isSynchronized: boolean;
  isLocked: boolean;
  valveValue: number;
  valveDirection: number;
  turbineOutputMW: number;
  turbineSpeed: number;
  onValvePress: (direction: number) => void;
  onPausePress: () => void;
  onSyncPress: () => void;
}

export const PowerGridPanel: React.FC<PowerGridPanelProps> = ({
  actualRPM,
  targetRPM,
  isSynchronized,
  isLocked,
  valveValue,
  valveDirection,
  turbineOutputMW,
  turbineSpeed,
  onValvePress,
  onPausePress,
  onSyncPress
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800/50 border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-blue-400 flex items-center gap-2">
              Synchronoscope
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center mb-4">
              <Synchronoscope 
                actualRPM={actualRPM}
                isSynchronized={isSynchronized}
                syncMargin={3}
                targetRPM={targetRPM}
              />
            </div>
            <div className="text-center space-y-2">
              <div className="text-lg font-bold">
                {isSynchronized ? (
                  <span className="text-green-400">✓ SYNCHRONIZED</span>
                ) : (
                  <span className="text-red-400">✗ OUT OF SYNC</span>
                )}
              </div>
              <div className="text-sm text-gray-400">
                Target: 3000 RPM ± 3 | Current: {actualRPM.toFixed(0)} RPM
              </div>
              <div className="text-sm text-gray-400">
                Deviation: {Math.abs(actualRPM - 3000).toFixed(1)} RPM {actualRPM > 3000 ? "(high)" : actualRPM < 3000 ? "(low)" : ""}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-green-500/30">
          <CardHeader>
            <CardTitle className="text-green-400 flex items-center gap-2">
              Turbine Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-2">
              <div className="text-2xl font-bold bg-slate-800/50 p-3 rounded-lg w-32 text-center border border-cyan-500/30">
                {valveValue.toFixed(1).replace('.', ',')}%
              </div>
              <div className="flex space-x-4">
                <Button onClick={() => onValvePress(-1)} className={`px-4 py-2 rounded-md font-medium text-base ${valveDirection === -1 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-800/50 border border-cyan-500/30 hover:bg-slate-900 text-white'}`}>
                  −
                </Button>
                <Button onClick={onPausePress} className={`px-4 py-2 rounded-md font-medium text-base ${valveDirection === 0 ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-slate-800/50 border border-cyan-500/30 hover:bg-slate-900 text-white'}`}>
                  Pause
                </Button>
                <Button onClick={() => onValvePress(1)} className={`px-4 py-2 rounded-md font-medium text-base ${valveDirection === 1 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-800/50 border border-cyan-500/30 hover:bg-slate-900 text-white'}`}>
                  +
                </Button>
              </div>
              <div className="text-xs text-gray-400 mt-1">Steam Input Valve (0.2% per second)</div>
            </div>
            <div className="flex justify-center mt-4">
              <Button onClick={onSyncPress} disabled={!isSynchronized} className={`px-6 py-3 rounded-md font-bold text-base ${isLocked ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/50' : isSynchronized ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50' : 'bg-slate-800/50 border border-gray-600 text-gray-500'}`}>
                {isLocked ? 'UNLOCK' : 'SYNC'}
              </Button>
            </div>
            <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-green-500/30">
              <h3 className="text-green-400 font-bold mb-2">Turbine Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Target Speed:</span>
                  <span>{targetRPM.toFixed(0)} RPM</span>
                </div>
                <div className="flex justify-between">
                  <span>Actual Speed:</span>
                  <span>{actualRPM.toFixed(0)} RPM</span>
                </div>
                <div className="flex justify-between">
                  <span>Output:</span>
                  <span>{turbineOutputMW.toFixed(1)} MW</span>
                </div>
                <div className="flex justify-between">
                  <span>Efficiency:</span>
                  <span>{(turbineSpeed * 0.95).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Ramp Rate:</span>
                  <span>2.5% per tick</span>
                </div>
                <div className="flex justify-between">
                  <span>Lock Status:</span>
                  <span className={isLocked ? "text-green-400" : "text-yellow-400"}>
                    {isLocked ? "LOCKED" : "UNLOCKED"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};