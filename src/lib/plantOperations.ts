import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabaseTimeout";

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
  demand_manager_enabled: boolean;
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
export type PlantPhoneMessage = {
  id: number;
  room_code: string;
  conversation_id: string;
  source_extension: string;
  source_label: string;
  target_extension: string;
  target_label: string;
  body: string;
  priority: "normal" | "urgent";
  acknowledged_at: string | null;
  created_at: string;
};
export type PlantPhoneCall = {
  id: string;
  room_code: string;
  source_extension: string;
  source_label: string;
  target_extension: string;
  target_label: string;
  status: "ringing" | "connected" | "declined" | "ended";
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
};
export type PlantPhoneCallMessage = {
  id: number;
  call_id: string;
  source_extension: string;
  source_label: string;
  body: string;
  created_at: string;
};
export const PLANT_ASSIGNMENT_KEY = "unit2-plant-assignment";
export const PLANT_TRANSPORT_KEY = "unit2-plant-transport";
export type PlantTransport = "supabase" | "local";

const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
const normalizeStation = (value: string) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);

/** Browser-local plant transport. It is deliberately separate from the
 * network transport: one computer can run two units, stations, supervisor,
 * phones and pop-out panels with no database or internet connection. */
const localPrefix = "unit2-local-plant:";
const localRoomIndexKey = "unit2-local-plant-rooms";
type LocalStation = { session_id: string; last_seen: string; operator_name: string; active_page: string };
type LocalPlantData = {
  room: PlantRoom;
  units: PlantUnit[];
  stations: Record<string, LocalStation>;
  remoteCommands: PlantRemoteCommand[];
  phoneMessages: PlantPhoneMessage[];
  phoneCalls: PlantPhoneCall[];
  callMessages: PlantPhoneCallMessage[];
  pointTicks: Record<string, true>;
  nextId: number;
};
const localEnabled = () => typeof window !== "undefined" && localStorage.getItem(PLANT_TRANSPORT_KEY) === "local";
export const getPlantTransport = (): PlantTransport => localEnabled() ? "local" : "supabase";
export const setPlantTransport = (transport: PlantTransport) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLANT_TRANSPORT_KEY, transport);
  window.dispatchEvent(new CustomEvent("unit2-plant-transport", { detail: transport }));
};
const freshRoom = (code: string): LocalPlantData => {
  const now = new Date().toISOString();
  const room: PlantRoom = { code, plant_demand_mw: 675, next_plant_demand_mw: 675, demand_effective_at: null, demand_manager_last_seen: null, demand_manager_enabled: false, interlock_enabled: false, interlock_breaker_closed: false, interlock_source_unit: 1, interlock_target_unit: 2 };
  const units = ([1, 2] as const).map(unit_number => ({ room_code: code, unit_number, assigned_demand_mw: unit_number === 1 ? 338 : 337, output_mw: 0, aprm: 0, pressure_kpa: 0, offsite_available: true, grid_connected: false, bus_a_available: false, bus_a_transformer_closed: false, updated_at: now }));
  return { room, units, stations: {}, remoteCommands: [], phoneMessages: [], phoneCalls: [], callMessages: [], pointTicks: {}, nextId: 1 };
};
const localRoomKey = (code: string) => `${localPrefix}${normalizeCode(code)}`;
const localRoomCodes = () => { try { return JSON.parse(localStorage.getItem(localRoomIndexKey) || "[]") as string[]; } catch { return []; } };
const readLocalRoom = (code: string): LocalPlantData => {
  const normalized = normalizeCode(code);
  try {
    const value = JSON.parse(localStorage.getItem(localRoomKey(normalized)) || "null") as LocalPlantData | null;
    if (value?.room && Array.isArray(value.units)) return value;
  } catch { /* create a clean local room */ }
  return freshRoom(normalized);
};
const saveLocalRoom = (code: string, data: LocalPlantData) => {
  const normalized = normalizeCode(code);
  localStorage.setItem(localRoomKey(normalized), JSON.stringify(data));
  const rooms = localRoomCodes();
  if (!rooms.includes(normalized)) localStorage.setItem(localRoomIndexKey, JSON.stringify([...rooms, normalized]));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("unit2-local-plant-events-v1");
    channel.postMessage({ roomCode: normalized, type: "data" });
    channel.close();
  }
};
const localSnapshot = (data: LocalPlantData): PlantSnapshot => ({ room: { ...data.room }, units: data.units.map(unit => ({ ...unit })) });
const mutateLocalRoom = <T>(code: string, action: (data: LocalPlantData) => T): T => {
  const data = readLocalRoom(code); const result = action(data); saveLocalRoom(code, data); return result;
};
const mutateAnyLocalRoom = <T>(action: (data: LocalPlantData) => T | undefined): T | undefined => {
  for (const code of localRoomCodes()) {
    const data = readLocalRoom(code); const result = action(data);
    if (result !== undefined) { saveLocalRoom(code, data); return result; }
  }
  return undefined;
};

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
  let { data: { user } } = await withSupabaseTimeout(supabase.auth.getUser(), "Supabase session check");
  if (!user) {
    const { data, error } = await withSupabaseTimeout(supabase.auth.signInAnonymously(), "Anonymous Supabase sign-in");
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
  if (localEnabled()) {
    const sessionId = getStationSessionId();
    return mutateLocalRoom(assignment.roomCode, (data) => {
      const existing = data.stations[assignment.stationId];
      const recentlyActive = existing && Date.now() - Date.parse(existing.last_seen) < 15_000;
      if (recentlyActive && existing.session_id !== sessionId) return { snapshot: localSnapshot(data), controlsLocked: true };
      data.stations[assignment.stationId] = { session_id: sessionId, last_seen: new Date().toISOString(), operator_name: operatorName || "GUEST", active_page: activePage };
      return { snapshot: localSnapshot(data), controlsLocked: false };
    });
  }
  const ownerId = await getAnonymousId();
  if (!supabase) return null;
  const sessionId = getStationSessionId();
  const { error: roomError } = await withSupabaseTimeout(supabase.from("plant_rooms").upsert({ code: assignment.roomCode }, { onConflict: "code" }), "Plant room setup");
  if (roomError) throw roomError;
  const { error: unitError } = await withSupabaseTimeout(supabase.from("plant_units").upsert({ room_code: assignment.roomCode, unit_number: assignment.unitNumber }, { onConflict: "room_code,unit_number", ignoreDuplicates: true }), "Unit station setup");
  if (unitError) throw unitError;
  const { data: existing, error: stationReadError } = await withSupabaseTimeout(supabase.from("plant_stations")
    .select("session_id, last_seen").eq("room_code", assignment.roomCode).eq("station_id", assignment.stationId).maybeSingle(), "Station occupancy check");
  if (stationReadError) throw stationReadError;
  const recentlyActive = existing?.last_seen && Date.now() - Date.parse(existing.last_seen) < 15000;
  if (recentlyActive && existing.session_id && existing.session_id !== sessionId)
    return { snapshot: await getPlantSnapshot(assignment.roomCode), controlsLocked: true };
  const { error: stationError } = await withSupabaseTimeout(supabase.from("plant_stations").upsert({
    room_code: assignment.roomCode, station_id: assignment.stationId, unit_number: assignment.unitNumber,
    operator_name: operatorName || "GUEST", active_page: activePage, owner_id: ownerId, session_id: sessionId, last_seen: new Date().toISOString(),
  }, { onConflict: "room_code,station_id" }), "Station registration");
  if (stationError) throw stationError;
  return { snapshot: await getPlantSnapshot(assignment.roomCode), controlsLocked: false };
};

