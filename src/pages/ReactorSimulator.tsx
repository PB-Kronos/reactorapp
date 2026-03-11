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

  // Steam valve value changer (0.2% per second = 0.002 per tick)
  useEffect(() => {
    // Clear any existing interval first
    if (valveIntervalRef.current) {
      clearInterval(valveIntervalRef.current);
      valveIntervalRef.current = null;
    }

    // Only create new interval if valveDirection is not 0
    if (valveDirection !== 0) {
      const interval = setInterval(() => {
        setValveValue(prev => {
          const newVal = prev + valveDirection * 0.002; // 0.2% per second
          return Math.min(Math.max(newVal, 0), 100);
        });
      }, 10); // 10ms for smooth updates
      valveIntervalRef.current = interval;
    }

    // Cleanup function
    return () => {
      if (valveIntervalRef.current) {
        clearInterval(valveIntervalRef.current);
        valveIntervalRef.current = null;
      }
    };
  }, [valveDirection]); // Only re-run when valveDirection changes

  // Update target turbine speed when valve changes (if reactor is running and not locked)
  useEffect(() => {
    if (isRunning && !isLocked) {
      setTargetTurbineSpeed(valveValue);
    }
  }, [valveValue, isRunning, isLocked]);

  // Control rod value changer (1% per second = 0.1 per tick)
  useEffect(() => {
    // Clear any existing interval first
    if (rodIntervalRef.current) {
      clearInterval(rodIntervalRef.current);
      rodIntervalRef.current = null;
    }

    // Only create new interval if rodDirection is not 0
    if (rodDirection !== 0) {
      const interval = setInterval(() => {
        setRodPercentage(prev => {
          const newVal = prev + rodDirection * 0.1;
          return Math.min(Math.max(newVal, 0), 100);
        });
      }, 10); // 10ms for smooth updates
      rodIntervalRef.current = interval;
    }

    // Cleanup function
    return () => {
      if (rodIntervalRef.current) {
        clearInterval(rodIntervalRef.current);
        rodIntervalRef.current = null;
      }
    };
  }, [rodDirection]); // Only re-run when rodDirection changes

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
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.4%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2V6h4V4H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>
      </div>
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            NUCLEAR REACTOR CONTROL SYSTEM
          </h1>
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">
            ADVANCED REACTOR MANAGEMENT INTERFACE v2.0
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Real-time monitoring and control of nuclear reactor operations
          </p>
        </div>
        {/* Main Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-slate-800/50 border-cyan-500/30 hover:border-cyan-400 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <CardTitle className="text-cyan-400 flex items-center gap-2">
                <Zap className="text-cyan-400" size={24} />
                Real-time Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Monitor power output, temperature, pressure, and fuel levels in real-time with advanced sensors.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/30 hover:border-purple-400 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <CardTitle className="text-purple-400 flex items-center gap-2">
                <Shield className="text-purple-400" size={24} />
                Safety Systems
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Advanced safety protocols with emergency shutdown capabilities and containment monitoring.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-green-500/30 hover:border-green-400 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <CardTitle className="text-green-400 flex items-center gap-2">
                <Settings className="text-green-400" size={24} />
                Full Control
              </CardTitle>
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
            onClick={() => window.location.href = '/reactor'}
          >
            <ArrowRight className="mr-2" size={20} />
            ENTER REACTOR CONTROL SYSTEM
          </Button>
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white px-8 py-4 text-lg font-bold border-2 border-green-400/50 hover:border-green-300 transition-all duration-300 hover:scale-105"
            onClick={() => window.location.href = '/terminal'}
          >
            <LucideTerminal className="mr-2" size={20} />
            ACCESS TERMINAL MAINFRAME
          </Button>
        </div>

        {/* System Status */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold mb-2">System Status</h3>
              <p className="text-gray-400">All systems nominal</p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="default" className="text-xs px-2 py-1 bg-gray-900 text-gray-300">
                ONLINE
              </Badge>
              <Badge variant="default" className="text-xs px-2 py-1 bg-gray-900 text-gray-300">
                ONLINE
              </Badge>
              <Badge variant="default" className="text-xs px-2 py-1 bg-gray-900 text-gray-300">
                ONLINE
              </Badge>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-400 text-sm">
          <p>NUCLEAR REACTOR CONTROL SYSTEM • CLASS 1 LICENSED • SAFETY PROTOCOLS ACTIVE</p>
          <p className="mt-1">© 2024 Advanced Reactor Management Systems</p>
        </div>
      </div>
    </div>
  );
};

export default ReactorSimulator;