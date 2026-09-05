import { useEffect, useState } from "react";
import { AlertTriangle, Atom, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MaintainedSwitch, SpringButton } from "@/components/HardwareControls";

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);
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
  <div className="rounded border border-slate-700 bg-slate-950/80 p-3">
    <p className="text-[10px] font-black tracking-wider text-slate-400">
      {label}
    </p>
    <p className={`mt-1 text-2xl font-black ${tone}`}>
      {value}
      <span className="ml-1 text-sm">{unit}</span>
    </p>
  </div>
);

export default function ACoreGame() {
  const [primer, setPrimer] = useState(false),
    [containment, setContainment] = useState(false),
    [online, setOnline] = useState(false),
    [temp, setTemp] = useState(293),
    [shield, setShield] = useState(100),
    [primary, setPrimary] = useState(1),
    [secondary, setSecondary] = useState(1),
    [stabilizer, setStabilizer] = useState(1),
    [intake, setIntake] = useState(0),
    [exhaust, setExhaust] = useState(0),
    [pumps, setPumps] = useState([0, 0, 0, 0]),
    [pool, setPool] = useState(100),
    [flow, setFlow] = useState(false),
    [poolValves, setPoolValves] = useState([true, true]),
    [eValves, setEValves] = useState([false, false, false]),
    [ecoolant, setEcoolant] = useState(100),
    [ecoolantTime, setEcoolantTime] = useState(0),
    [emergency, setEmergency] = useState([
      false,
      false,
      false,
      false,
      false,
      false,
    ]),
    [keys, setKeys] = useState([false, false, false]),
    [shutdownAuth, setShutdownAuth] = useState(false),
    [shutdown, setShutdown] = useState(false);
  const pumpFlow = pumps.reduce((sum, value) => sum + value, 0) * 2,
    coolant = flow && pool > 0 && pumpFlow > 0,
    eReady = eValves.every((value) => !value) && ecoolant >= 20,
    panelOpen = emergency.filter(Boolean).length >= 3,
    allEmergency = emergency.every(Boolean),
    status = !online
      ? "OFFLINE"
      : temp < 250
        ? "STALLING"
        : temp < 600
          ? "COLD"
          : temp < 2000
            ? "STABLE"
            : temp < 2500
              ? "UNSTABLE"
              : temp < 3000
                ? "CRITICAL"
                : shield > 0
                  ? "SHIELD DEGRADATION"
                  : "MELTDOWN";
  useEffect(() => {
    const timer = window.setInterval(() => {
      const fill = poolValves.filter(Boolean).length * 0.12;
      setPool((v) =>
        clamp(v + fill - (coolant ? pumpFlow * 0.025 : 0), 0, 100),
      );
      if (ecoolantTime) {
        setEcoolantTime((v) => Math.max(0, v - 0.5));
        setEcoolant((v) => Math.max(0, v - 0.7));
      }
      if (!online) return;
      const heat = primary * 0.7 + secondary * 0.4;
      const fan = ((intake + exhaust) / 165) * 1.15;
      const cool = coolant ? (pumpFlow / 40) * (0.25 + stabilizer * 0.26) : 0;
      const self = temp >= 2000 ? ((temp - 1700) / 500) * 0.5 : 0;
      const emergencyCool = ecoolantTime ? 30 : 0;
      const termination = shutdown ? 12 + keys.filter(Boolean).length * 4 : 0;
      setTemp((v) =>
        clamp(
          v + (heat - fan - cool - self - emergencyCool - termination) * 0.5,
          0,
          6500,
        ),
      );
      setShield((v) =>
        temp > 3000
          ? clamp(v - ((temp - 2900) / 180) * 0.5, 0, 100)
          : temp < 2000
            ? clamp(v + 0.1, 0, 100)
            : v,
      );
    }, 500);
    return () => window.clearInterval(timer);
  }, [
    online,
    temp,
    primary,
    secondary,
    stabilizer,
    intake,
    exhaust,
    coolant,
    pumpFlow,
    ecoolantTime,
    shutdown,
    keys,
    poolValves,
  ]);
  const setPump = (index: number, value: number) =>
    setPumps((old) =>
      old.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  const level = (
    label: string,
    value: number,
    onChange: (value: number) => void,
  ) => (
    <div className="rounded border border-slate-700 bg-slate-950/70 p-3">
      <p className="text-xs font-bold">
        {label} <span className="text-cyan-300">LEVEL {value}</span>
      </p>
      <div className="mt-2 grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((option) => (
          <Button
            key={option}
            size="sm"
            variant={value === option ? "default" : "outline"}
            onClick={() => onChange(option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
  const reset = () => {
    setPrimer(false);
    setContainment(false);
    setOnline(false);
    setTemp(293);
    setShield(100);
    setPrimary(1);
    setSecondary(1);
    setStabilizer(1);
    setIntake(0);
    setExhaust(0);
    setPumps([0, 0, 0, 0]);
    setPool(100);
    setFlow(false);
    setPoolValves([true, true]);
    setEValves([false, false, false]);
    setEcoolant(100);
    setEcoolantTime(0);
    setEmergency([false, false, false, false, false, false]);
    setKeys([false, false, false]);
    setShutdownAuth(false);
    setShutdown(false);
  };
  return (
    <main className="min-h-screen bg-[#090b16] p-4 font-mono text-slate-100 md:p-7">
      <header className="mx-auto mb-5 flex max-w-7xl items-end justify-between border-b border-red-500/30 pb-5">
        <div>
          <p className="text-xs font-black tracking-[.3em] text-red-300">
            REACTOR GAME ARCHIVE // A CORE GAME
          </p>
          <h1 className="text-3xl font-black">Plasma Reactor Core Simulator</h1>
          <p className="mt-1 text-sm text-slate-400">
            PRC startup, laser control, coolant systems and emergency
            termination.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>
            RESET PRC
          </Button>
          <Button onClick={() => window.location.assign("/archive")}>
            ARCHIVE
          </Button>
        </div>
      </header>
      <section className="mx-auto mb-5 grid max-w-7xl gap-3 sm:grid-cols-4">
        <Meter
          label="CORE TEMPERATURE"
          value={temp.toFixed(0)}
          unit="°C"
          tone={
            temp >= 3000
              ? "text-red-300"
              : temp >= 2000
                ? "text-amber-300"
                : undefined
          }
        />
        <Meter
          label="SHIELD INTEGRITY"
          value={shield.toFixed(1)}
          unit="%"
          tone={shield < 40 ? "text-red-300" : "text-emerald-300"}
        />
        <Meter
          label="CORE STATUS"
          value={status}
          tone={
            status === "STABLE"
              ? "text-emerald-300"
              : status === "OFFLINE"
                ? "text-slate-400"
                : "text-amber-300"
          }
        />
        <Meter
          label="COOLANT FLOW"
          value={coolant ? pumpFlow.toFixed(0) : "0"}
          unit="L/s"
        />
      </section>
      <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
        <Card className="border-red-500/30 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-red-200">Reactor Control Room</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MaintainedSwitch
                label="STARTUP PRIMER"
                on={primer}
                onChange={setPrimer}
              />
              <SpringButton
                label="CONTAINMENT FIELD"
                disabled={!primer || containment}
                onClick={() => setContainment(true)}
              />
              <SpringButton
                label="PRIMARY IGNITION"
                variant="danger"
                disabled={!containment || online}
                onClick={() => {
                  setOnline(true);
                  setTemp((v) => Math.max(v, 350));
                }}
              />
            </div>
            {level("PRIMARY POWER LASERS", primary, setPrimary)}
            {level("SECONDARY POWER LASERS", secondary, setSecondary)}
            {level("STABILIZATION LASERS", stabilizer, setStabilizer)}
            <label className="block text-xs">
              INTAKE FAN {intake.toFixed(0)} RPM
              <input
                className="mt-2 w-full accent-cyan-400"
                type="range"
                min="0"
                max="165"
                value={intake}
                onChange={(event) => setIntake(+event.target.value)}
              />
            </label>
            <label className="block text-xs">
              EXHAUST FAN {exhaust.toFixed(0)} RPM
              <input
                className="mt-2 w-full accent-cyan-400"
                type="range"
                min="0"
                max="165"
                value={exhaust}
                onChange={(event) => setExhaust(+event.target.value)}
              />
            </label>
          </CardContent>
        </Card>
        <Card className="border-cyan-500/30 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-cyan-200">
              Coolant Station and E-Coolant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {pumps.map((value, index) => (
                <div key={index}>
                  {level(`PUMP ${index + 1}`, value, (next) =>
                    setPump(index, next),
                  )}
                </div>
              ))}
            </div>
            <MaintainedSwitch
              label="COOLANT FLOW TO CORE"
              on={flow}
              onChange={setFlow}
            />
            <div className="grid grid-cols-2 gap-3">
              <MaintainedSwitch
                label="POOL VALVE A"
                on={poolValves[0]}
                onChange={(next) => setPoolValves((old) => [next, old[1]])}
              />
              <MaintainedSwitch
                label="POOL VALVE B"
                on={poolValves[1]}
                onChange={(next) => setPoolValves((old) => [old[0], next])}
              />
            </div>
            <Meter label="COOLANT POOL" value={pool.toFixed(1)} unit="%" />
            <div className="grid grid-cols-3 gap-2">
              {eValves.map((open, index) => (
                <MaintainedSwitch
                  key={index}
                  label={`E-VALVE ${index + 1}`}
                  on={open}
                  onChange={(next) =>
                    setEValves((old) =>
                      old.map((item, itemIndex) =>
                        itemIndex === index ? next : item,
                      ),
                    )
                  }
                />
              ))}
            </div>
            <Meter
              label="E-COOLANT STORAGE"
              value={ecoolant.toFixed(0)}
              unit="%"
            />
            <SpringButton
              label={
                ecoolantTime
                  ? `E-COOLANT ACTIVE ${ecoolantTime.toFixed(0)}s`
                  : "DISCHARGE E-COOLANT"
              }
              variant="danger"
              disabled={!eReady || !!ecoolantTime}
              onClick={() => setEcoolantTime(12)}
            />
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-amber-200">
              Emergency Manual Termination
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-400">
              Three of six emergency buttons open EMTS. All six are required to
              authorize shutdown.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {emergency.map((active, index) => (
                <Button
                  key={index}
                  variant={active ? "default" : "outline"}
                  onClick={() =>
                    setEmergency((old) =>
                      old.map((item, itemIndex) =>
                        itemIndex === index ? !item : item,
                      ),
                    )
                  }
                >
                  E-{index + 1}
                </Button>
              ))}
            </div>
            {panelOpen && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {keys.map((active, index) => (
                    <MaintainedSwitch
                      key={index}
                      label={`TERMINATION ${index + 1}`}
                      on={active}
                      onChange={(next) =>
                        setKeys((old) =>
                          old.map((item, itemIndex) =>
                            itemIndex === index ? next : item,
                          ),
                        )
                      }
                    />
                  ))}
                </div>
                <MaintainedSwitch
                  label="AUTHORIZE SHUTDOWN"
                  on={shutdownAuth}
                  onChange={setShutdownAuth}
                />
                <SpringButton
                  label="ENGAGE EMTS"
                  variant="danger"
                  disabled={!shutdownAuth || !allEmergency}
                  onClick={() => setShutdown(true)}
                />
              </>
            )}
            <p className="text-xs text-slate-400">
              {shutdown ? "EMTS IN PROGRESS" : "EMTS STANDBY"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-700 bg-slate-900/70">
          <CardHeader>
            <CardTitle>Operator notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p>
              Normal stable band: 600–2000°C. Above 3000°C shield integrity
              degrades; falling shield can lead to meltdown.
            </p>
            <p>
              All three E-coolant valves must be closed and storage must be at
              least 20% before emergency discharge.
            </p>
            <p>
              <AlertTriangle className="mr-1 inline h-4 w-4 text-amber-300" />{" "}
              Pump output above the normal combined 40 L/s drains the pool; use
              both fill valves to recover inventory.
            </p>
            <p>
              <Shield className="mr-1 inline h-4 w-4 text-cyan-300" />
              <Atom className="mr-1 inline h-4 w-4 text-red-300" /> Current
              archive implementation covers the public PRC operating loop.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
