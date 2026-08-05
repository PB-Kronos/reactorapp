import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Droplets } from "lucide-react";
import { PumpIcon } from "./PumpIcon";
import { MaintainedSwitch } from "@/components/HardwareControls";

interface PowerCoolantPanelProps {
  pump1Online: boolean;
  pump2Online: boolean;
  coolantPumpOn: boolean;
  coolantFlow: number;
  pressure: number;
  onPump1Change: (online: boolean) => void;
  onPump2Change: (online: boolean) => void;
  onCoolantPumpChange: (on: boolean) => void;
  onCoolantFlowChange: (flow: number) => void;
}

export const PowerCoolantPanel: React.FC<PowerCoolantPanelProps> = ({
  pump1Online,
  pump2Online,
  coolantPumpOn,
  coolantFlow,
  pressure,
  onPump1Change,
  onPump2Change,
  onCoolantPumpChange,
  onCoolantFlowChange
}) => {
  const activePumpCount = (pump1Online ? 1 : 0) + (pump2Online ? 1 : 0);

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-cyan-500/30">
        <CardHeader>
          <CardTitle className="text-cyan-400 flex items-center gap-2">
            <Droplets className="text-cyan-400" size={20} />
            Feedwater Pumps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-slate-900/50 rounded-lg border border-cyan-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <PumpIcon isOnline={pump1Online} />
                <span className="text-lg font-bold">Pump 1</span>
              </div>
              <Badge className={pump1Online ? "bg-blue-600 text-white" : "bg-gray-600 text-gray-300"}>
                {pump1Online ? "ONLINE" : "OFFLINE"}
              </Badge>
            </div>
            <div className="flex justify-center"><MaintainedSwitch label="PUMP 1 CONTROL" on={pump1Online} onChange={onPump1Change} /></div>
          </div>
          <div className="p-4 bg-slate-900/50 rounded-lg border border-cyan-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <PumpIcon isOnline={pump2Online} />
                <span className="text-lg font-bold">Pump 2</span>
              </div>
              <Badge className={pump2Online ? "bg-blue-600 text-white" : "bg-gray-600 text-gray-300"}>
                {pump2Online ? "ONLINE" : "OFFLINE"}
              </Badge>
            </div>
            <div className="flex justify-center"><MaintainedSwitch label="PUMP 2 CONTROL" on={pump2Online} onChange={onPump2Change} /></div>
          </div>
          <div className="p-4 bg-slate-900/50 rounded-lg border border-blue-500/30">
            <h3 className="text-blue-400 font-bold mb-2">Feedwater System Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Active Pumps:</span>
                <span className="text-blue-400">{activePumpCount} / 2</span>
              </div>
              <div className="flex justify-between">
                <span>Cooling Rate:</span>
                <span className="text-blue-400">{activePumpCount * 0.5}°C/s</span>
              </div>
              <div className="flex justify-between">
                <span>System Status:</span>
                <span className={activePumpCount > 0 ? "text-green-400" : "text-yellow-400"}>
                  {activePumpCount > 0 ? "FEEDWATER ONLINE" : "FEEDWATER OFFLINE"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-slate-800/50 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-purple-400 flex items-center gap-2">
            <Droplets className="text-purple-400" size={20} />
            Coolant Pump Alpha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-bold">Coolant Pump Alpha</span>
            <Badge className={coolantPumpOn ? "bg-green-600 text-white" : "bg-gray-600 text-gray-300"}>
              {coolantPumpOn ? "ONLINE" : "OFFLINE"}
            </Badge>
          </div>
          <div className="mb-4 flex justify-center"><MaintainedSwitch label="ALPHA PUMP CONTROL" on={coolantPumpOn} onChange={onCoolantPumpChange} /></div>
          <div>
            <label className="block text-sm font-medium mb-2">Coolant Intake Valve</label>
            <Slider value={[coolantFlow]} onValueChange={(value) => onCoolantFlowChange(value[0])} max={100} step={1} className="w-full" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
          <div className="p-4 bg-slate-900/50 rounded-lg border border-purple-500/30">
            <h3 className="text-purple-400 font-bold mb-2">Coolant Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Flow Rate:</span>
                <span>{coolantFlow.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Cooling Rate:</span>
                <span>{coolantPumpOn ? `${(coolantFlow * 0.04).toFixed(1)}°C/s` : '0°C/s'}</span>
              </div>
              <div className="flex justify-between">
                <span>Pressure:</span>
                <span>{(pressure * 0.8).toFixed(1)} bar</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
