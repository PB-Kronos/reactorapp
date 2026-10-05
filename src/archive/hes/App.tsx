import { useState } from "react";
import {
  Activity,
  Bell,
  BookOpen,
  Droplets,
  Gauge,
  Radio,
  RotateCcw,
  ShieldCheck,
  Waves,
  Zap,
} from "lucide-react";
import {
  Annunciator,
  WikiControlRoom,
} from "./Controls";
import { type Page, rank, usePlantSimulator } from "./simulator";
const pages: { id: Page; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "turbine", label: "Control room", icon: Gauge },
  { id: "procedures", label: "Procedures", icon: BookOpen },
];
function Overview({ sim }: { sim: ReturnType<typeof usePlantSimulator> }) {
  const { state, totalMw, alarms, command } = sim;
  const demandError = totalMw - state.gridDemand;
  const autoSystems = [
    state.hydraulicAuto,
    state.oilAuto,
    state.unit.autoExcitation,
  ].filter(Boolean).length;
  return (
    <>
      <section className="greeting">
        <div>
          <p className="label">CENTRAL CONTROL ROOM // UNITS 1 + 2</p>
          <h1>
            Single-unit plant <span>operations.</span>
          </h1>
          <p>
            Run both generating units from a shared hydraulic header, then
            synchronize at 250 RPM and use load splitting when both are online.
          </p>
        </div>
        <div className="score">
          <div>
            <span>OPERATING POINTS</span>
            <strong>{Math.floor(state.points).toLocaleString()}</strong>
          </div>
          <div>
            <span>RANK</span>
            <strong>{rank(state.points)}</strong>
            <small>
              {autoSystems
                ? `−${(autoSystems * 0.05).toFixed(2)} PPS auto cost`
                : "NO AUTO DEDUCTION"}
            </small>
          </div>
        </div>
      </section>
      <section className="metrics">
        <article>
          <span>SITE OUTPUT</span>
          <strong>
            {Math.round(totalMw)} <small>MW</small>
          </strong>
          <p className={state.unit.synced ? "ok" : "warn"}>
            ● {state.unit.synced ? "synchronized" : "not synchronized"}
          </p>
        </article>
        <article>
          <span>GRID DEMAND</span>
          <strong>
            {Math.round(state.gridDemand)} <small>MW</small>
          </strong>
          <p className={Math.abs(demandError) <= 5 ? "ok" : "warn"}>
            ● {demandError >= 0 ? "+" : ""}
            {Math.round(demandError)} MW difference
          </p>
        </article>
        <article>
          <span>HYDRAULIC PUMP</span>
          <strong>
            {state.hydraulicPump}{" "}
            <small>{Math.round(Math.max(...state.hydraulicRpm))}%</small>
          </strong>
          <p className={state.hydraulicPressure >= 160 ? "ok" : "warn"}>
            ● {state.hydraulicPressure.toFixed(0)} bar
          </p>
        </article>
        <article>
          <span>GENERATOR TEMP</span>
          <strong>
            {state.generatorTemp.toFixed(1)} <small>°C</small>
          </strong>
          <p
            className={
              state.generatorTemp >= 12 && state.generatorTemp <= 85
                ? "ok"
                : "warn"
            }
          >
            ● thermal protection active
          </p>
        </article>
      </section>
      <section className="grid">
        <article className="panel process">
          <div className="panel-title">
            <div>
              <p className="label">LIVE PROCESS</p>
              <h2>Unit 1 flow</h2>
            </div>
            <span
              className={alarms.some((a) => a.color === "red") ? "warn" : "ok"}
            >
              ●{" "}
              {alarms.some((a) => a.color === "red")
                ? "ACTION REQUIRED"
                : "SYSTEM HEALTHY"}
            </span>
          </div>
          <div className="flow">
            <div className="reservoir">
              <Droplets />
              <b>RESERVOIR</b>
              <strong>{state.reservoir.toFixed(1)}%</strong>
              <i style={{ height: `${state.reservoir}%` }} />
            </div>
            <div className="pipe">
              <b>› › ›</b>
              <small>PENSTOCK</small>
            </div>
            <div className="runner">
              <Zap />
              <b>
                FRANCIS
                <br />
                TURBINE
              </b>
              <small>{Math.round(state.unit.rpm)} RPM</small>
            </div>
            <div className="pipe">
              <b>› › ›</b>
              <small>BREAKER C3</small>
            </div>
            <div className="gridbox">
              <strong>GRID</strong>
              <small>{state.unit.c3 ? "CONNECTED" : "OPEN"}</small>
            </div>
          </div>
          <div className="units">
            <section className={!state.unit.synced ? "offline" : ""}>
              <div>
                <span>UNIT 1</span>
                <b>
                  {state.unit.tripped
                    ? "● TRIPPED"
                    : state.unit.synced
                      ? "● SYNCED"
                      : "○ OFFLINE"}
                </b>
              </div>
              <strong>
                {Math.round(state.unit.mw)} <small>MW</small>
              </strong>
              <div className="bar">
                <i style={{ width: `${state.unit.wicket}%` }} />
              </div>
              <p>
                Wicket gate {Math.round(state.unit.wicket)}%{" "}
                <span>{Math.round(state.unit.rpm)} RPM</span>
              </p>
            </section>
          </div>
        </article>
        <aside>
          <article className="panel">
            <div className="panel-title">
              <div>
                <p className="label">ACTIVE STATUS</p>
                <h2>Annunciator summary</h2>
              </div>
              <button onClick={command.acknowledge}>ACK</button>
            </div>
            <Annunciator
              title="LIVE ALARMS & INDICATORS"
              items={alarms.slice(0, 12)}
            />
          </article>
          <article className="panel dispatch-card">
            <div className="panel-title">
              <div>
                <p className="label">GRID DISPATCH</p>
                <h2>Demand changes every 50–60 seconds</h2>
              </div>
            </div>
            <strong>{Math.round(state.gridDemand)} MW</strong>
            <small>
              Use the Turbine page’s coarse ±5% and fine ±1% wicket-gate
              controls to follow demand. MW is calculated from water flow;
              tailwater on demand remains manual.
            </small>
          </article>
        </aside>
      </section>
      <section className="lower">
        <article className="panel log">
          <div className="panel-title">
            <div>
              <p className="label">OPERATIONS</p>
              <h2>Shift log</h2>
            </div>
          </div>
          {state.logs.length ? (
            state.logs.slice(0, 8).map((e) => (
              <p key={e.id}>
                <i
                  className={
                    e.level === "ok"
                      ? "ok"
                      : e.level === "warn"
                        ? "warn"
                        : "alarm-dot"
                  }
                />
                {e.text}
                <time>{e.time}</time>
              </p>
            ))
          ) : (
            <p>No operator actions logged.</p>
          )}
        </article>
      </section>
    </>
  );
}
function Procedures({ sim }: { sim: ReturnType<typeof usePlantSimulator> }) {
  const { state } = sim;
  const u = state.unit;
  const checks: [string, boolean][] = [
    [
      "Pump A is at 37–45°C and hydraulic pressure is at least 160 bar",
      state.hydraulicTemps[0] >= 37 &&
        state.hydraulicTemps[0] <= 45 &&
        state.hydraulicPressure >= 160,
    ],
    ["Electric lube pump is on before rotation", state.electricOilPump || u.rpm >= 125],
    [
      "Coolant valve, inlet and outlet pumps are running",
      state.coolantValve && state.coolantPumps.every(Boolean),
    ],
    [
      "MIV bypass is at 100%; nitrogen is armed",
      u.mivBypass >= 99 && u.nitrogen,
    ],
    ["MIV open and brake released", u.miv >= 99 && !u.brake],
    ["Auto Runup set to 250 RPM", u.autoRunup && u.speedTarget === 250],
    [
      "Electric lube pump turned off after 125 RPM; shaft pump active",
      u.rpm >= 125 && !state.electricOilPump,
    ],
    ["Excitation set and C3 synchronized", u.excitationMaster && u.c3],
    [
      "Pump B temperature in band after grid synchronization",
      u.synced &&
        state.hydraulicTemps[1] >= 38 &&
        state.hydraulicTemps[1] <= 44,
    ],
    [
      "Transfer hydraulics to Pump B after synchronization",
      u.synced && state.hydraulicPump === "B",
    ],
  ];
  return (
    <div className="procedure-page">
      <div className="console-head">
        <div>
          <p className="label">OPERATING PROCEDURES</p>
          <h2>Unit 1 startup checklist</h2>
        </div>
        <span>LIVE PERMISSIVE TRACKING</span>
      </div>
      <ol>
        {checks.map(([text, ok], i) => (
          <li className={ok ? "complete" : ""} key={text}>
            <b>{i + 1}</b>
            <span>{text}</span>
            <em>{ok ? "COMPLETE" : "PENDING"}</em>
          </li>
        ))}
      </ol>
      <div className="procedure-note">
        <h3>Operating limits represented</h3>
        <p>
      Both hydraulic pumps need 37–45°C. Automatic cooling keeps them near
      39–40°C; wait for 160+ bar before turbine startup. Loss of wicket-gate pressure closes the gates and trips
          the turbine once it is turning above 3 RPM. A clogged lube filter at 4 bar differential needs its
          bypass opened and maintenance called. Generator temperature must be
          held between the low-short-circuit and high-trip limits using the
          coolant loop and preheater.
        </p>
      </div>
    </div>
  );
}
export default function App() {
  const sim = usePlantSimulator();
  const [page, setPage] = useState<Page>("overview");
  const props = { ...sim };
  return (
    <div className="shell">
      <header>
        <div className="brand">
          <span>
            <Waves />
          </span>
          <div>
            <b>HES</b>
            <small>HYDROELECTRIC SIMULATOR</small>
          </div>
        </div>
        <div className="plant">
          <i /> CENTRAL CONTROL ROOM <em>UNITS 1 + 2</em>
        </div>
        <div className="profile">
          <Bell />
          <b>OP</b>
          <span>
            {rank(sim.state.points)}
            <small>SHIFT A</small>
          </span>
        </div>
      </header>
      <nav>
        {pages.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              className={page === p.id ? "active" : ""}
              onClick={() => setPage(p.id)}
            >
              <Icon />
              {p.label}
            </button>
          );
        })}
        <button className="nav-reset" onClick={sim.command.reset}>
          <RotateCcw />
          Reset
        </button>
      </nav>
      <main className={page === "overview" ? "" : "panel-main"}>
        {page === "overview" && <Overview sim={sim} />}{" "}
        {page === "turbine" && <WikiControlRoom {...props} />}{" "}
        {page === "procedures" && <Procedures sim={sim} />}
      </main>
      <footer>
        <span className="ok">● HES NETWORK ONLINE</span>
        <span>
          ACTIVE ALARMS {sim.alarms.filter((a) => a.color === "red").length}
        </span>
        <span>UNIT 1 ALPHA</span>
      </footer>
    </div>
  );
}
