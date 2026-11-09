// Legacy duplicate renderer below is being phased out; active tab routes above are type-checked independently.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Activity, BellRing, RotateCcw, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlantOverviewPanel } from "@/components/PlantOverviewPanel";
import { ControlRodsPanel } from "@/components/ControlRodsPanel";
import { PowerGridPanel } from "@/components/PowerGridPanel";
import {
  PlantSystemsPanel,
  ProcessPanel,
} from "@/components/PlantSystemsPanel";
import { ElectricalPanel } from "@/components/ElectricalPanel";
import {
  SafetySystemsPanel,
  WaterManagementPanel,
} from "@/components/WaterSafetyPanel";
import { RpsPanel } from "@/components/RpsPanel";
import {
  SimulatorConsolePanel,
  type PhysicsTuning,
} from "@/components/SimulatorConsolePanel";
import { SimulatorCliMode } from "@/components/SimulatorCliMode";
import { TurbineAuxPanel } from "@/components/TurbineAuxPanel";
import { FeedwaterPumpBayPanel } from "@/components/FeedwaterPumpBayPanel";
import { PolisherPanel, type PolisherTarget, type RegenTank } from "@/components/PolisherPanel";
import { EdgBayPanel } from "@/components/EdgBayPanel";
import { DeaeratorHallPanel } from "@/components/DeaeratorHallPanel";
import { OperatorManual } from "@/components/OperatorManual";
import { TutorialCoach } from "@/components/TutorialCoach";
import { TUTORIAL_LEVELS } from "@/lib/tutorialProgram";
import { SystemsPanel, type Malfunctions } from "@/components/SystemsPanel";
import {
  AnnunciatorPanel,
  type Annunciator,
} from "@/components/AnnunciatorPanel";
import { useReactorPhysics } from "@/hooks/useReactorPhysics";
import { calculateTurbineData } from "@/hooks/useTurbineControl";
import {
  AutoSpeed,
  ControlRod,
  createInitialRods,
  cycleLimit,
  getAprm,
  isCycleComplete,
  MANUAL_ROD_RATES,
  nextWithdrawableRod,
  ReactorMode,
  RodSelectionScope,
  WITHDRAWAL_RATES,
} from "@/lib/rodProgram";
import { getAprmForSteamKgS, getU2ThermalOutput } from "@/lib/thermalOutput";
import { addLeaderboardPoints, ensureLeaderboardPlayer, getLeaderboard } from "@/lib/leaderboard";
import {
  type PlantSnapshot,
  claimPlantRemoteCommands,
  completePlantRemoteCommand,
  broadcastUnitSnapshot,
  claimPlantUnitPointTick,
  getPlantSnapshot,
  getPlantTransport,
  heartbeatPlantStation,
  joinPlantRoom,
  normalizeAssignment,
  openUnitLiveChannel,
  publishUnitTelemetry,
  savePlantAssignment,
  setPlantTransport,
  subscribePlantRoom,
  updatePlantDispatch,
} from "@/lib/plantOperations";
import { getUnitStation } from "@/lib/unitStations";

type Panel =
  | "status"
  | "control-rods"
  | "startup-shutdown"
  | "power-grid"
  | "electrical"
  | "systems"
  | "turbine-aux"
  | "feedwater-bay"
  | "polishers"
  | "edg"
  | "deaerator"
  | "water"
  | "safety"
  | ProcessPanel;
const panels: Panel[] = [
  "status",
  "control-rods",
  "mcc",
  "safety",
  "condenser",
  "power-grid",
  "electrical",
  "systems",
  "rps",
  "turbine-aux",
  "feedwater-bay",
  "polishers",
  "edg",
  "deaerator",
];
const names: Record<Panel, string> = {
  status: "Overview",
  "control-rods": "Control rods",
  mcc: "MCC / Water",
  water: "Water",
  safety: "ECCS",
  feedwater: "DA / feedwater",
  condenser: "Condenser",
  "power-grid": "Turbine",
  electrical: "Electrical",
  systems: "Systems",
  rps: "RPS",
  "turbine-aux": "Turbine auxiliaries",
  "feedwater-bay": "Feedwater pump bay",
  polishers: "Polishers",
  edg: "EDG Bay",
  deaerator: "Deaerator Hall",
};
// A specialist station may command only its own local equipment. Sending its
// whole cached snapshot over Realtime caused stale values from another panel
// to race MCR's physics snapshot and make switches visibly bounce back.
const STATION_CONTROL_KEYS: Record<string, string[]> = {
  // When a Unified Unit console is online, MCR becomes a follower rather than
  // a second physics clock. It can still send only the controls it owns.
  mcr: ["mainSteamInletOpen", "reliefOpen", "reliefValveB", "exciterOn", "isLocked", "turbinePressureAuto", "turbineRpmAuto", "selectedRodId", "rodDirection", "selectionScope", "autoEnabled", "autoTarget", "autoSpeed", "autoMode", "recircPumpA", "recircPumpB", "recircSpeedA", "recircSpeedB", "condensateFlow", "condensatePumpBFlow", "feedwaterFlow", "feedwaterPumpBFlow", "condenserPumpOn", "condenserPumpB", "condenserValve", "condenserValveDirection", "condenserAuto", "carAOn", "carBOn", "sjaeOn", "mccPumpOn", "mccAutoOn", "condenserCirculationPumpOn", "condenserCirculationPumpB", "startupBusA", "busATransformer", "turbineBusB", "safetyBusS", "acDcInterlock", "safetyToDcBreaker", "busEToDcBreaker", "rolldownProtection", "cstMakeup", "cstDrain", "hotwellMakeup", "hotwellDrain", "rcicValve", "rcicFlow", "eccsPumpA", "eccsPumpB", "eccsPumpAMode", "eccsPumpBMode", "srvOpen", "adsActive"],
  tcr: ["lubePumpSource", "hydraulicPumpSource", "coldOilValve", "warmOilValve", "turningGear", "preheatValve", "steamSealing", "steamSealingLeak"],
  cmcr: ["polisherTrainA", "polisherTrainB", "polisherAuto", "polisherBypass", "polisherTarget", "polisherTankSelection", "polisherTanks"],
  edg: ["edgAuto", "edgSelected", "edgIgnitionBreaker", "edgOutputBreaker", "edgBreaker", "edgStartRequested", "edgMainFuelValve", "edgMainFuelPump", "edgFuelValveA", "edgFuelValveB"],
  fwp: ["feedwaterAuxAuto", "feedwaterMotorCoolingA", "feedwaterMotorCoolingB", "feedwaterOilPreheatA", "feedwaterOilPreheatB"],
  deaerator: ["daIntakeValve", "daOuttakeValve", "daIntakeDirection", "daOuttakeDirection", "daAuto", "daFastCloseHeld", "daBypassValve", "daMainAirValve", "daRuptureDisk"],
  "reactor-hall": ["selectedRodId", "rodDirection", "selectionScope", "mode", "irmRange"],
};
const pickControls = (controls: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((key) => key in controls).map((key) => [key, controls[key]]));
const controlsMatch = (expected: Record<string, unknown>, actual: Record<string, unknown>) =>
  Object.entries(expected).every(([key, value]) => JSON.stringify(actual[key]) === JSON.stringify(value));
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const STORAGE = "rbwr-u2-sim-v4";
// Demand follows the intended unit operating envelope: low-load dispatch at
// roughly 300 and a full-power call near 1,200 on the generator display.
const newGridDemand = () => Math.round(300 + Math.random() * 900);
const newDemandInterval = () => Math.round(360 + Math.random() * 280);

