import { useEffect, useMemo, useState } from "react";
import { Gauge, Power, RotateCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);
const approach = (value: number, target: number, amount: number) =>
  value < target
    ? Math.min(value + amount, target)
    : Math.max(value - amount, target);
const storeGrid = (connected: boolean) => {
  localStorage.setItem("qserf-foxtrot-grid-online", String(connected));
  window.dispatchEvent(
    new CustomEvent("qserf-foxtrot-grid", { detail: connected }),
  );
};
const foxtrotSessionStorageKey = "qserf-foxtrot-session-v1";
const Meter = ({
  label,
  value,
  unit,
  tone = "text-amber-200",
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

export default function Foxtrot9() {
  // Commands, mechanical rod position, and core response are deliberately separate.
  const [rodCommand, setRodCommand] = useState(100);
  const [rodInsertion, setRodInsertion] = useState(100);
  const [neutronFlux, setNeutronFlux] = useState(0);
  const [continuousTransit, setContinuousTransit] = useState(false);
  const [rodSpeed, setRodSpeed] = useState<1 | 2 | 4>(1);
  const [pistons, setPistons] = useState([false, false, false, false]);
  const [relief, setRelief] = useState([false, false, false, false]);
  const [reliefCooldown, setReliefCooldown] = useState([0, 0, 0, 0]);
  const [thermalLoop, setThermalLoop] = useState(true);
  const [temperature, setTemperature] = useState(75);
  const [pressure, setPressure] = useState(1060);
  const [synced, setSynced] = useState(
    () => localStorage.getItem("qserf-foxtrot-grid-online") === "true",
  );
  const [scram, setScram] = useState(false);
  const [rodJammed, setRodJammed] = useState(false);
  const [blowoutState, setBlowoutState] = useState<"NORMAL" | "EXPLODED" | "COOLDOWN">("NORMAL");
  const [blowoutSeconds, setBlowoutSeconds] = useState(0);
  const [sessionHydrated, setSessionHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(foxtrotSessionStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (typeof saved.rodCommand === "number") setRodCommand(saved.rodCommand);
      if (typeof saved.rodInsertion === "number") setRodInsertion(saved.rodInsertion);
      if (typeof saved.neutronFlux === "number") setNeutronFlux(saved.neutronFlux);
      if (typeof saved.continuousTransit === "boolean") setContinuousTransit(saved.continuousTransit);
      if (saved.rodSpeed === 1 || saved.rodSpeed === 2 || saved.rodSpeed === 4) setRodSpeed(saved.rodSpeed);
      if (Array.isArray(saved.pistons) && saved.pistons.length === 4) setPistons(saved.pistons as boolean[]);
      if (Array.isArray(saved.relief) && saved.relief.length === 4) setRelief(saved.relief as boolean[]);
      if (Array.isArray(saved.reliefCooldown) && saved.reliefCooldown.length === 4) setReliefCooldown(saved.reliefCooldown as number[]);
      if (typeof saved.thermalLoop === "boolean") setThermalLoop(saved.thermalLoop);
      if (typeof saved.temperature === "number") setTemperature(saved.temperature);
      if (typeof saved.pressure === "number") setPressure(saved.pressure);
      if (typeof saved.synced === "boolean") {
        setSynced(saved.synced);
        storeGrid(saved.synced);
      }
      if (typeof saved.scram === "boolean") setScram(saved.scram);
      if (typeof saved.rodJammed === "boolean") setRodJammed(saved.rodJammed);
      if (saved.blowoutState === "NORMAL" || saved.blowoutState === "EXPLODED" || saved.blowoutState === "COOLDOWN") setBlowoutState(saved.blowoutState);
      if (typeof saved.blowoutSeconds === "number") setBlowoutSeconds(saved.blowoutSeconds);
    } catch {
      localStorage.removeItem(foxtrotSessionStorageKey);
    } finally {
      setSessionHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!sessionHydrated) return;
    localStorage.setItem(foxtrotSessionStorageKey, JSON.stringify({
      rodCommand, rodInsertion, neutronFlux, continuousTransit, rodSpeed,
      pistons, relief, reliefCooldown, thermalLoop, temperature, pressure,
      synced, scram,
      rodJammed, blowoutState, blowoutSeconds,
    }));
  });
  const pistonCount = pistons.filter(Boolean).length;
  const reliefCount = relief.filter(Boolean).length;
  // At 40% insertion, four converters settle near their normal 40,000 kW output.
  const thermalPower = clamp((neutronFlux / 10) * 50, 0, 50);
  const pressureFactor = clamp((pressure - 940) / 120, 0.68, 1.06);
  const output = clamp(
    thermalPower * (pistonCount / 4) * pressureFactor,
    0,
    50,
  );
  const syncOffset = output - 40;
  const syncReady =
    pistonCount === 4 &&
    Math.abs(syncOffset) <= 1 &&
    temperature < 950 &&
    pressure < 2250 &&
    !scram;
  const safetyReason = useMemo(() => {
    if (pressure >= 2300) return "HIGH SYSTEM PRESSURE";
    if (neutronFlux >= 14) return "HIGH NEUTRON FLUX";
    if (thermalPower >= 48) return "HIGH THERMAL POWER";
    if (temperature >= 950) return "HIGH VESSEL TEMPERATURE";
    return null;
  }, [neutronFlux, pressure, temperature, thermalPower]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const targetTemperature = clamp(
        75 + thermalPower * 4.2 - reliefCount * 30 - (thermalLoop ? 26 : 0),
        25,
        1_150,
      );
      const targetPressure = clamp(
        1060 + thermalPower * 27 - reliefCount * 165 - (thermalLoop ? 45 : 0),
        700,
        2_750,
      );
      setTemperature((value) => approach(value, targetTemperature, 2.5));
      setPressure((value) => approach(value, targetPressure, 12));
    }, 250);
    return () => window.clearInterval(tick);
  }, [thermalPower, thermalLoop, reliefCount]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setReliefCooldown((old) =>
        old.map((seconds) => Math.max(0, seconds - 0.25)),
      );
      setRodInsertion((actual) => {
        const next = approach(
          actual,
          scram ? 100 : rodCommand,
          rodJammed ? 0 : 2.25 * rodSpeed * 0.25,
        );
        const targetFlux = clamp(((100 - next) / 100) * 13.5, -2, 13.5);
        // Core kinetics lag the actual rod movement by several seconds.
        setNeutronFlux((flux) =>
          clamp(
            flux + (targetFlux - flux) * (rodJammed ? 0.004 : continuousTransit ? 0.018 : 0.032),
            -2,
            14.5,
          ),
        );
        return next;
      });
    }, 250);
    return () => window.clearInterval(tick);
  }, [continuousTransit, rodCommand, rodJammed, rodSpeed, scram]);

  useEffect(() => {
    if (!safetyReason || scram || blowoutState !== "NORMAL") return;
    setScram(true);
    setRodCommand(100);
    setRelief([true, true, true, true]);
    setSynced(false);
    storeGrid(false);
    // A high-pressure SCRAM can retain enough neutron flux to spike pressure
    // into the source game's destructive Foxtrot blowout route.
    if (pressure >= 2_300 && neutronFlux >= 10) {
      setBlowoutState("EXPLODED");
      setBlowoutSeconds(12);
      setPressure((value) => Math.max(value, 2_700));
      setTemperature((value) => Math.max(value, 980));
    }
  }, [blowoutState, neutronFlux, pressure, safetyReason, scram]);

  useEffect(() => {
    if (blowoutState === "NORMAL") return;
    const timer = window.setInterval(() => {
      setBlowoutSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [blowoutState]);

  useEffect(() => {
    if (blowoutState === "EXPLODED" && blowoutSeconds === 0) {
      setBlowoutState("COOLDOWN");
      setBlowoutSeconds(75);
    }
    if (blowoutState === "COOLDOWN" && blowoutSeconds === 0) {
      setBlowoutState("NORMAL");
      setRodCommand(100);
      setRodInsertion(100);
      setNeutronFlux(0);
      setPistons([false, false, false, false]);
      setRelief([false, false, false, false]);
      setTemperature(75);
      setPressure(1060);
      setScram(false);
      setRodJammed(false);
    }
  }, [blowoutSeconds, blowoutState]);
  const setSyncedGrid = () => {
    if (!syncReady) return;
    setSynced(true);
    storeGrid(true);
  };
  const disconnect = () => {
    setSynced(false);
    storeGrid(false);
  };
  const reset = () => {
    setRodCommand(100);
    setRodInsertion(100);
    setNeutronFlux(0);
    setContinuousTransit(false);
    setRodSpeed(1);
    setPistons([false, false, false, false]);
    setRelief([false, false, false, false]);
    setReliefCooldown([0, 0, 0, 0]);
    setThermalLoop(true);
    setTemperature(75);
    setPressure(1060);
    setScram(false);
    setRodJammed(false);
    setBlowoutState("NORMAL");
    setBlowoutSeconds(0);
    disconnect();
  };
  const adjustRods = (direction: number) => {
    if (!rodJammed && Math.random() < 0.025) setRodJammed(true);
    setRodCommand((value) => clamp(value + direction * 5 * rodSpeed, 0, 100));
  };
  const toggleRelief = (index: number) => {
    if (reliefCooldown[index] > 0) return;
    setRelief((old) => {
      const next = old.map((value, current) =>
        current === index ? !value : value,
      );
      if (old[index]) {
        setReliefCooldown((timers) =>
          timers.map((value, current) => (current === index ? 8 : value)),
        );
      }
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-[#0c0a08] p-4 font-mono text-slate-100 md:p-7">
      <header className="mx-auto mb-5 flex max-w-7xl flex-wrap items-end justify-between gap-4 border-b border-amber-400/35 pb-5">
        <div>
          <p className="text-xs font-black tracking-[.3em] text-amber-300">
            QSERF // PROJECT HELIOS
          </p>
          <h1 className="mt-1 text-3xl font-black">
            Foxtrot Mk. 9 Mobile Nuclear Fission Reactor
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Auxiliary-grid Type-247 Stirling converter reactor — normal output
            40,000 kW; maximum 50,000 kW.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>
            RESET F-9
          </Button>
          <Button asChild>
            <Link to="/qserf">DMR CONTROL ROOM</Link>
          </Button>
        </div>
      </header>
      <section className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Meter
          label="REACTOR TEMPERATURE"
          value={temperature.toFixed(0)}
          unit="°C"
          tone={temperature >= 950 ? "text-red-400" : "text-amber-200"}
        />
        <Meter
          label="PRIMARY PRESSURE"
          value={pressure.toFixed(0)}
          unit="kPa"
        />
        <Meter
          label="NEUTRON FLUX"
          value={neutronFlux.toFixed(2)}
          unit="%"
          tone={neutronFlux >= 14 ? "text-red-400" : "text-amber-200"}
        />
        <Meter
          label="THERMAL POWER"
          value={(thermalPower * 1000).toFixed(0)}
          unit="kW"
          tone={thermalPower >= 48 ? "text-red-400" : "text-amber-200"}
        />
        <Meter
          label="CONVERTER OUTPUT"
          value={(output * 1000).toFixed(0)}
          unit="kW"
          tone="text-emerald-300"
        />
        <Meter
          label="GRID STATUS"
          value={
            blowoutState === "EXPLODED"
              ? `BLOWOUT — ${blowoutSeconds}s TO SEAL`
              : blowoutState === "COOLDOWN"
                ? `SECURITY DOOR SEALED — ${blowoutSeconds}s`
              : synced
              ? "AUXILIARY GRID SYNCED"
              : scram
                ? `AUTO SCRAM — ${safetyReason ?? "COOLING"}`
                : "ISOLATED"
          }
          tone={blowoutState !== "NORMAL" ? "text-red-400" : synced ? "text-emerald-300" : "text-slate-300"}
        />
      </section>
      <section className="mx-auto mt-5 grid max-w-7xl gap-5 lg:grid-cols-2">
        <Card className="border-amber-400/30 bg-slate-900/75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-200">
              <Gauge className="h-5 w-5" /> CONTROL ROD AND THERMAL LOOP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <p>
                Rod command:{" "}
                <strong className="text-amber-200">
                  {rodCommand.toFixed(0)}% inserted
                </strong>
              </p>
              <p>
                Actual insertion:{" "}
                <strong className="text-amber-200">
                  {rodInsertion.toFixed(1)}%
                </strong>
              </p>
              <p className={rodJammed ? "text-red-300" : "text-emerald-300"}>
                Rod drive: <strong>{rodJammed ? "JAMMED" : "NORMAL"}</strong>
              </p>
            </div>
            <input
              className="mt-3 w-full accent-amber-300"
              aria-label="Foxtrot 9 control rod insertion command"
              type="range"
              min="0"
              max="100"
              value={rodCommand}
              disabled={scram || blowoutState !== "NORMAL"}
              onChange={(event) => setRodCommand(Number(event.target.value))}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                variant="outline"
                disabled={scram || blowoutState !== "NORMAL"}
                onClick={() => adjustRods(-1)}
                tooltip="Withdraws the Foxtrot-9 rod drive by the selected step. Lower insertion increases neutron flux, thermal power, and pressure after the modeled response delay."
              >
                WITHDRAW
              </Button>
              <Button
                variant="outline"
                disabled={scram || blowoutState !== "NORMAL"}
                onClick={() => adjustRods(1)}
                tooltip="Inserts the Foxtrot-9 rod drive by the selected step, reducing neutron flux and thermal output after the modeled response delay."
              >
                INSERT
              </Button>
              <Button
                variant={continuousTransit ? "default" : "outline"}
                disabled={scram}
                onClick={() => setContinuousTransit((value) => !value)}
                tooltip="Keeps the rod drive travelling after an Insert or Withdraw command. Turn it off for small, measured rod movements."
              >
                CONT. TRANSIT
              </Button>
              <Button variant="default" disabled tooltip="Indicates that the Foxtrot-9 thermal loop protection is permanently enabled in normal operation.">
                THERMAL LOOP SAFETY ON
              </Button>
            </div>
            <div className="mt-3 flex gap-2">
              {([1, 2, 4] as const).map((speed) => (
                <Button
                  key={speed}
                  size="sm"
                  variant={rodSpeed === speed ? "default" : "outline"}
                  disabled={scram || blowoutState !== "NORMAL"}
                  onClick={() => setRodSpeed(speed)}
                  tooltip={`Sets the Foxtrot-9 rod-drive speed to ${speed}×. Faster movement changes reactivity more quickly but the core response remains gradual.`}
                >
                  {speed}× ROD SPEED
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Rod commands move the drive first; neutron flux then responds
              with inertia and may decay after rod motion stops. A jammed rod
              drive holds mechanical position while flux only changes slowly;
              repeat SCRAM to clear it. The thermal loop is safety-protected.
            </p>
          </CardContent>
        </Card>
        <Card className="border-cyan-400/30 bg-slate-900/75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-200">
              <RotateCw className="h-5 w-5" /> CONVERTERS AND SYNCHROSCOPE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {pistons.map((connected, index) => (
                <Button
                  key={index}
                  variant={connected ? "default" : "outline"}
                  disabled={blowoutState !== "NORMAL"}
                  onClick={() =>
                    setPistons((old) =>
                      old.map((value, current) =>
                        current === index ? !value : value,
                      ),
                    )
                  }
                  tooltip="Connects or opens one Foxtrot-9 converter piston. All four pistons must be connected before auxiliary-grid synchronization is allowed."
                >
                  PISTON {index + 1}: {connected ? "CONNECTED" : "OPEN"}
                </Button>
              ))}
            </div>
            <div className="mt-4 rounded border border-cyan-400/25 bg-black/35 p-3 text-sm">
              <p>
                SYNCHROSCOPE:{" "}
                <strong
                  className={syncReady ? "text-emerald-300" : "text-slate-400"}
                >
                  {syncOffset < -1
                    ? "LAG"
                    : syncOffset > 1
                      ? "LEAD"
                      : "SAME SPEED"}{" "}
                  {syncOffset >= 0 ? "+" : ""}
                  {syncOffset.toFixed(2)} MW
                </strong>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                LAG means reactor pressure/output is too low; LEAD means it is
                too high. Connect all pistons, use relief valves to hold
                39,000–41,000 kW, then close the auxiliary breaker on SAME
                SPEED.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button disabled={!syncReady || synced || blowoutState !== "NORMAL"} onClick={setSyncedGrid} tooltip="Closes the Foxtrot-9 auxiliary-grid breaker only when all four pistons are connected and the synchronoscope is in its permitted band.">
                <Power className="mr-2 h-4 w-4" />
                SYNC TO AUX GRID
              </Button>
              <Button variant="outline" disabled={!synced} onClick={disconnect} tooltip="Opens the auxiliary-grid breaker, isolating Foxtrot-9 generation from the grid.">
                OPEN GRID BREAKER
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-slate-900/75 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-200">
              <ShieldCheck className="h-5 w-5" /> RELIEF AND PROTECTION
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {relief.map((open, index) => (
                <Button
                  key={index}
                  variant={open ? "destructive" : "outline"}
                  onClick={() => toggleRelief(index)}
                  disabled={reliefCooldown[index] > 0 && !open}
                  tooltip="Opens or closes one independent Foxtrot-9 relief valve. An opened valve relieves pressure; after closing, its own cooldown must expire before it can reopen."
                >
                  RELIEF {index + 1}:{" "}
                  {open
                    ? "OPEN"
                    : reliefCooldown[index] > 0
                      ? `${reliefCooldown[index].toFixed(0)}s CD`
                      : "CLOSED"}
                </Button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="destructive"
                onClick={() => {
                  setScram(true);
                  setRodCommand(100);
                  setRelief([true, true, true, true]);
                  if (scram) setRodJammed(false);
                  disconnect();
                }}
                tooltip="Immediately inserts Foxtrot-9 rods, opens all relief valves, and disconnects its grid breaker."
              >
                SCRAM F-9
              </Button>
              <Button
                variant="outline"
                disabled={!scram || temperature > 100 || pressure > 1120}
                onClick={() => setScram(false)}
                tooltip="Resets the Foxtrot-9 SCRAM only after temperature and pressure fall below the protection reset limits."
              >
                RESET SCRAM
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Protection opens all four relief valves and inserts rods on high
              pressure, 14% neutron flux, 48,000 kW thermal power, or 950 °C.
              A high-pressure SCRAM with retained flux can cause a blowout;
              the security door remains sealed through the simulated recovery
              cooldown. Each relief valve has its own cooldown after closing.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
