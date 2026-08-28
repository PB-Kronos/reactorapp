export type PhoneEndpoint = {
  extension: string;
  label: string;
  type: "manual" | "automated";
  targetUnit?: 1 | 2;
  purpose: string;
};

// RBWR Unit 2 plant network.  *000, 0000, 0002 and 3333 are deliberately
// absent: those numbers are reserved/excluded from the public simulator line.
export const PLANT_PHONE_DIRECTORY: PhoneEndpoint[] = [
  { extension: "0001", label: "Supervisor Room", type: "manual", purpose: "Supervisor communications" },
  { extension: "0010", label: "U1 MCR", type: "manual", targetUnit: 1, purpose: "Unit 1 operations" },
  { extension: "0019", label: "U1 Maintenance", type: "automated", targetUnit: 1, purpose: "Unit 1 maintenance systems" },
  { extension: "0020", label: "U2 MCR", type: "manual", targetUnit: 2, purpose: "Unit 2 operations" },
  { extension: "0021", label: "U2 TCR", type: "manual", targetUnit: 2, purpose: "Turbine control operations" },
  { extension: "0022", label: "U2 CMCR", type: "manual", targetUnit: 2, purpose: "Condenser operations" },
  { extension: "0023", label: "EDG Bay", type: "manual", targetUnit: 2, purpose: "Emergency diesel generator operations" },
  { extension: "0024", label: "FWP Bay", type: "manual", targetUnit: 2, purpose: "Feedwater-pump operations" },
  { extension: "0025", label: "U2 Reactor Hall", type: "manual", targetUnit: 2, purpose: "Reactor-hall operations" },
  { extension: "0027", label: "EDG Maintenance", type: "automated", targetUnit: 2, purpose: "EDG maintenance systems" },
  { extension: "0028", label: "U2 TCR Maintenance", type: "automated", targetUnit: 2, purpose: "Turbine maintenance systems" },
  { extension: "0029", label: "U2 Maintenance", type: "automated", targetUnit: 2, purpose: "Unit 2 maintenance systems" },
  { extension: "0040", label: "Deaerator Hall", type: "manual", targetUnit: 2, purpose: "Deaerator operations" },
  { extension: "0100", label: "RBWR HR", type: "automated", purpose: "Operator performance" },
  { extension: "5682", label: "Grid Control", type: "automated", purpose: "Grid control" },
  { extension: "*#99", label: "FSS Master Panel", type: "automated", targetUnit: 2, purpose: "Fire suppression" },
];

export const normalizePhoneExtension = (value: string) => value.trim().toUpperCase();
export const getPhoneEndpoint = (extension: string) =>
  PLANT_PHONE_DIRECTORY.find((entry) => entry.extension === normalizePhoneExtension(extension));

export const unitPhoneIdentity = (unit: 1 | 2) =>
  unit === 1
    ? { extension: "0010", label: "U1 MCR" }
    : { extension: "0020", label: "U2 MCR" };

/** Resolves a live simulator station to its dedicated extension. Older and
 * generic invites intentionally remain MCR stations for compatibility. */
export const stationPhoneIdentity = (unit: 1 | 2, stationId?: string) => {
  if (unit === 1) return unitPhoneIdentity(1);
  const key = (stationId || "").toUpperCase();
  const match = PLANT_PHONE_DIRECTORY.find((entry) => entry.type === "manual" && entry.targetUnit === 2 && (
    (key === "U2-TCR" && entry.extension === "0021") ||
    (key === "U2-CMCR" && entry.extension === "0022") ||
    ((key === "U2-EDG" || key === "U2-ELECTRICAL") && entry.extension === "0023") ||
    (key === "U2-FWP" && entry.extension === "0024") ||
    ((key === "U2-RH" || key === "U2-ECCS" || key === "U2-RPS") && entry.extension === "0025") ||
    (key === "U2-DA" && entry.extension === "0040")
  ));
  return match ? { extension: match.extension, label: match.label } : unitPhoneIdentity(2);
};

export const phoneConversationId = (roomCode: string, one: string, two: string) =>
  `${roomCode.toUpperCase()}:${[normalizePhoneExtension(one), normalizePhoneExtension(two)].sort().join("-")}`;

/** Resolves the supported automated request into the target unit CLI command. */
export const automatedPhoneCommand = (endpoint: PhoneEndpoint, request: string, callerUnit?: 1 | 2) => {
  const normalized = request.trim().toLowerCase().replace(/\s+/g, " ");
  if (endpoint.extension === "0019" && normalized === "refuel") return { targetUnit: 1 as const, command: "maintenance unit refuel" };
  if (endpoint.extension === "0027" && normalized === "refuel") return { targetUnit: 2 as const, command: "maintenance edg refuel" };
  if (endpoint.extension === "0028" && normalized === "repair") return { targetUnit: 2 as const, command: "maintenance turbine repair" };
  if (endpoint.extension === "0028" && normalized === "oil leak check") return { targetUnit: 2 as const, command: "maintenance turbine oil-check" };
  if (endpoint.extension === "0029" && normalized === "repair") return { targetUnit: 2 as const, command: "maintenance repair" };
  if (endpoint.extension === "0029" && normalized === "refuel") return { targetUnit: 2 as const, command: "maintenance unit refuel" };
  if (endpoint.extension === "5682" && normalized === "disconnect" && callerUnit) return { targetUnit: callerUnit, command: "grid disconnect" };
  if (endpoint.extension === "*#99" && ["silence", "reset", "test"].includes(normalized)) return { targetUnit: 2 as const, command: `fss ${normalized}` };
  return null;
};

export const phoneDirectoryText = () => PLANT_PHONE_DIRECTORY
  .map((entry) => `${entry.extension.padEnd(5)} ${entry.type === "manual" ? "MANUAL" : "AUTO  "} ${entry.label} — ${entry.purpose}`)
  .join("\n");