export const heartbeatPlantStation = async (assignment: PlantAssignment, activePage = "control-room") => {
  if (localEnabled()) return mutateLocalRoom(assignment.roomCode, (data) => {
    const station = data.stations[assignment.stationId];
    if (!station || station.session_id !== getStationSessionId()) return false;
    station.last_seen = new Date().toISOString(); station.active_page = activePage; return true;
  });
  if (!supabase) return true;
  const { data, error } = await withSupabaseTimeout(supabase.from("plant_stations")
    .update({ last_seen: new Date().toISOString(), active_page: activePage })
    .eq("room_code", assignment.roomCode).eq("station_id", assignment.stationId).eq("session_id", getStationSessionId())
    .select("station_id"), "Station heartbeat");
  if (error) throw error;
  return Boolean(data?.length);
};

export const getPlantSnapshot = async (roomCode: string): Promise<PlantSnapshot> => {
  if (localEnabled()) return localSnapshot(readLocalRoom(roomCode));
  if (!supabase) return { room: null, units: [] };
  const [{ data: room, error: roomError }, { data: units, error: unitsError }] = await withSupabaseTimeout(Promise.all([
    supabase.from("plant_rooms").select("code, plant_demand_mw, next_plant_demand_mw, demand_effective_at, demand_manager_last_seen, demand_manager_enabled, interlock_enabled, interlock_breaker_closed, interlock_source_unit, interlock_target_unit").eq("code", roomCode).maybeSingle(),
    supabase.from("plant_units").select("room_code, unit_number, assigned_demand_mw, output_mw, aprm, pressure_kpa, offsite_available, grid_connected, bus_a_available, bus_a_transformer_closed, updated_at").eq("room_code", roomCode).order("unit_number"),
  ]), "Plant room snapshot");
  if (roomError) throw roomError;
  if (unitsError) throw unitsError;
  return { room: room as PlantRoom | null, units: (units || []) as PlantUnit[] };
};

