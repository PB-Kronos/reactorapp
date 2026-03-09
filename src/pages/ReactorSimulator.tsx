"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Zap, 
  Thermometer, 
  Gauge, 
  Fuel, 
  Shield, 
  Power, 
  Droplets, 
  Settings, 
  Grid3X3,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Activity
} from "lucide-react";

const ReactorSimulator = () => {
  const [activePanel, setActivePanel] = useState("status");
  const [reactorPower, setReactorPower] = useState(0);
  const [temperature, setTemperature] = useState(25);
  const [pressure, setPressure] = useState(1);
  const [fuelLevel, setFuelLevel] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [gridSync, setGridSync] = useState(0);
  const [turbineSpeed, setTurbineSpeed] = useState(0);
  const [targetTurbineSpeed, setTargetTurbineSpeed] = useState(0);
  const [coolantFlow, setCoolantFlow] = useState(50);
  const [fuelEnrichment, setFuelEnrichment] = useState(3);

  // Gradual turbine speed adjustment
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && reactorPower > 0) {
      interval = setInterval(() => {
        // Gradually adjust turbine speed towards target
        setTurbineSpeed(prev => {
          const diff = targetTurbineSpeed - prev;
          if (Math.abs(diff) < 0.1) {
            return targetTurbineSpeed;
          }
          return prev + diff * 0.05; // Smooth ramp (5% per tick)
        });
      }, 100);
    }
    
    return () => clearInterval(interval);
  }, [isRunning, reactorPower, targetTurbineSpeed]);

  // Simulate reactor physics
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && reactorPower > 0) {
      interval = setInterval(() => {
        // Temperature increases with power
        setTemperature(prev => Math.min(prev + reactorPower * 0.01, 1200));
        
        // Pressure increases with temperature
        setPressure(prev => Math.min(prev + temperature * 0.001, 200));
        
        // Fuel depletes with power
        setFuelLevel(prev => Math.max(prev - reactorPower * 0.001, 0));
        
        // Grid sync depends on turbine speed matching 3000 RPM ± 3
        const syncMargin = 3;
        const targetRPM = 3000;
        const actualRPM = turbineSpeed * 30; // Convert 0-100 scale to 0-3000 RPM
        
        if (Math.abs(actualRPM - targetRPM) <= syncMargin) {
          setGridSync(prev => Math.min(prev + 0.5, 100));
        } else {
          setGridSync(prev => Math.max(prev - 0.5, 0));
        }
      }, 100);
    }
    
    return () => clearInterval(interval);
  }, [isRunning, reactorPower, temperature, turbineSpeed]);

  const handleLeftArrow = () => {
    if (activePanel === "status") setActivePanel("power-coolant");
    else if (activePanel === "power-coolant") setActivePanel("power-grid");
    else if (activePanel === "power-grid") setActivePanel("status");
  };

  const handleRightArrow = () => {
    if (activePanel === "status") setActivePanel("power-grid");
    else if (activePanel === "power-grid") setActivePanel("status");
    else if (activePanel === "power-coolant") setActivePanel("status");
  };

  const handleBottomArrow = () => {
    setActivePanel(activePanel === "status" ? "startup-shutdown" : "status");
  };

  const startReactor = () => {
    setIsRunning(true);
    setReactorPower(50);
    setTargetTurbineSpeed(50);
  };

  const stopReactor = () => {
    setIsRunning(false);
    setReactorPower(0);
    setTargetTurbineSpeed(0);
  };

  const emergencyShutdown = () => {
    setIsRunning(false);
    setReactorPower(0);
    setTemperature(25);
    setPressure(1);
    setTargetTurbineSpeed(0);
    setGridSync(0);
  };

  const getStatusColor = () => {
    if (temperature > 800) return "destructive";
    if (temperature > 600) return "warning";
    return "default";
  };

  const getStatusText = () => {
    if (temperature > 800) return "CRITICAL";
    if (temperature > 600) return "WARNING";
    if (isRunning) return "OPERATIONAL";
    return "STANDBY";
  };

  // Calculate actual RPM from 0-100 scale
  const actualRPM = turbineSpeed * 30;
  const targetRPM = targetTurbineSpeed * 30;
  const syncMargin = 3;
  const targetSyncRPM = 3000;
  
  // Check if synchronized
  const isSynchronized = Math.abs(actualRPM - targetSyncRPM) <= syncMargin;
  const syncDeviation = actualRPM - targetSyncRPM;

  // Render synchronoscope
  const renderSynchronoscope = () => {
    const centerX = 150;
    const centerY = 150;
    const radius = 120;
    
    // Calculate needle angle (centered at 3000 RPM)
    // Range: 2970 to 3030 RPM maps to -90 to +90 degrees
    const minRPM = targetSyncRPM - 30;
    const maxRPM = targetSyncRPM + 30;
    const normalizedRPM = Math.max(minRPM, Math.min(maxRPM, actualRPM));
    const angle = ((normalizedRPM - minRPM) / (maxRPM - minRPM) * 180) - 90;
    
    const needleX = centerX + radius * 0.8 * Math.cos(angle * Math.PI / 180);
    const needleY = centerY + radius * 0.8 * Math.sin(angle * Math.PI / 180);
    
    // Draw scale marks
    const marks = [];
    for (let rpm = 2970; rpm <= 3030; rpm += 30) {
      const markAngle = ((rpm - minRPM) / (maxRPM - minRPM) * 180) - 90;
      const x1 = centerX + radius * 0.9 * Math.cos(markAngle * Math.PI / 180);
      const y1 = centerY + radius * 0.9 * Math.sin(markAngle * Math.PI / 180);
      const x2 = centerX + radius * 1.0 * Math.cos(markAngle * Math.PI / 180);
      const y2 = centerY + radius * 1.0 * Math.sin(markAngle * Math.PI / 180);
      marks.push(
        <line key={rpm} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="2" />
      );
      // Add label
      const labelX = centerX + radius * 1.1 * Math.cos(markAngle * Math.PI / 180);
      const labelY = centerY + radius * 1.1 * Math.sin(markAngle * Math.PI / 180);
      marks.push(
        <text key={`label-${rpm}`} x={labelX} y={labelY} fill="white" fontSize="12" textAnchor="middle" dominantBaseline="middle">
          {rpm}
        </text>
      );
    }
    
    return (
      <svg width="300" height="300" viewBox="0 0 300 300">
        {/* Background circle */}
        <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#333" strokeWidth="2" />
        
        {/* Sync zone (green arc for ±3 RPM around 3000) */}
        <path
          d={`M ${centerX} ${centerY} L ${centerX + radius * 0.95 * Math.cos((-90) * Math.PI / 180)} ${centerY + radius * 0.95 * Math.sin((-90) * Math.PI / 180)} A ${radius * 0.95} ${radius * 0.95} 0 0 1 ${centerX + radius * 0.95 * Math.cos((90) * Math.PI / 180)} ${centerY + radius * 0.95 * Math.sin((90) * Math.PI / 180)} Z`}
          fill="rgba(34, 197, 94, 0.2)"
          stroke="rgb(34, 197, 94)"
          strokeWidth="2"
        />
        
        {/* Scale marks */}
        {marks}
        
        {/* Center dot */}
        <circle cx={centerX} cy={centerY} r="5" fill="white" />
        
        {/* Needle */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleX}
          y2={needleY}
          stroke={isSynchronized ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"}
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        {/* Sync indicator */}
        <text x={centerX} y={centerY + 40} fill="white" fontSize="14" textAnchor="middle" dominantBaseline="middle">
          {isSynchronized ? "SYNC" : "OUT OF SYNC"}
        </text>
        <text x={centerX} y={centerY + 60} fill="white" fontSize="12" textAnchor="middle" dominantBaseline="middle">
          {actualRPM.toFixed(0)} RPM
        </text>
        <text x={centerX} y={centerY + 80} fill="white" fontSize="10" textAnchor="middle" dominantBaseline="middle">
          Target: 3000 ± 3
        </text>
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.4%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            NUCLEAR REACTOR CONTROL SYSTEM
          </h1>
          <p className="text-gray-400">Advanced Reactor Management Interface v2.0</p>
        </div>

        {/* Navigation Arrows */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={handleLeftArrow}
            className="p-3 bg-slate-800/50 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-all duration-300 hover:scale-110"
          >
            <ArrowLeft className="text-cyan-400" size={24} />
          </button>
          
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">ACTIVE PANEL</div>
            <div className="text-lg font-bold text-cyan-400 uppercase">
              {activePanel === "status" && "STATUS"}
              {activePanel === "startup-shutdown" && "STARTUP/SHUTDOWN"}
              {activePanel === "power-coolant" && "POWER & COOLANT"}
              {activePanel === "power-grid" && "POWER GRID"}
            </div>
          </div>
          
          <button
            onClick={handleRightArrow}
            className="p-3 bg-slate-800/50 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-all duration-300 hover:scale-110"
          >
            <ArrowRight className="text-purple-400" size={24} />
          </button>
        </div>

        {/* Main Panel Area */}
        <div className="bg-slate-800/30 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-6 mb-6">
          {/* Status Panel */}
          {activePanel === "status" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Power Output */}
                <Card className="bg-slate-800/50 border-cyan-500/30">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-cyan-400 flex items-center gap-2">
                      <Power className="text-cyan-400" size={20} />
                      Power Output
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{reactorPower.toFixed(1)} MW</div>
                    <Progress value={reactorPower} className="mt-2 h-2 bg-cyan-500/20" />
                  </CardContent>
                </Card>

                {/* Temperature */}
                <Card className="bg-slate-800/50 border-orange-500/30">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-orange-400 flex items-center gap-2">
                      <Thermometer className="text-orange-400" size={20} />
                      Temperature
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{temperature.toFixed(0)}°C</div>
                    <Progress value={(temperature / 1200) * 100} className="mt-2 h-2 bg-orange-500/20" />
                  </CardContent>
                </Card>

                {/* Pressure */}
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

                {/* Fuel Level */}
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

                {/* Safety Status */}
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

                {/* Grid Sync */}
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
              </div>

              {/* Reactor Visualization */}
              <Card className="bg-slate-800/50 border-cyan-500/30">
                <CardHeader>
                  <CardTitle className="text-cyan-400">Reactor Core Visualization</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <div className="relative w-64 h-64">
                    {/* Reactor Core */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-full border-2 border-cyan-500/50"></div>
                    
                    {/* Fuel Rods */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className="grid grid-cols-3 gap-2">
                        {[...Array(9)].map((_, i) => (
                          <div 
                            key={i}
                            className={`w-4 h-8 rounded ${fuelLevel > 20 ? 'bg-green-500' : 'bg-red-500'} opacity-70`}
                          ></div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Power Indicator */}
                    <div 
                      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-cyan-400 opacity-50"
                      style={{ 
                        animation: isRunning ? 'pulse 2s infinite' : 'none',
                        boxShadow: isRunning ? '0 0 20px rgba(34, 211, 238, 0.5)' : 'none'
                      }}
                    ></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Startup/Shutdown Panel */}
          {activePanel === "startup-shutdown" && (
            <div className="space-y-6">
              <Card className="bg-slate-800/50 border-cyan-500/30">
                <CardHeader>
                  <CardTitle className="text-cyan-400 flex items-center gap-2">
                    <Settings className="text-cyan-400" size={24} />
                    Reactor Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      onClick={startReactor}
                      disabled={isRunning}
                      className="bg-green-600 hover:bg-green-700 h-16 text-lg font-bold border-2 border-green-500/50"
                    >
                      START REACTOR
                    </Button>
                    <Button 
                      onClick={stopReactor}
                      disabled={!isRunning}
                      className="bg-red-600 hover:bg-red-700 h-16 text-lg font-bold border-2 border-red-500/50"
                    >
                      STOP REACTOR
                    </Button>
                    <Button 
                      onClick={emergencyShutdown}
                      className="bg-orange-600 hover:bg-orange-700 h-16 text-lg font-bold border-2 border-orange-500/50"
                    >
                      EMERGENCY SHUTDOWN
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
          )}

          {/* Power & Coolant Panel */}
          {activePanel === "power-coolant" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-slate-800/50 border-cyan-500/30">
                  <CardHeader>
                    <CardTitle className="text-cyan-400 flex items-center gap-2">
                      <Power className="text-cyan-400" size={20} />
                      Power Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Reactor Power Output</label>
                      <Slider
                        value={[reactorPower]}
                        onValueChange={(value) => setReactorPower(value[0])}
                        max={200}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0 MW</span>
                        <span>200 MW</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Fuel Enrichment</label>
                      <Slider
                        value={[fuelEnrichment]}
                        onValueChange={(value) => setFuelEnrichment(value[0])}
                        max={20}
                        step={0.1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>3%</span>
                        <span>20%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-purple-500/30">
                  <CardHeader>
                    <CardTitle className="text-purple-400 flex items-center gap-2">
                      <Droplets className="text-purple-400" size={20} />
                      Coolant System
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Coolant Flow Rate</label>
                      <Slider
                        value={[coolantFlow]}
                        onValueChange={(value) => setCoolantFlow(value[0])}
                        max={100}
                        step={1}
                        className="w-full"
                      />
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
                          <span>Temperature:</span>
                          <span>{(temperature * 0.7).toFixed(0)}°C</span>
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
            </div>
          )}

          {/* Power Grid Panel */}
          {activePanel === "power-grid" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-slate-800/50 border-blue-500/30">
                  <CardHeader>
                    <CardTitle className="text-blue-400 flex items-center gap-2">
                      <Activity className="text-blue-400" size={20} />
                      Synchronoscope
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center mb-4">
                      {renderSynchronoscope()}
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
                        Deviation: {Math.abs(syncDeviation).toFixed(1)} RPM {syncDeviation > 0 ? "(high)" : syncDeviation < 0 ? "(low)" : ""}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-green-500/30">
                  <CardHeader>
                    <CardTitle className="text-green-400 flex items-center gap-2">
                      <Zap className="text-green-400" size={20} />
                      Turbine Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Target Turbine Speed (RPM: {targetRPM.toFixed(0)})
                      </label>
                      <Slider
                        value={[targetTurbineSpeed]}
                        onValueChange={(value) => setTargetTurbineSpeed(value[0])}
                        max={100}
                        step={0.1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0 RPM</span>
                        <span>3000 RPM</span>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-slate-900/50 rounded-lg border border-green-500/30">
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
                          <span>{(turbineSpeed * 2).toFixed(1)} MW</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Efficiency:</span>
                          <span>{(turbineSpeed * 0.95).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Ramp Rate:</span>
                          <span>5% per tick</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="flex justify-center">
          <button
            onClick={handleBottomArrow}
            className="p-3 bg-slate-800/50 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-all duration-300 hover:scale-110"
          >
            <ArrowDown className="text-cyan-400" size={24} />
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-400 text-sm">
          <p>NUCLEAR REACTOR CONTROL SYSTEM • CLASS 1 LICENSED • SAFETY PROTOCOLS ACTIVE</p>
          <p className="mt-1">© 2024 Advanced Reactor Management Systems</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
};

export default ReactorSimulator;