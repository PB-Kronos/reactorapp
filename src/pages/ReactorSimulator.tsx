"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
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
  ArrowUp,
  Activity
} from "lucide-react";

// Constants for turbine RPM mapping
const TURBINE_RPM_SCALE = 45; // 0-100 scale maps to 0-4500 RPM
const SYNC_RPM = 3000;
const SYNC_TURBINE_SPEED = SYNC_RPM / TURBINE_RPM_SCALE; // 66.67%

const ReactorSimulator = () => {
  const [activePanel, setActivePanel] = useState("status");
  const [temperature, setTemperature] = useState(25);
  const [pressure, setPressure] = useState(1);
  const [fuelLevel, setFuelLevel] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [gridSync, setGridSync] = useState(0);
  const [turbineSpeed, setTurbineSpeed] = useState(0);
  const [targetTurbineSpeed, setTargetTurbineSpeed] = useState(0);
  const [coolantFlow, setCoolantFlow] = useState(50);
  const [coolantPumpOn, setCoolantPumpOn] = useState(false);
  const [rodDirection, setRodDirection] = useState(0);
  const [valveDirection, setValveDirection] = useState(0);
  const [scramPressed, setScramPressed] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [rodPercentage, setRodPercentage] = useState(0);
  const [pump1Online, setPump1Online] = useState(false);
  const [pump2Online, setPump2Online] = useState(false);

  // Steam valve controls - now the primary power control
  const [valveValue, setValveValue] = useState(50);

  // Interval references for cleanup
  const valveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const turbineIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rodIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Steam valve value changer (0.5% per second = 0.05 per tick)
  useEffect(() => {
    if (valveDirection !== 0) {
      if (valveIntervalRef.current) {
        clearInterval(valveIntervalRef.current);
        valveIntervalRef.current = null;
      }
      const interval = setInterval(() => {
        setValveValue(prev => {
          const newVal = prev + valveDirection * 0.05;
          return Math.min(Math.max(newVal, 0), 100);
        });
      }, 100);
    } else {
      if (valveIntervalRef.current) {
        clearInterval(valveIntervalRef.current);
        valveIntervalRef.current = null;
      }
    }
    return () => {
      if (valveIntervalRef.current) {
        clearInterval(valveIntervalRef.current);
        valveIntervalRef.current = null;
      }
    };
  }, [valveDirection]);

  // Update target turbine speed when valve changes (if reactor is running and not locked)
  useEffect(() => {
    if (isRunning && !isLocked) {
      setTargetTurbineSpeed(valveValue);
    }
  }, [valveValue, isRunning, isLocked]);

  // Control rod value changer (1% per second = 0.1 per tick)
  useEffect(() => {
    if (rodDirection !== 0) {
      if (rodIntervalRef.current) {
        clearInterval(rodIntervalRef.current);
        rodIntervalRef.current = null;
      }
      const interval = setInterval(() => {
        setRodPercentage(prev => {
          const newVal = prev + rodDirection * 0.1;
          return Math.min(Math.max(newVal, 0), 100);
        });
      }, 100);
      rodIntervalRef.current = interval;
    } else {
      if (rodIntervalRef.current) {
        clearInterval(rodIntervalRef.current);
        rodIntervalRef.current = null;
      }
    }
    return () => {
      if (rodIntervalRef.current) {
        clearInterval(rodIntervalRef.current);
        rodIntervalRef.current = null;
      }
    };
  }, [rodDirection]);

  // Turbine speed adjustment - smooth ramp to target
  useEffect(() => {
    if (turbineIntervalRef.current) {
      clearInterval(turbineIntervalRef.current);
      turbineIntervalRef.current = null;
    }
    if (isRunning) {
      const interval = setInterval(() => {
        setTurbineSpeed(prev => {
          const currentTarget = isLocked ? SYNC_TURBINE_SPEED : targetTurbineSpeed;
          const diff = currentTarget - prev;
          if (Math.abs(diff) < 0.01) return currentTarget;
          return prev + diff * 0.025;
        });
      }, 100);
      turbineIntervalRef.current = interval;
    }
    return () => {
      if (turbineIntervalRef.current) {
        clearInterval(turbineIntervalRef.current);
        turbineIntervalRef.current = null;
      }
    };
  }, [isRunning, targetTurbineSpeed, isLocked]);

  // Reactor physics simulation - now based on valveValue (power output)
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        // Calculate online pump count for cooling effect
        const onlinePumpCount = (pump1Online ? 1 : 0) + (pump2Online ? 1 : 0);
        
        // Temperature increase components
        const baseTempRise = valveValue * 0.01 * (1 - rodPercentage / 100);
        const pressureTempRise = pressure * 0.001;
        const coolingEffect = onlinePumpCount * 0.5;
        const coolantCooling = coolantPumpOn ? (coolantFlow * 0.04) : 0;
        
        // Net temperature change
        const netTempChange = baseTempRise + pressureTempRise - coolingEffect - coolantCooling;
        
        // Apply temperature change (max 4500°C)
        setTemperature(prev => Math.max(0, Math.min(prev + netTempChange, 4500)));
        
        // Pressure decreases when temperature is going down
        if (netTempChange < 0) {
          setPressure(prev => Math.max(1, prev - 0.1));
        } else {
          setPressure(prev => Math.min(200, prev + 0.1));
        }
        
        // Fuel depletes with power (valveValue)
        setFuelLevel(prev => Math.max(prev - valveValue * 0.001, 0));
        
        // Grid sync depends on turbine speed matching 3000 RPM ± 3
        const syncMargin = 3;
        const actualRPM = turbineSpeed * TURBINE_RPM_SCALE;
        if (Math.abs(actualRPM - SYNC_RPM) <= syncMargin) {
          setGridSync(prev => Math.min(prev + 0.5, 100));
        } else {
          setGridSync(prev => Math.max(prev - 0.5, 0));
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isRunning, valveValue, temperature, turbineSpeed, rodPercentage, pump1Online, pump2Online, pressure, coolantPumpOn, coolantFlow]);

  // Navigation handlers
  const handleLeftArrow = () => {
    if (activePanel === "status") setActivePanel("power-coolant");
    else if (activePanel === "power-coolant") setActivePanel("power-grid");
    else if (activePanel === "power-grid") setActivePanel("status");
    else setActivePanel("status");
  };

  const handleRightArrow = () => {
    if (activePanel === "status") setActivePanel("power-grid");
    else if (activePanel === "power-grid") setActivePanel("power-coolant");
    else if (activePanel === "power-coolant") setActivePanel("status");
    else setActivePanel("status");
  };

  const handleDownArrow = () => {
    if (activePanel === "status") setActivePanel("control-rods");
    else if (activePanel === "control-rods") setActivePanel("startup-shutdown");
    else if (activePanel === "startup-shutdown") setActivePanel("status");
    else setActivePanel("status");
  };

  const handleUpArrow = () => {
    if (activePanel === "startup-shutdown") setActivePanel("control-rods");
    else if (activePanel === "control-rods") setActivePanel("status");
    else if (activePanel === "status") setActivePanel("startup-shutdown");
    else setActivePanel("status");
  };

  // Reactor control actions
  const startReactor = () => {
    setIsRunning(true);
    setTargetTurbineSpeed(valveValue); // Set target speed based on current valve position
  };

  const stopReactor = () => {
    setIsRunning(false);
    setTargetTurbineSpeed(0);
  };

  const emergencyShutdown = () => {
    if (temperature > 3000 || scramPressed) {
      setIsRunning(false);
      setTemperature(25);
      setPressure(1);
      setTargetTurbineSpeed(0);
      setGridSync(0);
      setScramPressed(true);
    }
  };

  // Status indicators
  const getStatusColor = () => {
    if (temperature > 4500) return "destructive";
    if (temperature > 3000) return "warning";
    return "default";
  };

  const getStatusText = () => {
    if (temperature > 4500) return "CRITICAL";
    if (temperature > 3000) return "WARNING";
    if (isRunning) return "OPERATIONAL";
    return "STANDBY";
  };

  // Calculate values
  const actualRPM = turbineSpeed * TURBINE_RPM_SCALE;
  const targetRPM = targetTurbineSpeed * TURBINE_RPM_SCALE;
  const syncMargin = 3;
  const isSynchronized = Math.abs(actualRPM - SYNC_RPM) <= syncMargin;
  const syncDeviation = actualRPM - SYNC_RPM;
  const turbineOutputMW = isRunning ? valveValue * 2 * (1 - Math.min((temperature - 3000) / 1500, 0.1)) : 0;

  // Valve control handlers
  const handleValvePress = (direction: number) => {
    setValveDirection(direction);
  };

  const handlePausePress = () => {
    setValveDirection(0);
  };

  const handleSyncPress = () => {
    if (isSynchronized) {
      if (isLocked) {
        setIsLocked(false);
        setTargetTurbineSpeed(valveValue);
      } else {
        setIsLocked(true);
        setTargetTurbineSpeed(SYNC_TURBINE_SPEED);
      }
    }
  };

  // Control rod handlers
  const handleRodPress = (direction: number) => {
    setRodDirection(direction);
  };

  const handleRodNeutral = () => {
    setRodDirection(0);
  };

  // Render synchronoscope
  const renderSynchronoscope = () => {
    const centerX = 150;
    const centerY = 150;
    const radius = 120;
    const minRPM = 0;
    const maxRPM = 4500;
    const normalizedRPM = Math.max(minRPM, Math.min(maxRPM, actualRPM));
    const angle = ((normalizedRPM - SYNC_RPM) / (maxRPM - SYNC_RPM) * 90);
    const needleX = centerX + radius * 0.8 * Math.cos(angle * Math.PI / 180);
    const needleY = centerY + radius * 0.8 * Math.sin(angle * Math.PI / 180);

    // Draw scale marks
    const marks = [];
    for (let rpm = 0; rpm <= 4500; rpm += 500) {
      const markAngle = ((rpm - SYNC_RPM) / (maxRPM - SYNC_RPM) * 90);
      const x1 = centerX + radius * 0.9 * Math.cos(markAngle * Math.PI / 180);
      const y1 = centerY + radius * 0.9 * Math.sin(markAngle * Math.PI / 180);
      const x2 = centerX + radius * 1.0 * Math.cos(markAngle * Math.PI / 180);
      const y2 = centerY + radius * 1.0 * Math.sin(markAngle * Math.PI / 180);
      marks.push(
        <line key={`mark-${rpm}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="2" />
      );
      const labelX = centerX + radius * 1.1 * Math.cos(markAngle * Math.PI / 180);
      const labelY = centerY + radius * 1.1 * Math.sin(markAngle * Math.PI / 180);
      marks.push(
        <text key={`label-${rpm}`} x={labelX} y={labelY} fill="white" fontSize="12" textAnchor="middle" dominantBaseline="middle">
          {rpm}
        </text>
      );
    }

    // Draw sync zone
    const syncStartAngle = -3 / (maxRPM - SYNC_RPM) * 90;
    const syncEndAngle = 3 / (maxRPM - SYNC_RPM) * 90;
    return (
      <svg width="300" height="300" viewBox="0 0 300 300">
        <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#333" strokeWidth="2" />
        <path d={`M ${centerX} ${centerY} L ${centerX + radius * 0.95 * Math.cos(syncStartAngle * Math.PI / 180)} ${centerY + radius * 0.95 * Math.sin(syncStartAngle * Math.PI / 180)} A ${radius * 0.95} ${radius * 0.95} 0 0 1 ${centerX + radius * 0.95 * Math.cos(syncEndAngle * Math.PI / 180)} ${centerY + radius * 0.95 * Math.sin(syncEndAngle * Math.PI / 180)} Z`} fill="rgba(34, 197, 94, 0.2)" stroke="rgb(34, 197, 94)" strokeWidth="2" />
        {marks}
        <circle cx={centerX} cy={centerY} r="5" fill="white" />
        <line x1={centerX} y1={centerY} x2={needleX} y2={needleY} stroke={isSynchronized ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"} strokeWidth="3" strokeLinecap="round" />
        <text x={centerX} y={centerY - 40} fill="white" fontSize="14" textAnchor="middle" dominantBaseline="middle">
          {isSynchronized ? "SYNC" : "OUT OF SYNC"}
        </text>
        <text x={centerX} y={centerY + 40} fill="white" fontSize="12" textAnchor="middle" dominantBaseline="middle">
          {actualRPM.toFixed(0)} RPM
        </text>
        <text x={centerX} y={centerY + 60} fill="white" fontSize="10" textAnchor="middle" dominantBaseline="middle">
          Target: {SYNC_RPM} ± {syncMargin}
        </text>
      </svg>
    );
  };

  // Render pump status icon
  const renderPumpIcon = (isOnline: boolean) => (
    <Droplets size={24} className={isOnline ? "text-blue-400" : "text-gray-500"} />
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.4%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>
      </div>
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">NUCLEAR REACTOR CONTROL SYSTEM</h1>
          <p className="text-gray-400">Advanced Reactor Management Interface v2.0</p>
        </div>
        {/* Navigation Arrows */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={handleLeftArrow} className="p-3 bg-slate-800/50 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-all duration-300 hover:scale-110">
            <ArrowLeft className="text-cyan-400" size={24} />
          </button>
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">ACTIVE PANEL</div>
            <div className="text-lg font-bold text-cyan-400 uppercase">
              {activePanel === "status" && "STATUS"}
              {activePanel === "control-rods" && "CONTROL RODS"}
              {activePanel === "startup-shutdown" && "STARTUP/SHUTDOWN"}
              {activePanel === "power-coolant" && "POWER & COOLANT"}
              {activePanel === "power-grid" && "POWER GRID"}
            </div>
          </div>
          <button onClick={handleRightArrow} className="p-3 bg-slate-800/50 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-all duration-300 hover:scale-110">
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
                    <div className="text-2xl font-bold">{turbineOutputMW.toFixed(1)} MW</div>
                    <Progress value={valveValue} className="mt-2 h-2 bg-cyan-500/20" />
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
                    <Progress value={(temperature / 4500) * 100} className="mt-2 h-2 bg-orange-500/20" />
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
                {/* Reactor Visualization */}
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
          )}
          {/* Control Rods Panel */}
          {activePanel === "control-rods" && (
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
                    {/* Rod percentage display */}
                    <div className="text-4xl font-bold bg-slate-800/50 p-4 rounded-lg w-32 text-center border border-green-500/30">
                      {rodPercentage.toFixed(1)}%
                    </div>
                    {/* Control buttons */}
                    <div className="flex space-x-4">
                      <Button onClick={() => handleRodPress(1)} className={`px-6 py-3 rounded-md font-medium text-base ${rodDirection === 1 ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-800/50 border border-green-500/30 hover:bg-slate-900 text-white'}`}>
                        + (Lower)
                      </Button>
                      <Button onClick={() => handleRodNeutral()} className={`px-6 py-3 rounded-md font-medium text-base ${rodDirection === 0 ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-slate-800/50 border border-green-500/30 hover:bg-slate-900 text-white'}`}>
                        = (Neutral)
                      </Button>
                      <Button onClick={() => handleRodPress(-1)} className={`px-6 py-3 rounded-md font-medium text-base ${rodDirection === -1 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-800/50 border border-green-500/30 hover:bg-slate-900 text-white'}`}>
                        - (Raise)
                      </Button>
                    </div>
                    {/* Visual rod indicator */}
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
                    <Button onClick={startReactor} disabled={isRunning} className="bg-green-600 hover:bg-green-700 h-16 text-lg font-bold border-2 border-green-500/50">
                      START REACTOR
                    </Button>
                    <Button onClick={stopReactor} disabled={!isRunning} className="bg-red-600 hover:bg-red-700 h-16 text-lg font-bold border-2 border-red-500/50">
                      STOP REACTOR
                    </Button>
                    <Button 
                      onClick={emergencyShutdown}
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
          )}
          {/* Power & Coolant Panel (LEFT panel - contains feedwater pumps) */}
          {activePanel === "power-coolant" && (
            <div className="space-y-6">
              {/* Feedwater Pumps */}
              <Card className="bg-slate-800/50 border-cyan-500/30">
                <CardHeader>
                  <CardTitle className="text-cyan-400 flex items-center gap-2">
                    <Droplets className="text-cyan-400" size={20} />
                    Feedwater Pumps
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Pump 1 */}
                  <div className="p-4 bg-slate-900/50 rounded-lg border border-cyan-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {renderPumpIcon(pump1Online)}
                        <span className="text-lg font-bold">Pump 1</span>
                      </div>
                      <Badge className={pump1Online ? "bg-blue-600 text-white" : "bg-gray-600 text-gray-300"}>
                        {pump1Online ? "ONLINE" : "OFFLINE"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => setPump1Online(true)} disabled={pump1Online} className={`flex-1 py-3 font-bold text-base ${pump1Online ? 'bg-gray-600 text-gray-300' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                        ON
                      </Button>
                      <Button onClick={() => setPump1Online(false)} disabled={!pump1Online} className={`flex-1 py-3 font-bold text-base ${!pump1Online ? 'bg-gray-600 text-gray-300' : 'bg-gray-700 hover:bg-gray-800 text-white'}`}>
                        OFF
                      </Button>
                    </div>
                  </div>
                  {/* Pump 2 */}
                  <div className="p-4 bg-slate-900/50 rounded-lg border border-cyan-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {renderPumpIcon(pump2Online)}
                        <span className="text-lg font-bold">Pump 2</span>
                      </div>
                      <Badge className={pump2Online ? "bg-blue-600 text-white" : "bg-gray-600 text-gray-300"}>
                        {pump2Online ? "ONLINE" : "OFFLINE"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => setPump2Online(true)} disabled={pump2Online} className={`flex-1 py-3 font-bold text-base ${pump2Online ? 'bg-gray-600 text-gray-300' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                        ON
                      </Button>
                      <Button onClick={() => setPump2Online(false)} disabled={!pump2Online} className={`flex-1 py-3 font-bold text-base ${!pump2Online ? 'bg-gray-600 text-gray-300' : 'bg-gray-700 hover:bg-gray-800 text-white'}`}>
                        OFF
                      </Button>
                    </div>
                  </div>
                  {/* Feedwater summary */}
                  <div className="p-4 bg-slate-900/50 rounded-lg border border-blue-500/30">
                    <h3 className="text-blue-400 font-bold mb-2">Feedwater System Status</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Active Pumps:</span>
                        <span className="text-blue-400">{(pump1Online ? 1 : 0) + (pump2Online ? 1 : 0)} / 2</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cooling Rate:</span>
                        <span className="text-blue-400">{((pump1Online ? 1 : 0) + (pump2Online ? 1 : 0)) * 0.5}°C/s</span>
                      </div>
                      <div className="flex justify-between">
                        <span>System Status:</span>
                        <span className={(pump1Online || pump2Online) ? "text-green-400" : "text-yellow-400"}>
                          {(pump1Online || pump2Online) ? "FEEDWATER ONLINE" : "FEEDWATER OFFLINE"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Coolant System */}
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
                  <div className="flex gap-2 mb-4">
                    <Button 
                      onClick={() => setCoolantPumpOn(true)} 
                      disabled={coolantPumpOn}
                      className={`flex-1 py-3 font-bold text-base ${coolantPumpOn ? 'bg-gray-600 text-gray-300' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                    >
                      ON
                    </Button>
                    <Button 
                      onClick={() => setCoolantPumpOn(false)} 
                      disabled={!coolantPumpOn}
                      className={`flex-1 py-3 font-bold text-base ${!coolantPumpOn ? 'bg-gray-600 text-gray-300' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                    >
                      OFF
                    </Button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Coolant Intake Valve</label>
                    <Slider value={[coolantFlow]} onValueChange={(value) => setCoolantFlow(value[0])} max={100} step={1} className="w-full" />
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
                        Target: {SYNC_RPM} RPM ± {syncMargin} | Current: {actualRPM.toFixed(0)} RPM
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
                    {/* Steam Valve Display */}
                    <div className="flex flex-col items-center space-y-2">
                      <div className="text-2xl font-bold bg-slate-800/50 p-3 rounded-lg w-32 text-center border border-cyan-500/30">
                        {valveValue.toFixed(1).replace('.', ',')}%
                      </div>
                      <div className="flex space-x-4">
                        <Button onClick={() => handleValvePress(-1)} className={`px-4 py-2 rounded-md font-medium text-base ${valveDirection === -1 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-800/50 border border-cyan-500/30 hover:bg-slate-900 text-white'}`}>
                          −
                        </Button>
                        <Button onClick={() => handlePausePress()} className={`px-4 py-2 rounded-md font-medium text-base ${valveDirection === 0 ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-slate-800/50 border border-cyan-500/30 hover:bg-slate-900 text-white'}`}>
                          Pause
                        </Button>
                        <Button onClick={() => handleValvePress(1)} className={`px-4 py-2 rounded-md font-medium text-base ${valveDirection === 1 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-800/50 border border-cyan-500/30 hover:bg-slate-900 text-white'}`}>
                          +
                        </Button>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Steam Input Valve (0.5% per second)</div>
                    </div>
                    {/* Sync Button */}
                    <div className="flex justify-center mt-4">
                      <Button onClick={handleSyncPress} disabled={!isSynchronized} className={`px-6 py-3 rounded-md font-bold text-base ${isLocked ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/50' : isSynchronized ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/50' : 'bg-slate-800/50 border border-gray-600 text-gray-500'}`}>
                        {isLocked ? 'UNLOCK' : 'SYNC'}
                      </Button>
                    </div>
                    {/* Turbine Status */}
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
          )}
        </div>
        {/* Vertical Navigation (Up/Down) */}
        <div className="flex justify-center gap-4">
          <button onClick={handleUpArrow} className="p-3 bg-slate-800/50 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-all duration-300 hover:scale-110">
            <ArrowUp className="text-cyan-400" size={24} />
          </button>
          <button onClick={handleDownArrow} className="p-3 bg-slate-800/50 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-all duration-300 hover:scale-110">
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