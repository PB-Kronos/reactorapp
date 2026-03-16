// ... existing imports ...
  import { toast } from "@/components/ui/toast";

  const Mainframe = () => {
    // ... existing state ...
    const [overridePassword, setOverridePassword] = useState("");
    const [isOverriding, setIsOverriding] = useState(false);
    const [overrideAttempts, setOverrideAttempts] = useState(0);

    // ... existing code ...

    const commands = {
      // ... existing commands ...
      "override": [
        "OVERRIDE PROTOCOLS ACTIVATED",
        "  ALL SECURITY MEASURES DISABLED",
        "  FULL SYSTEM ACCESS GRANTED",
        "  WARNING: SYSTEM COMPROMISED"
      ],
    };

    // Handle terminal input
    const handleTerminalInput = (input: string) => {
      setCurrentInput(input);
      setTerminalHistory(prev => [...prev, `> ${input}`]);

      const response = commands[input.toLowerCase()] || [
        "COMMAND NOT RECOGNIZED",
        `Type 'help' for available commands`
      ];

      if (input.toLowerCase() === "override") {
        // Override command needs password
        setOverridePassword("");
        setIsOverriding(true);
        setTerminalHistory(prev => [...prev, "> override", "OVERRIDE PROTOCOLS ACTIVATED", "  ENTER PASSWORD:"]);
        return;
      }

      if (isOverriding) {
        if (input === "0289") {
          // Correct password
          setTerminalHistory(prev => [...prev, "> " + input, "ACCESS GRANTED", "  OVERRIDE PROTOCOLS ACTIVATED"]);
          Toast.success("Access Granted");
          setOverrideAttempts(0);
          setIsOverriding(false);
          // Flash background red 5 times
          let flashCount = 0;
          const flashInterval = setInterval(() => {
            if (flashCount < 10) {
              document.body.style.backgroundColor = flashCount % 2 === 0 ? "rgba(255, 0, 0, 0.5)" : "transparent";
              flashCount++;
            } else {
              clearInterval(flashInterval);
              document.body.style.backgroundColor = "";
            }
          }, 200);
        } else {
          // Incorrect password
          setOverrideAttempts(prev => prev + 1);
          if (overrideAttempts >= 2) {
            setTerminalHistory(prev => [...prev, "> " + input, "ACCESS DENIED", "  MAX ATTEMPTS REACHED", "  OVERRIDE CANCELLED"]);
            Toast.error("Access Denied");
            setIsOverriding(false);
          } else {
            setTerminalHistory(prev => [...prev, "> " + input, "ACCESS DENIED", "  INCORRECT PASSWORD", "  ENTER PASSWORD:"]);
          }
        }
        return;
      }

      setTimeout(() => {
        setTerminalHistory(prev => [...prev, ...response]);
      }, 500);
    };

    // ... existing code ...

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
              <div className="text-lg font-bold text-cyan-400 mb-1">ACTIVE PANEL</div>
              <div className="text-sm text-gray-400">
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
          <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-6 mb-6">
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
            <p>© 2024 Advanced Terminal Systems</p>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.05); }
          }
        `}</style>
      </div>
    );
  };

  export default Mainframe;