export type UnitStationRole = "unit" | "mcr" | "tcr" | "cmcr" | "edg" | "fwp" | "reactor-hall" | "deaerator" | "observer";

export type UnitStationDefinition = {
  role: UnitStationRole;
  stationId: string;
  extension: string;
  label: string;
  panels: string[];
};

export const U2_STATIONS: UnitStationDefinition[] = [
  { role: "unit", stationId: "U2-UNIT", extension: "0020", label: "Unit 2 Unified Operator Console", panels: ["status", "control-rods", "mcc", "safety", "condenser", "power-grid", "electrical", "systems", "rps", "turbine-aux", "feedwater-bay", "polishers", "edg", "deaerator"] },
  { role: "mcr", stationId: "U2-MCR", extension: "0020", label: "U2 Main Control Room", panels: ["status", "control-rods", "mcc", "safety", "condenser", "power-grid", "electrical", "systems", "rps"] },
  // MCR owns the steam admission, excitation and grid connection. Turbine
  // auxiliaries deliberately live at TCR so a main-room operator cannot
  // silently bypass the turbine preparation process.
  { role: "tcr", stationId: "U2-TCR", extension: "0021", label: "U2 Turbine Control Room", panels: ["status", "turbine-aux"] },
  // CMCR is now the chemistry / polisher station. Condenser operation remains
  // with MCR until a dedicated condenser station is introduced.
  { role: "cmcr", stationId: "U2-CMCR", extension: "0022", label: "U2 Chemistry & Polisher Control Room", panels: ["status", "polishers"] },
  { role: "edg", stationId: "U2-EDG", extension: "0023", label: "Emergency Diesel Generator Bay", panels: ["status", "edg"] },
  { role: "fwp", stationId: "U2-FWP", extension: "0024", label: "Feedwater Pump Bay", panels: ["status", "feedwater-bay"] },
  { role: "reactor-hall", stationId: "U2-RH", extension: "0025", label: "U2 Reactor Hall", panels: ["status", "control-rods"] },
  { role: "deaerator", stationId: "U2-DA", extension: "0040", label: "Deaerator Hall", panels: ["status", "deaerator"] },
];

// A link to a removed or unknown external station must never fall back to the
// MCR, otherwise an old invite could accidentally receive full-unit access.
const UNASSIGNED_STATION: UnitStationDefinition = {
  role: "observer", stationId: "UNASSIGNED", extension: "—", label: "Unassigned Station", panels: ["status"],
};

export const getUnitStation = (stationId?: string | null): UnitStationDefinition => {
  if (!stationId) return U2_STATIONS[0];

  const normalizedStationId = stationId.toUpperCase();
  // The supervisor creates a unified link for either plant unit.  The panel
  // assignment is identical; preserving the unit number here keeps the
  // station identity clear to the operator and phone/network features.
  if (/^U[12]-UNIT$/.test(normalizedStationId)) {
    const unitNumber = normalizedStationId.charAt(1);
    return {
      ...U2_STATIONS[0],
      stationId: normalizedStationId,
      label: `Unit ${unitNumber} Unified Operator Console`,
    };
  }

  return U2_STATIONS.find((station) => station.stationId === normalizedStationId) || UNASSIGNED_STATION;
};
