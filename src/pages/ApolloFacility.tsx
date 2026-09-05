import { useEffect, useMemo, useRef, useState } from "react";
import { Bolt, Cpu, FlaskConical, Gauge, ShieldAlert } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MaintainedSwitch, SpringButton } from "@/components/HardwareControls";

type Conductor = {
  name: "ALPHA" | "BETA" | "GAMMA" | "DELTA";
  discharge: number;
  temperature: number;
  integrity: number;
};

type PumpState = "OFF" | "STARTING" | "ON" | "STOPPING" | "COOLDOWN";
type CoolantPump = { state: PumpState; changedAt: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const Meter = ({
  label,
  value,
  unit,
  tone = "text-cyan-200",
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: string;
}) => (
  <div className="rounded border border-slate-700 bg-slate-950/80 p-3">
    <p className="text-[10px] font-black tracking-[0.16em] text-slate-400">
      {label}
    </p>
    <p className={`mt-1 text-2xl font-black ${tone}`}>
      {value}
      {unit && <span className="ml-1 text-sm">{unit}</span>}
    </p>
  </div>
);

const initialConductors: Conductor[] = ["ALPHA", "BETA", "GAMMA", "DELTA"].map(
  (name) => ({ name, discharge: 8_000, temperature: 310, integrity: 100 }),
);

export default function ApolloFacility() {
  const { pathname } = useLocation();
  const view = pathname.endsWith("/tner")
    ? "tner"
    : pathname.endsWith("/central")
      ? "central"
      : "overview";
  const [centralOnline, setCentralOnline] = useState(false);
  const [generatorFuel, setGeneratorFuel] = useState([0, 0, 0]);
  const [generatorKey, setGeneratorKey] = useState([false, false, false]);
  const [generatorRunning, setGeneratorRunning] = useState([
    false,
    false,
    false,
  ]);
  const [phase, setPhase] = useState([7, -5, 4]);
  const [gridBreakers, setGridBreakers] = useState([false, false, false]);
  const [batteryConnected, setBatteryConnected] = useState(false);
  const [batteryCharge, setBatteryCharge] = useState(100);
  const [sectorControls, setSectorControls] = useState([true, true, true]);
  const [coolantCheck, setCoolantCheck] = useState(false);
  const [crcKeyInserted, setCrcKeyInserted] = useState(false);
  const [crcKeyTurned, setCrcKeyTurned] = useState(false);
  const [coolantPumps, setCoolantPumps] = useState<CoolantPump[]>(() =>
    Array.from({ length: 4 }, () => ({ state: "OFF", changedAt: 0 })),
  );
  const [energyStore, setEnergyStore] = useState(0);
  const [conductors, setConductors] = useState(initialConductors);
  const [nextConductor, setNextConductor] = useState(0);
  const conductorsRef = useRef(conductors);
  const nextConductorRef = useRef(nextConductor);
  const [massDriverAccess, setMassDriverAccess] = useState(false);
  const [massKeys, setMassKeys] = useState([false, false, false, false]);
  const [massKeysTurned, setMassKeysTurned] = useState([
    false,
    false,
    false,
    false,
  ]);
  const [massBrakes, setMassBrakes] = useState([false, false, false, false]);
  const [purgePrimed, setPurgePrimed] = useState([false, false, false, false]);
  const [purgeEnabled, setPurgeEnabled] = useState(false);
  const [tnerServers, setTnerServers] = useState([false, false, false]);
  const [tnerGeneratorPulls, setTnerGeneratorPulls] = useState(0);
  const [tnerGeneratorOn, setTnerGeneratorOn] = useState(false);
  const [startupCodeEntered, setStartupCodeEntered] = useState(false);
  const [driverCylinderOpen, setDriverCylinderOpen] = useState(false);
  const [driverKeycardInserted, setDriverKeycardInserted] = useState(false);
  const [driverBreaker, setDriverBreaker] = useState(false);
  const [driverSwitchPulled, setDriverSwitchPulled] = useState(false);
  const [fuelContainerHeld, setFuelContainerHeld] = useState(false);
  const [fuelSlots, setFuelSlots] = useState([
    { loaded: false, locked: false },
    { loaded: false, locked: false },
    { loaded: false, locked: false },
  ]);
  const [fuseHatchClosed, setFuseHatchClosed] = useState(false);
  const [superchargerActive, setSuperchargerActive] = useState(false);
  const [flywheelOutput, setFlywheelOutput] = useState(0);
  const [fesActive, setFesActive] = useState(false);
  const [fuses, setFuses] = useState([true, true, true, true]);
  const [fuseFive, setFuseFive] = useState(true);
  const [fuseFiveBypassed, setFuseFiveBypassed] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [shutdownCodeEntered, setShutdownCodeEntered] = useState(false);
  const [shutdownCylinderOpen, setShutdownCylinderOpen] = useState(false);
  const [shutdownKeycard, setShutdownKeycard] = useState(false);
  const [shutdownBreaker, setShutdownBreaker] = useState(false);
  const [shutdownSwitch, setShutdownSwitch] = useState(false);
  const [unstableMode, setUnstableMode] = useState(false);
  const [overloadCylinderOpen, setOverloadCylinderOpen] = useState(false);
  const [overloadKeycard, setOverloadKeycard] = useState(false);
  const [overloadBreaker, setOverloadBreaker] = useState(false);
  const [tnerOnline, setTnerOnline] = useState(false);
  const [tnerCooling, setTnerCooling] = useState(false);
  const [tnerFuel, setTnerFuel] = useState(100);
  const [tnerTemp, setTnerTemp] = useState(25);
  const [tnerThrottle, setTnerThrottle] = useState(1);
  const [overload, setOverload] = useState(false);

  const allGeneratorsOnGrid = gridBreakers.every(Boolean);
  const sectorMasterPower = allGeneratorsOnGrid || centralOnline;
  const facilityBus =
    sectorMasterPower || (batteryConnected && batteryCharge > 0);
  const coolantOnline = coolantPumps.filter(
    (pump) => pump.state === "ON",
  ).length;
  const coolantPower = coolantOnline * 25;
  const criticalCapacity = energyStore > 100_000;
  const capacityRate =
    energyStore <= 100_000
      ? 1
      : 1 + clamp((energyStore - 100_000) / 18_000, 0, 19);
  const rapidDischarge = energyStore >= 300_000;
  const crcStartReady =
    sectorMasterPower &&
    sectorControls[0] &&
    sectorControls[1] &&
    coolantCheck &&
    crcKeyInserted &&
    crcKeyTurned;
  const tnerSectorPower = tnerGeneratorOn && tnerServers.every(Boolean);
  const fuseSystemReady = fuses.every(Boolean) && fuseFive;
  const overloadReady =
    tnerOnline &&
    !fuseHatchClosed &&
    fuses.every((fuse) => !fuse) &&
    tnerThrottle === 5 &&
    fesActive &&
    superchargerActive;
  const fuelReady = fuelSlots.every((slot) => slot.loaded && slot.locked);
  const tnerReady =
    tnerSectorPower &&
    startupCodeEntered &&
    driverCylinderOpen &&
    driverKeycardInserted &&
    driverBreaker &&
    driverSwitchPulled &&
    fuelReady &&
    fuseHatchClosed &&
    fuseSystemReady &&
    tnerFuel > 10;
  const centralOutput = conductors.reduce(
    (sum, conductor) => sum + (centralOnline ? conductor.discharge : 0),
    0,
  );
  const tnerOutput = tnerOnline ? tnerThrottle * 18_000 : 0;
  const facilityLoad = coolantOnline * 627 + (tnerOnline ? 12_000 : 0);
  const tnerStatus = !tnerOnline
    ? "OFFLINE"
    : overload
      ? "OVERLOAD"
      : tnerTemp > 3_600
        ? "UNSTABLE"
        : "ONLINE";

  useEffect(() => {
    conductorsRef.current = conductors;
  }, [conductors]);

  useEffect(() => {
    nextConductorRef.current = nextConductor;
  }, [nextConductor]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (centralOnline) {
        setEnergyStore((value) =>
          clamp(
            value +
              1_700 *
                (value > 100_000
                  ? 1 + clamp((value - 100_000) / 18_000, 0, 19)
                  : 1) -
              facilityLoad * 0.08,
            0,
            999_000,
          ),
        );
      }
      setBatteryCharge((value) => {
        if (centralOnline && batteryConnected)
          return clamp(value + 0.12, 0, 100);
        if (batteryConnected && !allGeneratorsOnGrid && !centralOnline)
          return clamp(value - 0.18, 0, 100);
        return value;
      });
      setCoolantPumps((items) => {
        const now = Date.now();
        return items.map((pump) => {
          const elapsed = now - pump.changedAt;
          if (pump.state === "STARTING" && elapsed >= 3_000)
            return { state: "ON", changedAt: now };
          if (pump.state === "STOPPING" && elapsed >= 5_000)
            return { state: "COOLDOWN", changedAt: now };
          if (pump.state === "COOLDOWN" && elapsed >= 2_000)
            return { state: "OFF", changedAt: now };
          return pump;
        });
      });
      setConductors((current) =>
        current.map((conductor) => {
          const cooling =
            coolantOnline && centralOnline ? coolantOnline * 4 : 3;
          const heat = centralOnline
            ? Math.max(0, (conductor.discharge - 10_000) / 950) +
              (criticalCapacity ? 4 + (energyStore - 100_000) / 25_000 : 0)
            : 0;
          const temperature = clamp(
            conductor.temperature + heat - cooling,
            20,
            4_000,
          );
          const integrityLoss =
            conductor.discharge >= 12_000 && centralOnline
              ? (conductor.discharge - 11_000) / 12_000
              : 0;
          return {
            ...conductor,
            temperature,
            integrity: clamp(conductor.integrity - integrityLoss, 0, 100),
          };
        }),
      );
      if (tnerOnline) {
        const heat =
          tnerThrottle * (overload ? 58 : 24) + (superchargerActive ? 6 : 0);
        const cooling = tnerCooling ? 34 : 4;
        setTnerTemp((value) => clamp(value + heat - cooling, 20, 5_000));
        setTnerFuel((value) =>
          clamp(
            value - tnerThrottle * (overload ? 1.4 : fesActive ? 0.18 : 0.32),
            0,
            100,
          ),
        );
      } else {
        setTnerTemp((value) =>
          clamp(value - (tnerCooling ? 18 : 4), 20, 5_000),
        );
      }
      setFlywheelOutput((value) =>
        clamp(value + (superchargerActive ? 75 : -120), 0, 800),
      );
    }, 500);
    return () => window.clearInterval(timer);
  }, [
    centralOnline,
    allGeneratorsOnGrid,
    batteryConnected,
    criticalCapacity,
    coolantOnline,
    energyStore,
    facilityLoad,
    overload,
    fesActive,
    superchargerActive,
    tnerCooling,
    tnerOnline,
    tnerThrottle,
  ]);

  useEffect(() => {
    if (tnerOnline && (tnerFuel <= 0 || tnerTemp >= 4_000))
      setTnerOnline(false);
    if (tnerOnline && tnerTemp >= 3_600) setOverload(true);
  }, [tnerFuel, tnerOnline, tnerTemp]);

  useEffect(() => {
    if (tnerOnline && !fuseFive) {
      setOverload(true);
      setUnstableMode(true);
    }
  }, [fuseFive, tnerOnline]);

  useEffect(() => {
    if (coolantOnline < 2 && coolantCheck) setCoolantCheck(false);
  }, [coolantCheck, coolantOnline]);

  useEffect(() => {
    if (!centralOnline) return;
    const timer = window.setInterval(
      () => {
        const conductor = conductorsRef.current[nextConductorRef.current];
        setEnergyStore((value) => Math.max(0, value - conductor.discharge));
        setConductors((items) =>
          items.map((item, index) =>
            index === nextConductorRef.current
              ? {
                  ...item,
                  temperature: clamp(
                    item.temperature + (item.discharge - 8_000) / 140,
                    20,
                    4_000,
                  ),
                  integrity: clamp(
                    item.integrity -
                      Math.max(0, item.discharge - 11_000) / 2_000,
                    0,
                    100,
                  ),
                }
              : item,
          ),
        );
        setNextConductor(() => {
          const next =
            (nextConductorRef.current + 1) % conductorsRef.current.length;
          nextConductorRef.current = next;
          return next;
        });
      },
      rapidDischarge ? 600 : 2_500,
    );
    return () => window.clearInterval(timer);
  }, [centralOnline, rapidDischarge]);

  useEffect(() => {
    if (!purgeEnabled) return;
    const timer = window.setInterval(() => {
      setEnergyStore((value) => {
        if (value <= 50_000) {
          setPurgeEnabled(false);
          return 50_000;
        }
        return Math.max(50_000, value - 28_000);
      });
      setConductors((items) =>
        items.map((item) => ({
          ...item,
          temperature: clamp(item.temperature - 48, 20, 4_000),
        })),
      );
    }, 180);
    return () => window.clearInterval(timer);
  }, [purgeEnabled]);

  const alarms = useMemo(
    () =>
      [
        !facilityBus && "FACILITY BUS UNPOWERED",
        !sectorMasterPower && "SECTOR MASTER POWER OFFLINE",
        energyStore < 20_000 && "CENTRAL STORE LOW",
        conductors.some((item) => item.integrity < 50) &&
          "CONDUCTOR INTEGRITY LOW",
        tnerOnline && !tnerCooling && "TNER COOLING OFFLINE",
        overload && "TNER OVERLOAD",
      ].filter(Boolean) as string[],
    [
      conductors,
      energyStore,
      facilityBus,
      overload,
      sectorMasterPower,
      tnerCooling,
      tnerOnline,
    ],
  );

  const adjustConductor = (index: number, amount: number) =>
    setConductors((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              discharge: clamp(item.discharge + amount, 1_000, 16_000),
            }
          : item,
      ),
    );
  const startGenerator = (index: number) => {
    if (generatorKey[index] && generatorFuel[index] > 0)
      setGeneratorRunning((items) =>
        items.map((item, itemIndex) => (itemIndex === index ? true : item)),
      );
  };
  const adjustPhase = (index: number, direction: "lead" | "lag") =>
    setPhase((items) =>
      items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (direction === "lead") return item > 0 ? item - 1 : item + 1;
        return item < 0 ? item + 1 : item - 1;
      }),
    );
  const togglePump = (index: number) =>
    setCoolantPumps((items) =>
      items.map((pump, itemIndex) => {
        if (itemIndex !== index) return pump;
        const now = Date.now();
        if (pump.state === "OFF") return { state: "STARTING", changedAt: now };
        if (pump.state === "ON" || pump.state === "STARTING")
          return { state: "STOPPING", changedAt: now };
        return pump;
      }),
    );

  return (
    <main className="min-h-screen bg-[#070b16] p-4 font-mono text-slate-100 md:p-8">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-cyan-500/30 pb-5">
        <div>
          <p className="text-[10px] font-black tracking-[.28em] text-cyan-300">
            REACTOR GAME ARCHIVE · APOLLO FACILITY
          </p>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-black">
            <Cpu className="text-cyan-300" /> COMPUTER CORE APOLLO
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Two linked energy installations. The Central array is a
            discharge-conductor system, not a conventional nuclear reactor.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/archive">RETURN TO ARCHIVE</Link>
        </Button>
      </header>

      <nav className="mx-auto mt-5 flex max-w-7xl flex-wrap gap-2">
        {[
          { to: "/apollo", label: "FACILITY" },
          { to: "/apollo/central", label: "CENTRAL CONDUCTORS" },
          { to: "/apollo/tner", label: "TNER" },
        ].map((tab) => (
          <Button
            key={tab.to}
            asChild
            variant={pathname === tab.to ? "default" : "outline"}
            className={
              pathname === tab.to
                ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                : ""
            }
          >
            <Link to={tab.to}>{tab.label}</Link>
          </Button>
        ))}
      </nav>

      <section className="mx-auto mt-5 grid max-w-7xl gap-4 md:grid-cols-4">
        <Meter
          label="FACILITY BUS"
          value={facilityBus ? "ENERGIZED" : "OFFLINE"}
          tone={facilityBus ? "text-emerald-300" : "text-red-300"}
        />
        <Meter
          label="CENTRAL STORE"
          value={Math.round(energyStore).toLocaleString()}
          unit="EU"
          tone={energyStore < 20_000 ? "text-red-300" : "text-cyan-200"}
        />
        <Meter
          label="CENTRAL OUTPUT"
          value={centralOnline ? (centralOutput / 1_000).toFixed(0) : 0}
          unit="kV"
        />
        <Meter
          label="TNER OUTPUT"
          value={(tnerOutput / 1_000).toFixed(0)}
          unit="MW"
          tone={tnerOnline ? "text-amber-200" : "text-slate-400"}
        />
      </section>

      {view === "overview" && (
        <section className="mx-auto mt-5 grid max-w-7xl gap-5 lg:grid-cols-2">
          <Card className="border-cyan-500/30 bg-slate-900/75">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-200">
                <Bolt /> CENTRAL DISCHARGE CONDUCTOR ARRAY
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
              <p>
                Four conductor modules build facility energy and can discharge
                it in controlled pulses. High discharge coefficients heat and
                damage individual conductors; the shared coolant pump removes
                heat.
              </p>
              <Button
                asChild
                className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
              >
                <Link to="/apollo/central">OPEN CENTRAL ARRAY</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="border-amber-500/30 bg-slate-900/75">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-200">
                <FlaskConical /> TNER EXPERIMENTAL UNIT
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
              <p>
                TNER is a separate fuelled experimental power system. Its start
                permissives include the facility bus, three supporting servers,
                fuel cells, fuse five and the locked fuel hatch.
              </p>
              <Button
                asChild
                className="bg-amber-300 text-slate-950 hover:bg-amber-200"
              >
                <Link to="/apollo/tner">OPEN TNER</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {view === "central" && (
        <section className="mx-auto mt-5 max-w-7xl space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="border-amber-500/30 bg-slate-900/75">
              <CardHeader>
                <CardTitle>ELECTRICAL ROOM · STARTUP BUS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-start gap-5">
                  <MaintainedSwitch
                    label="MAIN BATTERY GRID CONNECT"
                    on={batteryConnected}
                    onChange={setBatteryConnected}
                    tooltip="Connects the charged main battery to the facility bus. It is a temporary source until the three emergency generators are synchronized."
                  />
                  <Meter
                    label="BATTERY CHARGE"
                    value={batteryCharge.toFixed(1)}
                    unit="%"
                    tone={batteryCharge < 15 ? "text-red-300" : "text-cyan-200"}
                  />
                  <SpringButton
                    label="FILL ALL EDG TANKS"
                    onClick={() => setGeneratorFuel([100, 100, 100])}
                    tooltip="Fills the three initially empty emergency-generator fuel tanks for this training simulator."
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {generatorFuel.map((fuel, index) => {
                    const synchronized =
                      generatorRunning[index] && Math.abs(phase[index]) <= 1;
                    return (
                      <div
                        key={index}
                        className="rounded border border-slate-700 bg-slate-950/70 p-3"
                      >
                        <p className="text-xs font-black text-slate-200">
                          EMERGENCY GENERATOR {index + 1}
                        </p>
                        <p className="mt-1 text-sm text-cyan-200">
                          FUEL {fuel.toFixed(0)}% · PHASE{" "}
                          {phase[index] > 0 ? "+" : ""}
                          {phase[index]}°
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <MaintainedSwitch
                            label="IGNITION KEY"
                            on={generatorKey[index]}
                            onChange={(on) =>
                              setGeneratorKey((items) =>
                                items.map((item, itemIndex) =>
                                  itemIndex === index ? on : item,
                                ),
                              )
                            }
                            tooltip="Inserts and turns this generator's ignition key. Fuel and the key are required before it can start."
                          />
                          <SpringButton
                            label={
                              generatorRunning[index]
                                ? "RUNNING"
                                : "TURN / START"
                            }
                            onClick={() => startGenerator(index)}
                            disabled={
                              generatorRunning[index] ||
                              !generatorKey[index] ||
                              fuel <= 0
                            }
                            tooltip="Starts this fuelled generator after its ignition key has been turned."
                          />
                          <Button
                            variant="outline"
                            onClick={() => adjustPhase(index, "lag")}
                            disabled={!generatorRunning[index]}
                          >
                            REDUCE LAG
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => adjustPhase(index, "lead")}
                            disabled={!generatorRunning[index]}
                          >
                            REDUCE LEAD
                          </Button>
                          <MaintainedSwitch
                            label="SYNC GRID BRK"
                            on={gridBreakers[index]}
                            disabled={!synchronized}
                            onChange={(on) =>
                              setGridBreakers((items) =>
                                items.map((item, itemIndex) =>
                                  itemIndex === index ? on : item,
                                ),
                              )
                            }
                            tooltip="Closes this generator's grid breaker only when the local synchronoscope is within one degree of phase alignment."
                          />
                        </div>
                        <p
                          className={
                            synchronized
                              ? "mt-2 text-[10px] font-black text-emerald-300"
                              : "mt-2 text-[10px] font-black text-red-300"
                          }
                        >
                          {synchronized ? "SYNC WINDOW" : "OUT OF SYNC"}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div
                  className={`rounded border p-3 text-sm font-black ${sectorMasterPower ? "border-emerald-400/50 bg-emerald-950/30 text-emerald-300" : "border-red-500/40 bg-red-950/30 text-red-200"}`}
                >
                  SECTOR MASTER POWER:{" "}
                  {sectorMasterPower ? "ENERGIZED" : "OFFLINE"}
                </div>
                <div className="flex flex-wrap gap-4">
                  {["CENTRAL CONTROL", "COOLANT SECTOR", "FACILITY SECTOR"].map(
                    (label, index) => (
                      <MaintainedSwitch
                        key={label}
                        label={label}
                        on={sectorControls[index]}
                        disabled={!sectorMasterPower}
                        onChange={(on) =>
                          setSectorControls((items) =>
                            items.map((item, itemIndex) =>
                              itemIndex === index ? on : item,
                            ),
                          )
                        }
                        tooltip={`Supplies Sector Master Power to the ${label.toLowerCase()} machinery group.`}
                      />
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border-cyan-500/30 bg-slate-900/75">
              <CardHeader>
                <CardTitle>CENTRAL DISCHARGE ARRAY</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-start gap-5">
                  <MaintainedSwitch
                    label="CRC IGNITION KEY INSERTED"
                    on={crcKeyInserted}
                    disabled={centralOnline || !sectorMasterPower}
                    onChange={(on) => {
                      setCrcKeyInserted(on);
                      if (!on) setCrcKeyTurned(false);
                    }}
                    tooltip="Inserts the Central Reactor Core ignition key. The key must be inserted and turned after a successful coolant check."
                  />
                  <SpringButton
                    label="TURN CRC KEY"
                    onClick={() => setCrcKeyTurned(true)}
                    disabled={
                      centralOnline || !crcKeyInserted || coolantOnline < 2
                    }
                    tooltip="Turns the inserted CRC ignition key. At least two fully running coolant pumps are required before the key can be turned."
                  />
                  <SpringButton
                    label={
                      centralOnline ? "SHUT DOWN CRC" : "CRC CONTROL · START"
                    }
                    variant={centralOnline ? "danger" : "default"}
                    onClick={() => {
                      if (centralOnline) setCentralOnline(false);
                      else {
                        setEnergyStore(40_000);
                        setCentralOnline(true);
                      }
                    }}
                    disabled={!centralOnline && !crcStartReady}
                    tooltip={
                      centralOnline
                        ? "Shuts down the Central Discharge Conductor Array."
                        : "Starts CRC only after Sector Master Power, two running coolant pumps, coolant check, and the turned ignition key are all present."
                    }
                  />
                  <Meter
                    label="DISPLAYED BUILDUP"
                    value={(
                      Math.round(energyStore / 1_000) * 1_000
                    ).toLocaleString()}
                    unit="V"
                    tone="text-amber-200"
                  />
                  <Meter
                    label="COOLANT POWER"
                    value={coolantPower}
                    unit="%"
                    tone={
                      coolantPower >= 50 ? "text-emerald-300" : "text-red-300"
                    }
                  />
                  <Meter
                    label="NEXT AUTO DISCHARGE"
                    value={conductors[nextConductor].name}
                    tone="text-violet-200"
                  />
                  <SpringButton
                    label="PRIME ARRAY"
                    onClick={() => {
                      if (centralOnline && energyStore >= 8_100)
                        setConductors((items) =>
                          items.map((item) => ({ ...item, discharge: 8_000 })),
                        );
                    }}
                    disabled={!centralOnline}
                    tooltip="Sets every conductor's selectable discharge to 8,000 V. The actual Central buildup uses an 8,500 V cycle while the display remains rounded to 1,000 V."
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4 rounded border border-slate-700 bg-slate-950/70 p-3">
                  <SpringButton
                    label={
                      coolantCheck
                        ? "COOLANT CHECK PASSED"
                        : "RUN COOLANT CHECK"
                    }
                    onClick={() => setCoolantCheck(true)}
                    disabled={coolantOnline < 2 || coolantCheck}
                    tooltip="Available only with at least two pumps fully running. Confirms the 50% or higher coolant-power startup requirement for CRC."
                  />
                  <p
                    className={
                      coolantCheck
                        ? "text-xs font-black text-emerald-300"
                        : "text-xs font-black text-amber-200"
                    }
                  >
                    COOLANT CHECK:{" "}
                    {coolantCheck
                      ? "PASSED"
                      : coolantOnline >= 2
                        ? "AVAILABLE"
                        : "REQUIRES 2 RUNNING PUMPS"}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {coolantPumps.map((pump, index) => (
                    <div
                      key={index}
                      className="rounded border border-slate-700 bg-slate-950/70 p-3"
                    >
                      <p className="text-xs font-black text-slate-300">
                        COOLANT PUMP {index + 1}
                      </p>
                      <p
                        className={
                          pump.state === "ON"
                            ? "mt-1 text-sm font-black text-emerald-300"
                            : "mt-1 text-sm font-black text-amber-200"
                        }
                      >
                        {pump.state} · {pump.state === "ON" ? "627 V" : "0 V"}
                      </p>
                      <Button
                        className="mt-3"
                        variant="outline"
                        disabled={
                          !sectorMasterPower ||
                          !sectorControls[1] ||
                          pump.state === "COOLDOWN" ||
                          pump.state === "STOPPING"
                        }
                        onClick={() => togglePump(index)}
                      >
                        {pump.state === "ON" || pump.state === "STARTING"
                          ? "STOP PUMP"
                          : "START PUMP"}
                      </Button>
                      <p className="mt-2 text-[10px] text-slate-500">
                        3 s runup · 5 s shutdown · 2 s restart cooldown
                      </p>
                    </div>
                  ))}
                </div>
                <div className="rounded border border-red-500/40 bg-red-950/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black tracking-wider text-red-200">
                        MASS DRIVER / PURGE SEQUENCE
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Critical capacity accelerates buildup and heating. At
                        300 kV, access the conductor safety panels; at 500 kV,
                        enable the Control Room purge.
                      </p>
                    </div>
                    <SpringButton
                      label={
                        massDriverAccess
                          ? "MASS DRIVER ACCESS OPEN"
                          : "MASS DRIVER ACCESS"
                      }
                      onClick={() => {
                        setMassDriverAccess(true);
                        setConductors((items) =>
                          items.map((item) => ({ ...item, discharge: 8_000 })),
                        );
                      }}
                      disabled={energyStore < 300_000 || massDriverAccess}
                      tooltip="At 300 kV, opens the four conductor safety panels and resets every selectable conductor discharge to 8,000 V."
                    />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {conductors.map((conductor, index) => (
                      <div
                        key={conductor.name}
                        className="rounded border border-slate-700 bg-slate-950/75 p-3"
                      >
                        <p className="text-xs font-black text-slate-300">
                          {conductor.name} SAFETY PANEL ·{" "}
                          {massDriverAccess ? "UNCOVERED" : "COVERED"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <MaintainedSwitch
                            label="SECURITY KEY INSERTED"
                            on={massKeys[index]}
                            disabled={!massDriverAccess}
                            onChange={(on) => {
                              setMassKeys((items) =>
                                items.map((item, itemIndex) =>
                                  itemIndex === index ? on : item,
                                ),
                              );
                              if (!on)
                                setMassKeysTurned((items) =>
                                  items.map((item, itemIndex) =>
                                    itemIndex === index ? false : item,
                                  ),
                                );
                            }}
                            tooltip="Inserts this conductor's Mass Driver security key after Mass Driver Access has removed the safety-panel cover."
                          />
                          <SpringButton
                            label="TURN SECURITY KEY"
                            onClick={() =>
                              setMassKeysTurned((items) =>
                                items.map((item, itemIndex) =>
                                  itemIndex === index ? true : item,
                                ),
                              )
                            }
                            disabled={
                              !massDriverAccess ||
                              !massKeys[index] ||
                              massKeysTurned[index]
                            }
                            tooltip="Turns the inserted conductor security key, permitting its Mass Driver Brake to be lowered."
                          />
                          <MaintainedSwitch
                            label="MASS DRIVER BRAKE"
                            on={massBrakes[index]}
                            disabled={!massKeysTurned[index]}
                            onChange={(on) =>
                              setMassBrakes((items) =>
                                items.map((item, itemIndex) =>
                                  itemIndex === index ? on : item,
                                ),
                              )
                            }
                            tooltip="Lowers this conductor's Mass Driver Brake after its security key is inserted and turned."
                          />
                          <SpringButton
                            label={
                              purgePrimed[index]
                                ? "PURGE PRIMED"
                                : "PRIME PURGE"
                            }
                            onClick={() =>
                              setPurgePrimed((items) =>
                                items.map((item, itemIndex) =>
                                  itemIndex === index ? true : item,
                                ),
                              )
                            }
                            disabled={!massBrakes[index] || purgePrimed[index]}
                            tooltip="Primes this conductor for the simultaneous Control Room purge."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <SpringButton
                      label={
                        purgeEnabled
                          ? "PURGE ACTIVE"
                          : "CONTROL ROOM: ENABLE PURGE"
                      }
                      variant="danger"
                      onClick={() => setPurgeEnabled(true)}
                      disabled={
                        energyStore < 500_000 ||
                        !purgePrimed.every(Boolean) ||
                        purgeEnabled
                      }
                      tooltip="At 500 kV, after all four conductor purges are primed, rapidly discharges every conductor until Central capacity reaches about 50 kV."
                    />
                    <p
                      className={
                        rapidDischarge
                          ? "text-xs font-black text-red-300"
                          : criticalCapacity
                            ? "text-xs font-black text-amber-200"
                            : "text-xs font-black text-slate-500"
                      }
                    >
                      {purgeEnabled
                        ? "SIMULTANEOUS PURGE IN PROGRESS"
                        : rapidDischarge
                          ? "RAPID AUTO-DISCHARGE · CAPACITY RUNAWAY"
                          : criticalCapacity
                            ? `CRITICAL BUILDUP ×${capacityRate.toFixed(1)}`
                            : "NORMAL BUILDUP"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {conductors.map((item, index) => (
              <Card
                key={item.name}
                className="border-slate-700 bg-slate-900/75"
              >
                <CardHeader>
                  <CardTitle className="flex justify-between text-base">
                    <span>{item.name} CONDUCTOR</span>
                    <span
                      className={
                        item.integrity < 50
                          ? "text-red-300"
                          : "text-emerald-300"
                      }
                    >
                      {item.integrity.toFixed(0)}% INT
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Meter
                      label="DISCHARGE"
                      value={item.discharge.toLocaleString()}
                      unit="V"
                      tone={
                        item.discharge >= 12_000
                          ? "text-red-300"
                          : "text-amber-200"
                      }
                    />
                    <Meter
                      label="TEMPERATURE"
                      value={item.temperature.toFixed(0)}
                      unit="°C"
                      tone={
                        item.temperature > 1_000
                          ? "text-red-300"
                          : "text-cyan-200"
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => adjustConductor(index, -1_000)}
                    >
                      − 1 kV
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => adjustConductor(index, 1_000)}
                    >
                      + 1 kV
                    </Button>
                    <span
                      className={
                        nextConductor === index
                          ? "inline-flex min-h-14 items-center rounded-full border-4 border-violet-950 bg-violet-400 px-6 text-sm font-black text-slate-950"
                          : "inline-flex min-h-14 items-center rounded-full border-4 border-slate-800 bg-slate-950 px-6 text-sm font-black text-slate-500"
                      }
                    >
                      {nextConductor === index
                        ? "NEXT AUTOMATIC PULSE"
                        : "AUTOMATIC CYCLE"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {view === "tner" && (
        <section className="mx-auto mt-5 grid max-w-7xl gap-5 xl:grid-cols-[320px_1fr]">
          <Card className="border-amber-500/30 bg-slate-900/75">
            <CardHeader>
              <CardTitle>TNER ELECTRICAL / STARTUP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded border border-amber-500/30 bg-slate-950/70 p-3">
                <p className="text-xs font-black tracking-wider text-amber-200">
                  TNER MINI GENERATOR
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <SpringButton
                    label={`PULL GENERATOR (${tnerGeneratorPulls}/3)`}
                    onClick={() =>
                      setTnerGeneratorPulls((value) => clamp(value + 1, 0, 3))
                    }
                    disabled={tnerGeneratorPulls >= 3 || tnerGeneratorOn}
                    tooltip="Pull the mini-generator starter exactly three times before its output switch can be turned on."
                  />
                  <MaintainedSwitch
                    label="TNER GENERATOR ON"
                    on={tnerGeneratorOn}
                    disabled={tnerGeneratorPulls < 3}
                    onChange={(on) => {
                      if (on) setTnerGeneratorOn(true);
                    }}
                    tooltip="Switches on the started TNER mini generator, supplying unlimited power to the TNER sector."
                  />
                </div>
              </div>
              <div className="rounded border border-slate-700 bg-slate-950/70 p-3">
                <p className="text-xs font-black tracking-wider text-slate-300">
                  TNER SECTOR SYSTEMS · LATCHED ONCE ENGAGED
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {["SUPERCHARGER", "FUEL SYSTEM", "COOLING SYSTEM"].map(
                    (label, index) => (
                      <MaintainedSwitch
                        key={label}
                        label={label}
                        on={tnerServers[index]}
                        disabled={!tnerGeneratorOn}
                        onChange={(on) => {
                          if (on)
                            setTnerServers((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index ? true : item,
                              ),
                            );
                        }}
                        tooltip={`Engages the ${label.toLowerCase()}. It cannot be disengaged for the remainder of the active TNER startup.`}
                      />
                    ),
                  )}
                </div>
                <p
                  className={
                    tnerSectorPower
                      ? "mt-3 text-xs font-black text-emerald-300"
                      : "mt-3 text-xs font-black text-amber-200"
                  }
                >
                  TNER SECTOR POWER: {tnerSectorPower ? "READY" : "OFFLINE"}
                </p>
              </div>
              <div className="rounded border border-slate-700 bg-slate-950/70 p-3">
                <p className="text-xs font-black tracking-wider text-slate-300">
                  FUEL ENRICHMENT · THREE FUEL SLOTS
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <SpringButton
                    label={
                      fuelContainerHeld
                        ? "FUEL CONTAINER HELD"
                        : "PICK UP FUEL CONTAINER"
                    }
                    onClick={() => setFuelContainerHeld(true)}
                    disabled={fuelContainerHeld}
                    tooltip="Picks up a fresh fuel container for insertion into an empty fuel slot."
                  />
                  <MaintainedSwitch
                    label="FUSE HATCH CLOSED"
                    on={fuseHatchClosed}
                    onChange={setFuseHatchClosed}
                    tooltip="Closes and locks the fuse hatch. The Reactor Driver will not start with it open."
                  />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {fuelSlots.map((slot, index) => (
                    <div
                      key={index}
                      className="rounded border border-slate-700 p-2"
                    >
                      <p className="text-[10px] font-black text-slate-300">
                        FUEL SLOT {index + 1}:{" "}
                        {slot.loaded
                          ? slot.locked
                            ? "LOCKED"
                            : "LOADED"
                          : "EMPTY"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!fuelContainerHeld || slot.loaded}
                          onClick={() => {
                            setFuelSlots((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { loaded: true, locked: false }
                                  : item,
                              ),
                            );
                            setFuelContainerHeld(false);
                          }}
                        >
                          INSERT
                        </Button>
                        <MaintainedSwitch
                          label="LOCK"
                          on={slot.locked}
                          disabled={!slot.loaded}
                          onChange={(on) =>
                            setFuelSlots((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, locked: on }
                                  : item,
                              ),
                            )
                          }
                          tooltip="Locks the inserted fuel container. All three slots must be loaded and locked before the Reactor Driver breaker can close."
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!slot.loaded || slot.locked}
                          onClick={() =>
                            setFuelSlots((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { loaded: false, locked: false }
                                  : item,
                              ),
                            )
                          }
                        >
                          EJECT
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded border border-violet-500/30 bg-violet-950/20 p-3">
                <p className="text-xs font-black tracking-wider text-violet-200">
                  LIVE TNER SYSTEMS
                </p>
                <div className="mt-3 flex flex-wrap gap-4">
                  <MaintainedSwitch
                    label="SUPERCHARGER ENABLE"
                    on={superchargerActive}
                    disabled={!tnerServers[0]}
                    onChange={setSuperchargerActive}
                    tooltip="Starts all eight supercharger flywheels. Their combined rotation raises TNER output voltage and adds heat."
                  />
                  <MaintainedSwitch
                    label="F.E.S. ENABLE"
                    on={fesActive}
                    disabled={!tnerServers[1]}
                    onChange={setFesActive}
                    tooltip="Enables the Fuel Enrichment System. It lowers TNER fuel consumption while active."
                  />
                  <MaintainedSwitch
                    label="RADIATOR CLAMPS"
                    on={tnerCooling}
                    disabled={!tnerServers[2]}
                    onChange={setTnerCooling}
                    tooltip="Raises and clamps all four massive radiators to the magnetic generators, activating TNER cooling."
                  />
                  <Meter
                    label="8 FLYWHEEL OUTPUT"
                    value={flywheelOutput.toFixed(0)}
                    unit="V"
                    tone={
                      superchargerActive ? "text-violet-200" : "text-slate-400"
                    }
                  />
                </div>
              </div>
              <div className="rounded border border-red-500/30 bg-red-950/20 p-3">
                <p className="text-xs font-black tracking-wider text-red-200">
                  FUSE SYSTEM
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {fuses.map((fuse, index) => (
                    <MaintainedSwitch
                      key={index}
                      label={`FUSE ${index + 1}`}
                      on={fuse}
                      disabled={fuseHatchClosed || !tnerSectorPower}
                      onChange={(on) =>
                        setFuses((items) =>
                          items.map((item, itemIndex) =>
                            itemIndex === index ? on : item,
                          ),
                        )
                      }
                      tooltip={`Fuse ${index + 1} carries the electrical spark path used for normal TNER power generation. Its control is accessible only with the fuse hatch open.`}
                    />
                  ))}
                  <SpringButton
                    label={
                      fuseFiveBypassed
                        ? "FUSE 5 BYPASS ACTIVE"
                        : "SIMULATE FUSE 5 HACK"
                    }
                    onClick={() => setFuseFiveBypassed(true)}
                    disabled={fuseFiveBypassed}
                    tooltip="Simulates bypassing the administrator lock on Fuse 5 for testing. Do not use during normal operation."
                  />
                  <MaintainedSwitch
                    label="FUSE 5 · ADMIN LOCK"
                    on={fuseFive}
                    disabled={!fuseFiveBypassed}
                    onChange={setFuseFive}
                    tooltip="Fuse 5 is administrator locked. If a bypass has been simulated and it is disabled while TNER is online, TNER immediately enters overload and safety systems are lost."
                  />
                </div>
                <p
                  className={
                    fuseSystemReady
                      ? "mt-3 text-xs font-black text-emerald-300"
                      : "mt-3 text-xs font-black text-red-300"
                  }
                >
                  SPARK SAFETY PATH: {fuseSystemReady ? "COMPLETE" : "DEGRADED"}
                </p>
              </div>
              <div className="rounded border border-cyan-500/30 bg-cyan-950/20 p-3">
                <p className="text-xs font-black tracking-wider text-cyan-200">
                  TNER START COMPUTER
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <SpringButton
                    label={
                      startupCodeEntered
                        ? "STARTUP CODE ACCEPTED"
                        : "ENTER STARTUP CODE"
                    }
                    onClick={() => setStartupCodeEntered(true)}
                    disabled={!tnerSectorPower || startupCodeEntered}
                    tooltip="Enters the required TNER startup code in the computer after the TNER sector has power."
                  />
                  <SpringButton
                    label="REACTOR DRIVER"
                    onClick={() => setDriverCylinderOpen(true)}
                    disabled={!startupCodeEntered || tnerOnline}
                    tooltip="Opens the Reactor Driver console cylinder after the startup code is accepted."
                  />
                </div>
                {driverCylinderOpen && !tnerOnline && (
                  <div className="mt-4 rounded border border-cyan-400/50 bg-slate-950 p-3">
                    <p className="text-xs font-black text-cyan-200">
                      REACTOR DRIVER CYLINDER DEPLOYED
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <MaintainedSwitch
                        label="KEYCARD INSERTED"
                        on={driverKeycardInserted}
                        onChange={setDriverKeycardInserted}
                        tooltip="Inserts the Reactor Driver keycard."
                      />
                      <MaintainedSwitch
                        label="DRIVER BREAKER"
                        on={driverBreaker}
                        disabled={!fuelReady || !fuseHatchClosed}
                        onChange={setDriverBreaker}
                        tooltip="This non-electrical breaker can only be flipped after all three fuel slots are loaded and locked and the fuse hatch is closed."
                      />
                      <SpringButton
                        label="PULL DRIVER SWITCH"
                        onClick={() => {
                          if (
                            tnerSectorPower &&
                            fuelReady &&
                            fuseHatchClosed &&
                            fuseSystemReady &&
                            driverKeycardInserted &&
                            driverBreaker
                          ) {
                            setDriverSwitchPulled(true);
                            setDriverCylinderOpen(false);
                            setTnerOnline(true);
                            setOverload(false);
                          }
                        }}
                        disabled={!driverKeycardInserted || !driverBreaker}
                        tooltip="Pulls the Reactor Driver switch. With every permissive satisfied, TNER starts and this console retracts."
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded border border-amber-500/30 bg-amber-950/20 p-3">
                <p className="text-xs font-black tracking-wider text-amber-200">
                  MAINTENANCE SHUTDOWN
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <SpringButton
                    label={
                      maintenanceMode
                        ? "MAINTENANCE MODE ACTIVE"
                        : "ENTER MAINTENANCE MODE"
                    }
                    onClick={() => setMaintenanceMode(true)}
                    disabled={!tnerOnline || tnerFuel >= 20 || maintenanceMode}
                    tooltip="Maintenance Mode is available only while TNER is online and fuel is below 20%. It begins the formal shutdown procedure."
                  />
                  <SpringButton
                    label={
                      shutdownCodeEntered
                        ? "SHUTDOWN CODE ACCEPTED"
                        : "ENTER SHUTDOWN CODE"
                    }
                    onClick={() => setShutdownCodeEntered(true)}
                    disabled={!maintenanceMode || shutdownCodeEntered}
                    tooltip="Enters the TNER shutdown code after Maintenance Mode is active."
                  />
                  <SpringButton
                    label="REACTOR DRIVER"
                    onClick={() => setShutdownCylinderOpen(true)}
                    disabled={!shutdownCodeEntered || shutdownCylinderOpen}
                    tooltip="Deploys the shutdown Reactor Driver cylinder after the shutdown code is accepted."
                  />
                </div>
                {shutdownCylinderOpen && (
                  <div className="mt-3 rounded border border-amber-400/50 bg-slate-950 p-3">
                    <p className="text-xs font-black text-amber-200">
                      SHUTDOWN DRIVER CYLINDER DEPLOYED
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <MaintainedSwitch
                        label="SHUTDOWN KEYCARD"
                        on={shutdownKeycard}
                        onChange={setShutdownKeycard}
                        tooltip="Inserts the shutdown Reactor Driver keycard."
                      />
                      <MaintainedSwitch
                        label="SHUTDOWN BREAKER"
                        on={shutdownBreaker}
                        disabled={
                          !shutdownKeycard || !fuelReady || !fuseHatchClosed
                        }
                        onChange={setShutdownBreaker}
                        tooltip="Closes the shutdown cylinder breaker after keycard, loaded fuel, and closed fuse hatch checks pass."
                      />
                      <SpringButton
                        label="PULL SHUTDOWN SWITCH"
                        variant="danger"
                        onClick={() => {
                          if (shutdownKeycard && shutdownBreaker) {
                            setShutdownSwitch(true);
                            setShutdownCylinderOpen(false);
                            setTnerOnline(false);
                            setOverload(false);
                          }
                        }}
                        disabled={!shutdownKeycard || !shutdownBreaker}
                        tooltip="Completes the Reactor Driver shutdown procedure and stops TNER."
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-900/75">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>TNER EXPERIMENTAL POWER UNIT</span>
                <span
                  className={
                    overload
                      ? "text-red-300"
                      : tnerOnline
                        ? "text-emerald-300"
                        : "text-slate-400"
                  }
                >
                  {tnerStatus}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <Meter
                  label="TEMPERATURE"
                  value={tnerTemp.toFixed(0)}
                  unit="°C"
                  tone={tnerTemp > 3_600 ? "text-red-300" : "text-amber-200"}
                />
                <Meter
                  label="FUEL"
                  value={tnerFuel.toFixed(1)}
                  unit="%"
                  tone={tnerFuel < 15 ? "text-red-300" : "text-cyan-200"}
                />
                <Meter
                  label="FLYWHEEL / OUTPUT"
                  value={tnerOnline ? (tnerThrottle * 20).toFixed(0) : 0}
                  unit="%"
                />
              </div>
              <div className="rounded border border-slate-700 bg-slate-950/70 p-4">
                <p className="text-xs font-black tracking-wider text-slate-400">
                  POWER LEVER
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Button
                      key={value}
                      variant={tnerThrottle === value ? "default" : "outline"}
                      className={
                        tnerThrottle === value
                          ? "bg-amber-300 text-slate-950 hover:bg-amber-200"
                          : ""
                      }
                      onClick={() => setTnerThrottle(value)}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="rounded border border-red-500/40 bg-red-950/25 p-4">
                <p className="text-xs font-black tracking-wider text-red-200">
                  OVERLOAD PROCEDURE
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Requires TNER online, fuse hatch open, Fuses 1–4 removed,
                  maximum power, F.E.S. and Supercharger enabled. The Unstable
                  Mode switch validates these conditions before it can move.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <MaintainedSwitch
                    label="UNSTABLE MODE"
                    on={unstableMode}
                    disabled={!overloadReady || overload}
                    onChange={setUnstableMode}
                    tooltip="Electrical-panel Unstable Mode switch. It can only be pulled after every overload prerequisite is satisfied."
                  />
                  <SpringButton
                    label="OVERLOAD"
                    variant="danger"
                    onClick={() => setOverloadCylinderOpen(true)}
                    disabled={!unstableMode || overload || overloadCylinderOpen}
                    tooltip="Opens the overload Reactor Driver cylinder. It does not start overload until the cylinder protocol is completed."
                  />
                </div>
                {overloadCylinderOpen && (
                  <div className="mt-3 rounded border border-red-400/50 bg-slate-950 p-3">
                    <p className="text-xs font-black text-red-200">
                      OVERLOAD DRIVER CYLINDER DEPLOYED
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <MaintainedSwitch
                        label="OVERLOAD KEYCARD"
                        on={overloadKeycard}
                        onChange={setOverloadKeycard}
                        tooltip="Inserts the overload Driver keycard."
                      />
                      <MaintainedSwitch
                        label="OVERLOAD BREAKER"
                        on={overloadBreaker}
                        disabled={!overloadKeycard || !fuelReady}
                        onChange={setOverloadBreaker}
                        tooltip="Closes the overload Driver breaker. Fuel must remain available."
                      />
                      <SpringButton
                        label="PULL OVERLOAD SWITCH"
                        variant="danger"
                        onClick={() => {
                          if (
                            overloadKeycard &&
                            overloadBreaker &&
                            unstableMode
                          ) {
                            setOverloadCylinderOpen(false);
                            setOverload(true);
                          }
                        }}
                        disabled={!overloadKeycard || !overloadBreaker}
                        tooltip="Pulls the overload cylinder switch, activating TNER overload."
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="mx-auto mt-5 max-w-7xl rounded border border-red-500/30 bg-red-950/20 p-4">
        <p className="flex items-center gap-2 text-xs font-black tracking-wider text-red-200">
          <ShieldAlert className="h-4 w-4" /> ACTIVE FACILITY ALERTS
        </p>
        <p className="mt-2 text-sm text-slate-300">
          {alarms.length ? alarms.join(" · ") : "NO ACTIVE ALERTS"}
        </p>
      </section>
    </main>
  );
}
