import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MAINFRAME_TERMINAL_RESPONSES } from "@/lib/terminalCommands";

type Role =
  "MCC" | "REACTOR" | "TURBINE" | "ECCS" | "ELECTRICAL" | "SUPERVISOR";
const ACCOUNTS: Record<Role, { label: string; scopes: string[] }> = {
  MCC: { label: "MCC / water systems operator", scopes: ["mcc"] },
  REACTOR: { label: "Reactor operator", scopes: ["reactor"] },
  TURBINE: { label: "Turbine operator", scopes: ["turbine"] },
  ECCS: { label: "ECCS operator", scopes: ["eccs"] },
  ELECTRICAL: { label: "Electrical operator", scopes: ["electrical"] },
  SUPERVISOR: { label: "Plant supervisor — all systems", scopes: ["*"] },
};
const HELP =
  "PUBLIC: HELP · ACCOUNTS · LOGIN <account> · LOGOUT · STATUS · VALUES · GET <value> · ABOUT · CHANGELOG · MULTIUNIT · CLEAR\nREACTOR: reactor.temp|pressure|level set <value> · reactor.aprm set <0-100> · rods.withdraw set <0-100> · recirc.a|b set <0-100> · mode set SD|SRM|IPR|RUN · start · stop · scram\nMCC: hotwell.level|da.level|temp|pressure|cst.level set <value> · condenser.pressure|valve set <value> · condensate.a|b set <kg/s> · feedwater.a|b set <kg/s> · mcc.pump|auto on|off\nTURBINE: turbine.mainvalve|bypass set <0-100> · turbine.inlet|rpmauto|pressureauto on|off · turbine.smoke trigger\nECCS: rcic.valve on|off · eccs.a|b on|off · ads on|off\nELECTRICAL: electrical.busa|busatransformer|busb|buss on|off\nSUPERVISOR: physics.thermal|steam|removal|triptemp set <value> · tooltip list · tooltip set <control> | <title> | <explanation> · tooltip reset <control|all>\nSimulation commands are accepted here and applied as soon as the Control Room is active.";
const COMMAND_HELP: Record<string, string> = {
  values: "VALUES\nShows the current status summary for your logged-in role. Use GET <value> for one reading.",
  get: "GET <value>\nReads one live/saved measurement without changing the simulator.\n\nAvailable values:\nREACTOR.TEMP · REACTOR.PRESSURE · REACTOR.LEVEL\nHOTWELL.LEVEL · DA.LEVEL · DA.TEMP · DA.PRESSURE · CST.LEVEL\nCONDENSER.PRESSURE · CONDENSER.VALVE · CONDENSATE.A|B · FEEDWATER.A|B\nRECIRC.A|B · TURBINE.RPM · TURBINE.MAINVALVE · TURBINE.BYPASS · AUTO.APRM\n\nExample: GET REACTOR.PRESSURE",
  login: "LOGIN <account>\nSigns into a simulated operator role. Accounts: MCC, REACTOR, TURBINE, ECCS, ELECTRICAL, SUPERVISOR.\nExample: LOGIN SUPERVISOR",
  status: "STATUS\nShows the concise status display for the currently logged-in operator role.",
  multiunit: "MULTIUNIT\nPrints the V2.3.2 shared-plant and local-operation manual.",
  reactor: "REACTOR\nOpens the Control Room. A Mainframe login is required before access is granted.",
  scram: "SCRAM\nInserts the control rods when applied in the Control Room. Restricted to REACTOR or SUPERVISOR.",
  mode: "MODE SET SD|SRM|IPR|RUN\nSelects the reactor rod-control operating mode. Example: MODE SET RUN",
  "reactor.temp": "REACTOR.TEMP SET <°C>\nOverrides reactor temperature for testing. Range: 20–1800 °C.",
  "reactor.pressure": "REACTOR.PRESSURE SET <kPa>\nOverrides RPV pressure. Range: 101–12000 kPa.",
  "reactor.level": "REACTOR.LEVEL SET <m> or ADD <m>\nSets or offsets vessel level. Range: −5 to +6 m.",
  "rods.withdraw": "RODS.WITHDRAW SET <percent>\nMoves all rods to the requested withdrawn position. Range: 0–100%.",
  "recirc.a": "RECIRC.A SET <percent>\nSets recirculation pump A valve position. Range: 0–100%.",
  "recirc.b": "RECIRC.B SET <percent>\nSets recirculation pump B valve position. Range: 0–100%.",
  "mcc.auto": "MCC.AUTO ON|OFF\nEnables or disables automatic MCC water-inventory control.",
  "condenser.auto": "CONDENSER.AUTO ON|OFF\nEnables or disables automatic condenser vacuum control.",
  "turbine.rpmauto": "TURBINE.RPMAUTO ON|OFF\nAutomatically positions the main steam valve to approach 3000 RPM before synchronization.",
  "turbine.pressureauto": "TURBINE.PRESSUREAUTO ON|OFF\nAutomatically balances main and bypass steam valves around the pressure target.",
  physics: "PHYSICS.<thermal|steam|removal|triptemp> SET <value>\nSupervisor tuning overrides. Thermal, steam and removal range 0–3; TRIPTEMP is 100–1800 °C.",
  tooltip: "TOOLTIP LIST\nTOOLTIP SET <control> | <title> | <explanation>\nTOOLTIP RESET <control|all>\nSupervisor-only editing for website control guidance.",
};
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const tooltipKey = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

