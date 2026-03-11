"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Terminal, Shield, Key, User, Power, X } from "lucide-react";

const Terminal = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [command, setCommand] = useState("");
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [showLogin, setShowLogin] = useState(true);
  const toast = useToast();

  // Mock user database
  const users = {
    "admin": "password123",
    "operator": "operator123",
    "guest": "guest123"
  };

  // Mock Q&A database
  const qaDatabase = {
    "status": "System operational. All reactors running at 85% capacity.",
    "temperature": "Core temperature: 420°C. Within safe limits.",
    "power": "Current power output: 2.3 GW. Grid synchronized.",
    "security": "Security level: HIGH. Access restricted to authorized personnel.",
    "help": "Available commands: status, temperature, power, security, help, logout",
    "default": "Command not recognized. Type 'help' for available commands."
  };

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.toast({ title: "Error", description: "Please enter both username and password", variant: "destructive" });
      return;
    }

    if (users[username] === password) {
      setIsLoggedIn(true);
      setShowLogin(false);
      setTerminalOutput(prev => [...prev, `> LOGIN SUCCESSFUL. WELCOME, ${username.toUpperCase()}.`]);
      toast.toast({ title: "Success", description: "Login successful", variant: "success" });
    } else {
      toast.toast({ title: "Error", description: "Invalid credentials", variant: "destructive" });
      setTerminalOutput(prev => [...prev, "> LOGIN FAILED. INVALID CREDENTIALS."]);
    }
  };

  // Handle command execution
  const handleCommand = () => {
    if (!command.trim()) return;

    setTerminalOutput(prev => [...prev, `> ${command}`]);
    const response = qaDatabase[command.toLowerCase()] || qaDatabase.default;
    setTerminalOutput(prev => [...prev, response]);

    // Special command handling
    if (command.toLowerCase() === "logout") {
      setIsLoggedIn(false);
      setShowLogin(true);
      setUsername("");
      setPassword("");
      setTerminalOutput([]);
    }

    setCommand("");
  };

  // Handle Enter key in command input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCommand();
    }
  };

  // Clear terminal
  const clearTerminal = () => {
    setTerminalOutput([]);
  };

  // Render login portal
  const renderLoginPortal = () => (
    <Card className="bg-slate-800/50 border-cyan-500/30">
      <CardHeader>
        <CardTitle className="text-cyan-400 flex items-center gap-2">
          <Terminal className="text-cyan-400" size={24} />
          MAINFRAME ACCESS PORTAL
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="text-center">
            <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-4">
              NUCLEAR REACTOR
            </div>
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">
              CONTROL SYSTEM
            </div>
            <p className="text-gray-400 mt-2">AUTHENTICATION REQUIRED</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-slate-800/50 border border-cyan-500/30 text-cyan-400 placeholder-cyan-400/50 focus:border-cyan-400 focus:ring-cyan-500"
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-800/50 border border-cyan-500/30 text-cyan-400 placeholder-cyan-400/50 focus:border-cyan-400 focus:ring-cyan-500"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white">
              <Key className="mr-2" size={16} />
              ACCESS MAINFRAME
            </Button>
          </form>

          <div className="text-center text-sm text-gray-500">
            <p>Available accounts: admin/password123, operator/operator123, guest/guest123</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Render terminal interface
  const renderTerminalInterface = () => (
    <Card className="bg-slate-800/50 border-green-500/30">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-green-400 flex items-center gap-2">
          <Terminal className="text-green-400" size={20} />
          MAINFRAME TERMINAL
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-xs px-2 py-1 bg-green-600 text-white">
            {isLoggedIn ? "LOGGED IN" : "LOGGED OUT"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTerminal}
            className="text-gray-400 hover:text-white"
          >
            <X size={16} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="h-96 overflow-y-auto bg-slate-900/30 p-4">
        <div className="text-xs font-mono text-green-400 leading-relaxed">
          {terminalOutput.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      </CardContent>
      <div className="p-4 border-t border-green-500/20">
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-mono text-sm">user@reactor:~$</span>
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyPress={handleKeyPress}
            className="bg-transparent border-none text-green-400 placeholder-green-400/50 font-mono text-sm flex-1"
            placeholder="Enter command"
          />
          <Button
            variant="ghost"
            onClick={handleCommand}
            className="text-green-400 hover:text-white"
          >
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.4%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            NUCLEAR REACTOR
          </h1>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">
            CONTROL SYSTEM
          </h2>
          <p className="text-gray-400">TERMINAL MAINFRAME INTERFACE</p>
        </div>

        {/* Terminal Component */}
        <div className="space-y-6">
          {showLogin ? (
            renderLoginPortal()
          ) : (
            renderTerminalInterface()
          )}
        </div>

        {/* Made with Dyad */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>TERMINAL MAINFRAME SYSTEM • CLASS 1 LICENSED • SAFETY PROTOCOLS ACTIVE</p>
          <p className="mt-1">© 2024 Advanced Reactor Management Systems</p>
        </div>
      </div>
    </div>
  );
};

export default Terminal;