export type UnitTelemetry = Pick<PlantUnit, "output_mw" | "aprm" | "pressure_kpa" | "offsite_available" | "grid_connected" | "bus_a_available" | "bus_a_transformer_closed">;

export const publishUnitTelemetry = async (assignment: PlantAssignment, telemetry: UnitTelemetry) => {
  if (localEnabled()) { mutateLocalRoom(assignment.roomCode, (data) => {
    const unit = data.units.find(entry => entry.unit_number === assignment.unitNumber);
    if (unit) Object.assign(unit, telemetry, { updated_at: new Date().toISOString() });
  }); return; }
  const ownerId = await getAnonymousId();
  if (!supabase) return;
  // Dispatch is owned by the supervisor. Telemetry must never overwrite an
  // assigned demand that was changed in another station at the same moment.
  const { error } = await withSupabaseTimeout(supabase.from("plant_units").update({ ...telemetry, updated_by: ownerId })
    .eq("room_code", assignment.roomCode).eq("unit_number", assignment.unitNumber), "Unit telemetry update");
  if (error) throw error;
};

export const updatePlantDispatch = async (roomCode: string, patch: Partial<Pick<PlantRoom, "plant_demand_mw" | "next_plant_demand_mw" | "demand_effective_at" | "demand_manager_last_seen" | "demand_manager_enabled" | "interlock_enabled" | "interlock_breaker_closed" | "interlock_source_unit" | "interlock_target_unit">>) => {
  if (localEnabled()) { mutateLocalRoom(roomCode, (data) => Object.assign(data.room, patch)); return; }
  if (!supabase) return;
  const { data, error } = await supabase.from("plant_rooms").update(patch).eq("code", roomCode).select("code");
  if (error) throw error;
  if (!data?.length) throw new Error("Plant room update was rejected or the room code is not active.");
};

export const updateUnitDemand = async (assignment: PlantAssignment, assigned_demand_mw: number) => {
  if (localEnabled()) { mutateLocalRoom(assignment.roomCode, (data) => {
    const unit = data.units.find(entry => entry.unit_number === assignment.unitNumber);
    if (unit) unit.assigned_demand_mw = assigned_demand_mw;
  }); return; }
  if (!supabase) return;
  const { error } = await supabase.from("plant_units").update({ assigned_demand_mw }).eq("room_code", assignment.roomCode).eq("unit_number", assignment.unitNumber);
  if (error) throw error;
};

export type PlantRemoteCommand = {
  id: number;
  room_code: string;
  target_unit: 1 | 2;
  command: string;
  issued_at: string;
  delivered_at: string | null;
  completed_at: string | null;
  result: string | null;
};

/** Queue a command for the selected unit's live CLI. Commands are deliberately
 * plain text so supervisor procedures can invoke the same public command
 * vocabulary used by an operator at the unit terminal. */
