import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  GREETING_HELP,
  GREETING_TERMINAL_RESPONSES,
} from "@/lib/terminalCommands";

const Index = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [booting, setBooting] = useState(true);
  const [lines, setLines] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([
    "UNIT 2: THE BWR SIM // OPERATOR ACCESS TERMINAL",
    "Type HELP for available commands.",
  ]);
  const introStarted = useRef(false);
  useEffect(() => {
    const boot = [
      "[ OK ] Loading Unit 2 kernel",
      "[ OK ] Verifying operator terminal memory",
      "[ OK ] Initializing reactor physics model",
      "[ OK ] Loading 6 × 6 control-rod programme",
      "[ OK ] Starting MCC process controller",
      "[ OK ] Calibrating reactor, Hotwell and DA level instruments",
      "[ OK ] Establishing condensate and feedwater flow paths",
      "[ OK ] Arming RPS channels A / B",
      "[ OK ] Checking ECCS train availability",
      "[ OK ] Polling condenser circulation and vacuum controls",
      "[ OK ] Linking turbine and grid controls",
      "[ OK ] Loading annunciator matrix",
      "[ OK ] Restoring public simulator workspace",
      "",
      "",
      "",
      "[ OK ] Running final interface diagnostics",
      "Unit 2 operator terminal ready.",
    ];
    let index = 0;
    const timer = window.setInterval(() => {
      setLines((current) => [...current, boot[index]]);
      index += 1;
      if (index === boot.length) {
        window.clearInterval(timer);
        window.setTimeout(() => setBooting(false), 700);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const start = new Audio("/sounds/booting-start.mp3");
    const loop = new Audio("/sounds/booting-loop.mp3");
    start.volume = 0.34;
    loop.volume = 0.28;
    loop.loop = true;
    const begin = () => {
      if (introStarted.current) return;
      introStarted.current = true;
      void start.play().catch(() => {
        introStarted.current = false;
      });
    };
    const beginLoop = () => {
      void loop.play().catch(() => {});
    };
    const unlock = () => begin();
    start.addEventListener("ended", beginLoop);
    void start
      .play()
      .then(() => {
        introStarted.current = true;
      })
      .catch(() => {
        window.addEventListener("pointerdown", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
      });
    return () => {
      start.removeEventListener("ended", beginLoop);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      start.pause();
      start.currentTime = 0;
      loop.pause();
      loop.currentTime = 0;
    };
  }, []);
  const fullscreen = async () => {
    try {
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen();
    } catch {
      return;
    }
  };
  const run = async () => {
    const command = input.trim();
    if (!command) return;
    const [verb, ...args] = command.split(/\s+/);
    const lower = verb.toLowerCase();
    const argument = args.join(" ").trim();
    let response = "Unknown command. Type HELP.";
    if (GREETING_TERMINAL_RESPONSES[lower])
      response = GREETING_TERMINAL_RESPONSES[lower];
    else if (lower === "help") response = GREETING_HELP;
    else if (lower === "login" || lower === "logout")
      response = "Authentication is managed by the advanced console. Use CONSOLE, then LOGIN <account>.";
    else if (lower === "status")
      response = "System bus: ONLINE\nRPS: ARMED\nECCS: AVAILABLE\nConsole login: managed at /mainframe";
    else if (lower === "reactor") {
      await fullscreen();
      navigate("/reactor");
      return;
    } else if (lower === "console") {
      await fullscreen();
      navigate("/mainframe");
      return;
    } else if (lower === "url") {
      if (argument) {
        window.location.assign(argument);
        return;
      }
      response = "Usage: URL <address>";
    } else if (lower === "google") {
      if (/^https?:\/\//i.test(argument)) {
        window.open(argument, "_blank", "noopener,noreferrer");
        response = `Opening ${argument}`;
      } else response = "URL rejected. Use a full http:// or https:// address.";
    } else if (lower === "github") {
      window.open(
        "https://github.com/PB-Kronos/reactorapp",
        "_blank",
        "noopener,noreferrer",
      );
      response = "Opening Unit 2 repository.";
    } else if (lower === "contact") {
      if (argument.toLowerCase() === "discord") {
        window.open(
          "https://discord.com/users/1522528694378172480",
          "_blank",
          "noopener,noreferrer",
        );
        response = "Opening Discord contact.";
      } else
        response =
          "How do you want to contact the website owner?\nOptions: DISCORD\nUse: CONTACT DISCORD";
    } else if (lower === "time" || lower === "date")
      response = new Intl.DateTimeFormat(undefined, {
        dateStyle: "full",
        timeStyle: "medium",
      }).format(new Date());
    else if (lower === "whoami")
      response = localStorage.getItem("unit2-console-role") || "GUEST — login is managed at the advanced console";
    else if (lower === "uptime")
      response = `Terminal session: ${Math.floor(performance.now() / 1000)} seconds`;
    else if (lower === "echo") response = argument || "";
    else if (lower === "fortune") {
      const fortunes = [
        "A stable core starts with a stable operator.",
        "The best transient is the one you anticipated.",
        "Check the annunciators before they check you.",
        "A quiet control room is usually a good sign.",
      ];
      response = fortunes[Math.floor(Math.random() * fortunes.length)];
    } else if (lower === "clear") {
      setHistory([
        "UNIT 2: THE BWR SIM // OPERATOR ACCESS TERMINAL",
        "Type HELP for available commands.",
      ]);
      setInput("");
      return;
    }
    setHistory((current) => [...current.slice(-18), `> ${command}`, response]);
    setInput("");
  };
  return (
    <main className="min-h-screen overflow-hidden bg-[#050b0d] p-4 font-mono text-emerald-300 selection:bg-emerald-400 selection:text-black sm:p-8">
      <div className="pointer-events-none fixed inset-0 opacity-20 [background-image:linear-gradient(rgba(52,211,153,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,.12)_1px,transparent_1px)] [background-size:32px_32px]" />
      <section className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col border border-emerald-500/50 bg-black/75 p-5 shadow-[0_0_60px_rgba(16,185,129,.18)] sm:p-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/40 pb-4">
          <div>
            <p className="text-xs tracking-[.28em] text-emerald-500">
              UNIT 2 // THE BWR SIM
            </p>
            <h1 className="text-xl font-black text-emerald-200 sm:text-3xl">
              PLANT OPERATIONS TERMINAL
            </h1>
          </div>
          <span className="border border-emerald-500/60 px-3 py-1 text-xs">
            {booting ? "BOOTING" : "SYSTEM ONLINE"}
          </span>
        </header>
        <div className="grid flex-1 gap-8 lg:grid-cols-[1.5fr_1fr]">
          <section className="flex flex-col justify-center">
            <pre className="min-h-72 whitespace-pre-wrap border-l-2 border-emerald-400 bg-emerald-950/20 p-5 text-sm leading-7 text-emerald-200 sm:text-base">
              {booting ? lines.join("\n") : history.join("\n")}
              {booting && "\n_"}
            </pre>
            {!booting && (
              <div className="mt-5 space-y-3">
                <div className="flex gap-2">
                  <span className="py-3 text-emerald-400">unit2@operator:~$</span>
                  <input
                    autoFocus
                    className="min-w-0 flex-1 border-b border-emerald-400 bg-transparent px-2 py-3 text-emerald-100 outline-none"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void run()}
                    placeholder="help"
                  />
                  <Button
                    onClick={() => void run()}
                    className="bg-emerald-500 text-black hover:bg-emerald-300"
                  >
                    RUN
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 pl-0 sm:pl-36">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void fullscreen().then(() => navigate("/reactor"))}
                    className="h-7 border-emerald-600 bg-emerald-950/30 px-2 text-[10px] tracking-wide text-emerald-200 hover:bg-emerald-500 hover:text-black"
                  >
                    GO TO REACTOR
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void fullscreen().then(() => navigate("/mainframe"))}
                    className="h-7 border-cyan-700 bg-cyan-950/20 px-2 text-[10px] tracking-wide text-cyan-200 hover:bg-cyan-400 hover:text-black"
                  >
                    GO TO CONSOLE
                  </Button>
                </div>
              </div>
            )}
          </section>
          <aside className="space-y-4">
            <section className="border border-emerald-700/60 bg-emerald-950/15 p-5 text-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-emerald-100">
                  LIVE SYSTEM SUMMARY
                </h2>
                <span className="border border-emerald-500 px-2 py-1 text-xs text-emerald-200">
                  V2
                </span>
              </div>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt>Reactor core</dt>
                  <dd>STANDBY</dd>
                </div>
                <div className="flex justify-between">
                  <dt>RPS monitoring</dt>
                  <dd>ARMED</dd>
                </div>
                <div className="flex justify-between">
                  <dt>ECCS</dt>
                  <dd>AVAILABLE</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Console access</dt>
                  <dd>PUBLIC SANDBOX</dd>
                </div>
              </dl>
              <a
                className="mt-5 inline-block text-xs text-emerald-400 underline underline-offset-4 hover:text-emerald-200"
                href="https://github.com/PB-Kronos/reactorapp/activity"
                target="_blank"
                rel="noreferrer"
              >
                View changelog / GitHub activity ↗
              </a>
            </section>
            <section className="border border-cyan-700/50 bg-cyan-950/15 p-5 text-xs text-cyan-100">
              <h2 className="mb-3 font-bold text-cyan-200">UPDATE TO V2</h2>
              <ul className="space-y-2">
                <li>
                  • Terminals: reworked greeting commands and the live
                  /mainframe simulator terminal.
                </li>
                <li>
                  • Turbine: preparations, run-up conditions, fire protection,
                  and auxiliaries.
                </li>
                <li>
                  • Annunciators: more sounds, local acknowledge/silence, and
                  per-page windows.
                </li>
                <li>• APRM now gradually moves toward its intended target.</li>
                <li>
                  • ECCS: ADS, six relief valves, LCPI/RHR selector pumps, and
                  RCIC.
                </li>
              </ul>
            </section>
            <p className="border-t border-emerald-900 pt-3 text-xs text-emerald-600">
              Use HELP or VERSION in the terminal. Fullscreen is requested when
              entering a workspace.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
};
export default Index;
