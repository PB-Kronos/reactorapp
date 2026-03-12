import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

interface ControlRodsPanelProps {
  rodPercentage: number;
  rodDirection: number;
  onRodPress: (direction: number) => void;
  onRodNeutral: () => void;
}

export const ControlRodsPanel: React.FC<ControlRodsPanelProps> = ({
  rodPercentage,
  rodDirection,
  onRodPress,
  onRodNeutral
}) => {
  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-green-500/30">
        <CardHeader>
          <CardTitle className="text-green-400 flex items-center gap-2">
            <Zap className="text-green-400" size={24} />
            Control Rods Position
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="text-4xl font-bold bg-slate-800/50 p-4 rounded-lg w-32 text-center border border-green-500/30">
              {rodPercentage.toFixed(1)}%
            </div>
            <div className="flex space-x-4">
              <Button onClick={() => onRodPress(1)} className={`px-6 py-3 rounded-md font-medium text-base ${rodDirection === 1 ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-800/50 border border-green-500/30 hover:bg-slate-900 text-white'}`}>
                + (Lower)
              </Button>
              <Button onClick={onRodNeutral} className={`px-6 py-3 rounded-md font-medium text-base ${rodDirection === 0 ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-slate-800/50 border border-green-500/30 hover:bg-slate-900 text-white'}`}>
                = (Neutral)
              </Button>
              <Button onClick={() => onRodPress(-1)} className={`px-6 py-3 rounded-md font-medium text-base ${rodDirection === -1 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-800/50 border border-green-500/30 hover:bg-slate-900 text-white'}`}>
                - (Raise)
              </Button>
            </div>
            <div className="w-full max-w-md">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Raised (0%)</span>
                <span>Inserted (100%)</span>
              </div>
              <div className="h-8 bg-slate-900/50 rounded-lg border border-green-500/30 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-300 rounded-lg" style={{ width: `${rodPercentage}%` }} />
              </div>
            </div>
            <div className="text-sm text-gray-400 text-center max-w-md">
              Controls insertion depth (0-100%). Higher percentage reduces temperature rise from power. At 100%, power-based temperature rise is fully suppressed. Pressure still affects temperature.
              <br /><br />
              <strong>+ (Lower):</strong> Inserts rods at 1%/sec<br />
              <strong>- (Raise):</strong> Withdraws rods at 1%/sec<br />
              <strong>= (Neutral):</strong> Hold position
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};