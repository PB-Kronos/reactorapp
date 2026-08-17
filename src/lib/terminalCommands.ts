/**
 * Public terminal customisation point.
 *
 * Add a key/value here to create a text-only command in the greeting terminal.
 * Keys are matched case-insensitively. Commands with actions (reactor, console,
 * google, etc.) remain in the page because they navigate or alter simulator state.
 */
export const GREETING_TERMINAL_RESPONSES: Record<string, string> = {
  version: "RBWR WEB SIMULATOR V2\nBuild: public sandbox / control-room expansion",
  credits: "RBWR web simulator — community-built control-room sandbox.",
  changelog: "V2 UPDATE\n• Terminals: greeting commands, a working /mainframe control terminal, changelog, and version status.\n• Turbine: preparation checks, run-up conditions, turbine fire, and auxiliaries.\n• Annunciators: expanded sounds, local acknowledge/silence, and per-page windows.\n• APRM: gradual movement toward its intended target.\n• ECCS: ADS, six relief valves, LCPI/RHR selector pumps, and RCIC turbopump control.",
};

/** Add simple read-only responses for the /mainframe terminal here. */
export const MAINFRAME_TERMINAL_RESPONSES: Record<string, string> = {
  about: "RBWR advanced console. Commands update the shared browser simulator session.",
  changelog: "V2 UPDATE\n• Terminals: greeting commands, a working /mainframe control terminal, changelog, and version status.\n• Turbine: preparation checks, run-up conditions, turbine fire, and auxiliaries.\n• Annunciators: expanded sounds, local acknowledge/silence, and per-page windows.\n• APRM: gradual movement toward its intended target.\n• ECCS: ADS, six relief valves, LCPI/RHR selector pumps, and RCIC turbopump control.",
};

export const GREETING_HELP = "COMMANDS: reactor · console · login <operator> · logout · status · version · changelog · google <https://url>";
export const MAINFRAME_HELP = "STATUS · REACTOR · HOME · CLEAR · SCRAM\nREACTOR.APRM|TEMP|PRESSURE SET <value>\nREACTOR.LEVEL SET|ADD <m> · HOTWELL.LEVEL SET <m> · DA.LEVEL SET <m>\nCONDENSER.PRESSURE SET <bar> · TURBINE.MAINVALVE|BYPASS SET <0-100>\nRODS.WITHDRAW SET <0-100> · MODE SET SD|SRM|IPR|RUN · START|STOP\nPHYSICS.THERMAL|STEAM|REMOVAL SET <0-3> · TURBINE.SMOKE TRIGGER";
