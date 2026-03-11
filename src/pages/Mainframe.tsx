"use client";

import { useEffect, useState } from "react";
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
  Power, 
  Shield, 
  Activity, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ArrowLeft, 
  ArrowRight, 
  ArrowDown, 
  ArrowUp 
} from "lucide-react";

const Mainframe = () => {
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [activePanel, setActivePanel] = useState("terminal");
  const [systemStatus, setSystemStatus] = useState({
    power: "ONLINE",
    security: "SECURE",
    network: "CONNECTED",
    status: "OPERATIONAL"
  });

  // Terminal commands and responses
  const commands = {
    "help": [
      "Available commands:",
      "  help - Show this help message",
      "  status - Show system status",
      "  scan - Run security scan",
      "  network - Show network status",
      "  power - Show power status",
      "  clear - Clear terminal",
      "  hack - Initiate hacking sequence",
      "  access - Access restricted systems",
      "  override - System override protocols"
    ],
    "status": [
      "SYSTEM STATUS:",
      `  Power: ${systemStatus.power}`,
      `  Security: ${systemStatus.security}`,
      `  Network: ${systemStatus.network}`,
      `  Overall: ${systemStatus.status}`
    ],
    "scan": [
      "SECURITY SCAN IN PROGRESS...",
      "  Firewall: SECURE",
      "  Intrusion Detection: ACTIVE",
      "  Access Logs: CLEAN",
      "  Vulnerabilities: NONE DETECTED"
    ],
    "network": [
      "NETWORK STATUS:",
      "  Connection: ESTABLISHED",
      "  Bandwidth: 1000 Mbps",
      "  Latency: 12 ms",
      "  Security: ENCRYPTED"
    ],
    "power": [
      "POWER STATUS:",
      "  Main Supply: ONLINE",
      "  Backup: STANDBY",
      "  Consumption: 450W",
      "  Efficiency: 98%"
    ],
    "hack": [
      "HACKING SEQUENCE INITIATED...",
      "  Bypassing firewall...",
      "  Cracking encryption...",
      "  Accessing main server...",
      "  SUCCESS: System compromised"
    ],
    "access": [
      "ACCESSING RESTRICTED SYSTEMS...",
      "  ADMIN PANEL: GRANTED",
      "  DATABASE: GRANTED",
      "  SECURITY LOGS: GRANTED",
      "  SYSTEM FILES: GRANTED"
    ],
    "override": [
      "OVERRIDE PROTOCOLS ACTIVATED",
      "  ALL SECURITY MEASURES DISABLED",
      "  FULL SYSTEM ACCESS GRANTED",
      "  WARNING: SYSTEM COMPROMISED"
    ],
    "clear": []
  };

  // Handle terminal input
  const handleTerminalInput = (input: string) => {
    setCurrentInput(input);
    setTerminalHistory(prev => [...prev, `> ${input}`]);

    const response = commands[input.toLowerCase()] || [
      "COMMAND NOT RECOGNIZED",
      `Type 'help' for available commands`
    ];

    setTimeout(() => {
      setTerminalHistory(prev => [...prev, ...response]);
    }, 500);
  };

  // System status effects
  useEffect(() => {
    const interval = setInterval(() => {
      // Randomize some status values for dynamic effect
      setSystemStatus(prev => ({
        ...prev,
        power: Math.random() > 0.1 ? "ONLINE" : "WARNING",
        security: Math.random() > 0.05 ? "SECURE" : "COMPROMISED",
        network: Math.random() > 0.02 ? "CONNECTED" : "DISCONNECTED"
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Navigation handlers
  const handleLeftArrow = () => {
    if (activePanel === "terminal") setActivePanel("security");
    else if (activePanel === "security") setActivePanel("network");
    else if (activePanel === "network") setActivePanel("terminal");
    else setActivePanel("terminal");
  };

  const handleRightArrow = () => {
    if (activePanel === "terminal") setActivePanel("network");
    else if (activePanel === "network") setActivePanel("security");
    else if (activePanel === "security") setActivePanel("terminal");
    else setActivePanel("terminal");
  };

  const handleDownArrow = () => {
    if (activePanel === "terminal") setActivePanel("hacks");
    else if (activePanel === "hacks") setActivePanel("mainframe");
    else if (activePanel === "mainframe") setActivePanel("terminal");
    else setActivePanel("terminal");
  };

  const handleUpArrow = () => {
    if (activePanel === "mainframe") setActivePanel("hacks");
    else if (activePanel === "hacks") setActivePanel("terminal");
    else if (activePanel === "terminal") setActivePanel("mainframe");
    else setActivePanel("terminal");
  };

  // Render system status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "ONLINE":
      case "SECURE":
      case "CONNECTED":
      case "OPERATIONAL":
        return <Badge variant="default" className="bg-green-600 text-white">✓ {status}</Badge>;
      case "WARNING":
      case "COMPROMISED":
        return <Badge variant="destructive" className="bg-yellow-600 text-white">⚠ {status}</Badge>;
      case "DISCONNECTED":
      case "SHUTDOWN":
        return <Badge variant="destructive" className="bg-red-600 text-white">✗ {status}</Badge>;
      default:
        return <Badge variant="muted" className="bg-gray-600 text-white">{status}</Badge>;
    }
  };

  // Render terminal panel
  const renderTerminalPanel = () => (
    <Card className="bg-slate-800/50 border-cyan-500/30">
      <CardHeader>
        <CardTitle className="text-cyan-400 flex items-center gap-2">
          <TerminalIcon className="text-cyan-400" size={20} />
          MAINFRAME TERMINAL
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-slate-900/50 rounded-lg border border-cyan-500/20 p-4 h-96 overflow-auto text-xs font-mono text-gray-300">
          {terminalHistory.map((line, index) => (
            <div key={index} className="mb-1">
              {line.startsWith(">") ? (
                <span className="text-cyan-400">{line}</span>
              ) : (
                line
              )}
            </div>
          ))}
          <div className="text-cyan-400">> {currentInput}</div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleTerminalInput(currentInput);
                setCurrentInput("");
              }
            }}
            className="flex-1 bg-slate-800/50 border border-cyan-500/30 rounded-md px-3 py-2 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 text-xs font-mono"
            placeholder="Enter command..."
          />
          <Button 
            onClick={() => handleTerminalInput(currentInput)}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 text-xs font-bold rounded-md"
          >
            EXECUTE
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Render security panel
  const renderSecurityPanel = () => (
    <Card className="bg-slate-800/50 border-red-500/30">
      <CardHeader>
        <CardTitle className="text-red-400 flex items-center gap-2">
          <Shield className="text-red-400" size={20} />
          SECURITY SYSTEMS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/50 rounded-lg border border-red-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-red-400">FIREWALL</span>
              {renderStatusBadge(systemStatus.security)}
            </div>
            <div className="text-xs text-gray-400">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-red-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-red-400">INTRUSION DETECTION</span>
              <Badge variant="default" className="bg-green-600 text-white">ACTIVE</Badge>
            </div>
            <div className="text-xs text-gray-400">
              Threats detected: 0
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-red-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-red-400">ACCESS LOGS</span>
              {renderStatusBadge("CLEAN")}
            </div>
            <div className="text-xs text-gray-400">
              Last audit: Just now
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-red-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-red-400">VULNERABILITIES</span>
              {renderStatusBadge("NONE DETECTED")}
            </div>
            <div className="text-xs text-gray-400">
              Scan interval: 5 minutes
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Render network panel
  const renderNetworkPanel = () => (
    <Card className="bg-slate-800/50 border-blue-500/30">
      <CardHeader>
        <CardTitle className="text-blue-400 flex items-center gap-2">
          <Activity className="text-blue-400" size={20} />
          NETWORK STATUS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/50 rounded-lg border border-blue-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-blue-400">CONNECTION</span>
              {renderStatusBadge(systemStatus.network)}
            </div>
            <div className="text-xs text-gray-400">
              IP Address: 192.168.1.100
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-blue-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-blue-400">BANDWIDTH</span>
              <Badge variant="default" className="bg-green-600 text-white">1000 Mbps</Badge>
            </div>
            <div className="text-xs text-gray-400">
              Usage: 450/1000 Mbps
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-blue-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-blue-400">LATENCY</span>
              <Badge variant="default" className="bg-green-600 text-white">12 ms</Badge>
            </div>
            <div className="text-xs text-gray-400">
              Jitter: 2 ms
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-blue-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-blue-400">SECURITY</span>
              {renderStatusBadge("ENCRYPTED")}
            </div>
            <div className="text-xs text-gray-400">
              Protocol: TLS 1.3
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Render hacks panel
  const renderHacksPanel = () => (
    <Card className="bg-slate-800/50 border-yellow-500/30">
      <CardHeader>
        <CardTitle className="text-yellow-400 flex items-center gap-2">
          <Zap className="text-yellow-400" size={20} />
          HACKING TOOLS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Button 
            onClick={() => handleTerminalInput("hack")}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 text-sm font-bold rounded-md"
          >
            <Zap className="mr-2" size={16} />
            INITIATE HACK
          </Button>
          <Button 
            onClick={() => handleTerminalInput("access")}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 text-sm font-bold rounded-md"
          >
            <TerminalIcon className="mr-2" size={16} />
            ACCESS SYSTEMS
          </Button>
          <Button 
            onClick={() => handleTerminalInput("override")}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 text-sm font-bold rounded-md"
          >
            <Shield className="mr-2" size={16} />
            OVERRIDE PROTOCOLS
          </Button>
          <Button 
            onClick={() => handleTerminalInput("scan")}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 text-sm font-bold rounded-md"
          >
            <Activity className="mr-2" size={16} />
            SECURITY SCAN
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Render mainframe panel
  const renderMainframePanel = () => (
    <Card className="bg-slate-800/50 border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-purple-400 flex items-center gap-2">
          <TerminalIcon className="text-purple-400" size={20} />
          MAINFRAME STATUS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/50 rounded-lg border border-purple-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-purple-400">SYSTEM STATUS</span>
              {renderStatusBadge(systemStatus.status)}
            </div>
            <div className="text-xs text-gray-400">
              Uptime: 42 days
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-purple-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-purple-400">CPU LOAD</span>
              <Badge variant="default" className="bg-green-600 text-white">23%</Badge>
            </div>
            <div className="text-xs text-gray-400">
              Cores: 8
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-purple-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-purple-400">MEMORY</span>
              <Badge variant="default" className="bg-green-600 text-white">8GB/16GB</Badge>
            </div>
            <div className="text-xs text-gray-400">
              Usage: 50%
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-purple-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-purple-400">STORAGE</span>
              <Badge variant="default" className="bg-green-600 text-white">512GB/1TB</Badge>
            </div>
            <div className="text-xs text-gray-400">
              Free: 488GB
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            HACKER MAINFRAME
          </h1>
          <p className="text-gray-400">Advanced Terminal Interface v2.0</p>
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

        {/* Footer */} 
        <div className="text-center mt-8 text-gray-400 text-sm">
          <p>MAINFRAME TERMINAL • CLASSIFIED ACCESS • SECURITY LEVEL: ULTRA</p>
          <p className="mt-1">© 2024 Advanced Terminal Systems</p>
        </div>
      </div>

      <style jsx>{`
        .terminal-output {
          font-family: 'Courier New', monospace;
          line-height: 1.4;
        }
        .terminal-input {
          background: transparent;
          border: none;
          color: #00ff00;
          outline: none;
          font-family: 'Courier New', monospace;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
};

export default Mainframe;