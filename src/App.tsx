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
const StatusDesk = lazy(() => import("./pages/StatusDesk"));
const NaramoPlant = lazy(() => import("./pages/NaramoPlant"));
const ReactorArchive = lazy(() => import("./pages/ReactorArchive"));
const ACoreGame = lazy(() => import("./pages/ACoreGame"));
const ApolloFacility = lazy(() => import("./pages/ApolloFacility"));
const IitppPlant = lazy(() => import("./pages/IitppPlant"));
const QserfPlant = lazy(() => import("./pages/QserfPlant"));
const Foxtrot9 = lazy(() => import("./pages/Foxtrot9"));
const queryClient = new QueryClient();
const Loading = () => (
  <div className="grid min-h-screen place-items-center bg-slate-950 font-mono text-cyan-300">
    Loading Unit 2 systems…
  </div>
);
const tooltipKey = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();
const tooltipOverrides = () => {
  try {
    return JSON.parse(
      localStorage.getItem("unit2-tooltip-overrides") || "{}",
    ) as Record<string, { title: string; description: string }>;
  } catch {
    return {};
  }
};
const specificGuidance: Record<string, string> = {
  "page manual":
    "Opens the operating guide for the current panel. Read its sequence before using an unfamiliar system; the guide changes as you switch pages.",
  overview:
    "Returns to the plant overview. Use it to compare APRM, temperature, pressure, and recirculation before making another control change.",
  reactor:
    "Opens reactor start, normal-stop, and SCRAM controls. Use this page to establish the core state before working rods or turbine systems.",
  "mcc / water":
    "Opens the main condenser-cooling water inventory controls. Use it to balance reactor, hotwell, and feedwater flow.",
  eccs: "Opens emergency core cooling, ADS, and safety relief controls. Use only for low-level, low-pressure, or shutdown-cooling scenarios.",
  condenser:
    "Opens condenser circulation and vacuum controls. Establish healthy vacuum here before loading the turbine.",
  turbine:
    "Opens turbine steam, run-up, synchronization, and auxiliary controls. Use it after reactor steam conditions and condenser vacuum are acceptable.",
  electrical:
    "Opens transformer and safety bus breakers. Check available kW capacity before energizing additional pumps.",
  rps: "Opens the protection matrix. Review active trips here before resetting a trip or attempting restart.",
  "simple mode":
    "Switches between guided basic operation and the full simulation. Simple mode bypasses DA and turbine-preparation systems; Full mode restores their real interlocks.",
  "advanced console":
    "Opens the authenticated advanced console. Use it for live status, supervised commands, physics tuning, and tooltip customization.",
  "main valve fast close":
    "Rapidly drives the main steam valve shut to cut turbine admission. Use it for a turbine upset or controlled steam isolation; it does not operate the deaerator valve.",
  "da fast close":
    "Rapidly drives the deaerator intake valve closed while held. Use it only to isolate DA heating steam during a DA pressure upset.",
  "fast close active":
    "Indicates the DA fast-close command is presently driving the deaerator intake shut. Release the button to stop the action.",
  "enable audio":
    "Unlocks browser audio after a user gesture. Enable it once to hear annunciators and ambient equipment sound; it has no effect on plant state.",
  "hum off":
    "Turns off the background control-room hum. It does not silence annunciators; use the local Silence controls for alarm audio.",
  "hum on":
    "Turns on the optional ambient control-room hum. This is presentation audio only and does not affect any plant system.",
  "lamp test":
    "Temporarily lights annunciator windows so you can confirm the local panel display is working. It does not acknowledge or silence alarms.",
  "master silence":
    "Silences audible alarms across all annunciator windows. It does not acknowledge them or correct their initiating conditions.",
  "master ack":
    "Acknowledges active alarms across all annunciator windows. Active lamps remain illuminated until their sensor condition clears.",
  silence:
    "Silences audible alarms only for the currently displayed page. Use it to reduce noise while diagnosing the active local conditions.",
  ack: "Acknowledges alarms only for the currently displayed page. An acknowledged alarm remains lit while its condition is still present.",
  "bus a breaker":
    "Connects the 30 kW startup transformer. Use it for initial auxiliary power before the turbine-generator is synchronized.",
  "bus b breaker":
    "Connects turbine-generator Bus B. Close it only after synchronization; it supplies extra capacity and enables B pumps.",
  "bus s breaker":
    "Connects Safety Bus S for ECCS, RCIC, CST, and hotwell pumps. Keep its combined load at or below 30 kW.",
  "protection breaker":
    "Enables turbine roll-down protection through RPS Channel B. Keep it closed for normal operation so turbine faults can open the grid breaker.",
  "isolation valve":
    "Opens the RCIC injection flow path. Open it before using the RCIC turbopump valve, then watch reactor level as water is injected.",
  "train a pump":
    "Starts ECCS Train A. Select LPCI for low-pressure injection or RHR for shutdown cooling; both require Safety Bus S.",
  "train b pump":
    "Starts ECCS Train B. It can supplement Train A for low-pressure injection or shutdown cooling when Safety Bus S is available.",
  lpci: "Selects low-pressure coolant injection for this ECCS train. It injects only below 3500 kPa and makes ADS arming possible.",
  rhr: "Selects residual heat removal for this ECCS train. Use only after shutdown to cool the reactor without adding emergency injection flow.",
  "recirc pump a":
    "Starts Recirculation Pump A. Raise its speed gradually after stable rod conditions to increase core flow and APRM.",
  "recirc pump b":
    "Starts Recirculation Pump B. Use it with Pump A for higher core flow while monitoring period and recirculation imbalance alarms.",
  "rod drive":
    "Selects rods as Auto APRM's actuator. The controller pulses only rods that are permitted by the current mode and group block.",
  recirculation:
    "Selects recirculation as Auto APRM's actuator. It adjusts pump flow rather than rod position, so use it after startup when flow control is available.",
  "engage auto":
    "Engages Auto APRM with the selected target, speed, and actuator mode. It will pause automatically if a limit, block, or unsafe condition is reached.",
  "auto engaged":
    "Disengages Auto APRM and returns control to the operator. Use it before deliberately making a manual rod or recirculation maneuver.",
  slow: "Uses the slow response profile for manual rod and Auto APRM movement. Choose it for fine adjustment near a target.",
  medium:
    "Uses the medium response profile for normal manual rod and Auto APRM movement.",
  fast: "Uses the fast response profile for larger corrections. Monitor APRM and reactor period carefully because the response is more aggressive.",
  "open close-up synchronoscope":
    "Opens the detailed phase display. Use it to verify small phase difference and near-synchronous RPM before closing the grid breaker.",
  "open grid breaker":
    "Disconnects the generator from the grid. Use to unload or isolate the turbine-generator before a planned stop or abnormal condition.",
  "close grid breaker":
    "Connects the generator to the grid. It is permitted only when exciter, phase, and speed synchronization conditions are satisfied.",
  "reactor temperature":
    "Directly overrides simulated reactor temperature. Use for controlled testing only; high values can trigger thermal protection and change steam production.",
  "rpv pressure":
    "Directly overrides reactor pressure. Use for testing ECCS, SRVs, and turbine response; normal operation should control pressure through steam flow.",
  "reactor level":
    "Directly changes reactor vessel level. Use only for controlled tests because it can activate low/high level protection and ECCS logic.",
  "hotwell level":
    "Directly changes hotwell inventory for testing. In normal operation, correct it with condensate flow, MCC Auto, or makeup/drain pumps.",
  "da level":
    "Directly changes deaerator level for Full-mode testing. Normally the DA level follows the difference between hotwell and feedwater flows.",
  "condenser pressure":
    "Directly overrides condenser pressure. Use to test vacuum alarms or turbine efficiency; normal operation should use circulation, CARs, and the vacuum valve.",
  "all rods withdrawn":
    "Sets all rods to the chosen withdrawal percentage. This bypasses the normal SRM/IPR group programme and is intended only for test setup.",
  "thermal response":
    "Scales how quickly reactor temperature follows power. Values above 1 speed the thermal transient; use cautiously because trips can occur sooner.",
  "steam production":
    "Scales steam generation from reactor thermal output. Increasing it raises steam flow, pressure response, and MCC flow demand.",
  "steam removal":
    "Scales steam removal from the reactor model. Increasing it makes pressure fall more readily for the same steam path configuration.",
  "auto-scram temperature":
    "Sets the automatic core-temperature protection threshold. Keep it high enough for normal operation but low enough to catch unsafe heat-up during testing.",
  "+1 m reactor level":
    "Injects a one-metre reactor-level test step. Use to verify high-level indications, not as a substitute for feedwater control.",
  "−1 m reactor level":
    "Removes one metre of reactor-level test inventory. Use to test low-level response, ECCS availability, and ADS logic.",
  "+1,000 kpa pressure":
    "Adds a 1,000 kPa pressure test step. Use to test turbine pressure control and SRV/RPS responses.",
  "−1,000 kpa pressure":
    "Removes a 1,000 kPa pressure test step. Use to test low-pressure logic without changing steam valves.",
  "trigger scram":
    "Injects a simulated SCRAM from the console. It inserts rods and stops recirculation when the control room processes the command.",
  "reset trip nodes":
    "Clears resettable RPS trip indications after their causes have cleared. It does not bypass a still-active trip condition.",
  aux: "Selects the normal auxiliary motor-driven pump. Use AUX during turbine run-up before shaft-driven oil/hydraulic pressure is available.",
  emerg:
    "Selects emergency Safety Bus S pump power. Use only when normal auxiliary or shaft pressure is unavailable and Safety Bus S is energized.",
  shaft:
    "Uses shaft-driven pump pressure, available only above roughly 1800 RPM. Select after run-up to avoid relying on auxiliary pumps.",
  off: "Removes the selected auxiliary pump command. For lube/hydraulic pumps this becomes shaft-driven only after sufficient RPM; otherwise pressure is lost.",
  "irm range selector":
    "Momentary range selector for the Intermediate Range Monitor. Tap + or − to change displayed R1–R8 range; it returns automatically and never changes rod position or APRM.",
  "pump a speed":
    "Sets Recirculation Pump A command. Higher flow adds core-flow APRM and electrical load; make small changes and monitor the period and cavitation annunciator.",
  "pump b speed":
    "Sets Recirculation Pump B command. It operates independently of Pump A and requires its available electrical source; keep the two flows reasonably balanced.",
  "mcc circulation pump":
    "Enables physical inventory transfer around the steam–hotwell–DA–reactor circuit. With it off, normal vessel levels remain still except for makeup, drain, RCIC, or LPCI.",
  "mcc auto":
    "Lets MCC Auto command condensate and feedwater percentages from actual flow mismatch and vessel-level error. It overrides released manual slider positions; it does not alter water levels directly.",
  "condensate pump a":
    "Makes Condensate Pump A available to move hotwell inventory toward DA. Set its flow on MCC and match it to steam output to hold hotwell level.",
  "condensate pump b":
    "Makes Condensate Pump B available on Bus B. Use it when A cannot meet hotwell demand or when increasing plant load.",
  "feedwater pump a":
    "Makes Feedwater Pump A available to return DA inventory to the reactor. Its MCC flow should normally follow hotwell outflow.",
  "feedwater pump b":
    "Makes Feedwater Pump B available on Bus B. A feedwater-demand annunciator remains active if MCC needs this pump but its bus/breaker is unavailable.",
  "condenser circulation a":
    "Starts Condenser Circulation Pump A. It supplies heat rejection required for deep vacuum and good turbine efficiency.",
  "condenser circulation b":
    "Starts Condenser Circulation Pump B on Bus B. Use it to add condenser capacity at higher steam flow.",
  "condenser auto":
    "Automatically adjusts the condenser vacuum control from current pressure and steam load. It uses one-decimal commands so it should not hunt in microscopic increments.",
  "condenser vacuum control":
    "Sets the condenser vacuum-valve direction. Open gradually after circulation and air removal are running; its effect becomes slower near deep vacuum.",
  "car a":
    "Enables Condenser Air Remover A. CARs pull down initial/offgas pressure while it is above about 850 mbar; they do not provide final deep vacuum.",
  "car b":
    "Enables Condenser Air Remover B. It supplements CAR A during initial evacuation and becomes ineffective below its threshold.",
  "steam jet air ejector":
    "Starts the steam-jet air ejector used with condenser circulation to maintain deep vacuum after CAR operation.",
  "turbine pressure auto":
    "Automatically balances main valve and bypass around 7,100 kPa. It prefers main admission for normal load control and uses bypass for faster correction.",
  "turbine rpm auto":
    "Runs the turbine toward synchronizing speed using main valve and bypass. Near 3,000 RPM it changes more gently and holds the established steam flow unless a large correction is needed.",
  "main steam inlet":
    "Isolates the turbine steam-admission path upstream of the main valve. Keep it closed during initial plant setup and open only when condenser/turbine conditions are ready.",
  "main steam valve":
    "Commands main steam admission to the turbine. Open it to increase turbine steam flow and MW after pressure is available; return to neutral to stop movement.",
  "turbine bypass":
    "Routes main steam around the turbine. Use it for pressure handling during startup, rapid load rejection, and turbine trip—not as normal condenser control.",
  "exciter breaker":
    "Energizes generator field excitation. Excitation must be available before grid synchronization can close.",
  "startup tr. brk":
    "Connects offsite startup-transformer supply toward Bus A. It is the normal pre-turbine power source and is limited to 38 kW outside training levels.",
  "bus a tr. brk":
    "Connects turbine-backed generation to Bus A. With turbine power available it gives Bus A normal operating capacity rather than startup-transformer capacity.",
  "bus b brk":
    "Connects turbine-backed Bus B. Bus B is separate from Bus A and supplies its B-rated pumps; it needs turbine/island generation to remain energized.",
  "bus a → bus s":
    "Feeds Safety Bus S from Bus A. Closing it supplies safety loads but is interlocked against an EDG feeding Bus S.",
  "bus s → dc":
    "Feeds the 125 V DC bus from Safety Bus S. DC availability provides illumination and normal simulator control power.",
  "bus e → dc":
    "Feeds the DC bus from battery-backed Bus E. Use as the essential-control alternative when Safety-to-DC is unavailable.",
  "ac-dc 1 interlock":
    "Connects Safety Bus S to battery-backed Bus E through the LVAC/DC route, keeping essential control and emergency auxiliary circuits charged.",
  "unit interlock brk":
    "Closes the direct Unit-to-Unit Bus A tie. The source unit needs healthy turbine-backed Bus A and closed Bus A transformer breaker; the tie never goes through startup transformer.",
  "edg auto":
    "Maintains a ready EDG selection for remote MCR startup. It does not instantly energize Bus S; the engine must run up and its breakers must be aligned.",
  "ignition breaker (bus e)":
    "Supplies EDG ignition from Bus E. Close it before requesting EDG start; without Bus E the starter control is unavailable.",
  "edg output breaker":
    "Connects the selected EDG alternator output to its main output path. Close before the EDG main breaker after normal start alignment.",
  "edg main breaker → bus s":
    "Connects a running EDG to Safety Bus S. It opens Bus A-to-S automatically to prevent paralleling sources.",
  "main fuel valve":
    "Opens fuel from EDG local storage to the selected fuel path. Keep it open only when supplying or refuelling a generator.",
  "main fuel pump":
    "Pumps local storage fuel to the selected EDG. It is forced off during a 0027 automated storage-tank refuel transfer.",
  "edg-2a fuel valve":
    "Selects local fuel flow to EDG-2A. Open with main fuel valve and pump for running/refuelling that generator.",
  "edg-2b fuel valve":
    "Selects local fuel flow to EDG-2B. Open with main fuel valve and pump for running/refuelling that generator.",
  "fwp aux auto":
    "Automatically keeps available feedwater-pump support equipment prepared. MCC still controls the actual water-flow demand.",
  "pump oil preheat":
    "Warms feedwater-pump oil before sustained demand. It improves readiness but does not itself power or start a pump.",
  "da auto":
    "Balances DA intake and outtake commands to keep DA pressure/temperature in band. It affects DA air handling only, never MCC water-flow demand directly.",
  "da intake valve":
    "Changes DA heating-air admission. More opening raises intake flow and DA temperature; maximum intake flow is 10 kg/s.",
  "da outtake valve":
    "Changes DA exhaust-air flow. More opening lowers DA pressure; maximum outtake flow is 20 kg/s.",
  "da air bypass valve":
    "Bypasses the DA air outlet for rupture-disk maintenance. Open this FIRST before closing the DA main air valve.",
  "da main air valve":
    "Normal DA air-outlet path. Close it only after DA air bypass is open for rupture-disk work.",
  "cix bypass":
    "Routes condensate around the chosen polisher for regeneration. Bypass and stop the target train before starting any flush.",
  "polisher train a":
    "Places Polisher A in service to clean condensate. Stop it and align CIX bypass before regenerating its resin.",
  "polisher train b":
    "Places Polisher B in service to clean condensate. It is the alternate train during Polisher A regeneration.",
  "cix auto":
    "Maintains normal polisher selection automatically where possible. Disable/override only when lining up a deliberate regeneration procedure.",
  "turning gear":
    "Slow-rolls the turbine at roughly 50 RPM for even preheating. Disengage it before run-up or the turbine may trip.",
  "preheat valve":
    "Admits heat for turbine prewarming while turning gear is engaged. Raise gradually; turbine metal preheat is limited to 280 °C.",
  "lubrication pump":
    "Selects the lube-oil pressure source. Use AUX for run-up, SHAFT after speed supports it, or EMERG from Safety Bus as a backup.",
  "hydraulic pump":
    "Selects turbine hydraulic-pressure source. Keep one reliable source at all times so admission controls remain available.",
  "sealing steam supply":
    "Provides sealing steam to turbine glands. Keep it available during turbine operation to protect the steam-seal boundary.",
  "sealing steam leak":
    "Simulates/indicates steam-seal leakage. It is separate from supply; investigate a persistent leak rather than treating it as a normal supply command.",
  malfunctions:
    "Permits random plant malfunctions to occur during play. It does not select or immediately fail a specific component.",
  "random events":
    "Permits low-probability events at network-demand changes, including an offsite-power warning and eventual LOOP when it occurs.",
  "instant startup":
    "Test shortcut that places the core in a post-startup ready condition. It does not line up turbine, MCC, condenser, or electrical systems for you.",
  "normal stop":
    "Requests a controlled reactor stop. Use for planned shutdown; establish RHR/decay-heat cooling afterward as conditions require.",
  "start reactor":
    "Sets the reactor available to begin a normal rod startup when protection nodes are clear. Actual reactivity is still controlled on the Control Rods page.",
  // Reactor Archive — Naramo Plant
  "authorize ignition": "Arms the Naramo reactor ignition circuit. Complete the grid lineup and establish cooling before authorizing ignition.",
  "shutdown pumps": "Keeps the shutdown cooling pumps running while the unit is parked. Turn them off before the normal startup sequence; they are not the main operating coolant pumps.",
  "ignite reactor": "Starts heat generation only after ignition is authorized and normal shutdown-pump lineup is cleared. Rod insertion, coolant, and feedwater still determine whether the core remains stable.",
  "main coolant": "Enables the Naramo main coolant header. Both individual coolant-pump switches also need an energized bus before reactor heat can be removed.",
  "coolant pump 1": "Starts the Primary-bus Naramo coolant pump. Use with Pump 2 to meet the normal reactor cooling requirement.",
  "coolant pump 2": "Starts the Auxiliary-bus Naramo coolant pump. Both coolant pumps and the Main Coolant header are required for normal operation.",
  "feedwater valve": "Opens the common feedwater path. It must be open along with both feedwater pumps before steam production can be controlled safely.",
  "feedwater pump 1": "Starts the Primary-bus feedwater pump. Keep its utilization below the cavitation limit while matching reactor steam demand.",
  "feedwater pump 2": "Starts the Auxiliary-bus feedwater pump. Run it with Pump 1 for the required operating feedwater capacity.",
  "external grid / transformers": "Connects the external Naramo supply into the selected grid configuration. It is the normal startup source before turbine generation is synchronized.",
  "grid configuration": "Selects the Naramo electrical routing. Configurations decide which sources feed Primary, Auxiliary, and DC buses; configuration 5 controls the DC tie.",
  "generator start": "Starts an available Naramo auxiliary generator. Generators consume the common fuel inventory and support configurations that use auxiliary generation.",
  "dc tie": "Connects the selected Naramo DC route. DC is needed for the station’s controls and instrumentation.",
  "scram": "Immediately inserts the aggregate rod bank, cuts reactor heat generation, and opens protective steam relief as required. Reset only after temperature and pressure are safe.",
  "refueler lock": "Locks the refuelling crane at its current location and disables Driving Mode. A locked crane is required before selecting a slot and swapping a rod.",
  "driving mode": "Releases the refuelling crane for movement. It cannot be used while Refueler Lock is engaged.",
  "rod swap": "Transfers the rod at the crane position into the selected crane fuel slot, or installs the selected slot’s rod into that position. It works on any reachable position, not only the suggested target.",
  "dump empty rod": "Moves the crane’s selected empty rod to the empty-rod pool. Drive to the pool, lock the crane, select the slot, then perform the swap.",
  "load full rod": "Loads a fresh rod from the full-rod pool into a selected empty crane slot. The crane must be at the full pool and locked.",
  "hazard pay": "Corporate policy toggle that raises rewards while the plant is near meltdown temperature; it does not change reactor physics.",
  "stability bonus": "Corporate policy toggle that rewards sustained stable operation. It is an incentives setting, not an automatic control system.",
  "safety first": "Corporate policy toggle that emphasizes safe operation rewards. It does not override SCRAM or protective interlocks.",

  // Reactor Archive — A Core Game
  "startup primer": "Charges the PRC startup sequence. The containment field cannot be established until this primer is on.",
  "containment field": "Establishes the plasma containment field after the startup primer. Primary ignition remains blocked until the field is established.",
  "primary ignition": "Starts the plasma reaction after containment is established. Immediately monitor temperature, laser output, and coolant flow.",
  "primary power lasers": "Sets the main laser heating level. Higher settings create more plasma heat and demand more cooling.",
  "secondary power lasers": "Sets supplemental laser heating. Use it to trim output after the primary laser level is stable.",
  "stabilization lasers": "Sets the stabilizer-laser level, improving the effectiveness of coolant removal and reducing temperature excursions.",
  "intake fan": "Raises intake-air speed for PRC heat removal. Combine with exhaust flow; either fan alone provides limited cooling.",
  "exhaust fan": "Raises exhaust-air speed for PRC heat removal. Balance it with intake and liquid coolant to maintain the stable band.",
  "coolant flow to core": "Opens the coolant path from the pool to the PRC. Pump output is ineffective until this path is enabled.",
  "pool valve a": "Opens one pool makeup valve. Both makeup valves refill the coolant pool while pumps consume inventory.",
  "pool valve b": "Opens the second pool makeup valve. Keep at least one valve available when high pump flow is draining the pool.",
  "e-valve 1": "Controls one E-coolant isolation valve. All three E-valves must be closed before emergency coolant can discharge.",
  "e-valve 2": "Controls one E-coolant isolation valve. All three E-valves must be closed before emergency coolant can discharge.",
  "e-valve 3": "Controls one E-coolant isolation valve. All three E-valves must be closed before emergency coolant can discharge.",
  "discharge e-coolant": "Discharges the E-coolant reserve for a short emergency cooling burst. It requires closed E-valves and at least 20% storage.",
  "authorize shutdown": "Arms the Emergency Manual Termination System after its three termination keys and all six emergency buttons are set.",
  "engage emts": "Executes PRC emergency termination. It rapidly removes heat but is only available after the full manual shutdown sequence is complete.",

  // Reactor Archive — Innovation Inc. Thermal Power Plant
  "enable facility power": "Energizes the IITPP training facility bus. All coolant, alignment, and startup controls remain unavailable until this supply is online.",
  "facility power online": "De-energizes or confirms the IITPP facility supply. Do not remove it while reactor support equipment is running.",
  "arm startup primer": "Arms IITPP’s startup sequence after facility power is established. Coolant and core-alignment permissives must still be completed.",
  "startup primer ready": "Returns the IITPP startup primer to standby. Doing so removes a required startup permissive.",
  "stabilizer": "Aligns the IITPP stabilizer before core ignition. It is one of the required core-alignment permissives.",
  "crystal": "Raises the IITPP crystal into its operating position. It is required for a successful controlled startup.",
  "ring": "Energizes the IITPP containment ring. Keep it online before starting the Geo-Thermonuclear Core.",
  "start geo-thermonuclear core": "Starts the IITPP core only after facility power, primer, coolant, stabilizer, crystal, ring, and laser alignment are ready.",
  "controlled shutdown": "Performs a normal IITPP reactor shutdown. Use it before taking support systems offline.",
  "activate safeguard": "Starts the IITPP safeguard response during a high-temperature event. It is available only when the reactor is online and temperatures are in the danger band.",
  "safeguard active": "Returns the IITPP safeguard control to standby. Do not deactivate it while the core still requires active protection.",
  "simulate generator fire": "Starts the IITPP generator-fire training event and its matching announcement. It is a test scenario, not normal generator operation.",
  "fire suppression active": "Clears the simulated IITPP generator-fire condition after the fire-suppression response has been activated.",
  "test code red pa": "Plays the IITPP Code Red announcement without changing the underlying reactor state.",
  "startup success": "Loads the IITPP startup-success training event and its matching announcement caption.",
  freezedown: "Loads the IITPP cold-ending training event and its matching announcement caption.",
  safeguard: "Loads the IITPP near-meltdown safeguard training event and its matching announcement caption.",
  meltdown: "Loads the IITPP meltdown training event and its matching announcement caption. This is a test trigger, not a reactor control.",
  "generator fire": "Loads the IITPP generator-fire training event and its matching announcement caption.",
  "acknowledge caption": "Stops the currently displayed IITPP ASAS caption and any local fallback speech playback.",
  "enable asas audio": "Enables browser audio for IITPP’s local ASAS announcement fallback. A user gesture is required by browser autoplay rules.",
  "pa audio enabled — test event to hear": "Disables or confirms the IITPP local ASAS announcement audio. Test an event to hear the fallback voice.",
  "open official asas player": "Opens the supplied official IITPP announcement playlist in an embedded player; playback is controlled by YouTube.",
  "open soundtrack player": "Opens the supplied official IITPP soundtrack playlist in an embedded player; playback is controlled by YouTube.",

  // Reactor Archive — QSERF DMR and Foxtrot-9
  "insert / turn key": "Inserts and turns the DMR ignition key. It authorizes startup only when fuel cells are locked, catalyzer feed is latched, and the selected grid is available.",
  "start dark matter reactor": "Begins the DMR startup sequence after all startup interlocks are satisfied. It does not bypass fuel, grid, or catalyzer-feed checks.",
  "enter maintenance mode": "Places the DMR in maintenance mode while it is offline, allowing fuel-cell service and non-operating lineup changes.",
  "exit maintenance mode": "Returns the DMR from maintenance mode to normal startup readiness after fuel-cell servicing is complete.",
  "enable catalyzer feed (6 pumps required)": "Latches catalyzer feed online once all six Pump Station Alpha trains are running. This action cannot be undone during the operating cycle.",
  "catalyzer feed online — latched": "Catalyzer feed is permanently latched for the current DMR cycle. The six pump trains are intentionally locked in their running state.",
  "global mode": "Makes one catalyzer-level command apply to all DMR catalyzers together. Use for broad power changes.",
  "fine mode": "Enables individual catalyzer adjustment. Use it to balance heat distribution after the overall reactor level is established.",
  "activate efss": "Starts the Emergency Fire Suppression System, rapidly cooling the DMR while consuming the EFSS water inventory.",
  "efss active": "Stops or starts the EFSS water discharge. Preserve water until an abnormal temperature rise requires emergency cooling.",
  "acknowledge": "Acknowledges currently active DMR alarms. It stops their visual unacknowledged state but does not clear the underlying condition.",
  "mute alarms": "Mutes warning and emergency FAAS alarm audio only. It does not acknowledge alarms or stop normal FAAS traffic.",
  "unmute alarms": "Restores warning and emergency FAAS alarm audio. Alarm acknowledgement remains separate.",
  "music on": "Enables optional QSERF background music. It does not automatically resume a previous event track.",
  "music off": "Disables optional QSERF background music without affecting FAAS announcements or alarms.",
  "foxtrot 9 control rod insertion command": "Commands Foxtrot-9 rod insertion. The drive moves first and neutron flux, heat, and pressure follow gradually rather than changing instantly.",
  "withdraw": "Withdraws Foxtrot-9 control rods, lowering insertion and increasing neutron flux, heat, pressure, and converter output.",
  "insert": "Inserts Foxtrot-9 control rods, reducing neutron flux and thermal output. Use it to arrest a rising temperature or prepare for shutdown.",
  "cont. transit": "Keeps the Foxtrot-9 rod drive moving after a command. Disable it for small, measured positioning changes.",
  "sync to aux grid": "Closes the Foxtrot-9 auxiliary-grid breaker only when all four converter pistons are connected and the synchronoscope is in range.",
  "scram f-9": "Immediately inserts Foxtrot-9 rods, opens all relief valves, and disconnects the auxiliary-grid breaker.",
  "reset scram": "Releases the Foxtrot-9 SCRAM only after temperature and pressure have returned below the reset interlocks.",

  // Reactor Archive — Apollo CRC and TNER
  "main battery grid connect": "Connects the charged Apollo main battery to the facility bus as a temporary source before the emergency generators are synchronized.",
  "battery charge": "Enables battery charging from Sector Master Power. It has no effect until a valid facility source is online.",
  "fill all edg tanks": "Fills the three initially empty Apollo emergency-generator tanks for this training sequence.",
  "crc control": "Starts the Central Reactor Core after the coolant check and ignition-key checks pass. Its conductors then discharge on the timed central buildup cycle.",
  "prime array": "Arms the CRC conductor array for automatic 8,500 V central buildup and the next sequential conductor discharge.",
  "mass driver access": "At 300 kV, opens the conductor safety panels and forces every selectable conductor discharge to 8,000 V.",
  "control room purge": "At 500 kV, executes the simultaneous conductor purge only after all four Mass Driver Brakes are lowered and conductor purges are primed.",
  "tner generator on": "Connects the started TNER mini generator to its sector. The starter must have been pulled exactly three times first.",
  "supercharger enable": "Starts all eight TNER supercharger flywheels, increasing output voltage and heat.",
  "f.e.s. enable": "Enables TNER Fuel Enrichment System. It reduces fuel consumption but is part of the overload prerequisite set.",
  "radiator clamps": "Raises and locks all four TNER radiators onto the magnetic generators, enabling reactor cooling.",
  "fuse hatch closed": "Closes and locks the TNER fuse hatch. The Reactor Driver cannot complete startup while the hatch is open.",
  "reactor driver": "Deploys the TNER Reactor Driver cylinder after the startup or shutdown code has been accepted.",
  "driver breaker": "Closes the non-electrical Reactor Driver permissive. Loaded, locked fuel and a closed fuse hatch are required.",
  "pull driver switch": "Completes the normal TNER startup cylinder protocol and starts TNER when every permissive is satisfied.",
  "unstable mode": "Arms TNER unstable mode only after the overload prerequisites are met. It is an intentional destructive-test control.",
  "overload": "Deploys the overload Reactor Driver cylinder. Overload does not start until its keycard, breaker, and pull-switch sequence completes.",
};
const controlGuidance = (label: string, fallback: string) => {
  const key = label.toLowerCase().replace(/\s+/g, " ");
  if (specificGuidance[key]) return specificGuidance[key];
  // Directional positions are generated by the reusable hardware controls as
  // "CONTROL NAME: OPEN/CLOSE". Resolve only that exact parent control rather
  // than using substring matching, which previously confused unrelated fast
  // close buttons.
  const parentKey = key.split(":")[0].trim();
  if (parentKey !== key && specificGuidance[parentKey])
    return `${specificGuidance[parentKey]} ${fallback}`;
  return fallback ===
    "Use this control to change the associated system setting, then monitor the matching meter or annunciator for its response."
    ? `${label}: operates only the equipment named on this control. Read the current page manual before using an unfamiliar control; monitor its matching meter, status lamp, and annunciator for the physical response.`
    : `${label}: ${fallback}`;
};
const ControlTooltips = () => {
  const [tooltip, setTooltip] = useState<{
    title: string;
    description: string;
    x: number;
    y: number;
    below: boolean;
  } | null>(null);
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem("unit2-tooltips-enabled") !== "false",
  );
  const keyboardFocus = useRef(false);
  const hoveredControl = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onToggle = (event: Event) => {
      const next = (event as CustomEvent<{ enabled?: boolean }>).detail
        ?.enabled;
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
      const label =
        control.getAttribute("aria-label") ||
        control.textContent?.replace(/\s+/g, " ").trim() ||
        (control instanceof HTMLInputElement ? control.placeholder : "");
      if (label) control.dataset.tooltipTitle ||= label;
      const defaultTitle =
        control.dataset.tooltipBaseTitle ||
        control.dataset.tooltipTitle ||
        label ||
        "Control";
      control.dataset.tooltipBaseTitle ||= defaultTitle;
      const defaultDescription =
        control.dataset.tooltipBaseDescription ||
        control.dataset.tooltipDescription ||
        "Use this control to change the associated system setting, then monitor the matching meter or annunciator for its response.";
      control.dataset.tooltipBaseDescription ||= defaultDescription;
      const override = tooltipOverrides()[tooltipKey(defaultTitle)];
      control.dataset.tooltipTitle = override?.title || defaultTitle;
      control.dataset.tooltipDescription =
        override?.description ||
        controlGuidance(defaultTitle, defaultDescription);
    };
    const annotate = (root: ParentNode = document) => {
      if (root instanceof HTMLElement && root.matches(selector))
        annotateOne(root);
      root.querySelectorAll<HTMLElement>(selector).forEach(annotateOne);
    };
    const show = (control: HTMLElement) => {
      if (!enabled) return;
      annotateOne(control);
      const rect = control.getBoundingClientRect();
      setTooltip({
        title: control.dataset.tooltipTitle || "Control",
        description:
          control.dataset.tooltipDescription ||
          "Select to operate this control.",
        x: Math.min(
          Math.max(rect.left + rect.width / 2, 144),
          window.innerWidth - 144,
        ),
        y: rect.top,
        below: rect.top < 96,
      });
    };
    const controlFor = (target: EventTarget | null) => {
      const control =
        target instanceof Element
          ? target.closest<HTMLElement>(selector)
          : null;
      // The dense A1–F6 core map is a selection surface, not a set of 36
      // independent documented controls. Suppress its popups entirely.
      if (
        control?.matches("button") &&
        /^[A-F][1-6]$/.test(control.textContent?.trim() || "")
      )
        return null;
      return control;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!enabled || event.pointerType !== "mouse" || event.buttons !== 0)
        return;
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
      changes.forEach((change) =>
        change.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) annotate(node);
        }),
      );
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
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed z-[100] w-72 -translate-x-1/2 rounded-lg border border-cyan-300/70 bg-slate-950/95 px-3 py-2 font-mono shadow-[0_8px_30px_rgba(0,0,0,.55)]"
      style={{
        left: tooltip.x,
        top: tooltip.below ? tooltip.y + 14 : tooltip.y - 10,
        transform: `translate(-50%, ${tooltip.below ? "0" : "-100%"})`,
      }}
    >
      <div className="text-xs font-black tracking-wide text-cyan-200">
        {tooltip.title}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-300">
        {tooltip.description}
      </p>
    </div>
  );
};

