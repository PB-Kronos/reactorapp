export type UnitStationRole = "mcr" | "tcr" | "cmcr" | "edg" | "fwp" | "reactor-hall" | "deaerator" | "eccs" | "rps" | "electrical";

export type UnitStationDefinition = {
  role: UnitStationRole;
  stationId: string;
  extension: string;
  label: string;
  panels: string[];
};

export const U2_STATIONS: UnitStationDefinition[] = [
  { role: "mcr", stationId: "U2-MCR", extension: "0020", label: "U2 Main Control Room", panels: ["status", "control-rods", "mcc", "safety", "condenser", "power-grid", "electrical", "systems", "rps"] },
  { role: "tcr", stationId: "U2-TCR", extension: "0021", label: "U2 Turbine Control Room", panels: ["status", "power-grid", "condenser"] },
  { role: "cmcr", stationId: "U2-CMCR", extension: "0022", label: "U2 Condenser Control Room", panels: ["status", "condenser", "mcc"] },
  { role: "edg", stationId: "U2-EDG", extension: "0023", label: "Emergency Diesel Generator Bay", panels: ["status", "electrical"] },
  { role: "fwp", stationId: "U2-FWP", extension: "0024", label: "Feedwater Pump Bay", panels: ["status", "mcc"] },
  { role: "reactor-hall", stationId: "U2-RH", extension: "0025", label: "U2 Reactor Hall", panels: ["status", "control-rods", "safety", "rps"] },
  { role: "deaerator", stationId: "U2-DA", extension: "0040", label: "Deaerator Hall", panels: ["status", "mcc"] },
  { role: "eccs", stationId: "U2-ECCS", extension: "0025", label: "ECCS Station", panels: ["status", "safety"] },
  { role: "rps", stationId: "U2-RPS", extension: "0025", label: "Reactor Protection System", panels: ["status", "rps", "control-rods"] },
  { role: "electrical", stationId: "U2-ELECTRICAL", extension: "0023", label: "Electrical Distribution", panels: ["status", "electrical"] },
];

export const getUnitStation = (stationId?: string | null): UnitStationDefinition =>
  U2_STATIONS.find((station) => station.stationId === (stationId || "").toUpperCase()) || U2_STATIONS[0];

