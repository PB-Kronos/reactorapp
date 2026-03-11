"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Terminal as LucideTerminal,
  ChevronRight,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  Zap,
  Shield,
  Settings,
  Power,
  Droplets,
  Fuel,
  Thermometer,
  Gauge,
  Grid3X3
} from "lucide-react";

const Terminal = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [command, setCommand] = useState("");
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Add terminal output with timestamp
  const addTerminalOutput = (text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const styledText = `[${timestamp}] ${text}`;
    setTerminalOutput(prev => [...prev, styledText]);
  };

  // Handle command execution
  const handleCommand = () => {
    if (!command.trim()) return;

    const cmd = command.trim();
    addTerminalOutput(`> ${cmd}`);

    try {
      const parts = cmd.split(' ');
      const mainCommand = parts[0].toLowerCase();
      const args = parts.slice(1);

      // Help command
      if (mainCommand === "help") {
        addTerminalOutput("AVAILABLE COMMANDS:");
        addTerminalOutput("  status     - Show reactor system status");
        addTerminalOutput("  login user - Login to terminal");
        addTerminalOutput("  logout     - Logout from terminal");
        addTerminalOutput("  clear      - Clear terminal screen");
        addTerminalOutput("  help       - Show this help message");
        addTerminalOutput("  reactor    - Access reactor control system");
        addTerminalOutput("  shutdown   - Emergency shutdown procedure");
        return;
      }

      // Login command - simple system
      if (mainCommand === "login" && args[0] === "user") {
        if (isLoggedIn) {
          addTerminalOutput("ALREADY LOGGED IN");
          return;
        }

        setIsLoggedIn(true);
        addTerminalOutput("LOGIN SUCCESSFUL");
        addTerminalOutput("ACCESS GRANTED TO TERMINAL MAINFRAME");
        return;
      }

      // Check if user is logged in for protected commands
      const protectedCommands = ["status", "reactor", "shutdown"];
      if (protectedCommands.includes(mainCommand) && !isLoggedIn) {
        addTerminalOutput("ACCESS DENIED: Please login first using 'login user'");
        return;
      }

      // Status command
      if (mainCommand === "status") {
        addTerminalOutput("REACTOR SYSTEM STATUS:");
        addTerminalOutput("  Core Temperature: 850°C (NOMINAL)");
        addTerminalOutput("  Pressure: 15.2 MPa (NOMINAL)");
        addTerminalOutput("  Power Output: 850 MW (NOMINAL)");
        addTerminalOutput("  Coolant Flow: 98% (NOMINAL)");
        addTerminalOutput("  Control Rods: 25% (NOMINAL)");
        addTerminalOutput("  Safety Systems: ACTIVE");
        return;
      }

      // Logout command
      if (mainCommand === "logout") {
        if (isLoggedIn) {
          setIsLoggedIn(false);
          addTerminalOutput("LOGOUT SUCCESSFUL");
          addTerminalOutput("SESSION TERMINATED");
        } else {
          addTerminalOutput("NOT LOGGED IN");
        }
        return;
      }

      // Clear command
      if (mainCommand === "clear") {
        setTerminalOutput([]);
        return;
      }

      // Reactor command
      if (mainCommand === "reactor") {
        addTerminalOutput("INITIATING REACTOR CONTROL SYSTEM ACCESS...");
        addTerminalOutput("REDIRECTING TO REACTOR SIMULATOR...");
        setTimeout(() => {
          window.location.href = '/reactor';
        }, 1500);
        return;
      }

      // Shutdown command
      if (mainCommand === "shutdown") {
        addTerminalOutput("EMERGENCY SHUTDOWN PROCEDURE INITIATED");
        addTerminalOutput("SCRAM SIGNAL SENT TO REACTOR CONTROL SYSTEM");
        addTerminalOutput("COOLANT SYSTEMS ACTIVATED");
        addTerminalOutput("REACTOR POWER DECREASING...");
        addTerminalOutput("SHUTDOWN COMPLETE");
        return;
      }

      // Unknown command
      addTerminalOutput(`COMMAND NOT FOUND: ${cmd}`);
      addTerminalOutput("Type 'help' for available commands");

    } catch (error) {
      console.error("Command error:", error);
      addTerminalOutput("ERROR: Command execution failed");
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

        {/* Login Status */}
        {isLoggedIn && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-400" size={20} />
                <span className="text-green-400 font-medium">
                  Logged in as: OPERATOR
                </span>
              </div>
              <Button 
                variant="outline"
                size="sm"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => {
                  setCommand("logout");
                  setTimeout(handleCommand, 100);
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        )}

        {/* Terminal Interface */}
        <Card className="bg-slate-800/50 border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <LucideTerminal className="text-cyan-400" size={24} />
              Terminal Session
              {!isLoggedIn && <span className="text-sm text-gray-400">- NOT LOGGED IN</span>}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
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

        {/* Help Section */}
        <Card className="bg-slate-800/50 border-cyan-500/30 mt-6">
          <CardHeader>
            <CardTitle className="text-cyan-400">Quick Help</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-cyan-300 mb-2">Login:</p>
                <code className="bg-slate-900 px-2 py-1 rounded text-green-400">
                  login user
                </code>
                <p className="text-gray-400 mt-1 text-xs">
                  No password required
                </p>
              </div>
              <div>
                <p className="font-semibold text-cyan-300 mb-2">Other Commands:</p>
                <ul className="space-y-1 text-gray-300">
                  <li><code className="bg-slate-900 px-1 rounded text-xs">status</code> - System status</li>
                  <li><code className="bg-slate-900 px-1 rounded text-xs">reactor</code> - Open reactor control</li>
                  <li><code className="bg-slate-900 px-1 rounded text-xs">shutdown</code> - Emergency shutdown</li>
                  <li><code className="bg-slate-900 px-1 rounded text-xs">logout</code> - Logout</li>
                  <li><code className="bg-slate-900 px-1 rounded text-xs">clear</code> - Clear terminal</li>
                  <li><code className="bg-slate-900 px-1 rounded text-xs">help</code> - Show help</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
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