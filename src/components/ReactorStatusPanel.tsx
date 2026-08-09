import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Power, 
  Thermometer, 
  Gauge, 
  Fuel, 
  Shield
} from "lucide-react";

interface ReactorStatusPanelProps {
  temperature: number;
  pressure: number;
  fuelLevel: number;
  turbineOutputMW: number;
  valveValue: number;
  isRunning: boolean;
  aprm?: number;
  rodAprm?: number;
  recirculationAprm?: number;
  recircPumpA?: boolean;
  recircPumpB?: boolean;
  recircSpeedA?: number;
  recircSpeedB?: number;
  onRecircPumpAChange?: (value: boolean) => void;
  onRecircPumpBChange?: (value: boolean) => void;
  onRecircSpeedAChange?: (value: number) => void;
  onRecircSpeedBChange?: (value: number) => void;
  getStatusColor: () => "default" | "destructive" | "warning";
  getStatusText: () => string;
}

export const ReactorStatusPanel: React.FC<ReactorStatusPanelProps> = ({
  temperature,
  pressure,
  fuelLevel,
  turbineOutputMW,
  valveValue,
  isRunning,
  getStatusColor,
  getStatusText
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-slate-800/50 border-cyan-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <Power className="text-cyan-400" size={20} />
              Power Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{turbineOutputMW.toFixed(1)} MW</div>
            <Progress value={valveValue} className="mt-2 h-2 bg-cyan-500/20" />
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-orange-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-orange-400 flex items-center gap-2">
              <Thermometer className="text-orange-400" size={20} />
              Temperature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{temperature.toFixed(0)}°C</div>
            <Progress value={(temperature / 4500) * 100} className="mt-2 h-2 bg-orange-500/20" />
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-purple-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-purple-400 flex items-center gap-2">
              <Gauge className="text-purple-400" size={20} />
              Pressure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pressure.toFixed(1)} bar</div>
            <Progress value={(pressure / 200) * 100} className="mt-2 h-2 bg-purple-500/20" />
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-green-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-green-400 flex items-center gap-2">
              <Fuel className="text-green-400" size={20} />
              Fuel Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fuelLevel.toFixed(1)}%</div>
            <Progress value={fuelLevel} className="mt-2 h-2 bg-green-500/20" />
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-red-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-red-400 flex items-center gap-2">
              <Shield className="text-red-400" size={20} />
              Safety Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={getStatusColor() === "warning" ? "default" : getStatusColor()} className="text-lg px-3 py-1">
              {getStatusText()}
            </Badge>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};
