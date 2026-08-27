import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type PlantAssignment = {
  roomCode: string;
  unitNumber: 1 | 2;
  stationId: string;
};

export type PlantRoom = {
  code: string;
  plant_demand_mw: number;
  next_plant_demand_mw: number;
  demand_effective_at: string | null;
  demand_manager_last_seen: string | null;
  interlock_enabled: boolean;
  interlock_breaker_closed: boolean;
  interlock_source_unit: 1 | 2;
  interlock_target_unit: 1 | 2;
};

export type PlantUnit = {
  room_code: string;
  unit_number: 1 | 2;
  assigned_demand_mw: number;
  output_mw: number;
  aprm: number;
  pressure_kpa: number;
  offsite_available: boolean;
  grid_connected: boolean;
  bus_a_available: boolean;
  bus_a_transformer_closed: boolean;
  updated_at: string;
};

export type PlantSnapshot = { room: PlantRoom | null; units: PlantUnit[] };
export const PLANT_ASSIGNMENT_KEY = "unit2-plant-assignment";

const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
const normalizeStation = (value: string) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);

export const createStationId = (unitNumber: 1 | 2) =>
  `U${unitNumber}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

export const normalizeAssignment = (value: Partial<PlantAssignment>): PlantAssignment | null => {
  const roomCode = normalizeCode(value.roomCode || "");
  const unitNumber = Number(value.unitNumber) === 1 ? 1 : Number(value.unitNumber) === 2 ? 2 : null;
  if (roomCode.length < 3 || !unitNumber) return null;
  return { roomCode, unitNumber, stationId: normalizeStation(value.stationId || "") || createStationId(unitNumber) };
};

export const readPlantAssignment = () => {
  try { return normalizeAssignment(JSON.parse(localStorage.getItem(PLANT_ASSIGNMENT_KEY) || "null") || {}); } catch { return null; }
};

export const savePlantAssignment = (assignment: PlantAssignment | null) => {
  if (assignment) localStorage.setItem(PLANT_ASSIGNMENT_KEY, JSON.stringify(assignment));
  else localStorage.removeItem(PLANT_ASSIGNMENT_KEY);
};

const getAnonymousId = async () => {
  if (!supabase) return null;
  let { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    user = data.user;
  }
  return user?.id || null;
};

const stationSessionKey = "unit2-plant-station-session";
const getStationSessionId = () => {
  let id = sessionStorage.getItem(stationSessionKey);
  if (!id) {
    id = `S-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`.toUpperCase();
    sessionStorage.setItem(stationSessionKey, id);
  }
  return id;
};

export type PlantJoinResult = { snapshot: PlantSnapshot; controlsLocked: boolean };

export const joinPlantRoom = async (assignment: PlantAssignment, operatorName: string, activePage = "status"): Promise<PlantJoinResult | null> => {
  const ownerId = await getAnonymousId();
  if (!supabase) return null;
  const sessionId = getStationSessionId();
  const { error: roomError } = await supabase.from("plant_rooms").upsert({ code: assignment.roomCode }, { onConflict: "code" });
  if (roomError) throw roomError;
  const { error: unitError } = await supabase.from("plant_units").upsert({ room_code: assignment.roomCode, unit_number: assignment.unitNumber }, { onConflict: "room_code,unit_number", ignoreDuplicates: true });
  if (unitError) throw unitError;
  const { data: existing, error: stationReadError } = await supabase.from("plant_stations")
    .select("session_id, last_seen").eq("room_code", assignment.roomCode).eq("station_id", assignment.stationId).maybeSingle();
  if (stationReadError) throw stationReadError;
  const recentlyActive = existing?.last_seen && Date.now() - Date.parse(existing.last_seen) < 15000;
  if (recentlyActive && existing.session_id && existing.session_id !== sessionId)
    return { snapshot: await getPlantSnapshot(assignment.roomCode), controlsLocked: true };
  const { error: stationError } = await supabase.from("plant_stations").upsert({
    room_code: assignment.roomCode, station_id: assignment.stationId, unit_number: assignment.unitNumber,
    operator_name: operatorName || "GUEST", active_page: activePage, owner_id: ownerId, session_id: sessionId, last_seen: new Date().toISOString(),
  }, { onConflict: "room_code,station_id" });
  if (stationError) throw stationError;
  return { snapshot: await getPlantSnapshot(assignment.roomCode), controlsLocked: false };
};

export const heartbeatPlantStation = async (assignment: PlantAssignment, activePage = "control-room") => {
  if (!supabase) return true;
  const { data, error } = await supabase.from("plant_stations")
    .update({ last_seen: new Date().toISOString(), active_page: activePage })
    .eq("room_code", assignment.roomCode).eq("station_id", assignment.stationId).eq("session_id", getStationSessionId())
    .select("station_id");
  if (error) throw error;
  return Boolean(data?.length);
};

export const getPlantSnapshot = async (roomCode: string): Promise<PlantSnapshot> => {
  if (!supabase) return { room: null, units: [] };
  const [{ data: room, error: roomError }, { data: units, error: unitsError }] = await Promise.all([
    supabase.from("plant_rooms").select("code, plant_demand_mw, next_plant_demand_mw, demand_effective_at, demand_manager_last_seen, interlock_enabled, interlock_breaker_closed, interlock_source_unit, interlock_target_unit").eq("code", roomCode).maybeSingle(),
    supabase.from("plant_units").select("room_code, unit_number, assigned_demand_mw, output_mw, aprm, pressure_kpa, offsite_available, grid_connected, bus_a_available, bus_a_transformer_closed, updated_at").eq("room_code", roomCode).order("unit_number"),
  ]);
  if (roomError) throw roomError;
  if (unitsError) throw unitsError;
  return { room: room as PlantRoom | null, units: (units || []) as PlantUnit[] };
};

export type UnitTelemetry = Pick<PlantUnit, "output_mw" | "aprm" | "pressure_kpa" | "offsite_available" | "grid_connected" | "bus_a_available" | "bus_a_transformer_closed">;

export const publishUnitTelemetry = async (assignment: PlantAssignment, telemetry: UnitTelemetry) => {
  const ownerId = await getAnonymousId();
  if (!supabase) return;
  // Dispatch is owned by the supervisor. Telemetry must never overwrite an
  // assigned demand that was changed in another station at the same moment.
  const { error } = await supabase.from("plant_units").update({ ...telemetry, updated_by: ownerId })
    .eq("room_code", assignment.roomCode).eq("unit_number", assignment.unitNumber);
  if (error) throw error;
};

export const updatePlantDispatch = async (roomCode: string, patch: Partial<Pick<PlantRoom, "plant_demand_mw" | "next_plant_demand_mw" | "demand_effective_at" | "demand_manager_last_seen" | "interlock_enabled" | "interlock_breaker_closed" | "interlock_source_unit" | "interlock_target_unit">>) => {
  if (!supabase) return;
  const { data, error } = await supabase.from("plant_rooms").update(patch).eq("code", roomCode).select("code");
  if (error) throw error;
  if (!data?.length) throw new Error("Plant room update was rejected or the room code is not active.");
};

export const updateUnitDemand = async (assignment: PlantAssignment, assigned_demand_mw: number) => {
  if (!supabase) return;
  const { error } = await supabase.from("plant_units").update({ assigned_demand_mw }).eq("room_code", assignment.roomCode).eq("unit_number", assignment.unitNumber);
  if (error) throw error;
};

/** Claims the five-second site-demand credit for one unit. Only one open
 * station can receive a given unit's credit bucket, even with duplicate tabs. */
export const claimPlantUnitPointTick = async (assignment: PlantAssignment) => {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("claim_plant_unit_point_tick", {
    room: assignment.roomCode,
    unit: assignment.unitNumber,
    tick_bucket: Math.floor(Date.now() / 5000),
  });
  if (error) throw error;
  return Boolean(data);
};

export const subscribePlantRoom = (roomCode: string, onChange: () => void): RealtimeChannel | null => {
  if (!supabase) return null;
  return supabase.channel(`plant-room:${roomCode}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "plant_rooms", filter: `code=eq.${roomCode}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "plant_units", filter: `room_code=eq.${roomCode}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "plant_stations", filter: `room_code=eq.${roomCode}` }, onChange)
    .subscribe();
};
