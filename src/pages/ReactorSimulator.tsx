"use client";  
import React, { useState, useEffect, useRef } from "react";  
import { ArrowLeft, ArrowRight, ArrowDown, ArrowUp } from "lucide-react";  

// Components  
import { ReactorStatusPanel } from "@/components/ReactorStatusPanel";  
import { ControlRodsPanel } from "@/components/ControlRodsPanel";  
import { StartupShutdownPanel } from "@/components/StartupShutdownPanel";  
import { PowerCoolantPanel } from "@/components/PowerCoolantPanel";  
import { PowerGridPanel } from "@/components/PowerGridPanel";  

// Hooks  
import { useReactorPhysics } from "@/hooks/useReactorPhysics";  
import { useTurbineControl } from "@/hooks/useTurbineControl";  

const ReactorSimulator = () => {  
  // State  
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
  const [rodPercentage, setRodPercentage] = useState(0);  
  const [pump1Online, setPump1Online] = useState(false);  
  const [pump2Online, setPump2Online] = useState(false);  
  const [valveValue, setValveValue] = useState(50);  
  const [scramPressed, setScramPressed] = useState(false);  
  const [isLocked, setIsLocked] = useState(false);  

  // Control directions  
  const [valveDirection, setValveDirection] = useState(0);  
  const [rodDirection, setRodDirection] = useState(0);  

  // Unified physics simulation hook  
  useReactorPhysics({  
    isRunning,  
    valveValue,  
    rodPercentage,  
    pump1Online,  
    pump2Online,  
    pressure,  
    coolantPumpOn,  
    coolantFlow,  
    onTemperatureChange: setTemperature,  
    onPressureChange: setPressure,  
    onFuelLevelChange: setFuelLevel,  
    onGridSyncChange: setGridSync,  
    onTurbineSpeedChange: setTurbineSpeed,  
    targetTurbineSpeed,  
    isLocked,  
  });  

  // Turbine control hook (simplified)  
  const { actualRPM, targetRPM, isSynchronized, syncDeviation } = useTurbineControl({  
    isRunning,  
    targetTurbineSpeed,  
    isLocked,  
    onTurbineSpeedChange: setTurbineSpeed,  
  });  

  // Update target turbine speed when valve changes  
  useEffect(() => {  
    if (isRunning && !isLocked) {  
      setTargetTurbineSpeed(valveValue);  
    }  
  }, [valveValue, isRunning, isLocked]);  

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

  // Calculate turbine output  
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
        setTargetTurbineSpeed(66.67); // SYNC_TURBINE_SPEED  
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

  return (  
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">  
      {/* Background Grid Pattern */}  
      <div className="fixed inset-0 opacity-10">  
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.4%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>  
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
          {activePanel === "status" && (  
            <ReactorStatusPanel  
              temperature={temperature}  
              pressure={pressure}  
              fuelLevel={fuelLevel}  
              gridSync={gridSync}  
              turbineOutputMW={turbineOutputMW}  
              valveValue={valveValue}  
              isRunning={isRunning}  
              getStatusColor={getStatusColor}  
              getStatusText={getStatusText}  
            />  
          )}  
          {activePanel === "control-rods" && (  
            <ControlRodsPanel  
              rodPercentage={rodPercentage}  
              rodDirection={rodDirection}  
              onRodPress={handleRodPress}  
              onRodNeutral={handleRodNeutral}  
            />  
          )}  
          {activePanel === "startup-shutdown" && (  
            <StartupShutdownPanel  
              isRunning={isRunning}  
              temperature={temperature}  
              scramPressed={scramPressed}  
              onStartReactor={startReactor}  
              onStopReactor={stopReactor}  
              onEmergencyShutdown={emergencyShutdown}  
            />  
          )}  
          {activePanel === "power-coolant" && (  
            <PowerCoolantPanel  
              pump1Online={pump1Online}  
              pump2Online={pump2Online}  
              coolantPumpOn={coolantPumpOn}  
              coolantFlow={coolantFlow}  
              pressure={pressure}  
              onPump1Change={setPump1Online}  
              onPump2Change={setPump2Online}  
              onCoolantPumpChange={setCoolantPumpOn}  
              onCoolantFlowChange={setCoolantFlow}  
            />  
          )}  
          {activePanel === "power-grid" && (  
            <PowerGridPanel  
              actualRPM={actualRPM(turbineSpeed)}  
              targetRPM={targetRPM}  
              isSynchronized={isSynchronized}  
              isLocked={isLocked}  
              valveValue={valveValue}  
              valveDirection={valveDirection}  
              turbineOutputMW={turbineOutputMW}  
              turbineSpeed={turbineSpeed}  
              onValvePress={handleValvePress}  
              onPausePress={handlePausePress}  
              onSyncPress={handleSyncPress}  
            />  
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

      <style>{`  
        @keyframes pulse {  
          0%, 100% { opacity: 0.5; transform: scale(1); }  
          50% { opacity: 0.8; transform: scale(1.05); }  
        }  
      `}</style>  
    </div>  
  );  
};  

export default ReactorSimulator;