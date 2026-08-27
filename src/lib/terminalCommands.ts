/**
 * Public terminal customisation point.
 *
 * Add a key/value here to create a text-only command in the greeting terminal.
 * Keys are matched case-insensitively. Commands with actions (reactor, console,
 * google, etc.) remain in the page because they navigate or alter simulator state.
 */
export const V23_CHANGELOG = "V2.3 — MULTI-UNIT OPERATIONS\n• Supervisor Room: create a shared two-unit plant, issue station invite links, monitor both units live, and manage demand distribution without repeatedly reconnecting.\n• Demand manager: schedules site demand, splits it evenly by default, allows operator redistribution during the 200–60 second allocation window, and replaces the local demand when online.\n• Unit interlock: optional Unit 1 ↔ Unit 2 startup-bus support with a direct Bus A feed, source/target selection, interlock status, and a dedicated tie breaker.\n• Electrical: reworked the power-routing schematic, added functional per-bus machine monitors, energization-based alarms, turbine-backed shared bus capacity, and clearer safety/DC routes.\n• Scoring: shared plant demand awards one point per unit every five seconds when site demand is within 50 MW and each unit is within 30 MW of its assigned demand.\n• Reliability: refreshed state synchronisation between the reactor, terminal, supervisor, and Supabase-backed shared rooms; Vercel deployments now use an updated pnpm lockfile.";

export const MULTIUNIT_MANUAL = "MULTI-UNIT OPERATIONS MANUAL — V2.3\n\nSTARTING A SHARED PLANT\n1. Create a plant room in the Supervisor Room. It provides one shared room code and station links for Unit 1 and Unit 2.\n2. Send one station link to each operator. Each unit is an independent reactor and control room; demand, interlock status, and plant scoring are shared.\n3. Each operator opens only their assigned station and logs in normally. Duplicate station windows are control-locked to prevent conflicting commands.\n\nDEMAND MANAGER\nWhen online, Demand Manager replaces a unit's local grid target with shared site demand. The supervisor sees the next target in advance. From 200 to 60 seconds before it begins, distribute the total MW between Unit 1 and Unit 2. Assignments must add up to site demand; each new target starts evenly split.\n\nPOINTS\nKeep the site within ±50 MW of demand and each unit within ±30 MW of its own assignment. When both conditions are met, each unit operator earns one point every five seconds. Normal automation penalties still apply.\n\nUNIT INTERLOCK\nInterlock is separate from demand management. It feeds the selected source unit directly into the target unit's Bus A; it does not combine controls or output. The source needs energized Bus A from a turbine source (grid-connected or islanded) with its Bus A breaker closed. Configure source/target, then close the target tie breaker. The target feed bypasses its startup transformer.\n\nLOOP RECOVERY\nA LOOP removes offsite startup-transformer power and trips/unsynchronizes the turbine; it does not automatically SCRAM the reactor. Use safe turbine islanding where available. Use interlock only after confirming its source is energized and stable.\n\nSUPERVISOR CHECK\n• Confirm room code and Unit 1 / Unit 2 assignment.\n• Confirm both stations are live before enabling Demand Manager.\n• Confirm source Bus A, source breaker, target tie breaker, and interlock status before expecting target power.\n• Unit operators remain responsible for reactor, water, turbine, and safety operation.\n• Open interlock before reversing its direction or recovering from an electrical upset.";

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
  "START HERE: HELP START · HELP OPERATIONS · HELP MULTIUNIT\nACCESS: login <yourname> · logout · reactor (guest allowed) · console\nCOMMANDS: status · leaderboard · version · changelog · multiunit\nNAVIGATION: url <address> · google <https://url> · github · contact [discord]\nTERMINAL: time · date · whoami · uptime · echo <text> · fortune · clear\nGuest entry is allowed, but LOGIN <yourname> is recommended to record points and leaderboard position.";
export const MAINFRAME_HELP =
  "STATUS|VALUES · GET <value> · REACTOR · HOME · CLEAR · SCRAM\n<value> SET <number> · <switch> ON|OFF · START|STOP · MODE SET SD|SRM|IPR|RUN\nVALUES: REACTOR.TEMP|PRESSURE|LEVEL · HOTWELL.LEVEL · DA.LEVEL|TEMP|PRESSURE · CST.LEVEL\nCONDENSER.PRESSURE|VALVE · CONDENSATE.A|B · FEEDWATER.A|B · RECIRC.A|B\nTURBINE.MAINVALVE|BYPASS · AUTO.APRM · PHYSICS.THERMAL|STEAM|REMOVAL|TRIPTEMP\nSWITCHES: MCC.AUTO|PUMP · CONDENSER.AUTO|PUMP.A|PUMP.B|CIRCULATION.A|CIRCULATION.B · RECIRC.PUMP.A|B\nTURBINE.RPMAUTO|PRESSUREAUTO|INLET · ELECTRICAL.BUSA|BUSATRANSFORMER|BUSB|BUSS · RCIC.VALVE · ECCS.A|B · ADS\nCommands entered here queue into the live Control Room session when opened.";