export default function ReactorSimulator() {
  const navigate = useNavigate();
  const location = useLocation();
  const secondaryWindow = new URLSearchParams(location.search).get("window") === "panel";
  const requestedPanel = new URLSearchParams(location.search).get("panel") as Panel | null;
  const unifiedAuthoritySeen = useRef(0);
  const [, refreshAuthority] = useState(0);
  const [plantAssignment] = useState(() => {
    const query = new URLSearchParams(location.search);
    if (query.get("local") === "1") setPlantTransport("local");
    const fromInvite = normalizeAssignment({
      roomCode: query.get("plant") || "",
      unitNumber: Number(query.get("unit")),
      stationId: query.get("station") || "",
    });
    // A plain /reactor route is always the complete solo simulator. Plant
    // participation is opt-in through an explicit invite URL only; never
    // restore an old station role and accidentally lock its controls.
    const assignment = fromInvite;
    if (assignment) savePlantAssignment(assignment);
    return assignment;
  });
  const unitStation = getUnitStation(plantAssignment?.stationId);
  // The Unified Unit console is the preferred live authority. If it is open,
  // MCR follows its snapshots instead of running a competing physics loop.
  // MCR automatically resumes as authority shortly after the Unified console
  // closes, so a dedicated MCR-only session continues to work on its own.
  const unifiedAuthorityActive = unitStation.role === "mcr" && Date.now() - unifiedAuthoritySeen.current < 5_000;
  const isPhysicsAuthority = !plantAssignment || unitStation.role === "unit" || (unitStation.role === "mcr" && !unifiedAuthorityActive);
  useEffect(() => {
    if (!plantAssignment || unitStation.role !== "mcr") return;
    const timer = window.setInterval(() => refreshAuthority((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [plantAssignment, unitStation.role]);
  const unitStateStorageKey = plantAssignment
    ? `rbwr-u2-sim-v4:${plantAssignment.roomCode}:u${plantAssignment.unitNumber}`
    : STORAGE;
  const liveStateStorageKey = plantAssignment
    ? `rbwr-live-plant-state:${plantAssignment.roomCode}:u${plantAssignment.unitNumber}`
    : "rbwr-live-plant-state";
  const [sharedPlant, setSharedPlant] = useState<PlantSnapshot>({ room: null, units: [] });
  const [plantSyncError, setPlantSyncError] = useState("");
  const [plantTransportEpoch, setPlantTransportEpoch] = useState(0);
  const [stationControlsLocked, setStationControlsLocked] = useState(false);
  const [plantClock, setPlantClock] = useState(Date.now());
  const demandManagerOnline = Boolean(
    plantAssignment && sharedPlant.room?.demand_manager_last_seen &&
    sharedPlant.room.demand_manager_enabled !== false &&
    plantClock - Date.parse(sharedPlant.room.demand_manager_last_seen) < 15000,
  );
  const [active, setActive] = useState<Panel>(() =>
    requestedPanel && panels.includes(requestedPanel) ? requestedPanel : "status",
  );
  useEffect(() => {
    const refresh = () => setPlantTransportEpoch(value => value + 1);
    const onStorage = (event: StorageEvent) => { if (event.key === "unit2-plant-transport") refresh(); };
    window.addEventListener("unit2-plant-transport", refresh);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("unit2-plant-transport", refresh); window.removeEventListener("storage", onStorage); };
  }, []);
  const stationCanOperate = unitStation.panels.includes(active);
  useEffect(() => {
    if (unitStation.role !== "mcr" && !unitStation.panels.includes(active)) setActive("status");
  }, [active, unitStation.role]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  // Panel stations never advance their own physics clock. The primary unit
  // remains the simulation authority, avoiding parallel-clock drift.
  const [simulationPaused, setSimulationPaused] = useState(secondaryWindow || !isPhysicsAuthority);
  // Keep every simulation clock dormant until durable plant state has hydrated.
  // This prevents a refresh from running cold-default physics for a tick.
  const simulationPausedRef = useRef(true);
  useEffect(() => {
    if (!isPhysicsAuthority) setSimulationPaused(true);
  }, [isPhysicsAuthority]);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [tutorialEnabled, setTutorialEnabled] = useState(
    () => localStorage.getItem("unit2-tutorial-enabled") === "true",
  );
  const [tutorialLevel, setTutorialLevel] = useState(() =>
    Math.max(1, Math.min(TUTORIAL_LEVELS.length, Number(localStorage.getItem("unit2-tutorial-level") || 1))),
  );
  // Early lessons use the previous safe bypasses; later lessons progressively
  // expose the full plant instead of offering a separate Simple Mode.
  const simpleMode = tutorialEnabled && tutorialLevel === 6;
  // Snapshot payloads may originate from storage, BroadcastChannel, or a remote unit.
  // Keep their boundary permissive, then validate individual fields before applying them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyPanelSnapshot = (saved: any) => {
    if (!saved || typeof saved !== "object") return;
    if (saved.rods?.length === 36) setRods(saved.rods);
    if (typeof saved.temperature === "number") setTemperature(saved.temperature);
    if (typeof saved.pressure === "number") setPressure(saved.pressure);
    if (typeof saved.fuelLevel === "number") setFuelLevel(saved.fuelLevel);
    if (typeof saved.gridSync === "number") setGridSync(saved.gridSync);
    if (typeof saved.turbineSpeed === "number") setTurbineSpeed(saved.turbineSpeed);
    if (typeof saved.targetTurbineSpeed === "number") setTargetTurbineSpeed(saved.targetTurbineSpeed);
    if (typeof saved.pressureRate === "number") setPressureRate(saved.pressureRate);
    if (typeof saved.rodAprm === "number") { setRodAprm(saved.rodAprm); rodAprmRef.current = saved.rodAprm; }
    if (typeof saved.recirculationAprm === "number") setRecirculationAprm(saved.recirculationAprm);
    if (typeof saved.periodRecirculationAprm === "number") setPeriodRecirculationAprm(saved.periodRecirculationAprm);
    if (typeof saved.oilTemperature === "number") setOilTemperature(saved.oilTemperature);
    if (typeof saved.turbineMetalTemperature === "number") setTurbineMetalTemperature(saved.turbineMetalTemperature);
    if (typeof saved.reactorLevel === "number") setReactorLevel(saved.reactorLevel);
    if (typeof saved.hotwellLevel === "number") setHotwellLevel(saved.hotwellLevel);
    if (typeof saved.deaeratorLevel === "number") setDeaeratorLevel(saved.deaeratorLevel);
    if (typeof saved.condenserVacuum === "number") setCondenserVacuum(saved.condenserVacuum);
    if (typeof saved.mode === "string") setMode(saved.mode);
    if (typeof saved.iprCycle === "number") setIprCycle(Math.max(1, Math.min(8, saved.iprCycle)));
    if (typeof saved.irmRange === "number") setIrmRange(Math.max(1, Math.min(8, saved.irmRange)));
    if (typeof saved.isRunning === "boolean") setIsRunning(saved.isRunning);
    if (typeof saved.bypassValve === "number") setBypassValve(saved.bypassValve);
    if (typeof saved.valveValue === "number") setValveValue(saved.valveValue);
    if (typeof saved.offsitePowerAvailable === "boolean") setOffsitePowerAvailable(saved.offsitePowerAvailable);
    if (typeof saved.daTemperature === "number") setDaTemperature(saved.daTemperature);
    if (typeof saved.daPressure === "number") setDaPressure(saved.daPressure);
    if (saved.physicsTuning && typeof saved.physicsTuning === "object") setPhysicsTuning(current => ({ ...current, ...saved.physicsTuning }));
    const controls = saved.controls || {};
    const apply = (key: string, setter: (value: never) => void) => { if (typeof controls[key] !== "undefined") setter(controls[key] as never); };
    apply("mainSteamInletOpen", setMainSteamInletOpen); apply("reliefOpen", setReliefOpen); apply("reliefValveB", setReliefValveB); apply("exciterOn", setExciterOn); apply("isLocked", setIsLocked); apply("turbinePressureAuto", setTurbinePressureAuto); apply("turbineRpmAuto", setTurbineRpmAuto);
    apply("pump1Online", setPump1Online); apply("pump2Online", setPump2Online); apply("daIntakeOpen", setDaIntakeOpen); apply("daOutputOpen", setDaOutputOpen); apply("daIntakeValve", setDaIntakeValve); apply("daOuttakeValve", setDaOuttakeValve); apply("daIntakeDirection", setDaIntakeDirection); apply("daOuttakeDirection", setDaOuttakeDirection); apply("daAuto", setDaAuto); apply("daBypassValve", setDaBypassValve); apply("daMainAirValve", setDaMainAirValve); apply("daRuptureDisk", setDaRuptureDisk);
    apply("recircPumpA", setRecircPumpA); apply("recircPumpB", setRecircPumpB); apply("recircSpeedA", setRecircSpeedA); apply("recircSpeedB", setRecircSpeedB); apply("selectedRodId", setSelectedRodId); apply("rodDirection", setRodDirection); apply("selectionScope", setSelectionScope); apply("autoEnabled", setAutoEnabled); apply("autoTarget", setAutoTarget); apply("autoSpeed", setAutoSpeed); apply("autoMode", setAutoMode); apply("malfunctions", setMalfunctions);
    apply("condensateFlow", setCondensateFlow); apply("condensatePumpBFlow", setCondensatePumpBFlow); apply("feedwaterFlow", setFeedwaterFlow); apply("feedwaterPumpBFlow", setFeedwaterPumpBFlow); apply("feedwaterAuxAuto", setFeedwaterAuxAuto); apply("feedwaterMotorCoolingA", setFeedwaterMotorCoolingA); apply("feedwaterMotorCoolingB", setFeedwaterMotorCoolingB); apply("feedwaterOilPreheatA", setFeedwaterOilPreheatA); apply("feedwaterOilPreheatB", setFeedwaterOilPreheatB); apply("condenserPumpOn", setCondenserPumpOn); apply("condenserPumpB", setCondenserPumpB); apply("condenserValve", setCondenserValve); apply("condenserValveDirection", setCondenserValveDirection); apply("condenserAuto", setCondenserAuto); apply("carAOn", setCarAOn); apply("carBOn", setCarBOn); apply("sjaeOn", setSjaeOn); apply("mccPumpOn", setMccPumpOn); apply("mccAutoOn", setMccAutoOn); apply("condenserCirculationPumpOn", setCondenserCirculationPumpOn); apply("condenserCirculationPumpB", setCondenserCirculationPumpB);
    apply("startupBusA", setStartupBusA); apply("busATransformer", setBusATransformer); apply("turbineBusB", setTurbineBusB); apply("safetyBusS", setSafetyBusS); apply("edgBreaker", setEdgBreaker); apply("edgAuto", setEdgAuto); apply("edgSelected", setEdgSelected); apply("edgIgnitionBreaker", setEdgIgnitionBreaker); apply("edgOutputBreaker", setEdgOutputBreaker); apply("edgStartRequested", setEdgStartRequested); apply("edgRpm", setEdgRpm); apply("edgTankLevel", setEdgTankLevel); apply("edgFuelA", setEdgFuelA); apply("edgFuelB", setEdgFuelB); apply("edgMainFuelValve", setEdgMainFuelValve); apply("edgMainFuelPump", setEdgMainFuelPump); apply("edgFuelValveA", setEdgFuelValveA); apply("edgFuelValveB", setEdgFuelValveB); apply("edgRefuellingSeconds", setEdgRefuellingSeconds); apply("acDcInterlock", setAcDcInterlock); apply("safetyToDcBreaker", setSafetyToDcBreaker); apply("busEToDcBreaker", setBusEToDcBreaker); apply("mainBatteryCharge", setMainBatteryCharge); apply("rolldownProtection", setRolldownProtection); apply("cstLevel", setCstLevel); apply("cstMakeup", setCstMakeup); apply("cstDrain", setCstDrain); apply("hotwellMakeup", setHotwellMakeup); apply("hotwellDrain", setHotwellDrain);
    apply("rcicValve", setRcicValve); apply("rcicFlow", setRcicFlow); apply("eccsPumpA", setEccsPumpA); apply("eccsPumpB", setEccsPumpB); apply("eccsPumpAMode", setEccsPumpAMode); apply("eccsPumpBMode", setEccsPumpBMode); apply("srvOpen", setSrvOpen); apply("adsActive", setAdsActive);
    apply("lubePumpSource", setLubePumpSource); apply("hydraulicPumpSource", setHydraulicPumpSource); apply("coldOilValve", setColdOilValve); apply("warmOilValve", setWarmOilValve); apply("turningGear", setTurningGear); apply("preheatValve", setPreheatValve); apply("steamSealing", setSteamSealing); apply("steamSealingLeak", setSteamSealingLeak); apply("polisherTrainA", setPolisherTrainA); apply("polisherTrainB", setPolisherTrainB); apply("polisherAuto", setPolisherAuto); apply("polisherBypass", setPolisherBypass); apply("polisherTarget", setPolisherTarget); apply("polisherTanks", setPolisherTanks); apply("tutorialEnabled", setTutorialEnabled); apply("tutorialLevel", setTutorialLevel);
  };
  useEffect(() => {
    document.body.dataset.rbwrPanel = active;
    return () => {
      delete document.body.dataset.rbwrPanel;
    };
  }, [active]);
  useEffect(() => {
    const timer = window.setInterval(() => setPlantClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    simulationPausedRef.current = simulationPaused || !sessionRestored;
  }, [simulationPaused, sessionRestored]);
  const [temperature, setTemperature] = useState(25);
  const [pressure, setPressure] = useState(101);
  const [fuelLevel, setFuelLevel] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [gridSync, setGridSync] = useState(0);
  const [turbineSpeed, setTurbineSpeed] = useState(0);
  const [targetTurbineSpeed, setTargetTurbineSpeed] = useState(0);
  const [valveValue, setValveValue] = useState(0);
  const [valveDirection, setValveDirection] = useState(0);
  const [mainSteamInletOpen, setMainSteamInletOpen] = useState(false);
  const [bypassValve, setBypassValve] = useState(100);
  const [bypassDirection, setBypassDirection] = useState(0);
  const [reliefOpen, setReliefOpen] = useState(false);
  const [reliefValveB, setReliefValveB] = useState(false);
  const [exciterOn, setExciterOn] = useState(false);
  const [pressureRate, setPressureRate] = useState(0);
  const [turbinePressureAuto, setTurbinePressureAuto] = useState(false);
  const [turbineRpmAuto, setTurbineRpmAuto] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [pump1Online, setPump1Online] = useState(false);
  const [pump2Online, setPump2Online] = useState(false);
  const [daIntakeOpen, setDaIntakeOpen] = useState(true);
  const [daOutputOpen, setDaOutputOpen] = useState(true);
  const [daIntakeValve, setDaIntakeValve] = useState(100);
  const [daOuttakeValve, setDaOuttakeValve] = useState(100);
  const [daIntakeDirection, setDaIntakeDirection] = useState(0);
  const [daOuttakeDirection, setDaOuttakeDirection] = useState(0);
  const [daTemperature, setDaTemperature] = useState(110);
  const [daPressure, setDaPressure] = useState(1.5);
  const [daBypassValve, setDaBypassValve] = useState(false);
  const [daMainAirValve, setDaMainAirValve] = useState(true);
  const [daRuptureDisk, setDaRuptureDisk] = useState<"intact" | "ruptured" | "removed" | "replaced">("intact");
  const [daAuto, setDaAuto] = useState(false);
  const [recircPumpA, setRecircPumpA] = useState(false);
  const [recircPumpB, setRecircPumpB] = useState(false);
  const [recircSpeedA, setRecircSpeedA] = useState(0);
  const [recircSpeedB, setRecircSpeedB] = useState(0);
  const [malfunctions, setMalfunctions] = useState<Malfunctions>({
    enabled: false,
    recircAFlowLossActive: false,
    recircBFlowLossActive: false,
  });
  const [gridDemandMW, setGridDemandMW] = useState(newGridDemand);
  const [nextGridDemandMW, setNextGridDemandMW] = useState(newGridDemand);
  const [secondsToDemandChange, setSecondsToDemandChange] = useState(newDemandInterval);
  const [randomEventsEnabled, setRandomEventsEnabled] = useState(false);
  const [pendingGridEvent, setPendingGridEvent] = useState<"loop" | null>(null);
  const [offsitePowerAvailable, setOffsitePowerAvailable] = useState(true);
  const [offsiteCountdown, setOffsiteCountdown] = useState<number | null>(null);
  const randomEventsEnabledRef = useRef(randomEventsEnabled);
  const pendingGridEventRef = useRef<"loop" | null>(pendingGridEvent);
  const [automationCooldowns, setAutomationCooldowns] = useState({ aprm: 0, mcc: 0, pressure: 0, condenser: 0 });
  const [operatorName, setOperatorName] = useState(() => localStorage.getItem("unit2-operator-name") || "");
  const [tooltipsEnabled, setTooltipsEnabled] = useState(() => localStorage.getItem("unit2-tooltips-enabled") !== "false");
  const [leaderboard, setLeaderboard] = useState<Record<string, { points: number; unit1?: number; unit2?: number; lastSeen: number }>>(() => {
    try { return JSON.parse(localStorage.getItem("unit2-operator-scores") || "{}"); } catch { return {}; }
  });
  const [daFastCloseHeld, setDaFastCloseHeld] = useState(false);
  const [rods, setRods] = useState<ControlRod[]>(createInitialRods);
  const [selectedRodId, setSelectedRodId] = useState("A1");
  const [mode, setMode] = useState<ReactorMode>("SD");
  const [iprCycle, setIprCycle] = useState(1);
  // The IRM range lever only changes the monitor scale. iprCycle remains the
  // independent physical startup programme that establishes the withdrawal block.
  const [irmRange, setIrmRange] = useState(1);
  const [rodDirection, setRodDirection] = useState(0);
  const [rodBlockAlarm, setRodBlockAlarm] = useState<"SRM" | "IPR" | null>(null);
  const [selectionScope, setSelectionScope] =
    useState<RodSelectionScope>("rod");
  const [reactorPeriod, setReactorPeriod] = useState(999);
  const [periodRecirculationAprm, setPeriodRecirculationAprm] = useState(0);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoTarget, setAutoTarget] = useState(1);
  const [autoSpeed, setAutoSpeed] = useState<AutoSpeed>("medium");
  const [autoMode, setAutoMode] = useState<"rods" | "recirculation">("rods");
  const [autoMessage, setAutoMessage] = useState("Auto APRM is standing by.");
  const [recirculationAprm, setRecirculationAprm] = useState(0);
  const [physicsTuning, setPhysicsTuning] = useState<PhysicsTuning>({
    thermalResponse: 1,
    steamProduction: 1,
    steamRemoval: 1,
    tripTemperature: 1100,
  });
  const [reactorLevel, setReactorLevel] = useState(0);
  const [hotwellLevel, setHotwellLevel] = useState(0);
  const [deaeratorLevel, setDeaeratorLevel] = useState(0);
  const [condensateFlow, setCondensateFlow] = useState(0);
  const [condensatePumpBFlow, setCondensatePumpBFlow] = useState(0);
  const [feedwaterFlow, setFeedwaterFlow] = useState(0);
  const [feedwaterPumpBFlow, setFeedwaterPumpBFlow] = useState(0);
  const [feedwaterAuxAuto, setFeedwaterAuxAuto] = useState(true);
  const [feedwaterMotorCoolingA, setFeedwaterMotorCoolingA] = useState(35);
  const [feedwaterMotorCoolingB, setFeedwaterMotorCoolingB] = useState(35);
  const [feedwaterOilPreheatA, setFeedwaterOilPreheatA] = useState(false);
  const [feedwaterOilPreheatB, setFeedwaterOilPreheatB] = useState(false);
  const [condenserVacuum, setCondenserVacuum] = useState(1);
  const [condenserPumpOn, setCondenserPumpOn] = useState(false);
  const [condenserPumpB, setCondenserPumpB] = useState(false);
  const [condenserValve, setCondenserValve] = useState(0);
  const [condenserValveDirection, setCondenserValveDirection] = useState(0);
  const [condenserAuto, setCondenserAuto] = useState(false);
  const [carAOn, setCarAOn] = useState(false);
  const [carBOn, setCarBOn] = useState(false);
  const [sjaeOn, setSjaeOn] = useState(false);
  const [mccLevel, setMccLevel] = useState(100);
  const [mccPumpOn, setMccPumpOn] = useState(false);
  const [mccAutoOn, setMccAutoOn] = useState(false);
  const [scramPressed, setScramPressed] = useState(false);
  const [rpsTrips, setRpsTrips] = useState<Record<string, boolean>>({
    "REACTOR LEVEL": false,
    "MANUAL TRIP": false,
    "LOOP TRIP": false,
    "CORE TEMPERATURE": false,
    "RPV PRESSURE": false,
    "LOW REACTOR PERIOD": false,
    "TURBINE VACUUM": false,
    "TURBINE ROLLDOWN": false,
  });
  const [rpsTripInhibit, setRpsTripInhibit] = useState(
    () => localStorage.getItem("rbwr-rps-trip-inhibit") === "true",
  );
  const [event, setEvent] = useState(
    "Cold shutdown — select SRM to begin startup.",
  );
  const [condenserCirculationPumpOn, setCondenserCirculationPumpOn] =
    useState(false);
  const [condenserCirculationPumpB, setCondenserCirculationPumpB] =
    useState(false);
  const [startupBusA, setStartupBusA] = useState(false);
  const [busATransformer, setBusATransformer] = useState(false);
  const [turbineBusB, setTurbineBusB] = useState(false);
  const [safetyBusS, setSafetyBusS] = useState(false);
  const [edgBreaker, setEdgBreaker] = useState(false);
  const [edgAuto, setEdgAuto] = useState(true);
  const [edgSelected, setEdgSelected] = useState<"u2a" | "u2b">("u2a");
  const [edgIgnitionBreaker, setEdgIgnitionBreaker] = useState(false);
  const [edgOutputBreaker, setEdgOutputBreaker] = useState(false);
  const [edgStartRequested, setEdgStartRequested] = useState(false);
  const [edgRpm, setEdgRpm] = useState(0);
  const [edgTankLevel, setEdgTankLevel] = useState(100);
  const [edgFuelA, setEdgFuelA] = useState(100);
  const [edgFuelB, setEdgFuelB] = useState(100);
  const [edgMainFuelValve, setEdgMainFuelValve] = useState(false);
  const [edgMainFuelPump, setEdgMainFuelPump] = useState(false);
  const [edgFuelValveA, setEdgFuelValveA] = useState(false);
  const [edgFuelValveB, setEdgFuelValveB] = useState(false);
  const [edgRefuellingSeconds, setEdgRefuellingSeconds] = useState(0);
  const [acDcInterlock, setAcDcInterlock] = useState(false);
  const [safetyToDcBreaker, setSafetyToDcBreaker] = useState(false);
  const [busEToDcBreaker, setBusEToDcBreaker] = useState(false);
  const [mainBatteryCharge, setMainBatteryCharge] = useState(100);
  const [rolldownProtection, setRolldownProtection] = useState(true);
  const [cstLevel, setCstLevel] = useState(8);
  const [cstMakeup, setCstMakeup] = useState(false);
  const [cstDrain, setCstDrain] = useState(false);
  const [hotwellMakeup, setHotwellMakeup] = useState(false);
  const [hotwellDrain, setHotwellDrain] = useState(false);
  const [rcicValve, setRcicValve] = useState(false);
  const [rcicFlow, setRcicFlow] = useState(0);
  const [eccsPumpA, setEccsPumpA] = useState(false);
  const [eccsPumpB, setEccsPumpB] = useState(false);
  const [eccsPumpAMode, setEccsPumpAMode] = useState<"RHR" | "LPCI">("RHR");
  const [eccsPumpBMode, setEccsPumpBMode] = useState<"RHR" | "LPCI">("RHR");
  const [srvOpen, setSrvOpen] = useState<boolean[]>(() => Array(6).fill(false));
  const [adsActive, setAdsActive] = useState(false);
  const [lubePumpSource, setLubePumpSource] = useState<
    "aux" | "emergency" | "off"
  >("off");
  const [hydraulicPumpSource, setHydraulicPumpSource] = useState<
    "aux" | "emergency" | "off"
  >("off");
  const [coldOilValve, setColdOilValve] = useState(0);
  const [warmOilValve, setWarmOilValve] = useState(0);
  const [turningGear, setTurningGear] = useState(false);
  const [preheatValve, setPreheatValve] = useState(false);
  const [steamSealing, setSteamSealing] = useState(false);
  const [steamSealingLeak, setSteamSealingLeak] = useState(false);
  const [polisherTrainA, setPolisherTrainA] = useState(false);
  const [polisherTrainB, setPolisherTrainB] = useState(false);
  const [polisherAuto, setPolisherAuto] = useState(false);
  const [polisherBypass, setPolisherBypass] = useState(false);
  const [polisherTarget, setPolisherTarget] = useState<PolisherTarget>("A");
  const [polisherTankSelection, setPolisherTankSelection] = useState<1 | 2 | 3>(1);
  const [polisherTanks, setPolisherTanks] = useState<RegenTank[]>([
    { id: 1, stage: "ready", progress: 100, target: null },
    { id: 2, stage: "ready", progress: 100, target: null },
    { id: 3, stage: "ready", progress: 100, target: null },
  ]);
  useEffect(() => {
    if (!isPhysicsAuthority) return;
    const timer = window.setInterval(() => {
      setPolisherTanks((previous) => previous.map((tank) => {
        const duration = tank.stage === "water" || tank.stage === "air" || tank.stage === "refill" ? 30 : tank.stage === "regenerating" ? 60 : 0;
        if (!duration) return tank;
        const progress = Math.min(100, tank.progress + 100 / duration);
        if (progress < 100) return { ...tank, progress };
        if (tank.stage === "water") return { ...tank, stage: "water-done", progress: 100 };
        if (tank.stage === "air") return { ...tank, stage: "air-done", progress: 100 };
        if (tank.stage === "refill") return { ...tank, stage: "regen-hold", progress: 0 };
        return { ...tank, stage: "ready", progress: 100, target: null };
      }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPhysicsAuthority]);
  const [oilTemperature, setOilTemperature] = useState(25);
  const [turbineMetalTemperature, setTurbineMetalTemperature] = useState(25);
  const [turbineSmoke, setTurbineSmoke] = useState<
    "idle" | "countdown" | "aborted" | "released"
  >("idle");
  const [agentSeconds, setAgentSeconds] = useState(10);
  const previousSync = useRef(false);
  const daFastCloseAudio = useRef<{
    context: AudioContext | null;
    source: AudioBufferSourceNode | null;
    buffer: AudioBuffer | null;
    wasHeld: boolean;
  }>({ context: null, source: null, buffer: null, wasHeld: false });
  const mccAutoManualAdjusting = useRef(false);
  const tripAlarm = useRef<HTMLAudioElement | null>(null);
  const transferStateLoaded = useRef(false);
  const panelSyncChannel = useRef<BroadcastChannel | null>(null);
  const unitRealtimeChannel = useRef<ReturnType<typeof openUnitLiveChannel> | null>(null);
  const suppressPanelBroadcastUntil = useRef(0);
  const lastSpecialistControlPayload = useRef("");
  const pendingSpecialistControls = useRef<Record<string, unknown> | null>(null);
  const pressureSample = useRef({ value: 101, time: performance.now() });
  const condenserTargetRef = useRef(1);
  const condenserPhaseRef = useRef(0);
  // Keep the condenser clock independent from frequently changing steam flow.
  // Recreating its interval on every physics update prevented it from ever
  // getting a full one-second tick while the reactor was producing steam.
  const condenserControlRef = useRef({
    condenserValve: 0,
    carAOn: false,
    carBOn: false,
    condenserCirculationPumpOn: false,
    condenserCirculationPumpB: false,
    startupBusAvailable: false,
    busBAvailable: false,
    sjaeOn: false,
    steamFlow: 0,
  });
  const [remoteLeaderboardReady, setRemoteLeaderboardReady] = useState(false);
  const pendingScoreRef = useRef(0);
  const pressureGovernorRef = useRef({
    isRunning: false,
    mainSteamInletOpen: false,
    pressure: 101,
    pressureRate: 0,
  });
  const aprmSample = useRef({ value: 0, time: performance.now(), logRate: 0 });
  const periodAprmRef = useRef(0);
  const rodAprmRef = useRef(0);
  const rodKineticsRef = useRef({ observed: 0, target: 0, startedAt: 0, intensity: 0, origin: 0 });
  const rodBlockTimer = useRef<number | null>(null);
  const completedIrmCycleRef = useRef<number | null>(null);
  const rpmAutoSteamReadyRef = useRef(false);
  const rpmAutoInPhaseSinceRef = useRef<number | null>(null);
  const islandGovernorHoldRef = useRef(false);
  const restoredSteamAdmissionCalibrated = useRef(false);
  const turbineAuxRef = useRef({
    coldOilValve: 0,
    warmOilValve: 0,
    actualRPM: 0,
    simpleMode: false,
    turningGear: false,
    preheatValve: false,
    temperature: 25,
  });
  const mccProcessRef = useRef({
    mccPumpOn: false,
    steamFlow: 0,
    hotwellOutflowKgS: 0,
    daOutflowKgS: 0,
    isRunning: false,
    daIntakeOpen: true,
    daOutputOpen: true,
    simpleMode: false,
  });
  const triggerRodBlock = (block: "SRM" | "IPR") => {
    setRodBlockAlarm(block);
    if (rodBlockTimer.current) window.clearTimeout(rodBlockTimer.current);
    rodBlockTimer.current = window.setTimeout(() => {
      setRodBlockAlarm(null);
      rodBlockTimer.current = null;
    }, 1800);
  };

  useEffect(() => {
    const begin = () => {
      mccAutoManualAdjusting.current = true;
    };
    const end = () => {
      mccAutoManualAdjusting.current = false;
    };
    window.addEventListener("rbwr-slider-adjust-start", begin);
    window.addEventListener("rbwr-slider-adjust-end", end);
    return () => {
      window.removeEventListener("rbwr-slider-adjust-start", begin);
      window.removeEventListener("rbwr-slider-adjust-end", end);
    };
  }, []);

  const averageInsertion = useMemo(
    () => rods.reduce((sum, rod) => sum + rod.position, 0) / rods.length,
    [rods],
  );
  // Rod position is reactivity demand, not instant thermal power. Keep the
  // commanded value separate from rod-derived APRM so startup power builds as
  // the core responds instead of jumping at the instant a drive begins moving.
  const rodReactivityAprm = useMemo(() => getAprm(rods), [rods]);
  const [rodAprm, setRodAprm] = useState(0);
  // Electrical availability is deliberately derived before process flow. A
  // commanded pump remains shown as requested, but it cannot move water or
  // add load until its supplying bus is energized.
  // The turbine can supply its auxiliaries either synchronized to the grid or
  // islanded inside the ±50 RPM sync window. A closed transformer breaker by
  // itself is never a source of power.
  const turbineBusEligible =
    isLocked || Math.abs(turbineSpeed * 45 - 3000) <= 50;
  const locallySuppliedBusA =
    (offsitePowerAvailable && startupBusA) || (busATransformer && turbineBusEligible);
  const interlockSource = plantAssignment && sharedPlant.room?.interlock_enabled &&
    sharedPlant.room.interlock_target_unit === plantAssignment.unitNumber
    ? sharedPlant.units.find((unit) => unit.unit_number === sharedPlant.room?.interlock_source_unit)
    : null;
  // Interlock is a one-way electrical tie. The transmitting unit must already
  // have a genuinely energized Bus A from offsite, islanding, or a synchronized generator.
  const interlockTargetConfigured = Boolean(
    plantAssignment &&
      sharedPlant.room?.interlock_enabled &&
      sharedPlant.room.interlock_target_unit === plantAssignment.unitNumber,
  );
  const interlockTargeted = Boolean(
    interlockTargetConfigured &&
      sharedPlant.room?.interlock_breaker_closed,
  );
  const interlockBusAFeed = Boolean(
    interlockTargeted &&
      sharedPlant.room?.interlock_breaker_closed &&
      interlockSource?.bus_a_transformer_closed,
  );
  const unitInterlockStatus = !plantAssignment || !sharedPlant.room?.interlock_enabled
    ? "OFFLINE"
    : sharedPlant.room.interlock_source_unit === plantAssignment.unitNumber
      ? locallySuppliedBusA ? "SUPPLYING" : "SOURCE UNPOWERED"
    : !sharedPlant.room.interlock_breaker_closed ? "TIE BREAKER OPEN" : interlockBusAFeed ? "FEEDING BUS A" : startupBusA ? "WAITING FOR SOURCE" : "TARGET BREAKER OPEN";
  const startupBusAvailable = locallySuppliedBusA || interlockBusAFeed;
  const busBAvailable = turbineBusB && turbineBusEligible;
  // With both turbine-fed auxiliaries closed, Bus A and Bus B are supplied
  // from one generator auxiliary pool instead of two isolated 60 kW limits.
  // A single bus may use nearly all of it; only their combined demand trips.
  const sharedTurbineCapacityActive =
    busATransformer && !startupBusA && turbineBusB && turbineBusEligible;
  const selectedEdgFuel = edgSelected === "u2a" ? edgFuelA : edgFuelB;
  const edgReady = edgIgnitionBreaker && selectedEdgFuel > 1;
  const edgSupplyingBusS = edgBreaker && edgOutputBreaker && edgRpm >= 1790 && selectedEdgFuel > 0;
  // Bus S may be supplied from Unit 2 Bus A or directly from one running U2
  // EDG. The two sources are never paralleled: the EDG main breaker opens the
  // normal Bus A → Bus S breaker as it closes.
  const safetyBusAvailable = (safetyBusS && startupBusAvailable) || edgSupplyingBusS;
  const mainBatteryAvailable = mainBatteryCharge > 0.5;
  // Bus E is fed by the charged battery, or directly from Bus S through the
  // AC/DC interlock. An open interlock is not itself a source of Bus E power.
  const busEAvailable =
    mainBatteryAvailable || (acDcInterlock && safetyBusAvailable);
  const dcBusAvailable =
    (safetyToDcBreaker && safetyBusAvailable) ||
    (busEToDcBreaker && busEAvailable);
  useEffect(() => {
    if (!isPhysicsAuthority) return;
    const tick = window.setInterval(() => {
      if (edgRefuellingSeconds > 0) {
        setEdgRefuellingSeconds(value => Math.max(0, value - 1));
        setEdgTankLevel(value => Math.min(100, value + 100 / 180));
        setEdgMainFuelPump(false);
        return;
      }
      const selectedFuel = edgSelected === "u2a" ? edgFuelA : edgFuelB;
      if (edgStartRequested && selectedFuel <= 0) {
        setEdgStartRequested(false);
        setEdgOutputBreaker(false);
        setEdgBreaker(false);
        setEvent("EDG FUEL EXHAUSTED — UNIT 2 SAFETY BUS SUPPLY LOST.");
        return;
      }
      if (edgStartRequested && edgIgnitionBreaker && selectedFuel > 0) {
        setEdgRpm(value => Math.min(1800, value + 120));
      } else if (!edgStartRequested) {
        setEdgRpm(value => Math.max(0, value - 240));
      }
      if (edgStartRequested && edgRpm >= 1790) {
        if (edgSelected === "u2a") setEdgFuelA(value => Math.max(0, value - 0.015));
        else setEdgFuelB(value => Math.max(0, value - 0.015));
      }
      if (edgMainFuelPump && edgMainFuelValve && edgTankLevel > 0) {
        if (edgFuelValveA && edgFuelA < 100) { setEdgFuelA(value => Math.min(100, value + 0.35)); setEdgTankLevel(value => Math.max(0, value - 0.35)); }
        if (edgFuelValveB && edgFuelB < 100) { setEdgFuelB(value => Math.min(100, value + 0.35)); setEdgTankLevel(value => Math.max(0, value - 0.35)); }
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [isPhysicsAuthority, edgRefuellingSeconds, edgSelected, edgFuelA, edgFuelB, edgStartRequested, edgIgnitionBreaker, edgRpm, edgMainFuelPump, edgMainFuelValve, edgFuelValveA, edgFuelValveB, edgTankLevel]);
  useEffect(() => {
    if (!isPhysicsAuthority || !edgAuto) return;
    if (edgSelected === "u2a" && edgFuelA <= 1 && edgFuelB > 1) setEdgSelected("u2b");
    if (edgSelected === "u2b" && edgFuelB <= 1 && edgFuelA > 1) setEdgSelected("u2a");
  }, [isPhysicsAuthority, edgAuto, edgSelected, edgFuelA, edgFuelB]);
  useEffect(() => {
    if (!plantAssignment || !interlockTargeted || !busATransformer) return;
    setBusATransformer(false);
    setEvent("UNIT INTERLOCK ACTIVE — target Bus A transformer opened for phase separation.");
  }, [plantAssignment, interlockTargeted, busATransformer]);
  const busAConsumerCommanded =
    condenserCirculationPumpOn ||
    condenserPumpOn ||
    pump1Online ||
    recircPumpA ||
    recircPumpB ||
    cstMakeup ||
    cstDrain ||
    hotwellMakeup ||
    hotwellDrain;
  const busBConsumerCommanded =
    condenserCirculationPumpB || condenserPumpB || pump2Online;
  const safetyConsumerCommanded =
    (rcicValve && rcicFlow > 0) || eccsPumpA || eccsPumpB;
  const dcConsumerCommanded =
    lubePumpSource === "emergency" || hydraulicPumpSource === "emergency";
  const recircAFlow = recircPumpA && startupBusAvailable
    ? Math.max(0, recircSpeedA * 20 - (malfunctions.recircAFlowLossActive ? 20 : 0))
    : 0;
  const recircBFlow = recircPumpB && startupBusAvailable
    ? Math.max(0, recircSpeedB * 20 - (malfunctions.recircBFlowLossActive ? 20 : 0))
    : 0;
  // The two 2,000 kg/s recirculation pumps provide up to 50 APRM points at
  // full flow. Rods can supply 75 APRM, but total indicated unit power is
  // still protected by the 105% operating limit below.
  const recirculationTargetAprm = (recircAFlow + recircBFlow) * 0.0125;
  const tutorialAprmHold = tutorialEnabled && (tutorialLevel === 5 || tutorialLevel === 6 || tutorialLevel === 7) ? 20 : null;
  const aprm = tutorialAprmHold ?? clamp(
    (Number.isFinite(rodAprm) ? rodAprm : 0) +
      (Number.isFinite(recirculationAprm) ? recirculationAprm : 0),
    0,
    105,
  );
  // The rod-drive clock must not be recreated whenever delayed thermal
  // feedback changes APRM. Keep those live physics values in a ref for the
  // auto-controller, leaving the physical drive clock uninterrupted.
  const rodDrivePhysicsRef = useRef({ aprm, recirculationAprm, recirculationTargetAprm });
  useEffect(() => {
    rodDrivePhysicsRef.current = { aprm, recirculationAprm, recirculationTargetAprm };
  }, [aprm, recirculationAprm, recirculationTargetAprm]);
  // Failure modes are armed by the Systems page but only become possible
  // during actual pump operation. This makes them training scenarios rather
  // than instantaneous operator-injected faults.
  useEffect(() => {
    setMalfunctions((previous) => {
      const next = { ...previous };
      if (!next.enabled) { next.recircAFlowLossActive = false; next.recircBFlowLossActive = false; }
      return next;
    });
    const tick = window.setInterval(() => {
      if (simulationPausedRef.current) return;
      setMalfunctions((previous) => {
        const next = { ...previous };
        // 2% every five seconds while a demand exists: uncommon enough to
        // diagnose, but repeatable during an active training session.
        if (next.enabled && !next.recircAFlowLossActive && recircPumpA && recircSpeedA > 10 && Math.random() < .02) {
          next.recircAFlowLossActive = true;
          setEvent("MALFUNCTION EVENT — RECIRCULATION PUMP A FLOW LOSS.");
        }
        if (next.enabled && !next.recircBFlowLossActive && recircPumpB && recircSpeedB > 10 && Math.random() < .02) {
          next.recircBFlowLossActive = true;
          setEvent("MALFUNCTION EVENT — RECIRCULATION PUMP B FLOW LOSS.");
        }
        return next;
      });
    }, 5000);
    return () => window.clearInterval(tick);
  }, [malfunctions.enabled, recircPumpA, recircPumpB, recircSpeedA, recircSpeedB]);
  const periodAprm = rodAprm + periodRecirculationAprm;
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (simulationPausedRef.current) return;
      const now = performance.now();
      const kinetics = rodKineticsRef.current;
      // HMR/restored sessions can retain an older kinetics-ref shape. Reset
      // it before it can propagate an undefined origin into plant readings.
      if (!Number.isFinite(rodReactivityAprm)) {
        rodKineticsRef.current = { observed: 0, target: 0, startedAt: 0, intensity: 0, origin: 0 };
        rodAprmRef.current = 0;
        setRodAprm(0);
        return;
      }
      if (!Number.isFinite(kinetics.observed) || !Number.isFinite(kinetics.target) || !Number.isFinite(kinetics.origin) || !Number.isFinite(kinetics.startedAt)) {
        kinetics.observed = 0;
        kinetics.target = 0;
        kinetics.startedAt = 0;
        kinetics.intensity = 0;
        kinetics.origin = Number.isFinite(rodAprmRef.current) ? rodAprmRef.current : 0;
      }
      const change = rodReactivityAprm - kinetics.observed;
      if (Math.abs(change) > 0.00001) {
        const rising = change > 0;
        kinetics.intensity = kinetics.intensity * 0.78 + Math.min(1, Math.abs(change) * 4) * 0.22;
        kinetics.observed = rodReactivityAprm;
        kinetics.target = rodReactivityAprm;
        if (!rising || mode === "SD" || !kinetics.startedAt || !Number.isFinite(kinetics.origin)) {
          kinetics.startedAt = now;
          kinetics.origin = rodAprmRef.current;
        }
      } else {
        kinetics.intensity *= 0.94;
      }

      const risingDemand = kinetics.target > rodAprmRef.current + 0.0001;
      // Source and early intermediate range have deliberately slow neutron
      // response. This is a kinetic ramp, not a dead time: indication starts
      // moving immediately, builds toward its fastest change, then eases into
      // the final stable flux/APRM value.
      const averageWithdrawn = 100 - averageInsertion;
      const transitionSeconds = risingDemand && mode !== "RUN"
        ? averageWithdrawn <= 5
          ? 90
          : averageWithdrawn < 10
          ? 90 - (averageWithdrawn - 5) * 14
          : Math.max(8, 20 - (averageWithdrawn - 10) * 0.6)
        : mode === "SD" ? 1.2 : mode === "RUN" ? 2.2 : 5;
      const progress = clamp((now - kinetics.startedAt) / (transitionSeconds * 1000), 0, 1);
      // Cubic smoothstep has zero slope at both ends: no artificial dead-time
      // and no abrupt stop when the indicated reactor response settles.
      const response = progress * progress * (3 - 2 * progress);
      setRodAprm((previous) => {
        const next = Number.isFinite(kinetics.origin + (kinetics.target - kinetics.origin) * response)
          ? kinetics.origin + (kinetics.target - kinetics.origin) * response
          : 0;
        rodAprmRef.current = next;
        if (progress >= 1 || Math.abs(kinetics.target - next) < 0.0002) kinetics.startedAt = 0;
        return next;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [rodReactivityAprm, mode, averageInsertion]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setMainBatteryCharge((charge) => {
        if (safetyBusAvailable) return Math.min(100, charge + 0.35);
        // Bus E carries the control room after a loss of Safety Bus power.
        // DC-fed emergency auxiliaries accelerate the battery discharge.
        const discharge = 0.06 + (dcBusAvailable ? 0.03 : 0) + (dcConsumerCommanded ? 0.18 : 0);
        return Math.max(0, charge - discharge);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [safetyBusAvailable, dcBusAvailable, dcConsumerCommanded]);
  const srmCount = 10 + (Number.isFinite(aprm) ? aprm : 0) * 50000;
  const nextRod = useMemo(
    () => nextWithdrawableRod(rods, mode, iprCycle),
    [rods, mode, iprCycle],
  );
  const thermalOutput = useMemo(() => getU2ThermalOutput(aprm), [aprm]);
  const steamPressureFactor = clamp(pressure / 7100, 0.25, 1.5);
  // Each displayed valve has deliberately generous travel authority. This
  // leaves the operator useful room to regulate at mid-power instead of
  // parking either steam path at 90–100% merely to hold nominal pressure.
  const steamPathCapacity = 1.8;
  const requestedTurbineSteamFlow =
    isRunning && mainSteamInletOpen
      ? thermalOutput.steamKgS * steamPathCapacity * (valveValue / 100) * steamPressureFactor
      : 0;
  const requestedBypassSteamFlow = isRunning
    ? thermalOutput.steamKgS * steamPathCapacity * (bypassValve / 100) * steamPressureFactor
    : 0;
  // Steam admission is pressure-driven, but the turbine and bypass cannot
  // remove more mass than the reactor is producing.  Without this shared
  // source limit, a wide-open path removed 1.8× production and made main
  // steam pressure fall as APRM rose.  Scaling both paths together preserves
  // their operator-selected split while keeping the steam balance physical.
  const requestedSteamFlow = requestedTurbineSteamFlow + requestedBypassSteamFlow;
  const steamAllocation = requestedSteamFlow > 0
    ? Math.min(1, thermalOutput.steamKgS / requestedSteamFlow)
    : 1;
  const turbineSteamFlow = requestedTurbineSteamFlow * steamAllocation;
  const bypassSteamFlow = requestedBypassSteamFlow * steamAllocation;
  const steamFlow = turbineSteamFlow + bypassSteamFlow;
  // Persisted sessions created under the earlier pressure equation can carry
  // a fully-open main valve at nominal pressure.  With either governor armed,
  // bring that stale lineup straight into the usable operating band instead
  // of spending a restart dropping pressure while the governor backs it off.
  useEffect(() => {
    if (
      restoredSteamAdmissionCalibrated.current ||
      !sessionRestored ||
      !isRunning ||
      !isLocked ||
      !mainSteamInletOpen ||
      !(turbinePressureAuto || turbineRpmAuto)
    ) return;
    restoredSteamAdmissionCalibrated.current = true;
    if (pressure >= 6000 && pressure <= 8000 && valveValue > 90 && bypassValve < 3) {
      setValveValue(58);
      setEvent("RESTORED STEAM ADMISSION CALIBRATED — main valve returned to nominal control range.");
    }
  }, [sessionRestored, isRunning, isLocked, mainSteamInletOpen, turbinePressureAuto, turbineRpmAuto, pressure, valveValue, bypassValve]);
  // The condenser is at its best around 52 mbar.  Keep the specified
  // 40–70 mbar operating band close to rated performance, then apply a
  // progressively stronger exhaust-loss penalty as back-pressure rises.
  const condenserOffsetFromOptimum = Math.abs(condenserVacuum - 0.052);
  const condenserEfficiency = clamp(
    1 - Math.pow(condenserOffsetFromOptimum / 0.24, 1.25),
    0,
    1,
  );
  // Turbine work follows admitted steam mass flow. Pressure raises flow through
  // the valve; it is not an independent valve-position multiplier.
  const turbineSteamQuality = clamp(pressure / 7100, 0.35, 1.12);
  // Unit 2 is a nominal 1,200 MW unit. Steam-path changes can change how
  // readily that load is reached, but cannot turn it into an unbounded
  // generator rating at wide-open admission.
  const turbineOutputMW = clamp(
    isRunning && isLocked && exciterOn && turbineSteamFlow > 1
      ? turbineSteamFlow * 0.34191 * turbineSteamQuality * condenserEfficiency
      : 0,
    0,
    1200,
  );
  const calculateAprmForMw = (targetMw: number) => {
    const admission = mainSteamInletOpen ? valveValue / 100 : 0;
    const outputPerThermalSteam = steamPathCapacity * admission * steamPressureFactor * .34191 * turbineSteamQuality * condenserEfficiency;
    const available = isRunning && isLocked && exciterOn && outputPerThermalSteam > .00001;
    if (!available) return { aprm: 0, maxMw: 0, available: false, message: "Unavailable: synchronize the generator, close the grid breaker, energize the exciter, open the main-steam inlet, and admit steam through the main valve." };
    const maxMw = Math.min(1200, getU2ThermalOutput(100).steamKgS * outputPerThermalSteam);
    const aprmRequired = getAprmForSteamKgS(Math.max(0, targetMw) / outputPerThermalSteam);
    return {
      aprm: aprmRequired,
      maxMw,
      available: true,
      message: aprmRequired <= 100
        ? `At the current steam path, ${targetMw.toFixed(0)} MW requires about ${aprmRequired.toFixed(2)}% APRM. Maximum available output is ${maxMw.toFixed(1)} MW.`
        : `${targetMw.toFixed(0)} MW is not reachable at the current conditions. Even 100% APRM provides about ${maxMw.toFixed(1)} MW; improve main-valve admission, pressure, or condenser efficiency.`,
    };
  };
  const hotwellOutflowKgS =
    (condenserPumpOn && startupBusAvailable ? condensateFlow * 20 : 0) +
    (condenserPumpB && busBAvailable ? condensatePumpBFlow * 20 : 0);
  const daOutflowKgS =
    (pump1Online && startupBusAvailable ? feedwaterFlow * 20 : 0) +
    (pump2Online && busBAvailable ? feedwaterPumpBFlow * 20 : 0);
  // DA intake air follows the amount of water actually processed by MCC. A
  // fully-open intake reaches 10 kg/s at nominal/high throughput; the outlet
  // is independent and can exhaust up to 20 kg/s.
  const daMccFlowFactor = clamp(Math.min(hotwellOutflowKgS, daOutflowKgS) / 2000, 0, 1);
  const daIntakeAirFlow = daIntakeValve / 100 * 10 * daMccFlowFactor;
  const daOuttakeAirFlow = daOuttakeValve / 100 * 20;
  mccProcessRef.current = {
    mccPumpOn,
    steamFlow,
    hotwellOutflowKgS,
    daOutflowKgS,
    isRunning,
    daIntakeOpen,
    daOutputOpen,
    simpleMode,
  };
  const annunciators: Annunciator[] = [
    {
      id: "reactor-trip",
      label: "REACTOR TRIP / SCRAM",
      active: scramPressed,
      priority: "red",
      tone: "warble",
      pan: "center",
      page: "rps",
      sample: "/sounds/full-trip-rps.mp3",
    },
    {
      id: "cond-vac-low",
      label: "COND PRESS HIGH",
      active: condenserVacuum > 0.07 && condenserVacuum <= 0.25,
      priority: "amber",
      tone: "low",
      pan: "left",
      page: "condenser",
      sample: "/sounds/condenser-lowhigh.mp3",
    },
    {
      id: "cond-vac-high",
      label: "COND PRESS LOW",
      active: condenserVacuum < 0.04,
      priority: "amber",
      tone: "high",
      pan: "left",
      page: "condenser",
      sample: "/sounds/condenser-lowhigh.mp3",
    },
    {
      id: "no-cond-vac",
      label: "NO COND VAC",
      active: isRunning && condenserVacuum > 0.25,
      priority: "red",
      tone: "warble",
      pan: "right",
      page: "power-grid",
      sample: "/sounds/no-condenser-turbine.mp3",
    },
    {
      id: "generator-reverse-power",
      label: "GENERATOR REVERSE POWER",
      active:
        turbineBusB &&
        isLocked &&
        turbineOutputMW * 1000 <
          (condenserPumpB ? 3.5 : 0) +
            (pump2Online ? feedwaterPumpBFlow * .14 : 0),
      priority: "red",
      tone: "warble",
      pan: "center",
      page: "power-grid",
      sample: "/sounds/no-condenser-turbine.mp3",
    },
    {
      id: "cond-ineffective",
      label: "CONDENSATION INEFFECTIVE",
      active:
        isRunning &&
        condenserCirculationPumpOn &&
        sjaeOn &&
        condenserVacuum > 0.25,
      priority: "red",
      tone: "pulse",
      pan: "left",
      page: "condenser",
      sample: "/sounds/condenser-lowhigh.mp3",
    },
    {
      id: "high-steam",
      label: "HIGH STEAM PRESSURE",
      active: pressure > 8800,
      priority: pressure > 9500 ? "red" : "amber",
      tone: "high",
      pan: "center",
      page: "power-grid",
      sample: "/sounds/rpv-srv.mp3",
    },
    {
      id: "bypass-sync",
      label: "BYPASS OPEN / SYNC",
      active: isLocked && bypassValve > 5,
      priority: "amber",
      tone: "double",
      pan: "right",
    },
    {
      id: "srv-open",
      label: "SRV OPEN",
      active: srvOpen.some(Boolean),
      priority: "amber",
      tone: "chime",
      pan: "center",
      page: "safety",
      sample: "/sounds/rpv-srv.mp3",
    },
    {
      id: "ads",
      label: "ADS ACTUATED",
      active: adsActive,
      priority: "red",
      tone: "pulse",
      pan: "center",
      page: "safety",
      sample: "/sounds/ads.mp3",
    },
    {
      id: "lpci",
      label: "LPCI INJECTING",
      active:
        safetyBusS &&
        pressure <= 3500 &&
        ((eccsPumpA && eccsPumpAMode === "LPCI") ||
          (eccsPumpB && eccsPumpBMode === "LPCI")),
      priority: "amber",
      tone: "chime",
      pan: "center",
      page: "safety",
      sample: "/sounds/lcpi.mp3",
    },
    {
      id: "rcic",
      label: "RCIC INJECTING",
      active: safetyBusAvailable && rcicValve && rcicFlow > 0,
      priority: "amber",
      tone: "chime",
      pan: "center",
      page: "safety",
      sample: "/sounds/rcic.mp3",
    },
    {
      id: "rcic-alarm",
      label: "RCIC UNAVAILABLE",
      active:
        reactorLevel < -3.5 && (!safetyBusAvailable || !rcicValve || rcicFlow <= 0),
      priority: "red",
      tone: "warble",
      pan: "center",
      page: "safety",
      sample: "/sounds/rcic-alarm.mp3",
    },
    {
      id: "lpci-eccs-conflict",
      label: "LPCI / ECCS CONFLICT",
      active:
        pressure <= 3500 &&
        ((eccsPumpA && eccsPumpAMode !== "LPCI") ||
          (eccsPumpB && eccsPumpBMode !== "LPCI")),
      priority: "amber",
      tone: "double",
      pan: "center",
      page: "safety",
      sample: "/sounds/lcpi-without-eccs-conflict.mp3",
    },
    {
      id: "da-high-pressure",
      label: "DA HIGH PRESSURE",
      active: !simpleMode && daPressure > 2,
      priority: "amber",
      tone: "high",
      pan: "left",
      page: "mcc",
      sample: "/sounds/da-high-pressure.mp3",
    },
    {
      id: "reactor-high-level",
      label: "REACTOR LEVEL HIGH",
      active: reactorLevel > 4.5,
      priority: "amber",
      tone: "high",
      pan: "center",
      page: "mcc",
      sample: "/sounds/tower-level-high.mp3",
    },
    {
      id: "fw-preheat",
      label: "FW PREHEAT NOT ON",
      active: !simpleMode && isRunning && daIntakeValve > 70 && daTemperature < 108,
      priority: "amber",
      tone: "chime",
      pan: "left",
      page: "mcc",
      sample: "/sounds/fw-preheat.mp3",
    },
    {
      id: "rps-latched",
      label: "RPS TRIP LATCHED",
      active: Object.values(rpsTrips).some(Boolean),
      priority: "red",
      tone: "warble",
      pan: "center",
      page: "status",
      sample: "/sounds/half-trip-rps.mp3",
    },
    {
      id: "startup-inhibit",
      label: "STARTUP INHIBITED",
      active: !isRunning && Object.values(rpsTrips).some(Boolean),
      priority: "amber",
      tone: "low",
      pan: "center",
      page: "startup-shutdown",
      sample: "/sounds/half-trip-rps.mp3",
    },
    {
      id: "rod-withdraw-block",
      label: "ROD WITHDRAW BLOCK",
      active: isRunning && mode === "SD",
      priority: "amber",
      tone: "double",
      pan: "center",
      page: "control-rods",
    },
    {
      id: "srm-block",
      label: "SRM BLOCK",
      active: mode === "SRM" && rodBlockAlarm === "SRM",
      priority: "amber",
      tone: "double",
      pan: "center",
      page: "control-rods",
      sample: "/sounds/block-buzzer.mp3",
    },
    {
      id: "ipr-block",
      label: "IRM BLOCK",
      active: mode === "IPR" && rodBlockAlarm === "IPR",
      priority: "amber",
      tone: "double",
      pan: "center",
      page: "control-rods",
      sample: "/sounds/block-buzzer.mp3",
    },
    {
      id: "group-block",
      label: "GROUP BLOCK",
      active: mode !== "RUN" && mode !== "SD" && !nextRod,
      priority: "amber",
      tone: "double",
      pan: "center",
      page: "control-rods",
    },
    {
      id: "mode-sd",
      label: "MODE IN SD",
      active: mode === "SD",
      priority: "blue",
      tone: "low",
      pan: "center",
      page: "control-rods",
    },
    {
      id: "low-ipr",
      label: "LOW IRM RANGE",
      active: mode === "IPR" && iprCycle === 1,
      priority: "blue",
      tone: "low",
      pan: "center",
      page: "control-rods",
    },
    {
      id: "high-ipr",
      label: "HIGH IRM RANGE",
      active: mode === "IPR" && iprCycle === 8,
      priority: "amber",
      tone: "high",
      pan: "center",
      page: "control-rods",
    },
    {
      id: "low-reactor-period",
      label: "LOW REACTOR PERIOD",
      active: reactorPeriod < 30,
      priority: "red",
      tone: "high",
      pan: "center",
      page: "control-rods",
      sample: "/sounds/rps.mp3",
    },
    {
      id: "recirc-a-cavitation",
      label: "RECIRC A CAVITATION",
      // Once rods have established at least 19% APRM the core flow is stable
      // enough that this simplified low-power cavitation condition clears.
      active: recircPumpA && recircSpeedA > 30 && rodAprm < 19,
      priority: "amber",
      tone: "low",
      pan: "left",
      page: "control-rods",
    },
    {
      id: "recirc-b-cavitation",
      label: "RECIRC B CAVITATION",
      active: recircPumpB && recircSpeedB > 30 && rodAprm < 19,
      priority: "amber",
      tone: "low",
      pan: "right",
      page: "control-rods",
    },
    {
      id: "recirc-imbalance",
      label: "RECIRC FLOW IMBALANCE",
      active:
        recircPumpA &&
        recircPumpB &&
        Math.abs(recircAFlow - recircBFlow) >= 20,
      priority: "amber",
      tone: "double",
      pan: "center",
      page: "control-rods",
    },
    {
      id: "auto-aprm",
      label: "AUTO APRM ACTIVE",
      active: autoEnabled,
      priority: "blue",
      tone: "chime",
      pan: "center",
      page: "control-rods",
    },
    {
      id: "auto-out-of-reach",
      label: "AUTO CONTROL OUT OF REACH",
      active: autoEnabled && autoMessage.includes("OUT OF REACH"),
      priority: "amber",
      tone: "double",
      pan: "center",
      page: "control-rods",
    },
    {
      id: "bus-s-unavailable",
      label: "SAFETY BUS S LOST",
      active: (safetyBusS || safetyConsumerCommanded) && !safetyBusAvailable,
      priority: "red",
      tone: "warble",
      pan: "right",
      page: "electrical",
      sample: "/sounds/rps.mp3",
    },
    {
      id: "bus-a-deenergized",
      label: "BUS A DE-ENERGIZED",
      active: busAConsumerCommanded && !startupBusAvailable,
      priority: "red",
      tone: "warble",
      pan: "right",
      page: "electrical",
      sample: "/sounds/half-trip-rps.mp3",
    },
    {
      id: "bus-b-deenergized",
      label: "BUS B DE-ENERGIZED",
      active: busBConsumerCommanded && !busBAvailable,
      priority: "amber",
      tone: "low",
      pan: "right",
      page: "electrical",
    },
    {
      id: "turbine-bus-out-of-range",
      label: "TURBINE BUS OUT OF RANGE",
      active: (busATransformer || turbineBusB) && !turbineBusEligible,
      priority: "amber",
      tone: "double",
      pan: "right",
      page: "electrical",
    },
    {
      id: "dc-bus-lost",
      label: "DC BUS LOST",
      active:
        (safetyToDcBreaker || busEToDcBreaker || dcConsumerCommanded) &&
        !dcBusAvailable,
      priority: "amber",
      tone: "low",
      pan: "right",
      page: "electrical",
    },
    {
      id: "turbine-island-supply",
      label: "TURBINE ISLAND SUPPLY",
      active: !isLocked && turbineBusEligible && (busATransformer || turbineBusB),
      priority: "blue",
      tone: "chime",
      pan: "right",
      page: "electrical",
    },
    {
      id: "mcc-pump-off",
      label: "MCC CIRCULATION OFF",
      active: isRunning && !mccPumpOn,
      priority: "amber",
      tone: "low",
      pan: "left",
      page: "mcc",
    },
    {
      id: "da-low-level",
      label: "DA LEVEL LOW",
      active: !simpleMode && deaeratorLevel < -3,
      priority: "amber",
      tone: "low",
      pan: "left",
      page: "mcc",
      sample: "/sounds/da-level-lowhigh.mp3",
    },
    {
      id: "mcc-reactor-level-low",
      label: "REACTOR LEVEL LOW",
      active: reactorLevel < -1.5,
      priority: "amber",
      tone: "low",
      pan: "left",
      page: "mcc",
      sample: "/sounds/feedwater-level-lowhigh.mp3",
    },
    {
      id: "mcc-da-level-low",
      label: "DA LEVEL LOW",
      active: !simpleMode && deaeratorLevel < -3,
      priority: "amber",
      tone: "low",
      pan: "right",
      page: "mcc",
      sample: "/sounds/da-level-lowhigh.mp3",
    },
    {
      id: "mcc-da-level-high",
      label: "DA LEVEL HIGH",
      active: !simpleMode && deaeratorLevel > 3,
      priority: "amber",
      tone: "high",
      pan: "right",
      page: "mcc",
      sample: "/sounds/da-level-lowhigh.mp3",
    },
    {
      id: "hotwell-makeup",
      label: "HOTWELL MAKEUP ACTIVE",
      active: hotwellMakeup,
      priority: "blue",
      tone: "chime",
      pan: "left",
      page: "mcc",
      sample: "/sounds/hotwell-pumps-active.mp3",
    },
    {
      id: "hotwell-drain",
      label: "HOTWELL DRAIN ACTIVE",
      active: hotwellDrain,
      priority: "blue",
      tone: "chime",
      pan: "left",
      page: "mcc",
      sample: "/sounds/hotwell-pumps-active.mp3",
    },
    {
      id: "hotwell-level-low",
      label: "HOTWELL LEVEL LOW",
      active: hotwellLevel < -3,
      priority: "amber",
      tone: "low",
      pan: "left",
      page: "mcc",
    },
    {
      id: "hotwell-level-high",
      label: "HOTWELL LEVEL HIGH",
      active: hotwellLevel > 3,
      priority: "amber",
      tone: "high",
      pan: "left",
      page: "mcc",
      sample: "/sounds/tower-level-high.mp3",
    },
    {
      id: "feedwater-pump-demand",
      label: "FEEDWATER PUMP DEMAND",
      active: mccPumpOn && steamFlow > daOutflowKgS + 50 && !pump2Online,
      priority: "amber",
      tone: "double",
      sample: "/sounds/fw-pump-trip.mp3",
      pan: "right",
      page: "mcc",
    },
    {
      id: "condensate-pump-demand",
      label: "CONDENSATE PUMP DEMAND",
      active:
        mccPumpOn && steamFlow > hotwellOutflowKgS + 50 && !condenserPumpB,
      priority: "amber",
      tone: "double",
      pan: "left",
      page: "mcc",
    },
    {
      id: "cst-level-high",
      label: "CST LEVEL HIGH",
      active: cstLevel > 9,
      priority: "amber",
      tone: "high",
      pan: "left",
      page: "mcc",
      sample: "/sounds/tower-level-high.mp3",
    },
    {
      id: "cst-level-low",
      label: "CST LEVEL LOW",
      active: cstLevel < 1,
      priority: "amber",
      tone: "low",
      pan: "left",
      page: "mcc",
    },
    {
      id: "mcc-auto",
      label: "MCC AUTOCONTROL ACTIVE",
      active: mccAutoOn,
      priority: "blue",
      tone: "chime",
      pan: "center",
      page: "mcc",
    },
    {
      id: "turbine-not-synced",
      label: "TURBINE NOT SYNCHRONIZED",
      active: isRunning && mainSteamInletOpen && valveValue > 15 && !isLocked,
      priority: "amber",
      tone: "double",
      pan: "right",
      page: "power-grid",
    },
    {
      id: "turbine-vac",
      label: "TURBINE / NO COND VAC",
      active: isRunning && valveValue > 15 && condenserVacuum > 0.25,
      priority: "red",
      tone: "warble",
      pan: "right",
    },
  ];

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(unitStateStorageKey) || "null");
      if (saved?.rods?.length === 36) {
        setRods(saved.rods);
        setSelectedRodId(saved.selectedRodId || "A1");
        setMode(saved.mode || "SD");
        setIprCycle(Math.max(1, Math.min(8, saved.iprCycle || 1)));
        setIrmRange(Math.max(1, Math.min(8, saved.irmRange || saved.iprCycle || 1)));
        setAutoTarget(saved.autoTarget || 1);
        setAutoSpeed(saved.autoSpeed || "medium");
        setReactorLevel(saved.reactorLevel || 0);
        setHotwellLevel(saved.hotwellLevel || 0);
        setDeaeratorLevel(saved.deaeratorLevel || 0);
      }
    } catch {
      localStorage.removeItem(unitStateStorageKey);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(
      unitStateStorageKey,
      JSON.stringify({
        rods,
        selectedRodId,
        mode,
        iprCycle,
        irmRange,
        autoTarget,
        autoSpeed,
        reactorLevel,
        hotwellLevel,
        deaeratorLevel,
      }),
    );
  }, [
    rods,
    selectedRodId,
    mode,
    iprCycle,
    irmRange,
    autoTarget,
    autoSpeed,
    reactorLevel,
    hotwellLevel,
    deaeratorLevel,
    unitStateStorageKey,
  ]);
  useEffect(() => {
    if (transferStateLoaded.current) return;
      transferStateLoaded.current = true;
      try {
        const saved = JSON.parse(
          (secondaryWindow
            ? localStorage.getItem(liveStateStorageKey) || sessionStorage.getItem(liveStateStorageKey)
            : sessionStorage.getItem(liveStateStorageKey) || localStorage.getItem(liveStateStorageKey)) ||
            "null",
      );
      if (!saved) { setSessionRestored(true); return; }
      if (saved.rods?.length === 36) setRods(saved.rods);
      if (typeof saved.temperature === "number")
        setTemperature(saved.temperature);
      if (typeof saved.pressure === "number") setPressure(saved.pressure);
      if (typeof saved.fuelLevel === "number") setFuelLevel(saved.fuelLevel);
      if (typeof saved.gridSync === "number") setGridSync(saved.gridSync);
      if (typeof saved.turbineSpeed === "number") setTurbineSpeed(saved.turbineSpeed);
      if (typeof saved.targetTurbineSpeed === "number") setTargetTurbineSpeed(saved.targetTurbineSpeed);
      if (typeof saved.pressureRate === "number") setPressureRate(saved.pressureRate);
      if (typeof saved.rodAprm === "number") {
        setRodAprm(saved.rodAprm);
        rodAprmRef.current = saved.rodAprm;
        rodKineticsRef.current = { observed: saved.rodAprm, target: saved.rodAprm, startedAt: 0, intensity: 0, origin: saved.rodAprm };
      }
      if (typeof saved.recirculationAprm === "number") setRecirculationAprm(saved.recirculationAprm);
      if (typeof saved.periodRecirculationAprm === "number") setPeriodRecirculationAprm(saved.periodRecirculationAprm);
      if (typeof saved.oilTemperature === "number") setOilTemperature(saved.oilTemperature);
      if (typeof saved.turbineMetalTemperature === "number") setTurbineMetalTemperature(saved.turbineMetalTemperature);
      if (typeof saved.reactorLevel === "number")
        setReactorLevel(saved.reactorLevel);
      if (typeof saved.hotwellLevel === "number")
        setHotwellLevel(saved.hotwellLevel);
      if (typeof saved.deaeratorLevel === "number")
        setDeaeratorLevel(saved.deaeratorLevel);
      if (typeof saved.condenserVacuum === "number")
        setCondenserVacuum(saved.condenserVacuum);
      if (typeof saved.mode === "string") setMode(saved.mode);
      if (typeof saved.iprCycle === "number") setIprCycle(Math.max(1, Math.min(8, saved.iprCycle)));
      if (typeof saved.irmRange === "number") setIrmRange(Math.max(1, Math.min(8, saved.irmRange)));
      if (typeof saved.isRunning === "boolean") setIsRunning(saved.isRunning);
      if (typeof saved.bypassValve === "number")
        setBypassValve(saved.bypassValve);
      if (typeof saved.valveValue === "number") setValveValue(saved.valveValue);
      if (typeof saved.pressure === "number") pressureSample.current = { value: saved.pressure, time: performance.now() };
      if (saved.physicsTuning && typeof saved.physicsTuning === "object") setPhysicsTuning(current => ({ ...current, ...saved.physicsTuning }));
      const controls = saved.controls || {};
      const apply = (key: string, setter: (value: never) => void) => { if (typeof controls[key] !== "undefined") setter(controls[key] as never); };
      apply("mainSteamInletOpen", setMainSteamInletOpen); apply("reliefOpen", setReliefOpen); apply("reliefValveB", setReliefValveB); apply("exciterOn", setExciterOn); apply("isLocked", setIsLocked); apply("turbinePressureAuto", setTurbinePressureAuto); apply("turbineRpmAuto", setTurbineRpmAuto);
      apply("pump1Online", setPump1Online); apply("pump2Online", setPump2Online); apply("daIntakeOpen", setDaIntakeOpen); apply("daOutputOpen", setDaOutputOpen); apply("daIntakeValve", setDaIntakeValve); apply("daOuttakeValve", setDaOuttakeValve); apply("daIntakeDirection", setDaIntakeDirection); apply("daOuttakeDirection", setDaOuttakeDirection); apply("daAuto", setDaAuto); apply("daBypassValve", setDaBypassValve); apply("daMainAirValve", setDaMainAirValve); apply("daRuptureDisk", setDaRuptureDisk);
      apply("recircPumpA", setRecircPumpA); apply("recircPumpB", setRecircPumpB); apply("recircSpeedA", setRecircSpeedA); apply("recircSpeedB", setRecircSpeedB); apply("selectedRodId", setSelectedRodId); apply("rodDirection", setRodDirection); apply("selectionScope", setSelectionScope); apply("autoEnabled", setAutoEnabled); apply("autoTarget", setAutoTarget); apply("autoSpeed", setAutoSpeed); apply("autoMode", setAutoMode);
      apply("malfunctions", setMalfunctions);
      apply("condensateFlow", setCondensateFlow); apply("condensatePumpBFlow", setCondensatePumpBFlow); apply("feedwaterFlow", setFeedwaterFlow); apply("feedwaterPumpBFlow", setFeedwaterPumpBFlow); apply("feedwaterAuxAuto", setFeedwaterAuxAuto); apply("feedwaterMotorCoolingA", setFeedwaterMotorCoolingA); apply("feedwaterMotorCoolingB", setFeedwaterMotorCoolingB); apply("feedwaterOilPreheatA", setFeedwaterOilPreheatA); apply("feedwaterOilPreheatB", setFeedwaterOilPreheatB); apply("condenserPumpOn", setCondenserPumpOn); apply("condenserPumpB", setCondenserPumpB); apply("condenserValve", setCondenserValve); apply("condenserValveDirection", setCondenserValveDirection); apply("condenserAuto", setCondenserAuto); apply("carAOn", setCarAOn); apply("carBOn", setCarBOn); apply("sjaeOn", setSjaeOn); apply("mccPumpOn", setMccPumpOn); apply("mccAutoOn", setMccAutoOn); apply("condenserCirculationPumpOn", setCondenserCirculationPumpOn);
      apply("startupBusA", setStartupBusA); apply("busATransformer", setBusATransformer); apply("turbineBusB", setTurbineBusB); apply("safetyBusS", setSafetyBusS); apply("edgBreaker", setEdgBreaker); apply("edgAuto", setEdgAuto); apply("edgSelected", setEdgSelected); apply("edgIgnitionBreaker", setEdgIgnitionBreaker); apply("edgOutputBreaker", setEdgOutputBreaker); apply("edgStartRequested", setEdgStartRequested); apply("edgRpm", setEdgRpm); apply("edgTankLevel", setEdgTankLevel); apply("edgFuelA", setEdgFuelA); apply("edgFuelB", setEdgFuelB); apply("edgMainFuelValve", setEdgMainFuelValve); apply("edgMainFuelPump", setEdgMainFuelPump); apply("edgFuelValveA", setEdgFuelValveA); apply("edgFuelValveB", setEdgFuelValveB); apply("edgRefuellingSeconds", setEdgRefuellingSeconds); apply("acDcInterlock", setAcDcInterlock); apply("safetyToDcBreaker", setSafetyToDcBreaker); apply("busEToDcBreaker", setBusEToDcBreaker); apply("mainBatteryCharge", setMainBatteryCharge); apply("rolldownProtection", setRolldownProtection); apply("cstLevel", setCstLevel); apply("cstMakeup", setCstMakeup); apply("cstDrain", setCstDrain); apply("hotwellMakeup", setHotwellMakeup); apply("hotwellDrain", setHotwellDrain);
      apply("rcicValve", setRcicValve); apply("rcicFlow", setRcicFlow); apply("eccsPumpA", setEccsPumpA); apply("eccsPumpB", setEccsPumpB); apply("eccsPumpAMode", setEccsPumpAMode); apply("eccsPumpBMode", setEccsPumpBMode); apply("srvOpen", setSrvOpen); apply("adsActive", setAdsActive);
      apply("lubePumpSource", setLubePumpSource); apply("hydraulicPumpSource", setHydraulicPumpSource); apply("coldOilValve", setColdOilValve); apply("warmOilValve", setWarmOilValve); apply("turningGear", setTurningGear); apply("preheatValve", setPreheatValve); apply("steamSealing", setSteamSealing); apply("steamSealingLeak", setSteamSealingLeak); apply("polisherTrainA", setPolisherTrainA); apply("polisherTrainB", setPolisherTrainB); apply("polisherAuto", setPolisherAuto); apply("polisherBypass", setPolisherBypass); apply("polisherTarget", setPolisherTarget); apply("polisherTanks", setPolisherTanks);
      apply("tutorialEnabled", setTutorialEnabled);
      apply("tutorialLevel", setTutorialLevel);
    } catch { /* corrupt persisted state falls back to the safe initial panel */ } finally { setSessionRestored(true); }
  }, []);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("unit2-panel-live-sync-v1");
    panelSyncChannel.current = channel;
    channel.onmessage = (event) => {
      const message = event.data;
      if (!message || message.key !== liveStateStorageKey) return;
      if (message.type === "request-state" && !secondaryWindow && isPhysicsAuthority) {
        try {
          channel.postMessage({ type: "state", key: liveStateStorageKey, snapshot: JSON.parse(sessionStorage.getItem(liveStateStorageKey) || "{}") });
        } catch { /* no complete snapshot yet */ }
        return;
      }
      if (message.type === "state" && message.snapshot) {
        suppressPanelBroadcastUntil.current = Date.now() + 160;
        const ownedKeys = STATION_CONTROL_KEYS[unitStation.role] || [];
        const pendingControls = pendingSpecialistControls.current;
        const acknowledged = Boolean(pendingControls && controlsMatch(pendingControls, message.snapshot.controls || {}));
        if (acknowledged) pendingSpecialistControls.current = null;
        // Keep the authority's live physics, but do not allow an older full
        // snapshot to overwrite a specialist command before MCR echoes it.
        if (!isPhysicsAuthority && ownedKeys.length && pendingControls && !acknowledged && message.snapshot.controls) {
          const incomingControls = { ...message.snapshot.controls };
          ownedKeys.forEach((key) => delete incomingControls[key]);
          applyPanelSnapshot({ ...message.snapshot, controls: incomingControls });
        } else applyPanelSnapshot(message.snapshot);
      }
      if (message.type === "control-state" && message.snapshot?.controls) {
        // Station windows exchange operator inputs, not an independent copy
        // of reactor physics. MCR remains the single source of pressure/RPM.
        // An authority must echo a control command immediately. Delaying that
        // echo made remote switches appear correct while their physical effect
        // waited for the next periodic authority broadcast.
        suppressPanelBroadcastUntil.current = isPhysicsAuthority ? 0 : Date.now() + 160;
        applyPanelSnapshot({ controls: message.snapshot.controls });
      }
    };
    if (secondaryWindow) channel.postMessage({ type: "request-state", key: liveStateStorageKey });
    return () => { channel.close(); panelSyncChannel.current = null; };
  }, [liveStateStorageKey, secondaryWindow, isPhysicsAuthority, unitStation.role]);
  useEffect(() => {
    if (!plantAssignment || secondaryWindow) return;
    const channel = openUnitLiveChannel(plantAssignment, (snapshot, sourceStationId) => {
      if (!snapshot || sourceStationId === plantAssignment.stationId) return;
      // A live Unified Unit console outranks MCR as physics authority. This
      // makes the all-tabs main invite safe to use alongside a dedicated MCR.
      if (unitStation.role === "mcr" && /^U[12]-UNIT$/i.test(sourceStationId)) {
        unifiedAuthoritySeen.current = Date.now();
        refreshAuthority((value) => value + 1);
      }
      const received = snapshot as Record<string, unknown>;
      const controlOnly = Object.keys(received).every((key) => key === "controls");
      suppressPanelBroadcastUntil.current = isPhysicsAuthority && controlOnly ? 0 : Date.now() + 200;
      const ownedKeys = STATION_CONTROL_KEYS[unitStation.role] || [];
      const pendingControls = pendingSpecialistControls.current;
      const snapshotRecord = snapshot as Record<string, unknown>;
      const snapshotControls = snapshotRecord.controls && typeof snapshotRecord.controls === "object" ? snapshotRecord.controls as Record<string, unknown> : {};
      const acknowledged = Boolean(pendingControls && controlsMatch(pendingControls, snapshotControls));
      if (acknowledged) pendingSpecialistControls.current = null;
      if (!isPhysicsAuthority && ownedKeys.length && pendingControls && !acknowledged && Object.keys(snapshotControls).length) {
        const incomingControls = { ...snapshotControls };
        ownedKeys.forEach((key) => delete incomingControls[key]);
        applyPanelSnapshot({ ...(snapshot as Record<string, unknown>), controls: incomingControls });
      } else applyPanelSnapshot(snapshot as Record<string, unknown>);
    });
    unitRealtimeChannel.current = channel;
    return () => { channel?.unsubscribe(); unitRealtimeChannel.current = null; };
  }, [plantAssignment, secondaryWindow, plantTransportEpoch, isPhysicsAuthority, unitStation.role]);
  useEffect(() => {
    if (!plantAssignment || secondaryWindow || !isPhysicsAuthority) return;
    const publishAuthoritySnapshot = () => {
      try {
        broadcastUnitSnapshot(
          unitRealtimeChannel.current,
          JSON.parse(sessionStorage.getItem(liveStateStorageKey) || "{}"),
          plantAssignment.stationId,
        );
      } catch { /* a first snapshot will be published after state hydration */ }
    };
    publishAuthoritySnapshot();
    // A full control-room snapshot is intentionally kept to a modest rate.
    // Realtime Broadcast is for live displays, not the high-frequency physics
    // clock; publishing on every physics update quickly exhausts free-tier
    // Realtime quotas when several stations are open.
    const timer = window.setInterval(publishAuthoritySnapshot, 2_000);
    return () => window.clearInterval(timer);
  }, [plantAssignment, secondaryWindow, isPhysicsAuthority, liveStateStorageKey]);
  useEffect(() => {
    if (!sessionRestored) return;
    sessionStorage.setItem(
      liveStateStorageKey,
      JSON.stringify({
        rods,
        temperature,
        pressure,
        fuelLevel,
        gridSync,
        turbineSpeed,
        targetTurbineSpeed,
        pressureRate,
        rodAprm,
        recirculationAprm,
        periodRecirculationAprm,
        oilTemperature,
        turbineMetalTemperature,
        reactorLevel,
        hotwellLevel,
        deaeratorLevel,
        condenserVacuum,
        mode,
        iprCycle,
        irmRange,
        isRunning,
        bypassValve,
        valveValue,
        aprm,
        turbineOutputMW,
        offsitePowerAvailable,
        daTemperature,
        daPressure,
        physicsTuning,
        controls: { mainSteamInletOpen, reliefOpen, reliefValveB, exciterOn, isLocked, turbinePressureAuto, turbineRpmAuto, pump1Online, pump2Online, daIntakeOpen, daOutputOpen, daIntakeValve, daOuttakeValve, daIntakeDirection, daOuttakeDirection, daAuto, daBypassValve, daMainAirValve, daRuptureDisk, recircPumpA, recircPumpB, recircSpeedA, recircSpeedB, malfunctions, selectedRodId, rodDirection, selectionScope, autoEnabled, autoTarget, autoSpeed, autoMode, condensateFlow, condensatePumpBFlow, feedwaterFlow, feedwaterPumpBFlow, feedwaterAuxAuto, feedwaterMotorCoolingA, feedwaterMotorCoolingB, feedwaterOilPreheatA, feedwaterOilPreheatB, condenserPumpOn, condenserPumpB, condenserValve, condenserValveDirection, condenserAuto, carAOn, carBOn, sjaeOn, mccPumpOn, mccAutoOn, condenserCirculationPumpOn, condenserCirculationPumpB, startupBusA, busATransformer, turbineBusB, safetyBusS, edgBreaker, edgAuto, edgSelected, edgIgnitionBreaker, edgOutputBreaker, edgStartRequested, edgRpm, edgTankLevel, edgFuelA, edgFuelB, edgMainFuelValve, edgMainFuelPump, edgFuelValveA, edgFuelValveB, edgRefuellingSeconds, acDcInterlock, safetyToDcBreaker, busEToDcBreaker, mainBatteryCharge, rolldownProtection, cstLevel, cstMakeup, cstDrain, hotwellMakeup, hotwellDrain, rcicValve, rcicFlow, eccsPumpA, eccsPumpB, eccsPumpAMode, eccsPumpBMode, srvOpen, adsActive, lubePumpSource, hydraulicPumpSource, coldOilValve, warmOilValve, turningGear, preheatValve, steamSealing, steamSealingLeak, polisherTrainA, polisherTrainB, polisherAuto, polisherBypass, polisherTarget, polisherTankSelection, polisherTanks, tutorialEnabled, tutorialLevel },
        updatedAt: Date.now(),
      }),
    );
    // Session state gives console and control-room navigation an immediate
    // shared snapshot. Keep a durable mirror as well: a browser reload must
    // never silently return steam valves to their startup positions.
    localStorage.setItem(
      liveStateStorageKey,
      sessionStorage.getItem(liveStateStorageKey) || "{}",
    );
    if (Date.now() >= suppressPanelBroadcastUntil.current) {
      try {
        const snapshot = JSON.parse(sessionStorage.getItem(liveStateStorageKey) || "{}");
        const primaryAuthority = !secondaryWindow && isPhysicsAuthority;
        // A non-authority never sends its full cached control object. That is
        // the source of stale control races: it would overwrite a newer value
        // from another panel merely because its local UI rendered later.
        const ownedControls = primaryAuthority
          ? (snapshot.controls || {})
          : pickControls(snapshot.controls || {}, STATION_CONTROL_KEYS[unitStation.role] || []);
        panelSyncChannel.current?.postMessage({
          type: primaryAuthority ? "state" : "control-state",
          key: liveStateStorageKey,
          snapshot: primaryAuthority ? snapshot : { controls: ownedControls },
        });
        // Cross-computer specialists use the same Realtime channel, but only
        // publish a compact delta when one of their own controls changed.
        if (!primaryAuthority && plantAssignment && Object.keys(ownedControls).length) {
          const encoded = JSON.stringify(ownedControls);
          if (encoded !== lastSpecialistControlPayload.current) {
            lastSpecialistControlPayload.current = encoded;
            pendingSpecialistControls.current = ownedControls;
            broadcastUnitSnapshot(unitRealtimeChannel.current, { controls: ownedControls }, plantAssignment.stationId);
          }
        }
      } catch { /* storage is the fallback synchronisation path */ }
    }
  }, [
    rods,
    temperature,
    pressure,
    fuelLevel,
    gridSync,
    turbineSpeed,
    targetTurbineSpeed,
    pressureRate,
    rodAprm,
    recirculationAprm,
    periodRecirculationAprm,
    oilTemperature,
    turbineMetalTemperature,
    reactorLevel,
    hotwellLevel,
    deaeratorLevel,
    condenserVacuum,
    mode,
    iprCycle,
    irmRange,
    isRunning,
    bypassValve,
    valveValue,
    sessionRestored, aprm, physicsTuning, liveStateStorageKey,
    turbineOutputMW, offsitePowerAvailable, daTemperature, daPressure, mainSteamInletOpen, reliefOpen, reliefValveB, exciterOn, isLocked, turbinePressureAuto, turbineRpmAuto, pump1Online, pump2Online, daIntakeOpen, daOutputOpen, daIntakeValve, daOuttakeValve, daIntakeDirection, daOuttakeDirection, daAuto, daBypassValve, daMainAirValve, daRuptureDisk, recircPumpA, recircPumpB, recircSpeedA, recircSpeedB, malfunctions, selectedRodId, rodDirection, selectionScope, autoEnabled, autoTarget, autoSpeed, autoMode, condensateFlow, condensatePumpBFlow, feedwaterFlow, feedwaterPumpBFlow, feedwaterAuxAuto, feedwaterMotorCoolingA, feedwaterMotorCoolingB, feedwaterOilPreheatA, feedwaterOilPreheatB, condenserPumpOn, condenserPumpB, condenserValve, condenserValveDirection, condenserAuto, carAOn, carBOn, sjaeOn, mccPumpOn, mccAutoOn, condenserCirculationPumpOn, condenserCirculationPumpB, startupBusA, busATransformer, turbineBusB, safetyBusS, edgBreaker, edgAuto, edgSelected, edgIgnitionBreaker, edgOutputBreaker, edgStartRequested, edgRpm, edgTankLevel, edgFuelA, edgFuelB, edgMainFuelValve, edgMainFuelPump, edgFuelValveA, edgFuelValveB, edgRefuellingSeconds, acDcInterlock, safetyToDcBreaker, busEToDcBreaker, mainBatteryCharge, rolldownProtection, cstLevel, cstMakeup, cstDrain, hotwellMakeup, hotwellDrain, rcicValve, rcicFlow, eccsPumpA, eccsPumpB, eccsPumpAMode, eccsPumpBMode, srvOpen, adsActive, lubePumpSource, hydraulicPumpSource, coldOilValve, warmOilValve, turningGear, preheatValve, steamSealing, steamSealingLeak, polisherTrainA, polisherTrainB, polisherAuto, tutorialEnabled, tutorialLevel, secondaryWindow, isPhysicsAuthority,
  ]);
  useEffect(() => {
    localStorage.setItem("unit2-tutorial-enabled", String(tutorialEnabled));
    localStorage.setItem("unit2-tutorial-level", String(tutorialLevel));
  }, [tutorialEnabled, tutorialLevel]);
  useEffect(() => {
    // A fresh control-room entry begins with annunciator windows acknowledged.
    // The slight delay ensures the page-local annunciator panel has mounted.
    const timer = window.setTimeout(() => window.dispatchEvent(new Event("rbwr-annunciator-master-ack")), 120);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!tutorialEnabled) return;
    // Training changes can intentionally line systems up. Acknowledge the
    // resulting windows so a lesson starts with useful, new annunciations.
    const timer = window.setTimeout(() => window.dispatchEvent(new Event("rbwr-annunciator-master-ack")), 120);
    return () => window.clearTimeout(timer);
  }, [tutorialEnabled, tutorialLevel]);
  useEffect(() => {
    if (!simpleMode) return;
    // These systems are intentionally bypassed in Simple mode; restoring Full
    // mode leaves the operator's previously selected advanced settings intact.
    setDaFastCloseHeld(false);
    setDaIntakeDirection(0);
    setDaOuttakeDirection(0);
    setDaIntakeOpen(true);
    setDaOutputOpen(true);
    setDaIntakeValve(100);
    setDaOuttakeValve(100);
  }, [simpleMode]);
  useEffect(() => {
    if (!tutorialEnabled) return;
    // Lessons begin with offsite/startup power available so newly introduced
    // equipment can actually be operated. Electrical lessons may still use
    // the breakers themselves after this initial line-up.
    setOffsitePowerAvailable(true);
    setStartupBusA(true);
    setSafetyBusS(true);
  }, [tutorialEnabled, tutorialLevel]);
  useEffect(() => {
    if (!tutorialEnabled || tutorialLevel !== 4) return;
    // The rod lesson starts at the first legitimate startup action instead
    // of SD, where withdrawal is intentionally inhibited.
    setMode("SRM");
    setSelectedRodId("C3");
    setSelectionScope("rod");
    setRodDirection(0);
  }, [tutorialEnabled, tutorialLevel]);
  useEffect(() => {
    if (!tutorialEnabled || tutorialLevel < 5) return;
    // Turbine/MCC lessons use a stable 20% APRM environment, leaving the
    // learner free to concentrate on the system being introduced.
    setIsRunning(true);
    setMode("RUN");
    setRods((previous) => previous.map((rod) => ({ ...rod, position: 73.33 })));
    setPressure((value) => Math.max(value, 7100));
    setAutoEnabled(true);
    setAutoTarget(20);
    setAutoMode("rods");
  }, [tutorialEnabled, tutorialLevel]);
  useEffect(() => {
    localStorage.setItem("rbwr-rps-trip-inhibit", String(rpsTripInhibit));
  }, [rpsTripInhibit]);

  const scram = (manual = false) => {
    const firstActuation = !scramPressed;
    setRods((previous) => previous.map((rod) => ({ ...rod, position: 100 })));
    setMode("SD");
    setAutoEnabled(false);
    setRodDirection(0);
    setRecircPumpA(false);
    setRecircPumpB(false);
    setRecircSpeedA(0);
    setRecircSpeedB(0);
    setPeriodRecirculationAprm(0);
    setScramPressed(true);
    if (manual)
      setRpsTrips((previous) => ({ ...previous, "MANUAL TRIP": true }));
    if (firstActuation) {
      if (!tripAlarm.current)
        tripAlarm.current = new Audio("/sounds/shutdown_alarm.mp3");
      tripAlarm.current.pause();
      tripAlarm.current.currentTime = 0;
      tripAlarm.current.volume = 0.12;
      void tripAlarm.current.play().catch(() => {});
      setEvent(
        manual
          ? "Manual SCRAM — rods inserted and recirculation dropped; unit remains started."
          : "Automatic SCRAM — rods inserted and recirculation dropped; unit remains started.",
      );
    }
  };
  // A turbine trip is separate from a reactor SCRAM. It immediately isolates
  // turbine admission and gives reactor steam a safe bypass path.
  const tripTurbine = (reason: string) => {
    setIsLocked(false);
    setValveValue(0);
    setValveDirection(0);
    setBypassValve(100);
    setBypassDirection(0);
    setTargetTurbineSpeed(0);
    setTurbineRpmAuto(false);
    setEvent(`TURBINE TRIP — ${reason}. Main valve shut; bypass fully open.`);
  };
  useEffect(() => {
    const silenceTripAlarm = (event: Event) => {
      const detail = (event as CustomEvent<{ ids?: string[] }>).detail;
      if (!detail?.ids?.includes("reactor-trip")) return;
      if (tripAlarm.current) {
        tripAlarm.current.pause();
        tripAlarm.current.currentTime = 0;
      }
    };
    window.addEventListener("rbwr-annunciator-silence", silenceTripAlarm);
    window.addEventListener("rbwr-annunciator-ack", silenceTripAlarm);
    return () => {
      window.removeEventListener("rbwr-annunciator-silence", silenceTripAlarm);
      window.removeEventListener("rbwr-annunciator-ack", silenceTripAlarm);
    };
  }, []);

  useEffect(() => {
    if (simpleMode) {
      setDaTemperature(110);
      setDaPressure(1.5);
    }
    const tick = window.setInterval(() => {
      if (simulationPausedRef.current) return;
      setRods((previous) => {
        let candidate = selectedRodId;
        let direction = rodDirection;
        if (mode === "SD")
          return previous.map((rod) => ({
            ...rod,
            position: clamp(rod.position + 8, 0, 100),
          }));
        if (autoEnabled && autoMode === "rods") {
          if (mode === "SD") {
            setMode("SRM");
            setAutoMessage("AUTO SELECTED SRM MODE.");
            return previous;
          }
          if (mode === "SRM" && isCycleComplete(previous, "SRM", 1)) {
            setMode("IPR");
            setIprCycle(1);
            setIrmRange(1);
            setAutoMessage("AUTO SELECTED IRM MODE — RANGE R1.");
            return previous;
          }
          if (mode === "IPR" && isCycleComplete(previous, "IPR", iprCycle)) {
            if (iprCycle < 8) {
              setIprCycle((range) => range + 1);
              setIrmRange((range) => Math.min(8, range + 1));
              setAutoMessage(`AUTO COMPLETED IRM R${iprCycle} — SELECTED R${iprCycle + 1}.`);
            } else {
              setMode("RUN");
              setAutoMessage("AUTO COMPLETED FINAL IRM WINDOW — SELECTED RUN MODE.");
            }
            return previous;
          }
          const livePhysics = rodDrivePhysicsRef.current;
          const recirculationSettling = clamp(
            livePhysics.recirculationTargetAprm - livePhysics.recirculationAprm,
            -2,
            2,
          );
          const predictedAprm = livePhysics.aprm + recirculationSettling;
          const difference = autoTarget - predictedAprm;
          const holdBand = { slow: 0.08, medium: 0.15, fast: 0.25 }[autoSpeed];
          if (Math.abs(difference) < holdBand) {
            setAutoMessage(
              `Target predicted at ${predictedAprm.toFixed(2)}% — holding rods while APRM settles.`,
            );
            return previous;
          }
          direction = difference > 0 ? -1 : 1;
          candidate =
            direction < 0
              ? nextWithdrawableRod(previous, mode, iprCycle)?.id || ""
              : previous.filter((rod) => rod.position < 99.5)[0]?.id || "";
          if (!candidate) {
            setAutoMessage(
              "AUTO PAUSED — no eligible rod in current mode/range.",
            );
            return previous;
          }
          setAutoMessage(
            `AUTO ${direction < 0 ? "WITHDRAWING" : "INSERTING"} ${candidate} at ${autoSpeed.toUpperCase()} rate.`,
          );
        }
        if (!direction || !candidate) return previous;
        const rod = previous.find((item) => item.id === candidate);
        if (!rod) return previous;
        const limit = cycleLimit(mode, iprCycle);
        const startupWithdrawal = direction < 0 && (mode === "SRM" || mode === "IPR");
        const permittedRod = startupWithdrawal
          ? nextWithdrawableRod(previous, mode, iprCycle)
          : undefined;
        // SRM/IPR withdrawal must follow the programmed core sequence. Group
        // and All selection remain useful in RUN, but cannot bypass a startup
        // block or move a later rod before its permitted predecessor.
        if (startupWithdrawal && (!permittedRod || permittedRod.id !== rod.id)) {
          if (!autoEnabled) {
            const block = mode === "SRM" ? "SRM" : "IPR";
            triggerRodBlock(block);
            setAutoMessage(
              `${block} BLOCK — select ${permittedRod?.id ?? "the next cycle"} before withdrawing.`,
            );
          }
          return previous;
        }
        if (direction < 0 && startupWithdrawal && rod.position <= limit) {
          if (!autoEnabled) {
            triggerRodBlock(mode === "SRM" ? "SRM" : "IPR");
            setAutoMessage(
              "GROUP BLOCK — current startup cycle limit reached.",
            );
          }
          return previous;
        }
        const speed = autoEnabled
          ? { slow: 0.5, medium: 1, fast: 2 }[autoSpeed]
          : (mode === "RUN" ? WITHDRAWAL_RATES.run : WITHDRAWAL_RATES.startup) *
            MANUAL_ROD_RATES[autoSpeed === "medium" ? "normal" : autoSpeed];
        const targets = autoEnabled
          ? [candidate]
          : startupWithdrawal
            ? [candidate]
          : selectionScope === "all"
            ? previous.map((item) => item.id)
            : selectionScope === "group"
              ? previous
                  .filter((item) => item.group === rod.group)
                  .map((item) => item.id)
              : [candidate];
        return previous.map((item) =>
          targets.includes(item.id)
            ? {
                ...item,
                position: clamp(
                  item.position +
                    (direction < 0 ? -speed * 0.25 : speed * 0.25),
                  direction < 0 ? limit : 0,
                  100,
                ),
                temperature: clamp(
                  item.temperature + (direction < 0 ? 0.1 : -0.05),
                  20,
                  900,
                ),
              }
            : item,
        );
      });
    }, 250);
    return () => window.clearInterval(tick);
  }, [
    selectedRodId,
    rodDirection,
    mode,
    autoEnabled,
    autoMode,
    autoTarget,
    autoSpeed,
    iprCycle,
    selectionScope,
  ]);

  // A completed IRM withdrawal window is a physical group block, not an
  // extra button press. Advance the permitted withdrawal limit immediately
  // for both manual and automatic startup, while keeping the operator's IRM
  // display-range selection independent from the programme cycle.
  useEffect(() => {
    if (mode !== "IPR" || !isCycleComplete(rods, "IPR", iprCycle)) {
      completedIrmCycleRef.current = null;
      return;
    }
    if (completedIrmCycleRef.current === iprCycle) return;
    completedIrmCycleRef.current = iprCycle;
    if (iprCycle >= 8) {
      setAutoMessage("FINAL IRM CYCLE COMPLETE — select RUN when the required power is reached.");
      return;
    }
    setIprCycle((cycle) => Math.min(8, cycle + 1));
    setAutoMessage(`IRM CYCLE ${iprCycle} COMPLETE — withdrawal limit advanced to cycle ${iprCycle + 1}.`);
    setEvent(`IRM GROUP BLOCK CLEARED — startup cycle ${iprCycle + 1} is now permitted.`);
  }, [mode, rods, iprCycle]);

  useEffect(() => {
    const tick = window.setInterval(
      () => {
        if (simulationPausedRef.current) return;
        setRecirculationAprm(
          (previous) =>
            previous + clamp(recirculationTargetAprm - previous, -0.18, 0.18),
        );
      },
      250,
    );
    return () => window.clearInterval(tick);
  }, [recirculationTargetAprm]);
  useEffect(() => {
    const tick = window.setInterval(
      () => {
        if (simulationPausedRef.current) return;
        setPeriodRecirculationAprm(
          (previous) =>
            previous + clamp(recirculationAprm - previous, -0.02, 0.02),
        );
      },
      1000,
    );
    return () => window.clearInterval(tick);
  }, [recirculationAprm]);
  useEffect(() => {
    if (!autoEnabled || autoMode !== "recirculation") return;
    const tick = window.setInterval(() => {
      if (simulationPausedRef.current) return;
      const predictedAprm = rodAprm + recirculationTargetAprm;
      const error = autoTarget - predictedAprm;
      const step = autoSpeed === "fast" ? 1 : autoSpeed === "slow" ? 0.25 : 0.5;
      const settlingSeconds = Math.abs(recirculationTargetAprm - recirculationAprm) / 0.72;
      const holdBand = { slow: 0.1, medium: 0.18, fast: 0.3 }[autoSpeed];
      if (Math.abs(error) < holdBand) {
        setAutoMessage(
          `Predicted ${predictedAprm.toFixed(2)}% APRM in ~${settlingSeconds.toFixed(1)} s — holding recirculation.`,
        );
        return;
      }
      if (!recircPumpA && !recircPumpB) {
        setAutoMessage("AUTO OUT OF REACH — no recirculation pumps available.");
        return;
      }
      const activePumpCount = (recircPumpA ? 1 : 0) + (recircPumpB ? 1 : 0);
      const predictedChangePerPercent = activePumpCount * 0.375;
      const delta = Math.sign(error) * Math.min(
        step,
        Math.max(0.1, Math.abs(error) / predictedChangePerPercent),
      );
      if (recircPumpA)
        setRecircSpeedA((value) =>
          clamp(Math.round((value + delta) * 10) / 10, 0, 100),
        );
      if (recircPumpB)
        setRecircSpeedB((value) =>
          clamp(Math.round((value + delta) * 10) / 10, 0, 100),
        );
      if (
        (error > 0 &&
          recircSpeedA >= 100 &&
          (!recircPumpB || recircSpeedB >= 100)) ||
        (error < 0 && recircSpeedA <= 0 && (!recircPumpB || recircSpeedB <= 0))
      )
        setAutoMessage("AUTO OUT OF REACH — recirculation at travel limit.");
      else
        setAutoMessage(
          `AUTO RECIRCULATION ${error > 0 ? "RAISING" : "LOWERING"} FLOW — predicts ${predictedAprm.toFixed(2)}% before next pulse.`,
        );
    }, 250);
    return () => window.clearInterval(tick);
  }, [
    autoEnabled,
    autoMode,
    autoTarget,
    autoSpeed,
    aprm,
    rodAprm,
    recirculationAprm,
    recirculationTargetAprm,
    recircPumpA,
    recircPumpB,
    recircSpeedA,
    recircSpeedB,
  ]);
  useEffect(() => {
    periodAprmRef.current = periodAprm;
  }, [periodAprm]);
  useEffect(() => {
    // Reactor period is based on the *reactivity trend*, not the small APRM
    // number displayed during source-range startup.  Using APRM alone made a
    // single rod leaving 0% look like a huge exponential jump (0.01 → 0.03),
    // which caused an unrealistic immediate low-period SCRAM.  The source
    // baseline represents the neutron population already being monitored by
    // SRM, while the rate filter represents delayed neutron/thermal response.
    // The prior 42-APRM baseline hid normal intermediate-range changes almost
    // completely.  A 20-APRM source baseline still keeps one SRM rod slow,
    // yet lets the meter report a sustained multi-rod / recirculation trend.
    const samplePeriod = () => {
      const now = performance.now();
      const previous = aprmSample.current;
      const elapsed = Math.max(0.5, (now - previous.time) / 1000);
      const current = Math.max(0, periodAprmRef.current);

      if (current < 0.02 && previous.value < 0.02) {
        setReactorPeriod(999);
        aprmSample.current = { value: current, time: now, logRate: 0 };
        return;
      }

      const sourceRangeBaseline = 20;
      const instantaneousRate = clamp(
        Math.log((sourceRangeBaseline + current) / (sourceRangeBaseline + previous.value)) / elapsed,
        -0.08,
        0.08,
      );
      // About a four-second smoothing window: enough to avoid needle chatter
      // without making the indication appear frozen after a real reactivity
      // change has begun.
      const response = 1 - Math.exp(-0.22 * elapsed);
      const logRate = previous.logRate + (instantaneousRate - previous.logRate) * response;
      const period = logRate > 0.00005
        ? clamp(Math.LN2 / logRate, 8, 999)
        : 999;
      setReactorPeriod(period);
      aprmSample.current = { value: current, time: now, logRate };
    };
    samplePeriod();
    const timer = window.setInterval(samplePeriod, 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const now = performance.now();
    const elapsed = Math.max(0.05, (now - pressureSample.current.time) / 1000);
    setPressureRate((pressure - pressureSample.current.value) / elapsed);
    pressureSample.current = { value: pressure, time: now };
  }, [pressure]);
  useEffect(() => {
    pressureGovernorRef.current = {
      isRunning,
      mainSteamInletOpen,
      pressure,
      pressureRate,
    };
  }, [isRunning, mainSteamInletOpen, pressure, pressureRate]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (simulationPausedRef.current) return;
      if (valveDirection)
        setValveValue((value) => clamp(value + valveDirection * 0.75, 0, 100));
      if (bypassDirection)
        setBypassValve((value) =>
          clamp(value + bypassDirection * 0.75, 0, 100),
        );
      if (condenserValveDirection)
        setCondenserValve((value) =>
          clamp(value + condenserValveDirection, 0, 100),
        );
      if (daIntakeDirection)
        setDaIntakeValve((value) => {
          const next = clamp(value + daIntakeDirection, 0, 100);
          setDaIntakeOpen(next > 0);
          return next;
        });
      if (daOuttakeDirection)
        setDaOuttakeValve((value) => {
          const next = clamp(value + daOuttakeDirection, 0, 100);
          setDaOutputOpen(next > 0);
          return next;
        });
    }, 250);
    return () => window.clearInterval(timer);
  }, [
    valveDirection,
    bypassDirection,
    condenserValveDirection,
    daIntakeDirection,
    daOuttakeDirection,
  ]);
  useEffect(() => {
    if (!isPhysicsAuthority || !daFastCloseHeld) return;
    setDaIntakeDirection(0);
    const timer = window.setInterval(
      () =>
        setDaIntakeValve((value) => {
          const next = clamp(value - 2.5, 0, 100);
          setDaIntakeOpen(next > 0);
          return next;
        }),
      250,
    );
    return () => window.clearInterval(timer);
  }, [isPhysicsAuthority, daFastCloseHeld]);
  useEffect(() => {
    const player = daFastCloseAudio.current;
    const stopLoop = () => {
      player.source?.stop();
      player.source?.disconnect();
      player.source = null;
    };
    const playEndingCue = () => {
      if (!player.context || !player.buffer) return;
      const source = player.context.createBufferSource();
      const gain = player.context.createGain();
      const duration = Math.min(0.8, player.buffer.duration);
      source.buffer = player.buffer;
      gain.gain.value = 0.28;
      source.connect(gain).connect(player.context.destination);
      source.start(0, Math.max(0, player.buffer.duration - duration), duration);
    };
    if (!daFastCloseHeld) {
      stopLoop();
      if (player.wasHeld) playEndingCue();
      player.wasHeld = false;
      return;
    }
    player.wasHeld = true;
    if (player.source) return;
    let cancelled = false;
    void (async () => {
      try {
        if (!player.context) player.context = new AudioContext();
        if (player.context.state === "suspended") await player.context.resume();
        if (!player.buffer) {
          const response = await fetch("/sounds/da-fastclose.mp3");
          player.buffer = await player.context.decodeAudioData(
            await response.arrayBuffer(),
          );
        }
        if (cancelled || !daFastCloseHeld || !player.buffer) return;
        const buffer = player.buffer;
        const limit = Math.floor((buffer.duration - 0.8) * buffer.sampleRate);
        const samples = buffer.getChannelData(0);
        let first = 0;
        let last = Math.max(0, limit - 1);
        while (first < last && Math.abs(samples[first]) < 0.0015) first++;
        while (last > first && Math.abs(samples[last]) < 0.0015) last--;
        const source = player.context.createBufferSource();
        const gain = player.context.createGain();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = first / buffer.sampleRate;
        source.loopEnd = Math.max(
          (first + 1) / buffer.sampleRate,
          (last + 1) / buffer.sampleRate,
        );
        gain.gain.value = 0.28;
        source.connect(gain).connect(player.context.destination);
        player.source = source;
        source.start();
      } catch { /* optional fast-close audio is non-critical */ }
    })();
    return () => {
      cancelled = true;
    };
  }, [daFastCloseHeld]);
  useEffect(
    () => () => {
      const player = daFastCloseAudio.current;
      player.source?.stop();
      player.source?.disconnect();
      player.source = null;
    },
    [],
  );

  useEffect(() => {
    condenserControlRef.current = {
      condenserValve,
      carAOn,
      carBOn,
      condenserCirculationPumpOn,
      condenserCirculationPumpB,
      startupBusAvailable,
      busBAvailable,
      sjaeOn,
      steamFlow,
    };
  }, [condenserValve, carAOn, carBOn, condenserCirculationPumpOn, condenserCirculationPumpB, startupBusAvailable, busBAvailable, sjaeOn, steamFlow]);

  useEffect(() => {
    if (!isPhysicsAuthority) return;
    const tick = window.setInterval(() => {
      if (simulationPausedRef.current) return;
      const control = condenserControlRef.current;
      const activeCars = (control.carAOn ? 1 : 0) + (control.carBOn ? 1 : 0);
      setCondenserVacuum((value) => {
        // The condenser is a heat sink, not a fixed-position vacuum source.
        // Steam load changes the natural back-pressure, but an energized
        // circulation system with a fully open vacuum valve must always be
        // able to establish the 40 mbar end of the operating band.  The old
        // low-steam assist floor prevented that and made the indication appear
        // stuck at high pressure even at 100% valve opening.
        const steamFraction = clamp(control.steamFlow / 1300, 0, 1.2);
        const steamDrivenPressure = 1 - Math.min(.70, steamFraction * .70);
        // The control valve has a deliberately strong, non-linear authority:
        // a condenser with circulating water and useful steam load must be
        // able to reach the 40–70 mbar operating band well before 100% open.
        // At essentially zero steam load it still cannot create a fake vacuum.
        const valveFraction = clamp(control.condenserValve / 100, 0, 1);
        const valveAuthority = 1 - Math.pow(1 - valveFraction, 4);
        // Do not make valve capacity depend on its own measured pressure here:
        // that creates a low-pressure feedback loop which can hunt between two
        // values. Full valve authority removes up to 960 mbar independently
        // of steam flow; steam changes the target around that capability.
        const valveCooling = valveAuthority * .96;
        const processTarget = clamp(steamDrivenPressure - valveCooling - (control.sjaeOn ? .025 : 0), .04, 1);
        const carTarget = activeCars > 0 && value > .85 ? .85 : 1;
        const target = ((control.condenserCirculationPumpOn && control.startupBusAvailable) || (control.condenserCirculationPumpB && control.busBAvailable))
          ? Math.min(processTarget, carTarget)
          : (activeCars > 0 && value > .85 ? .85 : 1);
        condenserTargetRef.current = target;
        // Pull down promptly from the 1 bar offgas state, then become gentler
        // near the normal 40–70 mbar operating band rather than appearing to
        // freeze during a normal operator valve adjustment.
        const rate = value < .08 ? .0035 : value < .12 ? .008 : value < .25 ? .02 : .06;
        return clamp(value + clamp(target - value, -rate, rate), .04, 1.05);
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!condenserAuto) return;
    const tick = window.setInterval(() => {
      if (simulationPausedRef.current) return;
      setCondenserCirculationPumpOn(true);
      if (condenserVacuum > .85) {
        setCarAOn(true);
        setCarBOn(true);
      }
      // Aim at 55 mbar. Small errors are intentionally gentle to avoid
      // hunting in the normal vacuum band.
      setCondenserValve((value) => {
        const next = clamp(
          value + clamp((condenserVacuum - .055) * 12, -.35, .7),
          0,
          100,
        );
        return Math.round(next * 10) / 10;
      });
    }, 250);
    return () => window.clearInterval(tick);
  }, [condenserAuto, condenserVacuum]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (simulationPausedRef.current) return;
      const process = mccProcessRef.current;
      if (!process.mccPumpOn) return;
      const hotwellDelta = clamp(
        (process.steamFlow - process.hotwellOutflowKgS) / 5000,
        -0.2,
        0.2,
      );
      const reactorDelta = clamp(
        (process.daOutflowKgS - process.steamFlow) / 10000,
        -0.2,
        0.2,
      );
      const deaeratorDelta = clamp(
        (process.hotwellOutflowKgS - process.daOutflowKgS) / 10000,
        -0.2,
        0.2,
      );
      setHotwellLevel((value) => clamp(value + hotwellDelta, -5, 6));
      if (process.simpleMode) {
        // Simple mode bypasses the DA: the feedwater train injects directly
        // into the reactor while both pump banks still control real flow.
        setReactorLevel((value) =>
          clamp(
            value + reactorDelta,
            -5,
            6,
          ),
        );
      } else if (process.daIntakeOpen && process.daOutputOpen) {
        setDeaeratorLevel((value) => clamp(value + deaeratorDelta, -5, 6));
        setReactorLevel((value) => clamp(value + reactorDelta, -5, 6));
      } else {
        setReactorLevel((value) =>
          clamp(
            value +
              clamp(
                (process.hotwellOutflowKgS - process.steamFlow) / 10000,
                -0.2,
                0.2,
              ),
            -5,
            6,
          ),
        );
      }
      setMccLevel((value) =>
        clamp(value - (process.isRunning ? 0.08 : 0), 0, 100),
      );
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!mccAutoOn) return;
    const applyTargets = () => {
      if (mccAutoManualAdjusting.current) return;
      const clampFlow = (flow: number) => Math.max(0, Math.min(4000, flow));
      // Reactor error drives feedwater; DA error balances the two transfer legs;
      // Hotwell error trims condensate. No inventory values are modified here.
      const feedTarget = clampFlow(
        steamFlow - reactorLevel * 140 + (simpleMode ? 0 : deaeratorLevel * 70),
      );
      const condensateTarget = clampFlow(
        feedTarget - (simpleMode ? 0 : deaeratorLevel * 150) + hotwellLevel * 140,
      );
      const dispatch = (
        target: number,
        capacityPerPump: number,
        setA: (value: number) => void,
        setB: (value: number) => void,
      ) => {
        setA(Math.round((Math.min(capacityPerPump, target) / capacityPerPump * 100) * 10) / 10);
        setB(
          busBAvailable
            ? Math.round((Math.max(0, target - capacityPerPump) / capacityPerPump * 100) * 10) / 10
            : 0,
        );
      };
      setMccPumpOn(true);
      setCondenserPumpOn(true);
      setPump1Online(true);
      // Hotwell makeup/drain are coarse inventory tools. Keep both idle in a
      // ±0.25 m deadband so MCC Auto does not chatter or consume Bus A power
      // while the level is already acceptably centred.
      setHotwellMakeup(startupBusAvailable && hotwellLevel < -0.25);
      setHotwellDrain(startupBusAvailable && hotwellLevel > 0.25);
      dispatch(condensateTarget, 2000, setCondensateFlow, setCondensatePumpBFlow);
      dispatch(feedTarget, 2000, setFeedwaterFlow, setFeedwaterPumpBFlow);
      if (busBAvailable && condensateTarget > 2000) setCondenserPumpB(true);
      if (busBAvailable && feedTarget > 2000) setPump2Online(true);
    };
    applyTargets();
    const tick = window.setInterval(applyTargets, 150);
    return () => window.clearInterval(tick);
  }, [
    mccAutoOn,
    steamFlow,
    reactorLevel,
    hotwellLevel,
    deaeratorLevel,
    simpleMode,
    turbineBusB,
    isLocked,
    startupBusAvailable,
    busBAvailable,
  ]);
  const lpciSelected = eccsPumpAMode === "LPCI" || eccsPumpBMode === "LPCI";
  const activeLpciPumps =
    (eccsPumpA && eccsPumpAMode === "LPCI" ? 1 : 0) +
    (eccsPumpB && eccsPumpBMode === "LPCI" ? 1 : 0);
  const activeRhrPumps =
    (eccsPumpA && eccsPumpAMode === "RHR" ? 1 : 0) +
    (eccsPumpB && eccsPumpBMode === "RHR" ? 1 : 0);
  const lpciInjectionRate =
    safetyBusAvailable && pressure <= 3500 ? activeLpciPumps * 0.75 : 0;
  useEffect(() => {
    if (lpciSelected && reactorLevel <= -4.5 && !adsActive) {
      setAdsActive(true);
      setSrvOpen(Array(6).fill(true));
      scram();
      setEvent(
        "ADS ACTUATED — reactor SCRAMMED; all SRVs open and waiting for RPV pressure below 3500 kPa.",
      );
    }
  }, [lpciSelected, reactorLevel, adsActive]);
  useEffect(() => {
    if (adsActive && pressure <= 3500) {
      if (eccsPumpAMode === "LPCI") setEccsPumpA(true);
      if (eccsPumpBMode === "LPCI") setEccsPumpB(true);
      setEvent(
        "ADS DEPRESSURIZATION COMPLETE — selected LPCI trains enabled; MCC circulation remains under operator control.",
      );
    }
  }, [adsActive, pressure, eccsPumpAMode, eccsPumpBMode]);
  useEffect(() => {
    if (!lpciInjectionRate) return;
    const tick = window.setInterval(() => {
      setReactorLevel((value) =>
        clamp(value + lpciInjectionRate * 0.25, -5, 6),
      );
    }, 250);
    return () => window.clearInterval(tick);
  }, [lpciInjectionRate]);
  useEffect(() => {
    const tick = window.setInterval(() => {
      if (startupBusAvailable) {
        if (cstMakeup) setCstLevel((value) => clamp(value + 0.8, 0, 10));
        if (cstDrain) setCstLevel((value) => clamp(value - 0.8, 0, 10));
        if (hotwellMakeup) {
          setCstLevel((value) => clamp(value - 0.5, 0, 10));
          setHotwellLevel((value) => clamp(value + 0.5, -5, 6));
        }
        if (hotwellDrain) {
          setCstLevel((value) => clamp(value + 0.5, 0, 10));
          setHotwellLevel((value) => clamp(value - 0.5, -5, 6));
        }
      }
      const rcic = safetyBusAvailable && rcicValve && rcicFlow > 0;
      const injectionRate = Math.min(
        1,
        rcic ? rcicFlow * 0.01 : 0,
      );
      if (injectionRate > 0)
        setReactorLevel((value) => clamp(value + injectionRate, -5, 6));
      if ((!isRunning || scramPressed) && safetyBusAvailable && activeRhrPumps)
        setTemperature((value) =>
          clamp(value - activeRhrPumps * 0.45, 25, 900),
        );
    }, 1000);
    return () => window.clearInterval(tick);
  }, [
    cstMakeup,
    cstDrain,
    hotwellMakeup,
    hotwellDrain,
    startupBusAvailable,
    safetyBusAvailable,
    rcicValve,
    rcicFlow,
    activeRhrPumps,
    pressure,
    isRunning,
    scramPressed,
  ]);
  useEffect(() => {
    const tick = window.setInterval(() => {
      setDaTemperature((value) =>
        clamp(
          value + (108 + (daIntakeValve / 100) * 5 - value) * 0.12,
          100,
          120,
        ),
      );
      setDaPressure((value) => clamp(value + (daIntakeAirFlow - daOuttakeAirFlow) * 0.025, 0.2, 2.4));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [isPhysicsAuthority, daIntakeValve, daOuttakeValve, daIntakeAirFlow, daOuttakeAirFlow, simpleMode]);
  useEffect(() => {
    if (!isPhysicsAuthority || !daAuto || simpleMode) return;
    const tick = window.setInterval(() => {
      // The DA's two process valves control temperature and pressure
      // independently; MCC feedwater flow remains untouched.
      setDaIntakeValve((value) =>
        Math.round(clamp(value + clamp((110.5 - daTemperature) * 0.8, -0.5, 0.5), 0, 100) * 10) / 10,
      );
      setDaOuttakeValve((value) => {
        const balancedOpening = daIntakeAirFlow / 20 * 100;
        const target = balancedOpening + (daPressure - 1.60) * 12;
        return Math.round(clamp(value + clamp(target - value, -0.8, 0.8), 0, 100) * 10) / 10;
      });
      setDaIntakeOpen(true);
      setDaOutputOpen(true);
    }, 500);
    return () => window.clearInterval(tick);
  }, [isPhysicsAuthority, daAuto, simpleMode, daTemperature, daPressure, daIntakeAirFlow]);
  useEffect(() => {
    if (!isPhysicsAuthority || simpleMode || daRuptureDisk !== "intact" || daPressure <= 2.05) return;
    setDaRuptureDisk("ruptured");
    setEvent("DA RUPTURE DISK ACTUATED — isolate the air outlet using bypass-first procedure.");
  }, [isPhysicsAuthority, simpleMode, daPressure, daRuptureDisk]);
  // Meter demand is derived from machines that are actually being commanded to
  // run.  A de-energized/tripped bus must never retain a stale load reading.
  const startupDemand =
    (condenserCirculationPumpOn ? 6.5 : 0) +
    (condenserPumpOn ? 3.5 : 0) +
    (pump1Online ? feedwaterFlow * .014 : 0) +
    (recircPumpA ? recircAFlow / 100 * 1.25 : 0) +
    (recircPumpB ? recircBFlow / 100 * 1.25 : 0) +
    (cstMakeup ? 10 : 0) +
    (cstDrain ? 5 : 0) +
    (hotwellMakeup ? 0.5 : 0) +
    (hotwellDrain ? 0.5 : 0);
  const busBDemand =
    (condenserPumpB ? 3.5 : 0) +
    (condenserCirculationPumpB ? 6.5 : 0) +
    (pump2Online ? feedwaterPumpBFlow * .014 : 0);
  const safetyDemand =
    (rcicValve && rcicFlow > 0 ? 15 : 0) +
    (eccsPumpA ? 15 : 0) +
    (eccsPumpB ? 15 : 0);
  const startupLoad = startupBusAvailable ? startupDemand : 0;
  const busACapacity = interlockBusAFeed
    ? 60
    : sharedTurbineCapacityActive
      ? 150
      : busATransformer && turbineBusEligible
        ? 60
        : 38;
  const busBLoad = busBAvailable ? busBDemand : 0;
  const sharedTurbineLoad = startupLoad + busBLoad;
  const safetyLoad = safetyBusAvailable ? safetyDemand : 0;
  const startupMachines = [
    { name: "CONDENSER CIRCULATION", commanded: condenserCirculationPumpOn, powered: startupBusAvailable && condenserCirculationPumpOn, demand: 6.5 },
    { name: "CONDENSATE PUMP A", commanded: condenserPumpOn, powered: startupBusAvailable && condenserPumpOn, demand: 3.5 },
    { name: "FEEDWATER PUMP A", commanded: pump1Online, powered: startupBusAvailable && pump1Online, demand: feedwaterFlow * .014 },
    { name: "RECIRCULATION PUMP A", commanded: recircPumpA, powered: startupBusAvailable && recircPumpA, demand: recircAFlow / 100 * 1.25 },
    { name: "RECIRCULATION PUMP B", commanded: recircPumpB, powered: startupBusAvailable && recircPumpB, demand: recircBFlow / 100 * 1.25 },
    { name: "CST MAKEUP", commanded: cstMakeup, powered: startupBusAvailable && cstMakeup, demand: 10 },
    { name: "CST DRAIN", commanded: cstDrain, powered: startupBusAvailable && cstDrain, demand: 5 },
    { name: "HOTWELL MAKEUP", commanded: hotwellMakeup, powered: startupBusAvailable && hotwellMakeup, demand: 0.5 },
    { name: "HOTWELL DRAIN", commanded: hotwellDrain, powered: startupBusAvailable && hotwellDrain, demand: 0.5 },
  ];
  const busBMachines = [
    { name: "CONDENSATE PUMP B", commanded: condenserPumpB, powered: busBAvailable && condenserPumpB, demand: 3.5 },
    { name: "CONDENSER CIRCULATION B", commanded: condenserCirculationPumpB, powered: busBAvailable && condenserCirculationPumpB, demand: 6.5 },
    { name: "FEEDWATER PUMP B", commanded: pump2Online, powered: busBAvailable && pump2Online, demand: feedwaterPumpBFlow * .014 },
  ];
  const safetyMachines = [
    { name: "RCIC TURBOPUMP", commanded: rcicValve && rcicFlow > 0, powered: safetyBusAvailable && rcicValve && rcicFlow > 0, demand: 15 },
    { name: "ECCS TRAIN A", commanded: eccsPumpA, powered: safetyBusAvailable && eccsPumpA, demand: 15 },
    { name: "ECCS TRAIN B", commanded: eccsPumpB, powered: safetyBusAvailable && eccsPumpB, demand: 15 },
  ];
  const netProductionMW = Math.max(0, turbineOutputMW - busBLoad / 1000);
  const sharedUnit = plantAssignment
    ? sharedPlant.units.find((unit) => unit.unit_number === plantAssignment.unitNumber)
    : null;
  const assignedUnitDemandMW = Number(demandManagerOnline ? sharedUnit?.assigned_demand_mw ?? gridDemandMW : gridDemandMW);
  const unitDemandMW = assignedUnitDemandMW;
  const plantDemandMW = Number(demandManagerOnline ? sharedPlant.room?.plant_demand_mw ?? gridDemandMW : gridDemandMW);
  const plantOutputMW = demandManagerOnline && plantAssignment
    ? sharedPlant.units.reduce((sum, unit) => sum + Number(unit.output_mw || 0), 0)
    : netProductionMW;
  const nextPlantDemandMW = Number(demandManagerOnline ? sharedPlant.room?.next_plant_demand_mw ?? nextGridDemandMW : nextGridDemandMW);
  const plantDemandSeconds = demandManagerOnline && sharedPlant.room?.demand_effective_at
    ? Math.max(0, Math.ceil((Date.parse(sharedPlant.room.demand_effective_at) - plantClock) / 1000))
    : secondsToDemandChange;
  // Dispatch scoring is deliberately fixed rather than percentage based:
  // operators have a ±30 MW unit band, while the plant as a whole has a
  // ±50 MW band around the supervisor's demand.
  const unitDemandMet =
    isLocked &&
    netProductionMW > 1 &&
    Math.abs(netProductionMW - unitDemandMW) <= 30;
  const plantDemandMet =
    plantOutputMW > 1 &&
    Math.abs(plantOutputMW - plantDemandMW) <= 50;
  const onGridDemand = unitDemandMet && plantDemandMet;

  useEffect(() => {
    if (!plantAssignment || secondaryWindow) return;
    let mounted = true;
    let channel: ReturnType<typeof subscribePlantRoom> = null;
    let heartbeat: number | undefined;
    const refresh = () => {
      void getPlantSnapshot(plantAssignment.roomCode).then((snapshot) => {
        if (mounted) setSharedPlant(snapshot);
      }).catch((error) => {
        if (mounted) setPlantSyncError(error instanceof Error ? error.message : "Plant room sync failed.");
      });
    };
    void joinPlantRoom(plantAssignment, operatorName || "GUEST", "control-room").then((joined) => {
      if (!mounted) return;
      setStationControlsLocked(Boolean(joined?.controlsLocked));
      if (joined?.snapshot) setSharedPlant(joined.snapshot);
      setPlantSyncError("");
      refresh();
      channel = subscribePlantRoom(plantAssignment.roomCode, refresh);
      if (!joined?.controlsLocked) {
        heartbeat = window.setInterval(() => {
          void heartbeatPlantStation(plantAssignment).then((owned) => {
            if (!owned && mounted) setStationControlsLocked(true);
          }).catch(() => {});
        }, 10_000);
      }
    }).catch((error) => {
      if (mounted) setPlantSyncError(error instanceof Error ? error.message : "Unable to join the plant room.");
    });
    return () => { mounted = false; channel?.unsubscribe(); if (heartbeat) window.clearInterval(heartbeat); };
  }, [plantAssignment, operatorName, secondaryWindow, plantTransportEpoch]);

  useEffect(() => {
    if (stationControlsLocked) setSimulationPaused(true);
  }, [stationControlsLocked]);

  const plantTelemetryRef = useRef({
    netProductionMW,
    aprm,
    pressure,
    offsitePowerAvailable,
    isLocked,
    startupBusAvailable,
    busATransformer,
  });
  useEffect(() => {
    plantTelemetryRef.current = {
      netProductionMW,
      aprm,
      pressure,
      offsitePowerAvailable,
      isLocked,
      startupBusAvailable,
      busATransformer,
    };
  }, [netProductionMW, aprm, pressure, offsitePowerAvailable, isLocked, startupBusAvailable, busATransformer]);
  useEffect(() => {
    if (!plantAssignment || !sessionRestored || stationControlsLocked) return;
    const publish = () => {
      const telemetry = plantTelemetryRef.current;
      void publishUnitTelemetry(plantAssignment, {
        output_mw: telemetry.netProductionMW,
        aprm: telemetry.aprm,
        pressure_kpa: telemetry.pressure,
        offsite_available: telemetry.offsitePowerAvailable,
        grid_connected: telemetry.isLocked,
        bus_a_available: telemetry.startupBusAvailable,
        bus_a_transformer_closed: telemetry.busATransformer,
      }).catch((error) => setPlantSyncError(error instanceof Error ? error.message : "Unable to publish unit telemetry."));
    };
    publish();
    const timer = window.setInterval(publish, 5_000);
    return () => window.clearInterval(timer);
  }, [plantAssignment, sessionRestored, stationControlsLocked]);
  const automationPenaltySystems = [
    autoEnabled || automationCooldowns.aprm > 0 ? "Auto APRM" : null,
    mccAutoOn || automationCooldowns.mcc > 0 ? "MCC Auto" : null,
    turbinePressureAuto || automationCooldowns.pressure > 0 ? "Auto Pressure" : null,
    condenserAuto || automationCooldowns.condenser > 0 ? "Condenser Auto" : null,
  ].filter((system): system is string => Boolean(system));
  // Each active automation system deducts 0.25 from a unit's five-second
  // site-demand credit. A 100-second cooldown continues that deduction.
  const automationPenaltyCount = automationPenaltySystems.length;
  const scoreRate = !stationControlsLocked && onGridDemand
    ? Math.max(0.25, 1 - automationPenaltyCount * 0.25)
    : 0;
  const scoringUnit = plantAssignment?.unitNumber ?? 2;
  const operatorPoints = Number(leaderboard[operatorName]?.points || 0);
  const operatorUnitPoints = Number(scoringUnit === 1 ? leaderboard[operatorName]?.unit1 || 0 : leaderboard[operatorName]?.unit2 || 0);
  const sortedOperators = Object.entries(leaderboard).sort(
    ([, left], [, right]) => Number(right.points || 0) - Number(left.points || 0),
  );
  const operatorRank = operatorName
    ? sortedOperators.findIndex(([name]) => name === operatorName) + 1
    : 0;
  useEffect(() => {
    if (!operatorName) return;
    if (getPlantTransport() === "local") {
      setRemoteLeaderboardReady(false);
      return;
    }
    let cancelled = false;
    const connect = async () => {
      try {
        await ensureLeaderboardPlayer(operatorName);
        const rows = await getLeaderboard();
        if (cancelled) return;
        setLeaderboard(Object.fromEntries(rows.map((row) => [row.display_name, { points: Number(row.points), unit1: Number(row.points_unit1 || 0), unit2: Number(row.points_unit2 || 0), lastSeen: Date.parse(row.last_seen) || Date.now() }])));
        setRemoteLeaderboardReady(true);
      } catch (error) {
        console.warn("Supabase leaderboard unavailable", error);
        setRemoteLeaderboardReady(false);
      }
    };
    void connect();
    return () => { cancelled = true; };
  }, [operatorName]);

  useEffect(() => {
    const preventControlSelection = (event: Event) => {
      const target = event.target as Element | null;
      if (!target?.closest(".rbwr-control-room")) return;
      if (target.closest("input, textarea, [contenteditable='true'], .rbwr-selectable, pre, code")) return;
      event.preventDefault();
    };
    document.addEventListener("selectstart", preventControlSelection);
    document.addEventListener("dragstart", preventControlSelection);
    return () => {
      document.removeEventListener("selectstart", preventControlSelection);
      document.removeEventListener("dragstart", preventControlSelection);
    };
  }, []);
  useEffect(() => {
    randomEventsEnabledRef.current = randomEventsEnabled;
    if (!randomEventsEnabled) {
      pendingGridEventRef.current = null;
      setPendingGridEvent(null);
    }
  }, [randomEventsEnabled]);
  useEffect(() => {
    pendingGridEventRef.current = pendingGridEvent;
  }, [pendingGridEvent]);
  useEffect(() => {
    if (offsiteCountdown === null) return;
    const timer = window.setInterval(() => {
      setOffsiteCountdown((seconds) => {
        if (seconds === null) return null;
        if (seconds <= 1) {
          setOffsitePowerAvailable(false);
          setRpsTrips((previous) => ({ ...previous, "LOOP TRIP": true }));
          tripTurbine("loss of offsite power");
          setEvent("OFFSITE POWER LOSS — EXTERNAL SWITCHYARD AND STARTUP TRANSFORMER DE-ENERGIZED. TURBINE TRIPPED; REACTOR REMAINS RUNNING.");
          return null;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [offsiteCountdown]);
  useEffect(() => {
    const tick = window.setInterval(() => {
      setSecondsToDemandChange((seconds) => {
        if (seconds > 1) {
          const remaining = seconds - 1;
          if (pendingGridEventRef.current === "loop" && remaining === 100)
            setEvent("GRID WARNING — LOSS OF OFFSITE POWER EXPECTED IN APPROXIMATELY 100 SECONDS. PREPARE TURBINE ISLANDING.");
          return remaining;
        }
        setGridDemandMW(nextGridDemandMW);
        setNextGridDemandMW(newGridDemand());
        // A queued random event is not allowed to survive its master switch.
        // Manual `scenario offsite` uses its separate countdown and remains
        // available regardless of this setting.
        if (randomEventsEnabledRef.current && pendingGridEventRef.current === "loop") {
          setOffsitePowerAvailable(false);
          setRpsTrips((previous) => ({ ...previous, "LOOP TRIP": true }));
          tripTurbine("loss of offsite power");
          setEvent("LOOP EVENT — EXTERNAL SWITCHYARD AND STARTUP TRANSFORMER DE-ENERGIZED. TURBINE TRIPPED; REACTOR REMAINS RUNNING.");
        }
        const nextEvent = randomEventsEnabledRef.current && Math.random() < 0.06 ? "loop" : null;
        pendingGridEventRef.current = nextEvent;
        setPendingGridEvent(nextEvent);
        return newDemandInterval();
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [nextGridDemandMW]);
  useEffect(() => {
    const tick = window.setInterval(() => {
      setAutomationCooldowns((previous) => ({
        aprm: autoEnabled ? 100 : Math.max(0, previous.aprm - 1),
        mcc: mccAutoOn ? 100 : Math.max(0, previous.mcc - 1),
        pressure: turbinePressureAuto ? 100 : Math.max(0, previous.pressure - 1),
        condenser: condenserAuto ? 100 : Math.max(0, previous.condenser - 1),
      }));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [autoEnabled, mccAutoOn, turbinePressureAuto, condenserAuto]);
  useEffect(() => {
    if (!operatorName || !scoreRate) return;
    const tick = window.setInterval(() => {
      const award = () => setLeaderboard((previous) => {
        const next = {
          ...previous,
          [operatorName]: {
            points: Number(previous[operatorName]?.points || 0) + scoreRate,
            unit1: Number(previous[operatorName]?.unit1 || 0) + (scoringUnit === 1 ? scoreRate : 0),
            unit2: Number(previous[operatorName]?.unit2 || 0) + (scoringUnit === 2 ? scoreRate : 0),
            lastSeen: Date.now(),
          },
        };
        localStorage.setItem("unit2-operator-scores", JSON.stringify(next));
        if (remoteLeaderboardReady) pendingScoreRef.current += scoreRate;
        return next;
      });
      if (!plantAssignment) { award(); return; }
      void claimPlantUnitPointTick(plantAssignment).then((claimed) => {
        if (claimed) award();
      }).catch(() => {
        // If the new shared-point RPC has not been installed yet, do not
        // silently double-credit multiple operator stations.
        setPlantSyncError("Shared point credit unavailable — run the plant operations upgrade SQL.");
      });
    }, 5000);
    return () => window.clearInterval(tick);
  }, [operatorName, scoreRate, remoteLeaderboardReady, scoringUnit]);
  useEffect(() => {
    if (!remoteLeaderboardReady || !operatorName) return;
    const flush = window.setInterval(() => {
      const pending = pendingScoreRef.current;
      if (pending <= 0) return;
      pendingScoreRef.current = 0;
      void addLeaderboardPoints(operatorName, scoringUnit, pending).then((row) => {
        if (!row) return;
        setLeaderboard((previous) => ({ ...previous, [row.display_name]: { points: Number(row.points), unit1: Number(row.points_unit1 || 0), unit2: Number(row.points_unit2 || 0), lastSeen: Date.parse(row.last_seen) || Date.now() } }));
      }).catch(() => { pendingScoreRef.current += pending; });
    }, 5000);
    return () => window.clearInterval(flush);
  }, [remoteLeaderboardReady, operatorName, scoringUnit]);
  useEffect(() => {
    // Training uses a protected power supply so a learner can operate the
    // newly introduced equipment without a hidden transformer-load puzzle.
    if (tutorialEnabled) return;
    if (sharedTurbineCapacityActive && sharedTurbineLoad > 150) {
      setBusATransformer(false);
      setTurbineBusB(false);
      if (isLocked) setIsLocked(false);
      setEvent("TURBINE AUXILIARY POOL OVERLOAD — BUS A AND BUS B TRIPPED.");
      return;
    }
    if (!interlockBusAFeed && !sharedTurbineCapacityActive && startupBusAvailable && startupLoad > busACapacity) {
      if (busATransformer && turbineBusEligible) {
        setBusATransformer(false);
        setEvent("BUS A TRANSFORMER OVERLOAD — BUS A TRIPPED.");
      } else {
        setStartupBusA(false);
        setEvent("STARTUP TRANSFORMER OVERLOAD — BUS A TRIPPED.");
      }
    }
    if (!sharedTurbineCapacityActive && turbineBusB && busBLoad > 60) {
      setTurbineBusB(false);
      setIsLocked(false);
      setEvent("BUS B OVERLOAD — GENERATOR TRIPPED.");
    }
    if (safetyBusS && safetyLoad > 30) {
      setSafetyBusS(false);
      setEvent("SAFETY BUS OVERLOAD — BUS S TRIPPED.");
    }
  }, [tutorialEnabled, sharedTurbineCapacityActive, sharedTurbineLoad, isLocked, startupBusAvailable, busATransformer, turbineBusEligible, busACapacity, turbineBusB, safetyBusS, startupLoad, busBLoad, safetyLoad]);

  useEffect(() => {
    const active = {
      "REACTOR LEVEL": reactorLevel <= -5 || reactorLevel >= 6,
      "MANUAL TRIP": false,
      // LOOP is a turbine/grid event. It is latched by the offsite-loss
      // event path above and must never become a reactor SCRAM condition.
      "LOOP TRIP": false,
      "CORE TEMPERATURE": temperature > 900,
      "RPV PRESSURE": pressure > 9500,
      "LOW REACTOR PERIOD": reactorPeriod < 20,
    };
    if (!rpsTripInhibit && Object.values(active).some(Boolean)) {
      setRpsTrips((previous) =>
        Object.fromEntries(
          Object.keys({ ...previous, ...active }).map((key) => [
            key,
            previous[key] || active[key],
          ]),
        ),
      );
      if (isRunning) scram();
    }
  }, [
    reactorLevel,
    mccLevel,
    temperature,
    pressure,
    isRunning,
    reactorPeriod,
    rpsTripInhibit,
  ]);
  useEffect(() => {
    if (
      !rpsTripInhibit &&
      isRunning &&
      valveValue > 15 &&
      condenserVacuum > 0.25
    ) {
      setRpsTrips((previous) => ({ ...previous, "TURBINE VACUUM": true }));
      if (rolldownProtection) {
        tripTurbine("Channel B low condenser vacuum protection");
      } else
        setEvent(
          "CHANNEL B TURBINE VACUUM ALARM — roll-down protection bypassed.",
        );
    }
  }, [
    isRunning,
    valveValue,
    condenserVacuum,
    rolldownProtection,
    rpsTripInhibit,
  ]);

  useReactorPhysics({
    simulationPaused: simulationPaused || !sessionRestored,
    isRunning,
    temperature,
    mainValve: valveValue,
    mainSteamInletOpen,
    bypassValve,
    reliefOpen: srvOpen.some(Boolean),
    reliefValvesOpen: srvOpen.filter(Boolean).length,
    turbineSteamFlow,
    bypassSteamFlow,
    aprm,
    thermalSteamKgS: thermalOutput.steamKgS,
    pump1Online,
    pump2Online,
    isLocked,
    targetTurbineSpeed,
    thermalResponse: physicsTuning.thermalResponse,
    steamProductionMultiplier: physicsTuning.steamProduction,
    steamRemovalMultiplier: physicsTuning.steamRemoval,
    automaticScramTemperature: physicsTuning.tripTemperature,
    onTemperatureChange: setTemperature,
    onPressureChange: setPressure,
    onFuelLevelChange: setFuelLevel,
    onGridSyncChange: setGridSync,
    onTurbineSpeedChange: setTurbineSpeed,
    onAutomaticScram: () => scram(),
  });
  useEffect(() => {
    if (isLocked) return;
    // Turning gear slowly rolls the shaft at about 50 RPM before run-up.
    if (turningGear) {
      setTargetTurbineSpeed(50 / 45);
      return;
    }
    if (isRunning) {
      // Before synchronization the shaft accelerates only as admitted steam flow rises.
      setTargetTurbineSpeed(mainSteamInletOpen ? clamp(turbineSteamFlow / 3, 0, 80) : 0);
    }
  }, [isRunning, isLocked, mainSteamInletOpen, turbineSteamFlow, turningGear]);
  useEffect(() => {
    // RPM Auto has its own staged 7,100 kPa governor. Do not let the two
    // automatic controllers issue opposing valve commands.
    if (!turbinePressureAuto || turbineRpmAuto) return;
    const governor = window.setInterval(() => {
      const control = pressureGovernorRef.current;
      if (!control.isRunning || !control.mainSteamInletOpen) return;
      const error = control.pressure - 7100;
      const rapidHighPressure = error > 700 || control.pressureRate > 180;
      const rapidLowPressure = error < -700 || control.pressureRate < -180;
      // Main admission is the normal pressure-control path. Bypass stays
      // closed unless a fast correction is needed, then closes first as
      // pressure recovers.
      setValveValue((value) =>
        clamp(value + clamp(error * .00045, -.35, .55), 0, 100),
      );
      setBypassValve((value) => {
        if (rapidHighPressure) return clamp(value + .9, 0, 100);
        if (rapidLowPressure || Math.abs(error) < 200) return clamp(value - .9, 0, 100);
        return clamp(value - .2, 0, 100);
      });
    }, 125);
    return () => window.clearInterval(governor);
  }, [turbinePressureAuto, turbineRpmAuto]);
  const { actualRPM, targetRPM, isSynchronized } = calculateTurbineData(
    turbineSpeed,
    targetTurbineSpeed,
    isLocked,
  );
  useEffect(() => {
    if (!turbineRpmAuto || !isRunning || !mainSteamInletOpen || isLocked) {
      rpmAutoSteamReadyRef.current = false;
      rpmAutoInPhaseSinceRef.current = null;
      islandGovernorHoldRef.current = false;
      return;
    }
    const governor = window.setInterval(() => {
      const rpmError = 3000 - actualRPM;
      const pressureError = pressure - 7100;
      const deliberateValveMove = valveDirection !== 0 || bypassDirection !== 0;
      const severeDeviation = Math.abs(rpmError) > 75 || Math.abs(pressureError) > 900 || Math.abs(pressureRate) > 400;
      if (deliberateValveMove || severeDeviation) islandGovernorHoldRef.current = false;
      if (islandGovernorHoldRef.current) {
        // Island governor hold: preserve the established steam admission and
        // pin shaft speed at nominal frequency until an operator action or a
        // truly significant plant disturbance demands renewed regulation.
        setTurbineSpeed(66.67);
        setTargetTurbineSpeed(66.67);
        return;
      }
      if (Math.abs(rpmError) <= 5) {
        rpmAutoInPhaseSinceRef.current ??= performance.now();
      } else {
        rpmAutoInPhaseSinceRef.current = null;
      }
      const inPhaseSeconds = rpmAutoInPhaseSinceRef.current
        ? (performance.now() - rpmAutoInPhaseSinceRef.current) / 1000
        : 0;

      // Latch the transition out of steam-building. Without this hysteresis,
      // a few kPa either side of nominal repeatedly commanded opposing valve
      // movements and stalled the turbine around 7,250 kPa.
      if (pressure >= 7100) rpmAutoSteamReadyRef.current = true;
      if (pressure < 4500 && actualRPM < 100) {
        rpmAutoSteamReadyRef.current = false;
      }

      // Stage 1: build the main-steam inventory by closing bypass before any
      // turbine admission. This prevents an empty steam header run-up.
      if (!rpmAutoSteamReadyRef.current) {
        setValveValue((value) => Math.max(0, value - 0.35));
        setBypassValve((value) =>
          Math.round(
            clamp(value - clamp((7100 - pressure) / 1100, 0.11, 0.6), 0, 100) * 10,
          ) / 10,
        );
        return;
      }

      // Stage 2: Auto RPM is a no-load steam-flow governor. It targets about
      // 200 kg/s turbine admission and deliberately does not chase shaft RPM
      // after that. RPM can settle naturally or be handled by the operator.
      const availableSteam = Math.max(1, thermalOutput.steamKgS * steamPressureFactor * steamPathCapacity);
      const targetMainValve = clamp(200 / availableSteam * 100, 0, 100);
      setValveValue((value) =>
        Math.round(clamp(value + clamp(targetMainValve - value, -0.1, 0.1), 0, 100) * 10) / 10,
      );
      setBypassValve((value) => {
        // Protect the header without introducing RPM-based hunting. Bypass
        // only opens at genuinely high pressure and closes again below the
        // safe band so the 200 kg/s turbine-flow target can recover.
        if (pressure > 8500 || pressureRate > 450) return Math.round(clamp(value + 0.25, 0, 100) * 10) / 10;
        if (pressure < 5500 || pressureRate < -450) return Math.round(clamp(value - 0.2, 0, 100) * 10) / 10;
        return Math.round(clamp(value - 0.05, 0, 100) * 10) / 10;
      });
    }, 125);
    return () => window.clearInterval(governor);
  }, [turbineRpmAuto, isRunning, mainSteamInletOpen, isLocked, actualRPM, pressure, pressureRate, turbineSteamFlow, valveDirection, bypassDirection, thermalOutput.steamKgS, steamPressureFactor]);
  const lubePressure =
    simpleMode ||
    lubePumpSource === "aux" ||
    (lubePumpSource === "emergency" && safetyBusS) ||
    (lubePumpSource === "off" && actualRPM >= 1800)
      ? 100
      : 0;
  const hydraulicPressure =
    simpleMode ||
    hydraulicPumpSource === "aux" ||
    (hydraulicPumpSource === "emergency" && safetyBusS) ||
    (hydraulicPumpSource === "off" && actualRPM >= 1800)
      ? 100
      : 0;
  // Feedwater auxiliaries are operated from the pump bay. The main physics
  // authority runs AUTO so specialist tabs only send commands and never run a
  // competing temperature controller.
  useEffect(() => {
    if (!isPhysicsAuthority || !feedwaterAuxAuto) return;
    setFeedwaterMotorCoolingA(clamp(18 + feedwaterFlow * 0.72, 15, 95));
    setFeedwaterMotorCoolingB(clamp(18 + feedwaterPumpBFlow * 0.72, 15, 95));
    setFeedwaterOilPreheatA(!pump1Online && feedwaterFlow < 1);
    setFeedwaterOilPreheatB(!pump2Online && feedwaterPumpBFlow < 1);
  }, [isPhysicsAuthority, feedwaterAuxAuto, feedwaterFlow, feedwaterPumpBFlow, pump1Online, pump2Online]);
  const feedwaterMotorTemperatureA = clamp(28 + feedwaterFlow * 0.62 - feedwaterMotorCoolingA * 0.32, 20, 130);
  const feedwaterMotorTemperatureB = clamp(28 + feedwaterPumpBFlow * 0.62 - feedwaterMotorCoolingB * 0.32, 20, 130);
  const feedwaterOilTemperatureA = clamp(22 + (feedwaterOilPreheatA ? 22 : 0) + feedwaterFlow * 0.06, 18, 75);
  const feedwaterOilTemperatureB = clamp(22 + (feedwaterOilPreheatB ? 22 : 0) + feedwaterPumpBFlow * 0.06, 18, 75);
  const turbineReadiness = simpleMode ? {} : {
    "MAIN STEAM PRESSURE": pressure >= 5500 && pressure <= 8500,
    "CONDENSER VACUUM": condenserVacuum >= 0.04 && condenserVacuum <= 0.07,
    "HYDRAULIC PUMP PRESSURE": hydraulicPressure >= 80,
    "LUBRICATION PUMP PRESSURE": lubePressure >= 80,
    "TURNING GEAR OFF": !turningGear,
  };
  const turbineReady = simpleMode || Object.values(turbineReadiness).every(Boolean);
  useEffect(() => {
    turbineAuxRef.current = {
      coldOilValve,
      warmOilValve,
      actualRPM,
      simpleMode,
      turningGear,
      preheatValve,
      temperature,
    };
  }, [coldOilValve, warmOilValve, actualRPM, simpleMode, turningGear, preheatValve, temperature]);
  useEffect(() => {
    const tick = window.setInterval(() => {
      const aux = turbineAuxRef.current;
      if (aux.simpleMode) {
        setOilTemperature(50);
        setTurbineMetalTemperature(250);
        return;
      }
      // A standalone oil thermal balance: cold water has strong cooling,
      // warm water provides a smaller trimming path, and shaft heat raises
      // oil temperature gradually with RPM. Valve changes now move the
      // indicated oil temperature through a meaningful operating range.
      const shaftHeat = clamp(aux.actualRPM / 3600, 0, 1) * 12;
      const oilTarget = clamp(
        58 + shaftHeat - aux.coldOilValve * 0.32 - aux.warmOilValve * 0.12,
        20,
        90,
      );
      setOilTemperature((value) =>
        clamp(value + clamp((oilTarget - value) * 0.07, -1, 1), 20, 100),
      );
      // This auxiliary preheat path has its own metal-temperature limit; it
      // does not depend on the main-steam-temperature run-up condition.
      const preheatActive = aux.turningGear && aux.preheatValve;
      const metalTarget = preheatActive
        ? 280
        : 25;
      setTurbineMetalTemperature((value) =>
        clamp(
          value +
            (metalTarget - value) *
              (preheatActive ? 0.012 : 0.003),
          20,
          350,
        ),
      );
    }, 500);
    return () => window.clearInterval(tick);
  }, []);
  useEffect(() => {
    if (simpleMode) return;
    if (!isLocked && actualRPM > 1800 && oilTemperature < 25) {
      tripTurbine("lubrication oil temperature entered the danger zone");
    }
  }, [actualRPM, oilTemperature, isLocked, simpleMode]);
  useEffect(() => {
    // Turning gear is a low-speed maintenance drive. Steam run-up with it
    // engaged would damage the gear and therefore causes a turbine trip.
    if (!turningGear || (actualRPM <= 100 && valveValue <= 2)) return;
    setTurningGear(false);
    setPreheatValve(false);
    tripTurbine("turning gear remained engaged during turbine run-up");
  }, [turningGear, actualRPM, valveValue]);
  useEffect(() => {
    if (simpleMode) return;
    if (turbineSmoke !== "idle" || actualRPM <= 3000 || lubePressure >= 80)
      return;
    const chance = window.setInterval(() => {
      if (Math.random() < 0.002) {
        setTurbineSmoke("countdown");
        setAgentSeconds(10);
        setEvent("TURBINE SMOKE — agent release is available.");
      }
    }, 1000);
    return () => window.clearInterval(chance);
  }, [turbineSmoke, actualRPM, lubePressure, simpleMode]);
  useEffect(() => {
    if (turbineSmoke !== "countdown") return;
    if (agentSeconds <= 0) {
      setTurbineSmoke("released");
      tripTurbine("fire agent released");
      return;
    }
    const timer = window.setTimeout(
      () => setAgentSeconds((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [turbineSmoke, agentSeconds]);
  const alarms = Object.values(rpsTrips).some(Boolean)
    ? "RPS TRIP NODE LATCHED"
    : reactorLevel < -1.5
      ? "REACTOR LEVEL LOW"
      : "All plant systems nominal.";
  // The simulator represents a ready-to-operate unit rather than requiring a
  // separate "start reactor" button. A cleared RPS line-up therefore keeps
  // the core physics enabled; SCRAM remains the operator shutdown action.
  useEffect(() => {
    if (!Object.values(rpsTrips).some(Boolean)) setIsRunning(true);
  }, [rpsTrips]);
  const start = () => {
    if (Object.values(rpsTrips).some(Boolean)) {
      setEvent("START INHIBITED — reset RPS nodes first.");
      return;
    }
    setIsRunning(true);
    setScramPressed(false);
    setEvent("Reactor criticality sequence started.");
  };
  const instantStartup = () => {
    if (Object.values(rpsTrips).some(Boolean)) {
      setEvent("INSTANT STARTUP INHIBITED — reset RPS nodes first.");
      return;
    }
    setRods((previous) =>
      previous.map((rod) => ({
        ...rod,
        position: 80,
        temperature: Math.max(rod.temperature, 45),
      })),
    );
    setMode("RUN");
    setIprCycle(3);
    setIrmRange(8);
    setAutoEnabled(false);
    setRodDirection(0);
    setSelectedRodId("A1");
    setIsRunning(true);
    setScramPressed(false);
    setEvent(
      "INSTANT STARTUP COMPLETE — SRM and IRM programme set to RUN handoff position.",
    );
  };
  const resetTrips = () => {
    if (
      reactorLevel <= -5 ||
      reactorLevel >= 6 ||
      mccLevel < 15 ||
      temperature > 900 ||
      pressure > 9500 ||
      reactorPeriod < 20
    ) {
      setEvent("RPS RESET REJECTED — unsafe process condition remains.");
      return;
    }
    setRpsTrips(
      Object.fromEntries(Object.keys(rpsTrips).map((key) => [key, false])),
    );
    setScramPressed(false);
    setEvent("RPS nodes reset.");
  };
  const reset = () => {
    localStorage.removeItem(unitStateStorageKey);
    sessionStorage.removeItem(liveStateStorageKey);
    localStorage.removeItem(liveStateStorageKey);
    sessionStorage.removeItem("rbwr-pending-console-command");
    sessionStorage.removeItem("rbwr-pending-console-commands");
    setActive("status");
    setConsoleOpen(false);
    setTutorialEnabled(false);
    setTutorialLevel(1);
    setTemperature(25);
    setPressure(101);
    setFuelLevel(100);
    setPressureRate(0);
    setValveValue(0);
    setValveDirection(0);
    setMainSteamInletOpen(false);
    setBypassValve(100);
    setBypassDirection(0);
    setReliefOpen(false);
    setReliefValveB(false);
    setTurbinePressureAuto(false);
    setTurbineRpmAuto(false);
    setPhysicsTuning({
      thermalResponse: 1,
      steamProduction: 1,
      steamRemoval: 1,
      tripTemperature: 1100,
    });
    setRods(createInitialRods());
    setRodAprm(0);
    rodAprmRef.current = 0;
    rodKineticsRef.current = { observed: 0, target: 0, startedAt: 0, intensity: 0, origin: 0 };
    setSelectedRodId("A1");
    setMode("SD");
    setIprCycle(1);
    setIrmRange(1);
    setRodDirection(0);
    setSelectionScope("rod");
    setReactorPeriod(999);
    setPeriodRecirculationAprm(0);
    setRecirculationAprm(0);
    setAutoEnabled(false);
    setAutoTarget(1);
    setAutoSpeed("medium");
    setAutoMode("rods");
    setAutoMessage("Auto APRM is standing by.");
    setReactorLevel(0);
    setHotwellLevel(0);
    setDeaeratorLevel(0);
    setDaTemperature(110);
    setDaPressure(1.5);
    setDaAuto(false);
    setDaIntakeOpen(true);
    setDaOutputOpen(true);
    setDaIntakeValve(100);
    setDaOuttakeValve(100);
    setDaIntakeDirection(0);
    setDaOuttakeDirection(0);
    setDaFastCloseHeld(false);
    setDaBypassValve(false);
    setDaMainAirValve(true);
    setDaRuptureDisk("intact");
    setCondensateFlow(0);
    setCondensatePumpBFlow(0);
    setFeedwaterFlow(0);
    setFeedwaterPumpBFlow(0);
    setFeedwaterAuxAuto(true);
    setFeedwaterMotorCoolingA(35);
    setFeedwaterMotorCoolingB(35);
    setFeedwaterOilPreheatA(false);
    setFeedwaterOilPreheatB(false);
    setPump1Online(false);
    setPump2Online(false);
    setBypassValve(100);
    setBypassDirection(0);
    setCondenserVacuum(1);
    condenserTargetRef.current = 1;
    condenserPhaseRef.current = 0;
    setCondenserValve(0);
    setCondenserValveDirection(0);
    setCondenserAuto(false);
    setCondenserPumpOn(false);
    setCondenserPumpB(false);
    setCondenserCirculationPumpOn(false);
    setCondenserCirculationPumpB(false);
    setCarAOn(false);
    setCarBOn(false);
    setSjaeOn(false);
    setMccLevel(100);
    setMccPumpOn(false);
    setMccAutoOn(false);
    setRecircPumpA(false);
    setRecircPumpB(false);
    setRecircSpeedA(0);
    setRecircSpeedB(0);
    setMalfunctions({ enabled: false, recircAFlowLossActive: false, recircBFlowLossActive: false });
    setGridDemandMW(newGridDemand());
    setNextGridDemandMW(newGridDemand());
    setSecondsToDemandChange(newDemandInterval());
    setRandomEventsEnabled(false);
    setPendingGridEvent(null);
    pendingGridEventRef.current = null;
    setOffsitePowerAvailable(true);
    setOffsiteCountdown(null);
    setAutomationCooldowns({ aprm: 0, mcc: 0, pressure: 0, condenser: 0 });
    setCstLevel(8);
    setCstMakeup(false);
    setCstDrain(false);
    setHotwellMakeup(false);
    setHotwellDrain(false);
    setRcicValve(false);
    setRcicFlow(0);
    setEccsPumpA(false);
    setEccsPumpB(false);
    setEccsPumpAMode("RHR");
    setEccsPumpBMode("RHR");
    setSrvOpen(Array(6).fill(false));
    setAdsActive(false);
    setLubePumpSource("off");
    setHydraulicPumpSource("off");
    setColdOilValve(0);
    setWarmOilValve(0);
    setTurningGear(false);
    setPreheatValve(false);
    setSteamSealing(false);
    setSteamSealingLeak(false);
    setPolisherTrainA(false);
    setPolisherTrainB(false);
    setPolisherAuto(false);
    setPolisherBypass(false);
    setPolisherTarget("A");
    setPolisherTankSelection(1);
    setPolisherTanks([
      { id: 1, stage: "ready", progress: 100, target: null },
      { id: 2, stage: "ready", progress: 100, target: null },
      { id: 3, stage: "ready", progress: 100, target: null },
    ]);
    setOilTemperature(25);
    setTurbineMetalTemperature(25);
    setTurbineSmoke("idle");
    setAgentSeconds(10);
    setIsRunning(false);
    // Reset must sever the generator from the grid. Leaving this latch true
    // incorrectly made the turbine a valid electrical source after reset.
    setIsLocked(false);
    setGridSync(0);
    setExciterOn(false);
    setTurbineSpeed(0);
    setTargetTurbineSpeed(0);
    setStartupBusA(false);
    setBusATransformer(false);
    setTurbineBusB(false);
    setSafetyBusS(false);
    setEdgBreaker(false);
    setEdgAuto(true);
    setEdgSelected("u2a");
    setEdgIgnitionBreaker(false);
    setEdgOutputBreaker(false);
    setEdgStartRequested(false);
    setEdgRpm(0);
    setEdgTankLevel(100);
    setEdgFuelA(100);
    setEdgFuelB(100);
    setEdgMainFuelValve(false);
    setEdgMainFuelPump(false);
    setEdgFuelValveA(false);
    setEdgFuelValveB(false);
    setEdgRefuellingSeconds(0);
    setAcDcInterlock(false);
    setSafetyToDcBreaker(false);
    setBusEToDcBreaker(false);
    setMainBatteryCharge(100);
    setRolldownProtection(true);
    setEdgBreaker(false);
    setRpsTripInhibit(false);
    localStorage.removeItem("rbwr-rps-trip-inhibit");
    previousSync.current = false;
    pressureSample.current = { value: 101, time: performance.now() };
    aprmSample.current = { value: 0, time: performance.now(), logRate: 0 };
    setScramPressed(false);
    setRpsTrips(
      Object.fromEntries(Object.keys(rpsTrips).map((key) => [key, false])),
    );
    setEvent("Simulator reset to cold shutdown.");
    window.setTimeout(() => window.dispatchEvent(new Event("rbwr-annunciator-master-ack")), 120);
  };
  useEffect(() => {
    if (
      previousSync.current &&
      !isLocked &&
      turbineBusB &&
      rolldownProtection &&
      !turbineBusEligible
    ) {
      setTurbineBusB(false);
      setRpsTrips((previous) => ({ ...previous, "TURBINE ROLLDOWN": true }));
      setEvent(
        "ROLLDOWN PROTECTION OPENED BUS B AND TRIPPED TURBINE PROTECTION.",
      );
    }
    previousSync.current = isLocked;
  }, [isLocked, turbineBusB, rolldownProtection, turbineBusEligible]);
  const runConsoleCommand = (raw: string) => {
    const [target, verb, rawValue] = raw.toLowerCase().trim().split(/\s+/);
    const value = Number(rawValue);
    if (target === "login") {
      const space = raw.trim().indexOf(" ");
      const name = (space < 0 ? "" : raw.trim().slice(space + 1)).replace(/[^a-z0-9 _-]/gi, "").trim().slice(0, 24);
      if (!name) return "Usage: LOGIN <yourname>. Use LOGOUT to operate as a guest without point scoring.";
      pendingScoreRef.current = 0;
      localStorage.setItem("unit2-operator-name", name);
      setOperatorName(name);
      setLeaderboard((previous) => previous[name] ? previous : { ...previous, [name]: { points: 0, lastSeen: Date.now() } });
      if (getPlantTransport() !== "local") void ensureLeaderboardPlayer(name).catch(() => {});
      return `LOGIN ACCEPTED — ${name}. Points will be recorded while you match grid demand.${getPlantTransport() === "local" ? " LOCAL-ONLY SCORE PROFILE ACTIVE." : ""}`;
    }
    if (target === "logout") {
      pendingScoreRef.current = 0;
      localStorage.removeItem("unit2-operator-name");
      setOperatorName("");
      return "GUEST MODE ACTIVE — simulation controls remain available, but points are not recorded.";
    }
    if (target === "leaderboard") {
      const rows = sortedOperators.slice(0, 5);
      const top = rows.length ? rows.map(([name, entry], index) => `${index + 1}. ${name} — ${Number(entry.points || 0).toFixed(1)} pts`).join("\n") : "No scored operators yet.";
      return `UNIT 2 LEADERBOARD\n${top}\n\n${operatorName ? `YOUR POSITION: #${operatorRank || "—"} / ${sortedOperators.length || "—"}\nTOTAL SCORE: ${operatorPoints.toFixed(1)} pts\nUNIT ${scoringUnit} SCORE: ${operatorUnitPoints.toFixed(1)} pts` : "GUEST MODE — LOGIN <yourname> to record points and receive a rank."}`;
    }
    if (target === "operations") {
      const activeTrips = Object.entries(rpsTrips)
        .filter(([, active]) => active)
        .map(([name]) => name);
      const turbinePowerReady = turbineBusEligible;
      const prospectiveBusACapacity = busATransformer && turbinePowerReady ? 60 : 38;
      const busALocked = sharedTurbineCapacityActive
        ? startupDemand + busBDemand > 150
        : startupDemand > prospectiveBusACapacity;
      const busBLocked = sharedTurbineCapacityActive
        ? startupDemand + busBDemand > 150
        : busBDemand > 60;
      const busSLocked = safetyDemand > 30;
      const busLine = (name: string, energized: boolean, commanded: boolean, demand: number, limit: number, locked: boolean) =>
        `${name}: ${energized ? "ENERGIZED" : commanded ? "DE-ENERGIZED" : "OPEN"} · ${demand.toFixed(1)}/${limit.toFixed(0)} kW${locked ? " · POWER-LOCKED (OVERLOAD ON ENERGIZATION)" : ""}`;
      if (verb === "trips")
        return activeTrips.length ? `TRIP STATUS\nACTIVE: ${activeTrips.join(" · ")}` : "TRIP STATUS\nNo active RPS trip nodes.";
      if (verb === "fuel")
        return `FUEL STATUS\nCORE INVENTORY: ${fuelLevel.toFixed(1)}%\nAPRM: ${aprm.toFixed(2)}% · ROD APRM: ${rodAprm.toFixed(2)}%`;
      if (verb === "demand")
        return `${demandManagerOnline ? "DEMAND MANAGER ONLINE" : "LOCAL GRID DEMAND"}\nCURRENT UNIT TARGET: ${unitDemandMW.toFixed(0)} MW\nNEXT SITE DEMAND: ${nextPlantDemandMW.toFixed(0)} MW in ${plantDemandSeconds}s\nNET UNIT PRODUCTION: ${netProductionMW.toFixed(1)} MW`;
      if (verb === "buses")
        return `BUS AVAILABILITY\n${busLine("BUS A", startupBusAvailable, startupBusA || busATransformer, startupDemand, sharedTurbineCapacityActive ? 150 : prospectiveBusACapacity, busALocked)}\n${busLine("BUS B", busBAvailable, turbineBusB, busBDemand, sharedTurbineCapacityActive ? 150 : 60, busBLocked)}\n${busLine("BUS S", safetyBusAvailable, safetyBusS, safetyDemand, 30, busSLocked)}\nBUS E: ${busEAvailable ? "ENERGIZED" : "DE-ENERGIZED"} · BATTERY ${mainBatteryCharge.toFixed(1)}%\nDC BUS: ${dcBusAvailable ? "ENERGIZED" : "DE-ENERGIZED"}`;
      if (verb === "status")
        return `UNIT 2 OPERATIONS STATUS\nREACTOR: ${isRunning ? "STARTED" : "SHUT DOWN"} · APRM ${aprm.toFixed(2)}% · ${pressure.toFixed(0)} kPa\nTURBINE: ${actualRPM.toFixed(0)} RPM · ${turbineOutputMW.toFixed(1)} MW · ${isLocked ? "GRID SYNCED" : "GRID OPEN"}\nFUEL: ${fuelLevel.toFixed(1)}% · CONDENSER: ${Math.round(condenserVacuum * 1000)} mbar\nTRIPS: ${activeTrips.length ? activeTrips.join(", ") : "CLEAR"}\nDEMAND: ${unitDemandMW.toFixed(0)} MW unit target · ${nextPlantDemandMW.toFixed(0)} MW site next in ${plantDemandSeconds}s · ${demandManagerOnline ? "MANAGER ONLINE" : "LOCAL MODE"}\nUse TRIP STATUS, BUS AVAILABILITY, FUEL STATUS, or NEXT DEMAND for detail.`;
      return "Operations query unavailable. Use STATUS, TRIP STATUS, BUS AVAILABILITY, FUEL STATUS, or NEXT DEMAND.";
    }
    if (target === "help" && verb === "values")
      return "READABLE VALUES: reactor.temp|pressure|level|fuel|period|aprm|rodaprm, hotwell.level, da.level|temp|pressure|intake|outtake, cst.level, condenser.pressure|valve, condensate.a|b, feedwater.a|b, recirc.a|b|flow.a|flow.b, turbine.rpm|output|mainvalve|bypass|steamflow, electrical.battery|load.a|load.b|load.s|bus.a|bus.b|bus.s|dc, rcic.flow, oil.temp, turbine.metaltemp.";
    if (target === "help" && verb === "scenarios")
      return "SCENARIOS: cold — full reset; reactor-ready — RUN core, stable MCC, turbine offline; turbine-synced — ready reactor and synchronized turbine; grid-load — synchronized moderate-load unit; offsite — warning, then a 100-second loss-of-offsite-power drill.";
    if (target === "help")
      return "Commands: LOGIN <name> | LOGOUT (guest mode) | LEADERBOARD | VALUES | GET <value> | <value> SET <n> | <switch> ON|OFF | SCRAM | START|STOP | PAUSE | UNPAUSE | SCENARIO <cold|reactor-ready|turbine-synced|grid-load|offsite>. Values: reactor.temp|pressure|level, hotwell.level, da.level|temp|pressure, cst.level, condenser.pressure|valve, condensate.a|b, feedwater.a|b, recirc.a|b, turbine.mainvalve|bypass, auto.aprm, physics.thermal|steam|removal|triptemp. Switches: mcc.auto|pump, condenser.auto|pump.a|pump.b|circulation.a|circulation.b, recirc.pump.a|b, turbine.rpmauto|pressureauto|inlet, electrical.busa|bustransformer|busb|buss, rcic.valve, eccs.a|b, ads.";
    if (target === "pause" || target === "unpause" || target === "resume") {
      const paused = target === "pause";
      setSimulationPaused(paused);
      setEvent(paused ? "SIMULATION CLOCK PAUSED — CLI control remains available." : "SIMULATION CLOCK RESUMED.");
      return paused ? "Simulation clock paused." : "Simulation clock resumed.";
    }
    if (target === "scenario") {
      const scenario = verb;
      if (scenario === "offsite") {
        setOffsiteCountdown(100);
        setEvent("GRID WARNING — MANUAL OFFSITE-POWER LOSS DRILL IN 100 SECONDS. PREPARE TURBINE ISLANDING.");
        return "Offsite-power loss drill armed. External power will be lost in 100 seconds; prepare turbine islanding.";
      }
      if (scenario === "cold") {
        reset();
        return "Cold shutdown scenario loaded.";
      }
      if (scenario === "reactor-ready" || scenario === "turbine-synced" || scenario === "grid-load") {
        // A scenario must seed the plant's *dynamic* state as well as its
        // controls.  Previously GRID-LOAD only changed displayed controls,
        // leaving delayed rod/recirculation power at its old value.  The next
        // clocks then pulled pressure, condenser vacuum and MCC inventory away
        // from the preset immediately.
        const gridLoad = scenario === "grid-load";
        const turbineOnline = scenario !== "reactor-ready";
        const presetRodAprm = 20;
        const presetRecirculationAprm = gridLoad ? 25 : 0;
        const presetAprm = presetRodAprm + presetRecirculationAprm;
        // Half withdrawal now produces the 20% rod-APRM operating point.
        // Scenarios begin at this controllable mid-range core condition,
        // never with every rod fully withdrawn.
        const presetRodPosition = 50;
        // These valve combinations are calculated from the same pressure
        // model used by the physics clock: they balance steam production near
        // 7,100 kPa instead of relying on a one-frame pressure reading.
        const presetMainValve = scenario === "reactor-ready" ? 0 : gridLoad ? 60 : 60;
        const presetBypassValve = scenario === "reactor-ready" ? 100 : gridLoad ? 22 : 40;
        const presetProcessFlow = gridLoad ? 72.3 : 20.9;
        // At the preset steam rates, this puts the condenser model close to
        // its 52–55 mbar design band without needing an auto-controller.
        const presetCondenserValve = gridLoad ? 7.2 : 30;
        setRpsTrips((previous) => Object.fromEntries(Object.keys(previous).map((key) => [key, false])));
        setIsRunning(true); setScramPressed(false); setMode("RUN"); setIprCycle(8); setIrmRange(8);
        setRods((previous) => previous.map((rod) => ({ ...rod, position: presetRodPosition, temperature: 25 + presetAprm * 3.2 })));
        setRodDirection(0); setAutoEnabled(false); setTurbinePressureAuto(false); setTurbineRpmAuto(false);
        setRodAprm(presetRodAprm);
        rodAprmRef.current = presetRodAprm;
        rodKineticsRef.current = { observed: presetRodAprm, target: presetRodAprm, startedAt: 0, intensity: 0, origin: presetRodAprm };
        setRecirculationAprm(presetRecirculationAprm);
        setPeriodRecirculationAprm(presetRecirculationAprm);
        periodAprmRef.current = presetAprm;
        aprmSample.current = { value: presetAprm, time: performance.now(), logRate: 0 };
        setReactorPeriod(999);
        setTemperature(25 + presetAprm * 3.2);
        setReactorLevel(0); setHotwellLevel(0); setDeaeratorLevel(0); setCstLevel(6);
        setDaTemperature(110); setDaPressure(1.5); setDaIntakeOpen(true); setDaOutputOpen(true); setDaIntakeValve(100); setDaOuttakeValve(100); setDaAuto(false);
        setMccPumpOn(true); setMccAutoOn(false);
        setCondenserValve(presetCondenserValve); setCondenserVacuum(.052); setCondenserAuto(false);
        condenserTargetRef.current = .052;
        setCondenserPumpOn(true); setCondenserPumpB(false); setCondenserCirculationPumpOn(true); setCondenserCirculationPumpB(false);
        setCarAOn(false); setCarBOn(false); setSjaeOn(false);
        setPump1Online(true); setPump2Online(false); setCondensateFlow(presetProcessFlow); setCondensatePumpBFlow(0); setFeedwaterFlow(presetProcessFlow); setFeedwaterPumpBFlow(0);
        // 50% on each pump supplies the 25 APRM recirculation share used by
        // GRID-LOAD, with room to raise recirculation to 50 APRM if needed.
        setRecircPumpA(gridLoad); setRecircPumpB(gridLoad); setRecircSpeedA(gridLoad ? 50 : 0); setRecircSpeedB(gridLoad ? 50 : 0);
        setMalfunctions((previous) => ({ ...previous, recircAFlowLossActive: false, recircBFlowLossActive: false }));
        setOffsitePowerAvailable(true); setOffsiteCountdown(null); setPendingGridEvent(null);
        setSafetyBusS(true); setSafetyToDcBreaker(true); setAcDcInterlock(false); setBusEToDcBreaker(false); setMainBatteryCharge(100);
        setMainSteamInletOpen(true); setPressure(7100); pressureSample.current = { value: 7100, time: performance.now() };
        setBypassValve(presetBypassValve); setBypassDirection(0); setValveValue(presetMainValve); setValveDirection(0);
        setSrvOpen((previous) => previous.map(() => false)); setAdsActive(false);
        if (turbineOnline) {
          setExciterOn(true); setTurbineSpeed(66.67); setTargetTurbineSpeed(66.67); setIsLocked(true);
          setBusATransformer(true); setStartupBusA(false); setTurbineBusB(true);
          setGridSync(100);
        } else {
          setExciterOn(false); setTurbineSpeed(0); setTargetTurbineSpeed(0); setIsLocked(false);
          // Reactor-ready uses offsite power and a fully-open bypass: a hot,
          // pressure-controlled reactor with the turbine deliberately offline.
          setStartupBusA(true); setBusATransformer(false); setTurbineBusB(false); setGridSync(0);
        }
        setEvent(`CLI SCENARIO LOADED — ${scenario.toUpperCase().replace("-", " ")}. APRM, steam balance, condenser, MCC and electrical lineup have been initialized together.`);
        return `Scenario ${scenario.toUpperCase()} loaded.`;
      }
      return "Unknown scenario. Use SCENARIO cold, reactor-ready, turbine-synced, grid-load, or offsite.";
    }
    if (target === "values" || target === "status")
      return `REACTOR ${temperature.toFixed(1)}°C · ${pressure.toFixed(0)} kPa · ${reactorLevel.toFixed(2)} m · APRM ${aprm.toFixed(2)}%\nMCC hotwell ${hotwellLevel.toFixed(2)} m · DA ${deaeratorLevel.toFixed(2)} m · CST ${cstLevel.toFixed(2)} m\nCOND ${Math.round(condenserVacuum * 1000)} mbar / valve ${condenserValve.toFixed(1)}% · RECIRC A/B ${recircAFlow.toFixed(1)}/${recircBFlow.toFixed(1)} kg/s\nTURBINE ${actualRPM.toFixed(0)} RPM · main ${valveValue.toFixed(1)}% · bypass ${bypassValve.toFixed(1)}%`;
    if (target === "get") {
      const readings: Record<string, number | string> = {
        "reactor.temp": temperature, "reactor.pressure": pressure, "reactor.level": reactorLevel,
        "reactor.fuel": fuelLevel, "reactor.period": reactorPeriod, "reactor.aprm": aprm, "reactor.rodaprm": rodAprm,
        "hotwell.level": hotwellLevel, "da.level": deaeratorLevel, "da.temp": daTemperature,
        "da.pressure": daPressure, "da.intake": daIntakeValve, "da.outtake": daOuttakeValve, "cst.level": cstLevel, "condenser.pressure": condenserVacuum,
        "condenser.valve": condenserValve, "condensate.a": condensateFlow, "condensate.b": condensatePumpBFlow,
        "feedwater.a": feedwaterFlow, "feedwater.b": feedwaterPumpBFlow, "recirc.a": recircSpeedA,
        "recirc.b": recircSpeedB, "recirc.flow.a": recircAFlow, "recirc.flow.b": recircBFlow,
        "turbine.rpm": actualRPM, "turbine.output": turbineOutputMW, "turbine.steamflow": steamFlow, "turbine.mainvalve": valveValue, "turbine.bypass": bypassValve,
        "auto.aprm": autoTarget, "rcic.flow": rcicFlow, "oil.temp": oilTemperature, "turbine.metaltemp": turbineMetalTemperature,
        "electrical.battery": mainBatteryCharge, "electrical.load.a": startupLoad, "electrical.load.b": busBLoad, "electrical.load.s": safetyLoad,
        "electrical.bus.a": startupBusAvailable ? "ENERGIZED" : "DE-ENERGIZED", "electrical.bus.b": busBAvailable ? "ENERGIZED" : "DE-ENERGIZED",
        "electrical.bus.s": safetyBusAvailable ? "ENERGIZED" : "DE-ENERGIZED", "electrical.dc": dcBusAvailable ? "ENERGIZED" : "DE-ENERGIZED",
      };
      const key = verb;
      return key in readings ? `${key.toUpperCase()} = ${typeof readings[key] === "number" ? Number(readings[key]).toFixed(3) : readings[key]}` : "Unknown value. Use VALUES for the live summary.";
    }
    if (target === "scram") {
      scram(true);
      return "Manual SCRAM actuated.";
    }
    if (target === "rps" && verb === "reset") {
      resetTrips();
      return "RPS reset requested; active initiating conditions remain protected.";
    }
    if (target === "srv" && (verb === "all" || /^[1-6]$/.test(verb || "")) && (rawValue === "on" || rawValue === "off")) {
      const open = rawValue === "on";
      setSrvOpen((previous) => verb === "all" ? previous.map(() => open) : previous.map((value, index) => index === Number(verb) - 1 ? open : value));
      return `SRV ${verb === "all" ? "bank" : verb} ${open ? "opened" : "closed"}.`;
    }
    if (target === "start" || target === "stop") {
      setIsRunning(target === "start");
      return `Simulator ${target === "start" ? "started" : "stopped"}.`;
    }
    if (target === "turbine.smoke" && verb === "trigger") {
      setTurbineSmoke("countdown");
      setAgentSeconds(10);
      setEvent("CONSOLE EVENT — turbine smoke triggered.");
      return "Turbine smoke triggered; agent release countdown available.";
    }
    if (target === "maintenance" && verb === "repair") {
      setMalfunctions((current) => ({ ...current, recircAFlowLossActive: false, recircBFlowLossActive: false }));
      setEvent("UNIT 2 MAINTENANCE — active random malfunctions cleared.");
      return "Maintenance repair complete. Active random malfunctions cleared.";
    }
    if (target === "maintenance" && verb === "edg" && rawValue === "refuel") {
      if (edgRefuellingSeconds > 0) return "EDG local-tank delivery is already in progress.";
      if (edgTankLevel >= 99.9) return "EDG local storage tank is already full.";
      setEdgRefuellingSeconds(180);
      setEdgMainFuelPump(false);
      setEvent("EDG MAINTENANCE — local tank refuelling started; main fuel pump locked off for 180 seconds.");
      return "EDG refuelling initiated. Local storage tank will fill over 3 minutes.";
    }
    if (target === "maintenance" && verb === "turbine" && rawValue === "oil-check")
      return `TCR OIL LEAK CHECK — lubrication pressure ${lubePressure.toFixed(0)}%, oil temperature ${oilTemperature.toFixed(1)} °C. No simulated leak sensor installed.`;
    if (target === "maintenance" && verb === "turbine" && rawValue === "repair") {
      setTurbineSmoke("idle");
      setAgentSeconds(10);
      setEvent("TCR MAINTENANCE — turbine damage repair recorded.");
      return "Turbine repair complete; smoke/fire exercise reset.";
    }
    if (target === "maintenance" && verb === "unit" && rawValue === "refuel") {
      setEvent("UNIT 2 MAINTENANCE — refuelling process started.");
      return "Unit refuelling process logged. Core fuel mechanics are reserved for a future maintenance update.";
    }
    if (target === "hr" && verb === "points")
      return `OPERATOR PERFORMANCE\nNAME: ${operatorName}\nPOINTS: ${operatorPoints.toFixed(1)}\nRANK: #${operatorRank || "—"} / ${sortedOperators.length || 1}`;
    if (target === "grid" && verb === "disconnect") {
      setIsLocked(false);
      setEvent("GRID CONTROL — generator disconnected from the grid.");
      return "Grid breaker opened. The turbine may continue in island-capable operation.";
    }
    if (target === "fss" && ["silence", "reset", "test"].includes(verb || "")) {
      if (verb === "test") {
        setTurbineSmoke("countdown");
        setAgentSeconds(10);
        setEvent("FSS MASTER PANEL — turbine smoke/fire test initiated.");
        return "FSS test active: turbine smoke/fire countdown initiated.";
      }
      window.dispatchEvent(new CustomEvent(`rbwr-annunciator-master-${verb}`));
      if (verb === "reset") setEvent("FSS MASTER PANEL — alarm reset requested.");
      return `FSS master alarm ${verb} command sent.`;
    }
    const switches: Record<string, (enabled: boolean) => void> = {
      "mcc.auto": setMccAutoOn, "mcc.pump": setMccPumpOn,
      "condenser.auto": setCondenserAuto, "condenser.pump.a": setCondenserPumpOn,
      "condenser.pump.b": setCondenserPumpB, "condenser.circulation.a": setCondenserCirculationPumpOn,
      "condenser.circulation.b": setCondenserCirculationPumpB, "recirc.pump.a": setRecircPumpA,
      "recirc.pump.b": setRecircPumpB, "turbine.inlet": setMainSteamInletOpen,
      "turbine.rpmauto": setTurbineRpmAuto, "turbine.pressureauto": setTurbinePressureAuto,
      "electrical.busa": setStartupBusA, "electrical.busatransformer": setBusATransformer,
      "electrical.busb": setTurbineBusB, "electrical.buss": setSafetyBusS,
      "electrical.acdc": setAcDcInterlock, "electrical.safetydc": setSafetyToDcBreaker, "electrical.edc": setBusEToDcBreaker,
      "electrical.rolldown": setRolldownProtection, "rcic.valve": setRcicValve, "eccs.a": setEccsPumpA, "eccs.b": setEccsPumpB,
      "ads": setAdsActive, "mcc.cstmakeup": setCstMakeup, "mcc.cstdrain": setCstDrain, "mcc.hotwellmakeup": setHotwellMakeup,
      "mcc.hotwelldrain": setHotwellDrain, "condenser.car.a": setCarAOn, "condenser.car.b": setCarBOn, "condenser.sjae": setSjaeOn,
      "turbine.exciter": setExciterOn, "turbine.grid": setIsLocked, "turbine.relief.a": setReliefOpen, "turbine.relief.b": setReliefValveB,
      "turbine.turninggear": setTurningGear, "turbine.preheat": setPreheatValve, "auto.aprm": setAutoEnabled,
    };
    if (target in switches && (verb === "on" || verb === "off")) {
      const enabled = verb === "on";
      switches[target](enabled);
      if (target === "turbine.rpmauto" && enabled) setTurbinePressureAuto(false);
      if (target === "turbine.pressureauto" && enabled) setTurbineRpmAuto(false);
      return `${target.toUpperCase()} ${enabled ? "ENABLED" : "DISABLED"}.`;
    }
    if (target === "mode" && verb === "set" && ["sd", "srm", "ipr", "run"].includes(rawValue)) {
      setMode(rawValue.toUpperCase() as ReactorMode);
      return `Reactor mode set to ${rawValue.toUpperCase()}.`;
    }
    if (target === "auto.mode" && verb === "set" && ["rods", "recirculation"].includes(rawValue)) {
      setAutoMode(rawValue as "rods" | "recirculation");
      return `Auto APRM actuator set to ${rawValue}.`;
    }
    if (target === "auto.speed" && verb === "set" && ["slow", "medium", "fast"].includes(rawValue)) {
      setAutoSpeed(rawValue as AutoSpeed);
      return `Auto APRM speed set to ${rawValue}.`;
    }
    if (target === "eccs.a.mode" && verb === "set" && ["rhr", "lpci"].includes(rawValue)) { setEccsPumpAMode(rawValue.toUpperCase() as "RHR" | "LPCI"); return `ECCS A mode set to ${rawValue.toUpperCase()}.`; }
    if (target === "eccs.b.mode" && verb === "set" && ["rhr", "lpci"].includes(rawValue)) { setEccsPumpBMode(rawValue.toUpperCase() as "RHR" | "LPCI"); return `ECCS B mode set to ${rawValue.toUpperCase()}.`; }
    if (target === "turbine.lube" && ["aux", "emergency", "off"].includes(verb)) { setLubePumpSource(verb as "aux" | "emergency" | "off"); return `Lubrication pump source set to ${verb}.`; }
    if (target === "turbine.hydraulic" && ["aux", "emergency", "off"].includes(verb)) { setHydraulicPumpSource(verb as "aux" | "emergency" | "off"); return `Hydraulic pump source set to ${verb}.`; }
    if (!Number.isFinite(value)) return "Invalid value. Use HELP for syntax.";
    if (target === "reactor.aprm" && verb === "set") {
      const withdrawn = clamp(value, 0, 100);
      setRods((previous) =>
        previous.map((rod) => ({ ...rod, position: 100 - withdrawn })),
      );
      return `All rods set to ${withdrawn.toFixed(1)}% withdrawn.`;
    }
    if (target === "reactor.pressure" && verb === "set") {
      setPressure(clamp(value, 101, 12000));
      return `RPV pressure set to ${value.toFixed(0)} kPa.`;
    }
    const numericControls: Record<string, { min: number; max: number; set: (next: number) => void; unit: string }> = {
      "reactor.temp": { min: 20, max: 1800, set: setTemperature, unit: "°C" },
      "reactor.fuel": { min: 0, max: 100, set: setFuelLevel, unit: "%" },
      "hotwell.level": { min: -5, max: 6, set: setHotwellLevel, unit: "m" },
      "da.level": { min: -5, max: 6, set: setDeaeratorLevel, unit: "m" },
      "da.temp": { min: 100, max: 120, set: setDaTemperature, unit: "°C" },
      "da.pressure": { min: 1, max: 2.2, set: setDaPressure, unit: "bar" },
      "da.intake": { min: 0, max: 100, set: setDaIntakeValve, unit: "%" },
      "da.outtake": { min: 0, max: 100, set: setDaOuttakeValve, unit: "%" },
      "cst.level": { min: 0, max: 10, set: setCstLevel, unit: "m" },
      "condenser.pressure": { min: .001, max: 1.5, set: setCondenserVacuum, unit: "bar" },
      "condenser.valve": { min: 0, max: 100, set: setCondenserValve, unit: "%" },
      "condensate.a": { min: 0, max: 2000, set: setCondensateFlow, unit: "kg/s" },
      "condensate.b": { min: 0, max: 2000, set: setCondensatePumpBFlow, unit: "kg/s" },
      "feedwater.a": { min: 0, max: 1000, set: setFeedwaterFlow, unit: "kg/s" },
      "feedwater.b": { min: 0, max: 1000, set: setFeedwaterPumpBFlow, unit: "kg/s" },
      "recirc.a": { min: 0, max: 100, set: setRecircSpeedA, unit: "%" },
      "recirc.b": { min: 0, max: 100, set: setRecircSpeedB, unit: "%" },
      "turbine.mainvalve": { min: 0, max: 100, set: setValveValue, unit: "%" },
      "turbine.bypass": { min: 0, max: 100, set: setBypassValve, unit: "%" },
      "auto.aprm": { min: 0, max: 105, set: setAutoTarget, unit: "%" },
      "rcic.flow": { min: 0, max: 100, set: setRcicFlow, unit: "%" },
      "oil.cold": { min: 0, max: 100, set: setColdOilValve, unit: "%" },
      "oil.warm": { min: 0, max: 100, set: setWarmOilValve, unit: "%" },
      "grid.demand": { min: 300, max: 1200, set: setGridDemandMW, unit: "MW" },
      "turbine.rpm": { min: 0, max: 3000, set: (next) => setTurbineSpeed(next / 45), unit: "RPM" },
    };
    if (target in numericControls && verb === "set") {
      const control = numericControls[target];
      const next = clamp(value, control.min, control.max);
      control.set(next);
      return `${target.toUpperCase()} set to ${next.toFixed(2)} ${control.unit}.`;
    }
    if (target === "reactor.level" && (verb === "set" || verb === "add")) {
      setReactorLevel((current) =>
        clamp(verb === "add" ? current + value : value, -5, 6),
      );
      return "Reactor level override accepted.";
    }
    if (target === "rods.withdraw" && verb === "set") {
      const withdrawn = clamp(value, 0, 100);
      setRods((previous) =>
        previous.map((rod) => ({ ...rod, position: 100 - withdrawn })),
      );
      return `Rods set to ${withdrawn.toFixed(1)}% withdrawn.`;
    }
    if (target.startsWith("physics.") && verb === "set") {
      const key = target.slice(8);
      if (key === "thermal")
        setPhysicsTuning((current) => ({
          ...current,
          thermalResponse: clamp(value, 0, 3),
        }));
      if (key === "steam")
        setPhysicsTuning((current) => ({
          ...current,
          steamProduction: clamp(value, 0, 3),
        }));
      if (key === "removal")
        setPhysicsTuning((current) => ({
          ...current,
          steamRemoval: clamp(value, 0, 3),
        }));
      if (key === "triptemp")
        setPhysicsTuning((current) => ({
          ...current,
          tripTemperature: clamp(value, 100, 1800),
        }));
      if (!["thermal", "steam", "removal", "triptemp"].includes(key))
        return "Unknown physics value. Use thermal, steam, removal, or triptemp.";
      return key === "triptemp"
        ? `Physics trip temperature set to ${clamp(value, 100, 1800).toFixed(0)} °C.`
        : `Physics ${key} multiplier set to ${clamp(value, 0, 3).toFixed(2)}.`;
    }
    return "Unknown command. Type HELP.";
  };
  useEffect(() => {
    let pendingCommands: string[] = [];
    try {
      const queued = JSON.parse(
        sessionStorage.getItem("rbwr-pending-console-commands") || "[]",
      );
      pendingCommands = Array.isArray(queued)
        ? queued.filter((entry): entry is string => typeof entry === "string")
        : [];
    } catch {
      pendingCommands = [];
    }
    sessionStorage.removeItem("rbwr-pending-console-commands");
    const legacyCommand = sessionStorage.getItem("rbwr-pending-console-command");
    sessionStorage.removeItem("rbwr-pending-console-command");
    if (legacyCommand) pendingCommands.push(legacyCommand);
    pendingCommands.forEach(runConsoleCommand);
  }, []);
  // A supervisor can operate a live unit from another browser or computer.
  // The unit remains the sole physics authority: this only feeds the same
  // command dispatcher used by its own CLI, never edits snapshots directly.
  useEffect(() => {
    if (!plantAssignment || secondaryWindow || stationControlsLocked || !sessionRestored) return;
    let active = true;
    const executeQueuedCommand = (rawCommand: string) => {
      const command = rawCommand.trim();
      const friendlySet = command.match(/^set\s+([^\s]+)\s+(.+)$/i);
      const forwarded = friendlySet ? `${friendlySet[1]} set ${friendlySet[2]}` : command;
      if (/^call\s+(0027|0028|0029|0100|5682|\*#99)$/i.test(command)) {
        const result = `SUPERVISOR LINE CONNECTED — ${command.toUpperCase()}. Department call is ready on this unit.`;
        setEvent(result);
        return result;
      }
      if (/^editor$/i.test(command)) {
        const result = "SUPERVISOR TERMINAL — simulation editor command channel enabled.";
        setEvent(result);
        return result;
      }
      const result = runConsoleCommand(forwarded);
      setEvent(`SUPERVISOR COMMAND EXECUTED — ${forwarded.toUpperCase()}${result ? ` · ${result}` : ""}`);
      return result || "Command accepted.";
    };
    const claim = () => {
      void claimPlantRemoteCommands(plantAssignment).then((commands) => {
        if (!active) return;
        commands.forEach(({ id, command }) => {
          const result = executeQueuedCommand(command);
          void completePlantRemoteCommand(id, result).catch(() => {});
        });
      }).catch(() => {
        // A temporary offline database connection must not interrupt physics.
      });
    };
    claim();
    const interval = window.setInterval(claim, 2_500);
    return () => { active = false; window.clearInterval(interval); };
    // runConsoleCommand captures current simulation state; recreating this
    // polling loop on every physics render would starve its interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantAssignment, secondaryWindow, stationControlsLocked, sessionRestored]);
  const consoleContent = (
    <SimulatorConsolePanel
      temperature={temperature}
      pressure={pressure}
      reactorLevel={reactorLevel}
      hotwellLevel={hotwellLevel}
      deaeratorLevel={deaeratorLevel}
      condenserPressure={condenserVacuum}
      rodsWithdrawn={
        rods.reduce((sum, rod) => sum + (100 - rod.position), 0) / rods.length
      }
      physics={physicsTuning}
      onTemperatureChange={setTemperature}
      onPressureChange={setPressure}
      onReactorLevelChange={setReactorLevel}
      onHotwellLevelChange={setHotwellLevel}
      onDeaeratorLevelChange={setDeaeratorLevel}
      onCondenserPressureChange={setCondenserVacuum}
      onRodsWithdrawnChange={(value) => {
        setRods((previous) =>
          previous.map((rod) => ({ ...rod, position: 100 - value })),
        );
        setEvent(
          `CONSOLE OVERRIDE — all rods set to ${value.toFixed(1)}% withdrawn.`,
        );
      }}
      onPhysicsChange={setPhysicsTuning}
      onScram={() => scram(true)}
      onResetTrips={resetTrips}
      onCommand={runConsoleCommand}
      onEvent={(eventType) => {
        if (eventType === "level-up")
          setReactorLevel((value) => clamp(value + 1, -5, 6));
        if (eventType === "level-down")
          setReactorLevel((value) => clamp(value - 1, -5, 6));
        if (eventType === "pressure-up")
          setPressure((value) => clamp(value + 1000, 101, 12000));
        if (eventType === "pressure-down")
          setPressure((value) => clamp(value - 1000, 101, 12000));
        setEvent(
          `CONSOLE EVENT INJECTED — ${eventType.replace("-", " ").toUpperCase()}.`,
        );
      }}
    />
  );
  const tutorialObjectiveMet = !tutorialEnabled || (
    tutorialLevel === 1 ? startupBusAvailable && safetyBusAvailable :
    tutorialLevel === 2 ? !Object.values(rpsTrips).some(Boolean) :
    tutorialLevel === 3 ? Boolean(rods.find((rod) => rod.id === "C3")) :
    tutorialLevel === 4 ? rods.some((rod) => rod.position < 99.5) :
    tutorialLevel === 5 ? pressure >= 6800 && pressure <= 7400 && condenserVacuum >= 0.04 && condenserVacuum <= 0.07 :
    tutorialLevel === 6 ? actualRPM >= 2800 :
    tutorialLevel === 7 ? mccPumpOn && condenserPumpOn && pump1Online && hotwellOutflowKgS > 100 && daOutflowKgS > 100 :
    tutorialLevel === 8 ? isLocked : true
  );
  const tutorialAllowsPanel = (panel: Panel) => {
    if (!tutorialEnabled) return true;
    const limits: Record<number, Panel[]> = {
      1: ["status", "electrical"],
      2: ["status", "electrical", "rps"],
      3: ["status", "electrical", "rps", "control-rods"],
      4: ["status", "electrical", "rps", "control-rods"],
      5: ["status", "electrical", "rps", "control-rods", "power-grid", "condenser"],
      6: ["status", "electrical", "rps", "control-rods", "power-grid", "condenser"],
      7: ["status", "electrical", "rps", "control-rods", "power-grid", "condenser", "mcc", "water"],
      8: panels,
    };
    return (limits[tutorialLevel] || limits[1]).includes(panel);
  };
  const advanceTutorial = () => {
    if (!tutorialObjectiveMet) return;
    const next = Math.min(TUTORIAL_LEVELS.length, tutorialLevel + 1);
    setTutorialLevel(next);
    setActive(({ 2: "rps", 3: "control-rods", 4: "control-rods", 5: "power-grid", 6: "power-grid", 7: "mcc", 8: "electrical" }[next] || "status") as Panel);
    setEvent(next === TUTORIAL_LEVELS.length ? "TRAINING COMPLETE — all Unit 2 systems are available." : `TRAINING LEVEL ${next} UNLOCKED.`);
  };
  const tabbedShell = (content: ReactNode) => (
    <div className={`rbwr-control-room min-h-screen bg-[#07111d] text-slate-100 transition-[filter] duration-500 ${dcBusAvailable ? "" : "brightness-[.3] saturate-[.45]"}`}>
      {stationControlsLocked && !secondaryWindow && <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/90 p-5 text-center backdrop-blur-sm">
        <div className="max-w-lg rounded-xl border border-amber-400/70 bg-slate-900 p-6 shadow-2xl">
          <p className="text-xs font-black tracking-[.24em] text-amber-300">STATION OCCUPIED</p>
          <h2 className="mt-2 text-2xl font-black">This invite is already active</h2>
          <p className="mt-3 text-sm text-slate-300">Controls are locked to prevent two tabs or operators from commanding the same Unit station. Use a different Supervisor invite, or wait about 15 seconds after the active station closes.</p>
          <Button className="mt-5" variant="outline" onClick={() => navigate("/")}>RETURN TO TERMINAL</Button>
        </div>
      </div>}
      <main className="mx-auto max-w-7xl p-3 sm:p-4 md:p-7">
        <header className="mb-5 flex flex-col gap-3 border-b border-cyan-500/20 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[.3em] text-cyan-400">
              UNIT 2 // {secondaryWindow ? "SECONDARY CONTROL STATION" : "THE BWR SIM"}
            </p>
            <h1 className="text-2xl font-black sm:text-3xl">
              {secondaryWindow ? `${names[active]} — Panel Window` : "Unit 2 Reactor Control Room"}
            </h1>
            {plantAssignment && <p className="mt-1 text-[11px] font-bold tracking-wide text-violet-200">
              {getPlantTransport() === "local" ? "OFFLINE LOCAL PLANT · " : ""}{unitStation.label.toUpperCase()} · EXT {unitStation.extension} · PLANT {plantAssignment.roomCode} · UNIT {plantAssignment.unitNumber} · {unitDemandMW.toFixed(0)} MW UNIT TARGET · {plantOutputMW.toFixed(1)} / {plantDemandMW.toFixed(0)} MW PLANT · {demandManagerOnline ? `DEMAND MANAGER · T−${plantDemandSeconds}s` : "LOCAL DEMAND"}{interlockBusAFeed ? " · BUS A TIE FEED" : ""}
            </p>}
            {plantSyncError && <p className="mt-1 text-[11px] text-amber-300">PLANT LINK: {plantSyncError}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => {
              if (secondaryWindow) {
                const mainUrl = new URL(window.location.href);
                mainUrl.searchParams.delete("window");
                mainUrl.searchParams.delete("panel");
                window.location.assign(mainUrl.toString());
                return;
              }
              const panelUrl = new URL(window.location.href);
              panelUrl.searchParams.set("window", "panel");
              panelUrl.searchParams.set("panel", active);
              const popup = window.open(panelUrl.toString(), `unit2-${active}-station`, "popup=yes,width=1280,height=900,resizable=yes,scrollbars=yes");
              if (!popup) setEvent("PANEL WINDOW BLOCKED — allow pop-ups for Unit 2, then try again.");
            }} className="min-h-11 border-emerald-400/70 text-emerald-200 hover:bg-emerald-950">
              {secondaryWindow ? "MAIN WINDOW" : "OPEN PANEL WINDOW"}
            </Button>
            {!secondaryWindow && <Button variant="outline" onClick={() => {
              const desk = window.open("/status-desk", "unit2-status-desk", "popup=yes,width=1440,height=900,resizable=yes,scrollbars=yes");
              if (!desk) setEvent("STATUS DESK BLOCKED — allow pop-ups for Unit 2, then try again.");
            }} className="min-h-11 border-violet-400/70 text-violet-200 hover:bg-violet-950">STATUS DESK</Button>}
            {secondaryWindow && <Button variant="outline" onClick={() => window.location.reload()} className="min-h-11 border-cyan-400/60 text-cyan-100 hover:bg-cyan-950">REFRESH STATUS</Button>}
            <OperatorManual page={active} />
            <Button
              variant="outline"
              disabled={!busEAvailable}
              data-tooltip-title="Tooltips"
              data-tooltip-description="Shows or hides the immediate control explanations that appear on mouse hover and keyboard focus. This only changes guidance overlays; it does not affect controls or simulation physics."
              onClick={() => {
                const next = !tooltipsEnabled;
                setTooltipsEnabled(next);
                localStorage.setItem("unit2-tooltips-enabled", String(next));
                window.dispatchEvent(new CustomEvent("unit2-tooltip-toggle", { detail: { enabled: next } }));
              }}
              className={`min-h-11 ${tooltipsEnabled ? "border-cyan-300/70 text-cyan-100" : "border-slate-600 text-slate-400"}`}
            >
              TOOLTIPS: {tooltipsEnabled ? "ON" : "OFF"}
            </Button>
            <Button
              variant="outline"
              disabled={!busEAvailable}
              onClick={() => {
                if (tutorialEnabled) {
                  setTutorialEnabled(false);
                  setEvent("ADVANCED MODE ENABLED — tutorial controls released.");
                } else {
                  setTutorialLevel(1);
                  setTutorialEnabled(true);
                  setActive("status");
                  setEvent("TRAINING MODE ENABLED — Level 1: control-room orientation.");
                }
              }}
              className={`min-h-11 ${tutorialEnabled ? "border-cyan-300 bg-cyan-500/15 text-cyan-100" : "border-slate-600 text-slate-300"}`}
            >
              {tutorialEnabled ? `TRAINING: L${tutorialLevel}` : "TRAINING MODE"}
            </Button>
            <Button
              variant="outline"
              disabled={!busEAvailable}
              onClick={() => setConsoleOpen(true)}
              className="min-h-11 border-fuchsia-400/70 text-fuchsia-200 hover:bg-fuchsia-950"
            >
              CLI MODE
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/supervisor")}
              className="min-h-11 border-violet-400/70 text-violet-200 hover:bg-violet-950"
            >
              PLANT SUPERVISOR
            </Button>
            <Button variant="outline" disabled={!busEAvailable} onClick={reset} className="min-h-11">
              {" "}
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </header>
        <AnnunciatorPanel annunciators={annunciators} enabled={busEAvailable} />
        <section className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-500/20 bg-slate-900/70 p-3 text-sm ${!busEAvailable ? "pointer-events-none opacity-50" : ""}`}>
          <span
            data-selectable-status
            className={`rbwr-selectable ${alarms === "All plant systems nominal." ? "text-slate-300" : "text-red-300"}`}
          >
            <BellRing className="mr-2 inline h-4 w-4" />
            {alarms === "All plant systems nominal." ? event : alarms}
          </span>
          <Button
            size="sm"
            disabled={!busEAvailable}
            className="min-h-11 bg-red-700 hover:bg-red-600"
            onClick={() => scram(true)}
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            SCRAM
          </Button>
        </section>
        <nav
          aria-label="Simulator panels"
          className="mb-5 -mx-3 flex snap-x gap-2 overflow-x-auto border-y border-slate-700 bg-slate-900/80 px-3 py-2 sm:mx-0 sm:rounded-xl sm:border"
        >
          {panels.filter((panel) => unitStation.panels.includes(panel)).map((panel) => (
            <Button
              key={panel}
              size="sm"
              variant={active === panel ? "default" : "ghost"}
              disabled={!tutorialAllowsPanel(panel)}
              onClick={() => setActive(panel)}
              className={`min-h-11 shrink-0 snap-start ${active === panel ? "bg-cyan-500 text-slate-950" : "text-slate-300"}`}
            >
              {names[panel]}
            </Button>
          ))}
        </nav>
        <div className={`rounded-xl border border-slate-700 bg-slate-900/75 p-3 sm:rounded-2xl sm:p-4 md:p-6 ${!busEAvailable && active !== "electrical" ? "pointer-events-none opacity-45" : ""} ${stationCanOperate ? "" : "pointer-events-none opacity-45"}`}>
          {content}
        </div>
      </main>
      <SimulatorCliMode
        open={consoleOpen}
        onClose={() => setConsoleOpen(false)}
        onIncomingCall={() => setConsoleOpen(true)}
        onCommand={runConsoleCommand}
        plantAssignment={plantAssignment}
        liveStatus={`CLOCK ${simulationPaused ? "PAUSED" : "RUNNING"}\n\nREACTOR\nAPRM ${aprm.toFixed(2)}% · ${temperature.toFixed(1)} °C\nRPV ${pressure.toFixed(0)} kPa · LEVEL ${reactorLevel.toFixed(2)} m\n\nMCC\nHOTWELL ${hotwellLevel.toFixed(2)} m · DA ${deaeratorLevel.toFixed(2)} m\nCST ${cstLevel.toFixed(2)} m · COND ${Math.round(condenserVacuum * 1000)} mbar\n\nTURBINE\n${actualRPM.toFixed(0)} RPM · ${turbineOutputMW.toFixed(1)} MW\nMAIN ${valveValue.toFixed(1)}% · BYPASS ${bypassValve.toFixed(1)}%\n\nELECTRICAL\nBUS A ${startupBusAvailable ? "ON" : "OFF"} · BUS B ${busBAvailable ? "ON" : "OFF"}\nBUS S ${safetyBusAvailable ? "ON" : "OFF"} · DC ${dcBusAvailable ? "ON" : "OFF"}`}
      />
      {tutorialEnabled && <TutorialCoach progress={{ level: tutorialLevel, objectiveMet: tutorialObjectiveMet, aprmHeld: tutorialAprmHold }} onAdvance={advanceTutorial} onExit={() => { setTutorialEnabled(false); setEvent("ADVANCED MODE ENABLED — tutorial exited."); }} />}
    </div>
  );
  if (active === "status")
    return tabbedShell(
      <PlantOverviewPanel
        temperature={temperature}
        pressure={pressure}
        aprm={aprm}
        rodAprm={rodAprm}
        recirculationAprm={recirculationAprm}
        reactorPeriod={reactorPeriod}
        averageWithdrawal={100 - averageInsertion}
        reactorMode={mode}
        steamFlow={steamFlow}
        turbineRpm={actualRPM}
        turbineOutput={turbineOutputMW}
        turbineSynced={isLocked}
        mainValve={valveValue}
        bypassValve={bypassValve}
        reactorLevel={reactorLevel}
        hotwellLevel={hotwellLevel}
        deaeratorLevel={deaeratorLevel}
        cstLevel={cstLevel}
        condenserPressure={condenserVacuum}
        recircAFlow={recircAFlow}
        recircBFlow={recircBFlow}
        busAAvailable={startupBusAvailable}
        busBAvailable={busBAvailable}
        safetyBusAvailable={safetyBusAvailable}
        busEAvailable={busEAvailable}
        dcBusAvailable={dcBusAvailable}
        rpsTrips={rpsTrips}
        event={event}
        isRunning={isRunning}
        onNavigate={setActive}
        onInstantStartup={instantStartup}
      />,
    );
  if (active === "rps")
    return tabbedShell(
      <RpsPanel
        trips={rpsTrips}
        rolldownProtection={rolldownProtection}
        tripInhibit={rpsTripInhibit}
        turbineReadiness={turbineReadiness}
        simplified={simpleMode}
        onTripInhibitChange={(value) => {
          setRpsTripInhibit(value);
          setEvent(
            value
              ? "RPS TRIP INHIBIT ENABLED — automatic protection bypassed."
              : "RPS TRIP INHIBIT REMOVED — automatic protection armed.",
          );
        }}
        onReset={resetTrips}
      />,
    );
  const mccPanel = (
    <div className="space-y-6">
      <PlantSystemsPanel
        panel="mcc"
        simpleMode={simpleMode}
        condenserVacuum={condenserVacuum}
        condenserPumpOn={condenserPumpOn}
        condenserPumpB={condenserPumpB}
        condenserValve={condenserValve}
        busBAvailable={turbineBusB && isLocked}
        sjaeOn={sjaeOn}
        deaeratorLevel={deaeratorLevel}
        feedwaterDemand={feedwaterFlow}
        feedwaterPumpBFlow={feedwaterPumpBFlow}
        pump1Online={pump1Online}
        pump2Online={pump2Online}
        mccLevel={mccLevel}
        mccPumpOn={mccPumpOn}
        mccAutoOn={mccAutoOn}
        rpsTrips={rpsTrips}
        reactorLevel={reactorLevel}
        hotwellLevel={hotwellLevel}
        condensateFlow={condensateFlow}
        condensatePumpBFlow={condensatePumpBFlow}
        hotwellOutflowKgS={hotwellOutflowKgS}
        daOutflowKgS={daOutflowKgS}
        steamFlow={steamFlow}
        onCondenserPumpChange={setCondenserPumpOn}
        onCondenserPumpBChange={setCondenserPumpB}
        onCondenserValveChange={setCondenserValve}
        onSjaeChange={setSjaeOn}
        onFeedwaterDemandChange={setFeedwaterFlow}
        onFeedwaterPumpBFlowChange={setFeedwaterPumpBFlow}
        onPump1Change={setPump1Online}
        onPump2Change={setPump2Online}
        onCondensateFlowChange={setCondensateFlow}
        onCondensatePumpBFlowChange={setCondensatePumpBFlow}
        onMccPumpChange={setMccPumpOn}
        onMccAutoChange={setMccAutoOn}
        onManualTrip={() => scram(true)}
        onResetTrips={resetTrips}
      />
      <WaterManagementPanel
        cstLevel={cstLevel}
        hotwellLevel={hotwellLevel}
        cstMakeup={cstMakeup}
        cstDrain={cstDrain}
        hotwellMakeup={hotwellMakeup}
        hotwellDrain={hotwellDrain}
        busS={startupBusAvailable}
        daIntakeValve={daIntakeValve}
        daOuttakeValve={daOuttakeValve}
        daTemperature={daTemperature}
        daPressure={daPressure}
        daIntakeDirection={daIntakeDirection}
        daOuttakeDirection={daOuttakeDirection}
        daFastCloseHeld={daFastCloseHeld}
        daAuto={daAuto}
        showDeaeratorControls={false}
        simpleMode={simpleMode}
        onCstMakeup={setCstMakeup}
        onCstDrain={setCstDrain}
        onHotwellMakeup={setHotwellMakeup}
        onHotwellDrain={setHotwellDrain}
        onDaIntakeDirection={setDaIntakeDirection}
        onDaOuttakeDirection={setDaOuttakeDirection}
        onDaFastCloseHeld={setDaFastCloseHeld}
        onDaAutoChange={setDaAuto}
      />
    </div>
  );
  if (active === "control-rods")
    return tabbedShell(
      <ControlRodsPanel
        rods={rods}
        selectedRodId={selectedRodId}
        mode={mode}
        irmRange={irmRange}
        startupCycle={iprCycle}
        aprm={aprm}
        rodAprm={rodAprm}
        srmCount={srmCount}
        direction={rodDirection}
        autoEnabled={autoEnabled}
        autoTarget={autoTarget}
        autoSpeed={autoSpeed}
        autoMode={autoMode}
        autoMessage={autoMessage}
        nextRodId={nextRod?.id}
        selectionScope={selectionScope}
        reactorPeriod={reactorPeriod}
        recirculationAprm={recirculationAprm}
        recircPumpA={recircPumpA}
        recircPumpB={recircPumpB}
        recircSpeedA={recircSpeedA}
        recircSpeedB={recircSpeedB}
        recircAFlow={recircAFlow}
        recircBFlow={recircBFlow}
        onRecircPumpAChange={(value) => {
          setRecircPumpA(value);
          if (value) setRecircSpeedA((speed) => speed || 25);
        }}
        onRecircPumpBChange={(value) => {
          setRecircPumpB(value);
          if (value) setRecircSpeedB((speed) => speed || 25);
        }}
        onRecircSpeedAChange={setRecircSpeedA}
        onRecircSpeedBChange={setRecircSpeedB}
        onSelectRod={setSelectedRodId}
        onModeChange={(next) => {
          if (next === "IPR" && !isCycleComplete(rods, "SRM", 1)) {
            setAutoMessage(
              "SRM BLOCK — complete the 5% SRM cycle before selecting IRM.",
            );
            return;
          }
          if (next === "RUN" && aprm < 5) {
            setAutoMessage(
              "RUN MODE BLOCK — raise reactor power to at least 5% APRM before selecting RUN.",
            );
            return;
          }
          setMode(next);
          if (next === "SD") setAutoEnabled(false);
        }}
        onDirectionChange={setRodDirection}
        onIrmRangeChange={(value) => setIrmRange(clamp(value, 1, 8))}
        onAutoEnabledChange={setAutoEnabled}
        onAutoTargetChange={(value) => setAutoTarget(clamp(value, 0, 105))}
        onAutoSpeedChange={setAutoSpeed}
        onAutoModeChange={setAutoMode}
        onSelectionScopeChange={setSelectionScope}
      />,
    );
  if (active === "safety")
    return tabbedShell(
      <SafetySystemsPanel
        pressure={pressure}
        reactorLevel={reactorLevel}
        busS={safetyBusS}
        isRunning={isRunning && !scramPressed}
        rcicValve={rcicValve}
        rcicFlow={rcicFlow}
        pumpAOn={eccsPumpA}
        pumpBOn={eccsPumpB}
        pumpAMode={eccsPumpAMode}
        pumpBMode={eccsPumpBMode}
        srvOpen={srvOpen}
        adsActive={adsActive}
        onRcicValve={setRcicValve}
        onRcicFlow={setRcicFlow}
        onPumpAOn={setEccsPumpA}
        onPumpBOn={setEccsPumpB}
        onPumpAMode={setEccsPumpAMode}
        onPumpBMode={setEccsPumpBMode}
        onSrvChange={(index, value) =>
          setSrvOpen((previous) =>
            previous.map((open, current) => (current === index ? value : open)),
          )
        }
        onAdsActuate={() => {
          if (adsActive) {
            setAdsActive(false);
            setSrvOpen(Array(6).fill(false));
            setEvent(
              "ADS RESET — automatic depressurization valves closed. It will actuate again if the low-level condition persists.",
            );
            return;
          }
          setAdsActive(true);
          setSrvOpen(Array(6).fill(true));
          scram();
          setEvent(
            "ADS MANUALLY ACTUATED — reactor SCRAMMED; all SRVs open and waiting for RPV pressure below 3500 kPa.",
          );
        }}
      />,
    );
  if (active === "condenser")
    return tabbedShell(
      <PlantSystemsPanel
        panel="condenser"
        condenserVacuum={condenserVacuum}
        condenserPumpOn={condenserPumpOn}
        condenserPumpB={condenserPumpB}
        condenserValve={condenserValve}
        condenserValveDirection={condenserValveDirection}
        condenserCirculationPumpOn={condenserCirculationPumpOn}
        condenserCirculationPumpB={condenserCirculationPumpB}
        condenserAuto={condenserAuto}
        onCondenserCirculationPumpChange={setCondenserCirculationPumpOn}
        onCondenserCirculationPumpBChange={setCondenserCirculationPumpB}
        onCondenserAutoChange={setCondenserAuto}
        busBAvailable={turbineBusB && isLocked}
        sjaeOn={sjaeOn}
        carAOn={carAOn}
        carBOn={carBOn}
        deaeratorLevel={deaeratorLevel}
        feedwaterDemand={feedwaterFlow}
        mccLevel={mccLevel}
        mccPumpOn={mccPumpOn}
        rpsTrips={rpsTrips}
        reactorLevel={reactorLevel}
        hotwellLevel={hotwellLevel}
        condensateFlow={condensateFlow}
        steamFlow={steamFlow}
        onCondenserPumpChange={setCondenserPumpOn}
        onCondenserPumpBChange={setCondenserPumpB}
        onCondenserValveChange={setCondenserValve}
        onCondenserValveDirectionChange={setCondenserValveDirection}
        onSjaeChange={setSjaeOn}
        onCarAChange={setCarAOn}
        onCarBChange={setCarBOn}
        onFeedwaterDemandChange={setFeedwaterFlow}
        onCondensateFlowChange={setCondensateFlow}
        onMccPumpChange={setMccPumpOn}
        onManualTrip={() => scram(true)}
        onResetTrips={resetTrips}
      />,
    );
  if (active === "feedwater-bay")
    return tabbedShell(
      <FeedwaterPumpBayPanel
        auto={feedwaterAuxAuto}
        onAuto={setFeedwaterAuxAuto}
        pumpA={{ name: "FEEDWATER PUMP A", running: pump1Online, flow: feedwaterFlow * 20, cooling: feedwaterMotorCoolingA, preheat: feedwaterOilPreheatA, motorTemperature: feedwaterMotorTemperatureA, oilTemperature: feedwaterOilTemperatureA, onCooling: setFeedwaterMotorCoolingA, onPreheat: setFeedwaterOilPreheatA }}
        pumpB={{ name: "FEEDWATER PUMP B", running: pump2Online, flow: feedwaterPumpBFlow * 20, cooling: feedwaterMotorCoolingB, preheat: feedwaterOilPreheatB, motorTemperature: feedwaterMotorTemperatureB, oilTemperature: feedwaterOilTemperatureB, onCooling: setFeedwaterMotorCoolingB, onPreheat: setFeedwaterOilPreheatB }}
      />,
    );
  if (active === "polishers")
    return tabbedShell(
      <PolisherPanel
        trainA={polisherTrainA}
        trainB={polisherTrainB}
        auto={polisherAuto}
        bypass={polisherBypass}
        target={polisherTarget}
        tanks={polisherTanks}
        selectedTank={polisherTankSelection}
        resinA={100}
        resinB={100}
        onTrainA={setPolisherTrainA}
        onTrainB={setPolisherTrainB}
        onAuto={setPolisherAuto}
        onBypass={setPolisherBypass}
        onTarget={setPolisherTarget}
        onSelectTank={setPolisherTankSelection}
        onWater={() => {
          const targetRunning = polisherTarget === "A" ? polisherTrainA : polisherTrainB;
          if (!polisherBypass || targetRunning) { setEvent("CIX REGENERATION BLOCKED — bypass the target polisher and stop its train first."); return; }
          setPolisherTanks((tanks) => tanks.map((tank) => tank.id === polisherTankSelection && tank.stage === "ready" ? { ...tank, stage: "water", progress: 0, target: polisherTarget } : tank));
          setEvent(`CIX WATER FLUSH STARTED — POLISHER ${polisherTarget}, TANK ${polisherTankSelection}.`);
        }}
        onAir={() => setPolisherTanks((tanks) => tanks.map((tank) => tank.id === polisherTankSelection && tank.stage === "water-done" ? { ...tank, stage: "air", progress: 0 } : tank))}
        onRefill={() => setPolisherTanks((tanks) => tanks.map((tank) => tank.id === polisherTankSelection && tank.stage === "air-done" ? { ...tank, stage: "refill", progress: 0 } : tank))}
        onContinueRegen={() => setPolisherTanks((tanks) => tanks.map((tank) => tank.id === polisherTankSelection && tank.stage === "regen-hold" ? { ...tank, stage: "regenerating", progress: 0 } : tank))}
      />,
    );
  if (active === "turbine-aux")
    return tabbedShell(
      <TurbineAuxPanel
        rpm={actualRPM}
        busS={safetyBusS}
        lubeSource={lubePumpSource}
        hydraulicSource={hydraulicPumpSource}
        coldValve={coldOilValve}
        warmValve={warmOilValve}
        turningGear={turningGear}
        preheatValve={preheatValve}
        steamSealing={steamSealing}
        steamSealingLeak={steamSealingLeak}
        oilTemperature={oilTemperature}
        turbineTemperature={turbineMetalTemperature}
        smokeState={turbineSmoke}
        agentSeconds={agentSeconds}
        onLubeSource={setLubePumpSource}
        onHydraulicSource={setHydraulicPumpSource}
        onColdValve={setColdOilValve}
        onWarmValve={setWarmOilValve}
        onTurningGear={setTurningGear}
        onPreheatValve={setPreheatValve}
        onSteamSealing={setSteamSealing}
        onSteamSealingLeak={setSteamSealingLeak}
        onAgentRelease={() => { setTurbineSmoke("countdown"); setAgentSeconds(10); }}
        onAgentAbort={() => { setTurbineSmoke("aborted"); setEvent("FIRE AGENT RELEASE ABORTED — system may be re-armed."); }}
      />,
    );
  if (active === "power-grid")
    return tabbedShell(
      <div className="space-y-6">
        <PowerGridPanel
          actualRPM={actualRPM}
          targetRPM={targetRPM}
          isSynchronized={isSynchronized}
          gridBreakerClosed={isLocked}
          exciterOn={exciterOn}
          mainSteamInletOpen={mainSteamInletOpen}
          mainValve={valveValue}
          bypassValve={bypassValve}
          mainValveDirection={valveDirection}
          bypassValveDirection={bypassDirection}
          turbineOutputMW={turbineOutputMW}
          turbineSteamFlow={turbineSteamFlow}
          pressure={pressure}
          pressureRate={pressureRate}
          turbinePressureAuto={turbinePressureAuto}
          turbineRpmAuto={turbineRpmAuto}
          // MCR owns steam admission and turbine automation. TCR remains
          // responsible only for the preparation/auxiliary systems.
          mcrControlScope={unitStation.role === "mcr"}
          onMainSteamInletChange={setMainSteamInletOpen}
          onMainValveDirection={setValveDirection}
          onBypassValveDirection={setBypassDirection}
          onTurbinePressureAutoChange={(value) => {
            setTurbinePressureAuto(value);
            if (value) setTurbineRpmAuto(false);
          }}
          onTurbineRpmAutoChange={(value) => {
            setTurbineRpmAuto(value);
            if (value) setTurbinePressureAuto(false);
          }}
          onExciterChange={(value) => {
            setExciterOn(value);
            if (!value) setIsLocked(false);
          }}
          onGridBreaker={() => {
            if (isLocked) {
              setIsLocked(false);
              return;
            }
            if (!turbineReady) {
              setEvent(
                "SYNCHRONIZATION BLOCKED — turbine run-up checklist is not clear.",
              );
              return;
            }
            if (exciterOn && isSynchronized) setIsLocked(true);
          }}
        />
      </div>,
    );
  if (active === "edg")
    return tabbedShell(
      <EdgBayPanel
        busE={busEAvailable}
        selected={edgSelected}
        onSelected={(value) => { if (edgRpm < 1) setEdgSelected(value); else setEvent("EDG SELECTION BLOCKED — stop the running EDG before transferring selection."); }}
        auto={edgAuto}
        onAuto={setEdgAuto}
        ignition={edgIgnitionBreaker}
        onIgnition={setEdgIgnitionBreaker}
        output={edgOutputBreaker}
        onOutput={setEdgOutputBreaker}
        mainBreaker={edgBreaker}
        onMainBreaker={(value) => {
          setEdgBreaker(value);
          if (value) { setSafetyBusS(false); setEvent("EDG MAIN BREAKER CLOSED — BUS A → BUS S FEED OPENED."); }
        }}
        startRequested={edgStartRequested}
        onStart={() => { if (edgReady) { setEdgStartRequested(true); setEvent("EDG LOCAL START — 15 SECOND RUNUP INITIATED."); } }}
        onTrip={() => {
          setEdgStartRequested(false);
          setEdgOutputBreaker(false);
          setEdgBreaker(false);
          setEvent(`EDG ${edgSelected === "u2a" ? "2A" : "2B"} TRIPPED — OUTPUT AND BUS S BREAKERS OPEN.`);
        }}
        rpm={edgRpm}
        tank={edgTankLevel}
        fuelA={edgFuelA}
        fuelB={edgFuelB}
        mainFuelValve={edgMainFuelValve}
        onMainFuelValve={setEdgMainFuelValve}
        mainFuelPump={edgMainFuelPump}
        onMainFuelPump={setEdgMainFuelPump}
        fuelValveA={edgFuelValveA}
        onFuelValveA={setEdgFuelValveA}
        fuelValveB={edgFuelValveB}
        onFuelValveB={setEdgFuelValveB}
        refuellingSeconds={edgRefuellingSeconds}
      />,
    );
  if (active === "deaerator")
    return tabbedShell(
      <DeaeratorHallPanel
        pressure={daPressure}
        temperature={daTemperature}
        intake={daIntakeValve}
        outtake={daOuttakeValve}
        intakeFlow={daIntakeAirFlow}
        outtakeFlow={daOuttakeAirFlow}
        intakeDirection={daIntakeDirection}
        outtakeDirection={daOuttakeDirection}
        auto={daAuto}
        fastCloseHeld={daFastCloseHeld}
        bypassOpen={daBypassValve}
        mainAirValveOpen={daMainAirValve}
        disk={daRuptureDisk}
        onIntakeDirection={setDaIntakeDirection}
        onOuttakeDirection={setDaOuttakeDirection}
        onAuto={setDaAuto}
        onFastClose={setDaFastCloseHeld}
        onBypass={(value) => {
          if (!value && (!daMainAirValve || daRuptureDisk !== "intact")) { setEvent("DA BYPASS CLOSE BLOCKED — restore main air path and a sound rupture disk first."); return; }
          setDaBypassValve(value);
        }}
        onMainAirValve={(value) => {
          if (!value && !daBypassValve) { setEvent("DA MAIN AIR VALVE CLOSE BLOCKED — open the bypass valve first."); return; }
          if (value && daRuptureDisk === "replaced") setDaRuptureDisk("intact");
          setDaMainAirValve(value);
        }}
        onRemoveDisk={() => { setDaRuptureDisk("removed"); setEvent("DA RUPTURE DISK REMOVED — install a replacement before restoring the main air valve."); }}
        onInstallDisk={() => { setDaRuptureDisk("replaced"); setEvent("DA RUPTURE DISK INSTALLED — restore the main air valve, then close the bypass."); }}
        onRestore={() => { setDaMainAirValve(true); setDaRuptureDisk("intact"); setEvent("DA MAIN AIR PATH RESTORED — bypass may now be closed."); }}
      />,
    );
  if (active === "electrical")
    return tabbedShell(
      <ElectricalPanel
        startupBusA={startupBusA}
        busATransformer={busATransformer}
        busAAvailable={startupBusAvailable}
        safetyBusAvailable={safetyBusAvailable}
        turbineBusB={turbineBusB}
        safetyBusS={safetyBusS}
        edgBreaker={edgBreaker}
        acDcInterlock={acDcInterlock}
        safetyToDcBreaker={safetyToDcBreaker}
        busEToDcBreaker={busEToDcBreaker}
        busEAvailable={busEAvailable}
        dcBusAvailable={dcBusAvailable}
        mainBatteryCharge={mainBatteryCharge}
        batteryCharging={safetyBusAvailable}
        unitInterlockStatus={unitInterlockStatus}
        unitInterlockActive={unitInterlockStatus === "SUPPLYING" || unitInterlockStatus === "FEEDING BUS A"}
        unitInterlockBreaker={Boolean(sharedPlant.room?.interlock_breaker_closed)}
        onUnitInterlockBreakerChange={(value) => {
          if (!plantAssignment) { setEvent("UNIT INTERLOCK BREAKER REQUIRES A SHARED PLANT ROOM."); return; }
          if (value && interlockTargetConfigured && busATransformer) {
            setBusATransformer(false);
            setEvent("UNIT INTERLOCK CLOSED — target Bus A transformer opened for phase separation.");
          }
          setSharedPlant((current) => ({
            ...current,
            room: current.room ? { ...current.room, interlock_breaker_closed: value } : current.room,
          }));
          void updatePlantDispatch(plantAssignment.roomCode, { interlock_breaker_closed: value }).catch((error) => {
            setPlantSyncError(error instanceof Error ? error.message : "Unable to change Unit Interlock breaker.");
            void getPlantSnapshot(plantAssignment.roomCode).then(setSharedPlant).catch(() => {});
          });
        }}
        rolldownProtection={rolldownProtection}
        turbineOnline={isLocked}
        turbineBusEligible={turbineBusEligible}
        sharedTurbineCapacityActive={sharedTurbineCapacityActive}
        sharedTurbineLoad={sharedTurbineLoad}
        startupLoad={startupLoad}
        busBLoad={busBLoad}
        safetyLoad={safetyLoad}
        startupMachines={startupMachines}
        busBMachines={busBMachines}
        safetyMachines={safetyMachines}
        onStartupBusAChange={(value) => {
          if (value && interlockTargeted) {
            setSharedPlant((current) => ({
              ...current,
              room: current.room ? { ...current.room, interlock_breaker_closed: false } : current.room,
            }));
            if (plantAssignment) {
              void updatePlantDispatch(plantAssignment.roomCode, { interlock_breaker_closed: false }).catch((error) => {
                setPlantSyncError(error instanceof Error ? error.message : "Unable to open Unit Interlock breaker.");
              });
            }
            setEvent("UNIT INTERLOCK OPEN — target Bus A breaker closed; phase separation required.");
          }
          setStartupBusA(value);
          if (value) setBusATransformer(false);
        }}
        onBusATransformerChange={(value) => {
          if (value && interlockTargeted) {
            setSharedPlant((current) => ({
              ...current,
              room: current.room ? { ...current.room, interlock_breaker_closed: false } : current.room,
            }));
            if (plantAssignment) {
              void updatePlantDispatch(plantAssignment.roomCode, { interlock_breaker_closed: false }).catch((error) => {
                setPlantSyncError(error instanceof Error ? error.message : "Unable to open Unit Interlock breaker.");
              });
            }
            setEvent("UNIT INTERLOCK OPEN — target Bus A transformer closed; phase separation required.");
          }
          setBusATransformer(value);
          if (value) setStartupBusA(false);
        }}
        onTurbineBusBChange={setTurbineBusB}
        onSafetyBusSChange={(value) => { setSafetyBusS(value); if (value) setEdgBreaker(false); }}
        onEdgBreakerChange={(value) => { setEdgBreaker(value); if (value) setSafetyBusS(false); }}
        onAcDcInterlockChange={setAcDcInterlock}
        onSafetyToDcBreakerChange={(value) => { setSafetyToDcBreaker(value); if (value) setBusEToDcBreaker(false); }}
        onBusEToDcBreakerChange={(value) => { setBusEToDcBreaker(value); if (value) setSafetyToDcBreaker(false); }}
        onRolldownProtectionChange={(value) => {
          setRolldownProtection(value);
          setEvent(
            value
              ? "ROLLDOWN PROTECTION ENABLED."
              : "ROLLDOWN PROTECTION BYPASSED — RPS turbine trip disabled.",
          );
        }}
        edgReady={edgReady}
        edgRunning={edgRpm >= 1790}
        onRemoteEdgStart={() => {
          if (!edgReady) { setEvent("EDG REMOTE START BLOCKED — ignition breaker, Bus E, and fuel are required."); return; }
          setEdgStartRequested(true);
          setEvent("EDG REMOTE STARTUP — selected Unit 2 EDG running up to 1800 RPM.");
        }}
      />,
    );
  if (active === "systems")
    return tabbedShell(
      <SystemsPanel
        malfunctions={malfunctions}
        recircAFlow={recircAFlow}
        recircBFlow={recircBFlow}
        gridDemandMW={unitDemandMW}
        nextGridDemandMW={nextPlantDemandMW}
        secondsToDemandChange={plantDemandSeconds}
        netProductionMW={netProductionMW}
        onDemand={onGridDemand}
        operatorName={operatorName}
        operatorPoints={operatorPoints}
        operatorRank={operatorRank}
        leaderboardSize={sortedOperators.length}
        scoreRate={scoreRate}
        automationPenaltyCount={automationPenaltyCount}
        automationPenaltySystems={automationPenaltySystems}
        randomEventsEnabled={randomEventsEnabled}
        pendingGridEvent={pendingGridEvent}
        onRandomEventsChange={(enabled) => {
          setRandomEventsEnabled(enabled);
          setEvent(enabled ? "RANDOM GRID EVENTS ENABLED — each demand cycle may schedule a low-probability event." : "RANDOM GRID EVENTS DISABLED.");
        }}
        onChange={setMalfunctions}
        calculateAprmForMw={calculateAprmForMw}
        mainValve={valveValue}
        bypassValve={bypassValve}
        condenserMbar={condenserVacuum * 1000}
        condenserEfficiency={condenserEfficiency}
        pressure={pressure}
      />,
    );
  if (active === "mcc") return tabbedShell(mccPanel);
  if (active === "mcc")
    return tabbedShell(
      <div className="space-y-6">
        <PlantSystemsPanel
          panel="mcc"
          condenserVacuum={condenserVacuum}
          condenserPumpOn={condenserPumpOn}
          condenserPumpB={condenserPumpB}
          condenserValve={condenserValve}
          busBAvailable={turbineBusB && isLocked}
          sjaeOn={sjaeOn}
          deaeratorLevel={deaeratorLevel}
          feedwaterDemand={feedwaterFlow}
          mccLevel={mccLevel}
          mccPumpOn={mccPumpOn}
          rpsTrips={rpsTrips}
          reactorLevel={reactorLevel}
          hotwellLevel={hotwellLevel}
          condensateFlow={condensateFlow}
          steamFlow={steamFlow}
          onCondenserPumpChange={setCondenserPumpOn}
          onCondenserPumpBChange={setCondenserPumpB}
          onCondenserValveChange={setCondenserValve}
          onSjaeChange={setSjaeOn}
          onFeedwaterDemandChange={setFeedwaterFlow}
          onCondensateFlowChange={setCondensateFlow}
          onMccPumpChange={setMccPumpOn}
          onManualTrip={() => scram(true)}
          onResetTrips={resetTrips}
        />
        <WaterManagementPanel
          cstLevel={cstLevel}
          hotwellLevel={hotwellLevel}
          cstMakeup={cstMakeup}
          cstDrain={cstDrain}
          hotwellMakeup={hotwellMakeup}
          hotwellDrain={hotwellDrain}
          busS={safetyBusS}
          onCstMakeup={setCstMakeup}
          onCstDrain={setCstDrain}
          onHotwellMakeup={setHotwellMakeup}
          onHotwellDrain={setHotwellDrain}
        />
      </div>,
    );
  /* Legacy fallback routes below are superseded by the tabbed routes above.
  if (active === "power-coolant") return <div className="min-h-screen bg-[#07111d] p-4 text-slate-100"><main className="mx-auto max-w-7xl py-4"><div className="mb-5 flex justify-between"><h1 className="text-3xl font-black">CRD Cooling / DA Feedwater</h1><Button variant="outline" onClick={() => setActive("status")}>RETURN TO OVERVIEW</Button></div><PowerCoolantPanel pump1Online={pump1Online} pump2Online={pump2Online} busBAvailable={turbineBusB && isLocked} daIntakeOpen={daIntakeOpen} daOutputOpen={daOutputOpen} onPump1Change={setPump1Online} onPump2Change={setPump2Online} onDaIntakeChange={setDaIntakeOpen} onDaOutputChange={setDaOutputOpen}/></main></div>;
  if (active === "rps") return <div className="min-h-screen bg-[#07111d] p-4 text-slate-100"><main className="mx-auto max-w-7xl py-4"><div className="mb-5 flex justify-between"><h1 className="text-3xl font-black">Reactor Protection System</h1><Button variant="outline" onClick={() => setActive("status")}>RETURN TO OVERVIEW</Button></div><RpsPanel trips={rpsTrips} rolldownProtection={rolldownProtection}/></main></div>;
  if (active === "water") return <div className="min-h-screen bg-[#07111d] p-4 text-slate-100"><main className="mx-auto max-w-7xl py-4"><div className="mb-5 flex justify-between"><h1 className="text-3xl font-black">Water Management</h1><Button variant="outline" onClick={() => setActive("status")}>RETURN TO OVERVIEW</Button></div><WaterManagementPanel cstLevel={cstLevel} hotwellLevel={hotwellLevel} cstMakeup={cstMakeup} cstDrain={cstDrain} hotwellMakeup={hotwellMakeup} hotwellDrain={hotwellDrain} busS={safetyBusS} onCstMakeup={setCstMakeup} onCstDrain={setCstDrain} onHotwellMakeup={setHotwellMakeup} onHotwellDrain={setHotwellDrain}/></main></div>;
  if (active === "safety") return <div className="min-h-screen bg-[#07111d] p-4 text-slate-100"><main className="mx-auto max-w-7xl py-4"><div className="mb-5 flex justify-between"><h1 className="text-3xl font-black">RCIC / LPCI Safety Systems</h1><Button variant="outline" onClick={() => setActive("status")}>RETURN TO OVERVIEW</Button></div><SafetySystemsPanel pressure={pressure} reactorLevel={reactorLevel} busS={safetyBusS} rcicValve={rcicValve} rcicPump={rcicPump} lpciPump={lpciPump} onRcicValve={setRcicValve} onRcicPump={setRcicPump} onLpciPump={setLpciPump}/></main></div>;
  if (active === "power-grid") return <div className="min-h-screen bg-[#07111d] p-4 text-slate-100"><main className="mx-auto max-w-7xl py-4"><div className="mb-5 flex items-center justify-between"><h1 className="text-3xl font-black">Turbine and Grid Control</h1><Button variant="outline" onClick={() => setActive("status")}>RETURN TO OVERVIEW</Button></div><PowerGridPanel actualRPM={actualRPM} targetRPM={targetRPM} isSynchronized={isSynchronized} gridBreakerClosed={isLocked} exciterOn={exciterOn} mainSteamInletOpen={mainSteamInletOpen} mainValve={valveValue} bypassValve={bypassValve} mainValveDirection={valveDirection} bypassValveDirection={bypassDirection} reliefOpen={reliefOpen} reliefValveB={reliefValveB} turbineOutputMW={turbineOutputMW} pressure={pressure} pressureRate={pressureRate} onMainSteamInletChange={setMainSteamInletOpen} onMainValveDirection={setValveDirection} onBypassValveDirection={setBypassDirection} onReliefChange={setReliefOpen} onReliefValveBChange={setReliefValveB} onExciterChange={value => { setExciterOn(value); if (!value) setIsLocked(false); }} onGridBreaker={() => { if (isLocked) setIsLocked(false); else if (exciterOn && isSynchronized) setIsLocked(true); }}/></main></div>;
  if (active === "electrical") return <div className="min-h-screen bg-[#07111d] p-4 text-slate-100"><main className="mx-auto max-w-7xl py-4"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold tracking-[.3em] text-cyan-400">RBWR // UNIT 02</p><h1 className="text-3xl font-black">Electrical Distribution</h1></div><Button variant="outline" onClick={() => setActive("status")}>RETURN TO OVERVIEW</Button></div><ElectricalPanel startupBusA={startupBusA} turbineBusB={turbineBusB} safetyBusS={safetyBusS} rolldownProtection={rolldownProtection} turbineOnline={isLocked} startupLoad={startupLoad} busBLoad={busBLoad} safetyLoad={safetyLoad} onStartupBusAChange={setStartupBusA} onTurbineBusBChange={setTurbineBusB} onSafetyBusSChange={setSafetyBusS} onRolldownProtectionChange={value => { setRolldownProtection(value); setEvent(value ? "ROLLDOWN PROTECTION ENABLED." : "ROLLDOWN PROTECTION BYPASSED — RPS turbine trip disabled."); }}/></main></div>;
  return <div className="min-h-screen bg-[#07111d] text-slate-100"><main className="mx-auto max-w-7xl p-4 md:p-7"><header className="mb-5 flex flex-col justify-between gap-4 border-b border-cyan-500/20 pb-5 md:flex-row md:items-end"><div><p className="text-xs font-bold tracking-[.3em] text-cyan-400">RBWR // UNIT 02 SIMULATOR</p><h1 className="text-3xl font-black">Boiling Water Reactor Control Room</h1></div><div className="flex gap-2"><Badge className={Object.values(rpsTrips).some(Boolean) ? "bg-red-700" : "bg-emerald-700"}>{Object.values(rpsTrips).some(Boolean) ? "ALARM" : "NOMINAL"}</Badge><Button variant="outline" onClick={reset}><RotateCcw className="mr-2 h-4 w-4"/>Reset</Button></div></header><section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-500/20 bg-slate-900/70 p-3 text-sm"><span className={alarms === "All plant systems nominal." ? "text-slate-300" : "text-red-300"}><BellRing className="mr-2 inline h-4 w-4"/>{alarms === "All plant systems nominal." ? event : alarms}</span><Button size="sm" className="bg-red-700 hover:bg-red-600" onClick={() => scram(true)}><ShieldAlert className="mr-2 h-4 w-4"/>SCRAM</Button></section><nav className="mb-5 flex gap-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/80 p-2">{panels.map(panel => <Button key={panel} size="sm" variant={active === panel ? "default" : "ghost"} onClick={() => setActive(panel)} className={active === panel ? "bg-cyan-500 text-slate-950" : "text-slate-300"}>{names[panel]}</Button>)}</nav><div className="rounded-2xl border border-slate-700 bg-slate-900/75 p-4 md:p-6">{active === "status" && <ReactorStatusPanel temperature={temperature} pressure={pressure} fuelLevel={fuelLevel} turbineOutputMW={turbineOutputMW} valveValue={valveValue} isRunning={isRunning} getStatusColor={() => Object.values(rpsTrips).some(Boolean) ? "destructive" : "default"} getStatusText={() => Object.values(rpsTrips).some(Boolean) ? "ALARM" : isRunning ? "OPERATIONAL" : "STANDBY"}/>} {active === "control-rods" && <ControlRodsPanel rods={rods} selectedRodId={selectedRodId} mode={mode} iprCycle={iprCycle} aprm={aprm} srmCount={srmCount} direction={rodDirection} autoEnabled={autoEnabled} autoTarget={autoTarget} autoSpeed={autoSpeed} autoMessage={autoMessage} nextRodId={nextRod?.id} selectionScope={selectionScope} reactorPeriod={reactorPeriod} onSelectRod={setSelectedRodId} onModeChange={next => { if (next === "IPR" && !isCycleComplete(rods, "SRM", 1)) { setAutoMessage("SRM BLOCK — complete the 5% SRM cycle before selecting IPR."); return; } setMode(next); if (next === "SD") setAutoEnabled(false); }} onDirectionChange={setRodDirection} onAdvanceCycle={() => { if (isCycleComplete(rods, mode, iprCycle)) { setIprCycle(value => Math.min(3, value + 1)); setEvent("IPR cycle advanced."); } else setAutoMessage("GROUP BLOCK — complete the current withdrawal cycle first."); }} onAutoEnabledChange={setAutoEnabled} onAutoTargetChange={value => setAutoTarget(clamp(value, 0, 100))} onAutoSpeedChange={setAutoSpeed} onSelectionScopeChange={setSelectionScope}/>} {active === "startup-shutdown" && <StartupShutdownPanel isRunning={isRunning} temperature={temperature} scramPressed={scramPressed} onStartReactor={start} onStopReactor={() => setIsRunning(false)} onEmergencyShutdown={() => scram(true)}/>} {active === "power-coolant" && <PowerCoolantPanel pump1Online={pump1Online} pump2Online={pump2Online} coolantPumpOn={coolantPumpOn} coolantFlow={coolantFlow} pressure={pressure} onPump1Change={setPump1Online} onPump2Change={setPump2Online} onCoolantPumpChange={setCoolantPumpOn} onCoolantFlowChange={setCoolantFlow}/>} {active === "power-grid" && <PowerGridPanel actualRPM={actualRPM} targetRPM={targetRPM} isSynchronized={isSynchronized} isLocked={isLocked} valveValue={valveValue} valveDirection={valveDirection} turbineOutputMW={turbineOutputMW} turbineSpeed={turbineSpeed} onValvePress={setValveDirection} onPausePress={() => setValveDirection(0)} onSyncPress={() => setIsLocked(value => !value)}/>} {["mcc", "feedwater", "condenser", "rps"].includes(active) && <PlantSystemsPanel panel={active as ProcessPanel} condenserVacuum={condenserVacuum} condenserPumpOn={condenserPumpOn} sjaeOn={sjaeOn} deaeratorLevel={deaeratorLevel} feedwaterDemand={feedwaterFlow} mccLevel={mccLevel} mccPumpOn={mccPumpOn} rpsTrips={rpsTrips} reactorLevel={reactorLevel} hotwellLevel={hotwellLevel} condensateFlow={condensateFlow} steamFlow={steamFlow} onCondenserPumpChange={setCondenserPumpOn} onSjaeChange={setSjaeOn} onFeedwaterDemandChange={setFeedwaterFlow} onCondensateFlowChange={setCondensateFlow} onMccPumpChange={setMccPumpOn} onManualTrip={() => scram(true)} onResetTrips={resetTrips}/>}</div><div className="mt-5 text-xs text-slate-500"><Activity className="mr-1 inline h-3 w-3 text-emerald-400"/>4 Hz physics clock · U2 temporary rod program</div></main></div>;
  */
}
