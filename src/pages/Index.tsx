"use client";

import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Zap, Shield, Settings, ArrowRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.4"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            NUCLEAR REACTOR
          </h1>
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">
            CONTROL SYSTEM
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Advanced Reactor Management Interface v2.0
          </p>
        </div>

        {/* Main Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-slate-800/50 border-cyan-500/30 hover:border-cyan-400 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <Zap className="text-cyan-400 mx-auto mb-2" size={48} />
              <CardTitle className="text-cyan-400">Real-time Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Monitor power output, temperature, pressure, and fuel levels in real-time with advanced sensors.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/30 hover:border-purple-400 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <Shield className="text-purple-400 mx-auto mb-2" size={48} />
              <CardTitle className="text-purple-400">Safety Systems</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Advanced safety protocols with emergency shutdown capabilities and containment monitoring.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-green-500/30 hover:border-green-400 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <Settings className="text-green-400 mx-auto mb-2" size={48} />
              <CardTitle className="text-green-400">Full Control</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Complete control over reactor operations, coolant systems, and power grid synchronization.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Button */}
        <div className="mb-12">
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white px-8 py-4 text-lg font-bold border-2 border-cyan-400/50 hover:border-cyan-300 transition-all duration-300 hover:scale-105"
          >
            ENTER REACTOR CONTROL SYSTEM
            <ArrowRight className="ml-2" size={20} />
          </Button>
        </div>

        {/* System Status */}
        <Card className="bg-slate-800/50 border-cyan-500/30 mb-8">
          <CardHeader>
            <CardTitle className="text-cyan-400">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-green-400 font-bold text-lg">OPERATIONAL</div>
                <div className="text-sm text-gray-400">Reactor Core</div>
              </div>
              <div>
                <div className="text-green-400 font-bold text-lg">NOMINAL</div>
                <div className="text-sm text-gray-400">Coolant System</div>
              </div>
              <div>
                <div className="text-green-400 font-bold text-lg">SYNCHRONIZED</div>
                <div className="text-sm text-gray-400">Power Grid</div>
              </div>
              <div>
                <div className="text-green-400 font-bold text-lg">SECURE</div>
                <div className="text-sm text-gray-400">Containment</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Made with Dyad */}
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;