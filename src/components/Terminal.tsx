"use client";

import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase, getUser, verifyPassword, getCommands, executeCommand } from "@/utils/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, Settings, ArrowRight, Terminal as LucideTerminal } from "lucide-react";

const Terminal = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [command, setCommand] = useState("");
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);

  // Login handling
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      useToast().toast({ title: "Error", description: "Please enter both username and password", variant: "destructive" });
      return;
    }
    
    try {
      const isValid = await verifyPassword(username, password);
      if (isValid) {
        setIsLoggedIn(true);
        setTerminalOutput(prev => [...prev, `> LOGIN SUCCESSFUL. WELCOME, ${username.toUpperCase()}.`]);
        useToast().toast({ title: "Success", description: "Login successful", variant: "default" });
      } else {
        setTerminalOutput(prev => [...prev, "> LOGIN FAILED. INVALID CREDENTIALS."]);
        useToast().toast({ title: "Error", description: "Invalid credentials", variant: "destructive" });
      }
    } catch (error) {
      console.error("Login error:", error);
      useToast().toast({ title: "Error", description: "Database connection failed", variant: "destructive" });
    }
  };

  // Command execution
  const handleCommand = async () => {
    if (!command.trim()) return;
    
    try {
      const result = await executeCommand(command);
      if (result) {
        setTerminalOutput(prev => [...prev, `> ${command}`]);
        setTerminalOutput(prev => [...prev, `Output: ${result.output}`]);
        // Handle extra actions here
        if (result.extra) {
          console.log("Extra action:", result.extra);
        }
      } else {
        setTerminalOutput(prev => [...prev, `Command not found: ${command}`]);
      }
    } catch (error) {
      console.error("Command error:", error);
      setTerminalOutput(prev => [...prev, "Error: Database connection failed"]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.4%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2V6h4V4H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-6xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
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

export default Terminal;