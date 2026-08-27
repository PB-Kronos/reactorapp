"use client";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const ReactorSimulator = lazy(() => import("./pages/ReactorSimulator"));
const Mainframe = lazy(() => import("./pages/Mainframe"));
const Supervisor = lazy(() => import("./pages/Supervisor"));
const queryClient = new QueryClient();
const Loading = () => <div className="grid min-h-screen place-items-center bg-slate-950 font-mono text-cyan-300">Loading Unit 2 systems…</div>;
const tooltipKey = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const tooltipOverrides = () => {
  try {
    return JSON.parse(localStorage.getItem("unit2-tooltip-overrides") || "{}") as Record<string, { title: string; description: string }>;
  } catch {
    return {};
  }
};
const specificGuidance: Record<string, string> = {
  "page manual": "Opens the operating guide for the current panel. Read its sequence before using an unfamiliar system; the guide changes as you switch pages.",
  overview: "Returns to the plant overview. Use it to compare APRM, temperature, pressure, and recirculation before making another control change.",
  reactor: "Opens reactor start, normal-stop, and SCRAM controls. Use this page to establish the core state before working rods or turbine systems.",
  "mcc / water": "Opens the main condenser-cooling water inventory controls. Use it to balance reactor, hotwell, and feedwater flow.",
  eccs: "Opens emergency core cooling, ADS, and safety relief controls. Use only for low-level, low-pressure, or shutdown-cooling scenarios.",
  condenser: "Opens condenser circulation and vacuum controls. Establish healthy vacuum here before loading the turbine.",
  turbine: "Opens turbine steam, run-up, synchronization, and auxiliary controls. Use it after reactor steam conditions and condenser vacuum are acceptable.",
  electrical: "Opens transformer and safety bus breakers. Check available kW capacity before energizing additional pumps.",
  rps: "Opens the protection matrix. Review active trips here before resetting a trip or attempting restart.",
  "simple mode": "Switches between guided basic operation and the full simulation. Simple mode bypasses DA and turbine-preparation systems; Full mode restores their real interlocks.",
  "advanced console": "Opens the authenticated advanced console. Use it for live status, supervised commands, physics tuning, and tooltip customization.",
  "main valve fast close": "Rapidly drives the main steam valve shut to cut turbine admission. Use it for a turbine upset or controlled steam isolation; it does not operate the deaerator valve.",
  "da fast close": "Rapidly drives the deaerator intake valve closed while held. Use it only to isolate DA heating steam during a DA pressure upset.",
  "fast close active": "Indicates the DA fast-close command is presently driving the deaerator intake shut. Release the button to stop the action.",
  "enable audio": "Unlocks browser audio after a user gesture. Enable it once to hear annunciators and ambient equipment sound; it has no effect on plant state.",
  "hum off": "Turns off the background control-room hum. It does not silence annunciators; use the local Silence controls for alarm audio.",
  "hum on": "Turns on the optional ambient control-room hum. This is presentation audio only and does not affect any plant system.",
  "lamp test": "Temporarily lights annunciator windows so you can confirm the local panel display is working. It does not acknowledge or silence alarms.",
  "master silence": "Silences audible alarms across all annunciator windows. It does not acknowledge them or correct their initiating conditions.",
  "master ack": "Acknowledges active alarms across all annunciator windows. Active lamps remain illuminated until their sensor condition clears.",
  silence: "Silences audible alarms only for the currently displayed page. Use it to reduce noise while diagnosing the active local conditions.",
  ack: "Acknowledges alarms only for the currently displayed page. An acknowledged alarm remains lit while its condition is still present.",
  "bus a breaker": "Connects the 30 kW startup transformer. Use it for initial auxiliary power before the turbine-generator is synchronized.",
  "bus b breaker": "Connects turbine-generator Bus B. Close it only after synchronization; it supplies extra capacity and enables B pumps.",
  "bus s breaker": "Connects Safety Bus S for ECCS, RCIC, CST, and hotwell pumps. Keep its combined load at or below 30 kW.",
  "protection breaker": "Enables turbine roll-down protection through RPS Channel B. Keep it closed for normal operation so turbine faults can open the grid breaker.",
  "isolation valve": "Opens the RCIC injection flow path. Open it before using the RCIC turbopump valve, then watch reactor level as water is injected.",
  "train a pump": "Starts ECCS Train A. Select LPCI for low-pressure injection or RHR for shutdown cooling; both require Safety Bus S.",
  "train b pump": "Starts ECCS Train B. It can supplement Train A for low-pressure injection or shutdown cooling when Safety Bus S is available.",
  lpci: "Selects low-pressure coolant injection for this ECCS train. It injects only below 3500 kPa and makes ADS arming possible.",
  rhr: "Selects residual heat removal for this ECCS train. Use only after shutdown to cool the reactor without adding emergency injection flow.",
  "recirc pump a": "Starts Recirculation Pump A. Raise its speed gradually after stable rod conditions to increase core flow and APRM.",
  "recirc pump b": "Starts Recirculation Pump B. Use it with Pump A for higher core flow while monitoring period and recirculation imbalance alarms.",
  "rod drive": "Selects rods as Auto APRM's actuator. The controller pulses only rods that are permitted by the current mode and group block.",
  recirculation: "Selects recirculation as Auto APRM's actuator. It adjusts pump flow rather than rod position, so use it after startup when flow control is available.",
  "engage auto": "Engages Auto APRM with the selected target, speed, and actuator mode. It will pause automatically if a limit, block, or unsafe condition is reached.",
  "auto engaged": "Disengages Auto APRM and returns control to the operator. Use it before deliberately making a manual rod or recirculation maneuver.",
  slow: "Uses the slow response profile for manual rod and Auto APRM movement. Choose it for fine adjustment near a target.",
  medium: "Uses the medium response profile for normal manual rod and Auto APRM movement.",
  fast: "Uses the fast response profile for larger corrections. Monitor APRM and reactor period carefully because the response is more aggressive.",
  "open close-up synchronoscope": "Opens the detailed phase display. Use it to verify small phase difference and near-synchronous RPM before closing the grid breaker.",
  "open grid breaker": "Disconnects the generator from the grid. Use to unload or isolate the turbine-generator before a planned stop or abnormal condition.",
  "close grid breaker": "Connects the generator to the grid. It is permitted only when exciter, phase, and speed synchronization conditions are satisfied.",
  "reactor temperature": "Directly overrides simulated reactor temperature. Use for controlled testing only; high values can trigger thermal protection and change steam production.",
  "rpv pressure": "Directly overrides reactor pressure. Use for testing ECCS, SRVs, and turbine response; normal operation should control pressure through steam flow.",
  "reactor level": "Directly changes reactor vessel level. Use only for controlled tests because it can activate low/high level protection and ECCS logic.",
  "hotwell level": "Directly changes hotwell inventory for testing. In normal operation, correct it with condensate flow, MCC Auto, or makeup/drain pumps.",
  "da level": "Directly changes deaerator level for Full-mode testing. Normally the DA level follows the difference between hotwell and feedwater flows.",
  "condenser pressure": "Directly overrides condenser pressure. Use to test vacuum alarms or turbine efficiency; normal operation should use circulation, CARs, and the vacuum valve.",
  "all rods withdrawn": "Sets all rods to the chosen withdrawal percentage. This bypasses the normal SRM/IPR group programme and is intended only for test setup.",
  "thermal response": "Scales how quickly reactor temperature follows power. Values above 1 speed the thermal transient; use cautiously because trips can occur sooner.",
  "steam production": "Scales steam generation from reactor thermal output. Increasing it raises steam flow, pressure response, and MCC flow demand.",
  "steam removal": "Scales steam removal from the reactor model. Increasing it makes pressure fall more readily for the same steam path configuration.",
  "auto-scram temperature": "Sets the automatic core-temperature protection threshold. Keep it high enough for normal operation but low enough to catch unsafe heat-up during testing.",
  "+1 m reactor level": "Injects a one-metre reactor-level test step. Use to verify high-level indications, not as a substitute for feedwater control.",
  "−1 m reactor level": "Removes one metre of reactor-level test inventory. Use to test low-level response, ECCS availability, and ADS logic.",
  "+1,000 kpa pressure": "Adds a 1,000 kPa pressure test step. Use to test turbine pressure control and SRV/RPS responses.",
  "−1,000 kpa pressure": "Removes a 1,000 kPa pressure test step. Use to test low-pressure logic without changing steam valves.",
  "trigger scram": "Injects a simulated SCRAM from the console. It inserts rods and stops recirculation when the control room processes the command.",
  "reset trip nodes": "Clears resettable RPS trip indications after their causes have cleared. It does not bypass a still-active trip condition.",
  aux: "Selects the normal auxiliary motor-driven pump. Use AUX during turbine run-up before shaft-driven oil/hydraulic pressure is available.",
  emerg: "Selects emergency Safety Bus S pump power. Use only when normal auxiliary or shaft pressure is unavailable and Safety Bus S is energized.",
  shaft: "Uses shaft-driven pump pressure, available only above roughly 1800 RPM. Select after run-up to avoid relying on auxiliary pumps.",
  off: "Removes the selected auxiliary pump command. For lube/hydraulic pumps this becomes shaft-driven only after sufficient RPM; otherwise pressure is lost.",
};
const controlGuidance = (label: string, fallback: string) => {
  const key = label.toLowerCase().replace(/\s+/g, " ");
  if (specificGuidance[key]) return specificGuidance[key];
  return `${label}: ${fallback}`;
};
const ControlTooltips = () => {
  const [tooltip, setTooltip] = useState<{ title: string; description: string; x: number; y: number; below: boolean } | null>(null);
  const [enabled, setEnabled] = useState(() => localStorage.getItem("unit2-tooltips-enabled") !== "false");
  const keyboardFocus = useRef(false);
  const hoveredControl = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onToggle = (event: Event) => {
      const next = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      if (typeof next !== "boolean") return;
      setEnabled(next);
      if (!next) setTooltip(null);
    };
    window.addEventListener("unit2-tooltip-toggle", onToggle);
    return () => window.removeEventListener("unit2-tooltip-toggle", onToggle);
  }, []);
  useEffect(() => {
    const selector = 'button, input, select, textarea, [role="slider"]';
    const annotateOne = (control: HTMLElement) => {
      const nativeHint = control.getAttribute("title");
      if (nativeHint) {
        control.dataset.tooltipDescription ||= nativeHint;
        control.removeAttribute("title");
      }
      const label = control.getAttribute("aria-label") || control.textContent?.replace(/\s+/g, " ").trim() || (control instanceof HTMLInputElement ? control.placeholder : "");
      if (label) control.dataset.tooltipTitle ||= label;
      const defaultTitle = control.dataset.tooltipBaseTitle || control.dataset.tooltipTitle || label || "Control";
      control.dataset.tooltipBaseTitle ||= defaultTitle;
      const defaultDescription = control.dataset.tooltipBaseDescription || control.dataset.tooltipDescription || "Use this control to change the associated system setting, then monitor the matching meter or annunciator for its response.";
      control.dataset.tooltipBaseDescription ||= defaultDescription;
      const override = tooltipOverrides()[tooltipKey(defaultTitle)];
      control.dataset.tooltipTitle = override?.title || defaultTitle;
      control.dataset.tooltipDescription = override?.description || controlGuidance(
        defaultTitle,
        defaultDescription,
      );
    };
    const annotate = (root: ParentNode = document) => {
      if (root instanceof HTMLElement && root.matches(selector)) annotateOne(root);
      root.querySelectorAll<HTMLElement>(selector).forEach(annotateOne);
    };
    const show = (control: HTMLElement) => {
      if (!enabled) return;
      annotateOne(control);
      const rect = control.getBoundingClientRect();
      setTooltip({
        title: control.dataset.tooltipTitle || "Control",
        description: control.dataset.tooltipDescription || "Select to operate this control.",
        x: Math.min(Math.max(rect.left + rect.width / 2, 144), window.innerWidth - 144),
        y: rect.top,
        below: rect.top < 96,
      });
    };
    const controlFor = (target: EventTarget | null) => {
      const control = target instanceof Element ? target.closest<HTMLElement>(selector) : null;
      // The dense A1–F6 core map is a selection surface, not a set of 36
      // independent documented controls. Suppress its popups entirely.
      if (control?.matches("button") && /^[A-F][1-6]$/.test(control.textContent?.trim() || "")) return null;
      return control;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!enabled || event.pointerType !== "mouse" || event.buttons !== 0) return;
      const control = controlFor(event.target);
      if (control === hoveredControl.current) return;
      hoveredControl.current = control;
      if (control) show(control);
      else setTooltip(null);
    };
    const onPointerDown = () => {
      keyboardFocus.current = false;
      hoveredControl.current = null;
      setTooltip(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") keyboardFocus.current = true;
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!enabled || !keyboardFocus.current) return;
      const control = controlFor(event.target);
      if (control) show(control);
    };
    const onFocusOut = () => setTooltip(null);
    const onOverridesChanged = () => {
      annotate();
      setTooltip(null);
    };
    annotate();
    const observer = new MutationObserver((changes) => {
      changes.forEach((change) => change.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) annotate(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("unit2-tooltip-overrides", onOverridesChanged);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("unit2-tooltip-overrides", onOverridesChanged);
    };
  }, [enabled]);
  if (!tooltip) return null;
  return <div aria-live="polite" className="pointer-events-none fixed z-[100] w-72 -translate-x-1/2 rounded-lg border border-cyan-300/70 bg-slate-950/95 px-3 py-2 font-mono shadow-[0_8px_30px_rgba(0,0,0,.55)]" style={{ left: tooltip.x, top: tooltip.below ? tooltip.y + 14 : tooltip.y - 10, transform: `translate(-50%, ${tooltip.below ? "0" : "-100%"})` }}><div className="text-xs font-black tracking-wide text-cyan-200">{tooltip.title}</div><p className="mt-1 text-[11px] leading-snug text-slate-300">{tooltip.description}</p></div>;
};

const App = () => <QueryClientProvider client={queryClient}><TooltipProvider><ControlTooltips /><Toaster /><Sonner /><BrowserRouter><Suspense fallback={<Loading />}><Routes><Route path="/" element={<Index />} /><Route path="/reactor" element={<ReactorSimulator />} /><Route path="/mainframe" element={<Mainframe />} /><Route path="/supervisor" element={<Supervisor />} /><Route path="*" element={<NotFound />} /></Routes></Suspense></BrowserRouter></TooltipProvider></QueryClientProvider>;
export default App;
