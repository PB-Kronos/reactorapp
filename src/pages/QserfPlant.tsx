import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  KeyRound,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  chooseAmbientAnnouncement,
  faasClips,
  useFaasAudio,
} from "@/lib/qserfFaas";
import {
  qserfEndings,
  qserfEffects,
  type QserfEndingKey,
  useQserfSoundscape,
} from "@/lib/qserfMedia";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

type Pump = { enabled: boolean };
type FuelType = "NORMAL" | "EFFICIENT" | "SUPER";
type GridSource = "PRIMARY" | "AUXILIARY" | "EXTERNAL" | "FOXTROT-9";
type Phase2HatchState = "SEALED" | "UNLOCKED" | "OPEN" | "EXPLODED";
type EvacuationLocation = "CONTROL_ROOM" | "BLAST_SHELTER" | "TARTARUS_ZONE";
type WarheadActor = "RAIDER" | "ADMINISTRATOR";
type WarheadStage =
  | "DORMANT"
  | "RAIDER_HACK"
  | "PRIMING"
  | "ARM_READY"
  | "KEYS"
  | "VERIFY"
  | "COUNTDOWN"
  | "CANCELLED";
type MeltdownStage =
  | "NORMAL"
  | "ACTIVE"
  | "PHASE_1_WINDOW"
  | "CODE_BLACK"
  | "PHASE_2_WINDOW"
  | "EVACUATION"
  | "CODE_OMNI"
  | "BLACK_HOLE"
  | "RECOVERED"
  | "TERMINAL";

const shutdownCodeLocations = [
  "HADRON COLLIDER CONTROL ROOM",
  "SECTOR B RECEPTION",
  "FOXTROT-9 AIRLOCK EXTERIOR",
  "SECTOR C RECEPTION",
  "DR. WELDMAN'S OFFICE — CONTROL STATION 15",
  "PUMP STATION ALPHA CONTROL ROOM",
  "RO CORPORATE BUILDING",
  "CONTROL ROOM — DIESEL GENERATOR FACING",
];
const formatMeltdownTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0")}`;
};
const freshPumps = (): Pump[] =>
  Array.from({ length: 6 }, () => ({ enabled: false }));
const qserfSessionStorageKey = "qserf-dmr-session-v1";

const fuelProfiles: Record<
  FuelType,
  { heat: number; burn: number; tone: string }
> = {
  NORMAL: { heat: 1, burn: 1, tone: "text-slate-200" },
  EFFICIENT: { heat: 0.72, burn: 0.62, tone: "text-emerald-300" },
  // Super cells deliberately trade stability for output: their reactivity and
  // heat contribution are much stronger than a normal cell.
  SUPER: { heat: 1.82, burn: 0.98, tone: "text-violet-300" },
};

const Meter = ({
  label,
  value,
  unit,
  tone = "text-cyan-200",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: string;
}) => (
  <div className="rounded border border-slate-700 bg-black/45 p-3">
    <p className="text-[10px] font-black tracking-[.13em] text-slate-400">
      {label}
    </p>
    <p className={`mt-1 text-xl font-black ${tone}`}>
      {value}
      {unit && <span className="ml-1 text-xs">{unit}</span>}
    </p>
  </div>
);

