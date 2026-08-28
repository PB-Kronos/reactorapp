/**
 * Public terminal customisation point.
 *
 * Add a key/value here to create a text-only command in the greeting terminal.
 * Keys are matched case-insensitively. Commands with actions (reactor, console,
 * google, etc.) remain in the page because they navigate or alter simulator state.
 */
export const V232_CHANGELOG = "V2.3.2 — LOCAL PLANT OPERATIONS\n• Offline local plant: Unit 1, Unit 2, Supervisor, station windows, PMS, private calls, interlock, dispatch, and remote terminal commands now run on one computer without Supabase.\n• Synchronization: MCR is the single physics authority; TCR/MCC and pop-out stations exchange operator controls without fighting pressure, RPM, or water values.\n• Resilience: browser checkpoints and the production app-shell cache keep a previously opened control room usable through a database or internet outage.\n• MCC / recirculation: Hotwell Auto uses a ±0.25 m pump deadband; live recirculation kg/s gauges and the 19% rod-APRM cavitation clearance are corrected.";
export const MULTIUNIT_MANUAL = "MULTI-UNIT OPERATIONS MANUAL — V2.3.2\n\nCreate a plant room in SUPERVISOR, then issue one station link for Unit 1 and one for Unit 2. Units keep independent reactor controls; only demand, interlock status, and shared scoring are coordinated.\n\nFor one-computer operation, select LOCAL / OFFLINE in the Supervisor Room before creating station links. The browser becomes the local plant transport; all windows must use the same browser profile and origin.\n\nWith Demand Manager online, split the announced site MW target between the units during its 200–60 second allocation window. Site demand must be within ±50 MW and each unit within ±30 MW to earn points.\n\nUnit Interlock is separate: the source must have energized turbine-backed Bus A and its Bus A breaker closed. Configure source/target and close the target tie breaker to feed target Bus A directly.\n\nA LOOP removes offsite power and trips/unsynchronizes the turbine, not the reactor. Use islanding or interlock only after checking the electrical source is healthy.";

export const GREETING_TERMINAL_RESPONSES: Record<string, string> = {
  version: "UNIT 2: THE BWR SIM — V2.3.2\nBuild: local-first control-room sandbox",
  credits: "Unit 2: The BWR Sim — community-built control-room sandbox.",
  changelog: V232_CHANGELOG,
  multiunit: MULTIUNIT_MANUAL,
};

/** Add simple read-only responses for the /mainframe terminal here. */
export const MAINFRAME_TERMINAL_RESPONSES: Record<string, string> = {
  about:
    "Unit 2 advanced console. Commands update the shared browser simulator session.",
  changelog: V232_CHANGELOG,
  multiunit: MULTIUNIT_MANUAL,
};

export const GREETING_HELP =
  "START HERE: HELP START · HELP OPERATIONS · HELP MULTIUNIT\nACCESS: login <yourname> · logout · reactor (guest allowed) · console · supervisor\nCOMMANDS: status · leaderboard · version · changelog · multiunit\nNAVIGATION: url <address> · google <https://url> · github · discord · contact [discord]\nTERMINAL: time · date · whoami · uptime · echo <text> · fortune · clear\nGuest entry is allowed, but LOGIN <yourname> is recommended to record points and leaderboard position.";
export const MAINFRAME_HELP =
  "STATUS|VALUES · GET <value> · REACTOR · HOME · CLEAR · SCRAM\n<value> SET <number> · <switch> ON|OFF · START|STOP · MODE SET SD|SRM|IPR|RUN\nVALUES: REACTOR.TEMP|PRESSURE|LEVEL · HOTWELL.LEVEL · DA.LEVEL|TEMP|PRESSURE · CST.LEVEL\nCONDENSER.PRESSURE|VALVE · CONDENSATE.A|B · FEEDWATER.A|B · RECIRC.A|B\nTURBINE.MAINVALVE|BYPASS · AUTO.APRM · PHYSICS.THERMAL|STEAM|REMOVAL|TRIPTEMP\nSWITCHES: MCC.AUTO|PUMP · CONDENSER.AUTO|PUMP.A|PUMP.B|CIRCULATION.A|CIRCULATION.B · RECIRC.PUMP.A|B\nTURBINE.RPMAUTO|PRESSUREAUTO|INLET · ELECTRICAL.BUSA|BUSATRANSFORMER|BUSB|BUSS · RCIC.VALVE · ECCS.A|B · ADS\nCommands entered here queue into the live Control Room session when opened.";