export const queuePlantRemoteCommand = async (roomCode: string, unitNumber: 1 | 2, command: string) => {
  const normalized = command.trim().slice(0, 500);
  if (!normalized) throw new Error("Enter a command to send to the unit terminal.");
  if (localEnabled()) { mutateLocalRoom(roomCode, (data) => {
    const id = data.nextId++;
    data.remoteCommands.push({ id, room_code: normalizeCode(roomCode), target_unit: unitNumber, command: normalized, issued_at: new Date().toISOString(), delivered_at: null, completed_at: null, result: null });
  }); return; }
  if (!supabase) throw new Error("Supabase is unavailable; remote unit commands require the shared plant database.");
  const { error } = await supabase.from("plant_remote_commands").insert({
    room_code: normalizeCode(roomCode), target_unit: unitNumber, command: normalized,
  });
  if (error) throw error;
};

/** Claims undelivered supervisor commands for one unit. The active station
 * marks them delivered before execution, preventing repeated polling actions. */
export const claimPlantRemoteCommands = async (assignment: PlantAssignment): Promise<PlantRemoteCommand[]> => {
  if (localEnabled()) return mutateLocalRoom(assignment.roomCode, (data) => {
    const commands = data.remoteCommands.filter(command => command.target_unit === assignment.unitNumber && !command.delivered_at).slice(0, 20);
    const deliveredAt = new Date().toISOString(); commands.forEach(command => { command.delivered_at = deliveredAt; });
    return commands.map(command => ({ ...command }));
  });
  if (!supabase) return [];
  const { data, error } = await supabase.from("plant_remote_commands")
    .select("id, command, issued_at, delivered_at, completed_at, result")
    .eq("room_code", assignment.roomCode)
    .eq("target_unit", assignment.unitNumber)
    .is("delivered_at", null)
    .order("id", { ascending: true })
    .limit(20);
  if (error) throw error;
  const commands = (data || []) as PlantRemoteCommand[];
  if (!commands.length) return [];
  const { error: claimError } = await supabase.from("plant_remote_commands")
    .update({ delivered_at: new Date().toISOString() })
    .in("id", commands.map(command => command.id));
  if (claimError) throw claimError;
  return commands;
};

/** Writes the exact unit CLI response back to the shared supervisor queue. */
export const completePlantRemoteCommand = async (id: number, result: string) => {
  if (localEnabled()) { mutateAnyLocalRoom((data) => {
    const command = data.remoteCommands.find(entry => entry.id === id);
    if (!command) return undefined;
    command.completed_at = new Date().toISOString(); command.result = result.slice(0, 2000); return true;
  }); return; }
  if (!supabase) return;
  const { error } = await supabase.from("plant_remote_commands")
    .update({ completed_at: new Date().toISOString(), result: result.slice(0, 2000) })
    .eq("id", id);
  if (error) throw error;
};

/** Supervisor-side readback for dispatch, acknowledgement, and result text. */
export const getPlantRemoteCommands = async (roomCode: string): Promise<PlantRemoteCommand[]> => {
  if (localEnabled()) return readLocalRoom(roomCode).remoteCommands.slice().sort((a, b) => b.id - a.id).slice(0, 40);
  if (!supabase) return [];
  const { data, error } = await supabase.from("plant_remote_commands")
    .select("id, room_code, target_unit, command, issued_at, delivered_at, completed_at, result")
    .eq("room_code", normalizeCode(roomCode))
    .order("id", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data || []) as PlantRemoteCommand[];
};

/** Shared manual phone-network message. Manual extensions are intentionally
 * simple radio-style conversations: every station in the plant room can see
 * its own addressed calls without a separate authentication system. */
export const sendPlantPhoneMessage = async (message: Omit<PlantPhoneMessage, "id" | "created_at" | "priority" | "acknowledged_at"> & { priority?: "normal" | "urgent" }) => {
  const body = message.body.trim().slice(0, 1000);
  if (!body) throw new Error("State a message before sending it.");
  if (localEnabled()) { mutateLocalRoom(message.room_code, (data) => data.phoneMessages.push({ ...message, id: data.nextId++, body, priority: message.priority || "normal", acknowledged_at: null, created_at: new Date().toISOString() })); return; }
  if (!supabase) throw new Error("Supabase is unavailable; plant phone messaging requires the shared plant database.");
  const { error } = await supabase.from("plant_phone_messages").insert({ ...message, body, priority: message.priority || "normal" });
  if (error) throw error;
};

