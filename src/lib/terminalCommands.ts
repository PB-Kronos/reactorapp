/**
 * Public terminal customisation point.
 *
 * Add a key/value here to create a text-only command in the greeting terminal.
 * Keys are matched case-insensitively. Commands with actions (reactor, console,
 * google, etc.) remain in the page because they navigate or alter simulator state.
 */
export const GREETING_TERMINAL_RESPONSES: Record<string, string> = {
  version: "UNIT 2: THE BWR SIM — V2\nBuild: public control-room sandbox",
  credits: "Unit 2: The BWR Sim — community-built control-room sandbox.",
  changelog:
    "V2 UPDATE\n• Terminals: greeting commands, a working /mainframe control terminal, changelog, and version status.\n• Turbine: preparation checks, run-up conditions, turbine fire, and auxiliaries.\n• Annunciators: expanded sounds, local acknowledge/silence, and per-page windows.\n• APRM: gradual movement toward its intended target.\n• ECCS: ADS, six relief valves, LCPI/RHR selector pumps, and RCIC turbopump control.",
};

/** Add simple read-only responses for the /mainframe terminal here. */
export const MAINFRAME_TERMINAL_RESPONSES: Record<string, string> = {
  about:
    "Unit 2 advanced console. Commands update the shared browser simulator session.",
  changelog:
    "V2 UPDATE\n• Terminals: greeting commands, a working /mainframe control terminal, changelog, and version status.\n• Turbine: preparation checks, run-up conditions, turbine fire, and auxiliaries.\n• Annunciators: expanded sounds, local acknowledge/silence, and per-page windows.\n• APRM: gradual movement toward its intended target.\n• ECCS: ADS, six relief valves, LCPI/RHR selector pumps, and RCIC turbopump control.",
};

export const GREETING_HELP =
  "ACCESS: login <yourname> · logout · reactor (login required) · console\nCOMMANDS: status · leaderboard · version · changelog\nNAVIGATION: url <address> · google <https://url> · github · contact [discord]\nTERMINAL: time · date · whoami · uptime · echo <text> · fortune · clear\nUse LOGIN <yourname> to register before entering the reactor. Your name stores your score and leaderboard position in this browser.";
export const MAINFRAME_HELP =
  "STATUS|VALUES · GET <value> · REACTOR · HOME · CLEAR · SCRAM\n<value> SET <number> · <switch> ON|OFF · START|STOP · MODE SET SD|SRM|IPR|RUN\nVALUES: REACTOR.TEMP|PRESSURE|LEVEL · HOTWELL.LEVEL · DA.LEVEL|TEMP|PRESSURE · CST.LEVEL\nCONDENSER.PRESSURE|VALVE · CONDENSATE.A|B · FEEDWATER.A|B · RECIRC.A|B\nTURBINE.MAINVALVE|BYPASS · AUTO.APRM · PHYSICS.THERMAL|STEAM|REMOVAL|TRIPTEMP\nSWITCHES: MCC.AUTO|PUMP · CONDENSER.AUTO|PUMP.A|PUMP.B|CIRCULATION.A|CIRCULATION.B · RECIRC.PUMP.A|B\nTURBINE.RPMAUTO|PRESSUREAUTO|INLET · ELECTRICAL.BUSA|BUSATRANSFORMER|BUSB|BUSS · RCIC.VALVE · ECCS.A|B · ADS\nCommands entered here queue into the live Control Room session when opened.";
