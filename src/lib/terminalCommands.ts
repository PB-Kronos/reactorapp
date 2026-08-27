/**
 * Public terminal customisation point.
 *
 * Add a key/value here to create a text-only command in the greeting terminal.
 * Keys are matched case-insensitively. Commands with actions (reactor, console,
 * google, etc.) remain in the page because they navigate or alter simulator state.
 */
export const V22_CHANGELOG = "V2.2 — CONTROL ROOM EXPANSION\n• Core startup: independent SRM/IRM cycle blocks, an eight-range IRM display, delayed kinetic APRM response, and improved reactor-period behaviour.\n• Turbine: turning gear rolls the shaft at about 50 RPM, preheat warms turbine metal toward 280 °C, and turbine trips instantly shut the main valve and open bypass.\n• Plant physics: improved MCC, condenser, turbine/steam-flow, recirculation, and MW/APRM behaviour. Systems now restore directly after refresh instead of replaying from cold defaults.\n• Electrical: expanded bus routing, live machine/load status, shared turbine capacity, safety/DC power behaviour, and protection annunciators.\n• Automation & scoring: Auto APRM, MCC Auto, Auto Pressure, and Condenser Auto each apply a 0.25 point/s score penalty with a 100-second cooldown.\n• Terminals: guest reactor entry, operator account switching, leaderboard access, and expanded live CLI/Mainframe controls.\n• Operator tools: Systems-tab APRM-to-MW target calculator, tutorials, manuals, unique tooltips, mobile interaction fixes, and broader annunciator coverage.";

export const GREETING_TERMINAL_RESPONSES: Record<string, string> = {
  version: "UNIT 2: THE BWR SIM — V2.2\nBuild: public control-room sandbox",
  credits: "Unit 2: The BWR Sim — community-built control-room sandbox.",
  changelog: V22_CHANGELOG,
};

/** Add simple read-only responses for the /mainframe terminal here. */
export const MAINFRAME_TERMINAL_RESPONSES: Record<string, string> = {
  about:
    "Unit 2 advanced console. Commands update the shared browser simulator session.",
  changelog: V22_CHANGELOG,
};

export const GREETING_HELP =
  "ACCESS: login <yourname> · logout · reactor (guest allowed) · console · supervisor\nCOMMANDS: status · leaderboard · version · changelog\nNAVIGATION: url <address> · google <https://url> · github · contact [discord]\nTERMINAL: time · date · whoami · uptime · echo <text> · fortune · clear\nGuest entry is allowed, but LOGIN <yourname> is recommended to record points and leaderboard position.";
export const MAINFRAME_HELP =
  "STATUS|VALUES · GET <value> · REACTOR · HOME · CLEAR · SCRAM\n<value> SET <number> · <switch> ON|OFF · START|STOP · MODE SET SD|SRM|IPR|RUN\nVALUES: REACTOR.TEMP|PRESSURE|LEVEL · HOTWELL.LEVEL · DA.LEVEL|TEMP|PRESSURE · CST.LEVEL\nCONDENSER.PRESSURE|VALVE · CONDENSATE.A|B · FEEDWATER.A|B · RECIRC.A|B\nTURBINE.MAINVALVE|BYPASS · AUTO.APRM · PHYSICS.THERMAL|STEAM|REMOVAL|TRIPTEMP\nSWITCHES: MCC.AUTO|PUMP · CONDENSER.AUTO|PUMP.A|PUMP.B|CIRCULATION.A|CIRCULATION.B · RECIRC.PUMP.A|B\nTURBINE.RPMAUTO|PRESSUREAUTO|INLET · ELECTRICAL.BUSA|BUSATRANSFORMER|BUSB|BUSS · RCIC.VALVE · ECCS.A|B · ADS\nCommands entered here queue into the live Control Room session when opened.";