export const getPlantPhoneMessages = async (roomCode: string): Promise<PlantPhoneMessage[]> => {
  if (localEnabled()) return readLocalRoom(roomCode).phoneMessages.slice(-160);
  if (!supabase) return [];
  const { data, error } = await supabase.from("plant_phone_messages")
    .select("id, room_code, conversation_id, source_extension, source_label, target_extension, target_label, body, priority, acknowledged_at, created_at")
    .eq("room_code", normalizeCode(roomCode))
    .order("id", { ascending: true })
    .limit(160);
  if (error) throw error;
  return (data || []) as PlantPhoneMessage[];
};

export const acknowledgePlantPhoneMessage = async (id: number) => {
  if (localEnabled()) { mutateAnyLocalRoom((data) => {
    const message = data.phoneMessages.find(entry => entry.id === id);
    if (!message) return undefined;
    message.acknowledged_at = new Date().toISOString(); return true;
  }); return; }
  if (!supabase) return;
  const { error } = await supabase.from("plant_phone_messages")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
};

export const createPlantPhoneCall = async (call: Omit<PlantPhoneCall, "id" | "status" | "created_at" | "answered_at" | "ended_at">): Promise<PlantPhoneCall> => {
  if (localEnabled()) return mutateLocalRoom(call.room_code, (data) => {
    const created: PlantPhoneCall = { ...call, id: crypto.randomUUID(), status: "ringing", created_at: new Date().toISOString(), answered_at: null, ended_at: null };
    data.phoneCalls.push(created); return created;
  });
  if (!supabase) throw new Error("Supabase is unavailable; private calls require the shared plant database.");
  const { data, error } = await supabase.from("plant_phone_calls")
    .insert({ ...call, status: "ringing" })
    .select("id, room_code, source_extension, source_label, target_extension, target_label, status, created_at, answered_at, ended_at")
    .single();
  if (error) throw error;
  return data as PlantPhoneCall;
};

export const getPlantPhoneCalls = async (roomCode: string): Promise<PlantPhoneCall[]> => {
  if (localEnabled()) return readLocalRoom(roomCode).phoneCalls.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 80);
  if (!supabase) return [];
  const { data, error } = await supabase.from("plant_phone_calls")
    .select("id, room_code, source_extension, source_label, target_extension, target_label, status, created_at, answered_at, ended_at")
    .eq("room_code", normalizeCode(roomCode)).order("created_at", { ascending: false }).limit(80);
  if (error) throw error;
  return (data || []) as PlantPhoneCall[];
};

export const updatePlantPhoneCall = async (id: string, status: PlantPhoneCall["status"]) => {
  if (localEnabled()) { mutateAnyLocalRoom((data) => {
    const call = data.phoneCalls.find(entry => entry.id === id); if (!call) return undefined;
    call.status = status; if (status === "connected") call.answered_at = new Date().toISOString(); if (status === "declined" || status === "ended") call.ended_at = new Date().toISOString(); return true;
  }); return; }
  if (!supabase) return;
  const updates: Record<string, unknown> = { status };
  if (status === "connected") updates.answered_at = new Date().toISOString();
  if (status === "declined" || status === "ended") updates.ended_at = new Date().toISOString();
  const { error } = await supabase.from("plant_phone_calls").update(updates).eq("id", id);
  if (error) throw error;
};

export const getPlantPhoneCallMessages = async (callId: string): Promise<PlantPhoneCallMessage[]> => {
  if (localEnabled()) return localRoomCodes().flatMap(code => readLocalRoom(code).callMessages).filter(message => message.call_id === callId).sort((a, b) => a.id - b.id).slice(0, 200);
  if (!supabase) return [];
  const { data, error } = await supabase.from("plant_phone_call_messages")
    .select("id, call_id, source_extension, source_label, body, created_at")
    .eq("call_id", callId).order("id", { ascending: true }).limit(200);
  if (error) throw error;
  return (data || []) as PlantPhoneCallMessage[];
};

