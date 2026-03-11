"use client";

import React, { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/utils/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Shield, 
  Settings, 
  ArrowRight, 
  Terminal as LucideTerminal,
  ChevronRight,
  X,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react";

const Terminal = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [command, setCommand] = useState("");
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Add welcome message when component mounts
  useEffect(() => {
    setTerminalOutput([
      "NUCLEAR REACTOR CONTROL SYSTEM - TERMINAL MAINFRAME",
      "==================================================",
      "ACCESS LEVEL: CLASS 1 OPERATOR",
      "SECURITY PROTOCOLS: ACTIVE",
      "SYSTEM STATUS: ONLINE",
      "",
      "Type 'help' for available commands.",
      "==================================================",
      ""
    ]);
  }, []);

  // Login handling
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      addTerminalOutput("ERROR: Please enter both username and password", "error");
      return;
    }
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: `${username}@reactor.com`,
        password: password
      });

      if (error) {
        addTerminalOutput(`LOGIN FAILED: ${error.message}`, "error");
        return;
      }

      if (data.user) {
        setIsLoggedIn(true);
        addTerminalOutput(`LOGIN SUCCESSFUL. WELCOME, ${username.toUpperCase()}.`, "success");
        addTerminalOutput("ACCESS GRANTED TO TERMINAL MAINFRAME", "success");
        addTerminalOutput("==================================================", "");
      }
    } catch (error) {
      console.error("Login error:", error);
      addTerminalOutput("ERROR: Database connection failed", "error");
    }
  };

  // Add terminal output with styling
  const addTerminalOutput = (text: string, type: "normal" | "success" | "error" | "info" = "normal") => {
    const timestamp = new Date().toLocaleTimeString();
    const styledText = `[${timestamp}] ${text}`;
    
    setTerminalOutput(prev => [...prev, styledText]);
  };

  // Command execution
  const handleCommand = async () => {
    if (!command.trim()) return;
    
    addTerminalOutput(`> ${command}`, "normal");
    
    try {
      const commandLower = command.toLowerCase().trim();
      
      // Help command
      if (commandLower === "help") {
        addTerminalOutput("AVAILABLE COMMANDS:", "info");
        addTerminalOutput("  status     - Show reactor system status", "");
        addTerminalOutput("  login      - Login to terminal", "");
        addTerminalOutput("  logout     - Logout from terminal", "");
        addTerminalOutput("  clear      - Clear terminal screen", "");
        addTerminalOutput("  help       - Show this help message", "");
        addTerminalOutput("  reactor    - Access reactor control system", "");
        addTerminalOutput("  shutdown   - Emergency shutdown procedure", "");
        return;
      }
      
      // Status command
      if (commandLower === "status") {
        addTerminalOutput("REACTOR SYSTEM STATUS:", "info");
        addTerminalOutput("  Core Temperature: 850°C (NOMINAL)", "");
        addTerminalOutput("  Pressure: 15.2 MPa (NOMINAL)", "");
        addTerminalOutput("  Power Output: 850 MW (NOMINAL)", "");
        addTerminalOutput("  Coolant Flow: 98% (NOMINAL)", "");
        addTerminalOutput("  Control Rods: 25% (NOMINAL)", "");
        addTerminalOutput("  Safety Systems: ACTIVE", "");
        return;
      }
      
      // Login command
      if (commandLower === "login") {
        if (isLoggedIn) {
          addTerminalOutput("ALREADY LOGGED IN", "error");
        } else {
          addTerminalOutput("LOGIN PROMPT:", "info");
          addTerminalOutput("  Please use the login form above", "");
        }
        return;
      }
      
      // Logout command
      if (commandLower === "logout") {
        if (isLoggedIn) {
          setIsLoggedIn(false);
          setUsername("");
          setPassword("");
          addTerminalOutput("LOGOUT SUCCESSFUL", "success");
          addTerminalOutput("SESSION TERMINATED", "success");
        } else {
          addTerminalOutput("NOT LOGGED IN", "error");
        }
        return;
      }
      
      // Clear command
      if (commandLower === "clear") {
        setTerminalOutput([]);
        return;
      }
      
      // Reactor command
      if (commandLower === "reactor") {
        addTerminalOutput("INITIATING REACTOR CONTROL SYSTEM ACCESS...", "info");
        addTerminalOutput("REDIRECTING TO REACTOR SIMULATOR...", "info");
        setTimeout(() => {
          window.location.href = '/reactor';
        }, 1500);
        return;
      }
      
      // Shutdown command
      if (commandLower === "shutdown") {
        addTerminalOutput("EMERGENCY SHUTDOWN PROCEDURE INITIATED", "error");
        addTerminalOutput("SCRAM SIGNAL SENT TO REACTOR CONTROL SYSTEM", "error");
        addTerminalOutput("COOLANT SYSTEMS ACTIVATED", "error");
        addTerminalOutput("REACTOR POWER DECREASING...", "error");
        addTerminalOutput("SHUTDOWN COMPLETE", "success");
        return;
      }
      
      // Unknown command
      addTerminalOutput(`COMMAND NOT FOUND: ${command}`, "error");
      addTerminalOutput("Type 'help' for available commands", "");
      
    } catch (error) {
      console.error("Command error:", error);
      addTerminalOutput("ERROR: Command execution failed", "error");
    }
    
    setCommand("");
  };

  // Handle key press for command execution
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand();
    }
  };

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
            TERMINAL MAINFRAME v2.0
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Secure terminal access for reactor control and monitoring
          </p>
        </div>

        {/* Login Form (shown when not logged in) */}
        {!isLoggedIn && (
          <Card className="bg-slate-800/50 border-cyan-500/30 mb-8 max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-cyan-400 flex items-center gap-2">
                <LucideTerminal className="text-cyan-400" size={24} />
                Terminal Login
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Username</label>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="bg-slate-700 border-cyan-500/30 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="bg-slate-700 border-cyan-500/30 text-white"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white"
                >
                  ACCESS TERMINAL
                </Button>
              </form>
              <div className="mt-4 text-xs text-gray-400 text-center">
                <p>Test credentials: admin / password</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Terminal Interface (shown when logged in) */}
        {isLoggedIn && (
          <div className="space-y-6">
            {/* Terminal Output */}
            <Card className="bg-slate-800/50 border-cyan-500/30">
              <CardHeader>
                <CardTitle className="text-cyan-400 flex items-center gap-2">
                  <LucideTerminal className="text-cyan-400" size={24} />
                  Terminal Session - {username.toUpperCase()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  ref={terminalRef}
                  className="bg-black p-4 rounded font-mono text-green-400 h-96 overflow-y-auto whitespace-pre-wrap"
                >
                  {terminalOutput.map((line, index) => (
                    <div key={index} className="mb-1">
                      {line}
                    </div>
                  ))}
                  <div className="flex items-center">
                    <span className="text-green-400 mr-2">$</span>
                    <Input
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Enter command..."
                      className="bg-transparent border-none text-green-400 placeholder-green-600 focus:outline-none flex-1"
                      autoFocus
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline"
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                onClick={() => {
                  setCommand("status");
                  setTimeout(handleCommand, 100);
                }}
              >
                <Info className="mr-2" size={16} />
                System Status
              </Button>
              <Button 
                variant="outline"
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                onClick={() => {
                  setCommand("reactor");
                  setTimeout(handleCommand, 100);
                }}
              >
                <Settings className="mr-2" size={16} />
                Reactor Control
              </Button>
              <Button 
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => {
                  setCommand("shutdown");
                  setTimeout(handleCommand, 100);
                }}
              >
                <AlertCircle className="mr-2" size={16} />
                Emergency Shutdown
              </Button>
            </div>
          </div>
        )}

        {/* Navigation Buttons (always visible) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
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
        <div className="space-y-6 mt-12">
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