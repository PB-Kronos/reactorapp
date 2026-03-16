"use client";

import React, { useState, useEffect } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Terminal as TerminalIcon, Shield, Network, Zap, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";

type AccountType = "user" | "admin";

const Mainframe = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(true); // Auto-login as guest
  const [accountType, setAccountType] = useState<AccountType>("user"); // Default to user (guest equivalent)
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideAttempts, setOverrideAttempts] = useState(0);
  const [currentInput, setCurrentInput] = useState("");
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    "NUCLEAR REACTOR CONTROL SYSTEM v2.0",
    "Copyright (c) 2024 Advanced Terminal Systems",
    "Type 'help' for available commands",
    ""
  ]);
  const [activePanel, setActivePanel] = useState("terminal");
  const [loginStep, setLoginStep] = useState<"account" | "password" | null>(null);

  // Account passwords (no guest account)
  const PASSWORDS: Record<AccountType, string> = {
    admin: "0289",
    user: "1234"
  };

  // Clear login state on unmount
  useEffect(() => {
    return () => {
      localStorage.removeItem("mainframe_temperature");
      localStorage.removeItem("mainframe_pressure");
      localStorage.removeItem("mainframe_fuelLevel");
    };
  }, []);

  const handleTerminalInput = (input: string) => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    const commands = {
      help: [
        "AVAILABLE COMMANDS:",
        " status - Show system status",
        " network - Show network info",
        " users - List users",
        " login - Login to account (admin/user)",
        " logout - Logout to guest account",
        " admin - Switch to admin account (requires login)",
        " user - Switch to user account (requires login)",
        " override - Initiate override protocol (admin only)",
        " reactor - Enter reactor control system (user+ only)",
        " reboot - Clear cached reactor data (user+ only)",
        " shutdown - Shutdown reactor (user+ only)",
        " scram - Emergency shutdown (user+ only, requires conditions)"
      ],
      status: [
        "SYSTEM STATUS:",
        " ONLINE",
        " UPTIME: 42 DAYS",
        " CPU: 23%",
        " MEMORY: 8GB/16GB"
      ],
      network: [
        "NETWORK INFO:",
        " INTERFACE: eth0",
        " IP: 192.168.1.100",
        " RX: 1.2GB",
        " TX: 856MB"
      ],
      users: [
        "USERS:",
        " root",
        " admin",
        " user1",
        " user2"
      ],
      login: [
        "LOGIN PROMPT:",
        " Available accounts: admin, user",
        " Enter account name:"
      ],
      logout: [
        "LOGGING OUT...",
        " Session terminated.",
        " Switched to GUEST account (read-only mode)"
      ],
      user: [
        "SWITCHING TO USER ACCOUNT",
        " Access granted to reactor entry, reboot, shutdown, and scram"
      ],
      admin: [
        "SWITCHING TO ADMIN ACCOUNT",
        " Full system access granted"
      ],
      override: [
        "OVERRIDE PROTOCOLS ACTIVATED",
        " ALL SECURITY MEASURES DISABLED",
        " FULL SYSTEM ACCESS GRANTED",
        " WARNING: SYSTEM COMPROMISED"
      ],
      reactor: [
        "INITIATING REACTOR CONTROL INTERFACE...",
        " Redirecting to /reactor"
      ],
      reboot: [
        "REBOOT PROTOCOL INITIATED...",
        " Clearing cached reactor data...",
        " Cache cleared successfully.",
        " System ready."
      ],
      shutdown: [
        "SHUTDOWN PROTOCOL INITIATED...",
        " Stopping reactor systems...",
        " Reactor shutdown complete.",
        " System entering standby mode."
      ],
      scram: [
        "SCRAM PROTOCOL INITIATED...",
        " EMERGENCY SHUTDOWN TRIGGERED",
        " All control rods inserted at maximum speed",
        " Reactor scrammed successfully"
      ]
    };

    const command = trimmedInput.toLowerCase();

    // Handle login flow FIRST (before any permission checks)
    if (loginStep === "account") {
      const account = trimmedInput.toLowerCase() as AccountType;
      if (account === "admin" || account === "user") {
        setAccountType(account);
        setTerminalHistory(prev => [...prev, `> ${trimmedInput}`, ` Account: ${account.toUpperCase()}`, " Enter password:"]);
        setLoginStep("password");
      } else {
        setTerminalHistory(prev => [...prev, `> ${trimmedInput}`, "ERROR: Invalid account. Available accounts: admin, user", " Enter account name:"]);
      }
      return;
    }

    if (loginStep === "password") {
      const expectedPassword = PASSWORDS[accountType];
      if (trimmedInput === expectedPassword) {
        setIsLoggedIn(true);
        setLoginStep(null);
        setTerminalHistory(prev => [...prev, `> ${trimmedInput}`, "LOGIN SUCCESSFUL", `Welcome, ${accountType.toUpperCase()}!`]);
        showSuccess(`Logged in as ${accountType}`);
      } else {
        setTerminalHistory(prev => [...prev, `> ${trimmedInput}`, "LOGIN FAILED", "Incorrect password", " Enter password:"]);
        showError("Login Failed");
      }
      return;
    }

    // Handle logout
    if (command === "logout") {
      setIsLoggedIn(false);
      setAccountType("user"); // Reset to user (guest equivalent)
      setLoginStep(null);
      setTerminalHistory(prev => [...prev, `> ${trimmedInput}`, ...commands.logout]);
      showSuccess("Logged out to guest mode");
      return;
    }

    // Check if user is logged in for other commands (except help and login)
    if (!isLoggedIn && command !== "help" && command !== "login") {
      setTerminalHistory(prev => [...prev, `> ${trimmedInput}`, "ACCESS DENIED", "Please login first using 'login' command"]);
      return;
    }

    // Permission-based command access
    const canAccessAdmin = accountType === "admin";
    const canAccessUser = accountType === "user" || accountType === "admin";

    // Admin-only commands
    if (command === "override" && !canAccessAdmin) {
      setTerminalHistory(prev => [...prev, `> ${trimmedInput}`, "ACCESS DENIED", "This command requires admin privileges"]);
      showError("Insufficient permissions");
      return;
    }

    // User+ commands
    if ((command === "reactor" || command === "reboot" || command === "shutdown" || command === "scram") && !canAccessUser) {
      setTerminalHistory(prev => [...prev, `> ${trimmedInput}`, "ACCESS DENIED", "This command requires user or admin privileges"]);
      showError("Insufficient permissions");
      return;
    }

    // Handle scram requirements (only if temperature > 3000 or already pressed)
    if (command === "scram") {
      const storedTemp = parseFloat(localStorage.getItem("mainframe_temperature") || "0");
      if (storedTemp <= 3000 && !localStorage.getItem("scram_pressed")) {
        setTerminalHistory(prev => [...prev, `> ${trimmedInput}`, "SCRAM REQUIREMENTS NOT MET", " Temperature must exceed 3000°C or scram must be activated", " Condition not satisfied."]);
        showError("Scram requirements not met");
        return;
      }
    }

    // Execute command
    if (commands[command]) {
      setTerminalHistory(prev => [...prev, `> ${trimmedInput}`, ...commands[command]]);

      // Special command actions
      if (command === "reboot") {
        localStorage.removeItem("mainframe_temperature");
        localStorage.removeItem("mainframe_pressure");
        localStorage.removeItem("mainframe_fuelLevel");
        localStorage.removeItem("scram_pressed");
      }

      if (command === "reactor") {
        setTimeout(() => {
          window.location.href = "/reactor";
        }, 1000);
      }
    } else {
      setTerminalHistory(prev => [...prev, `> ${trimmedInput}`, `ERROR: Unknown command '${trimmedInput}'. Type 'help' for available commands.`]);
    }
  };

  const renderTerminalPanel = () => (
    <div className="space-y-4">
      <div className="h-[300px] overflow-y-auto bg-slate-900/50 rounded-lg border border-purple-500/20 p-4">
        <pre className="text-sm font-mono text-green-400 whitespace-pre-wrap break-words">{terminalHistory.join("\n")}</pre>
        <div className="pt-2 flex items-center">
          <span className="text-green-400 mr-2">{isLoggedIn ? `[${accountType.toUpperCase()}]` : "[GUEST]"}</span>
          <span className="text-cyan-400">$</span>
          <input
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleTerminalInput(currentInput);
                setCurrentInput("");
              }
            }}
            className="bg-transparent border-none text-green-400 focus:outline-none flex-1 ml-2"
            placeholder={loginStep ? "Enter value..." : "Enter command..."}
            autoFocus
          />
        </div>
      </div>
    </div>
  );

  const renderSecurityPanel = () => (
    <Card className="bg-slate-800/50 border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-purple-400 flex items-center gap-2">
          <Shield className="text-purple-400" size={20} />
          SECURITY STATUS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-purple-400">FIREWALL</span>
          <Badge variant="default" className="bg-green-600 text-white">ACTIVE</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-purple-400">INTRUSION DETECTION</span>
          <Badge variant="default" className="bg-green-600 text-white">MONITORING</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-purple-400">ENCRYPTION</span>
          <Badge variant="default" className="bg-green-600 text-white">AES-256</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-purple-400">ACCESS LOGS</span>
          <Badge variant="default" className="bg-green-600 text-white">SECURE</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-purple-400">CURRENT ACCOUNT</span>
          <Badge variant={isLoggedIn ? "default" : "destructive"} className={isLoggedIn ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
            {isLoggedIn ? accountType.toUpperCase() : "GUEST"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  const renderNetworkPanel = () => (
    <Card className="bg-slate-800/50 border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-purple-400 flex items-center gap-2">
          <Network className="text-purple-400" size={20} />
          NETWORK STATUS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-purple-400">PACKETS IN</span>
          <span className="text-sm text-gray-400">1.2GB</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-purple-400">PACKETS OUT</span>
          <span className="text-sm text-gray-400">856MB</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-purple-400">BANDWIDTH</span>
          <span className="text-sm text-gray-400">100Mbps</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-purple-400">LATENCY</span>
          <span className="text-sm text-gray-400">12ms</span>
        </div>
      </CardContent>
    </Card>
  );

  const renderMainframePanel = () => (
    <Card className="bg-slate-800/50 border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-purple-400 flex items-center gap-2">
          <TerminalIcon className="text-purple-400" size={20} />
          MAINFRAME STATUS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/50 rounded-lg border border-purple-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-purple-400">SYSTEM STATUS</span>
              <Badge variant="default" className="bg-green-600 text-white">ONLINE</Badge>
            </div>
            <div className="text-xs text-gray-400">Uptime: 42 days</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-purple-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-purple-400">CPU LOAD</span>
              <Badge variant="default" className="bg-green-600 text-white">23%</Badge>
            </div>
            <div className="text-xs text-gray-400">Cores: 8</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-purple-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-purple-400">MEMORY</span>
              <Badge variant="default" className="bg-green-600 text-white">8GB/16GB</Badge>
            </div>
            <div className="text-xs text-gray-400">Usage: 50%</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg border border-purple-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-purple-400">STORAGE</span>
              <Badge variant="default" className="bg-green-600 text-white">512GB/1TB</Badge>
            </div>
            <div className="text-xs text-gray-400">Free: 488GB</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const handleLeftArrow = () => {
    setActivePanel(prev => {
      if (prev === "terminal") return "security";
      if (prev === "security") return "network";
      if (prev === "network") return "mainframe";
      if (prev === "mainframe") return "terminal";
      return "terminal";
    });
  };

  const handleRightArrow = () => {
    setActivePanel(prev => {
      if (prev === "terminal") return "security";
      if (prev === "security") return "network";
      if (prev === "network") return "mainframe";
      if (prev === "mainframe") return "terminal";
      return "terminal";
    });
  };

  const handleUpArrow = () => {
    setActivePanel(prev => {
      if (prev === "terminal") return "security";
      if (prev === "security") return "network";
      if (prev === "network") return "mainframe";
      if (prev === "mainframe") return "terminal";
      return "terminal";
    });
  };

  const handleDownArrow = () => {
    setActivePanel(prev => {
      if (prev === "terminal") return "mainframe";
      if (prev === "mainframe") return "network";
      if (prev === "network") return "security";
      if (prev === "security") return "terminal";
      return "terminal";
    });
  };
};
export default Mainframe;