export const sendPlantPhoneCallMessage = async (message: Omit<PlantPhoneCallMessage, "id" | "created_at">) => {
  const body = message.body.trim().slice(0, 1000);
  if (!body) throw new Error("State a message before sending it.");
  if (localEnabled()) { mutateAnyLocalRoom((data) => {
    if (!data.phoneCalls.some(call => call.id === message.call_id)) return undefined;
    data.callMessages.push({ ...message, id: data.nextId++, body, created_at: new Date().toISOString() }); return true;
  }); return; }
  if (!supabase) throw new Error("Supabase is unavailable; private calls require the shared plant database.");
  const { error } = await supabase.from("plant_phone_call_messages").insert({ ...message, body });
  if (error) throw error;
};

/** Claims the five-second site-demand credit for one unit. Only one open
 * station can receive a given unit's credit bucket, even with duplicate tabs. */
export const claimPlantUnitPointTick = async (assignment: PlantAssignment) => {
  if (localEnabled()) return mutateLocalRoom(assignment.roomCode, (data) => {
    const key = `${assignment.unitNumber}:${Math.floor(Date.now() / 5000)}`;
    if (data.pointTicks[key]) return false; data.pointTicks[key] = true; return true;
  });
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("claim_plant_unit_point_tick", {
    room: assignment.roomCode,
    unit: assignment.unitNumber,
    tick_bucket: Math.floor(Date.now() / 5000),
  });
  if (error) throw error;
  return Boolean(data);
};

type PlantSubscription = { unsubscribe: () => void };
export const subscribePlantRoom = (roomCode: string, onChange: () => void): PlantSubscription | null => {
  if (localEnabled()) {
    const normalized = normalizeCode(roomCode);
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("unit2-local-plant-events-v1");
    const onMessage = (event: MessageEvent<{ roomCode?: string }>) => { if (event.data?.roomCode === normalized) onChange(); };
    const onStorage = (event: StorageEvent) => { if (event.key === localRoomKey(normalized)) onChange(); };
    channel?.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    return { unsubscribe: () => { channel?.removeEventListener("message", onMessage); channel?.close(); window.removeEventListener("storage", onStorage); } };
  }
  if (!supabase) return null;
  return supabase.channel(`plant-room:${roomCode}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "plant_rooms", filter: `code=eq.${roomCode}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "plant_units", filter: `room_code=eq.${roomCode}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "plant_stations", filter: `room_code=eq.${roomCode}` }, onChange)
    .subscribe();
};

/** Low-latency unit-state bus. It deliberately carries ephemeral browser
 * snapshots rather than writing every simulator tick to Postgres. The MCR is
 * the physics authority; specialist stations publish a changed control state
 * and immediately resume following the next MCR state broadcast. */
export const openUnitLiveChannel = (
  assignment: PlantAssignment,
  onSnapshot: (snapshot: unknown, sourceStationId: string) => void,
): (RealtimeChannel | BroadcastChannel) | null => {
  if (localEnabled()) {
    if (typeof BroadcastChannel === "undefined") return null;
    const channel = new BroadcastChannel(`unit2-local-live:${assignment.roomCode}:u${assignment.unitNumber}`);
    channel.addEventListener("message", (event: MessageEvent<{ snapshot?: unknown; sourceStationId?: string }>) => {
      if (event.data?.snapshot) onSnapshot(event.data.snapshot, event.data.sourceStationId || "");
    });
    return channel;
  }
  if (!supabase) return null;
  const channel = supabase.channel(`unit-live:${assignment.roomCode}:u${assignment.unitNumber}`, {
    config: { broadcast: { self: false } },
  });
  channel.on("broadcast", { event: "snapshot" }, ({ payload }) => {
    if (!payload || typeof payload !== "object") return;
    const message = payload as { snapshot?: unknown; sourceStationId?: string };
    if (message.snapshot) onSnapshot(message.snapshot, message.sourceStationId || "");
  }).subscribe();
  return channel;
};

export const broadcastUnitSnapshot = (channel: RealtimeChannel | BroadcastChannel | null, snapshot: unknown, sourceStationId: string) => {
  if (!channel) return;
  if (channel instanceof BroadcastChannel) { channel.postMessage({ snapshot, sourceStationId }); return; }
  void channel.send({ type: "broadcast", event: "snapshot", payload: { snapshot, sourceStationId } });
};
