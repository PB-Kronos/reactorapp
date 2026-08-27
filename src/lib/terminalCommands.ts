/**
 * Public terminal customisation point.
 *
 * Add a key/value here to create a text-only command in the greeting terminal.
 * Keys are matched case-insensitively. Commands with actions (reactor, console,
 * google, etc.) remain in the page because they navigate or alter simulator state.
 */
export const V23_CHANGELOG = "V2.3 — MULTI-UNIT OPERATIONS\n• Supervisor Room: shared Unit 1 / Unit 2 rooms, live demand allocation, invitation links, and optional electrical interlock.\n• Electrical: bus routing, live availability, machine monitors, shared turbine capacity, and protection annunciators.\n• Status Desk: a personal third monitoring window with movable, resizable live fields and import/exportable layouts.";
export const MULTIUNIT_MANUAL = "MULTI-UNIT OPERATIONS MANUAL — V2.3\n\nCreate a plant room in SUPERVISOR, then issue one station link for Unit 1 and one for Unit 2. Units keep independent reactor controls; only demand, interlock status, and shared scoring are coordinated.\n\nWith Demand Manager online, split the announced site MW target between the units during its 200–60 second allocation window. Site demand must be within ±50 MW and each unit within ±30 MW to earn points.\n\nUnit Interlock is separate: the source must have energized turbine-backed Bus A and its Bus A breaker closed. Configure source/target and close the target tie breaker to feed target Bus A directly.\n\nA LOOP removes offsite power and trips/unsynchronizes the turbine, not the reactor. Use islanding or interlock only after checking the electrical source is healthy.";

export const GREETING_TERMINAL_RESPONSES: Record<string, string> = {
  version: "UNIT 2: THE BWR SIM — V2.3\nBuild: public control-room sandbox",
  credits: "Unit 2: The BWR Sim — community-built control-room sandbox.",
  changelog: V23_CHANGELOG,
  multiunit: MULTIUNIT_MANUAL,
};

/** Add simple read-only responses for the /mainframe terminal here. */
export const MAINFRAME_TERMINAL_RESPONSES: Record<string, string> = {
  about:
    "Unit 2 advanced console. Commands update the shared browser simulator session.",
  changelog: V23_CHANGELOG,
  multiunit: MULTIUNIT_MANUAL,
};

export const GREETING_HELP =
  "START HERE: HELP START · HELP OPERATIONS · HELP MULTIUNIT\nACCESS: login <yourname> · logout · reactor (guest allowed) · console · supervisor\nCOMMANDS: status · leaderboard · version · changelog · multiunit\nNAVIGATION: url <address> · google <https://url> · github · contact [discord]\nTERMINAL: time · date · whoami · uptime · echo <text> · fortune · clear\nGuest entry is allowed, but LOGIN <yourname> is recommended to record points and leaderboard position.";
export const MAINFRAME_HELP =
  "STATUS|VALUES · GET <value> · REACTOR · HOME · CLEAR · SCRAM\n<value> SET <number> · <switch> ON|OFF · START|STOP · MODE SET SD|SRM|IPR|RUN\nVALUES: REACTOR.TEMP|PRESSURE|LEVEL · HOTWELL.LEVEL · DA.LEVEL|TEMP|PRESSURE · CST.LEVEL\nCONDENSER.PRESSURE|VALVE · CONDENSATE.A|B · FEEDWATER.A|B · RECIRC.A|B\nTURBINE.MAINVALVE|BYPASS · AUTO.APRM · PHYSICS.THERMAL|STEAM|REMOVAL|TRIPTEMP\nSWITCHES: MCC.AUTO|PUMP · CONDENSER.AUTO|PUMP.A|PUMP.B|CIRCULATION.A|CIRCULATION.B · RECIRC.PUMP.A|B\nTURBINE.RPMAUTO|PRESSUREAUTO|INLET · ELECTRICAL.BUSA|BUSATRANSFORMER|BUSB|BUSS · RCIC.VALVE · ECCS.A|B · ADS\nCommands entered here queue into the live Control Room session when opened.";
