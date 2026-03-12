import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Power, 
  Thermometer, 
  Gauge, 
  Fuel, 
  Shield, 
  Grid3X3,
  Zap
} from "lucide-react";

interface ReactorStatusPanelProps {
  temperature: number;
  pressure: number;
  fuelLevel: number;
  gridSync: number;
  turbineOutputMW: number;
  valveValue: number;
  isRunning: boolean;
  getStatusColor: () => "default" | "destructive" | "warning";
  getStatusText: () => string;
}

export const ReactorStatusPanel: React.FC<ReactorStatusPanelProps> = ({
  temperature,
  pressure,
  fuelLevel,
  gridSync,
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
            <Badge variant={getStatusColor() as any} className="text-lg px-3 py-1">
              {getStatusText()}
            </Badge>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-blue-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-blue-400 flex items-center gap-2">
              <Grid3X3 className="text-blue-400" size={20} />
              Grid Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gridSync.toFixed(1)}%</div>
            <Progress value={gridSync} className="mt-2 h-2 bg-blue-500/20" />
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-cyan-400">Reactor Core Visualization</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="relative w-64 h-64">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-full border-2 border-cyan-500/50"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded ${fuelLevel > 20 ? 'bg-green-500' : 'bg-red-500'} opacity-70`} />
                  ))}
                </div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-cyan-400 opacity-50" style={{ animation: isRunning ? 'pulse 2s infinite' : 'none', boxShadow: isRunning ? '0 0 20px rgba(34, 211, 238, 0.5)' : 'none' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};