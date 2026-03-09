"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, AlertTriangle, Zap, Thermometer, Shield, Gauge, Radio, Cpu, Waves } from "lucide-react";

const ReactorSimulator = () => {
  // Core state
  const [power, setPower] = useState<number>(0);
  const [controlRod, setControlRod] = useState<number>(50);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isScrammed, setIsScrammed] = useState<boolean>(false);
  
  // Thermal hydraulics
  const [temperature, setTemperature] = useState<number>(300);
  const [coolantFlow, setCoolantFlow] = useState<number>(75);
  const [coolantPressure, setCoolantPressure] = useState<number>(155);
  const [steamPressure, setSteamPressure] = useState<number>(60);
  
  // Neutronics
  const [reactivity, setReactivity] = useState<number>(0);
  const [neutronFlux, setNeutronFlux] = useState<number>(0);
  const [fuelBurnup, setFuelBurnup] = useState<number>(0);
  
  // Status
  const [fuelRodStatus, setFuelRodStatus] = useState<string>("Normal");
  const [alertLevel, setAlertLevel] = useState<"low" | "medium" | "high" | "critical">("low");
  const [alerts, setAlerts] = useState<string[]>([]);

  // Constants for simulation
  const MAX_TEMPERATURE = 1200;
  const CRITICAL_TEMPERATURE = 900;
  const WARNING_TEMPERATURE = 700;
  const ELEVATED_TEMPERATURE = 500;
  
  const MAX_PRESSURE = 200;
  const CRITICAL_PRESSURE = 180;
  const WARNING_PRESSURE = 160;

  // Calculate reactivity based on control rods and temperature
  const calculateReactivity = useCallback(() => {
    const rodReactivity = (100 - controlRod) * 0.01;
    const tempCoeff = temperature > 300 ? -(temperature - 300) * 0.0005 : 0;
    const burnupEffect = -fuelBurnup * 0.0001;
    return Math.max(-1, Math.min(1, rodReactivity + tempCoeff + burnupEffect));
  }, [controlRod, temperature, fuelBurnup]);

  // Main simulation loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && !isScrammed) {
      interval = setInterval(() => {
        // Calculate reactivity
        const currentReactivity = calculateReactivity();
        setReactivity(currentReactivity);
        
        // Neutron flux follows reactivity with some inertia
        setNeutronFlux(prev => {
          const targetFlux = currentReactivity * 100;
          return prev + (targetFlux - prev) * 0.1;
        });
        
        // Power is proportional to neutron flux
        setPower(prev => {
          const targetPower = Math.abs(neutronFlux);
          return prev + (targetPower - prev) * 0.2;
        });
        
        // Temperature dynamics
        setTemperature(prev => {
          const heatGeneration = power * 0.8;
          const cooling = coolantFlow * 0.3;
          const newTemp = prev + (heatGeneration - cooling) * 0.1;
          return Math.max(20, Math.min(MAX_TEMPERATURE, newTemp));
        });
        
        // Pressure dynamics
        setCoolantPressure(prev => {
          const pressureIncrease = temperature * 0.05;
          const pressureDecrease = coolantFlow * 0.2;
          const newPressure = prev + (pressureIncrease - pressureDecrease) * 0.01;
          return Math.max(50, Math.min(MAX_PRESSURE, newPressure));
        });
        
        setSteamPressure(prev => {
          const steamGen = temperature * 0.03;
          const steamUse = power * 0.02;
          const newPressure = prev + (steamGen - steamUse) * 0.01;
          return Math.max(0, Math.min(150, newPressure));
        });
        
        // Fuel burnup increases slowly
        setFuelBurnup(prev => prev + 0.001);
        
        // Update status based on conditions
        if (temperature > CRITICAL_TEMPERATURE || coolantPressure > CRITICAL_PRESSURE) {
          setFuelRodStatus("CRITICAL");
          setAlertLevel("critical");
          setIsScrammed(true);
          addAlert("CRITICAL: Automatic SCRAM initiated!");
        } else if (temperature > WARNING_TEMPERATURE || coolantPressure > WARNING_PRESSURE) {
          setFuelRodStatus("WARNING");
          setAlertLevel("high");
        } else if (temperature > ELEVATED_TEMPERATURE) {
          setFuelRodStatus("ELEVATED");
          setAlertLevel("medium");
        } else {
          setFuelRodStatus("NORMAL");
          setAlertLevel("low");
        }
      }, 100);
    }
    
    return () => clearInterval(interval);
  }, [isRunning, isScrammed, power, coolantFlow, temperature, coolantPressure, neutronFlux, calculateReactivity]);

  const addAlert = (message: string) => {
    setAlerts(prev => [...prev, message]);
    setTimeout(() => {
      setAlerts(prev => prev.slice(1));
    }, 5000);
  };

  const startSimulation = () => {
    if (isScrammed) {
      setIsScrammed(false);
      setTemperature(300);
      setCoolantPressure(155);
    }
    setIsRunning(true);
    addAlert("Reactor startup initiated");
  };

  const stopSimulation = () => {
    setIsRunning(false);
    addAlert("Reactor shutdown");
  };

  const scram = () => {
    setIsScrammed(true);
    setIsRunning(false);
    setControlRod(100);
    addAlert("SCRAM: All control rods inserted!");
  };

  const handleControlRodChange = (value: number[]) => {
    const newValue = value[0];
    setControlRod(newValue);
  };

  const handleCoolantChange = (value: number[]) => {
    setCoolantFlow(value[0]);
  };

  const handlePressureChange = (value: number[]) => {
    setCoolantPressure(value[0]);
  };

  const reset = () => {
    setPower(0);
    setControlRod(50);
    setTemperature(300);
    setCoolantFlow(75);
    setCoolantPressure(155);
    setSteamPressure(60);
    setFuelBurnup(0);
    setIsRunning(false);
    setIsScrammed(false);
    setAlerts([]);
    addAlert("System reset complete");
  };

  const getAlertColor = () => {
    switch (alertLevel) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      default: return "default";
    }
  };

  const getAlertIcon = () => {
    switch (alertLevel) {
      case "critical": return <AlertTriangle className="h-4 w-4" />;
      case "high": return <AlertTriangle className="h-4 w-4" />;
      case "medium": return <Activity className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getTemperatureColor = () => {
    if (temperature > CRITICAL_TEMPERATURE) return "text-red-500";
    if (temperature > WARNING_TEMPERATURE) return "text-orange-500";
    if (temperature > ELEVATED_TEMPERATURE) return "text-yellow-500";
    return "text-green-500";
  };

  const getPressureColor = () => {
    if (coolantPressure > CRITICAL_PRESSURE) return "text-red-500";
    if (coolantPressure > WARNING_PRESSURE) return "text-orange-500";
    return "text-green-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
            Nuclear Reactor Simulator
          </h1>
          <p className="text-gray-400">Pressurized Water Reactor Control System v2.0</p>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {alerts.map((alert, idx) => (
              <Alert key={idx} className="bg-yellow-900/50 border-yellow-600">
                <AlertDescription>{alert}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Main Status Alert */}
        <Alert className={`mb-6 ${getAlertColor()}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getAlertIcon()}
              <AlertDescription>
                Status: <span className="font-bold">{fuelRodStatus}</span> | 
                Temp: <span className={`font-bold ${getTemperatureColor()}`}>{temperature.toFixed(1)}°C</span> | 
                Power: <span className="font-bold">{power.toFixed(1)}%</span>
              </AlertDescription>
            </div>
            {isScrammed && (
              <Badge variant="destructive" className="animate-pulse">SCRAMMED</Badge>
            )}
          </div>
        </Alert>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Core Visualization & Controls */}
          <div className="xl:col-span-2 space-y-6">
            {/* Reactor Core Visualization */}
            <Card className="bg-gray-800/50 border-gray-700 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-400" />
                  Reactor Core
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative w-full h-80 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                  {/* Core Container */}
                  <div className="absolute inset-8 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border-2 border-gray-600">
                    {/* Fuel Rods Grid */}
                    <div className="grid grid-cols-6 gap-3 p-6 h-full items-center justify-center">
                      {[...Array(24)].map((_, i) => {
                        const intensity = temperature / MAX_TEMPERATURE;
                        let color = "bg-green-500";
                        if (intensity > 0.75) color = "bg-red-500";
                        else if (intensity > 0.5) color = "bg-orange-500";
                        else if (intensity > 0.3) color = "bg-yellow-500";
                        
                        return (
                          <div 
                            key={i}
                            className={`w-6 h-20 rounded-sm ${color} transition-all duration-1000 opacity-80 shadow-lg`}
                            style={{
                              boxShadow: `0 0 ${10 * intensity}px ${color.replace('bg-', '')}`,
                              filter: `brightness(${0.5 + intensity * 0.5})`
                            }}
                          />
                        );
                      })}
                    </div>
                    
                    {/* Control Rods */}
                    <div className="absolute top-4 right-4 space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div 
                          key={i}
                          className="w-3 bg-gray-600 rounded"
                          style={{ 
                            height: `${controlRod}%`,
                            background: `linear-gradient(to bottom, #3b82f6, #1d4ed8)`
                          }}
                        >
                          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-5 h-3 bg-blue-500 rounded-t-sm" />
                        </div>
                      ))}
                    </div>
                    
                    {/* Coolant Flow Animation */}
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="h-2 bg-blue-600 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-400 to-cyan-300 animate-pulse"
                          style={{ width: `${coolantFlow}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Overlay Indicators */}
                  <div className="absolute top-4 left-4 bg-black/70 backdrop-blur rounded p-3 border border-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm font-mono">{power.toFixed(1)}%</span>
                    </div>
                    <div className="text-xs text-gray-400">Power Output</div>
                  </div>
                  
                  <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur rounded p-3 border border-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <Thermometer className={`h-4 w-4 ${getTemperatureColor()}`} />
                      <span className={`text-sm font-mono ${getTemperatureColor()}`}>{temperature.toFixed(1)}°C</span>
                    </div>
                    <div className="text-xs text-gray-400">Core Temp</div>
                  </div>
                  
                  <div className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-black/70 backdrop-blur rounded p-3 border border-gray-600">
                    <div className="flex items-center gap-2 mb-1">
                      <Waves className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-mono">{coolantFlow}%</span>
                    </div>
                    <div className="text-xs text-gray-400">Coolant</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Control Panel */}
            <Card className="bg-gray-800/50 border-gray-700 backdrop-blur">
              <CardHeader>
                <CardTitle>Control Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Control Rods */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Radio className="h-4 w-4" />
                      Control Rod Position
                    </label>
                    <Badge variant="outline" className="text-lg">{controlRod}%</Badge>
                  </div>
                  <Slider
                    value={[controlRod]}
                    onValueChange={handleControlRodChange}
                    max={100}
                    min={0}
                    step={1}
                    className="w-full"
                    disabled={isScrammed}
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Fully Inserted (Low Power)</span>
                    <span>Fully Withdrawn (High Power)</span>
                  </div>
                </div>

                {/* Coolant Flow */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Waves className="h-4 w-4" />
                      Coolant Flow Rate
                    </label>
                    <Badge variant="outline" className="text-lg">{coolantFlow}%</Badge>
                  </div>
                  <Slider
                    value={[coolantFlow]}
                    onValueChange={handleCoolantChange}
                    max={100}
                    min={0}
                    step={1}
                    className="w-full"
                    disabled={!isRunning || isScrammed}
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Low Flow</span>
                    <span>Max Flow</span>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="grid grid-cols-2 gap-4">
                  {isRunning ? (
                    <Button 
                      onClick={stopSimulation}
                      className="bg-orange-600 hover:bg-orange-700 h-12 text-lg"
                      disabled={isScrammed}
                    >
                      <Activity className="mr-2 h-5 w-5" />
                      Shutdown
                    </Button>
                  ) : (
                    <Button 
                      onClick={startSimulation}
                      className="bg-green-600 hover:bg-green-700 h-12 text-lg"
                      disabled={isScrammed}
                    >
                      <Zap className="mr-2 h-5 w-5" />
                      Start Reactor
                    </Button>
                  )}
                  <Button 
                    onClick={scram}
                    variant="destructive"
                    className="h-12 text-lg"
                  >
                    <AlertTriangle className="mr-2 h-5 w-5" />
                    SCRAM
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={reset}
                    className="col-span-2"
                  >
                    Reset System
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Status & Metrics */}
          <div className="space-y-6">
            {/* System Status */}
            <Card className="bg-gray-800/50 border-gray-700 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Reactor</div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                      <span className="font-bold">{isRunning ? 'ONLINE' : 'OFFLINE'}</span>
                    </div>
                  </div>
                  <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">SCRAM</div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${isScrammed ? 'bg-red-500' : 'bg-green-500'}`} />
                      <span className="font-bold">{isScrammed ? 'ACTIVE' : 'INACTIVE'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="text-xs text-gray-400 mb-2">Fuel Rod Status</div>
                  <div className={`text-lg font-bold ${
                    fuelRodStatus === "CRITICAL" ? "text-red-500" :
                    fuelRodStatus === "WARNING" ? "text-orange-500" :
                    fuelRodStatus === "ELEVATED" ? "text-yellow-500" :
                    "text-green-500"
                  }`}>
                    {fuelRodStatus}
                  </div>
                </div>
                
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                  <div className="text-xs text-gray-400 mb-2">Reactivity</div>
                  <div className="text-lg font-mono font-bold text-cyan-400">
                    {reactivity.toFixed(4)}
                  </div>
                  <Progress value={Math.abs(reactivity) * 100} className="mt-2 h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Thermal Metrics */}
            <Card className="bg-gray-800/50 border-gray-700 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="h-5 w-5" />
                  Thermal Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Core Temperature</span>
                    <span className={`font-mono ${getTemperatureColor()}`}>{temperature.toFixed(1)}°C</span>
                  </div>
                  <Progress 
                    value={(temperature / MAX_TEMPERATURE) * 100} 
                    className={`h-2 ${
                      temperature > CRITICAL_TEMPERATURE ? 'bg-red-600' :
                      temperature > WARNING_TEMPERATURE ? 'bg-orange-600' :
                      temperature > ELEVATED_TEMPERATURE ? 'bg-yellow-600' :
                      'bg-green-600'
                    }`}
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Coolant Pressure</span>
                    <span className={`font-mono ${getPressureColor()}`}>{coolantPressure.toFixed(1)} bar</span>
                  </div>
                  <Progress 
                    value={(coolantPressure / MAX_PRESSURE) * 100} 
                    className={`h-2 ${
                      coolantPressure > CRITICAL_PRESSURE ? 'bg-red-600' :
                      coolantPressure > WARNING_PRESSURE ? 'bg-orange-600' :
                      'bg-green-600'
                    }`}
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Steam Pressure</span>
                    <span className="font-mono text-blue-400">{steamPressure.toFixed(1)} bar</span>
                  </div>
                  <Progress value={(steamPressure / 150) * 100} className="h-2 bg-blue-600" />
                </div>
              </CardContent>
            </Card>

            {/* Neutronics */}
            <Card className="bg-gray-800/50 border-gray-700 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Neutronics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Neutron Flux</span>
                    <span className="font-mono text-cyan-400">{neutronFlux.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.abs(neutronFlux)} className="h-2 bg-cyan-600" />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Fuel Burnup</span>
                    <span className="font-mono text-purple-400">{(fuelBurnup * 100).toFixed(2)}%</span>
                  </div>
                  <Progress value={fuelBurnup * 100} className="h-2 bg-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* System Information */}
        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur mt-6">
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div>
                <div className="text-gray-400 text-xs mb-1">Reactor Type</div>
                <div>Pressurized Water Reactor</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Fuel Type</div>
                <div>UO₂ Enriched to 3.5%</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Coolant</div>
                <div>Light Water @ 155 bar</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Thermal Power</div>
                <div>~3000 MWth</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Control Rods</div>
                <div>53 Boron Carbide</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Moderator</div>
                <div>Light Water</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Containment</div>
                <div>Steel-lined concrete</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1">Safety Systems</div>
                <div>3 Independent Trains</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReactorSimulator;