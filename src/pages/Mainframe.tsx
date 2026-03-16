"use client";
  import React, { useState, useEffect } from "react";
  import { ArrowLeft, ArrowRight, ArrowDown, ArrowUp } from "lucide-react";
  // Components
  import { Button } from "@/components/ui/button";
  import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
  import { Badge } from "@/components/ui/badge";
  import { 
    Terminal, 
    TerminalLine, 
    TerminalInput, 
    TerminalOutput 
  } from "@/components/ui/terminal";
  import { 
    Terminal as TerminalIcon, 
    Power,     Shield, 
    Activity,     Zap, 
    AlertTriangle, 
    CheckCircle, 
    XCircle, 
    ArrowLeft, 
    ArrowRight, 
    ArrowDown, 
    ArrowUp 
  } from "lucide-react";
  
  const Mainframe = () => {
    // Terminal state
    const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
    const [currentInput, setCurrentInput] = useState("");
    // Override password flow state
    const [overrideMode, setOverrideMode] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [overrideResult, setOverrideResult] = useState<"granted" | "denied" | null>(null);
    const [flashing, setFlashing] = useState(false);
    
    // Navigation and system status
    const [activePanel, setActivePanel] = useState("terminal");
    const [systemStatus, setSystemStatus] = useState({
      power: "ONLINE",
      security: "SECURE",
      network: "CONNECTED",
      status: "OPERATIONAL"
    });
    
    // ... existing state and component code ...
    
    // Handle terminal input
    const handleTerminalInput = (input: string) => {
      // Add command to history immediately
      setTerminalHistory(prev => [...prev, `> ${input}`]);
      setCurrentInput("");
      
      // Handle override command initiation
      if (input.toLowerCase() === "override" && !overrideMode) {
        setOverrideMode(true);
        setPasswordInput("");
        // Show password prompt
        setTerminalHistory(prev => [...prev, "> Password:"]);
        return;
      }
      
      // Handle password entry when override is active
      if (overrideMode) {
        // Check password when Enter is submitted
        if (input === "0289") {
          setOverrideResult("granted");
          // Start flashing effect
          setFlashing(true);
        } else {
          setOverrideResult("denied");
        }
        // Reset override mode
        setOverrideMode(false);
        
        // Add response to history after delay
        setTimeout(() => {
          const response = overrideResult === "granted" ? "Access Granted" : "Access Denied";
          setTerminalHistory(prev => [...prev, response]);
        }, 500);
        
        return;
      }
            // Default command handling (unchanged)
      const response = commands[input.toLowerCase()] || [
        "COMMAND NOT RECOGNIZED",
        `Type 'help' for available commands`
      ];
      
      setTimeout(() => {
        setTerminalHistory(prev => [...prev, ...response]);
      }, 500);
    };
    
    // Flashing effect for granted access
    useEffect(() => {
      if (overrideResult === "granted") {
        let count = 0;
        const interval = setInterval(() => {
          setFlashing(prev => !prev);
          count++;
          if (count >= 5) {
            clearInterval(interval);
            setFlashing(false);
          }
        }, 300);
        return () => clearInterval(interval);
      }
    }, [overrideResult]);
        // ... existing ReactorSimulator and other component code ...
    
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
            <button onClick={handleLeftArrow} className="p-3 bg-slate-800/50 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-all duration-300 hover:scale-110">
              <ArrowLeft className="text-cyan-400" size={24} />
            </button>
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-1">ACTIVE PANEL</div>
              <div className="text-lg font-bold text-cyan-400 uppercase">
                {activePanel === "terminal" && "TERMINAL"}
                {activePanel === "security" && "SECURITY"}
                {activePanel === "network" && "NETWORK"}
                {activePanel === "hacks" && "HACKING TOOLS"}
                {activePanel === "mainframe" && "MAINFRAME"}
              </div>
            </div>
            <button onClick={handleRightArrow} className="p-3 bg-slate-800/50 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-all duration-300 hover:scale-110">
              <ArrowRight className="text-purple-400" size={24} />
            </button>
          </div>
          
          {/* Main Panel Area */}
          <div className="bg-slate-800/30 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-6 mb-6">
            {activePanel === "terminal" && renderTerminalPanel()}
            {activePanel === "security" && renderSecurityPanel()}
            {activePanel === "network" && renderNetworkPanel()}
            {activePanel === "hacks" && renderHacksPanel()}
            {activePanel === "mainframe" && renderMainframePanel()}
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
          
          {/* Access Granted Display */}
          {overrideResult === "granted" && (
            <div className={`p-8 rounded-lg text-center text-2xl font-bold text-green-800 ${flashing ? 'bg-red-200' : 'bg-green-100'}`}>
              Access Granted
            </div>
          )}
          
          {/* Footer */}
          <div className="text-center mt-8 text-gray-400 text-sm">
            <p>© 2024 Advanced Reactor Management Systems</p>
          </div>
        </div>
        
        <style>{`
          @keyframes flashRed {
            0%, 100% { background-color: transparent; }
            50% { background-color: red; }
          }
        `}</style>
      </div>
    );
  };
  
  export default Mainframe;