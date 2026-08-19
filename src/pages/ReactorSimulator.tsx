// Legacy duplicate renderer below is being phased out; active tab routes above are type-checked independently.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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
import { OperatorManual } from "@/components/OperatorManual";
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
import { getU2ThermalOutput } from "@/lib/thermalOutput";
import { addLeaderboardPoints, ensureLeaderboardPlayer, getLeaderboard } from "@/lib/leaderboard";

type Panel =
  | "status"
  | "control-rods"
  | "startup-shutdown"
  | "power-grid"
  | "electrical"
  | "systems"
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
};
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const STORAGE = "rbwr-u2-sim-v4";
// Demand follows the intended unit operating envelope: low-load dispatch at
// roughly 300 and a full-power call near 1,200 on the generator display.
const newGridDemand = () => Math.round(300 + Math.random() * 900);
const newDemandInterval = () => Math.round(360 + Math.random() * 280);

export default function ReactorSimulator() {
  const navigate = useNavigate();
  const [active, setActive] = useState<Panel>("status");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [simulationPaused, setSimulationPaused] = useState(false);
  const simulationPausedRef = useRef(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [simpleMode, setSimpleMode] = useState(
    () => localStorage.getItem("unit2-simple-mode") === "true",
  );
  useEffect(() => {
    document.body.dataset.rbwrPanel = active;
    return () => {
      delete document.body.dataset.rbwrPanel;
    };
  }, [active]);
  useEffect(() => {
    simulationPausedRef.current = simulationPaused;
  }, [simulationPaused]);
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
  const [automationCooldowns, setAutomationCooldowns] = useState({ aprm: 0, mcc: 0 });
  const [operatorName] = useState(() => localStorage.getItem("unit2-operator-name") || "");
  const [leaderboard, setLeaderboard] = useState<Record<string, { points: number; lastSeen: number }>>(() => {
    try { return JSON.parse(localStorage.getItem("unit2-operator-scores") || "{}"); } catch { return {}; }
  });
  const [daFastCloseHeld, setDaFastCloseHeld] = useState(false);
  const [rods, setRods] = useState<ControlRod[]>(createInitialRods);
  const [selectedRodId, setSelectedRodId] = useState("A1");
  const [mode, setMode] = useState<ReactorMode>("SD");
  const [iprCycle, setIprCycle] = useState(1);
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
  const rodBlockTimer = useRef<number | null>(null);
  const rpmAutoSteamReadyRef = useRef(false);
  const rpmAutoInPhaseSinceRef = useRef<number | null>(null);
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
  const rodAprm = useMemo(() => getAprm(rods), [rods]);
  // Electrical availability is deliberately derived before process flow. A
  // commanded pump remains shown as requested, but it cannot move water or
  // add load until its supplying bus is energized.
  // The turbine can supply its auxiliaries either synchronized to the grid or
  // islanded inside the ±50 RPM sync window. A closed transformer breaker by
  // itself is never a source of power.
  const turbineBusEligible =
    isLocked || Math.abs(turbineSpeed * 45 - 3000) <= 50;
  const startupBusAvailable =
    startupBusA || (busATransformer && turbineBusEligible);
  const busBAvailable = turbineBusB && turbineBusEligible;
  // With both turbine-fed auxiliaries closed, Bus A and Bus B are supplied
  // from one generator auxiliary pool instead of two isolated 60 kW limits.
  // A single bus may use nearly all of it; only their combined demand trips.
  const sharedTurbineCapacityActive =
    busATransformer && !startupBusA && turbineBusB && turbineBusEligible;
  // EDG routing is intentionally not modeled yet. Safety Bus S therefore has
  // one valid source: the energized Bus A feed.
  const safetyBusAvailable = safetyBusS && startupBusAvailable;
  const mainBatteryAvailable = mainBatteryCharge > 0.5;
  // Bus E is fed by the charged battery, or directly from Bus S through the
  // AC/DC interlock. An open interlock is not itself a source of Bus E power.
  const busEAvailable =
    mainBatteryAvailable || (acDcInterlock && safetyBusAvailable);
  const dcBusAvailable =
    (safetyToDcBreaker && safetyBusAvailable) ||
    (busEToDcBreaker && busEAvailable);
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
  // The two 2,000 kg/s recirculation pumps supply 50 APRM points at full
  // flow. Combined output remains bounded by the 115% APRM protection cap.
  const recirculationTargetAprm = (recircAFlow + recircBFlow) * 0.0125;
  const aprm = clamp(rodAprm + recirculationAprm, 0, 115);
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
  const srmCount = 10 + aprm * 50000;
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
  const turbineSteamFlow =
    isRunning && mainSteamInletOpen
      ? thermalOutput.steamKgS * steamPathCapacity * (valveValue / 100) * steamPressureFactor
      : 0;
  const bypassSteamFlow = isRunning
    ? thermalOutput.steamKgS * steamPathCapacity * (bypassValve / 100) * steamPressureFactor
    : 0;
  const steamFlow = turbineSteamFlow + bypassSteamFlow;
  const condenserEfficiency = clamp((0.28 - condenserVacuum) / 0.23, 0, 1);
  // Turbine work follows admitted steam mass flow. Pressure raises flow through
  // the valve; it is not an independent valve-position multiplier.
  const turbineSteamQuality = clamp(pressure / 7100, 0.35, 1.12);
  const turbineOutputMW =
    isRunning && isLocked && exciterOn && turbineSteamFlow > 1
      ? turbineSteamFlow * 0.93 * turbineSteamQuality * condenserEfficiency
      : 0;
  const hotwellOutflowKgS =
    (condenserPumpOn && startupBusAvailable ? condensateFlow * 20 : 0) +
    (condenserPumpB && busBAvailable ? condensatePumpBFlow * 20 : 0);
  const daOutflowKgS =
    (pump1Online && startupBusAvailable ? feedwaterFlow * 10 : 0) +
    (pump2Online && busBAvailable ? feedwaterPumpBFlow * 10 : 0);
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
      active: rodBlockAlarm === "SRM",
      priority: "amber",
      tone: "double",
      pan: "center",
      page: "control-rods",
      sample: "/sounds/block-buzzer.mp3",
    },
    {
      id: "ipr-block",
      label: "IPR BLOCK",
      active: rodBlockAlarm === "IPR",
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
      label: "LOW IPR",
      active: mode === "IPR" && iprCycle === 1,
      priority: "blue",
      tone: "low",
      pan: "center",
      page: "control-rods",
    },
    {
      id: "high-ipr",
      label: "HIGH IPR",
      active: mode === "IPR" && iprCycle === 3,
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
      active: recircPumpA && recircSpeedA > 30 && rodAprm < 20,
      priority: "amber",
      tone: "low",
      pan: "left",
      page: "control-rods",
    },
    {
      id: "recirc-b-cavitation",
      label: "RECIRC B CAVITATION",
      active: recircPumpB && recircSpeedB > 30 && rodAprm < 20,
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
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
      if (saved?.rods?.length === 36) {
        setRods(saved.rods);
        setSelectedRodId(saved.selectedRodId || "A1");
        setMode(saved.mode || "SD");
        setIprCycle(saved.iprCycle || 1);
        setAutoTarget(saved.autoTarget || 1);
        setAutoSpeed(saved.autoSpeed || "medium");
        setReactorLevel(saved.reactorLevel || 0);
        setHotwellLevel(saved.hotwellLevel || 0);
        setDeaeratorLevel(saved.deaeratorLevel || 0);
      }
    } catch {
      localStorage.removeItem(STORAGE);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(
      STORAGE,
      JSON.stringify({
        rods,
        selectedRodId,
        mode,
        iprCycle,
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
    autoTarget,
    autoSpeed,
    reactorLevel,
    hotwellLevel,
    deaeratorLevel,
  ]);
  useEffect(() => {
    if (transferStateLoaded.current) return;
    transferStateLoaded.current = true;
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("rbwr-live-plant-state") ||
          localStorage.getItem("rbwr-live-plant-state") ||
          "null",
      );
      if (!saved) { setSessionRestored(true); return; }
      if (saved.rods?.length === 36) setRods(saved.rods);
      if (typeof saved.temperature === "number")
        setTemperature(saved.temperature);
      if (typeof saved.pressure === "number") setPressure(saved.pressure);
      if (typeof saved.reactorLevel === "number")
        setReactorLevel(saved.reactorLevel);
      if (typeof saved.hotwellLevel === "number")
        setHotwellLevel(saved.hotwellLevel);
      if (typeof saved.deaeratorLevel === "number")
        setDeaeratorLevel(saved.deaeratorLevel);
      if (typeof saved.condenserVacuum === "number")
        setCondenserVacuum(saved.condenserVacuum);
      if (typeof saved.mode === "string") setMode(saved.mode);
      if (typeof saved.iprCycle === "number") setIprCycle(saved.iprCycle);
      if (typeof saved.isRunning === "boolean") setIsRunning(saved.isRunning);
      if (typeof saved.bypassValve === "number")
        setBypassValve(saved.bypassValve);
      if (typeof saved.valveValue === "number") setValveValue(saved.valveValue);
      if (saved.physicsTuning && typeof saved.physicsTuning === "object") setPhysicsTuning(current => ({ ...current, ...saved.physicsTuning }));
      const controls = saved.controls || {};
      const apply = (key: string, setter: (value: any) => void) => { if (typeof controls[key] !== "undefined") setter(controls[key]); };
      apply("mainSteamInletOpen", setMainSteamInletOpen); apply("reliefOpen", setReliefOpen); apply("reliefValveB", setReliefValveB); apply("exciterOn", setExciterOn); apply("isLocked", setIsLocked); apply("turbinePressureAuto", setTurbinePressureAuto); apply("turbineRpmAuto", setTurbineRpmAuto);
      apply("pump1Online", setPump1Online); apply("pump2Online", setPump2Online); apply("daIntakeOpen", setDaIntakeOpen); apply("daOutputOpen", setDaOutputOpen); apply("daIntakeValve", setDaIntakeValve); apply("daOuttakeValve", setDaOuttakeValve); apply("daIntakeDirection", setDaIntakeDirection); apply("daOuttakeDirection", setDaOuttakeDirection); apply("daAuto", setDaAuto);
      apply("recircPumpA", setRecircPumpA); apply("recircPumpB", setRecircPumpB); apply("recircSpeedA", setRecircSpeedA); apply("recircSpeedB", setRecircSpeedB); apply("selectedRodId", setSelectedRodId); apply("rodDirection", setRodDirection); apply("selectionScope", setSelectionScope); apply("autoEnabled", setAutoEnabled); apply("autoTarget", setAutoTarget); apply("autoSpeed", setAutoSpeed); apply("autoMode", setAutoMode);
      apply("malfunctions", setMalfunctions);
      apply("condensateFlow", setCondensateFlow); apply("condensatePumpBFlow", setCondensatePumpBFlow); apply("feedwaterFlow", setFeedwaterFlow); apply("feedwaterPumpBFlow", setFeedwaterPumpBFlow); apply("condenserPumpOn", setCondenserPumpOn); apply("condenserPumpB", setCondenserPumpB); apply("condenserValve", setCondenserValve); apply("condenserValveDirection", setCondenserValveDirection); apply("condenserAuto", setCondenserAuto); apply("carAOn", setCarAOn); apply("carBOn", setCarBOn); apply("sjaeOn", setSjaeOn); apply("mccPumpOn", setMccPumpOn); apply("mccAutoOn", setMccAutoOn); apply("condenserCirculationPumpOn", setCondenserCirculationPumpOn);
      apply("startupBusA", setStartupBusA); apply("busATransformer", setBusATransformer); apply("turbineBusB", setTurbineBusB); apply("safetyBusS", setSafetyBusS); apply("edgBreaker", setEdgBreaker); apply("acDcInterlock", setAcDcInterlock); apply("safetyToDcBreaker", setSafetyToDcBreaker); apply("busEToDcBreaker", setBusEToDcBreaker); apply("mainBatteryCharge", setMainBatteryCharge); apply("rolldownProtection", setRolldownProtection); apply("cstLevel", setCstLevel); apply("cstMakeup", setCstMakeup); apply("cstDrain", setCstDrain); apply("hotwellMakeup", setHotwellMakeup); apply("hotwellDrain", setHotwellDrain);
      apply("rcicValve", setRcicValve); apply("rcicFlow", setRcicFlow); apply("eccsPumpA", setEccsPumpA); apply("eccsPumpB", setEccsPumpB); apply("eccsPumpAMode", setEccsPumpAMode); apply("eccsPumpBMode", setEccsPumpBMode); apply("srvOpen", setSrvOpen); apply("adsActive", setAdsActive);
      apply("lubePumpSource", setLubePumpSource); apply("hydraulicPumpSource", setHydraulicPumpSource); apply("coldOilValve", setColdOilValve); apply("warmOilValve", setWarmOilValve); apply("turningGear", setTurningGear); apply("preheatValve", setPreheatValve);
      apply("simpleMode", setSimpleMode);
    } catch {} finally { setSessionRestored(true); }
  }, []);
  useEffect(() => {
    if (!sessionRestored) return;
    sessionStorage.setItem(
      "rbwr-live-plant-state",
      JSON.stringify({
        rods,
        temperature,
        pressure,
        reactorLevel,
        hotwellLevel,
        deaeratorLevel,
        condenserVacuum,
        mode,
        iprCycle,
        isRunning,
        bypassValve,
        valveValue,
        aprm,
        turbineOutputMW,
        physicsTuning,
        controls: { mainSteamInletOpen, reliefOpen, reliefValveB, exciterOn, isLocked, turbinePressureAuto, turbineRpmAuto, pump1Online, pump2Online, daIntakeOpen, daOutputOpen, daIntakeValve, daOuttakeValve, daIntakeDirection, daOuttakeDirection, daAuto, recircPumpA, recircPumpB, recircSpeedA, recircSpeedB, malfunctions, selectedRodId, rodDirection, selectionScope, autoEnabled, autoTarget, autoSpeed, autoMode, condensateFlow, condensatePumpBFlow, feedwaterFlow, feedwaterPumpBFlow, condenserPumpOn, condenserPumpB, condenserValve, condenserValveDirection, condenserAuto, carAOn, carBOn, sjaeOn, mccPumpOn, mccAutoOn, condenserCirculationPumpOn, startupBusA, busATransformer, turbineBusB, safetyBusS, edgBreaker, acDcInterlock, safetyToDcBreaker, busEToDcBreaker, mainBatteryCharge, rolldownProtection, cstLevel, cstMakeup, cstDrain, hotwellMakeup, hotwellDrain, rcicValve, rcicFlow, eccsPumpA, eccsPumpB, eccsPumpAMode, eccsPumpBMode, srvOpen, adsActive, lubePumpSource, hydraulicPumpSource, coldOilValve, warmOilValve, turningGear, preheatValve, simpleMode },
        updatedAt: Date.now(),
      }),
    );
    // Session state gives console and control-room navigation an immediate
    // shared snapshot. Keep a durable mirror as well: a browser reload must
    // never silently return steam valves to their startup positions.
    localStorage.setItem(
      "rbwr-live-plant-state",
      sessionStorage.getItem("rbwr-live-plant-state") || "{}",
    );
  }, [
    rods,
    temperature,
    pressure,
    reactorLevel,
    hotwellLevel,
    deaeratorLevel,
    condenserVacuum,
    mode,
    iprCycle,
    isRunning,
    bypassValve,
    valveValue,
    sessionRestored, aprm, physicsTuning,
    turbineOutputMW, mainSteamInletOpen, reliefOpen, reliefValveB, exciterOn, isLocked, turbinePressureAuto, turbineRpmAuto, pump1Online, pump2Online, daIntakeOpen, daOutputOpen, daIntakeValve, daOuttakeValve, daIntakeDirection, daOuttakeDirection, daAuto, recircPumpA, recircPumpB, recircSpeedA, recircSpeedB, malfunctions, selectedRodId, rodDirection, selectionScope, autoEnabled, autoTarget, autoSpeed, autoMode, condensateFlow, condensatePumpBFlow, feedwaterFlow, feedwaterPumpBFlow, condenserPumpOn, condenserPumpB, condenserValve, condenserValveDirection, condenserAuto, carAOn, carBOn, sjaeOn, mccPumpOn, mccAutoOn, condenserCirculationPumpOn, startupBusA, busATransformer, turbineBusB, safetyBusS, edgBreaker, acDcInterlock, safetyToDcBreaker, busEToDcBreaker, mainBatteryCharge, rolldownProtection, cstLevel, cstMakeup, cstDrain, hotwellMakeup, hotwellDrain, rcicValve, rcicFlow, eccsPumpA, eccsPumpB, eccsPumpAMode, eccsPumpBMode, srvOpen, adsActive, lubePumpSource, hydraulicPumpSource, coldOilValve, warmOilValve, turningGear, preheatValve, simpleMode,
  ]);
  useEffect(() => {
    localStorage.setItem("unit2-simple-mode", String(simpleMode));
  }, [simpleMode]);
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
      return;
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
            setAutoMessage("AUTO SELECTED IPR CYCLE 1.");
            return previous;
          }
          if (mode === "IPR" && isCycleComplete(previous, "IPR", iprCycle)) {
            if (iprCycle < 3) {
              setIprCycle((value) => value + 1);
              setAutoMessage(`AUTO ADVANCED TO IPR CYCLE ${iprCycle + 1}.`);
            } else {
              setMode("RUN");
              setAutoMessage("AUTO SELECTED RUN MODE.");
            }
            return previous;
          }
          const recirculationSettling = clamp(
            recirculationTargetAprm - recirculationAprm,
            -2,
            2,
          );
          const predictedAprm = aprm + recirculationSettling;
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
        if (direction < 0 && rod.position <= limit) {
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
    aprm,
    recirculationAprm,
    recirculationTargetAprm,
    iprCycle,
    selectionScope,
  ]);

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
    // Reactor period is an inverse exponential growth rate, not the change
    // between two animation frames. Sampling once a second and filtering the
    // logarithmic rate prevents a tiny recirculation adjustment from swinging
    // straight between infinity and a protective low-period indication.
    const samplePeriod = () => {
      const now = performance.now();
      const previous = aprmSample.current;
      const elapsed = Math.max(0.5, (now - previous.time) / 1000);
      const current = Math.max(0, periodAprmRef.current);

      if (current < 0.5 || previous.value < 0.5) {
        setReactorPeriod(999);
        aprmSample.current = { value: current, time: now, logRate: 0 };
        return;
      }

      const instantaneousRate = clamp(
        Math.log(current / previous.value) / elapsed,
        -0.12,
        0.12,
      );
      const logRate = previous.logRate * 0.82 + instantaneousRate * 0.18;
      const period = logRate > 0.0009
        ? clamp(Math.LN2 / logRate, 5, 999)
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
    if (!daFastCloseHeld) return;
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
  }, [daFastCloseHeld]);
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
      } catch {}
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
    const tick = window.setInterval(() => {
      if (simulationPausedRef.current) return;
      const control = condenserControlRef.current;
      const activeCars = (control.carAOn ? 1 : 0) + (control.carBOn ? 1 : 0);
      setCondenserVacuum((value) => {
        // The condenser is a heat sink, not a fixed-position vacuum source.
        // More steam requires more circulating-water/valve capacity; the
        // valve becomes deliberately less effective near the 40–70 mbar band.
        const steamFraction = clamp(control.steamFlow / 1300, 0, 1.2);
        const steamDrivenPressure = 1 - Math.min(.70, steamFraction * .70);
        // The control valve has a deliberately strong, non-linear authority:
        // a condenser with circulating water and useful steam load must be
        // able to reach the 40–70 mbar operating band well before 100% open.
        // At essentially zero steam load it still cannot create a fake vacuum.
        const valveFraction = clamp(control.condenserValve / 100, 0, 1);
        const valveAuthority = 1 - Math.pow(1 - valveFraction, 4);
        const steamAssist = clamp(control.steamFlow / 250, .10, 1);
        // Do not make valve capacity depend on its own measured pressure here:
        // that creates a low-pressure feedback loop which can hunt between two
        // values. The approach rate below supplies the intended gentle motion.
        const valveCooling = valveAuthority * (.04 + steamAssist * .91);
        const processTarget = clamp(steamDrivenPressure - valveCooling - (control.sjaeOn ? .025 : 0), .04, 1);
        const carTarget = activeCars > 0 && value > .85 ? .85 : 1;
        const target = ((control.condenserCirculationPumpOn && control.startupBusAvailable) || (control.condenserCirculationPumpB && control.busBAvailable))
          ? Math.min(processTarget, carTarget)
          : (activeCars > 0 && value > .85 ? .85 : 1);
        condenserTargetRef.current = target;
        // Vacuum changes become progressively slower near the normal 40–70
        // mbar band, while the calculated target itself stays steady.
        const rate = value < .12 ? .004 : value < .25 ? .01 : .04;
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
      if (startupBusAvailable) {
        setHotwellMakeup(hotwellLevel < -0.15);
        setHotwellDrain(hotwellLevel > 0.15);
      }
      dispatch(condensateTarget, 2000, setCondensateFlow, setCondensatePumpBFlow);
      dispatch(feedTarget, 1000, setFeedwaterFlow, setFeedwaterPumpBFlow);
      if (busBAvailable && condensateTarget > 2000) setCondenserPumpB(true);
      if (busBAvailable && feedTarget > 1000) setPump2Online(true);
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
      setDaPressure((value) =>
        clamp(
          value + (1.2 + (daOuttakeValve / 100) * 0.8 - value) * 0.12,
          1,
          2.2,
        ),
      );
    }, 1000);
    return () => window.clearInterval(tick);
  }, [daIntakeValve, daOuttakeValve, simpleMode]);
  useEffect(() => {
    if (!daAuto || simpleMode) return;
    const tick = window.setInterval(() => {
      // The DA's two process valves control temperature and pressure
      // independently; MCC feedwater flow remains untouched.
      setDaIntakeValve((value) =>
        clamp(value + clamp((110.5 - daTemperature) * 0.8, -0.5, 0.5), 0, 100),
      );
      setDaOuttakeValve((value) =>
        clamp(value + clamp((1.60 - daPressure) * 5, -0.5, 0.5), 0, 100),
      );
      setDaIntakeOpen(true);
      setDaOutputOpen(true);
    }, 500);
    return () => window.clearInterval(tick);
  }, [daAuto, simpleMode, daTemperature, daPressure]);
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
  const busACapacity = sharedTurbineCapacityActive
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
  const demandToleranceMW = Math.max(10, gridDemandMW * 0.025);
  const onGridDemand =
    isLocked &&
    netProductionMW > 1 &&
    Math.abs(netProductionMW - gridDemandMW) <= demandToleranceMW;
  const automationPenaltyCount =
    (autoEnabled || automationCooldowns.aprm > 0 ? 1 : 0) +
    (mccAutoOn || automationCooldowns.mcc > 0 ? 1 : 0);
  const scoreRate = onGridDemand
    ? Math.max(0.25, 1 - automationPenaltyCount * 0.25)
    : 0;
  const operatorPoints = Number(leaderboard[operatorName]?.points || 0);
  const sortedOperators = Object.entries(leaderboard).sort(
    ([, left], [, right]) => Number(right.points || 0) - Number(left.points || 0),
  );
  const operatorRank = operatorName
    ? sortedOperators.findIndex(([name]) => name === operatorName) + 1
    : 0;
  useEffect(() => {
    if (!operatorName) return;
    let cancelled = false;
    const connect = async () => {
      try {
        await ensureLeaderboardPlayer(operatorName);
        const rows = await getLeaderboard();
        if (cancelled) return;
        setLeaderboard(Object.fromEntries(rows.map((row) => [row.display_name, { points: Number(row.points), lastSeen: Date.parse(row.last_seen) || Date.now() }])));
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
    if (operatorName) return;
    navigate("/", { replace: true });
  }, [navigate, operatorName]);
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
    const tick = window.setInterval(() => {
      setSecondsToDemandChange((seconds) => {
        if (seconds > 1) return seconds - 1;
        setGridDemandMW(nextGridDemandMW);
        setNextGridDemandMW(newGridDemand());
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
      }));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [autoEnabled, mccAutoOn]);
  useEffect(() => {
    if (!operatorName || !scoreRate) return;
    const tick = window.setInterval(() => {
      setLeaderboard((previous) => {
        const next = {
          ...previous,
          [operatorName]: {
            points: Number(previous[operatorName]?.points || 0) + scoreRate,
            lastSeen: Date.now(),
          },
        };
        localStorage.setItem("unit2-operator-scores", JSON.stringify(next));
        if (remoteLeaderboardReady) pendingScoreRef.current += scoreRate;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [operatorName, scoreRate, remoteLeaderboardReady]);
  useEffect(() => {
    if (!remoteLeaderboardReady || !operatorName) return;
    const flush = window.setInterval(() => {
      const pending = pendingScoreRef.current;
      if (pending <= 0) return;
      pendingScoreRef.current = 0;
      void addLeaderboardPoints(operatorName, pending).then((row) => {
        if (!row) return;
        setLeaderboard((previous) => ({ ...previous, [row.display_name]: { points: Number(row.points), lastSeen: Date.parse(row.last_seen) || Date.now() } }));
      }).catch(() => { pendingScoreRef.current += pending; });
    }, 5000);
    return () => window.clearInterval(flush);
  }, [remoteLeaderboardReady, operatorName]);
  useEffect(() => {
    if (sharedTurbineCapacityActive && sharedTurbineLoad > 150) {
      setBusATransformer(false);
      setTurbineBusB(false);
      if (isLocked) setIsLocked(false);
      setEvent("TURBINE AUXILIARY POOL OVERLOAD — BUS A AND BUS B TRIPPED.");
      return;
    }
    if (!sharedTurbineCapacityActive && startupBusAvailable && startupLoad > busACapacity) {
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
  }, [sharedTurbineCapacityActive, sharedTurbineLoad, isLocked, startupBusAvailable, busATransformer, turbineBusEligible, busACapacity, turbineBusB, safetyBusS, startupLoad, busBLoad, safetyLoad]);

  useEffect(() => {
    const active = {
      "REACTOR LEVEL": reactorLevel <= -5 || reactorLevel >= 6,
      "MANUAL TRIP": false,
      "LOOP TRIP": mccLevel < 15,
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
        setIsLocked(false);
        setEvent("CHANNEL B TURBINE VACUUM TRIP — generator unsynchronized.");
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
    simulationPaused,
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
    if (isRunning && !isLocked) {
      // Before synchronization the shaft accelerates only as admitted steam flow rises.
      setTargetTurbineSpeed(
        mainSteamInletOpen ? clamp(turbineSteamFlow / 3, 0, 80) : 0,
      );
    }
  }, [isRunning, isLocked, mainSteamInletOpen, turbineSteamFlow]);
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
      return;
    }
    const governor = window.setInterval(() => {
      const rpmError = 3000 - actualRPM;
      const pressureError = pressure - 7100;
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
      if (pressure < 4500 && actualRPM < 100) rpmAutoSteamReadyRef.current = false;

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

      // Only intervene at a genuinely unsafe pressure excursion. Normal
      // run-up deliberately holds its calculated steam path rather than
      // swapping back and forth across a narrow pressure threshold.
      if (pressureError > 1400 || pressureRate > 600) {
        setValveValue((value) =>
          Math.round(clamp(value + clamp(pressureError / 1200, 0.08, 0.32), 0, 100) * 10) / 10,
        );
        setBypassValve((value) =>
          Math.round(clamp(value + clamp(pressureError / 1000, 0.1, 0.42), 0, 100) * 10) / 10,
        );
        return;
      }

      // Once phase has remained stable, taper the governor so it does not
      // hunt around synchronism. After six seconds it holds its last valve
      // positions until speed leaves the ±5 RPM window again.
      if (inPhaseSeconds >= 6) return;
      const settleFactor = inPhaseSeconds >= 2 ? 0.2 : 1;

      // Stage 2: calculate the main-valve setting which should pass roughly
      // Predict the exact no-load flow required for the current RPM error.
      // This is symmetric: it asks for more than 200 kg/s below 3,000 RPM
      // and less above it, preventing a stable 3,100 RPM overspeed.
      const availableSteam = Math.max(1, thermalOutput.steamKgS * steamPressureFactor * steamPathCapacity);
      const targetNoLoadFlow = clamp(200 + rpmError * 0.1, 180, 220);
      const predictedMainValve = clamp(targetNoLoadFlow / availableSteam * 100, 0, 100);
      const rpmTrim = clamp(rpmError / 100, -1, 1);
      const pressureTrim = clamp((7100 - pressure) / 220, -2, 2);
      const targetMainValve = clamp(predictedMainValve + rpmTrim + pressureTrim, 0, 100);
      setValveValue((value) =>
        Math.round(clamp(value + clamp(targetMainValve - value, -0.18, 0.18) * settleFactor, 0, 100) * 10) / 10,
      );
      setBypassValve((value) => Math.round(clamp(value - 0.2 * settleFactor, 0, 100) * 10) / 10);
    }, 125);
    return () => window.clearInterval(governor);
  }, [turbineRpmAuto, isRunning, mainSteamInletOpen, isLocked, actualRPM, pressure, pressureRate, thermalOutput.steamKgS, steamPressureFactor]);
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
  const turbineReadiness = simpleMode ? {} : {
    "MAIN STEAM PRESSURE": pressure >= 5500 && pressure <= 8500,
    "MAIN STEAM TEMPERATURE": temperature >= 100,
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
      const preheatActive = aux.turningGear && aux.preheatValve && aux.temperature >= 150;
      const metalTarget = preheatActive
        ? clamp(aux.temperature - 12, 25, 320)
        : 25;
      setTurbineMetalTemperature((value) =>
        clamp(
          value +
            (metalTarget - value) *
              (preheatActive ? 0.06 : 0.003),
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
      setTargetTurbineSpeed(0);
      setEvent(
        "TURBINE TRIP — lubrication oil temperature entered the danger zone.",
      );
    }
  }, [actualRPM, oilTemperature, isLocked, simpleMode]);
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
      setIsLocked(false);
      setTargetTurbineSpeed(0);
      setEvent("FIRE AGENT RELEASED — turbine tripped.");
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
    setAutoEnabled(false);
    setRodDirection(0);
    setSelectedRodId("A1");
    setIsRunning(true);
    setScramPressed(false);
    setEvent(
      "INSTANT STARTUP COMPLETE — SRM and IPR programme set to RUN handoff position.",
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
    localStorage.removeItem(STORAGE);
    sessionStorage.removeItem("rbwr-live-plant-state");
    localStorage.removeItem("rbwr-live-plant-state");
    sessionStorage.removeItem("rbwr-pending-console-command");
    sessionStorage.removeItem("rbwr-pending-console-commands");
    setActive("status");
    setConsoleOpen(false);
    setSimpleMode(false);
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
    setSelectedRodId("A1");
    setMode("SD");
    setIprCycle(1);
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
    setCondensateFlow(0);
    setCondensatePumpBFlow(0);
    setFeedwaterFlow(0);
    setFeedwaterPumpBFlow(0);
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
    setAutomationCooldowns({ aprm: 0, mcc: 0 });
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
    if (target === "help" && verb === "values")
      return "READABLE VALUES: reactor.temp|pressure|level|fuel|period|aprm|rodaprm, hotwell.level, da.level|temp|pressure|intake|outtake, cst.level, condenser.pressure|valve, condensate.a|b, feedwater.a|b, recirc.a|b|flow.a|flow.b, turbine.rpm|output|mainvalve|bypass|steamflow, electrical.battery|load.a|load.b|load.s|bus.a|bus.b|bus.s|dc, rcic.flow, oil.temp, turbine.metaltemp.";
    if (target === "help" && verb === "scenarios")
      return "SCENARIOS: cold — full reset; reactor-ready — RUN core, stable MCC, turbine offline; turbine-synced — ready reactor and synchronized turbine; grid-load — synchronized moderate-load unit.";
    if (target === "help")
      return "Commands: VALUES | GET <value> | <value> SET <n> | <switch> ON|OFF | SCRAM | START|STOP | PAUSE | UNPAUSE | SCENARIO <cold|reactor-ready|turbine-synced|grid-load>. Values: reactor.temp|pressure|level, hotwell.level, da.level|temp|pressure, cst.level, condenser.pressure|valve, condensate.a|b, feedwater.a|b, recirc.a|b, turbine.mainvalve|bypass, auto.aprm, physics.thermal|steam|removal|triptemp. Switches: mcc.auto|pump, condenser.auto|pump.a|pump.b|circulation.a|circulation.b, recirc.pump.a|b, turbine.rpmauto|pressureauto|inlet, electrical.busa|bustransformer|busb|buss, rcic.valve, eccs.a|b, ads.";
    if (target === "pause" || target === "unpause" || target === "resume") {
      const paused = target === "pause";
      setSimulationPaused(paused);
      setEvent(paused ? "SIMULATION CLOCK PAUSED — CLI control remains available." : "SIMULATION CLOCK RESUMED.");
      return paused ? "Simulation clock paused." : "Simulation clock resumed.";
    }
    if (target === "scenario") {
      const scenario = verb;
      if (scenario === "cold") {
        reset();
        return "Cold shutdown scenario loaded.";
      }
      if (scenario === "reactor-ready" || scenario === "turbine-synced" || scenario === "grid-load") {
        const load = scenario === "grid-load";
        setRpsTrips((previous) => Object.fromEntries(Object.keys(previous).map((key) => [key, false])));
        setIsRunning(true); setScramPressed(false); setMode("RUN"); setIprCycle(3);
        setRods((previous) => previous.map((rod) => ({ ...rod, position: load ? 40 : 64 })));
        setReactorLevel(0); setHotwellLevel(0); setDeaeratorLevel(0); setCstLevel(6);
        setMccPumpOn(true); setCondenserValve(55); setCondenserVacuum(.055);
        setCondenserPumpOn(true); setCondenserCirculationPumpOn(true);
        setPump1Online(true); setCondensateFlow(load ? 900 : 400); setFeedwaterFlow(load ? 900 : 400);
        setStartupBusA(true); setSafetyBusS(true); setMainSteamInletOpen(true);
        setPressure(load ? 7100 : 4500); setBypassValve(load ? 0 : 45); setValveValue(load ? 42 : 0);
        if (scenario !== "reactor-ready") {
          setExciterOn(true); setTurbineSpeed(66.67); setTargetTurbineSpeed(66.67); setIsLocked(true);
          setBusATransformer(true); setStartupBusA(false); setTurbineBusB(true);
        } else { setExciterOn(false); setTurbineSpeed(0); setIsLocked(false); }
        setEvent(`CLI SCENARIO LOADED — ${scenario.toUpperCase().replace("-", " ")}.`);
        return `Scenario ${scenario.toUpperCase()} loaded.`;
      }
      return "Unknown scenario. Use SCENARIO cold, reactor-ready, turbine-synced, or grid-load.";
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
      "auto.aprm": { min: 0, max: 100, set: setAutoTarget, unit: "%" },
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
  const tabbedShell = (content: ReactNode) => (
    <div className={`rbwr-control-room min-h-screen bg-[#07111d] text-slate-100 transition-[filter] duration-500 ${dcBusAvailable ? "" : "brightness-[.3] saturate-[.45]"}`}>
      <main className="mx-auto max-w-7xl p-3 sm:p-4 md:p-7">
        <header className="mb-5 flex flex-col gap-3 border-b border-cyan-500/20 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[.3em] text-cyan-400">
              UNIT 2 // THE BWR SIM
            </p>
            <h1 className="text-2xl font-black sm:text-3xl">
              Unit 2 Reactor Control Room
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperatorManual page={active} />
            <Button
              variant="outline"
              disabled={!busEAvailable}
              onClick={() => {
                setSimpleMode((value) => !value);
                setEvent(
                  !simpleMode
                    ? "SIMPLE MODE ENABLED — DA and turbine preparation controls are bypassed."
                    : "FULL SIMULATOR MODE ENABLED — advanced controls restored.",
                );
              }}
              className={`min-h-11 ${simpleMode ? "border-emerald-400 bg-emerald-500/15 text-emerald-200" : "border-slate-600 text-slate-300"}`}
            >
              {simpleMode ? "SIMPLE MODE: ON" : "SIMPLE MODE"}
            </Button>
            <Button
              variant="outline"
              disabled={!busEAvailable}
              onClick={() => setConsoleOpen(true)}
              className="min-h-11 border-fuchsia-400/70 text-fuchsia-200 hover:bg-fuchsia-950"
            >
              CLI MODE
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
          {panels.map((panel) => (
            <Button
              key={panel}
              size="sm"
              variant={active === panel ? "default" : "ghost"}
              onClick={() => setActive(panel)}
              className={`min-h-11 shrink-0 snap-start ${active === panel ? "bg-cyan-500 text-slate-950" : "text-slate-300"}`}
            >
              {names[panel]}
            </Button>
          ))}
        </nav>
        <div className={`rounded-xl border border-slate-700 bg-slate-900/75 p-3 sm:rounded-2xl sm:p-4 md:p-6 ${!busEAvailable && active !== "electrical" ? "pointer-events-none opacity-45" : ""}`}>
          {content}
        </div>
      </main>
      <SimulatorCliMode
        open={consoleOpen}
        onClose={() => setConsoleOpen(false)}
        onCommand={runConsoleCommand}
        liveStatus={`CLOCK ${simulationPaused ? "PAUSED" : "RUNNING"}\n\nREACTOR\nAPRM ${aprm.toFixed(2)}% · ${temperature.toFixed(1)} °C\nRPV ${pressure.toFixed(0)} kPa · LEVEL ${reactorLevel.toFixed(2)} m\n\nMCC\nHOTWELL ${hotwellLevel.toFixed(2)} m · DA ${deaeratorLevel.toFixed(2)} m\nCST ${cstLevel.toFixed(2)} m · COND ${Math.round(condenserVacuum * 1000)} mbar\n\nTURBINE\n${actualRPM.toFixed(0)} RPM · ${turbineOutputMW.toFixed(1)} MW\nMAIN ${valveValue.toFixed(1)}% · BYPASS ${bypassValve.toFixed(1)}%\n\nELECTRICAL\nBUS A ${startupBusAvailable ? "ON" : "OFF"} · BUS B ${busBAvailable ? "ON" : "OFF"}\nBUS S ${safetyBusAvailable ? "ON" : "OFF"} · DC ${dcBusAvailable ? "ON" : "OFF"}`}
      />
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
        iprCycle={iprCycle}
        aprm={aprm}
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
              "SRM BLOCK — complete the 5% SRM cycle before selecting IPR.",
            );
            return;
          }
          setMode(next);
          if (next === "SD") setAutoEnabled(false);
        }}
        onDirectionChange={setRodDirection}
        onAdvanceCycle={() => {
          if (isCycleComplete(rods, mode, iprCycle)) {
            setIprCycle((value) => Math.min(3, value + 1));
            setEvent("IPR cycle advanced.");
          } else
            setAutoMessage(
              "GROUP BLOCK — complete the current withdrawal cycle first.",
            );
        }}
        onAutoEnabledChange={setAutoEnabled}
        onAutoTargetChange={(value) => setAutoTarget(clamp(value, 0, 100))}
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
        {!simpleMode && <TurbineAuxPanel
          rpm={actualRPM}
          busS={safetyBusS}
          lubeSource={lubePumpSource}
          hydraulicSource={hydraulicPumpSource}
          coldValve={coldOilValve}
          warmValve={warmOilValve}
          turningGear={turningGear}
          preheatValve={preheatValve}
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
          onAgentRelease={() => {
            setTurbineSmoke("countdown");
            setAgentSeconds(10);
          }}
          onAgentAbort={() => {
            setTurbineSmoke("aborted");
            setEvent("FIRE AGENT RELEASE ABORTED — system may be re-armed.");
          }}
        />}
      </div>,
    );
  if (active === "electrical")
    return tabbedShell(
      <ElectricalPanel
        startupBusA={startupBusA}
        busATransformer={busATransformer}
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
        onStartupBusAChange={(value) => { setStartupBusA(value); if (value) setBusATransformer(false); }}
        onBusATransformerChange={(value) => { setBusATransformer(value); if (value) setStartupBusA(false); }}
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
      />,
    );
  if (active === "systems")
    return tabbedShell(
      <SystemsPanel
        malfunctions={malfunctions}
        recircAFlow={recircAFlow}
        recircBFlow={recircBFlow}
        gridDemandMW={gridDemandMW}
        nextGridDemandMW={nextGridDemandMW}
        secondsToDemandChange={secondsToDemandChange}
        netProductionMW={netProductionMW}
        onDemand={onGridDemand}
        operatorName={operatorName}
        operatorPoints={operatorPoints}
        operatorRank={operatorRank}
        leaderboardSize={sortedOperators.length}
        scoreRate={scoreRate}
        automationPenaltyCount={automationPenaltyCount}
        onChange={setMalfunctions}
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