export default function QserfPlant() {
  const operatorName = localStorage.getItem("unit2-operator-name") || "GUEST";
  const [gridSource, setGridSource] = useState<GridSource>("EXTERNAL");
  const [foxtrotGridOnline, setFoxtrotGridOnline] = useState(
    () => localStorage.getItem("qserf-foxtrot-grid-online") === "true",
  );
  const [maintenance, setMaintenance] = useState(false);
  const [fuel, setFuel] = useState([100, 100, 100]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([
    "NORMAL",
    "NORMAL",
    "NORMAL",
  ]);
  const [fuelInserted, setFuelInserted] = useState([true, true, true]);
  const [selectedFuelType, setSelectedFuelType] = useState<FuelType | null>(
    null,
  );
  const [fuelLocks, setFuelLocks] = useState([false, false, false]);
  const [pumps, setPumps] = useState<Pump[]>(freshPumps);
  const [catalyzerFeedLatched, setCatalyzerFeedLatched] = useState(false);
  const [catalyzerMode, setCatalyzerMode] = useState<"GLOBAL" | "FINE">(
    "GLOBAL",
  );
  const [globalCatalyzerLevel, setGlobalCatalyzerLevel] = useState(2);
  const [fineCatalyzerLevels, setFineCatalyzerLevels] = useState([
    2, 2, 2, 2, 2, 2,
  ]);
  const [catalyzerCooling, setCatalyzerCooling] = useState(2);
  const [superstructureCooling, setSuperstructureCooling] = useState(2);
  const [internalPumps, setInternalPumps] = useState([true, true]);
  const [regenerators, setRegenerators] = useState([true, true]);
  const [coolantOutlets, setCoolantOutlets] = useState([true, true]);
  const [reliefValves, setReliefValves] = useState([
    false,
    false,
    false,
    false,
  ]);
  const [efssWater, setEfssWater] = useState(100);
  const [efssActive, setEfssActive] = useState(false);
  const [ignitionKey, setIgnitionKey] = useState(false);
  const [startupPhase, setStartupPhase] = useState<
    | "IDLE"
    | "EVACUATION"
    | "GRAVITY"
    | "RAISING"
    | "CENTERED"
    | "POWERING"
    | "INTAKE"
    | "ONLINE"
  >("IDLE");
  const [temperature, setTemperature] = useState(295);
  const [integrity, setIntegrity] = useState(100);
  const [radioactivity, setRadioactivity] = useState(0);
  const [maintenanceButton, setMaintenanceButton] = useState(false);
  const [activeQserfTab, setActiveQserfTab] = useState<"DMR" | "WARHEAD">("DMR");
  const [warheadStage, setWarheadStage] = useState<WarheadStage>("DORMANT");
  const [warheadActor, setWarheadActor] = useState<WarheadActor | null>(null);
  const [warheadSeconds, setWarheadSeconds] = useState(0);
  const [warheadKeys, setWarheadKeys] = useState([false, false]);
  const [warheadKeysTurned, setWarheadKeysTurned] = useState([false, false]);
  const [warheadLocation, setWarheadLocation] = useState<"TOPSIDE" | "BOTTOMSIDE">("BOTTOMSIDE");
  const [warheadTartarusSealed, setWarheadTartarusSealed] = useState(false);
  const [raiderFloppyHeld, setRaiderFloppyHeld] = useState(false);
  const [raiderFloppyEscaped, setRaiderFloppyEscaped] = useState(false);
  const [combustionStallState, setCombustionStallState] = useState<
    "NORMAL" | "SUSTAINABILITY_LOST" | "STALLED"
  >("NORMAL");
  const [primaryGridBlackout, setPrimaryGridBlackout] = useState(false);
  const [combustionStallFuelPenaltyPending, setCombustionStallFuelPenaltyPending] =
    useState(false);
  const [ending, setEnding] = useState<QserfEndingKey | null>(null);
  const [endingAudioNeedsGesture, setEndingAudioNeedsGesture] = useState(false);
  const [meltdownStage, setMeltdownStage] = useState<MeltdownStage>("NORMAL");
  const [meltdownSeconds, setMeltdownSeconds] = useState(0);
  const [codeBlackStartedAt, setCodeBlackStartedAt] = useState<number | null>(
    null,
  );
  const [phase2Available, setPhase2Available] = useState<boolean | null>(null);
  const [phase2UnlockTimes, setPhase2UnlockTimes] = useState<
    Array<number | null>
  >([null, null, null]);
  const [shutdownCode, setShutdownCode] = useState<string | null>(null);
  const [shutdownCodeLocation, setShutdownCodeLocation] = useState<
    string | null
  >(null);
  const [shutdownCodeEntry, setShutdownCodeEntry] = useState("");
  const [shutdownCodeRevealed, setShutdownCodeRevealed] = useState(false);
  const [phase1Keys, setPhase1Keys] = useState([false, false]);
  const [phase1Attempted, setPhase1Attempted] = useState(false);
  const [phase1Executing, setPhase1Executing] = useState(false);
  const [catalyzerFailures, setCatalyzerFailures] = useState<string[]>([]);
  const [shutdownButtonMissing, setShutdownButtonMissing] = useState(false);
  const [faasCodeGuesses, setFaasCodeGuesses] = useState(0);
  const [phase2HatchState, setPhase2HatchState] =
    useState<Phase2HatchState>("SEALED");
  const [evacuationLocation, setEvacuationLocation] =
    useState<EvacuationLocation>("CONTROL_ROOM");
  const [tartarusSealLockedAt, setTartarusSealLockedAt] = useState<
    number | null
  >(null);
  const [acknowledgedAlarmIds, setAcknowledgedAlarmIds] = useState<string[]>(
    [],
  );
  const [log, setLog] = useState<string[]>(["FAAS: DMR-01 standing by."]);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const {
    enabled: faasEnabled,
    setEnabled: setFaasEnabled,
    volumePercent: faasVolumePercent,
    setVolumePercent: setFaasVolumePercent,
    alarmsMuted,
    setAlarmsMuted,
    currentClip: faasCurrentClip,
    play: playFaas,
    playAfterDelay: playFaasAfterDelay,
    stop: stopFaas,
  } = useFaasAudio();
  const {
    musicEnabled,
    setMusicEnabled,
    musicKey,
    setMusicKey,
    musicVolumePercent,
    setMusicVolumePercent,
    musicElapsedSeconds,
    musicDurationSeconds,
    transitionMusic,
    activeEffect,
    playEffect,
    stopSoundscape,
  } = useQserfSoundscape(faasEnabled, alarmsMuted);
  const warningFlags = useRef({
    temperature: false,
    temperatureHigh: false,
    integrity75: false,
    integrity50: false,
    integrity25: false,
    meltdown: false,
    fuelLow: false,
    fuelDepleted: false,
  });
  const meltdownMilestones = useRef({
    monitorFailure: false,
    evacuation: false,
    codeRed: false,
    codeOmni: false,
    phase1Deadline: false,
    phase1Expired: false,
    shelterMinute: false,
    shelterAvailable: false,
    shelterThirty: false,
    shelterTen: false,
    doorsClosing: false,
  });
  const ambientAnnouncementTimer = useRef<number | null>(null);
  const [ambientScheduleRevision, setAmbientScheduleRevision] = useState(0);
  const phase1ExecutionTimer = useRef<number | null>(null);
  const phase2HatchTimer = useRef<number | null>(null);
  const phase2EndingTimer = useRef<number | null>(null);
  const combustionStallTimer = useRef<number | null>(null);
  const warheadStageTimer = useRef<number | null>(null);
  const warheadCountdownDeadline = useRef<number | null>(null);
  const warheadCountdownCalls = useRef({ t60: false, final: false });
  const gridSourceAtStall = useRef<GridSource>(gridSource);
  const endingVideoRef = useRef<HTMLVideoElement | null>(null);

  const online = startupPhase === "ONLINE";
  const meltdownInProgress =
    meltdownStage !== "NORMAL" &&
    meltdownStage !== "RECOVERED" &&
    meltdownStage !== "TERMINAL";
  const phase1WindowOpen =
    meltdownStage === "PHASE_1_WINDOW" && meltdownSeconds < 447;
  const phase2WindowOpen = meltdownStage === "PHASE_2_WINDOW";
  // Once Code Black is declared, every remaining event uses that actual point
  // as its clock anchor. A failed P1 attempt can legitimately bring Code
  // Black forward, so absolute timestamps would otherwise compress P2 and
  // the evacuation sequence into only a few seconds.
  const codeBlackClock = codeBlackStartedAt ?? 463;
  const reactorExplosionAt = codeBlackClock + 242;
  const evacuationAvailable = meltdownInProgress && codeBlackStartedAt !== null;
  const tartarusSealDeadline = reactorExplosionAt - 20;
  const tartarusSealLockedInTime =
    tartarusSealLockedAt !== null && tartarusSealLockedAt <= tartarusSealDeadline;
  const p2MusicHasStarted =
    musicKey === "meltdownP2" && musicElapsedSeconds > 0.05;
  const p2MusicComplete =
    p2MusicHasStarted &&
    musicDurationSeconds > 0 &&
    musicElapsedSeconds >= musicDurationSeconds - 0.1;
  const catalyzersIntact = catalyzerFailures.length === 0;
  const startupInProgress =
    startupPhase !== "IDLE" && startupPhase !== "ONLINE";
  const eventAnnouncementActive =
    faasCurrentClip !== null && !faasCurrentClip.startsWith("ambient-");
  const facilityEventActive =
    ending !== null ||
    meltdownInProgress ||
    maintenance ||
    startupInProgress ||
    eventAnnouncementActive;
  const monitoringLost =
    meltdownStage === "CODE_OMNI" || meltdownStage === "BLACK_HOLE";
  // Code Omni destroys monitoring, not the operator's ability to act. P2,
  // EFSS, fuel locks, and evacuation routing must remain usable throughout a
  // meltdown, including after display data has failed.
  const controlsUnavailable = false;
  const sceneState =
    primaryGridBlackout
      ? "PRIMARY GRID BLACKOUT"
      : meltdownStage === "BLACK_HOLE"
      ? "BLACK HOLE"
      : monitoringLost
        ? "CODE OMNI — NO DATA"
        : meltdownStage === "CODE_BLACK" ||
            meltdownStage === "PHASE_2_WINDOW" ||
            meltdownStage === "EVACUATION"
          ? "CODE BLACK — DMR GLOW"
          : meltdownInProgress && meltdownSeconds >= 235
            ? "CODE RED"
            : meltdownInProgress
              ? "EMERGENCY LIGHTING"
              : "NOMINAL";
  const sceneBackground =
    sceneState === "PRIMARY GRID BLACKOUT"
      ? "#010204"
      : sceneState === "BLACK HOLE"
      ? "radial-gradient(circle at 50% 17%, #32120f 0%, #11070c 32%, #030408 76%)"
      : monitoringLost
        ? "linear-gradient(135deg, #05070c 0%, #190609 50%, #05070c 100%)"
        : sceneState.includes("CODE BLACK")
          ? "radial-gradient(circle at 50% 16%, #48130d 0%, #17080c 39%, #080a10 76%)"
          : sceneState === "CODE RED"
            ? "linear-gradient(135deg, #1b090c 0%, #0b0a11 62%, #22080b 100%)"
            : "#080a10";
  const gridOnline = primaryGridBlackout
    ? gridSource === "AUXILIARY"
    : gridSource === "FOXTROT-9"
      ? foxtrotGridOnline
      : gridSource === "PRIMARY"
        ? online
        : true;
  const runningPumps = pumps.filter((pump) => pump.enabled).length;
  const fuelAverage =
    fuel.reduce((sum, current) => sum + current, 0) / fuel.length;
  const fuelHeat =
    fuelTypes.reduce((sum, type) => sum + fuelProfiles[type].heat, 0) /
    fuelTypes.length;
  const fuelBurn =
    fuelTypes.reduce((sum, type) => sum + fuelProfiles[type].burn, 0) /
    fuelTypes.length;
  const catalyzerLevel =
    catalyzerMode === "GLOBAL"
      ? globalCatalyzerLevel
      : fineCatalyzerLevels.reduce((sum, value) => sum + value, 0) /
        fineCatalyzerLevels.length;
  const internalCoolingNetworks = internalPumps.filter(
    (pump, index) => pump && regenerators[index] && coolantOutlets[index],
  ).length;
  const activeRelief = reliefValves.filter(Boolean).length;
  const startupReady =
    fuelInserted.every(Boolean) &&
    fuelLocks.every(Boolean) &&
    catalyzerFeedLatched &&
    gridOnline &&
    !maintenance &&
    ignitionKey;
  const phase1Permissives =
    temperature < 3000 && efssWater > 60 && catalyzersIntact;
  const activeAlarms = [
    online && temperature >= 1200 && temperature < 2300
      ? { id: "temperature-advisory", label: "CORE TEMP HIGH" }
      : null,
    online && temperature >= 2300
      ? { id: "temperature-danger", label: "CORE TEMP DANGER" }
      : null,
    online && integrity <= 75 && integrity > 50
      ? { id: "integrity-75", label: "INTEGRITY LOW" }
      : null,
    online && integrity <= 50 && integrity > 25
      ? { id: "integrity-50", label: "INTEGRITY CRITICAL" }
      : null,
    online && integrity <= 25
      ? { id: "integrity-25", label: "INTEGRITY DANGER" }
      : null,
    online && fuelAverage <= 20 && fuelAverage > 3
      ? { id: "fuel-low", label: "FUEL LOW" }
      : null,
    online && fuelAverage <= 3
      ? { id: "fuel-depleted", label: "FUEL DEPLETED" }
      : null,
    combustionStallState === "SUSTAINABILITY_LOST"
      ? { id: "combustion-sustainability", label: "REACTION SUSTAINABILITY LOST" }
      : null,
    combustionStallState === "STALLED"
      ? { id: "combustion-stalled", label: "COMBUSTION STALLED" }
      : null,
    meltdownInProgress ? { id: "meltdown", label: "DMR MELTDOWN" } : null,
  ].filter((alarm): alarm is { id: string; label: string } => alarm !== null);
  const activeAlarmSignature = activeAlarms.map((alarm) => alarm.id).join("|");
  const unacknowledgedAlarmCount = activeAlarms.filter(
    (alarm) => !acknowledgedAlarmIds.includes(alarm.id),
  ).length;
  const status = ending
    ? "REACTOR DESTROYED"
    : meltdownStage === "RECOVERED"
      ? "EMERGENCY SHUTDOWN COMPLETE"
      : meltdownStage === "BLACK_HOLE"
        ? "DMR IMPLOSION / BLACK HOLE"
        : monitoringLost
          ? "SYSTEM UNAVAILABLE — NO DATA"
          : meltdownInProgress
            ? `MELTDOWN — ${meltdownStage.replaceAll("_", " ")}`
            : !online
              ? combustionStallState === "STALLED"
                ? primaryGridBlackout
                  ? "COMBUSTION STALLED — PRIMARY BLACKOUT"
                  : "COMBUSTION STALLED — AUXILIARY RESTART REQUIRED"
                : maintenance
                ? "MAINTENANCE MODE"
                : "STANDBY"
              : temperature > 3500 && integrity < 10
                ? "MELTDOWN SEQUENCE"
                : temperature > 3000
                  ? "UNSTABLE"
                  : "OPERATING";
  const addLog = (line: string) => setLog((old) => [line, ...old].slice(0, 6));
  const playRandomHumanCall = useCallback(() => {
    const announcement = chooseAmbientAnnouncement();
    playFaas(announcement.lead, 0);
    if (announcement.followup) {
      // ALT_08 is only ever reached through this ALT_07 follow-up path.
      playFaasAfterDelay(announcement.followup, 3000, 0);
    }
  }, [playFaas, playFaasAfterDelay]);

  useEffect(() => {
    const currentIds = new Set(activeAlarms.map((alarm) => alarm.id));
    setAcknowledgedAlarmIds((old) => old.filter((id) => currentIds.has(id)));
  }, [activeAlarmSignature]);

  useEffect(() => {
    const updateFoxtrot = (event: Event) =>
      setFoxtrotGridOnline(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("qserf-foxtrot-grid", updateFoxtrot);
    return () =>
      window.removeEventListener("qserf-foxtrot-grid", updateFoxtrot);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(qserfSessionStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (typeof saved.gridSource === "string") setGridSource(saved.gridSource as GridSource);
      if (typeof saved.maintenance === "boolean") setMaintenance(saved.maintenance);
      if (Array.isArray(saved.fuel) && saved.fuel.length === 3) setFuel(saved.fuel as number[]);
      if (Array.isArray(saved.fuelTypes) && saved.fuelTypes.length === 3) setFuelTypes(saved.fuelTypes as FuelType[]);
      if (Array.isArray(saved.fuelInserted) && saved.fuelInserted.length === 3) setFuelInserted(saved.fuelInserted as boolean[]);
      if (Array.isArray(saved.fuelLocks) && saved.fuelLocks.length === 3) setFuelLocks(saved.fuelLocks as boolean[]);
      if (Array.isArray(saved.pumps) && saved.pumps.length === 6) setPumps(saved.pumps as Pump[]);
      if (typeof saved.catalyzerFeedLatched === "boolean") setCatalyzerFeedLatched(saved.catalyzerFeedLatched);
      if (saved.catalyzerMode === "GLOBAL" || saved.catalyzerMode === "FINE") setCatalyzerMode(saved.catalyzerMode);
      if (typeof saved.globalCatalyzerLevel === "number") setGlobalCatalyzerLevel(saved.globalCatalyzerLevel);
      if (Array.isArray(saved.fineCatalyzerLevels) && saved.fineCatalyzerLevels.length === 6) setFineCatalyzerLevels(saved.fineCatalyzerLevels as number[]);
      if (typeof saved.catalyzerCooling === "number") setCatalyzerCooling(saved.catalyzerCooling);
      if (typeof saved.superstructureCooling === "number") setSuperstructureCooling(saved.superstructureCooling);
      if (Array.isArray(saved.internalPumps) && saved.internalPumps.length === 2) setInternalPumps(saved.internalPumps as boolean[]);
      if (Array.isArray(saved.regenerators) && saved.regenerators.length === 2) setRegenerators(saved.regenerators as boolean[]);
      if (Array.isArray(saved.coolantOutlets) && saved.coolantOutlets.length === 2) setCoolantOutlets(saved.coolantOutlets as boolean[]);
      if (Array.isArray(saved.reliefValves) && saved.reliefValves.length === 4) setReliefValves(saved.reliefValves as boolean[]);
      if (typeof saved.efssWater === "number") setEfssWater(saved.efssWater);
      if (typeof saved.efssActive === "boolean") setEfssActive(saved.efssActive);
      if (typeof saved.ignitionKey === "boolean") setIgnitionKey(saved.ignitionKey);
      if (typeof saved.startupPhase === "string") setStartupPhase(saved.startupPhase as typeof startupPhase);
      if (typeof saved.temperature === "number") setTemperature(saved.temperature);
      if (typeof saved.integrity === "number") setIntegrity(saved.integrity);
      if (typeof saved.radioactivity === "number") setRadioactivity(saved.radioactivity);
      if (typeof saved.combustionStallState === "string") setCombustionStallState(saved.combustionStallState as typeof combustionStallState);
      if (typeof saved.primaryGridBlackout === "boolean") setPrimaryGridBlackout(saved.primaryGridBlackout);
      if (typeof saved.combustionStallFuelPenaltyPending === "boolean") setCombustionStallFuelPenaltyPending(saved.combustionStallFuelPenaltyPending);
      if (typeof saved.activeQserfTab === "string") setActiveQserfTab(saved.activeQserfTab as "DMR" | "WARHEAD");
      if (typeof saved.warheadStage === "string") setWarheadStage(saved.warheadStage as WarheadStage);
      if (saved.warheadActor === "RAIDER" || saved.warheadActor === "ADMINISTRATOR") setWarheadActor(saved.warheadActor);
      if (typeof saved.warheadSeconds === "number") setWarheadSeconds(saved.warheadSeconds);
      if (Array.isArray(saved.warheadKeys) && saved.warheadKeys.length === 2) setWarheadKeys(saved.warheadKeys as boolean[]);
      if (Array.isArray(saved.warheadKeysTurned) && saved.warheadKeysTurned.length === 2) setWarheadKeysTurned(saved.warheadKeysTurned as boolean[]);
      if (saved.warheadLocation === "TOPSIDE" || saved.warheadLocation === "BOTTOMSIDE") setWarheadLocation(saved.warheadLocation);
      if (typeof saved.warheadTartarusSealed === "boolean") setWarheadTartarusSealed(saved.warheadTartarusSealed);
      if (typeof saved.raiderFloppyHeld === "boolean") setRaiderFloppyHeld(saved.raiderFloppyHeld);
      if (typeof saved.raiderFloppyEscaped === "boolean") setRaiderFloppyEscaped(saved.raiderFloppyEscaped);
    } catch {
      localStorage.removeItem(qserfSessionStorageKey);
    } finally {
      setSessionHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!sessionHydrated) return;
    localStorage.setItem(qserfSessionStorageKey, JSON.stringify({
      gridSource, maintenance, fuel, fuelTypes, fuelInserted, fuelLocks, pumps,
      catalyzerFeedLatched, catalyzerMode, globalCatalyzerLevel, fineCatalyzerLevels,
      catalyzerCooling, superstructureCooling, internalPumps, regenerators, coolantOutlets,
      reliefValves, efssWater, efssActive, ignitionKey, startupPhase, temperature,
      integrity, radioactivity, combustionStallState, primaryGridBlackout,
      combustionStallFuelPenaltyPending, activeQserfTab, warheadStage, warheadActor,
      warheadSeconds, warheadKeys, warheadKeysTurned, warheadLocation,
      warheadTartarusSealed, raiderFloppyHeld, raiderFloppyEscaped,
    }));
  });

  useEffect(() => {
    gridSourceAtStall.current = gridSource;
  }, [gridSource]);

  useEffect(() => {
    if (runningPumps !== 6 || catalyzerFeedLatched) return;
    setCatalyzerFeedLatched(true);
    addLog("FAAS: All six catalyzer feed pumps online. Catalyzer feed latched.");
  }, [catalyzerFeedLatched, runningPumps]);

  useEffect(() => {
    if (!faasEnabled || facilityEventActive) return;
    // Exactly one timer exists at any time. A manual test or an automatic call
    // increments the revision, clearing this timer before a fresh 85–115s
    // interval is scheduled. This prevents stale timers from stacking calls
    // behind ALT_07 / ALT_08.
    const delay = 85_000 + Math.round(Math.random() * 30_000);
    ambientAnnouncementTimer.current = window.setTimeout(() => {
      playRandomHumanCall();
      setAmbientScheduleRevision((revision) => revision + 1);
    }, delay);
    return () => {
      if (ambientAnnouncementTimer.current !== null) {
        window.clearTimeout(ambientAnnouncementTimer.current);
        ambientAnnouncementTimer.current = null;
      }
    };
  }, [ambientScheduleRevision, faasEnabled, facilityEventActive, playRandomHumanCall]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!online || ending) return;
      const heat =
        (2 + catalyzerLevel * 3.8 + (100 - fuelAverage) * 0.04) *
        fuelHeat *
        (0.5 + catalyzerCooling / 8);
      const cooling =
        internalCoolingNetworks * superstructureCooling * 1.6 +
        activeRelief * 9 +
        (efssActive ? 28 : 0);
      const escalation = temperature > 3000 ? (temperature - 2900) / 90 : 0;
      setTemperature((value) =>
        Math.max(0, value + (heat - cooling + escalation) * 0.5),
      );
      setFuel((cells) =>
        cells.map((cell) =>
          meltdownInProgress
            ? clamp(cell + 0.07, 0, 100)
            : clamp(cell - 0.055 * fuelBurn, 0, 100),
        ),
      );
      setRadioactivity((value) =>
        clamp(value + Math.max(0, temperature - 1300) / 1000, 0, 100),
      );
      setIntegrity((value) =>
        temperature > 3500
          ? clamp(value - (temperature - 3450) / 1200, 0, 100)
          : clamp(value + 0.08, 0, 100),
      );
      if (efssActive) setEfssWater((value) => clamp(value - 0.6, 0, 100));
    }, 500);
    return () => window.clearInterval(timer);
  }, [
    online,
    ending,
    meltdownInProgress,
    runningPumps,
    fuelAverage,
    fuelHeat,
    fuelBurn,
    temperature,
    catalyzerLevel,
    catalyzerCooling,
    internalCoolingNetworks,
    superstructureCooling,
    activeRelief,
    efssActive,
  ]);

  useEffect(() => {
    const lowSustainability =
      online &&
      !ending &&
      !meltdownInProgress &&
      temperature < 230 &&
      combustionStallState !== "STALLED";

    if (!lowSustainability) {
      if (combustionStallTimer.current !== null) {
        window.clearTimeout(combustionStallTimer.current);
        combustionStallTimer.current = null;
      }
      if (combustionStallState === "SUSTAINABILITY_LOST") {
        setCombustionStallState("NORMAL");
        addLog("Reaction sustainability restored before combustion stall.");
      }
      return;
    }

    if (combustionStallState === "NORMAL") {
      setCombustionStallState("SUSTAINABILITY_LOST");
      playFaas(faasClips.combustionSustainability, 0);
      addLog(
        "FAAS: Reaction sustainability is being lost. Raise DMR temperature above 230 K before combustion stalls.",
      );
    }
    if (combustionStallTimer.current !== null) return;

    combustionStallTimer.current = window.setTimeout(() => {
      combustionStallTimer.current = null;
      setCombustionStallState("STALLED");
      setCombustionStallFuelPenaltyPending(true);
      setStartupPhase("IDLE");
      const stalledGrid = gridSourceAtStall.current;
      if (stalledGrid === "PRIMARY") setPrimaryGridBlackout(true);
      playFaas(faasClips.combustionStalled, 0);
      playEffect(qserfEffects.combustionStall, 0);
      addLog(
        stalledGrid === "PRIMARY"
          ? "Combustion stalled. Primary Grid blackout: select AUXILIARY GRID before restarting DMR."
          : "Combustion stalled. Restart DMR after restoring a stable grid supply.",
      );
    }, 12_000);
  }, [
    combustionStallState,
    ending,
    gridSource,
    meltdownInProgress,
    online,
    playEffect,
    playFaas,
    temperature,
  ]);

  useEffect(() => {
    if (!online || !combustionStallFuelPenaltyPending) return;
    setCombustionStallFuelPenaltyPending(false);
    setCombustionStallState("NORMAL");
    setPrimaryGridBlackout(false);
    setFuel((cells) => {
      const average = cells.reduce((sum, value) => sum + value, 0) / cells.length;
      if (average <= 10) return cells;
      return cells.map((value) => clamp(value - 10, 0, 100));
    });
    addLog(
      fuelAverage > 10
        ? "DMR restart complete. Average fuel capacity reduced by 10% after combustion stall."
        : "DMR restart complete. Fuel penalty bypassed: average fuel was already at or below 10%.",
    );
  }, [combustionStallFuelPenaltyPending, fuelAverage, online]);

  useEffect(() => {
    if (warheadStage !== "RAIDER_HACK" && warheadStage !== "PRIMING") return;
    const raiderHack = warheadStage === "RAIDER_HACK";
    warheadStageTimer.current = window.setTimeout(() => {
      warheadStageTimer.current = null;
      if (raiderHack) {
        setWarheadStage("PRIMING");
        playFaas(faasClips.warheadPrimingStarted, 0);
        addLog("Raider Chip accepted. Warhead priming confirmation is in progress.");
      } else {
        setWarheadStage("ARM_READY");
        playFaas(faasClips.warheadPrimed, 0);
        addLog("Protocol Saletum primed. ARM control is illuminated.");
      }
    }, raiderHack ? 17_000 : 40_000);
    return () => {
      if (warheadStageTimer.current !== null) {
        window.clearTimeout(warheadStageTimer.current);
        warheadStageTimer.current = null;
      }
    };
  }, [playFaas, warheadStage]);

  useEffect(() => {
    if (warheadStage !== "COUNTDOWN") return;
    if (warheadCountdownDeadline.current === null) {
      warheadCountdownDeadline.current = Date.now() + warheadSeconds * 1_000;
    }
    const updateCountdown = () => {
      const deadline = warheadCountdownDeadline.current;
      if (deadline === null) return;
      setWarheadSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1_000)));
    };
    updateCountdown();
    const countdown = window.setInterval(updateCountdown, 100);
    return () => window.clearInterval(countdown);
  }, [warheadStage]);

  useEffect(() => {
    if (warheadStage !== "COUNTDOWN") return;
    if (warheadSeconds <= 60 && !warheadCountdownCalls.current.t60) {
      warheadCountdownCalls.current.t60 = true;
      playFaas(faasClips.warheadTimer60, 0);
    }
    // The final call is a 42.55-second recording: it contains the spoken
    // T−30 preamble plus the full count. Start it at T−43 so its final count
    // lands with the detonation instead of more than twelve seconds late.
    if (warheadSeconds <= 43 && !warheadCountdownCalls.current.final) {
      warheadCountdownCalls.current.final = true;
      playFaas(faasClips.warheadTimer30, 0);
    }
    if (warheadSeconds > 0) return;
    setWarheadStage("CANCELLED");
    stopFaas();
    stopSoundscape();
    if (warheadActor === "RAIDER" && raiderFloppyEscaped) {
      setEnding("forImmediateBroadcast");
    } else if (
      warheadActor === "RAIDER" &&
      warheadLocation === "TOPSIDE" &&
      warheadTartarusSealed
    ) {
      setEnding("protocolSaletum");
    } else {
      setEnding("emergencyDeath");
    }
    addLog("Warhead detonation complete. Facility destruction outcome projected.");
  }, [
    playFaas,
    raiderFloppyEscaped,
    stopFaas,
    stopSoundscape,
    warheadActor,
    warheadLocation,
    warheadSeconds,
    warheadStage,
    warheadTartarusSealed,
  ]);

  useEffect(() => {
    if (startupPhase === "IDLE" || startupPhase === "ONLINE") return;
    const phases: Record<
      Exclude<typeof startupPhase, "IDLE" | "ONLINE">,
      [typeof startupPhase, string, number]
    > = {
      EVACUATION: [
        "GRAVITY",
        "FAAS: Startup evacuation advisory issued.",
        6200,
      ],
      GRAVITY: [
        "RAISING",
        "FAAS: Gravitational lasers online. Raising DMR superstructure.",
        2800,
      ],
      RAISING: [
        "CENTERED",
        "FAAS: Raising superstructure to its center position.",
        3300,
      ],
      CENTERED: [
        "POWERING",
        "FAAS: Superstructure centered. Activating power lasers.",
        2600,
      ],
      POWERING: [
        "INTAKE",
        "FAAS: Power lasers online. Opening combustion intake valves.",
        3500,
      ],
      INTAKE: [
        "ONLINE",
        "FAAS: Startup complete. DMR-01 is now operating.",
        3000,
      ],
    };
    const phaseAudio = {
      EVACUATION: undefined,
      GRAVITY: faasClips.gravitationalLasers,
      RAISING: faasClips.superstructureRaising,
      CENTERED: faasClips.superstructureCentered,
      POWERING: [faasClips.powerLasersActivating, faasClips.powerLasersOnline],
      INTAKE: faasClips.combustionIntake,
    } as const;
    const [next, message, delay] = phases[startupPhase];
    const audio = phaseAudio[startupPhase];
    if (audio) playFaas(audio, 0);
    const timeout = window.setTimeout(() => {
      setStartupPhase(next);
      addLog(message);
      if (next === "ONLINE") playFaas(faasClips.reactorOnline, 0);
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [playFaas, startupPhase]);

  useEffect(() => {
    const flags = warningFlags.current;
    const trigger = (
      key: keyof typeof flags,
      condition: boolean,
      clip: Parameters<typeof playFaas>[0],
    ) => {
      if (condition && !flags[key]) {
        flags[key] = true;
        playFaas(clip);
      }
      if (!condition) flags[key] = false;
    };
    trigger(
      "temperature",
      online && temperature >= 1200,
      faasClips.coreTemperature,
    );
    if (online && temperature >= 1200) {
      playEffect(qserfEffects.integrityAlarm);
    }
    trigger(
      "temperatureHigh",
      online && temperature >= 2300,
      faasClips.coreTemperatureHigh,
    );
    if (online && temperature >= 2300) {
      playEffect(qserfEffects.majorOverheat);
    }
    trigger("integrity75", online && integrity <= 75, faasClips.integrity75);
    trigger("integrity50", online && integrity <= 50, faasClips.integrity50);
    trigger("integrity25", online && integrity <= 25, faasClips.integrity25);
    if (online && integrity <= 25) playEffect(qserfEffects.integrityAlarm);
    trigger(
      "meltdown",
      online && temperature > 3500 && integrity < 10,
      faasClips.meltdownInstability,
    );
    if (online && temperature > 3500 && integrity < 10) {
      playEffect(qserfEffects.criticalOverheat);
    }
    trigger(
      "fuelLow",
      online && fuelAverage <= 20 && fuelAverage > 3,
      faasClips.replacementRequired,
    );
    trigger("fuelDepleted", online && fuelAverage <= 3, faasClips.fuelDepleted);
  }, [fuelAverage, integrity, online, playEffect, playFaas, temperature]);

  useEffect(() => {
    if (
      !online ||
      ending ||
      meltdownStage !== "NORMAL" ||
      temperature < 3500 ||
      integrity >= 10
    )
      return;
    setMeltdownStage("ACTIVE");
    setMeltdownSeconds(0);
    setCodeBlackStartedAt(null);
    setPhase2Available(null);
    setPhase2UnlockTimes([null, null, null]);
    setShutdownCode(null);
    setShutdownCodeLocation(null);
    setShutdownCodeEntry("");
    setShutdownCodeRevealed(false);
    setPhase1Keys([false, false]);
    setPhase1Attempted(false);
    setPhase1Executing(false);
    setCatalyzerFailures([]);
    setShutdownButtonMissing(false);
    setFaasCodeGuesses(0);
    setPhase2HatchState("SEALED");
    setEvacuationLocation("CONTROL_ROOM");
    setTartarusSealLockedAt(null);
    if (phase1ExecutionTimer.current !== null) {
      window.clearTimeout(phase1ExecutionTimer.current);
      phase1ExecutionTimer.current = null;
    }
    if (phase2HatchTimer.current !== null) {
      window.clearTimeout(phase2HatchTimer.current);
      phase2HatchTimer.current = null;
    }
    if (phase2EndingTimer.current !== null) {
      window.clearTimeout(phase2EndingTimer.current);
      phase2EndingTimer.current = null;
    }
    setAcknowledgedAlarmIds([]);
    setAlarmsMuted(false);
    meltdownMilestones.current = {
      monitorFailure: false,
      evacuation: false,
      codeRed: false,
      codeOmni: false,
      phase1Deadline: false,
      phase1Expired: false,
      shelterMinute: false,
      shelterAvailable: false,
      shelterThirty: false,
      shelterTen: false,
      doorsClosing: false,
    };
    if (musicEnabled) setMusicKey("meltdownP1");
    playFaas(faasClips.meltdownInstability, 0);
    playEffect(qserfEffects.criticalOverheat, 0);
    addLog("FAAS: Meltdown sequence initiated. Phase 1 is not yet available.");
  }, [
    ending,
    integrity,
    musicEnabled,
    online,
    playEffect,
    playFaas,
    setMusicKey,
    temperature,
    meltdownStage,
  ]);

  useEffect(() => {
    if (!meltdownInProgress || ending) return;
    const timer = window.setInterval(
      () => setMeltdownSeconds((seconds) => seconds + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [ending, meltdownInProgress]);

  useEffect(() => {
    if (!musicEnabled || codeBlackStartedAt === null || musicKey === "meltdownP2")
      return;
    // Code Black marks the loss of the official P1 route. Crossfade into the
    // P2 bed rather than abruptly restarting a new track.
    transitionMusic("meltdownP2", 5_000);
  }, [codeBlackStartedAt, musicEnabled, musicKey, transitionMusic]);

  useEffect(() => {
    if (!ending || !endingVideoRef.current) return;
    const video = endingVideoRef.current;
    // The aftermath is intentionally the only audible source after explosion.
    // Explicitly clear muted/volume state because a browser can retain it when
    // the same page has previously played other media.
    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1;
    video.currentTime = 0;
    void video.play().catch(() => undefined);
  }, [ending]);

  useEffect(() => {
    if (!phase1WindowOpen || phase1Executing || shutdownCode === null) return;
    const timer = window.setInterval(() => {
      setFaasCodeGuesses((attempts) => attempts + 12);
      // Six digits are still effectively impossible to brute-force during the
      // short P1 window, but the original FAAS behavior is represented.
      if (Math.random() < 1 / 1_000_000) {
        setShutdownCodeEntry(shutdownCode);
        setShutdownCodeRevealed(true);
        addLog("FAAS code analysis matched the shutdown sequence.");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase1Executing, phase1WindowOpen, shutdownCode]);

  useEffect(() => {
    if (!phase2WindowOpen || phase2HatchState !== "UNLOCKED") return;
    phase2HatchTimer.current = window.setTimeout(() => {
      setPhase2HatchState("EXPLODED");
      setPhase2Available(false);
      setMeltdownStage("EVACUATION");
      playFaas(faasClips.emergencyEvacuate, 0);
      addLog("Phase 2 chamber hatch detonated after delayed access.");
    }, 20_000);
    return () => {
      if (phase2HatchTimer.current !== null) {
        window.clearTimeout(phase2HatchTimer.current);
        phase2HatchTimer.current = null;
      }
    };
  }, [phase2HatchState, phase2WindowOpen, playFaas]);

  useEffect(() => {
    if (!meltdownInProgress || ending) return;
    const flags = meltdownMilestones.current;
    if (meltdownSeconds >= 120 && !flags.monitorFailure) {
      flags.monitorFailure = true;
      playFaas(
        [faasClips.integrityMonitorFailed, faasClips.integrityMonitorNoData],
        0,
      );
      addLog(
        "FAAS: Structural integrity monitor fault. Display now reads Err%.",
      );
    }
    if (meltdownSeconds >= 170 && !flags.evacuation) {
      flags.evacuation = true;
      playFaas(faasClips.scientificEvacuation, 0);
      addLog("FAAS: Scientific personnel evacuation ordered.");
    }
    if (meltdownSeconds >= 235 && !flags.codeRed) {
      flags.codeRed = true;
      playFaas(faasClips.codeRed, 0);
      playEffect(qserfEffects.codeRed, 0);
      addLog("CODE RED declared. Locate the Phase 1 shutdown code.");
    }
    if (meltdownSeconds >= 297 && meltdownStage === "ACTIVE") {
      const code = String(Math.floor(Math.random() * 1_000_000)).padStart(
        6,
        "0",
      );
      const location =
        shutdownCodeLocations[
          Math.floor(Math.random() * shutdownCodeLocations.length)
        ];
      const failures = [
        ...(Math.random() < 0.045 ? ["CT-01"] : []),
        ...(Math.random() < 0.045 ? ["CT-03"] : []),
      ];
      setShutdownCode(code);
      setShutdownCodeLocation(location);
      setShutdownCodeRevealed(false);
      setCatalyzerFailures(failures);
      setShutdownButtonMissing(Math.random() < 0.003);
      setFaasCodeGuesses(0);
      setMeltdownStage("PHASE_1_WINDOW");
      playFaas(
        [
          faasClips.phase1Window,
          faasClips.shutdownAttemptWarning,
          faasClips.phase1TemperatureRequirement,
        ],
        0,
      );
      addLog(
        "Phase 1 Combustion Stall Protocol window opened for 2:30. Locate the altered sticky note.",
      );
      return;
    }
    if (
      meltdownStage === "PHASE_1_WINDOW" &&
      meltdownSeconds >= 442 &&
      !flags.phase1Deadline
    ) {
      flags.phase1Deadline = true;
      playFaas(faasClips.phase1Deadline, 0);
      addLog("FAAS: Phase 1 shutdown window closes in five seconds.");
    }
    if (
      meltdownSeconds >= 463 &&
      (meltdownStage === "ACTIVE" || meltdownStage === "PHASE_1_WINDOW")
    ) {
      setMeltdownStage("CODE_BLACK");
      setCodeBlackStartedAt(meltdownSeconds);
      playFaas(faasClips.codeBlack, 0);
      playFaas(faasClips.phase1Expired, 0);
      playEffect(qserfEffects.codeBlack, 0);
      addLog("CODE BLACK declared. Phase 1 shutdown has expired.");
      return;
    }
    if (
      meltdownStage === "CODE_BLACK" &&
      codeBlackStartedAt !== null &&
      meltdownSeconds - codeBlackStartedAt >= 31
    ) {
      const available =
        phase1Attempted ||
        Math.random() <
          (catalyzerFailures.length || shutdownButtonMissing ? 0.75 : 0.25);
      setPhase2Available(available);
      // A player-initiated P1 failure should always expose the P2 procedure so
      // its controls can be learned and completed. Natural meltdowns retain
      // the source-inspired availability chance.
      if (available && !phase1Attempted && Math.random() < 0.12) {
        setPhase2HatchState("EXPLODED");
        setPhase2Available(false);
        setMeltdownStage("EVACUATION");
        playFaas(
          [faasClips.phase2Unavailable, faasClips.emergencyEvacuate],
          0,
        );
        addLog("Phase 2 chamber hatch exploded. Blast shelters are opening.");
        return;
      }
      setPhase2HatchState(available ? "UNLOCKED" : "SEALED");
      setMeltdownStage(available ? "PHASE_2_WINDOW" : "EVACUATION");
      playFaas(
        available
          ? faasClips.phase2Available
          : [faasClips.phase2Unavailable, faasClips.emergencyEvacuate],
        0,
      );
      addLog(
        available
          ? "Phase 2 available: open the chamber hatch, then unlock all three fuel cells within 3 seconds."
          : "Phase 2 unavailable. Blast shelters are opening; evacuate immediately.",
      );
      return;
    }
    if (
      meltdownSeconds >= codeBlackClock + 67 &&
      !flags.shelterAvailable
    ) {
      flags.shelterAvailable = true;
      playFaas([faasClips.seekShelter, faasClips.nearestShelter], 0);
      addLog("FAAS: Shelter and Tartarus Zone evacuation routes are available.");
    }
    if (meltdownSeconds >= codeBlackClock + 67 && !flags.codeOmni) {
      flags.codeOmni = true;
      setMeltdownStage("CODE_OMNI");
      playFaas(faasClips.codeOmni, 0);
      addLog("CODE OMNI issued. All monitoring systems unavailable.");
      return;
    }
    if (meltdownSeconds >= reactorExplosionAt - 60 && !flags.shelterMinute) {
      flags.shelterMinute = true;
      playFaas(faasClips.blastShelterMinute, 0);
      addLog("FAAS: Blast shelters close in one minute.");
    }
    if (meltdownSeconds >= reactorExplosionAt - 30 && !flags.shelterThirty) {
      flags.shelterThirty = true;
      playFaas(faasClips.blastShelterThirty, 0);
      addLog("FAAS: Blast shelters close in 30 seconds.");
    }
    if (meltdownSeconds >= reactorExplosionAt - 10 && !flags.shelterTen) {
      flags.shelterTen = true;
      playFaas(faasClips.blastShelterTen, 0);
      addLog("FAAS: Blast shelters close in 10 seconds.");
    }
    if (meltdownSeconds >= reactorExplosionAt - 1 && !flags.doorsClosing) {
      flags.doorsClosing = true;
      playFaas(faasClips.blastDoorsClosing, 0);
    }
    if (
      meltdownSeconds >= codeBlackClock + 197 &&
      meltdownStage !== "BLACK_HOLE"
    ) {
      setMeltdownStage("BLACK_HOLE");
      playFaas(faasClips.meltdownEvacuate, 0);
      addLog("Blast doors sealed. DMR implosion has formed a black hole.");
      return;
    }
    const reactorExplosionDue = p2MusicHasStarted
      ? p2MusicComplete
      : meltdownSeconds >= reactorExplosionAt;
    if (reactorExplosionDue && meltdownStage !== "TERMINAL") {
      setMeltdownStage("TERMINAL");
      // All live buses are silenced before aftermath playback: the ending
      // video itself is the sole audible source from the moment of explosion.
      stopFaas();
      stopSoundscape();
      setEnding(
        evacuationLocation === "BLAST_SHELTER"
          ? "goodBlastShelter"
          : evacuationLocation === "TARTARUS_ZONE" && tartarusSealLockedInTime
            ? "tartarusZone"
            : "emergencyDeath",
      );
      addLog(
        evacuationLocation === "BLAST_SHELTER"
          ? "Blast shelter sealed. Shelter aftermath projected."
          : evacuationLocation === "TARTARUS_ZONE" && tartarusSealLockedInTime
            ? "Tartarus Zone seal held. Tartarus aftermath projected."
            : "DMR black hole collapsed. Unsheltered facility aftermath projected.",
      );
    }
  }, [
    codeBlackStartedAt,
    ending,
    meltdownInProgress,
    meltdownSeconds,
    meltdownStage,
    playEffect,
    playFaas,
    setMusicEnabled,
    stopFaas,
    stopSoundscape,
    evacuationLocation,
    tartarusSealLockedInTime,
    p2MusicHasStarted,
    p2MusicComplete,
  ]);

  const togglePump = (index: number) =>
    setPumps((old) =>
      old.map((pump, current) =>
        current === index && !pump.enabled ? { ...pump, enabled: true } : pump,
      ),
    );
  const revealShutdownCode = () => {
    if (!shutdownCode || !shutdownCodeLocation) return;
    setShutdownCodeRevealed(true);
    addLog(
      `Sticky note located at ${shutdownCodeLocation}; shutdown code broadcast to the control room.`,
    );
  };
  const declareCodeBlack = (reason: string) => {
    if (!meltdownInProgress) return;
    setMeltdownStage("CODE_BLACK");
    setCodeBlackStartedAt(meltdownSeconds);
    playFaas(faasClips.codeBlack, 0);
    playFaas(faasClips.phase1Expired, 0);
    playEffect(qserfEffects.codeBlack, 0);
    addLog(reason);
  };
  const enterBlastShelter = () => {
    if (!evacuationAvailable) return;
    setEvacuationLocation("BLAST_SHELTER");
    setTartarusSealLockedAt(null);
    addLog("Operator entered a blast shelter. Awaiting reactor-explosion outcome.");
  };
  const travelToTartarus = () => {
    if (!evacuationAvailable) return;
    setEvacuationLocation("TARTARUS_ZONE");
    setTartarusSealLockedAt(null);
    playFaas(faasClips.tartarusZone, 0);
    addLog("Operator arrived in Tartarus Zone. Lock the seal before T−20 seconds.");
  };
  const lockTartarusSeal = () => {
    if (
      evacuationLocation !== "TARTARUS_ZONE" ||
      tartarusSealLockedAt !== null ||
      meltdownSeconds > tartarusSealDeadline
    )
      return;
    setTartarusSealLockedAt(meltdownSeconds);
    addLog("Tartarus Zone seal locked in time for reactor explosion.");
  };
  const attemptPhase1Shutdown = () => {
    if (
      !phase1WindowOpen ||
      phase1Attempted ||
      phase1Executing ||
      shutdownButtonMissing
    )
      return;
    setPhase1Attempted(true);
    const authorized =
      shutdownCode !== null &&
      shutdownCodeEntry === shutdownCode &&
      phase1Keys.every(Boolean);
    if (!authorized || !phase1Permissives) {
      declareCodeBlack(
        "Phase 1 shutdown failed. CODE BLACK declared; prepare for Phase 2.",
      );
      return;
    }
    setPhase1Executing(true);
    addLog("Phase 1 accepted. Combustion Stall Protocol is processing.");
    const failureDuringPause = Math.random() < 0.035;
    if (failureDuringPause) {
      setCatalyzerFailures((old) =>
        old.length ? old : [Math.random() < 0.5 ? "CT-01" : "CT-03"],
      );
    }
    phase1ExecutionTimer.current = window.setTimeout(() => {
      phase1ExecutionTimer.current = null;
      setPhase1Executing(false);
      if (failureDuringPause || !catalyzersIntact) {
        declareCodeBlack(
          "Catalyzer failure detected during the Phase 1 pause. CODE BLACK declared.",
        );
        return;
      }
      setGlobalCatalyzerLevel(0);
      setFineCatalyzerLevels([0, 0, 0, 0, 0, 0]);
      setEfssActive(true);
      setMeltdownStage("RECOVERED");
      setStartupPhase("IDLE");
      setTemperature((value) => Math.min(value, 295));
      setIntegrity((value) => Math.max(value, 65));
      if (musicEnabled) setMusicKey("shutdown");
      playFaas(faasClips.shutdownSucceeded, 0);
      addLog(
        "Phase 1 Combustion Stall successful. DMR lowered for maintenance.",
      );
    }, 2500);
  };
  const openPhase2Hatch = () => {
    if (!phase2WindowOpen || phase2HatchState !== "UNLOCKED") return;
    setPhase2HatchState("OPEN");
    addLog("Phase 2 chamber hatch opened. Stand clear of fuel-cell ejection.");
  };
  const unlockPhase2Fuel = (index: number) => {
    if (!phase2WindowOpen || phase2HatchState !== "OPEN" || !fuelLocks[index])
      return;
    const now = Date.now();
    const nextTimes = phase2UnlockTimes.map((time, current) =>
      current === index ? now : time,
    );
    const unlocked = nextTimes.filter((time): time is number => time !== null);
    setPhase2UnlockTimes(nextTimes);
    setFuelLocks((old) =>
      old.map((locked, current) => (current === index ? false : locked)),
    );
    if (unlocked.length > 1 && now - Math.min(...unlocked) > 3000) {
      setMeltdownStage("EVACUATION");
      setPhase2Available(false);
      playFaas(
        [faasClips.phase2Unavailable, faasClips.emergencyEvacuate],
        0,
      );
      addLog("Phase 2 fuel unlock timing failed. Blast shelters opening.");
      return;
    }
    if (unlocked.length !== 3) return;
    setFuelInserted([false, false, false]);
    setFuel([0, 0, 0]);
    setMeltdownStage("RECOVERED");
    setStartupPhase("IDLE");
    setTemperature(295);
    setIntegrity((value) => Math.max(value, 45));
    if (musicEnabled) setMusicKey("shutdown");
    playFaas(
      [faasClips.phase2ShutdownInProgress, faasClips.phase2Lowering, faasClips.shutdownSucceeded],
      0,
    );
    addLog(
      "Manual combustion stall successful. Phase 2 aftermath will project in 10 seconds.",
    );
    // Preserve a short recovery beat, then silence every live audio bus so
    // the ending recording is the only sound while it is on screen.
    phase2EndingTimer.current = window.setTimeout(() => {
      phase2EndingTimer.current = null;
      stopFaas();
      stopSoundscape();
      setEnding("phase2Shutdown");
    }, 10_000);
  };
  const start = () => {
    if (!startupReady) return;
    setStartupPhase("EVACUATION");
    if (musicEnabled) setMusicKey("startup");
    playEffect(qserfEffects.startupAlarm, 0);
    playFaas(Math.random() < 0.5 ? faasClips.startupA : faasClips.startupB, 0);
    addLog(
      "FAAS: Startup alarm active. Personnel have 20 seconds to exit the DMR internal structure.",
    );
  };
  const primeWarhead = (actor: WarheadActor) => {
    if (warheadStage !== "DORMANT" && warheadStage !== "CANCELLED") return;
    setWarheadActor(actor);
    setWarheadKeys([false, false]);
    setWarheadKeysTurned([false, false]);
    setRaiderFloppyHeld(false);
    setRaiderFloppyEscaped(false);
    setWarheadTartarusSealed(false);
    setWarheadLocation("BOTTOMSIDE");
    warheadCountdownDeadline.current = null;
    warheadCountdownCalls.current = { t60: false, final: false };
    // Activation/priming is PA-only. The warhead score begins only after
    // final detonation authorization has actually entered the countdown.
    // Priming itself is a direct operator action, so arm the PA bus here.
    // useFaasAudio accepts the transmission immediately in the same gesture.
    if (!faasEnabled) setFaasEnabled(true);
    if (actor === "ADMINISTRATOR") {
      setWarheadStage("ARM_READY");
      playFaas(
        [faasClips.protocolSaletumActivated, faasClips.warheadPrimed],
        0,
      );
      addLog("Administrator authorization accepted. Warhead ARM control is ready.");
    } else {
      setWarheadStage("RAIDER_HACK");
      playFaas(faasClips.protocolSaletumActivated, 0);
      addLog("Raider Chip inserted. Hacking confirmation reader for 17 seconds.");
    }
  };
  const armWarhead = () => {
    if (warheadStage !== "ARM_READY") return;
    setWarheadStage("KEYS");
    addLog("Warhead armed. Retrieve, insert, and turn both detonation keys.");
  };
  const authorizeWarhead = () => {
    if (warheadStage !== "VERIFY" || !warheadActor) return;
    setWarheadStage("COUNTDOWN");
    setWarheadSeconds(200);
    warheadCountdownDeadline.current = Date.now() + 200_000;
    warheadCountdownCalls.current = { t60: false, final: false };
    if (musicEnabled) setMusicKey("warhead");
    playFaas([faasClips.warheadDetonationAuthorized, faasClips.warheadTimer200], 0);
    addLog("Warhead detonation authorized. Facility destruction in T−200 seconds.");
  };
  const cancelWarhead = () => {
    if (warheadStage !== "RAIDER_HACK" && warheadStage !== "PRIMING") return;
    setWarheadStage("CANCELLED");
    setWarheadActor(null);
    warheadCountdownDeadline.current = null;
    if (musicEnabled) setMusicKey(null);
    playFaas(faasClips.warheadCancelled, 0);
    addLog("Warhead priming cancelled. Protocol Saletum returned to downtime.");
  };
  const refuel = (index: number) => {
    if (
      !maintenance ||
      fuelLocks[index] ||
      fuelInserted[index] ||
      !selectedFuelType
    )
      return;
    setFuel((old) =>
      old.map((value, current) => (current === index ? 100 : value)),
    );
    setFuelTypes((old) =>
      old.map((type, current) => (current === index ? selectedFuelType : type)),
    );
    setFuelInserted((old) =>
      old.map((inserted, current) => current === index || inserted),
    );
    addLog(`${selectedFuelType} Fuel Cell inserted into Cell ${index + 1}.`);
  };
  const ejectFuel = (index: number) => {
    if (!maintenance || fuelLocks[index] || !fuelInserted[index]) return;
    setFuelInserted((old) =>
      old.map((inserted, current) => (current === index ? false : inserted)),
    );
    setFuel((old) =>
      old.map((value, current) => (current === index ? 0 : value)),
    );
    addLog(`Fuel Cell ${index + 1} ejected. Slot is empty.`);
  };
  const reset = () => {
    setGridSource("EXTERNAL");
    setMaintenance(false);
    setFuel([100, 100, 100]);
    setFuelTypes(["NORMAL", "NORMAL", "NORMAL"]);
    setFuelInserted([true, true, true]);
    setSelectedFuelType(null);
    setFuelLocks([false, false, false]);
    setPumps(freshPumps());
    setCatalyzerFeedLatched(false);
    setCatalyzerMode("GLOBAL");
    setGlobalCatalyzerLevel(2);
    setFineCatalyzerLevels([2, 2, 2, 2, 2, 2]);
    setCatalyzerCooling(2);
    setSuperstructureCooling(2);
    setInternalPumps([true, true]);
    setRegenerators([true, true]);
    setCoolantOutlets([true, true]);
    setReliefValves([false, false, false, false]);
    setEfssWater(100);
    setEfssActive(false);
    setIgnitionKey(false);
    setStartupPhase("IDLE");
    setTemperature(295);
    setIntegrity(100);
    setRadioactivity(0);
    setMaintenanceButton(false);
    setActiveQserfTab("DMR");
    setWarheadStage("DORMANT");
    setWarheadActor(null);
    setWarheadSeconds(0);
    setWarheadKeys([false, false]);
    setWarheadKeysTurned([false, false]);
    setWarheadLocation("BOTTOMSIDE");
    setWarheadTartarusSealed(false);
    setRaiderFloppyHeld(false);
    setRaiderFloppyEscaped(false);
    setCombustionStallState("NORMAL");
    setPrimaryGridBlackout(false);
    setCombustionStallFuelPenaltyPending(false);
    setEnding(null);
    setMeltdownStage("NORMAL");
    setMeltdownSeconds(0);
    setCodeBlackStartedAt(null);
    setPhase2Available(null);
    setPhase2UnlockTimes([null, null, null]);
    setShutdownCode(null);
    setShutdownCodeLocation(null);
    setShutdownCodeEntry("");
    setShutdownCodeRevealed(false);
    setPhase1Keys([false, false]);
    setPhase1Attempted(false);
    setPhase1Executing(false);
    setCatalyzerFailures([]);
    setShutdownButtonMissing(false);
    setFaasCodeGuesses(0);
    setPhase2HatchState("SEALED");
    setEvacuationLocation("CONTROL_ROOM");
    setTartarusSealLockedAt(null);
    if (phase1ExecutionTimer.current !== null) {
      window.clearTimeout(phase1ExecutionTimer.current);
      phase1ExecutionTimer.current = null;
    }
    if (phase2HatchTimer.current !== null) {
      window.clearTimeout(phase2HatchTimer.current);
      phase2HatchTimer.current = null;
    }
    if (phase2EndingTimer.current !== null) {
      window.clearTimeout(phase2EndingTimer.current);
      phase2EndingTimer.current = null;
    }
    if (combustionStallTimer.current !== null) {
      window.clearTimeout(combustionStallTimer.current);
      combustionStallTimer.current = null;
    }
    if (warheadStageTimer.current !== null) {
      window.clearTimeout(warheadStageTimer.current);
      warheadStageTimer.current = null;
    }
    warheadCountdownDeadline.current = null;
    warheadCountdownCalls.current = { t60: false, final: false };
    setAcknowledgedAlarmIds([]);
    setAlarmsMuted(false);
    meltdownMilestones.current = {
      monitorFailure: false,
      evacuation: false,
      codeRed: false,
      codeOmni: false,
      phase1Deadline: false,
      phase1Expired: false,
      shelterMinute: false,
      shelterAvailable: false,
      shelterThirty: false,
      shelterTen: false,
      doorsClosing: false,
    };
    stopSoundscape();
    setLog(["FAAS: DMR-01 standing by."]);
  };
  const reactorOutput = online
    ? Math.max(0, (temperature - 300) * 0.025 + runningPumps * 1.3)
    : 0;
  const logTone = useMemo(
    () =>
      status.includes("MELTDOWN")
        ? "text-red-300"
        : status === "OPERATING"
          ? "text-emerald-300"
          : "text-amber-300",
    [status],
  );

  return (
    <main
      className="min-h-screen p-4 font-mono text-slate-100 transition-[background] duration-1000 md:p-7"
      style={{ background: sceneBackground }}
    >
      <header className="mx-auto mb-5 flex max-w-7xl flex-wrap items-end justify-between gap-4 border-b border-violet-400/35 pb-5">
        <div>
          <p className="text-xs font-black tracking-[.3em] text-violet-300">
            REACTOR GAME ARCHIVE // QSERF
          </p>
          <h1 className="mt-1 text-3xl font-black">Dark Matter Reactor 01</h1>
          <p className="mt-1 text-sm text-slate-400">
            QS Energy Research Facility — Control Station 11 reconstruction.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeQserfTab === "DMR" ? "default" : "outline"}
            onClick={() => setActiveQserfTab("DMR")}
          >
            DMR CONTROL
          </Button>
          <Button
            variant={activeQserfTab === "WARHEAD" ? "destructive" : "outline"}
            onClick={() => setActiveQserfTab("WARHEAD")}
          >
            PROTOCOL SALETUM
          </Button>
          <Button variant="outline" onClick={reset}>
            RESET DMR
          </Button>
          <Button asChild>
            <Link to="/archive">ARCHIVE</Link>
          </Button>
        </div>
      </header>
      <section className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Meter
          label="DMR TEMPERATURE"
          value={monitoringLost ? "NO DATA" : temperature.toFixed(0)}
          unit={monitoringLost ? undefined : "K"}
          tone={temperature > 3500 ? "text-red-400" : "text-cyan-200"}
        />
        <Meter
          label="STRUCTURAL INTEGRITY"
          value={
            meltdownInProgress && meltdownSeconds >= 120
              ? "Err"
              : integrity.toFixed(1)
          }
          unit={meltdownInProgress && meltdownSeconds >= 120 ? undefined : "%"}
          tone={integrity < 20 ? "text-red-400" : "text-emerald-300"}
        />
        <Meter
          label="CHAMBER RADIOACTIVITY"
          value={monitoringLost ? "NO DATA" : radioactivity.toFixed(1)}
          unit={monitoringLost ? undefined : "%"}
          tone={radioactivity > 60 ? "text-amber-300" : "text-slate-200"}
        />
        <Meter
          label="GRID OUTPUT"
          value={monitoringLost ? "NO DATA" : reactorOutput.toFixed(1)}
          unit={monitoringLost ? undefined : "GW/h"}
          tone="text-violet-300"
        />
        <Meter label="DMR STATUS" value={status} tone={logTone} />
      </section>
      <section className="mx-auto mt-4 max-w-7xl overflow-hidden rounded border border-red-400/35 bg-black/35">
        <div className="relative flex min-h-24 items-center justify-center overflow-hidden px-4 py-5 text-center">
          <div
            className={`absolute h-20 w-20 rounded-full border transition-all duration-1000 ${
              sceneState === "BLACK HOLE"
                ? "scale-150 border-orange-400 bg-black shadow-[0_0_48px_22px_rgba(249,115,22,.58)]"
                : sceneState.includes("GLOW")
                  ? "border-orange-300 bg-orange-500/65 shadow-[0_0_46px_20px_rgba(249,115,22,.55)] animate-pulse"
                  : sceneState === "CODE RED"
                    ? "border-red-300 bg-red-600/45 shadow-[0_0_36px_14px_rgba(239,68,68,.4)]"
                    : "border-cyan-300/60 bg-cyan-500/15 shadow-[0_0_22px_6px_rgba(34,211,238,.15)]"
            }`}
          />
          <div className="relative z-10 rounded bg-black/50 px-5 py-2">
            <p className="text-[10px] font-black tracking-[.25em] text-slate-300">
              DMR CHAMBER OPTICAL STATUS
            </p>
            <p
              className={`mt-1 text-sm font-black tracking-[.18em] ${
                sceneState === "NOMINAL" ? "text-cyan-200" : "text-red-200"
              }`}
            >
              {sceneState}
            </p>
          </div>
        </div>
      </section>
      <section
        aria-disabled={controlsUnavailable}
        className={`mx-auto mt-5 grid max-w-7xl gap-5 xl:grid-cols-[1.25fr_.75fr] ${
          controlsUnavailable
            ? "pointer-events-none opacity-45 saturate-50"
            : ""
        } ${
          activeQserfTab === "DMR" ? "" : "hidden"
        }`}
      >
        <div className="space-y-5">
          <Card className="border-red-500/40 bg-slate-950/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-200">
                <KeyRound className="h-5 w-5" /> DMR STARTUP / IGNITION PANEL
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded border border-slate-700 bg-black/35 p-3 text-xs leading-5 text-slate-400">
                <p className="font-black tracking-wider text-slate-200">
                  STARTUP PERMISSIVES
                </p>
                <p
                  className={
                    fuelInserted.every(Boolean) && fuelLocks.every(Boolean)
                      ? "text-emerald-300"
                      : "text-red-300"
                  }
                >
                  FUEL CELLS:{" "}
                  {fuelInserted.every(Boolean) && fuelLocks.every(Boolean)
                    ? "LOCKED"
                    : "NOT READY"}
                </p>
                <p
                  className={
                    catalyzerFeedLatched ? "text-emerald-300" : "text-red-300"
                  }
                >
                  CATALYZER FEED: {catalyzerFeedLatched ? "ONLINE" : "OFFLINE"}
                </p>
                <p className={gridOnline ? "text-emerald-300" : "text-red-300"}>
                  GRID: {gridOnline ? "AVAILABLE" : "UNAVAILABLE"}
                </p>
              </div>
              <div className="rounded border border-slate-700 bg-black/35 p-3">
                <p className="text-xs font-black tracking-wider text-slate-400">
                  IGNITION KEY
                </p>
                <Button
                  className="mt-3 w-full"
                  variant={ignitionKey ? "default" : "outline"}
                  disabled={!gridOnline || online}
                  onClick={() => setIgnitionKey((value) => !value)}
                >
                  {ignitionKey ? "KEY TURNED" : "INSERT / TURN KEY"}
                </Button>
                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                  The key authorizes the red ignition button only after the
                  maintenance and operations teams have cleared the DMR.
                </p>
              </div>
              <div className="rounded border border-red-400/30 bg-black/35 p-3">
                <p className="text-xs font-black tracking-wider text-red-200">
                  IGNITION BUTTON
                </p>
                <Button
                  className="mt-3 w-full bg-red-500 text-white hover:bg-red-400"
                  disabled={!startupReady || startupPhase !== "IDLE"}
                  onClick={start}
                >
                  START DARK MATTER REACTOR
                </Button>
                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                  {startupReady
                    ? "All startup interlocks cleared."
                    : "Awaiting locked fuel, latched feed, an available grid, and turned ignition key."}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-violet-400/30 bg-slate-900/75">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-violet-200">
                <KeyRound className="h-5 w-5" /> PRIMARY CONTROL DESK
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded border border-slate-700 bg-black/30 p-4">
                <p className="text-xs font-black tracking-wider text-slate-400">
                  GRID AND MAINTENANCE
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(
                    [
                      "PRIMARY",
                      "AUXILIARY",
                      "EXTERNAL",
                      "FOXTROT-9",
                    ] as GridSource[]
                  ).map((source) => (
                    <Button
                      key={source}
                      size="sm"
                      variant={gridSource === source ? "default" : "outline"}
                      disabled={online && source !== "PRIMARY"}
                      onClick={() => setGridSource(source)}
                    >
                      {source}
                    </Button>
                  ))}
                </div>
                <p
                  className={`mt-2 text-xs font-black ${gridOnline ? "text-emerald-300" : "text-red-300"}`}
                >
                  {gridOnline
                    ? `${gridSource} GRID AVAILABLE`
                    : primaryGridBlackout
                      ? "PRIMARY BLACKOUT — SELECT AUXILIARY"
                    : "FOXTROT-9 NOT SYNCHRONIZED"}
                </p>
                <Button
                  className="mt-2 w-full"
                  variant={maintenance ? "default" : "outline"}
                  disabled={online}
                  onClick={() => {
                    const entering = !maintenance;
                    setMaintenance(entering);
                    setMaintenanceButton(true);
                    if (musicEnabled) {
                      setMusicKey(entering ? "maintenance" : null);
                    }
                    playFaas(
                      entering
                        ? faasClips.maintenanceEntered
                        : faasClips.maintenanceComplete,
                      0,
                    );
                    addLog(
                      entering
                        ? "FAAS: Maintenance mode entered. Fuel-cell service enabled."
                        : "FAAS: Maintenance complete. Returning to normal operations.",
                    );
                  }}
                >
                  {maintenance
                    ? "EXIT MAINTENANCE MODE"
                    : "ENTER MAINTENANCE MODE"}
                </Button>
                <p className="mt-3 text-xs leading-5 text-slate-400">
                  Primary is turbine-backed DMR supply; Auxiliary is generator
                  supply; External is startup supply; Foxtrot-9 is available
                  only after its test-bed reactor is synchronized.
                </p>
                <Button asChild className="mt-3 w-full" variant="outline">
                  <Link to="/qserf/foxtrot-9">
                    OPEN PROJECT HELIOS / FOXTROT-9
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border-cyan-400/30 bg-slate-900/75">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-200">
                <Activity className="h-5 w-5" /> PUMP STATION ALPHA — CATALYZER
                FEEDWATER ({runningPumps}/6 ONLINE)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pumps.map((pump, index) => (
                <div
                  className="rounded border border-slate-700 bg-black/35 p-3"
                  key={index}
                >
                  <p className="text-xs font-black text-cyan-200">
                    PUMP TRAIN {index + 1}{" "}
                    <span
                      className={
                        pump.enabled ? "text-emerald-300" : "text-slate-500"
                      }
                    >
                      {pump.enabled ? "ONLINE" : "OFFLINE"}
                    </span>
                  </p>
                  <div className="mt-2">
                    <Button
                      className="w-full"
                      variant={pump.enabled ? "default" : "outline"}
                      disabled={online || catalyzerFeedLatched || pump.enabled}
                      onClick={() => togglePump(index)}
                    >
                      {pump.enabled ? "PUMP STARTED — LATCHED" : "START PUMP"}
                    </Button>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">
                    A single pump command. Catalyzer feed becomes available only
                    when all six pumps are online.
                  </p>
                </div>
              ))}
            </CardContent>
            <CardContent className="pt-0 text-xs leading-5 text-slate-400">
              {catalyzerFeedLatched
                ? "CATALYZER FEED ONLINE — permanently latched after all six pumps were started."
                : `${runningPumps}/6 pump trains started. Feed latches automatically when the sixth pump starts.`}
            </CardContent>
          </Card>
          <Card className="border-violet-400/30 bg-slate-900/75">
            <CardHeader>
              <CardTitle className="text-violet-200">
                GRID MANAGEMENT DESK — CATALYZER CONTROL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={catalyzerMode === "GLOBAL" ? "default" : "outline"}
                  disabled={!catalyzerFeedLatched}
                  onClick={() => setCatalyzerMode("GLOBAL")}
                >
                  GLOBAL MODE
                </Button>
                <Button
                  size="sm"
                  variant={catalyzerMode === "FINE" ? "default" : "outline"}
                  disabled={!catalyzerFeedLatched}
                  onClick={() => setCatalyzerMode("FINE")}
                >
                  FINE MODE
                </Button>
                <span className="self-center text-xs text-slate-400">
                  EFFECTIVE INTENSITY: {catalyzerLevel.toFixed(1)} / 4
                </span>
              </div>
              {catalyzerMode === "GLOBAL" ? (
                <div className="grid grid-cols-5 gap-2">
                  {[0, 1, 2, 3, 4].map((level) => (
                    <Button
                      key={level}
                      variant={
                        globalCatalyzerLevel === level ? "default" : "outline"
                      }
                      disabled={!catalyzerFeedLatched}
                      onClick={() => setGlobalCatalyzerLevel(level)}
                    >
                      LEVEL {level}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {fineCatalyzerLevels.map((level, index) => (
                    <div
                      className="flex items-center justify-between rounded border border-slate-700 bg-black/30 p-2"
                      key={index}
                    >
                      <span className="text-xs">
                        CATALYZER {index + 1}: {level}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          disabled={!catalyzerFeedLatched}
                          onClick={() =>
                            setFineCatalyzerLevels((old) =>
                              old.map((value, current) =>
                                current === index
                                  ? Math.max(0, value - 1)
                                  : value,
                              ),
                            )
                          }
                        >
                          −
                        </Button>
                        <Button
                          size="sm"
                          disabled={!catalyzerFeedLatched}
                          onClick={() =>
                            setFineCatalyzerLevels((old) =>
                              old.map((value, current) =>
                                current === index
                                  ? Math.min(4, value + 1)
                                  : value,
                              ),
                            )
                          }
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] leading-5 text-slate-400">
                Higher intensity withdraws catalyzer rods, increasing DMR heat.
                Use Global for broad movement or Fine to balance individual
                catalyzers.
              </p>
            </CardContent>
          </Card>
          <Card className="border-cyan-400/30 bg-slate-900/75">
            <CardHeader>
              <CardTitle className="text-cyan-200">
                THERMAL REGULATION DESK
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-black text-slate-300">
                  CATALYZER CIRCULATION — {catalyzerCooling * 25}%
                </p>
                <div className="mt-2 grid grid-cols-5 gap-1">
                  {[0, 1, 2, 3, 4].map((level) => (
                    <Button
                      size="sm"
                      key={level}
                      variant={
                        catalyzerCooling === level ? "default" : "outline"
                      }
                      onClick={() => setCatalyzerCooling(level)}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Feedwater cooling changes catalyzer efficiency and their heat
                  contribution.
                </p>
              </div>
              <div>
                <p className="text-xs font-black text-slate-300">
                  SUPERSTRUCTURE FLOW — {superstructureCooling * 25}%
                </p>
                <div className="mt-2 grid grid-cols-5 gap-1">
                  {[0, 1, 2, 3, 4].map((level) => (
                    <Button
                      size="sm"
                      key={level}
                      variant={
                        superstructureCooling === level ? "default" : "outline"
                      }
                      onClick={() => setSuperstructureCooling(level)}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Requires an aligned internal pump, regenerator, and outlet
                  network.
                </p>
              </div>
              <div className="md:col-span-2 grid gap-2 sm:grid-cols-2">
                {internalPumps.map((pump, index) => (
                  <div
                    className="rounded border border-slate-700 bg-black/30 p-3"
                    key={index}
                  >
                    <p className="text-xs font-black">
                      INTERNAL COOLING NETWORK {index + 1}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      <Button
                        size="sm"
                        variant={pump ? "default" : "outline"}
                        onClick={() =>
                          setInternalPumps((old) =>
                            old.map((value, current) =>
                              current === index ? !value : value,
                            ),
                          )
                        }
                      >
                        PUMP
                      </Button>
                      <Button
                        size="sm"
                        variant={regenerators[index] ? "default" : "outline"}
                        onClick={() =>
                          setRegenerators((old) =>
                            old.map((value, current) =>
                              current === index ? !value : value,
                            ),
                          )
                        }
                      >
                        REGEN
                      </Button>
                      <Button
                        size="sm"
                        variant={coolantOutlets[index] ? "default" : "outline"}
                        onClick={() =>
                          setCoolantOutlets((old) =>
                            old.map((value, current) =>
                              current === index ? !value : value,
                            ),
                          )
                        }
                      >
                        OUTLET
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-500/30 bg-slate-900/75">
            <CardHeader>
              <CardTitle className="text-red-200">
                PRESSURE RELIEF / EFSS
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">
                  Relief valves can be opened above 1200 K. They cool the DMR
                  but increase chamber radiation.
                </p>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {reliefValves.map((open, index) => (
                    <Button
                      key={index}
                      size="sm"
                      variant={open ? "destructive" : "outline"}
                      disabled={temperature < 1200}
                      onClick={() =>
                        setReliefValves((old) =>
                          old.map((value, current) =>
                            current === index ? !value : value,
                          ),
                        )
                      }
                    >
                      RV {index + 1}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-black text-slate-300">
                  EFSS WATER: {efssWater.toFixed(0)}%
                </p>
                <Button
                  className="mt-2 w-full"
                  variant={efssActive ? "default" : "outline"}
                  disabled={efssWater <= 0}
                  onClick={() => setEfssActive((value) => !value)}
                >
                  {efssActive ? "EFSS ACTIVE" : "ACTIVATE EFSS"}
                </Button>
                <p className="mt-2 text-[11px] text-slate-500">
                  Emergency suppression rapidly cools the DMR while consuming
                  the primary water tank.
                </p>
              </div>
            </CardContent>
          </Card>
          {(meltdownInProgress || meltdownStage === "RECOVERED") && (
            <Card className="border-red-500/60 bg-red-950/20">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-red-200">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" /> MELTDOWN / SHUTDOWN
                    CONTROL
                  </span>
                  <span className="text-sm text-amber-200">
                    T+{formatMeltdownTime(meltdownSeconds)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs leading-5 text-slate-300">
                <div className="grid gap-2 rounded border border-red-400/25 bg-black/30 p-3 md:grid-cols-2">
                  <p>
                    <span className="font-black text-slate-100">STAGE: </span>
                    {meltdownStage.replaceAll("_", " ")}
                  </p>
                  <p>
                    <span className="font-black text-slate-100">
                      INTEGRITY:{" "}
                    </span>
                    {meltdownSeconds >= 120
                      ? "Err%"
                      : `${integrity.toFixed(1)}%`}
                  </p>
                  <p>
                    PHASE 1:{" "}
                    {phase1WindowOpen
                      ? "WINDOW OPEN"
                      : phase1Attempted
                        ? "ATTEMPTED"
                        : "UNAVAILABLE"}
                  </p>
                  <p>
                    PHASE 2:{" "}
                    {phase2WindowOpen
                      ? "FUEL ACCESS OPEN"
                      : phase2Available === false
                        ? "UNAVAILABLE"
                        : "PENDING"}
                  </p>
                </div>
                {phase1WindowOpen && (
                  <div className="space-y-3 rounded border border-amber-400/35 bg-amber-950/15 p-3">
                    <p className="font-black tracking-wide text-amber-200">
                      PHASE 1 — COMBUSTION STALL PROTOCOL
                    </p>
                    <p className="text-slate-400">
                      Requires the correct shutdown code, both authorization
                      keys, core temperature below 3000 K, EFSS water above 60%,
                      and all catalyzers intact. FAAS is attempting 12 code
                      sequences per second; the sticky-note discovery broadcasts
                      the actual code to this desk.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={revealShutdownCode}
                      >
                        LOCATE CODE
                      </Button>
                      <p className="rounded border border-slate-700 bg-black/30 px-3 py-1.5 text-[11px] text-cyan-200">
                        {shutdownCodeRevealed &&
                        shutdownCodeLocation &&
                        shutdownCode
                          ? `${shutdownCodeLocation}: ${shutdownCode}`
                          : "Search a listed facility station for the current code."}
                      </p>
                      <input
                        aria-label="Phase 1 shutdown code"
                        className="min-w-0 rounded border border-slate-600 bg-black/40 px-2 text-center font-black tracking-[.18em] text-slate-100 outline-none focus:border-amber-300"
                        maxLength={6}
                        placeholder="CODE"
                        value={shutdownCodeEntry}
                        onChange={(event) =>
                          setShutdownCodeEntry(
                            event.target.value.replace(/\D/g, ""),
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {phase1Keys.map((turned, index) => (
                        <Button
                          key={index}
                          size="sm"
                          variant={turned ? "default" : "outline"}
                          onClick={() =>
                            setPhase1Keys((old) =>
                              old.map((value, current) =>
                                current === index ? !value : value,
                              ),
                            )
                          }
                        >
                          KEY {index + 1} {turned ? "TURNED" : "INSERT / TURN"}
                        </Button>
                      ))}
                      {shutdownButtonMissing ? (
                        <p className="rounded border border-red-500/45 bg-red-950/35 px-2 py-1 text-center text-[10px] font-black text-red-200">
                          SHUTDOWN BUTTON MISSING
                        </p>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={phase1Attempted || phase1Executing}
                          onClick={attemptPhase1Shutdown}
                        >
                          {phase1Executing
                            ? "PROCESSING..."
                            : "EXECUTE PHASE 1"}
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      FAAS CODE ATTEMPTS: {faasCodeGuesses.toLocaleString()} /
                      CT-01 &amp; CT-03:{" "}
                      {catalyzersIntact
                        ? "INTACT"
                        : catalyzerFailures.join(", ")}
                    </p>
                    <p
                      className={
                        phase1Permissives ? "text-emerald-300" : "text-red-300"
                      }
                    >
                      PERMISSIVES:{" "}
                      {phase1Permissives
                        ? "READY"
                        : "NOT READY — COOL / RESTORE EFSS / REPAIR CATALYZER"}
                    </p>
                  </div>
                )}
                {phase2WindowOpen && (
                  <div className="rounded border border-violet-400/45 bg-violet-950/20 p-3 text-violet-100">
                    <p className="font-black">PHASE 2 — MANUAL FUEL EJECTION</p>
                    <p className="mt-1 text-violet-200">
                      Radiation seal: clear. The chamber hatch is{" "}
                      {phase2HatchState.toLowerCase()}. Open it before accessing
                      the fuel-cell locks; all cells must be unlocked within
                      three seconds of each other.
                    </p>
                    <Button
                      className="mt-3"
                      size="sm"
                      variant={
                        phase2HatchState === "OPEN" ? "default" : "outline"
                      }
                      disabled={phase2HatchState !== "UNLOCKED"}
                      onClick={openPhase2Hatch}
                    >
                      {phase2HatchState === "OPEN"
                        ? "HATCH OPEN"
                        : "OPEN CHAMBER HATCH"}
                    </Button>
                  </div>
                )}
                {evacuationAvailable && meltdownStage !== "RECOVERED" && (
                  <div className="space-y-3 rounded border border-cyan-400/40 bg-cyan-950/15 p-3 text-cyan-50">
                    <p className="font-black tracking-wide">EVACUATION ROUTING</p>
                    <p className="text-cyan-100/80">
                      Choose an evacuation location before the reactor explosion.
                      Blast shelters provide a protected aftermath route. Tartarus
                      Zone requires its seal to be locked at least 20 seconds before
                      the explosion.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        size="sm"
                        variant={
                          evacuationLocation === "BLAST_SHELTER"
                            ? "default"
                            : "outline"
                        }
                        disabled={meltdownSeconds >= reactorExplosionAt}
                        onClick={enterBlastShelter}
                        tooltip="Moves the operator into a blast shelter for the reactor-explosion outcome. Shelter selection is independent of Phase 2 shutdown work."
                      >
                        {evacuationLocation === "BLAST_SHELTER"
                          ? "IN BLAST SHELTER"
                          : "ENTER BLAST SHELTER"}
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          evacuationLocation === "TARTARUS_ZONE"
                            ? "default"
                            : "outline"
                        }
                        disabled={meltdownSeconds >= reactorExplosionAt}
                        onClick={travelToTartarus}
                        tooltip="Moves the operator to Tartarus Zone. Its seal must then be locked at least 20 seconds before reactor explosion."
                      >
                        {evacuationLocation === "TARTARUS_ZONE"
                          ? "IN TARTARUS ZONE"
                          : "GO TO TARTARUS ZONE"}
                      </Button>
                    </div>
                    {evacuationLocation === "TARTARUS_ZONE" && (
                      <div className="flex flex-wrap items-center gap-2 rounded border border-cyan-300/30 bg-black/30 p-2">
                        <Button
                          size="sm"
                          variant={tartarusSealLockedInTime ? "default" : "destructive"}
                          disabled={
                            tartarusSealLockedAt !== null ||
                            meltdownSeconds > tartarusSealDeadline
                          }
                          onClick={lockTartarusSeal}
                          tooltip="Locks the Tartarus Zone seal. It must be locked no later than T−20 seconds to survive the reactor-explosion outcome."
                        >
                          {tartarusSealLockedAt !== null
                            ? tartarusSealLockedInTime
                              ? "SEAL LOCKED — IN TIME"
                              : "SEAL LOCKED — TOO LATE"
                            : "LOCK TARTARUS SEAL"}
                        </Button>
                        <span className="text-[10px] text-cyan-200">
                          {tartarusSealLockedInTime
                            ? "Tartarus seal is secured for the outcome."
                            : meltdownSeconds > tartarusSealDeadline
                              ? "Seal deadline missed; seek a blast shelter."
                              : `Seal deadline: T−20 (${Math.max(0, tartarusSealDeadline - meltdownSeconds)}s remaining).`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {(meltdownStage === "EVACUATION" ||
                  meltdownStage === "CODE_OMNI" ||
                  meltdownStage === "BLACK_HOLE") && (
                  <p className="rounded border border-red-500/30 bg-black/35 p-3 text-red-200">
                    {meltdownStage === "EVACUATION"
                      ? "Phase 2 is unavailable. Blast shelters are opening; evacuate immediately."
                      : meltdownStage === "CODE_OMNI"
                        ? "Code Omni declared. Monitoring has failed; evacuation remains the only option."
                        : "Blast doors sealed. The DMR has imploded into a black hole."}
                  </p>
                )}
                {meltdownStage === "RECOVERED" && (
                  <p className="rounded border border-emerald-400/35 bg-emerald-950/20 p-3 text-emerald-200">
                    Emergency shutdown successful. The DMR is held in
                    maintenance state.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        <aside className="space-y-5">
          <Card className="border-amber-400/35 bg-slate-900/75">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-200">
                <Lock className="h-5 w-5" /> FUEL CELL STATUS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded border border-amber-400/25 bg-black/30 p-3">
                <p className="text-[10px] font-black tracking-[.14em] text-amber-200">
                  FUEL CELL STORAGE — SELECT CELL FOR INSERTION
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["NORMAL", "EFFICIENT", "SUPER"] as FuelType[]).map(
                    (type) => (
                      <Button
                        key={type}
                        size="sm"
                        variant={
                          selectedFuelType === type ? "default" : "outline"
                        }
                        disabled={!maintenance}
                        onClick={() => setSelectedFuelType(type)}
                      >
                        {type}
                      </Button>
                    ),
                  )}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Selected: {selectedFuelType ?? "NONE"}. Selection alone does
                  not change an installed fuel cell.
                </p>
              </div>
              {fuel.map((value, index) => (
                <div
                  key={index}
                  className="rounded border border-slate-700 bg-black/35 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">
                      FUEL CELL {index + 1}
                    </span>
                    <span
                      className={`text-xs ${fuelProfiles[fuelTypes[index]].tone}`}
                    >
                      {fuelInserted[index]
                        ? `${fuelTypes[index]} / ${value.toFixed(1)}%`
                        : "EMPTY SLOT"}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded bg-slate-800">
                    <div
                      className="h-full bg-amber-300"
                      style={{ width: `${fuelInserted[index] ? value : 0}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button
                      size="sm"
                      variant={fuelLocks[index] ? "default" : "outline"}
                      disabled={
                        !fuelInserted[index] ||
                        (online && !phase2WindowOpen) ||
                        (phase2WindowOpen &&
                          (phase2HatchState !== "OPEN" || !fuelLocks[index]))
                      }
                      onClick={() => {
                        if (phase2WindowOpen) {
                          unlockPhase2Fuel(index);
                          return;
                        }
                        const unlock = fuelLocks[index];
                        setFuelLocks((old) =>
                          old.map((lock, current) =>
                            current === index ? !lock : lock,
                          ),
                        );
                        playFaas(
                          unlock
                            ? faasClips.fuelUnlocked[index]
                            : faasClips.fuelLocked[index],
                          0,
                        );
                      }}
                    >
                      {fuelLocks[index] ? (
                        <Lock className="mr-1 h-3 w-3" />
                      ) : (
                        <Unlock className="mr-1 h-3 w-3" />
                      )}
                      {phase2WindowOpen && fuelLocks[index]
                        ? "PHASE 2 UNLOCK"
                        : fuelLocks[index]
                          ? "LOCKED"
                          : "UNLOCKED"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        !maintenance || fuelLocks[index] || !fuelInserted[index]
                      }
                      onClick={() => ejectFuel(index)}
                    >
                      EJECT
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        !maintenance ||
                        fuelLocks[index] ||
                        fuelInserted[index] ||
                        !selectedFuelType
                      }
                      onClick={() => refuel(index)}
                    >
                      INSERT
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-[11px] leading-5 text-slate-400">
                Efficient cells heat/deplete slower; Super cells heat faster
                than Normal. In maintenance: unlock → eject → select stored cell
                → insert → lock.
              </p>
            </CardContent>
          </Card>
          <Card className="border-cyan-400/35 bg-slate-950/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-cyan-200">
                <Volume2 className="h-4 w-4" /> FAAS ANNOUNCEMENT NETWORK
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-5 text-slate-400">
              <p>
                {faasEnabled
                  ? faasCurrentClip
                    ? `TRANSMITTING: ${faasCurrentClip.toUpperCase()}`
                    : "AUDIO ARMED — STANDING BY"
                  : "AUDIO DISARMED — PRESS ENABLE TO AUTHORIZE BROWSER PLAYBACK"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={faasEnabled ? "default" : "outline"}
                  onClick={() => setFaasEnabled(true)}
                >
                  <Volume2 className="mr-1 h-3 w-3" /> ENABLE AUDIO
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!faasEnabled}
                  onClick={() => {
                    stopFaas();
                    stopSoundscape();
                    setFaasEnabled(false);
                  }}
                >
                  <VolumeX className="mr-1 h-3 w-3" /> MUTE / CLEAR
                </Button>
              </div>
              <div className="border-t border-slate-700 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black tracking-[.12em] text-amber-200">
                    ALARMS — {activeAlarms.length} ACTIVE /{" "}
                    {unacknowledgedAlarmCount} UNACK
                  </p>
                  <span
                    className={
                      alarmsMuted
                        ? "text-[10px] text-amber-300"
                        : "text-[10px] text-slate-500"
                    }
                  >
                    {alarmsMuted ? "SILENCED" : "AUDIBLE"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {activeAlarms.length ? (
                    activeAlarms.map((alarm) => {
                      const acknowledged = acknowledgedAlarmIds.includes(
                        alarm.id,
                      );
                      return (
                        <span
                          key={alarm.id}
                          className={`rounded border px-1.5 py-0.5 text-[9px] font-black ${
                            acknowledged
                              ? "border-amber-300/35 text-amber-200"
                              : "animate-pulse border-red-400/50 bg-red-950/40 text-red-200"
                          }`}
                        >
                          {alarm.label}
                          {acknowledged ? " / ACK" : ""}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-[10px] text-emerald-300">
                      ALL CLEAR
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!activeAlarms.length || !unacknowledgedAlarmCount}
                    onClick={() =>
                      setAcknowledgedAlarmIds(
                        activeAlarms.map((alarm) => alarm.id),
                      )
                    }
                  >
                    ACKNOWLEDGE
                  </Button>
                  <Button
                    size="sm"
                    variant={alarmsMuted ? "default" : "outline"}
                    onClick={() => setAlarmsMuted(!alarmsMuted)}
                  >
                    {alarmsMuted ? "UNMUTE ALARMS" : "MUTE ALARMS"}
                  </Button>
                </div>
              </div>
              <label className="block border-t border-slate-700 pt-3 text-[10px] font-black tracking-[.12em] text-cyan-200">
                FAAS VOLUME — {faasVolumePercent}% CONTROL /{" "}
                {(faasVolumePercent / 2).toFixed(0)}% OUTPUT
                <input
                  className="mt-2 w-full accent-cyan-300"
                  aria-label="FAAS announcement volume"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={faasVolumePercent}
                  onChange={(event) =>
                    setFaasVolumePercent(Number(event.target.value))
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!faasEnabled}
                  onClick={() => {
                    playRandomHumanCall();
                    setAmbientScheduleRevision((revision) => revision + 1);
                  }}
                >
                  TEST HUMAN CALL
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!faasEnabled}
                  onClick={() => playFaas(faasClips.emergencyEvacuate, 0)}
                >
                  TEST EVACUATION
                </Button>
              </div>
              <div className="border-t border-slate-700 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black tracking-[.12em] text-violet-200">
                    EVENT SOUNDTRACK BUS
                  </p>
                  <Button
                    size="sm"
                    variant={musicEnabled ? "default" : "outline"}
                    disabled={!faasEnabled}
                    onClick={() => {
                      if (musicEnabled) {
                        setMusicEnabled(false);
                        setMusicKey(null);
                      } else {
                        // Start the track for the event currently in progress;
                        // never revive an unrelated previous track.
                        setMusicKey(
                          codeBlackStartedAt !== null
                            ? "meltdownP2"
                            : meltdownInProgress
                              ? "meltdownP1"
                              : null,
                        );
                        setMusicEnabled(true);
                      }
                    }}
                  >
                    {musicEnabled ? "MUSIC ON" : "MUSIC OFF"}
                  </Button>
                </div>
                <label className="mt-3 block text-[10px] font-black tracking-[.12em] text-violet-200">
                  MUSIC VOLUME — {musicVolumePercent}% × 1.5 ={" "}
                  {Math.min(100, musicVolumePercent * 1.5).toFixed(0)}% OUTPUT
                  <input
                    className="mt-2 w-full accent-violet-300"
                    aria-label="QSERF music volume"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={musicVolumePercent}
                    onChange={(event) =>
                      setMusicVolumePercent(Number(event.target.value))
                    }
                  />
                </label>
                <p className="mt-2 text-[10px] text-slate-500">
                  {activeEffect
                    ? `EFFECT ACTIVE: ${activeEffect.toUpperCase()}`
                    : musicEnabled
                      ? "Music is armed. A matching event will select the next track."
                      : "Music, FAAS, and effects use independent volume levels."}
                </p>
              </div>
              <p className="text-[10px] text-slate-500">
                The system queues normal traffic, interrupts it only for higher
                priority emergency traffic, and does not automatically play
                whole folders.
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-950/80">
            <CardHeader>
              <CardTitle className="text-sm text-slate-200">
                FAAS CONTROL LOG
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs leading-5 text-slate-400">
                {log.map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>
              <div className="mt-4 rounded border border-red-400/25 bg-red-950/20 p-3 text-[11px] leading-5 text-red-200">
                <AlertTriangle className="mr-1 inline h-3 w-3" /> Above 3500 K
                with integrity below 10%, the DMR enters its meltdown sequence.
                The Phase 1 and Phase 2 shutdown procedures appear on the
                emergency panel when their timed windows open.
              </div>
            </CardContent>
          </Card>
          {maintenanceButton && (
            <p className="text-center text-[10px] tracking-widest text-slate-500">
              MAINTENANCE HANDLER AVAILABLE
            </p>
          )}
        </aside>
      </section>
      {activeQserfTab === "WARHEAD" && (
        <section className="mx-auto mt-5 max-w-7xl">
          <Card className="border-red-500/60 bg-[radial-gradient(circle_at_50%_0%,rgba(127,29,29,.32),transparent_46%),#09070a] shadow-[0_0_70px_rgba(220,38,38,.14)]">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-red-200">
                <span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> PROTOCOL SALETUM / WARHEAD CONTROL ROOM</span>
                <span className="rounded border border-red-400/35 bg-black/40 px-2 py-1 text-xs tracking-wider text-red-200">{warheadStage.replaceAll("_", " ")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-xs leading-5 text-slate-300">
              <div className="grid gap-3 rounded border border-red-400/25 bg-black/35 p-4 md:grid-cols-3">
                <p><span className="font-black text-slate-100">OPERATOR: </span>{operatorName}</p>
                <p><span className="font-black text-slate-100">ROLE: </span>{warheadActor || "SELECT ROLE"}</p>
                <p><span className="font-black text-slate-100">DETONATION: </span>{warheadStage === "COUNTDOWN" ? `T−${warheadSeconds}s` : "NOT ACTIVE"}</p>
              </div>

              {(warheadStage === "DORMANT" || warheadStage === "CANCELLED") && (
                <div className="rounded border border-amber-400/35 bg-amber-950/15 p-4">
                  <p className="font-black tracking-wide text-amber-200">STAGE 1 — SELECT SCENARIO ROLE AND PRIME</p>
                  <p className="mt-2 text-slate-400">Role selection replaces multiplayer requirements for this archive simulation. Raider uses the delayed hacked-chip route; Administrator bypasses priming confirmation and proceeds directly to ARM.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button variant="destructive" onClick={() => primeWarhead("RAIDER")}>PRIME AS RAIDER</Button>
                    <Button variant="outline" onClick={() => primeWarhead("ADMINISTRATOR")}>PRIME AS ADMINISTRATOR</Button>
                  </div>
                </div>
              )}

              {(warheadStage === "RAIDER_HACK" || warheadStage === "PRIMING") && (
                <div className="rounded border border-yellow-400/40 bg-yellow-950/15 p-4">
                  <p className="font-black text-yellow-200">{warheadStage === "RAIDER_HACK" ? "RAIDER CHIP HACKING — 17 SECOND READ" : "PRIMING CONFIRMATION — 40 SECOND READ"}</p>
                  <p className="mt-2 text-slate-400">The original long multiplayer wait is condensed here. Cancellation remains available during this pre-arm phase.</p>
                  <Button className="mt-3" variant="outline" onClick={cancelWarhead}>CANCEL PRIMING</Button>
                </div>
              )}

              {warheadStage === "ARM_READY" && (
                <div className="rounded border border-yellow-300/60 bg-yellow-950/20 p-4">
                  <p className="animate-pulse font-black tracking-wide text-yellow-200">ARM LIGHT FLASHING — CONFIRM ARMING</p>
                  <Button className="mt-3 bg-yellow-500 text-black hover:bg-yellow-400" onClick={armWarhead}>ARM WARHEAD</Button>
                </div>
              )}

              {["KEYS", "VERIFY", "COUNTDOWN"].includes(warheadStage) && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded border border-red-400/35 bg-black/35 p-4">
                    <p className="font-black tracking-wide text-red-200">STAGE 2 — DETONATION KEYS</p>
                    <p className="mt-1 text-slate-400">Retrieve each key, insert it into the console, then turn it. The archival simulation omits map-wide key searching but retains separate key actions.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {[0, 1].map((key) => (
                        <div key={key} className="rounded border border-slate-700 p-3">
                          <p className="font-black text-slate-200">ARMING KEY {key + 1}: {warheadKeysTurned[key] ? "TURNED" : warheadKeys[key] ? "INSERTED" : "UNRECOVERED"}</p>
                          {!warheadKeys[key] ? (
                            <Button className="mt-2 w-full" size="sm" variant="outline" disabled={warheadStage !== "KEYS"} onClick={() => setWarheadKeys((old) => old.map((value, index) => index === key ? true : value))}>RETRIEVE + INSERT</Button>
                          ) : (
                            <Button className="mt-2 w-full" size="sm" variant={warheadKeysTurned[key] ? "default" : "destructive"} disabled={warheadStage !== "KEYS" || warheadKeysTurned[key]} onClick={() => {
                              const next = warheadKeysTurned.map((value, index) => index === key ? true : value);
                              setWarheadKeysTurned(next);
                              if (next.every(Boolean)) {
                                setWarheadStage("VERIFY");
                                addLog("Both warhead keys turned. Final authorization reader enabled.");
                              }
                            }}>{warheadKeysTurned[key] ? "KEY TURNED" : "TURN KEY"}</Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {warheadStage === "VERIFY" && <Button className="mt-3 w-full bg-red-600 text-white hover:bg-red-500" onClick={authorizeWarhead}>VERIFY ROLE AND AUTHORIZE DETONATION</Button>}
                  </div>

                  <div className="rounded border border-violet-400/35 bg-black/35 p-4">
                    <p className="font-black tracking-wide text-violet-200">EVACUATION / EPSILON-8 DATA HEIST</p>
                    <p className="mt-1 text-slate-400">Set your final location before detonation. Raider only: recover the 423 KB floppy from MCR, then escape to the topside black car for the broadcast branch.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button size="sm" variant={warheadLocation === "TOPSIDE" ? "default" : "outline"} disabled={warheadStage !== "COUNTDOWN"} onClick={() => setWarheadLocation("TOPSIDE")}>MOVE TOPSIDE</Button>
                      <Button size="sm" variant={warheadLocation === "BOTTOMSIDE" ? "default" : "outline"} disabled={warheadStage !== "COUNTDOWN"} onClick={() => setWarheadLocation("BOTTOMSIDE")}>MOVE BOTTOMSIDE</Button>
                    </div>
                    <Button className="mt-2 w-full" size="sm" variant={warheadTartarusSealed ? "default" : "outline"} disabled={warheadStage !== "COUNTDOWN" || warheadTartarusSealed} onClick={() => setWarheadTartarusSealed(true)}>{warheadTartarusSealed ? "TARTARUS ZONE SEALED" : "SEAL TARTARUS ZONE"}</Button>
                    {warheadActor === "RAIDER" && <>
                      <Button className="mt-3 w-full" size="sm" variant={raiderFloppyHeld ? "default" : "outline"} disabled={warheadStage !== "COUNTDOWN" || raiderFloppyHeld} onClick={() => { setRaiderFloppyHeld(true); addLog("423 KB floppy drive retrieved from MCR terminal."); }}>{raiderFloppyHeld ? "423 KB FLOPPY SECURED" : "GRAB 423 KB FLOPPY — MCR"}</Button>
                      <Button className="mt-2 w-full" size="sm" variant="destructive" disabled={warheadStage !== "COUNTDOWN" || !raiderFloppyHeld || warheadLocation !== "TOPSIDE" || raiderFloppyEscaped} onClick={() => { setRaiderFloppyEscaped(true); addLog("Raider escaped to topside black car with the Epsilon-8 floppy."); }}>{raiderFloppyEscaped ? "BLACK CAR ESCAPE CONFIRMED" : "ESCAPE TO BLACK CAR"}</Button>
                    </>}
                  </div>
                </div>
              )}
              <p className="rounded border border-slate-700 bg-black/30 p-3 text-slate-400">Detonation outcomes: Raider + sealed Tartarus + topside → Protocol Saletum; Raider + escaped 423 KB floppy → For Immediate Broadcast; all other currently implemented routes use the emergency destruction outcome.</p>
            </CardContent>
          </Card>
        </section>
      )}
      {ending && (
        <div className="fixed inset-0 z-[100] flex h-[100dvh] w-[100dvw] items-center justify-center overflow-hidden bg-black">
          <section className="relative flex h-full w-full items-center justify-center bg-black shadow-[0_0_80px_rgba(239,68,68,.25)]">
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 bg-gradient-to-b from-black/90 via-black/55 to-transparent p-4 md:p-6">
              <div>
                <p className="text-xs font-black tracking-[.22em] text-red-300">
                  QSERF EVENT AFTERMATH
                </p>
                <h2 className="text-lg font-black text-slate-100">
                  {qserfEndings[ending].label}
                </h2>
              </div>
              <Button variant="outline" onClick={() => {
                endingVideoRef.current?.pause();
                setEndingAudioNeedsGesture(false);
                setEnding(null);
              }}>
                CLOSE PROJECTION
              </Button>
            </div>
            <video
              ref={endingVideoRef}
              className="h-full w-full bg-black object-contain"
              controls
              autoPlay
              playsInline
              muted={false}
              onCanPlay={(event) => {
                event.currentTarget.muted = false;
                event.currentTarget.defaultMuted = false;
                event.currentTarget.volume = 1;
                void event.currentTarget.play()
                  .then(() => setEndingAudioNeedsGesture(false))
                  .catch(() => setEndingAudioNeedsGesture(true));
              }}
              onPlaying={(event) => {
                // Do not allow the ending player to inherit a mute state from
                // a previous media element or a delayed autoplay attempt.
                event.currentTarget.muted = false;
                event.currentTarget.defaultMuted = false;
                event.currentTarget.volume = 1;
              }}
              src={qserfEndings[ending].path}
            >
              Your browser cannot play this QSERF event video.
            </video>
            {endingAudioNeedsGesture && (
              <Button
                className="absolute inset-x-0 bottom-16 z-20 mx-auto w-fit border border-amber-300 bg-black/90 text-amber-100 hover:bg-amber-950"
                onClick={() => {
                  const video = endingVideoRef.current;
                  if (!video) return;
                  video.muted = false;
                  video.volume = 1;
                  void video.play()
                    .then(() => setEndingAudioNeedsGesture(false))
                    .catch(() => setEndingAudioNeedsGesture(true));
                }}
              >
                ENABLE ENDING AUDIO
              </Button>
            )}
            <p className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-4 pt-10 text-xs text-slate-300 md:px-6 md:pb-6">
              Outcome recordings retain their original audio. If a browser blocks delayed autoplay, use ENABLE ENDING AUDIO or the video play control to begin it with sound.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