const SupabaseStatusNotice = () => {
  const [visible, setVisible] = useState(
    () => localStorage.getItem("unit2-supabase-outage-notice") !== "dismissed",
  );
  if (!visible) return null;
  return (
    <div className="sticky top-0 z-[200] border-b border-amber-300/60 bg-amber-950/95 px-4 py-2 font-mono text-xs text-amber-100 shadow-lg backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <p>
          <strong className="text-amber-300">SUPABASE SERVICE DEGRADED.</strong>{" "}
          Online scores and cross-computer plant features may be delayed. For
          uninterrupted one-computer operation, open{" "}
          <a
            className="underline underline-offset-2 hover:text-white"
            href="/supervisor"
          >
            Supervisor Room
          </a>{" "}
          and select <strong>LOCAL / OFFLINE</strong>.
        </p>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem("unit2-supabase-outage-notice", "dismissed");
            setVisible(false);
          }}
          className="rounded border border-amber-300/50 px-2 py-1 font-bold text-amber-100 hover:bg-amber-400 hover:text-slate-950"
        >
          DISMISS
        </button>
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ControlTooltips />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SupabaseStatusNotice />
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/archive" element={<ReactorArchive />} />
            <Route path="/a-core-game" element={<ACoreGame />} />
            <Route path="/apollo/*" element={<ApolloFacility />} />
            <Route path="/iitpp" element={<IitppPlant />} />
            <Route path="/qserf" element={<QserfPlant />} />
            <Route path="/qserf/foxtrot-9" element={<Foxtrot9 />} />
            <Route path="/reactor" element={<ReactorSimulator />} />
            <Route path="/naramo" element={<NaramoPlant />} />
            <Route path="/mainframe" element={<Mainframe />} />
            <Route path="/supervisor" element={<Supervisor />} />
            <Route path="/status-desk" element={<StatusDesk />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
export default App;
