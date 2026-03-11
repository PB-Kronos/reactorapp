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
  Activity,
  Terminal as LucideTerminal,
  AlertTriangle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { MadeWithDyad } from "@/components/made-with-dyad";

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

  // Steam valve value changer (0.2% per second = 0.002 per tick)
  useEffect(() => {
    if (valveIntervalRef.current) {
      clearInterval(valveIntervalRef.current);
      valveIntervalRef.current = null;
    }

    if (valveDirection !== 0) {
      const interval = setInterval(() => {
        setValveValue(prev => {
          const newVal = prev + valveDirection * 0.002;
          return Math.min(Math.max(newVal, 0), 100);
        });
      }, 10);
      valveIntervalRef.current = interval;
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
    if (rodIntervalRef.current) {
      clearInterval(rodIntervalRef.current);
      rodIntervalRef.current = null;
    }

    if (rodDirection !== 0) {
      const interval = setInterval(() => {
        setRodPercentage(prev => {
          const newVal = prev + rodDirection * 0.1;
          return Math.min(Math.max(newVal, 0), 100);
        });
      }, 10);
      rodIntervalRef.current = interval;
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

  // Reactor physics simulation
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        const onlinePumpCount = (pump1Online ? 1 : 0) + (pump2Online ? 1 : 0);
        
        const baseTempRise = valveValue * 0.01 * (1 - rodPercentage / 100);
        const pressureTempRise = pressure * 0.001;
        const coolingEffect = onlinePumpCount * 0.5;
        const coolantCooling = coolantPumpOn ? (coolantFlow * 0.04) : 0;
        
        const netTempChange = baseTempRise + pressureTempRise - coolingEffect - coolantCooling;
        
        setTemperature(prev => Math.max(0, Math.min(prev + netTempChange, 4500)));
        
        if (netTempChange < 0) {
          setPressure(prev => Math.max(1, prev - 0.1));
        } else {
          setPressure(prev => Math.min(200, prev + 0.1));
        }
        
        setFuelLevel(prev => Math.max(prev - valveValue * 0.001, 0));
        
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
  }, [isRunning, valveValue, turbineSpeed, rodPercentage, pump1Online, pump2Online, pressure, coolantPumpOn, coolantFlow]);

  // Reactor control actions
  const startReactor = () => {
    setIsRunning(true);
    setTargetTurbineSpeed(valveValue);
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

  const actualRPM = turbineSpeed * TURBINE_RPM_SCALE;
  const targetRPM = targetTurbineSpeed * TURBINE_RPM_SCALE;
  const syncMargin = 3;
  const isSynchronized = Math.abs(actualRPM - SYNC_RPM) <= syncMargin;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.4%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2V6h4V4H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* HERO SECTION - Same as homepage */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            NUCLEAR REACTOR
          </h1>
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">
            CONTROL SYSTEM
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Advanced Reactor Management Interface v2.0
          </p>
        </div>

        {/* Main Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-slate-800/50 border-cyan-500/30 hover:border-cyan-400 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <Zap className="text-cyan-400 mx-auto mb-2" size={48} />
              <CardTitle className="text-cyan-400">Real-time Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Monitor power output, temperature, pressure, and fuel levels in real-time with advanced sensors.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/30 hover:border-purple-400 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <Shield className="text-purple-400 mx-auto mb-2" size={48} />
              <CardTitle className="text-purple-400">Safety Systems</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Advanced safety protocols with emergency shutdown capabilities and containment monitoring.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-green-500/30 hover:border-green-400 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <Settings className="text-green-400 mx-auto mb-2" size={48} />
              <CardTitle className="text-green-400">Full Control</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Complete control over reactor operations, coolant systems, and power grid synchronization.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white px-8 py-4 text-lg font-bold border-2 border-cyan-400/50 hover:border-cyan-300 transition-all duration-300 hover:scale-105"
            onClick={() => window.location.href = '/terminal'}
          >
            ACCESS TERMINAL MAINFRAME
            <LucideTerminal className="ml-2" size={20} />
          </Button>
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white px-8 py-4 text-lg font-bold border-2 border-green-400/50 hover:border-green-300 transition-all duration-300 hover:scale-105"
            disabled
          >
            REACTOR CONTROL ACTIVE
            <Power className="ml-2" size={20} />
          </Button>
        </div>

        {/* System Status */}
        <Card className="bg-slate-800/50 border-cyan-500/30 mb-8">
          <CardHeader>
            <CardTitle className="text-cyan-400">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-green-400 font-bold text-lg">OPERATIONAL</div>
                <div className="text-sm text-gray-400">Reactor Core</div>
              </div>
              <div>
                <div className="text-green-400 font-bold text-lg">NOMINAL</div>
                <div className="text-sm text-gray-400">Coolant System</div>
              </div>
              <div>
                <div className="text-green-400 font-bold text-lg">SYNCHRONIZED</div>
                <div className="text-sm text-gray-400">Power Grid</div>
              </div>
              <div>
                <div className="text-green-400 font-bold text-lg">SECURE</div>
                <div className="text-sm text-gray-400">Containment</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Header with Navigation */}
        <div className="flex justify-between items-center mb-6">
          <Button 
            variant="outline"
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            onClick={() => window.location.href = '/'}
          >
            <ArrowLeft className="mr-2" size={16} />
            Back to Home
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              REACTOR CONTROL SYSTEM
            </h1>
            <p className="text-sm text-gray-400">Real-time monitoring and control</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={isRunning ? "default" : "secondary"} className={isRunning ? "bg-green-600" : "bg-gray-600"}>
              {isRunning ? "RUNNING" : "STANDBY"}
            </Badge>
            <Badge variant={getStatusColor()}>
              {getStatusText()}
            </Badge>
          </div>
        </div>

        {/* Main Control Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Status Gauges */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-slate-800/50 border-cyan-500/30">
              <CardHeader>
                <CardTitle className="text-cyan-400 text-sm flex items-center gap-2">
                  <Thermometer size={16} />
                  Core Temperature
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan-300 mb-2">
                  {temperature.toFixed(0)}°C
                </div>
                <Progress 
                  value={(temperature / 4500) * 100} 
                  className="h-2"
                  indicatorClassName={`${
                    temperature > 4500 ? 'bg-red-500' : 
                    temperature > 3000 ? 'bg-yellow-500' : 
                    'bg-cyan-500'
                  }`}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0°C</span>
                  <span>4500°C</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-purple-400 text-sm flex items-center gap-2">
                  <Gauge size={16} />
                  Pressure
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-300 mb-2">
                  {pressure.toFixed(1)} MPa
                </div>
                <Progress 
                  value={(pressure / 200) * 100} 
                  className="h-2"
                  indicatorClassName="bg-purple-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 MPa</span>
                  <span>200 MPa</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-green-500/30">
              <CardHeader>
                <CardTitle className="text-green-400 text-sm flex items-center gap-2">
                  <Fuel size={16} />
                  Fuel Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-300 mb-2">
                  {fuelLevel.toFixed(1)}%
                </div>
                <Progress 
                  value={fuelLevel} 
                  className="h-2"
                  indicatorClassName="bg-green-500"
                />
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-yellow-500/30">
              <CardHeader>
                <CardTitle className="text-yellow-400 text-sm flex items-center gap-2">
                  <Zap size={16} />
                  Power Output
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-300">
                  {turbineOutputMW.toFixed(1)} MW
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Grid Sync: {gridSync.toFixed(0)}%
                </div>
                <Progress 
                  value={gridSync} 
                  className="h-2 mt-2"
                  indicatorClassName="bg-yellow-500"
                />
              </CardContent>
            </Card>
          </div>

          {/* Center Column - Synchronoscope & Main Controls */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-slate-800/50 border-cyan-500/30">
              <CardHeader>
                <CardTitle className="text-cyan-400 flex items-center justify-between">
                  <span>Synchronoscope</span>
                  <Badge variant={isSynchronized ? "default" : "destructive"} className={isSynchronized ? "bg-green-600" : "bg-red-600"}>
                    {isSynchronized ? "SYNC" : "OUT OF SYNC"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                {renderSynchronoscope()}
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-cyan-500/30">
              <CardHeader>
                <CardTitle className="text-cyan-400">Steam Input Valve Control</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Valve Position</span>
                    <span className="text-lg font-bold text-cyan-300">{valveValue.toFixed(1)}%</span>
                  </div>
                  <Slider
                    value={[valveValue]}
                    onValueChange={(value) => setValveValue(value[0])}
                    max={100}
                    min={0}
                    step={0.1}
                    className="py-4"
                    disabled={isLocked}
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      variant="outline"
                      className="flex-1 border-cyan-500/30 text-cyan-400"
                      onMouseDown={() => handleValvePress(-1)}
                      onMouseUp={handlePausePress}
                      onMouseLeave={handlePausePress}
                      disabled={isLocked}
                    >
                      Close (-0.2%/s)
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="flex-1 border-cyan-500/30 text-cyan-400"
                      onMouseDown={() => handleValvePress(1)}
                      onMouseUp={handlePausePress}
                      onMouseLeave={handlePausePress}
                      disabled={isLocked}
                    >
                      Open (+0.2%/s)
                    </Button>
                  </div>
                  {isLocked && (
                    <p className="text-xs text-yellow-400 text-center">
                      Valve locked at sync speed (66.67%)
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-red-400 flex items-center gap-2">
                  <AlertTriangle size={20} />
                  Emergency Scram
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  size="lg"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-xl"
                  onClick={emergencyShutdown}
                  disabled={!scramPressed && temperature < 3000}
                >
                  SCRAM REACTOR
                </Button>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  {!scramPressed && temperature < 3000 
                    ? "Available only when temperature > 3000°C or after previous scram" 
                    : "Emergency shutdown - immediately inserts all control rods"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Control Rods & Pumps */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-slate-800/50 border-orange-500/30">
              <CardHeader>
                <CardTitle className="text-orange-400">Control Rods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Insertion</span>
                    <span className="text-lg font-bold text-orange-300">{rodPercentage.toFixed(0)}%</span>
                  </div>
                  <Progress 
                    value={rodPercentage} 
                    className="h-3"
                    indicatorClassName="bg-orange-500"
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      variant="outline"
                      className="flex-1 border-orange-500/30 text-orange-400"
                      onMouseDown={() => handleRodPress(1)}
                      onMouseUp={handleRodNeutral}
                      onMouseLeave={handleRodNeutral}
                    >
                      Insert (+1%/s)
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="flex-1 border-orange-500/30 text-orange-400"
                      onMouseDown={() => handleRodPress(-1)}
                      onMouseUp={handleRodNeutral}
                      onMouseLeave={handleRodNeutral}
                    >
                      Withdraw (-1%/s)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-blue-500/30">
              <CardHeader>
                <CardTitle className="text-blue-400 flex items-center gap-2">
                  <Droplets size={16} />
                  Feedwater Pumps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Pump 1</span>
                    <Button
                      size="sm"
                      variant={pump1Online ? "default" : "outline"}
                      className={pump1Online ? "bg-blue-600" : "border-blue-500/30 text-blue-400"}
                      onClick={() => setPump1Online(!pump1Online)}
                    >
                      {pump1Online ? "ONLINE" : "OFFLINE"}
                    </Button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Pump 2</span>
                    <Button
                      size="sm"
                      variant={pump2Online ? "default" : "outline"}
                      className={pump2Online ? "bg-blue-600" : "border-blue-500/30 text-blue-400"}
                      onClick={() => setPump2Online(!pump2Online)}
                    >
                      {pump2Online ? "ONLINE" : "OFFLINE"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-teal-500/30">
              <CardHeader>
                <CardTitle className="text-teal-400 flex items-center gap-2">
                  <Droplets size={16} />
                  Coolant System
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Pump</span>
                    <Button
                      size="sm"
                      variant={coolantPumpOn ? "default" : "outline"}
                      className={coolantPumpOn ? "bg-teal-600" : "border-teal-500/30 text-teal-400"}
                      onClick={() => setCoolantPumpOn(!coolantPumpOn)}
                    >
                      {coolantPumpOn ? "ON" : "OFF"}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Flow Rate</span>
                      <span className="text-teal-300">{coolantFlow.toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={[coolantFlow]}
                      onValueChange={(value) => setCoolantFlow(value[0])}
                      max={100}
                      min={0}
                      step={1}
                      disabled={!coolantPumpOn}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-green-500/30">
              <CardHeader>
                <CardTitle className="text-green-400 flex items-center gap-2">
                  <Power size={16} />
                  Reactor Control
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button 
                    size="lg"
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={startReactor}
                    disabled={isRunning}
                  >
                    START REACTOR
                  </Button>
                  <Button 
                    size="lg"
                    className="w-full bg-red-600 hover:bg-red-700"
                    onClick={stopReactor}
                    disabled={!isRunning}
                  >
                    STOP REACTOR
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    className="w-full border-yellow-500/30 text-yellow-400"
                    onClick={handleSyncPress}
                    disabled={!isSynchronized}
                  >
                    {isLocked ? "UNLOCK SPEED" : "LOCK TO SYNC"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer Status Bar */}
        <div className="mt-6 p-4 bg-slate-800/30 border border-cyan-500/20 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Turbine RPM:</span>
              <span className="ml-2 font-mono text-cyan-300">{actualRPM.toFixed(0)} / {targetRPM.toFixed(0)}</span>
            </div>
            <div>
              <span className="text-gray-400">Valve Position:</span>
              <span className="ml-2 font-mono text-cyan-300">{valveValue.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-400">Control Rods:</span>
              <span className="ml-2 font-mono text-orange-300">{rodPercentage.toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-gray-400">Coolant Flow:</span>
              <span className="ml-2 font-mono text-teal-300">{coolantFlow.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Made with Dyad */}
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default ReactorSimulator;