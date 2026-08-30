import type { ReactNode } from "react";
import { BookOpen, CircleAlert, Gauge, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Guide = { title: string; subtitle: string; purpose: string; before: string[]; steps: string[]; targets: string[]; response: string; caution: string };

// These are intentionally simulator-specific operating cards. RBWR's guide-board
// format inspired the presentation, but values below follow Unit 2's own model.
const guides: Record<string, Guide> = {
  status: {
    title: "Unit 2 operator overview", subtitle: "Plant summary and handover panel",
    purpose: "Use this panel at the start of every evolution and at handover. It summarizes the plant; it never replaces the owning station's controls.",
    before: ["DC Bus energized for lit controls and annunciators.", "Read every red annunciator before changing a major system."],
    steps: ["Read APRM, reactor level, pressure, temperature, turbine MW and electrical source together.", "On MCC, compare steam, hotwell and feedwater flow before correcting a water level.", "At handover, state active automatic systems, grid state and every abnormal indication."],
    targets: ["Reactor level near 0.00 m", "Main steam pressure near 7,100 kPa", "Condenser pressure 40–70 mbar; best efficiency near 52 mbar", "Reactor period above 20 s"],
    response: "One moving meter can be normal. A trend continuing after its control returns to neutral needs investigation at its owner panel.",
    caution: "A nominal overview is not a turbine, MCC or RPS readiness check.",
  },
  "control-rods": {
    title: "Control rods, SRM and IRM", subtitle: "Reactivity control and realistic startup",
    purpose: "Control rods immediately change reactivity, while flux, IRM and APRM rise and settle gradually. The monitor reports power; it does not create power.",
    before: ["No uncleared reactor protection node.", "Correct selected rod/group, mode and permitted sequence shown.", "Use recirculation after the rod contribution is established; low rod APRM can cavitate it."],
    steps: ["In SRM, withdraw only the next programmed rod/group to the initial 5% withdrawal block. Rod movement remains available; its physics effect is delayed.", "After SRM completion, select IRM. The momentary range selector changes R1–R8 display scale only, never core reactivity.", "Finish the active programmed withdrawal window. Completion automatically raises the next withdrawal limit by 5%.", "Do not chase early IRM movement. Low-range flux grows slowly before stabilizing; stronger or broader withdrawal shortens that transient.", "After the final startup window and about 10% APRM, select RUN. Startup blinking and block buzzers are disabled in RUN.", "Auto APRM moves the same permitted rods or recirculation controls as the operator. It never teleports APRM."],
    targets: ["SRM withdrawal limit: 5%", "Completed IRM window: +5% withdrawal authority", "R1–R8 50% references: 0.003%, 0.01%, 0.03%, 0.1%, 0.3%, 1%, 3%, 10% APRM", "Stop withdrawal before period approaches 20 s"],
    response: "After a pull, power rises slowly, reaches its intended rate, then settles. Lower-power and smaller pulls settle more gently.",
    caution: "A block buzzer means that movement is prohibited. Do not hold a lever against a block; review mode, selected sequence and current withdrawal limit.",
  },
  mcc: {
    title: "MCC — condensate and feedwater", subtitle: "Three-flow inventory control",
    purpose: "MCC closes the water circuit: reactor steam fills hotwell, hotwell flow supplies DA, and feedwater returns DA inventory to the reactor. Level is accumulated flow difference.",
    before: ["MCC circulation pump on for normal water movement.", "A powered condensate and feedwater pump available; Pump B requires Bus B."],
    steps: ["Read steam outflow, hotwell outflow and DA/feedwater outflow before moving a pump.", "Match condensate flow to steam flow to hold hotwell level.", "Match feedwater flow to hotwell flow to hold DA and reactor inventory.", "Correct one level with small changes. Use CST/hotwell makeup or drain for inventory correction, not as routine flow control.", "MCC Auto owns pump percentages while enabled. A manual slider move is only temporary; the controller restores its computed setting on release."],
    targets: ["All three flows equal: levels hold", "Reactor, hotwell and DA: near their normal bands", "Feedwater pumps: up to 2,000 kg/s each", "Hotwell makeup/drain Auto deadband: ±0.25 m"],
    response: "Hotwell flow above steam lowers hotwell and raises DA. Feedwater above hotwell flow lowers DA and raises reactor level.",
    caution: "If level is running away, first check actual powered pumps and circulation. Do not raise every flow together.",
  },
  condenser: {
    title: "Condenser vacuum", subtitle: "Circulation, air removal and turbine back pressure",
    purpose: "Circulation rejects exhaust heat and vacuum controls condenser pressure. Valve position is not a fixed pressure command: steam load, circulation and air removal all matter.",
    before: ["At least one powered condenser circulation pump.", "Use CARs only above their operating threshold."],
    steps: ["Start circulation before expecting pressure to reduce.", "At startup use CAR A/B to reduce offgas pressure; their useful range ends around 850 mbar.", "Move the condenser control lever in measured steps. Its response slows when approaching deep vacuum.", "Enable Condenser Auto only after healthy circulation/air removal. It commands positions rounded to one decimal place to prevent chatter.", "Keep turbine bypassed or unloaded if vacuum is unacceptable."],
    targets: ["Offgas/startup: about 1 bar", "CAR useful above 850 mbar", "Normal condenser: 40–70 mbar", "Best efficiency: about 52 mbar"],
    response: "Higher steam flow raises condenser load and can worsen back pressure until circulation and air removal catch up.",
    caution: "Do not treat bypass as a vacuum cure. Establish circulation and air removal before loading the turbine.",
  },
  "power-grid": {
    title: "Turbine and generator", subtitle: "Steam admission, run-up, synchronization and load",
    purpose: "Main valve admits steam to the turbine; bypass passes steam around it. MW follows steam flow and condenser performance, not valve position alone.",
    before: ["Condenser vacuum healthy and no turbine protection trip.", "Full operation: turbine readiness indications satisfactory."],
    steps: ["Open main steam inlet. Use bypass and main valve to establish controlled pressure and RPM.", "Auto RPM first establishes useful pressure, then balances main valve and bypass. Near 3,000 RPM it makes smaller hold corrections.", "At 3,000 RPM, exciter on, synchronoscope/phase lamps aligned, and speed within ±5 RPM, close Grid Breaker.", "Once synchronized, grid frequency locks speed. Raise APRM and hold main steam near 7,100 kPa; reserve bypass for rapid correction.", "For a planned stop, open Grid Breaker before unloading. A turbine trip shuts main admission and opens bypass immediately."],
    targets: ["Main steam pressure: 7,100 kPa", "Synchronizing: about 3,000 RPM, within ±5 RPM", "Maximum unit load: about 1,200 MW"],
    response: "Increasing APRM raises available steam and pressure. More main admission raises turbine flow and MW, tending to return pressure toward target.",
    caution: "Never force synchronizing with poor phase/speed match. If Auto RPM oscillates, neutralize controls, stabilize pressure, then re-engage.",
  },
  "turbine-aux": {
    title: "Turbine auxiliaries", subtitle: "Oil, hydraulics, turning gear, preheat and sealing",
    purpose: "These systems protect bearings and turbine internals. TCR owns auxiliaries; MCR owns main steam, excitation and grid connection.",
    before: ["Bus E for emergency pump option and DC Bus for controls.", "Use turbine readiness indication before synchronization."],
    steps: ["Use AUX lube and hydraulic pumps during run-up. Select SHAFT only after shaft speed can maintain pressure; EMERG is the Bus S backup.", "Engage turning gear for approximately 50 RPM, then open preheat gradually. Preheat temperature is limited to 280 °C.", "Disengage turning gear before run-up; leaving it engaged while accelerating can trip the turbine.", "Use cold/warm oil cooling to bring oil into band. Oil temperature is an independent thermal loop, not main-steam temperature.", "Maintain sealing steam supply and monitor sealing leak separately."],
    targets: ["Turning gear: about 50 RPM", "Preheat limit: 280 °C", "Lube oil: 35–65 °C", "One lube and one hydraulic source available"],
    response: "Oil cooling and preheat respond slowly. Allow a trend to develop before reversing a valve.",
    caution: "High speed without lubrication risks smoke/fire. On smoke, trip turbine and use fire-agent controls.",
  },
  electrical: {
    title: "Electrical distribution", subtitle: "AC buses, safety power and battery-backed DC",
    purpose: "Equipment works only with an energized source and enough available capacity. Breaker position is not proof of a powered bus.",
    before: ["Use live bus lamps and kW monitor before closing breakers.", "Bus A and Bus B remain separate except through intended turbine source paths."],
    steps: ["For initial power, close Startup Transformer to energize Bus A. Outside tutorials its limit is 38 kW.", "With turbine-backed power available, close Bus A transformer breaker; Bus B is separate for B pumps.", "Feed Safety Bus S from Bus A or EDG. Those supplies interlock and must not be paralleled.", "Use Safety-to-DC or Bus E-to-DC for DC availability. Bus E battery charges from healthy Safety Bus.", "Watch machine lamps and kW. Reduce load before a bus overload trips."],
    targets: ["Startup transformer: 38 kW", "Turbine Bus A/B: 150 kW shared when both supplied", "Recirculation: 2.5 kW per 100 kg/s", "Hotwell makeup/drain: 0.5 kW each"],
    response: "DC loss darkens the simulator and stops normal controls/annunciators. Bus E loss removes normal control power until essential supply returns.",
    caution: "A power-locked bus means its present connected load would trip it immediately when energized.",
  },
  safety: {
    title: "ECCS, ADS and SRVs", subtitle: "Emergency level response and depressurization",
    purpose: "ECCS restores reactor level. SRVs/ADS remove reactor pressure. These are abnormal-response systems, not normal turbine pressure controllers.",
    before: ["Safety Bus S energized.", "At least one LPCI train selected before ADS arming."],
    steps: ["RCIC: open isolation then meter turbopump valve. It is available at any reactor pressure in this simulator.", "LPCI injects only below 3,500 kPa. Select LPCI or RHR per train; RHR is shutdown cooling.", "For severe low level, arm ADS. It SCRAMs and opens SRVs, then enables selected LPCI as pressure falls.", "Press ADS again only to reset its armed state after conditions are understood.", "Use individual SRVs for controlled pressure reduction."],
    targets: ["LPCI: below 3,500 kPa", "ADS automatic low-level: below −4.50 m", "RCIC: any pressure"],
    response: "SRV flow lowers pressure; once pressure permits, LPCI can inject to restore inventory.",
    caution: "ADS SCRAMs the reactor. It deliberately does not stop MCC circulation.",
  },
  rps: {
    title: "Reactor Protection System", subtitle: "Trip matrix and run-up status",
    purpose: "RPS Channel A protects the core; Channel B monitors turbine protection. A trip node is a cause to diagnose, not simply an indication to reset.",
    before: ["Trip Inhibit OFF for normal operation.", "Roll-down protection enabled during normal turbine operation."],
    steps: ["Find active nodes and correct their initiating condition at the owning panel.", "Use RESET TRIP NODES only after the sensor is clear.", "Use SCRAM for emergency core shutdown: it inserts rods and drops recirculation, but leaves decay heat and water inventory to manage.", "Check turbine readiness lights before run-up/synchronization; they are status conditions, not resettable trip nodes.", "Trip Inhibit is test-only and must be returned OFF immediately."],
    targets: ["All normal-operation trip nodes CLEAR", "Reactor period above 20 s", "Level trip band: below −5 m or above +6 m"],
    response: "Reactor trips insert rods. Turbine protection can open grid/turbine paths depending on roll-down protection.",
    caution: "Trip Inhibit blocks automatic protection; it never replaces correcting a fault.",
  },
  "feedwater-bay": {
    title: "Feedwater Pump Bay", subtitle: "Motor cooling, oil conditioning and pump availability",
    purpose: "This station prepares feedwater pumps. MCC commands flow; FWP Bay makes selected hardware able to meet it.",
    before: ["Correct electrical source available; Pump B needs Bus B."],
    steps: ["Enable motor cooling and oil preheat for pumps needed at the coming load.", "Use Feedwater AUX AUTO for supporting equipment when desired.", "Confirm feedwater-demand annunciation clears once the required pump and bus are available.", "Make process-flow changes from MCC, then correct only local pump support here."],
    targets: ["Each pump up to 2,000 kg/s", "Motor cooling and oil conditioning healthy before sustained load"],
    response: "A prepared powered pump can answer MCC demand; an unavailable pump leaves demand annunciation active.",
    caution: "Cooling controls do not supply power. Check the Electrical panel if a pump cannot become available.",
  },
  polishers: {
    title: "CIX polisher regeneration", subtitle: "Condensate chemistry and timed resin regeneration",
    purpose: "Polishers clean condensate through ion-exchange resin. Regeneration refreshes one bypassed train using an available regeneration tank.",
    before: ["Inform MCR through PMS/telephone when a train will be removed in multiplayer.", "Bypass selected polisher and stop its train.", "Choose a ready regeneration tank."],
    steps: ["Align CIX BYPASS, select target Polisher A/B, and confirm it is stopped.", "Select a READY/GREEN tank.", "Start WATER FLUSH, wait for completion, then AIR FLUSH.", "Start RESIN REFILL. At the confirmation status, continue regeneration.", "This simulator condenses the full procedure into 30 s water + 30 s air + 30 s refill + 60 s regeneration.", "When READY returns, restore the polisher path and notify MCR."],
    targets: ["Tank READY/GREEN before use", "Target train bypassed/stopped before water flush", "Resin capacity restores toward 100%"],
    response: "The progress bar is authoritative. Each stage must finish before the next action becomes available.",
    caution: "Never regenerate an in-service train. Bypass it first so chemistry work does not unintentionally restrict condensate flow.",
  },
  edg: {
    title: "Emergency Diesel Generator Bay", subtitle: "Fuel, readiness, run-up and Safety Bus restoration",
    purpose: "EDGs restore Safety Bus after normal supply loss. U2 has limited-fuel generators; only one generator should supply a unit at a time.",
    before: ["Bus E available for ignition controls.", "Fuel sufficient and output path isolated before start."],
    steps: ["EDG Auto keeps one unit ready; MCR Remote Startup can request a ready unit.", "For manual start: select EDG, close IGNITION, close its output breaker, then request start.", "Allow about 15 seconds to reach 1,800 RPM. Close main breaker to feed Bus S; Bus A-to-S opens automatically.", "Trip selected EDG to stop it and remove output when no longer needed.", "For refueling: main fuel valve open, main fuel pump on, selected fuel valve open. If storage empty, call 0027 and request REFUEL; transfer takes three minutes and locks pump off."],
    targets: ["Usable speed: 1,800 RPM", "Run-up: about 15 s", "One supplying EDG per unit"],
    response: "A running, connected EDG powers Bus S while fuel remains. Bus S load still determines which essential systems return.",
    caution: "EDG output and Bus A-to-S are interlocked; do not parallel their sources.",
  },
  deaerator: {
    title: "Deaerator Hall", subtitle: "Air balance, pressure/temperature and rupture-disk maintenance",
    purpose: "DA intake controls heating-air flow and temperature; outtake controls exhaust. Their flow mismatch changes DA pressure. MCC water flow remains separate.",
    before: ["Read DA pressure, temperature, intake flow and outtake flow before operating.", "For disk work, ensure bypass is available."],
    steps: ["Intake opening increases DA heating/temperature. Its air flow is limited to 10 kg/s and follows MCC demand.", "Outtake controls exhaust, up to 20 kg/s. Match flows for stable pressure.", "Use DA Auto for assisted balance; commands use one decimal precision.", "Hold DA FAST CLOSE only during pressure upset; it closes intake at 10%/s and is a direct-control sound, not an annunciator.", "Rupture disk: FIRST open air bypass, THEN close main air valve; remove disk, replace, restore main valve, then close bypass."],
    targets: ["DA pressure: 1.20–2.00 bar", "DA temperature: 108–113 °C", "Matched air flows: steady pressure"],
    response: "Outtake above intake lowers pressure; intake above outtake raises it. Neither lever directly commands DA water outflow.",
    caution: "The disk is in the DA air outlet, not MCC water path. Follow valve order exactly during replacement.",
  },
  systems: {
    title: "Systems and training tools", subtitle: "Scenarios, calculated limits and random faults",
    purpose: "Use this page for controlled training setup, performance estimates and fault practice—not normal plant operation.",
    before: ["Save/remember the current state before scenario testing.", "Leave Random Events OFF for a predictable run."],
    steps: ["Use APRM-to-MW calculator to estimate required power for present steam/condenser conditions.", "Random Events permits low-probability faults at demand changes; it does not immediately break a selected component.", "Scenarios set a controlled initial state. Recheck MCC, turbine and electrical state before raising load.", "Use CLI/editor for exact live values; terminal and panel share the same simulation."],
    targets: ["Full load about 1,200 MW", "Reactor-ready scenario about 20% APRM", "Automatic systems reduce point score while active"],
    response: "Scenario/editor changes alter state immediately; physics continues from that state rather than replaying a startup.",
    caution: "A scenario can deliberately bypass preparation and is not proof that every system is ready for public multi-user operation.",
  },
};

const Section = ({ title, icon, children, tone = "text-emerald-300" }: { title: string; icon: ReactNode; children: ReactNode; tone?: string }) => <section className="rounded-lg border border-slate-700/80 bg-slate-950/45 p-4"><h3 className={`mb-3 flex items-center gap-2 text-xs font-black tracking-[.15em] ${tone}`}>{icon}{title}</h3>{children}</section>;

export const OperatorManual = ({ page }: { page: string }) => {
  const guide = guides[page] || guides.status;
  return <Dialog><DialogTrigger asChild><Button variant="outline" className="operator-manual-trigger min-h-11 border-cyan-500/70 text-cyan-200 hover:bg-cyan-950"><BookOpen className="h-4 w-4" />PAGE MANUAL</Button></DialogTrigger><DialogContent className="max-h-[88vh] overflow-y-auto border-cyan-500/60 bg-[#07111d] font-mono text-slate-100 sm:max-w-3xl"><DialogHeader className="border-b border-cyan-400/20 pb-4"><p className="text-[10px] font-black tracking-[.24em] text-emerald-300">UNIT 2 OPERATOR GUIDE</p><DialogTitle className="text-xl text-cyan-200">{guide.title}</DialogTitle><DialogDescription className="font-mono text-xs text-slate-400">{guide.subtitle}</DialogDescription><p className="pt-2 text-sm leading-relaxed text-slate-200">{guide.purpose}</p></DialogHeader><div className="grid gap-4 text-sm"><Section title="BEFORE YOU OPERATE" icon={<ListChecks className="h-4 w-4"/>}><ul className="space-y-2 text-slate-200">{guide.before.map(item => <li key={item}>• {item}</li>)}</ul></Section><Section title="OPERATING PROCEDURE" icon={<BookOpen className="h-4 w-4"/>}><ol className="space-y-3 text-slate-100">{guide.steps.map((step, index) => <li key={step} className="flex gap-3"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400 font-black text-slate-950">{index + 1}</span><span className="leading-relaxed">{step}</span></li>)}</ol></Section><div className="grid gap-4 md:grid-cols-2"><Section title="NORMAL TARGETS" icon={<Gauge className="h-4 w-4"/>}><ul className="space-y-2 text-slate-200">{guide.targets.map(item => <li key={item}>• {item}</li>)}</ul></Section><Section title="SIMULATOR RESPONSE" icon={<CircleAlert className="h-4 w-4"/>} tone="text-cyan-200"><p className="leading-relaxed text-slate-200">{guide.response}</p></Section></div><Section title="OPERATOR CAUTION" icon={<CircleAlert className="h-4 w-4"/>} tone="text-amber-300"><p className="leading-relaxed text-amber-100/90">{guide.caution}</p></Section></div></DialogContent></Dialog>;
};
