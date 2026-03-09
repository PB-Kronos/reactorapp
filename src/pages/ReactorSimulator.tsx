"use client";

import React, { useState, useEffect } from "react";
import { Button, Card, CardHeader, CardTitle, CardContent, Slider, Badge, Progress } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, AlertTriangle, Zap, Thermometer, Shield } from "lucide-react";

const ReactorSimulator = () => {
  const [power, setPower] = useState<number>(0);
  const [controlRod, setControlRod] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<number>(20);
  const [coolantFlow, setCoolantFlow] = useState<number>(50);
  const [fuelRodStatus, setFuelRodStatus] = useState<string>("Normal");
  const [alertLevel, setAlertLevel] = useState<"low" | "medium" | "high" | "critical">("low");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning) {
      interval = setInterval(() => {
        // Simulate temperature increase based on power
        const tempIncrease = power * 0.1;
        setTemperature(prev => Math.min(prev + tempIncrease, 1000));
        
        // Simulate coolant effectiveness
        const coolingEffect = coolantFlow * 0.05;
        setTemperature(prev => Math.max(prev - coolingEffect, 20));
        
        // Update fuel rod status based on temperature
        if (temperature > 800) {
          setFuelRodStatus("Critical");
          setAlertLevel("critical");
        } else if (temperature > 600) {
          setFuelRodStatus("Warning");
          setAlertLevel("high");
        } else if (temperature > 400) {
          setFuelRodStatus("Elevated");
          setAlertLevel("medium");
        } else {
          setFuelRodStatus("Normal");
          setAlertLevel("low");
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isRunning, power, coolantFlow, temperature]);

  const startSimulation = () => {
    setIsRunning(true);
  };

  const stopSimulation = () => {
    setIsRunning(false);
  };

  const handleControlRodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setControlRod(value);
    setPower(Math.max(0, 100 - value * 2));
  };

  const handleCoolantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setCoolantFlow(value);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Nuclear Reactor Simulator</h1>
          <p className="text-gray-400">Advanced Reactor Control System</p>
        </div>

        {/* Alert Panel */}
        <Alert className={`mb-6 ${getAlertColor()}`}>
          <div className="flex items-center gap-2">
            {getAlertIcon()}
            <AlertDescription>
              Reactor Status: {fuelRodStatus} | Temperature: {temperature.toFixed(1)}°C
            </AlertDescription>
          </div>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Reactor Core Visualization */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Reactor Core
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full h-64 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                {/* Reactor Core */}
                <div className="absolute inset-4 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-600">
                  {/* Fuel Rods */}
                  <div className="grid grid-cols-4 gap-2 p-4">
                    {[...Array(12)].map((_, i) => (
                      <div 
                        key={i}
                        className={`w-8 h-16 rounded-full ${temperature > 600 ? 'bg-red-500' : temperature > 400 ? 'bg-orange-500' : 'bg-green-500'} opacity-70`}
                      />
                    ))}
                  </div>
                  
                  {/* Control Rods */}
                  <div className="absolute top-4 right-4 w-4 h-48 bg-blue-600 rounded opacity-80" 
                       style={{ height: `${controlRod}%` }}>
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-6 h-4 bg-blue-400 rounded-t" />
                  </div>
                  
                  {/* Coolant Flow */}
                  <div className="absolute bottom-4 left-4 right-4 h-2 bg-blue-500 rounded opacity-60" />
                </div>
                
                {/* Power Output Indicator */}
                <div className="absolute top-4 left-4 bg-black bg-opacity-50 rounded p-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm">{power.toFixed(1)} MW</span>
                  </div>
                </div>
                
                {/* Temperature Indicator */}
                <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 rounded p-2">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-red-400" />
                    <span className="text-sm">{temperature.toFixed(1)}°C</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Control Panel */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle>Control Panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Control Rod Position */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Control Rod Position</label>
                  <Badge variant="outline">{controlRod}%</Badge>
                </div>
                <Slider
                  value={controlRod}
                  onValueChange={handleControlRodChange}
                  max={100}
                  min={0}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Withdrawn</span>
                  <span>Inserted</span>
                </div>
              </div>

              {/* Coolant Flow */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Coolant Flow Rate</label>
                  <Badge variant="outline">{coolantFlow}%</Badge>
                </div>
                <Slider
                  value={coolantFlow}
                  onValueChange={handleCoolantChange}
                  max={100}
                  min={0}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>

              {/* Power Output */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Power Output</label>
                  <Badge variant="outline">{power.toFixed(1)} MW</Badge>
                </div>
                <Progress value={power} className="h-2" />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0 MW</span>
                  <span>100 MW</span>
                </div>
              </div>

              {/* System Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 p-3 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Reactor Status</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm">{isRunning ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
                <div className="bg-gray-900 p-3 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Fuel Rod Status</div>
                  <div className="text-sm">{fuelRodStatus}</div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex gap-3">
                {isRunning ? (
                  <Button 
                    onClick={stopSimulation}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    Emergency Stop
                  </Button>
                ) : (
                  <Button 
                    onClick={startSimulation}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Start Reactor
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setPower(0);
                    setControlRod(0);
                    setTemperature(20);
                    setCoolantFlow(50);
                    setIsRunning(false);
                  }}
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Information */}
        <Card className="bg-gray-800 border-gray-700 mt-6">
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Reactor Type</div>
                <div>Pressurized Water Reactor (PWR)</div>
              </div>
              <div>
                <div className="text-gray-400">Fuel Type</div>
                <div>Uranium-235 Enriched</div>
              </div>
              <div>
                <div className="text-gray-400">Coolant</div>
                <div>Light Water</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReactorSimulator;