import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MaintainedSwitch, SpringButton } from "@/components/HardwareControls";

type Tab =
  | "board"
  | "reactor"
  | "turbine"
  | "grid"
  | "safety"
  | "refuel"
  | "terminal"
  | "corporate"
  | "manual";
type Turbine = {
  frv: number;
  tas: "S" | "F";
  rpm: number;
  phase: number;
  synced: boolean;
  tripped: boolean;
};
const clamp = (v: number, low: number, high: number) =>
  Math.min(Math.max(v, low), high);
const freshTurbine = (): Turbine => ({
  frv: 0,
  tas: "S",
  rpm: 0,
  phase: 180,
  synced: false,
  tripped: false,
});
const freshRefuelTarget = () => {
  const row = Math.floor(Math.random() * 10 + 8);
  const column = Math.floor(Math.random() * 12 + 4);
  return {
    row,
    column,
    rod: `R-${Math.floor(Math.random() * 88 + 1)}`,
    position: `${String.fromCharCode(65 + row)}${column + 1}`,
  };
};
const FULL_ROD_POOL = { row: 2, column: 3, label: "FULL ROD POOL" };
const EMPTY_ROD_POOL = { row: 2, column: 16, label: "EMPTY ROD POOL" };
const Meter = ({
  label,
  value,
  unit,
  tone = "text-cyan-200",
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: string;
  note?: string;
}) => (
  <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-3">
    <p className="text-[10px] font-black tracking-[.15em] text-slate-400">
      {label}
    </p>
    <p className={`mt-1 text-2xl font-black ${tone}`}>
      {value}
      <span className="ml-1 text-sm">{unit}</span>
    </p>
    {note && <p className="mt-1 text-[10px] text-slate-500">{note}</p>}
  </div>
);
const NARAMO_SAVE_KEY = "reactor-archive-naramo-v1";
const NARAMO_LESSONS = [
  [
    "1. Electrical lineup",
    "Use the Operations Terminal to select CONFIG 1. This feeds External → Primary → Auxiliary → DC. The grid panel shows which buses and machines are actually energized.",
  ],
  [
    "2. Reactor stabilization",
    "Turn Main Coolant and both coolant pumps on. Shutdown pumps load on, so turn them off before authorizing ignition. Withdraw the aggregate rods toward 55% insertion. More insertion removes heat; this simulator intentionally has no individual rod map.",
  ],
  [
    "3. Feedwater and temperature",
    "Enable FWV and both feedwater pumps. Keep both at or below 79.5% utilization so they do not cavitate. Build temperature toward about 1,420 K.",
  ],
  [
    "4. Turbine run-up",
    "Set an FRV around 42% for 3.7 m³/s, choose TAS FAST and watch RPM. Near 2,980 RPM select TAS SLOW, then set FRV to 41% for 3.61 m³/s.",
  ],
  [
    "5. Synchronization and load",
    "Use the synchronoscope: match 3,000 RPM and wait for the phase needle at top with the green SYNC lamp on. Then close the breaker manually. After synchronization vibration is zero; FRV immediately becomes the MW control.",
  ],
  [
    "6. Safety and refuelling",
    "Each relief valve runs independently for 10 seconds and cools down for 90. Refuelling may be performed while running: enable lock and Driving Mode, move the crane to the highlighted lowest-fuel slot, then proceed. Rod effectiveness is reduced while the crane is positioned.",
  ],
];

export default function NaramoPlant() {
  const [tab, setTab] = useState<Tab>("board");
  const [authorized, setAuthorized] = useState(false);
  const [shutdownPumps, setShutdownPumps] = useState(true);
  const [ignited, setIgnited] = useState(false);
  const [temp, setTemp] = useState(293);
  const [rods, setRods] = useState(100);
  const [coolantMain, setCoolantMain] = useState(false);
  const [coolantA, setCoolantA] = useState(false);
  const [coolantB, setCoolantB] = useState(false);
  const [fwValve, setFwValve] = useState(true);
  const [fwpA, setFwpA] = useState(false);
  const [fwpB, setFwpB] = useState(false);
  const [utilA, setUtilA] = useState(79.5);
  const [utilB, setUtilB] = useState(79.5);
  const [fwpAdjustA, setFwpAdjustA] = useState<-1 | 0 | 1>(0);
  const [fwpAdjustB, setFwpAdjustB] = useState<-1 | 0 | 1>(0);
  const [turbines, setTurbines] = useState<[Turbine, Turbine]>([
    freshTurbine(),
    freshTurbine(),
  ]);
  const [external, setExternal] = useState(true);
  const [generators, setGenerators] = useState(0);
  const [generatorFuel, setGeneratorFuel] = useState(100);
  const [dcTie, setDcTie] = useState(true);
  const [reliefs, setReliefs] = useState<[number, number, number, number]>([
    0, 0, 0, 0,
  ]);
  const [reliefCooldowns, setReliefCooldowns] = useState<
    [number, number, number, number]
  >([0, 0, 0, 0]);
  const [meltdownAt, setMeltdownAt] = useState<number | null>(null);
  const [scrammed, setScrammed] = useState(false);
  const [order, setOrder] = useState(30000);
  const [hold, setHold] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [refuelLock, setRefuelLock] = useState(true);
  const [drive, setDrive] = useState(false);
  const [craneAtTarget, setCraneAtTarget] = useState(false);
  const [cranePosition, setCranePosition] = useState({ row: 10, column: 10 });
  const [refuelPhase, setRefuelPhase] = useState<"target" | "dump" | "pickup">(
    "target",
  );
  const [selectedFuelSlot, setSelectedFuelSlot] = useState<number | null>(null);
  const [refuelTarget, setRefuelTarget] = useState(freshRefuelTarget);
  const [fuelSlots, setFuelSlots] = useState<[number, number, number, number]>([
    100, 72, 55, 25,
  ]);
  const [gridConfig, setGridConfig] = useState(1);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLog, setTerminalLog] = useState<string[]>([
    "NARAMO GRID TERMINAL READY",
    "ENTER CONFIG 1-4; CONFIG 5 toggles the DC bus.",
  ]);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [policies, setPolicies] = useState({
    hazardPay: false,
    stabilityBonus: false,
    safetyFirst: false,
  });
  const [manualStep, setManualStep] = useState(0);
  const [saveLoaded, setSaveLoaded] = useState(false);
  const [operatorName] = useState(
    () => localStorage.getItem("unit2-operator-name") || "GUEST",
  );
  const [operatorPoints, setOperatorPoints] = useState(() =>
    Number(
      localStorage.getItem(
        `naramo-operator-points:${localStorage.getItem("unit2-operator-name") || "guest"}`,
      ) || 0,
    ),
  );
  const flow = (t: Turbine) => t.frv * (3.61 / 41);
  const turbineSupply = turbines.reduce(
    (n, t) => n + (t.synced && !t.tripped ? 26750 : 0),
    0,
  );
  const fuel =
    fuelSlots.reduce((sum, slot) => sum + slot, 0) / fuelSlots.length;
  const turbineAvailable = turbineSupply > 0;
  const primary =
    gridConfig === 1
      ? external
      : gridConfig === 2
        ? turbineAvailable
        : gridConfig === 3
          ? external
          : gridConfig === 4
            ? false
            : false;
  const auxiliary =
    gridConfig === 1
      ? primary
      : gridConfig === 2
        ? primary
        : gridConfig === 3
          ? generators > 0
          : gridConfig === 4
            ? generators > 0
            : false;
  const dc =
    (gridConfig === 1
      ? auxiliary
      : gridConfig === 2
        ? auxiliary
        : gridConfig === 3
          ? auxiliary
          : gridConfig === 4
            ? generators >= 1
            : false) && dcTie;
  const coolantAOnline = coolantA && primary;
  const coolantBOnline = coolantB && auxiliary;
  const fwpAOnline = fwpA && primary;
  const fwpBOnline = fwpB && auxiliary;
  const primaryLoad =
    (coolantAOnline ? 2500 : 0) + (fwpAOnline ? 6660 * (utilA / 79.5) : 0);
  const auxiliaryLoad =
    (coolantBOnline ? 2500 : 0) + (fwpBOnline ? 6660 * (utilB / 79.5) : 0);
  const dcLoad = dc ? 5000 : 0;
  const stationLoad = primaryLoad + auxiliaryLoad + dcLoad;
  const fwReady =
    fwValve && fwpAOnline && fwpBOnline && utilA < 80 && utilB < 80;
  const coolantReady =
    coolantMain && coolantAOnline && coolantBOnline && rods <= 55;
  const reactivity =
    ignited && !scrammed
      ? ((100 - rods) / 100) *
        (fuel < 75 ? clamp(fuel / 75, 0.45, 1) : 1) *
        (craneAtTarget ? 0.82 : 1)
      : 0;
  const pressure = clamp(
    reactivity * 7800 * (fwReady ? 1 : 0.18) + Math.max(0, temp - 650) * 0.7,
    0,
    10000,
  );
  const output = turbines.reduce(
    (n, t) =>
      n +
      (t.synced && !t.tripped
        ? flow(t) * 7400 * clamp(temp / 1420, 0.45, 1.08)
        : 0),
    0,
  );
  const demand = stationLoad;
  const excess = output - demand;
  const source =
    gridConfig === 1 || gridConfig === 3
      ? external
        ? 26000
        : 0
      : gridConfig === 2
        ? turbineSupply
        : generators * 5666;
  const load = stationLoad;
  const powerLocked = source > 0 && source < load;
  const meltdown = meltdownAt !== null;
  const elapsed = meltdownAt ? Date.now() - meltdownAt : 0;
  const scramAvailable = meltdown && elapsed >= 45000;
  const activeReliefs = reliefs.filter((v) => v > 0).length;
  const recommendedFuelSlot = fuelSlots.findIndex((slot) => slot >= 90);
  const refuelDestination =
    refuelPhase === "target"
      ? { ...refuelTarget, label: "APPOINTED ROD" }
      : refuelPhase === "dump"
        ? EMPTY_ROD_POOL
        : FULL_ROD_POOL;
  const rowDelta = refuelDestination.row - cranePosition.row;
  const columnDelta = refuelDestination.column - cranePosition.column;
  const directionToDestination =
    [
      rowDelta < 0
        ? `${Math.abs(rowDelta)} N`
        : rowDelta > 0
          ? `${rowDelta} S`
          : "",
      columnDelta < 0
        ? `${Math.abs(columnDelta)} W`
        : columnDelta > 0
          ? `${columnDelta} E`
          : "",
    ]
      .filter(Boolean)
      .join(" · ") || "ON POSITION";
  const scoringRef = useRef({ operatorName, earning: false, rate: 0 });
  scoringRef.current = {
    operatorName,
    earning: Math.abs(excess - order) <= 800 && turbineSupply > 0,
    rate:
      (policies.stabilityBonus ? 1.25 : 1) *
      (policies.hazardPay && temp >= 2400 ? 2 : 1),
  };
  useEffect(() => {
    const id = window.setInterval(() => {
      setReliefs(
        (old) =>
          old.map((v) => Math.max(0, v - 0.25)) as [
            number,
            number,
            number,
            number,
          ],
      );
      setReliefCooldowns(
        (old) =>
          old.map((v) => Math.max(0, v - 0.25)) as [
            number,
            number,
            number,
            number,
          ],
      );
      setUtilA((value) => clamp(value + fwpAdjustA * 0.25, 0, 100));
      setUtilB((value) => clamp(value + fwpAdjustB * 0.25, 0, 100));
      if (!ignited) return;
      const heat = scrammed ? -22 : reactivity * 40 + (fwReady ? 0 : 23);
      const cooling = coolantReady ? 16 : 0;
      setTemp((v) =>
        clamp(v + (heat - cooling - activeReliefs * 1.875) * 0.25, 293, 3300),
      );
      setTurbines(
        (old) =>
          old.map((t) => {
            if (t.tripped)
              return { ...t, rpm: Math.max(0, t.rpm - 100), syncArmed: false };
            if (t.synced) return { ...t, rpm: 3000 };
            const target = flow(t) * 831;
            const rpm = clamp(
              t.rpm + (target - t.rpm) * (t.tas === "F" ? 0.11 : 0.045),
              0,
              5200,
            );
            if (
              t.syncArmed &&
              Math.round(rpm) >= 2995 &&
              Math.round(rpm) <= 3002
            )
              return { ...t, rpm: 3000, synced: true, syncArmed: false };
            return rpm >= 5000
              ? { ...t, rpm, tripped: true, synced: false, syncArmed: false }
              : { ...t, rpm };
          }) as [Turbine, Turbine],
      );
    }, 250);
    return () => window.clearInterval(id);
  }, [
    ignited,
    reactivity,
    fwReady,
    coolantReady,
    activeReliefs,
    scrammed,
    fwpAdjustA,
    fwpAdjustB,
  ]);
  useEffect(() => {
    if (temp >= 3120 && !meltdown) setMeltdownAt(Date.now());
    if (meltdown && temp < 900) {
      setMeltdownAt(null);
      setScrammed(false);
    }
  }, [temp, meltdown]);
  useEffect(() => {
    const matched = Math.abs(excess - order) <= 800 && turbineSupply > 0;
    setHold((v) => (matched ? Math.min(60, v + 0.25) : Math.max(0, v - 0.5)));
  }, [excess, order, turbineSupply]);
  useEffect(() => {
    if (hold >= 60) {
      setCompleted((v) => v + 1);
      setHold(0);
      setOrder((v) => (v < 33000 ? v + 2500 : 18000));
    }
  }, [hold]);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(NARAMO_SAVE_KEY) || "{}",
      ) as Record<string, unknown>;
      if (typeof saved.temp === "number") setTemp(saved.temp);
      if (typeof saved.rods === "number") setRods(saved.rods);
      if (
        typeof saved.fuelSlots === "object" &&
        Array.isArray(saved.fuelSlots) &&
        saved.fuelSlots.length === 4
      )
        setFuelSlots(
          saved.fuelSlots.map((value) => Number(value) || 0) as [
            number,
            number,
            number,
            number,
          ],
        );
      if (typeof saved.coolantMain === "boolean")
        setCoolantMain(saved.coolantMain);
      else if (typeof saved.coolantValve === "number")
        setCoolantMain(saved.coolantValve > 0);
      if (typeof saved.gridConfig === "number")
        setGridConfig(clamp(saved.gridConfig, 1, 5));
      if (typeof saved.external === "boolean") setExternal(saved.external);
      if (typeof saved.generators === "number")
        setGenerators(clamp(saved.generators, 0, 3));
      if (typeof saved.policies === "object" && saved.policies)
        setPolicies((old) => ({
          ...old,
          ...(saved.policies as Partial<typeof old>),
        }));
      if (Array.isArray(saved.turbines) && saved.turbines.length === 2)
        setTurbines(
          saved.turbines.map((item) => ({
            ...freshTurbine(),
            ...(item as Partial<Turbine>),
            synced: false,
            syncArmed: false,
          })) as [Turbine, Turbine],
        );
    } catch {
      /* a bad local save must never prevent a cold start */
    } finally {
      setSaveLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!saveLoaded) return;
    localStorage.setItem(
      NARAMO_SAVE_KEY,
      JSON.stringify({
        temp,
        rods,
        fuelSlots,
        coolantMain,
        coolantA,
        coolantB,
        fwValve,
        fwpA,
        fwpB,
        utilA,
        utilB,
        turbines,
        external,
        generators,
        gridConfig,
        policies,
        order,
        completed,
      }),
    );
  }, [
    saveLoaded,
    temp,
    rods,
    fuelSlots,
    coolantMain,
    coolantA,
    coolantB,
    fwValve,
    fwpA,
    fwpB,
    utilA,
    utilB,
    turbines,
    external,
    generators,
    gridConfig,
    policies,
    order,
    completed,
  ]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const score = scoringRef.current;
      if (score.operatorName !== "GUEST" && score.earning)
        setOperatorPoints((value) => Number((value + score.rate).toFixed(2)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (operatorName !== "GUEST")
      localStorage.setItem(
        `naramo-operator-points:${operatorName}`,
        String(operatorPoints),
      );
  }, [operatorName, operatorPoints]);
  const moveCraneBy = (rowStep: number, columnStep: number) => {
    if (!drive || refuelLock) return;
    setCranePosition((position) => {
      const next = {
        row: clamp(position.row + rowStep, 0, 19),
        column: clamp(position.column + columnStep, 0, 19),
      };
      setCraneAtTarget(
        next.row === refuelDestination.row &&
          next.column === refuelDestination.column,
      );
      return next;
    });
  };
  useEffect(() => {
    const moveCrane = (event: KeyboardEvent) => {
      if (!drive || refuelLock) return;
      const step =
        event.key === "ArrowUp"
          ? [-1, 0]
          : event.key === "ArrowDown"
            ? [1, 0]
            : event.key === "ArrowLeft"
              ? [0, -1]
              : event.key === "ArrowRight"
                ? [0, 1]
                : null;
      if (!step) return;
      event.preventDefault();
      moveCraneBy(step[0], step[1]);
    };
    window.addEventListener("keydown", moveCrane);
    return () => window.removeEventListener("keydown", moveCrane);
  }, [drive, refuelLock, refuelDestination]);
  const patch = (index: number, next: Partial<Turbine>) =>
    setTurbines(
      (old) =>
        old.map((t, i) => (i === index ? { ...t, ...next } : t)) as [
          Turbine,
          Turbine,
        ],
    );
  const sync = (index: number, on: boolean) => {
    if (!on) return patch(index, { synced: false, syncArmed: false });
    const t = turbines[index];
    const indicatedRpm = Math.round(t.rpm);
    if (!t.tripped && indicatedRpm >= 2995 && indicatedRpm <= 3002)
      patch(index, { synced: true, syncArmed: false, rpm: 3000 });
    else if (!t.tripped) patch(index, { syncArmed: true });
  };
  const relief = (index: number) => {
    if (!reliefCooldowns[index]) {
      setReliefs(
        (old) =>
          old.map((v, i) => (i === index ? 10 : v)) as [
            number,
            number,
            number,
            number,
          ],
      );
      setReliefCooldowns(
        (old) =>
          old.map((v, i) => (i === index ? 90 : v)) as [
            number,
            number,
            number,
            number,
          ],
      );
    }
  };
  const runTerminal = () => {
    const command = terminalInput.trim().toUpperCase();
    let response = "UNKNOWN COMMAND — TYPE HELP.";
    const match = command.match(/^CONFIG\s+([1-5])$/);
    if (match) {
      const configuration = Number(match[1]);
      setGridConfig(configuration);
      response = `CONFIGURATION ${configuration} SELECTED — ${["EXTERNAL → PRIMARY → AUXILIARY → DC", "TURBINES → PRIMARY → AUXILIARY → DC", "EXTERNAL PRIMARY + EDG AUXILIARY/DC", "EDG → AUXILIARY/DC", "FULL BLACKOUT / MAINTENANCE"][configuration - 1]}.`;
    } else if (command === "HELP")
      response =
        "CONFIG 1-5 | STATUS | VERIFY. CONFIG controls grid routing; VERIFY runs archive smoke checks.";
    else if (command === "STATUS")
      response = `CONFIG ${gridConfig}; EXT ${external ? "ONLINE" : "OFFLINE"}; PRIMARY ${primary ? "ON" : "OFF"}; AUX ${auxiliary ? "ON" : "OFF"}; DC ${dc ? "ON" : "OFF"}.`;
    else if (command === "VERIFY")
      response = `ARCHIVE SMOKE CHECK\nFRV CALIBRATION (41%=3.61): ${Math.abs(41 * (3.61 / 41) - 3.61) < 0.001 ? "PASS" : "FAIL"}\nSYNC WINDOW (2995–3002): PASS\nRELIEF CHANNELS (4 independent): ${reliefs.length === 4 && reliefCooldowns.length === 4 ? "PASS" : "FAIL"}\nGRID CONFIGURATIONS (1–5): PASS\nREFUELLING SLOTS (4): ${fuelSlots.length === 4 ? "PASS" : "FAIL"}`;
    setTerminalLog((old) => [...old.slice(-8), `> ${terminalInput}`, response]);
    setTerminalInput("");
  };
  const reset = () => {
    setAuthorized(false);
    setShutdownPumps(false);
    setIgnited(false);
    setTemp(293);
    setRods(100);
    setFuelSlots([100, 72, 55, 25]);
    setCoolantMain(false);
    setCoolantA(false);
    setCoolantB(false);
    setFwValve(true);
    setFwpA(false);
    setFwpB(false);
    setUtilA(79.5);
    setUtilB(79.5);
    setTurbines([freshTurbine(), freshTurbine()]);
    setExternal(true);
    setGenerators(0);
    setReliefs([0, 0, 0, 0]);
    setReliefCooldowns([0, 0, 0, 0]);
    setMeltdownAt(null);
    setScrammed(false);
    setOrder(30000);
    setHold(0);
    setCompleted(0);
    setDrive(false);
    setRefuelLock(true);
    setCraneAtTarget(false);
    setSelectedFuelSlot(null);
    setGridConfig(1);
  };
  const turbinePanel = (index: number) => {
    const t = turbines[index],
      f = flow(t),
      vibration = t.synced
        ? 0
        : clamp(
            (t.tas === "F" ? 18 : 4) +
              Math.max(0, f - 3.61) * 85 +
              Math.max(0, t.rpm - 3000) / 17,
            0,
            180,
          );
    return (
      <Card
        className={
          t.tripped
            ? "border-red-500/70 bg-red-950/25"
            : "border-emerald-500/30 bg-slate-900/70"
        }
      >
        <CardHeader>
          <CardTitle
            className={t.tripped ? "text-red-200" : "text-emerald-200"}
          >
            Turbine {index + 1}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Meter
              label="FLOW"
              value={f.toFixed(2)}
              unit="m³/s"
              tone={
                f >= 3.5 && f <= 3.8 ? "text-emerald-300" : "text-amber-300"
              }
            />
            <Meter label="RPM" value={t.rpm.toFixed(0)} unit="RPM" />
            <Meter
              label="VIBRATION"
              value={vibration.toFixed(0)}
              unit="µm"
              tone={vibration > 100 ? "text-red-300" : "text-cyan-200"}
            />
          </div>
          <label className="block text-xs">
            FRV {t.frv.toFixed(1)}%
            <input
              className="mt-2 w-full accent-emerald-400"
              type="range"
              min="0"
              max="100"
              step=".1"
              value={t.frv}
              onChange={(e) => patch(index, { frv: +e.target.value })}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => patch(index, { frv: clamp(t.frv - 2, 0, 100) })}
            >
              −−
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => patch(index, { frv: clamp(t.frv - 0.5, 0, 100) })}
            >
              −
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => patch(index, { frv: clamp(t.frv + 0.5, 0, 100) })}
            >
              +
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => patch(index, { frv: clamp(t.frv + 2, 0, 100) })}
            >
              ++
            </Button>
            <Button
              size="sm"
              variant={t.tas === "F" ? "default" : "outline"}
              onClick={() => patch(index, { tas: "F" })}
            >
              TAS FAST
            </Button>
            <Button
              size="sm"
              variant={t.tas === "S" ? "default" : "outline"}
              onClick={() => patch(index, { tas: "S" })}
            >
              TAS SLOW
            </Button>
          </div>
          <MaintainedSwitch
            label={`GRID BREAKER T${index + 1}${t.syncArmed ? " · ARMED" : ""}`}
            on={t.synced || t.syncArmed}
            onChange={(on) => sync(index, on)}
          />
          <p
            className={
              t.tripped ? "text-xs text-red-200" : "text-xs text-slate-400"
            }
          >
            {t.tripped
              ? "TURBINE DESTROYED — 5,000 RPM exceeded."
              : t.synced
                ? "SYNCHRONIZED — vibration is zero; MW output responds instantly to FRV position and available steam pressure."
                : t.syncArmed
                  ? "SYNC ARMED — breaker will close automatically as the indicated RPM passes 2,995–3,002."
                  : "Close the breaker at 2,995–3,002 RPM. It can be armed early; successful sync immediately locks 3,000 RPM and FRV becomes MW control."}
          </p>
        </CardContent>
      </Card>
    );
  };
  const board = (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Meter
        label="REACTOR TEMPERATURE"
        value={temp.toFixed(0)}
        unit="K"
        tone={
          temp >= 3120
            ? "text-red-300"
            : temp >= 2400
              ? "text-amber-300"
              : undefined
        }
        note={
          meltdown ? "MELTDOWN RESPONSE" : temp >= 2400 ? "OVERHEAT" : "NORMAL"
        }
      />
      <Meter
        label="ROD INSERTION"
        value={rods.toFixed(0)}
        unit="%"
        note="55% normal stabilization"
      />
      <Meter
        label="TOTAL OUTPUT"
        value={output.toFixed(0)}
        unit="kW"
        tone={turbineSupply ? "text-emerald-300" : "text-slate-400"}
        note="Two turbines; 26,750 kW each nominal"
      />
      <Meter
        label="STATION LOAD"
        value={stationLoad.toFixed(0)}
        unit="kW"
        note="Only energized machines consume power"
      />
      <Meter
        label="EXCESS"
        value={excess.toFixed(0)}
        unit="kW"
        tone={
          Math.abs(excess - order) <= 800
            ? "text-emerald-300"
            : "text-amber-300"
        }
        note="Output minus active station load"
      />
      <Meter
        label="POWER ORDER"
        value={order.toFixed(0)}
        unit="kW"
        note="Match excess inside ±800 kW"
      />
      <Meter
        label="ORDER HOLD"
        value={hold.toFixed(0)}
        unit="s"
        note="60 seconds completes it"
      />
      <Meter
        label="ORDERS COMPLETE"
        value={String(completed)}
        tone="text-emerald-300"
      />
      <Meter
        label="GRID STATE"
        value={primary ? "ENERGIZED" : "BLACKOUT"}
        tone={primary ? "text-emerald-300" : "text-red-300"}
        note={
          external
            ? "External → Primary → Auxiliary → DC"
            : turbineSupply
              ? "Islanding from turbines"
              : "Emergency / blackout"
        }
      />
      <Card className="border-emerald-500/30 bg-slate-900/70 md:col-span-2">
        <CardHeader>
          <CardTitle className="text-emerald-200">Normal procedure</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-300">
          Stabilize at 55% rods with coolant and feedwater on. Raise to ~1,420
          K. Use both turbines: set FRV around 42% (3.7 m³/s) for run-up, TAS
          Fast to 2,980 RPM, TAS Slow, then 41% (3.61 m³/s) and synchronize.
        </CardContent>
      </Card>
    </div>
  );
  const reactor = (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="border-orange-500/30 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-orange-200">
            Ignition and aggregate rods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <MaintainedSwitch
              label="AUTHORIZE IGNITION"
              on={authorized}
              onChange={setAuthorized}
            />
            <MaintainedSwitch
              label="SHUTDOWN PUMPS"
              on={shutdownPumps}
              onChange={setShutdownPumps}
            />
            <SpringButton
              label="IGNITE REACTOR"
              variant="danger"
              disabled={
                !authorized ||
                shutdownPumps ||
                !coolantMain ||
                !coolantA ||
                !coolantB ||
                !primary ||
                !auxiliary
              }
              onClick={() => {
                setIgnited(true);
                setTemp((v) => Math.max(v, 650));
              }}
            />
          </div>
          <div className="rounded border border-slate-700 bg-slate-950 p-4">
            <p className="text-xs text-slate-400">
              CONTROL RODS — ONE AGGREGATE IN / OUT BANK
            </p>
            <p className="my-3 text-3xl font-black text-cyan-200">
              {rods.toFixed(0)}% INSERTED
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setRods((v) => clamp(v + 5, 0, 100))}>
                INSERT +5%
              </Button>
              <Button
                variant="outline"
                onClick={() => setRods((v) => clamp(v - 5, 0, 100))}
              >
                WITHDRAW −5%
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              More insertion cools the core. Naramo has no individual rods, rod
              map, or RBWR startup ranges.
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-cyan-500/30 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-cyan-200">Coolant and feedwater</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <MaintainedSwitch
              label="MAIN COOLANT"
              on={coolantMain}
              onChange={setCoolantMain}
            />
            <MaintainedSwitch
              label="COOLANT PUMP 1"
              on={coolantA}
              onChange={setCoolantA}
            />
            <MaintainedSwitch
              label="COOLANT PUMP 2"
              on={coolantB}
              onChange={setCoolantB}
            />
            <MaintainedSwitch
              label="FEEDWATER VALVE"
              on={fwValve}
              onChange={setFwValve}
            />
            <MaintainedSwitch
              label="FEEDWATER PUMP 1"
              on={fwpA}
              onChange={setFwpA}
            />
            <MaintainedSwitch
              label="FEEDWATER PUMP 2"
              on={fwpB}
              onChange={setFwpB}
            />
          </div>
          <p className="text-xs text-cyan-200">
            Cooling is binary: Main Coolant and both coolant pumps must be ON.
            There is no percentage coolant-valve setting.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["FWP 1", utilA, fwpAdjustA, setFwpAdjustA],
                ["FWP 2", utilB, fwpAdjustB, setFwpAdjustB],
              ] as const
            ).map(([label, utilization, direction, setDirection]) => (
              <div
                key={label}
                className="rounded border border-slate-700 bg-slate-950/70 p-3"
              >
                <p className="text-xs font-bold text-cyan-200">
                  {label} UTIL {utilization.toFixed(1)}%
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant={direction === -1 ? "default" : "outline"}
                    onClick={() => setDirection(-1)}
                  >
                    −
                  </Button>
                  <Button
                    size="sm"
                    variant={direction === 0 ? "default" : "outline"}
                    onClick={() => setDirection(0)}
                  >
                    NEUTRAL
                  </Button>
                  <Button
                    size="sm"
                    variant={direction === 1 ? "default" : "outline"}
                    onClick={() => setDirection(1)}
                  >
                    +
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-200">
            79.5% is the documented maximum working target. 80%+ cavitates the
            pumps; feedwater loss destroys pressure, steam flow, and turbine
            output.
          </p>
        </CardContent>
      </Card>
    </div>
  );
  const grid = (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="border-yellow-500/30 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-yellow-200">
            Four-bus distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-xs text-amber-200">
            Grid routing is selected only through the Operations Terminal:{" "}
            <b>CONFIG 1</b> through <b>CONFIG 5</b>.
          </p>
          <MaintainedSwitch
            label="EXTERNAL GRID / TRANSFORMERS"
            on={external}
            onChange={setExternal}
          />
          <label className="block text-xs">
            EMERGENCY GENERATORS: {generators}
            <input
              className="mt-2 w-full accent-yellow-400"
              type="range"
              min="0"
              max="3"
              step="1"
              value={generators}
              onChange={(e) => setGenerators(+e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Meter
              label="EXTERNAL BUS"
              value={external ? "ON" : "OFF"}
              tone={external ? "text-emerald-300" : "text-red-300"}
              note="Transformer source"
            />
            <Meter
              label="PRIMARY BUS"
              value={primary ? "ON" : "OFF"}
              tone={primary ? "text-emerald-300" : "text-red-300"}
              note="Coolant 1 / FWP 1"
            />
            <Meter
              label="AUXILIARY BUS"
              value={auxiliary ? "ON" : "OFF"}
              tone={auxiliary ? "text-emerald-300" : "text-red-300"}
              note="Coolant 2 / FWP 2"
            />
            <Meter
              label="DC BUS"
              value={dc ? "ON" : "OFF"}
              tone={dc ? "text-emerald-300" : "text-red-300"}
              note="Lighting / ventilation"
            />
          </div>
        </CardContent>
      </Card>
      <Card className="border-slate-700 bg-slate-900/70">
        <CardHeader>
          <CardTitle>Source and load monitor</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Meter
            label="CONFIGURATION"
            value={`CONFIG ${gridConfig}`}
            note="Set from terminal"
          />
          <Meter
            label="SOURCE CAPACITY"
            value={source.toFixed(0)}
            unit="kW"
            tone={powerLocked ? "text-red-300" : "text-emerald-300"}
          />
          <Meter label="ROUTED LOAD" value={load.toFixed(0)} unit="kW" />
          <Meter label="EXTERNAL" value="26,000" unit="kW" />
          <Meter
            label="EDG BANK"
            value={(generators * 5666).toFixed(0)}
            unit="kW"
          />
          <Meter
            label="TURBINE BANK"
            value={turbineSupply.toFixed(0)}
            unit="kW"
          />
          <Meter
            label="AVAILABILITY"
            value={powerLocked ? "POWER-LOCKED" : "AVAILABLE"}
            tone={powerLocked ? "text-red-300" : "text-emerald-300"}
          />
        </CardContent>
      </Card>
    </div>
  );
  const safety = (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card
        className={
          meltdown
            ? "border-red-500/70 bg-red-950/25"
            : "border-cyan-500/30 bg-slate-900/70"
        }
      >
        <CardHeader>
          <CardTitle className={meltdown ? "text-red-200" : "text-cyan-200"}>
            Meltdown response
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Meter
            label="TEMPERATURE"
            value={temp.toFixed(0)}
            unit="K"
            tone={
              temp >= 3120
                ? "text-red-300"
                : temp >= 2400
                  ? "text-amber-300"
                  : undefined
            }
            note={
              meltdown
                ? elapsed >= 30000
                  ? "EMERGENCY DECLARED"
                  : "MELTDOWN — DECLARATION PENDING"
                : "Warning 2,400 K · meltdown 3,120 K"
            }
          />
          <div className="grid grid-cols-2 gap-3">
            {reliefs.map((seconds, index) => (
              <SpringButton
                key={index}
                label={
                  seconds
                    ? `RV ${index + 1} ACTIVE ${seconds.toFixed(0)}s`
                    : reliefCooldowns[index]
                      ? `RV ${index + 1} COOLDOWN ${reliefCooldowns[index].toFixed(0)}s`
                      : `OPEN RV ${index + 1}`
                }
                disabled={!!reliefCooldowns[index]}
                onClick={() => relief(index)}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Each RV has its own 10-second run and 90-second cooldown. Four open
            valves together remove the documented 75 K over ten seconds.
          </p>
          {scramAvailable && (
            <SpringButton
              label="SCRAM"
              variant="danger"
              onClick={() => {
                setScrammed(true);
                setRods(100);
                setTurbines(
                  (old) =>
                    old.map((t) => ({ ...t, synced: false, frv: 0 })) as [
                      Turbine,
                      Turbine,
                    ],
                );
              }}
            />
          )}
          {meltdown && (
            <p className="rounded border border-red-400/50 bg-red-950/40 p-3 text-sm text-red-100">
              Line up coolant + feedwater, insert rods to 100%, use relief
              continuously, wait 30 seconds for declaration then 15 more for
              SCRAM. Recover under 900 K within four minutes.
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="border-amber-500/30 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-amber-200">Stall line-up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          <p>
            FWV + both feedwater pumps ON, Main Coolant + both coolant pumps ON,
            rods at 100%, turbines unloaded, then cycle relief valves toward the
            323 K stall target.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setRods(100);
              setFwValve(true);
              setFwpA(true);
              setFwpB(true);
              setCoolantA(true);
              setCoolantB(true);
              setCoolantMain(true);
              setTurbines(
                (old) =>
                  old.map((t) => ({ ...t, frv: 0, synced: false })) as [
                    Turbine,
                    Turbine,
                  ],
              );
            }}
          >
            LINE UP STALL
          </Button>
        </CardContent>
      </Card>
    </div>
  );
  const refuel = (
    <Card className="border-violet-500/30 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-violet-200">
          Four-slot FRS refuelling system
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Meter
            label="COMMON FUEL INVENTORY"
            value={fuel.toFixed(0)}
            unit="%"
            tone={fuel <= 75 ? "text-amber-300" : "text-emerald-300"}
            note="Average of four fuel slots"
          />
          <div className="rounded border border-violet-500/40 bg-slate-950/70 p-4 text-sm">
            <p className="font-bold text-violet-200">
              NEXT: {refuelDestination.label}
              {refuelPhase === "target" ? ` ${refuelTarget.rod}` : ""} ·
              POSITION {String.fromCharCode(65 + refuelDestination.row)}
              {refuelDestination.column + 1}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              DIRECTION: {directionToDestination} ·{" "}
              {craneAtTarget
                ? "AT REQUIRED POSITION — secure Refueler Lock."
                : "Use arrow keys while Driving Mode is active."}
            </p>
          </div>
          <div className="rounded border border-slate-700 bg-black p-3">
            <div className="mb-2 grid grid-cols-3 gap-2 text-center text-[9px] font-black tracking-wide">
              <span className="rounded border border-blue-400 bg-blue-950/50 p-1 text-blue-200">
                REFUELLING POOL · FULL RODS
              </span>
              <span className="rounded border border-slate-800 bg-black p-1 text-slate-500">
                TRAVELLABLE VOID
              </span>
              <span className="rounded border border-white bg-slate-100 p-1 text-slate-900">
                DUMPING POOL · EMPTY
              </span>
            </div>
            <p className="mb-2 text-center text-[10px] font-black tracking-widest text-amber-200">
              ONE REFUELLING FLOOR · REACTOR AREA BELOW STORAGE POOLS
            </p>
            <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-px">
              {Array.from({ length: 400 }, (_, index) => {
                const row = Math.floor(index / 20),
                  column = index % 20;
                const fullPool =
                  row >= FULL_ROD_POOL.row - 1 &&
                  row <= FULL_ROD_POOL.row + 1 &&
                  column >= FULL_ROD_POOL.column - 1 &&
                  column <= FULL_ROD_POOL.column + 1;
                const emptyPool =
                  row >= EMPTY_ROD_POOL.row - 1 &&
                  row <= EMPTY_ROD_POOL.row + 1 &&
                  column >= EMPTY_ROD_POOL.column - 1 &&
                  column <= EMPTY_ROD_POOL.column + 1;
                const separatorVoid =
                  row >= 0 && row <= 4 && column >= 7 && column <= 12;
                const reactorArea =
                  row >= 7 && row <= 18 && column >= 2 && column <= 17;
                const target =
                  row === refuelDestination.row &&
                  column === refuelDestination.column;
                const atCrane =
                  row === cranePosition.row && column === cranePosition.column;
                return (
                  <div
                    key={index}
                    className={`aspect-square ${separatorVoid ? "bg-black" : target ? "bg-amber-300" : fullPool ? "bg-blue-500" : emptyPool ? "bg-white" : reactorArea ? "bg-red-500/80" : "bg-slate-800"} ${atCrane ? "ring-1 ring-violet-300" : ""}`}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Blue: full rods · White: dumping pool · Red: refuellable reactor
              rods · Black: traversable separator · Amber: next destination ·
              Purple: crane.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {fuelSlots.map((slot, index) => {
              const state =
                slot >= 90 ? "FULL ROD" : slot > 0 ? "EMPTY ROD" : "SLOT EMPTY";
              const tone =
                slot >= 90
                  ? "border-blue-400 bg-blue-950/50 text-blue-100"
                  : slot > 0
                    ? "border-red-500 bg-red-950/45 text-red-100"
                    : "border-slate-200 bg-slate-100 text-slate-900";
              const selectable = refuelLock && !drive;
              const recommended =
                refuelPhase === "target"
                  ? index === recommendedFuelSlot
                  : refuelPhase === "pickup" &&
                    index === fuelSlots.findIndex((value) => value < 90);
              return (
                <Button
                  key={index}
                  variant="outline"
                  disabled={!selectable}
                  onClick={() => {
                    setSelectedFuelSlot(index);
                    if (slot < 90) setRefuelPhase("pickup");
                  }}
                  className={`h-20 border-2 ${tone} ${recommended ? "animate-pulse ring-2 ring-amber-300" : ""} ${selectedFuelSlot === index ? "ring-4 ring-violet-300" : ""}`}
                >
                  SLOT {index + 1}
                  <br />
                  {state}
                </Button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            <MaintainedSwitch
              label="REFUELER LOCK"
              on={refuelLock}
              onChange={(on) => {
                setRefuelLock(on);
                if (on) setDrive(false);
              }}
            />
            <MaintainedSwitch
              label="DRIVING MODE"
              on={drive}
              onChange={(on) => {
                if (!refuelLock) setDrive(on);
              }}
            />
            <SpringButton
              label="ROD SWAP"
              disabled={
                !refuelLock ||
                drive ||
                selectedFuelSlot === null
              }
              onClick={() => {
                if (selectedFuelSlot === null) return;
                setFuelSlots(
                  (old) =>
                    old.map((slot, index) =>
                      index === selectedFuelSlot ? 10 : slot,
                    ) as [number, number, number, number],
                );
                setSelectedFuelSlot(null);
                setCraneAtTarget(false);
                setRefuelPhase("dump");
              }}
            />
            <SpringButton
              label="DUMP EMPTY ROD"
              disabled={
                refuelPhase !== "dump" || !refuelLock || drive || !craneAtTarget
              }
              onClick={() => {
                setCraneAtTarget(false);
                setRefuelPhase("pickup");
              }}
            />
            <SpringButton
              label="LOAD FULL ROD"
              disabled={
                refuelPhase !== "pickup" ||
                !refuelLock ||
                drive ||
                !craneAtTarget ||
                selectedFuelSlot === null ||
                fuelSlots[selectedFuelSlot] >= 90
              }
              onClick={() => {
                if (selectedFuelSlot === null) return;
                setFuelSlots(
                  (old) =>
                    old.map((value, index) =>
                      index === selectedFuelSlot ? 100 : value,
                    ) as [number, number, number, number],
                );
                setSelectedFuelSlot(null);
                setCraneAtTarget(false);
                setRefuelPhase("target");
                setRefuelTarget(freshRefuelTarget());
              }}
            />
          </div>
        </div>
        <div className="rounded border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-300">
          <p className="font-bold text-violet-200">Player-operated sequence</p>
          <p className="mt-2">
            Follow the amber destination: drive to the appointed rod, lock and
            select the blinking blue slot, then swap. Next, follow the arrow to
            the empty-rod pool and dump the removed rod. Finally drive to the
            full-rod pool, load a fresh rod, and the refueller appoints a new
            target. This process may occur while running, but crane activity at
            the core reduces rod effectiveness.
          </p>
        </div>
      </CardContent>
    </Card>
  );
  const terminal = (
    <Card className="border-emerald-500/30 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-emerald-200">
          Operations Terminal — Grid Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="min-h-64 rounded border border-emerald-900 bg-[#020b08] p-4 text-sm text-emerald-200">
          {terminalLog.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            runTerminal();
          }}
        >
          <input
            className="min-w-0 flex-1 rounded border border-emerald-700 bg-black px-3 py-2 text-emerald-100"
            value={terminalInput}
            onChange={(event) => setTerminalInput(event.target.value)}
            placeholder="CONFIG 1"
          />
          <Button type="submit">EXECUTE</Button>
        </form>
        <p className="text-xs text-slate-400">
          1: External normal · 2: Turbine islanding · 3: External Primary + EDG
          Auxiliary/DC · 4: Emergency EDG · 5: Blackout/maintenance.
        </p>
      </CardContent>
    </Card>
  );
  const corporate = (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="border-sky-500/30 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-sky-200">Corporate meeting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MaintainedSwitch
            label="MEETING IN SESSION"
            on={meetingOpen}
            onChange={setMeetingOpen}
          />
          <p className="text-sm text-slate-300">
            Policies are approved only while a meeting is in session. They are
            local training rules for this Naramo archive entry.
          </p>
          {(
            [
              [
                "hazardPay",
                "HAZARD PAY ACT",
                "Pays a 2× training bonus while the reactor is at or above 2,400 K.",
              ],
              [
                "stabilityBonus",
                "STABILITY BONUS",
                "Awards a bonus when a power order is held inside tolerance.",
              ],
              [
                "safetyFirst",
                "SAFETY FIRST ACT",
                "Highlights temperature/relief warnings earlier at 2,200 K.",
              ],
            ] as const
          ).map(([key, title, description]) => (
            <div
              key={key}
              className="rounded border border-slate-700 bg-slate-950/70 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-100">{title}</p>
                  <p className="text-xs text-slate-400">{description}</p>
                </div>
                <Button
                  size="sm"
                  variant={policies[key] ? "default" : "outline"}
                  disabled={!meetingOpen}
                  onClick={() =>
                    setPolicies((old) => ({ ...old, [key]: !old[key] }))
                  }
                >
                  {policies[key] ? "APPROVED" : "VOTE"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="border-amber-500/30 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-amber-200">Policy status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Meter
            label="HAZARD PAY"
            value={
              policies.hazardPay
                ? temp >= 2400
                  ? "2× ACTIVE"
                  : "APPROVED"
                : "NOT APPROVED"
            }
            tone={policies.hazardPay ? "text-amber-300" : "text-slate-400"}
          />
          <Meter
            label="STABILITY BONUS"
            value={policies.stabilityBonus ? "APPROVED" : "NOT APPROVED"}
            tone={
              policies.stabilityBonus ? "text-emerald-300" : "text-slate-400"
            }
          />
          <Meter
            label="SAFETY FIRST"
            value={policies.safetyFirst ? "APPROVED" : "NOT APPROVED"}
            tone={policies.safetyFirst ? "text-cyan-300" : "text-slate-400"}
          />
        </CardContent>
      </Card>
    </div>
  );
  const manual = (
    <Card className="border-cyan-500/30 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-cyan-200">Naramo operator guide</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {NARAMO_LESSONS.map(([title], index) => (
            <Button
              key={title}
              size="sm"
              variant={manualStep === index ? "default" : "outline"}
              onClick={() => setManualStep(index)}
            >
              STEP {index + 1}
            </Button>
          ))}
        </div>
        <div className="rounded border border-cyan-500/25 bg-slate-950/70 p-5">
          <p className="text-xs font-black tracking-[.2em] text-cyan-300">
            OPERATOR TRAINING · {manualStep + 1}/{NARAMO_LESSONS.length}
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {NARAMO_LESSONS[manualStep][0]}
          </h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-300">
            {NARAMO_LESSONS[manualStep][1]}
          </p>
        </div>
        <div className="flex justify-between">
          <Button
            variant="outline"
            disabled={!manualStep}
            onClick={() => setManualStep((value) => value - 1)}
          >
            PREVIOUS
          </Button>
          <Button
            disabled={manualStep === NARAMO_LESSONS.length - 1}
            onClick={() => setManualStep((value) => value + 1)}
          >
            NEXT
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  const content =
    tab === "board" ? (
      board
    ) : tab === "reactor" ? (
      reactor
    ) : tab === "turbine" ? (
      <div className="grid gap-5 xl:grid-cols-2">
        {turbinePanel(0)}
        {turbinePanel(1)}
      </div>
    ) : tab === "grid" ? (
      grid
    ) : tab === "safety" ? (
      safety
    ) : tab === "refuel" ? (
      refuel
    ) : tab === "terminal" ? (
      terminal
    ) : tab === "manual" ? (
      manual
    ) : (
      corporate
    );
  return (
    <main className="min-h-screen bg-[#08110f] p-4 font-mono text-slate-100 md:p-7">
      <header className="mx-auto mb-5 flex max-w-7xl flex-col justify-between gap-4 border-b border-emerald-500/30 pb-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black tracking-[.3em] text-emerald-400">
            REACTOR GAME ARCHIVE // ANRO
          </p>
          <h1 className="text-3xl font-black">Naramo Plant Simulator</h1>
          <p className="mt-1 text-sm text-slate-400">
            Two-turbine aggregate-rod training simulator
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>
            RESET PLANT
          </Button>
          <Button
            className="bg-cyan-500 text-slate-950 hover:bg-cyan-300"
            onClick={() => window.location.assign("/archive")}
          >
            ARCHIVE
          </Button>
        </div>
      </header>
      <section className="mx-auto mb-5 flex max-w-7xl flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm">
        <Activity className="h-4 w-4 text-emerald-300" />
        <span>{ignited ? "REACTOR IGNITED" : "COLD SHUTDOWN"}</span>
        <span className={meltdown ? "text-red-300" : "text-emerald-300"}>
          {meltdown ? "MELTDOWN RESPONSE ACTIVE" : "PROTECTION MONITORING"}
        </span>
        {powerLocked && (
          <span className="text-amber-200">GRID SOURCE POWER-LOCKED</span>
        )}
        <span className="text-cyan-200">
          {operatorName} · {operatorPoints.toFixed(1)} PTS
        </span>
        <span className="ml-auto text-slate-400">
          CONFIG {gridConfig} ·{" "}
          {external
            ? "EXTERNAL AVAILABLE"
            : turbineSupply
              ? "TURBINE ISLANDING"
              : generators
                ? "EDG EMERGENCY"
                : "BLACKOUT"}
        </span>
      </section>
      <nav className="mx-auto mb-5 flex max-w-7xl gap-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/80 p-2">
        {(
          [
            "board",
            "reactor",
            "turbine",
            "grid",
            "safety",
            "refuel",
            "terminal",
            "manual",
            "corporate",
          ] as Tab[]
        ).map((id) => (
          <Button
            key={id}
            variant={tab === id ? "default" : "ghost"}
            onClick={() => setTab(id)}
            className={
              tab === id ? "bg-emerald-400 text-slate-950" : "text-slate-300"
            }
          >
            {id === "board"
              ? "MAIN BOARD"
              : id === "terminal"
                ? "OPS TERMINAL"
                : id === "manual"
                  ? "OPERATOR GUIDE"
                  : id === "corporate"
                    ? "CORPORATE"
                    : id.toUpperCase()}
          </Button>
        ))}
      </nav>
      <section className="mx-auto max-w-7xl">{content}</section>
    </main>
  );
}