const Mainframe = () => {
  const navigate = useNavigate();
  const [command, setCommand] = useState("");
  const terminalOutputRef = useRef<HTMLPreElement>(null);
  const [history, setHistory] = useState<string[]>([
    "UNIT 2: THE BWR SIM // ADVANCED CONSOLE v2.0",
    "Authentication required for simulation controls.",
    "Use ACCOUNTS, then LOGIN <account>.",
  ]);
  const [role, setRole] = useState<Role | null>(() => {
    const stored = localStorage.getItem("unit2-console-role") as Role | null;
    return stored && ACCOUNTS[stored] ? stored : null;
  });
  const [operatorName] = useState(
    () => localStorage.getItem("unit2-operator-name") || "",
  );
  const [saved, setSaved] = useState<Record<string, any>>(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("rbwr-live-plant-state") ||
          localStorage.getItem("rbwr-u2-sim-v4") ||
          "{}",
      );
    } catch {
      return {};
    }
  });
  const store = (next: Record<string, any>) => {
    const updated = { ...next, updatedAt: Date.now() };
    sessionStorage.setItem("rbwr-live-plant-state", JSON.stringify(updated));
    setSaved(updated);
  };
  const allowed = (scope: string) =>
    Boolean(
      role &&
      (ACCOUNTS[role].scopes.includes("*") ||
        ACCOUNTS[role].scopes.includes(scope)),
    );
  const statusLines = useMemo(() => {
    if (!role)
      return ["LOGIN REQUIRED", "Use ACCOUNTS for available operator roles."];
    const base = [`ACCOUNT: ${role}`, ACCOUNTS[role].label];
    if (role === "MCC" || role === "SUPERVISOR")
      return [
        ...base,
        `REACTOR LEVEL: ${Number(saved.reactorLevel || 0).toFixed(2)} m`,
        `HOTWELL LEVEL: ${Number(saved.hotwellLevel || 0).toFixed(2)} m`,
        `DA LEVEL: ${Number(saved.deaeratorLevel || 0).toFixed(2)} m`,
        `CONDENSER: ${Number(saved.condenserVacuum || 1).toFixed(3)} bar`,
      ];
    if (role === "REACTOR")
      return [
        ...base,
        `MODE: ${saved.mode || "SD"}`,
        `APRM: ${Number(saved.aprm || 0).toFixed(2)}%`,
        `RPV: ${Number(saved.pressure || 101).toFixed(0)} kPa`,
        `RODS: ${saved.rods?.length || 0} channels`,
      ];
    if (role === "TURBINE")
      return [
        ...base,
        `MAIN VALVE: ${Number(saved.valveValue || 0).toFixed(0)}%`,
        `BYPASS: ${Number(saved.bypassValve || 0).toFixed(0)}%`,
        `OUTPUT: ${Number(saved.turbineOutputMW || 0).toFixed(1)} MW`,
      ];
    if (role === "ECCS")
      return [
        ...base,
        `RPV: ${Number(saved.pressure || 101).toFixed(0)} kPa`,
        `REACTOR LEVEL: ${Number(saved.reactorLevel || 0).toFixed(2)} m`,
        "ECCS MONITORING ENABLED",
      ];
    return [...base, "BUS STATUS: MONITORING", "ELECTRICAL COMMAND AUTHORITY"];
  }, [role, saved]);
  useEffect(() => {
    const loop = new Audio("/sounds/booting-loop.mp3");
    loop.loop = true;
    loop.volume = 0.18;
    const start = () => void loop.play().catch(() => {});
    start();
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      loop.pause();
      loop.currentTime = 0;
    };
  }, []);
  useEffect(() => {
    if (operatorName) return;
    navigate("/", { replace: true });
  }, [navigate, operatorName]);
  const append = (text: string, response: string) => {
    setHistory((previous) => [...previous.slice(-54), `> ${text}`, response]);
    setCommand("");
  };
  useEffect(() => {
    const output = terminalOutputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [history]);
  const queueLiveCommand = (text: string) => {
    let commands: string[] = [];
    try {
      const stored = JSON.parse(
        sessionStorage.getItem("rbwr-pending-console-commands") || "[]",
      );
      commands = Array.isArray(stored) ? stored.filter((entry): entry is string => typeof entry === "string") : [];
    } catch {
      commands = [];
    }
    sessionStorage.setItem(
      "rbwr-pending-console-commands",
      JSON.stringify([...commands.slice(-49), text]),
    );
  };
  const run = () => {
    const text = command.trim();
    if (!text) return;
    const [target = "", verb = "", raw = ""] = text.toLowerCase().split(/\s+/);
    const value = Number(raw);
    if (target === "clear") {
      setHistory([]);
      setCommand("");
      return;
    }
    if (target === "help")
      return append(
        text,
        verb
          ? COMMAND_HELP[verb] ||
              COMMAND_HELP[verb.split(".")[0]] ||
              `No detailed entry for ${verb.toUpperCase()}.\n\n${HELP}`
          : HELP,
      );
    if (target === "accounts")
      return append(
        text,
        "AVAILABLE ACCOUNTS (no password in public sandbox):\nMCC — water inventory and condenser\nREACTOR — rods, reactor state, SCRAM\nTURBINE — steam valves and turbine events\nECCS — emergency cooling commands\nELECTRICAL — electrical command authority\nSUPERVISOR — all systems\n\nUse LOGIN <account>.",
      );
    if (target === "login") {
      const next = verb.toUpperCase() as Role;
      if (!ACCOUNTS[next])
        return append(
          text,
          "Unknown account. Use ACCOUNTS for the operator list.",
        );
      localStorage.setItem("unit2-console-role", next);
      localStorage.setItem("rbwr-operator", next);
      setRole(next);
      return append(text, `LOGIN ACCEPTED — ${next}\n${ACCOUNTS[next].label}`);
    }
    if (target === "logout") {
      localStorage.removeItem("unit2-console-role");
      localStorage.removeItem("rbwr-operator");
      setRole(null);
      return append(text, "LOGOUT COMPLETE. Simulation controls locked.");
    }
    if (MAINFRAME_TERMINAL_RESPONSES[target])
      return append(text, MAINFRAME_TERMINAL_RESPONSES[target]);
    if (target === "status") return append(text, statusLines.join("\n"));
    if (target === "values")
      return append(
        text,
        `${statusLines.join("\n")}\n\nUse GET <value> for an individual reading.`,
      );
    if (target === "home") {
      navigate("/");
      return;
    }
    if (target === "reactor" && !verb) {
      if (!role)
        return append(
          text,
          "LOGIN REQUIRED before opening the control workspace from this terminal.",
        );
      navigate("/reactor");
      return;
    }
    if (!role)
      return append(
        text,
        "LOGIN REQUIRED. Use ACCOUNTS, then LOGIN <account>.",
      );
    if (target === "get") {
      const controls = saved.controls || {};
      const readings: Record<string, number | string | undefined> = {
        "reactor.temp": saved.temperature,
        "reactor.pressure": saved.pressure,
        "reactor.level": saved.reactorLevel,
        "hotwell.level": saved.hotwellLevel,
        "da.level": saved.deaeratorLevel,
        "da.temp": saved.daTemperature,
        "da.pressure": saved.daPressure,
        "cst.level": saved.cstLevel,
        "condenser.pressure": saved.condenserVacuum,
        "condenser.valve": controls.condenserValve,
        "condensate.a": controls.condensateFlow,
        "condensate.b": controls.condensatePumpBFlow,
        "feedwater.a": controls.feedwaterFlow,
        "feedwater.b": controls.feedwaterPumpBFlow,
        "recirc.a": controls.recircSpeedA,
        "recirc.b": controls.recircSpeedB,
        "turbine.rpm": saved.actualRPM,
        "turbine.mainvalve": saved.valveValue,
        "turbine.bypass": saved.bypassValve,
        "auto.aprm": controls.autoTarget,
      };
      if (!verb || !(verb in readings))
        return append(text, "Unknown monitor point. Use VALUES for a summary or HELP for available names.");
      const reading = readings[verb];
      return append(
        text,
        `${verb.toUpperCase()} = ${typeof reading === "number" ? reading.toFixed(3) : reading ?? "UNAVAILABLE"}`,
      );
    }
    if (target === "tooltip") {
      if (!allowed("*"))
        return append(text, "ACCESS DENIED — SUPERVISOR authority is required to edit operator guidance.");
      const readOverrides = () => {
        try {
          return JSON.parse(localStorage.getItem("unit2-tooltip-overrides") || "{}") as Record<string, { title: string; description: string }>;
        } catch {
          return {};
        }
      };
      if (verb === "list") {
        const entries = Object.entries(readOverrides());
        return append(text, entries.length ? entries.map(([key, value]) => `${key}\n  TITLE: ${value.title}\n  TEXT: ${value.description}`).join("\n") : "No custom tooltips. Built-in guidance is active.");
      }
      const setMatch = text.match(/^tooltip\s+set\s+(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/i);
      if (setMatch) {
        const [, control, title, description] = setMatch;
        const overrides = readOverrides();
        overrides[tooltipKey(control)] = { title: title.trim(), description: description.trim() };
        localStorage.setItem("unit2-tooltip-overrides", JSON.stringify(overrides));
        window.dispatchEvent(new Event("unit2-tooltip-overrides"));
        return append(text, `Tooltip override saved for ${control.trim().toUpperCase()}.`);
      }
      const resetMatch = text.match(/^tooltip\s+reset\s+(.+)$/i);
      if (resetMatch) {
        const control = resetMatch[1].trim();
        if (control.toLowerCase() === "all") localStorage.removeItem("unit2-tooltip-overrides");
        else {
          const overrides = readOverrides();
          delete overrides[tooltipKey(control)];
          localStorage.setItem("unit2-tooltip-overrides", JSON.stringify(overrides));
        }
        window.dispatchEvent(new Event("unit2-tooltip-overrides"));
        return append(text, control.toLowerCase() === "all" ? "All custom tooltips reset to built-in guidance." : `Tooltip reset for ${control.toUpperCase()}.`);
      }
      return append(text, "Usage:\nTOOLTIP LIST\nTOOLTIP SET <control> | <title> | <explanation>\nTOOLTIP RESET <control|all>");
    }
    const scope =
      target === "reactor.level"
        ? allowed("mcc")
          ? "mcc"
          : "reactor"
        : target.startsWith("mcc") ||
      target.startsWith("hotwell") ||
      target.startsWith("da") ||
      target.startsWith("condenser") ||
      target.startsWith("cst") ||
      target.startsWith("condensate") ||
      target.startsWith("feedwater")
        ? "mcc"
        : target.startsWith("turbine")
          ? "turbine"
          : target.startsWith("eccs") || target.startsWith("rcic") || target === "ads"
            ? "eccs"
            : target.startsWith("electrical")
              ? "electrical"
              : target.startsWith("physics")
                ? "supervisor"
              : "reactor";
    if (!allowed(scope))
      return append(
        text,
        `ACCESS DENIED — ${scope.toUpperCase()} authority required. Login as ${scope.toUpperCase()} or SUPERVISOR.`,
      );
    const liveCommand =
      target === "start" ||
      target === "stop" ||
      target === "scram" ||
      target === "mode" ||
      target === "ads" ||
      /^(reactor\.|rods\.|hotwell\.|da\.|cst\.|condenser\.|condensate\.|feedwater\.|recirc\.|turbine\.|auto\.|mcc\.|electrical\.|rcic\.|eccs\.|physics\.)/.test(target);
    if (liveCommand) {
      queueLiveCommand(text);
      return append(
        text,
        "COMMAND ACCEPTED — queued for the shared live simulator. It is applied immediately when the Control Room is active.",
      );
    }
    if (target === "scram") {
      sessionStorage.setItem("rbwr-pending-console-command", "scram");
      return append(
        text,
        "Manual SCRAM armed; it will execute on Control Room entry.",
      );
    }
    if (target === "turbine.smoke" && verb === "trigger") {
      sessionStorage.setItem(
        "rbwr-pending-console-command",
        "turbine.smoke trigger",
      );
      return append(text, "Turbine smoke event armed for Control Room entry.");
    }
    if (target === "start" || target === "stop") {
      store({ ...saved, isRunning: target === "start" });
      return append(text, `Simulator state set to ${target.toUpperCase()}.`);
    }
    if (
      target === "mode" &&
      verb === "set" &&
      ["sd", "srm", "ipr", "run"].includes(raw)
    ) {
      store({ ...saved, mode: raw.toUpperCase() });
      return append(text, `Mode set to ${raw.toUpperCase()}.`);
    }
    if (
      (target === "mcc.pump" || target === "mcc.auto") &&
      ["on", "off"].includes(verb)
    ) {
      store({
        ...saved,
        controls: {
          ...(saved.controls || {}),
          [target === "mcc.pump" ? "mccPumpOn" : "mccAutoOn"]:
            verb === "on",
        },
      });
      return append(text, `${target.toUpperCase()} ${verb.toUpperCase()}.`);
    }
    if (!Number.isFinite(value))
      return append(text, "Invalid value. Use HELP for syntax.");
    const next = { ...saved };
    let changed = false;
    const set = (key: string, min: number, max: number) => {
      next[key] = clamp(value, min, max);
      changed = true;
    };
    if (target === "reactor.pressure" && verb === "set")
      set("pressure", 101, 12000);
    else if (target === "reactor.temp" && verb === "set")
      set("temperature", 20, 1800);
    else if (target === "reactor.level" && (verb === "set" || verb === "add")) {
      next.reactorLevel = clamp(
        verb === "add" ? Number(next.reactorLevel || 0) + value : value,
        -5,
        6,
      );
      changed = true;
    } else if (
      target === "hotwell.level" &&
      (verb === "set" || verb === "add")
    ) {
      next.hotwellLevel = clamp(
        verb === "add" ? Number(next.hotwellLevel || 0) + value : value,
        -5,
        6,
      );
      changed = true;
    } else if (target === "da.level" && (verb === "set" || verb === "add")) {
      next.deaeratorLevel = clamp(
        verb === "add" ? Number(next.deaeratorLevel || 0) + value : value,
        -5,
        6,
      );
      changed = true;
    } else if (target === "condenser.pressure" && verb === "set")
      set("condenserVacuum", 0.001, 1.5);
    else if (target === "turbine.mainvalve" && verb === "set")
      set("valveValue", 0, 100);
    else if (target === "turbine.bypass" && verb === "set")
      set("bypassValve", 0, 100);
    else if (target === "rods.withdraw" && verb === "set") {
      const withdrawn = clamp(value, 0, 100);
      next.rods = Array.isArray(next.rods)
        ? next.rods.map((rod: any) => ({ ...rod, position: 100 - withdrawn }))
        : next.rods;
      changed = true;
    } else if (target.startsWith("physics.") && verb === "set") {
      const key = target.slice(8);
      const names: Record<string, string> = {
        thermal: "thermalResponse",
        steam: "steamProduction",
        removal: "steamRemoval",
        triptemp: "tripTemperature",
      };
      if (!names[key])
        return append(
          text,
          "Unknown physics value. Use thermal, steam, removal, or triptemp.",
        );
      next.physicsTuning = {
        ...(next.physicsTuning || {}),
        [names[key]]: clamp(
          value,
          key === "triptemp" ? 100 : 0,
          key === "triptemp" ? 1800 : 3,
        ),
      };
      changed = true;
    }
    if (!changed)
      return append(text, "Unknown or unauthorized control. Type HELP.");
    store(next);
    append(
      text,
      "Shared simulator state updated. Open Control Room to apply it live.",
    );
  };
  const logout = () => {
    localStorage.removeItem("unit2-console-role");
    localStorage.removeItem("rbwr-operator");
    setRole(null);
  };
  return (
    <main className="min-h-screen bg-[#050b0d] p-4 font-mono text-emerald-300 sm:p-8">
      <header className="mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-3 border-b border-emerald-600/40 pb-4">
        <div>
          <p className="text-xs tracking-[.3em] text-emerald-500">
            UNIT 2 // THE BWR SIM
          </p>
          <h1 className="text-2xl font-black text-emerald-100">
            ADVANCED SIMULATOR CONSOLE
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-emerald-600 text-emerald-200"
            onClick={() => navigate("/reactor")}
          >
            CONTROL ROOM
          </Button>
          <Button
            variant="outline"
            className="border-emerald-800 text-emerald-300"
            onClick={logout}
          >
            LOGOUT
          </Button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.65fr_.8fr]">
        <section className="border border-emerald-600/50 bg-black p-4 shadow-[0_0_35px_rgba(16,185,129,.14)]">
          <pre ref={terminalOutputRef} className="h-[55vh] overflow-y-auto whitespace-pre-wrap text-sm leading-6">
            {history.join("\n")}
          </pre>
          <div className="mt-4 flex gap-2 border-t border-emerald-900 pt-3">
            <span className="py-2 text-xs sm:text-sm">
              {role ? `${role.toLowerCase()}@unit2:~$` : "locked@unit2:~$"}
            </span>
            <input
              autoFocus
              className="min-w-0 flex-1 bg-transparent px-2 text-emerald-100 outline-none"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && run()}
              placeholder={role ? "status" : "login supervisor"}
            />
            <Button
              className="bg-emerald-500 text-black hover:bg-emerald-300"
              onClick={run}
            >
              RUN
            </Button>
          </div>
        </section>
        <aside className="space-y-4">
          <section
            className={`border p-4 ${role ? "border-emerald-700 bg-emerald-950/20" : "border-amber-500/70 bg-amber-950/30"}`}
          >
            <h2 className="mb-3 font-bold text-emerald-100">
              OPERATOR STATUS DISPLAY
            </h2>
            <pre className="whitespace-pre-wrap text-xs leading-6 text-emerald-200">
              {statusLines.join("\n")}
            </pre>
          </section>
          <section className="border border-cyan-700/50 bg-cyan-950/15 p-4 text-xs text-cyan-100">
            <h2 className="mb-2 font-bold text-cyan-200">COMMAND ACCESS</h2>
            <p>
              {role
                ? `${role}: ${ACCOUNTS[role].scopes.includes("*") ? "ALL PLANT SYSTEMS" : ACCOUNTS[role].scopes.join(", ").toUpperCase()}`
                : "No operator session. Use ACCOUNTS, then LOGIN <account>."}
            </p>
          </section>
          <section className="border border-amber-500/40 bg-amber-950/20 p-4 text-sm">
            <h2 className="mb-2 font-bold text-amber-200">
              LIVE OVERRIDE WORKSPACE
            </h2>
            <p className="text-amber-100/80">
              Commands write to the shared simulator session. The control room
              applies the values as it starts its live physics loop.
            </p>
            <Button
              className="mt-4 w-full bg-amber-400 text-black hover:bg-amber-300"
              disabled={!role}
              onClick={() => navigate("/reactor")}
            >
              OPEN CONTROL ROOM
            </Button>
          </section>
        </aside>
      </div>
    </main>
  );
};
export default Mainframe;
