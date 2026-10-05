import { useRef, useState } from "react";
import type { LampColor, PlantState, UnitState } from "./simulator";
export function Lamp({
  color = "green",
  on = true,
  label,
}: {
  color?: LampColor;
  on?: boolean;
  label: string;
}) {
  return <span className={`lamp ${color} ${on ? "lit" : ""}`}>{label}</span>;
}
export function Digital({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="digital">
      <strong>{typeof value === "number" ? value.toFixed(1) : value}</strong>
      <small>
        {label}
        {unit ? ` · ${unit}` : ""}
      </small>
    </div>
  );
}
export function Meter({
  label,
  value,
  max = 100,
  unit,
}: {
  label: string;
  value: number;
  max?: number;
  unit?: string;
}) {
  const deg = -125 + Math.max(0, Math.min(1, value / max)) * 250;
  return (
    <div className="meter">
      <div className="dial">
        <i style={{ transform: `rotate(${deg}deg)` }} />
        <b>{Math.round(value)}</b>
      </div>
      <small>
        {label}
        {unit ? ` · ${unit}` : ""}
      </small>
    </div>
  );
}
export function Rotary({
  label,
  on,
  onLabel = "ON",
  offLabel = "OFF",
  onChange,
  guarded = false,
}: {
  label: string;
  on: boolean;
  onLabel?: string;
  offLabel?: string;
  onChange: (v: boolean) => void;
  guarded?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const press = () => {
    onChange(!on);
  };
  return (
    <button
      className={`rotary ${on ? "is-on" : ""} ${pressed ? "is-pressed" : ""} ${guarded ? "guarded" : ""}`}
      onClick={press}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      aria-pressed={on}
    >
      <span className="pilot">
        <i className={on ? "red" : ""} />
        <i className={on ? "green on" : "green"} />
      </span>
      <b>{label}</b>
      <output>{on ? onLabel : offLabel}</output>
      <span className={`knob ${on ? "on" : ""}`} />
      <small>
        {offLabel}
        <em>{onLabel}</em>
      </small>
    </button>
  );
}
export function Selector<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  const i = options.indexOf(value);
  return (
    <div className="selector">
      <b>{label}</b>
      <div className="selector-face">
        <button
          aria-label={`${label}: ${String(value)}`}
          onClick={() => onChange(options[(i + 1) % options.length])}
        >
          <span
            style={{
              transform: `rotate(${-55 + (i / Math.max(options.length - 1, 1)) * 110}deg)`,
            }}
          />
        </button>
        <output>{String(value)}</output>
      </div>
      <div className="selector-positions">
        {options.map((option) => (
          <button
            key={String(option)}
            className={option === value ? "selected" : ""}
            aria-pressed={option === value}
            onClick={() => onChange(option)}
          >
            {String(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
export function PushButton({
  label,
  color = "green",
  onClick,
  disabled = false,
}: {
  label: string;
  color?: "green" | "red" | "amber";
  onClick: () => void;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const handledMouseDown = useRef(false);
  const activate = () => {
    onClick();
  };
  return (
    <button
      className={`push ${color} ${pressed ? "is-pressed" : ""}`}
      onClick={() => {
        if (handledMouseDown.current) {
          handledMouseDown.current = false;
          return;
        }
        activate();
      }}
      onMouseDown={() => {
        setPressed(true);
        handledMouseDown.current = true;
        activate();
      }}
      onMouseUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
      disabled={disabled}
    >
      <span className="push-cap"><i /></span>
      <span className="push-label">{label}</span>
    </button>
  );
}
type Command = {
  setHydraulicPump: (v: PlantState["hydraulicPump"]) => void;
  toggle: (k: keyof PlantState) => void;
  setHydraulicTempControl: (
    i: 0 | 1,
    k: "preheater" | "fan",
    v: boolean,
  ) => void;
  setCoolantPump: (i: 0 | 1, v: boolean) => void;
  setCoolantFilter: (v: "A" | "B") => void;
  setOilFilter: (v: "A" | "B") => void;
  callMaintenance: () => void;
  setEdg: (v: PlantState["edg"]) => void;
  setUnit: (v: Partial<UnitState>) => void;
  setMiv: (v: number) => void;
  setC3: (v: boolean) => void;
  adjustWicket: (percent: number) => void;
  trip: () => void;
  resetTrip: () => void;
  setSpillway: (i: number, v: number) => void;
  setSpillMaster: (i: number, v: boolean) => void;
  setDemand: (v: number) => void;
  reset: () => void;
  warmStart: () => void;
  acknowledge: () => void;
};
export type PanelProps = {
  state: PlantState;
  command: Command;
  alarms: { text: string; color: LampColor }[];
  totalMw: number;
};
export function Annunciator({
  items,
  title,
}: {
  items: { text: string; color: LampColor; on?: boolean }[];
  title: string;
}) {
  return (
    <div className="ann-panel">
      <h4>{title}</h4>
      <div>
        {items.map((a, i) => (
          <Lamp key={`${a.text}-${i}`} label={a.text} color={a.color} on={a.on} />
        ))}
      </div>
    </div>
  );
}
export function AuxiliariesPanel({ state, command }: PanelProps) {
  const oilDiff = state.oilFilterDiff[state.oilFilter === "A" ? 0 : 1];
  return (
    <div className="console auxiliaries-console">
      <div className="console-head">
        <div>
          <p className="label">P228–P231</p>
          <h2>Auxiliary systems bench</h2>
        </div>
        <span>COOLANT · GENERATOR · LUBRICATION · HYDRAULICS</span>
      </div>
      <div className="desk-columns">
        <section>
          <Annunciator
            title="P228 · COOLANT"
            items={[
              { text: `FILTER ${state.coolantFilter} ACTIVE`, color: "green" },
              {
                text: "FILTER DIFFERENTIAL",
                color:
                  state.coolantFilterDiff[
                    state.coolantFilter === "A" ? 0 : 1
                  ] >= 4
                    ? "red"
                    : "amber",
              },
              {
                text: "INLET / OUTLET FLOW",
                color:
                  state.coolantValve && state.coolantPumps.every(Boolean)
                    ? "green"
                    : "red",
              },
            ]}
          />
          <div className="hardware-row">
            <Rotary
              label="COOLANT VALVE"
              on={state.coolantValve}
              onChange={() => command.toggle("coolantValve")}
            />
            <Rotary
              label="INLET PUMP"
              on={state.coolantPumps[0]}
              onChange={(v) => command.setCoolantPump(0, v)}
            />
            <Rotary
              label="OUTLET PUMP"
              on={state.coolantPumps[1]}
              onChange={(v) => command.setCoolantPump(1, v)}
            />
            <Meter
              label="COOLANT TEMP"
              value={state.coolantTemp}
              max={90}
              unit="°C"
            />
          </div>
          <div className="hardware-row">
            <Selector
              label="ACTIVE FILTER"
              value={state.coolantFilter}
              options={["A", "B"] as const}
              onChange={command.setCoolantFilter}
            />
            <Rotary
              label="TRASH RACK AUTO"
              on={state.trashRackAuto}
              onChange={() => command.toggle("trashRackAuto")}
            />
            <Lamp
              label={state.trashRackRunning ? "TRASH RACK RUNNING" : "TRASH RACK STANDBY"}
              color={state.trashRackRunning ? "green" : "amber"}
              on
            />
          </div>
        </section>
        <section>
          <Annunciator
            title="P229 · GENERATOR"
            items={[
              {
                text: "GEN TEMP LOW",
                color: state.generatorTemp < 12 ? "red" : "amber",
              },
              {
                text: "GEN TEMP HIGH",
                color: state.generatorTemp > 85 ? "red" : "amber",
              },
              {
                text: "COOLANT ACTIVE",
                color: state.generatorCooling ? "green" : "amber",
              },
              {
                text: "PREHEATER ACTIVE",
                color: state.generatorPreheater ? "green" : "amber",
              },
            ]}
          />
          <div className="hardware-row">
            <Rotary
              label="GEN COOLING"
              on={state.generatorCooling}
              onChange={() => command.toggle("generatorCooling")}
            />
            <Rotary
              label="GEN PREHEATER"
              on={state.generatorPreheater}
              onChange={() => command.toggle("generatorPreheater")}
            />
            <Meter
              label="GENERATOR TEMP"
              value={state.generatorTemp}
              max={100}
              unit="°C"
            />
          </div>
          <p className="desk-note">
            With both controls off, generator temperature holds. Too cold or too
            hot trips the turbine.
          </p>
        </section>
        <section>
          <Annunciator
            title="P230 · LUBRICATION"
            items={[
              {
                text: "ELEC PUMP RUNNING",
                color: state.electricOilPump ? "green" : "amber",
              },
              {
                text: "SHAFT PUMP RUNNING",
                color: state.unit.shaftPumpLatched ? "green" : "amber",
              },
              { text: "FILTER ΔP HIGH", color: oilDiff >= 4 ? "red" : "green" },
              {
                text: "FILTER BYPASS OPEN",
                color: state.oilFilterBypass ? "blue" : "amber",
              },
            ]}
          />
          <div className="hardware-row">
            <Rotary
              label="ELECTRIC OIL PUMP"
              on={state.electricOilPump}
              onChange={() => command.toggle("electricOilPump")}
              guarded
            />
            <Rotary
              label="LUBE COOLING PUMP"
              on={state.oilCooling}
              onChange={() => command.toggle("oilCooling")}
            />
            <Rotary
              label="AUTO OIL COOLING"
              on={state.oilAuto}
              onChange={() => command.toggle("oilAuto")}
            />
            <Meter
              label="OIL PRESSURE"
              value={state.oilPressure}
              max={5}
              unit="bar"
            />
            <Meter label="OIL TEMP" value={state.oilTemp} max={100} unit="°C" />
          </div>
          <div className="hardware-row">
            <Selector
              label="LUBE FILTER"
              value={state.oilFilter}
              options={["A", "B"] as const}
              onChange={command.setOilFilter}
            />
            <Rotary
              label="FILTER BYPASS"
              on={state.oilFilterBypass}
              onChange={() => command.toggle("oilFilterBypass")}
              guarded
            />
            <PushButton
              label="CALL MAINTENANCE"
              color="amber"
              onClick={command.callMaintenance}
            />
          </div>
        </section>
        <section>
          <Annunciator
            title="P231 · HYDRAULICS"
            items={[
              {
                text: "PUMP A READY",
                color:
                  state.hydraulicTemps[0] >= 38 && state.hydraulicTemps[0] <= 44
                    ? "green"
                    : "amber",
              },
              {
                text: "PUMP B READY",
                color:
                  state.hydraulicTemps[1] >= 38 && state.hydraulicTemps[1] <= 44
                    ? "green"
                    : "amber",
              },
              {
                text: "PRESSURE OK",
                color: state.hydraulicPressure >= 160 ? "green" : "red",
              },
              {
                text: "PUMP B BUS LOCK",
                color: state.busB ? "green" : "amber",
              },
            ]}
          />
          <div className="hyd-pump-grid">
            {(["A", "B"] as const).map((name, i) => (
              <div key={name}>
                <h4>PUMP {name}</h4>
                <Rotary
                  label="PREHEATER"
                  on={state.hydraulicPreheaters[i]}
                  onChange={(v) =>
                    command.setHydraulicTempControl(i as 0 | 1, "preheater", v)
                  }
                />
                <Rotary
                  label="FAN"
                  on={state.hydraulicFans[i]}
                  onChange={(v) =>
                    command.setHydraulicTempControl(i as 0 | 1, "fan", v)
                  }
                />
                <Meter
                  label="TEMP"
                  value={state.hydraulicTemps[i]}
                  max={80}
                  unit="°C"
                />
                <Digital
                  label="PUMP RPM"
                  value={state.hydraulicRpm[i]}
                  unit="%"
                />
              </div>
            ))}
          </div>
          <div className="hardware-row">
            <Selector
              label="ACTIVE PUMP"
              value={state.hydraulicPump}
              options={["off", "A", "B"] as const}
              onChange={command.setHydraulicPump}
            />
            <Rotary
              label="AUTO CONTROL"
              on={state.hydraulicAuto}
              onChange={() => command.toggle("hydraulicAuto")}
            />
            <Meter
              label="HYD PRESSURE"
              value={state.hydraulicPressure}
              max={185}
              unit="bar"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
export function TurbinePanel({ state, command }: PanelProps) {
  const [activeUnit, setActiveUnit] = useState<1 | 2>(1);
  const u = activeUnit === 1 ? state.unit : state.unit2;
  const setUnit = activeUnit === 1 ? command.setUnit : command.setUnit2;
  const setMiv = activeUnit === 1 ? command.setMiv : command.setMiv2;
  const setC3 = activeUnit === 1 ? command.setC3 : command.setC32;
  const adjustWicket = activeUnit === 1 ? command.adjustWicket : command.adjustWicket2;
  const trip = activeUnit === 1 ? command.trip : command.trip2;
  const resetTrip = activeUnit === 1 ? command.resetTrip : command.resetTrip2;
  const startupSteps: [string, boolean][] = [
    ["Warm Pump A to 37–45°C; wait for 160+ bar", state.hydraulicPump === "A" && state.hydraulicPressure >= 160],
    ["Start the electric lube pump", (state.electricOilPump || u.rpm >= 150) && state.oilPressure > 2.2],
    ["Arm nitrogen and open MIV bypass to 100%", u.nitrogen && u.mivBypass >= 99],
    ["Open MIV fully and release the turbine brake", u.miv >= 99 && !u.brake],
    ["Enable auto runup and select 250 RPM", u.autoRunup && u.speedTarget === 250],
    ["At 200 RPM, enable excitation master and AVR", u.rpm >= 200 && u.excitationMaster && u.autoExcitation],
    ["At 250 RPM, stop the electric lube pump", u.rpm >= 150 && !state.electricOilPump],
    ["Close C3 when speed and voltage synchronize", u.synced],
  ];
  const nextStep = startupSteps.find(([, complete]) => !complete)?.[0] ?? "Startup complete — take load with wicket-gate controls";
  return (
    <div className="console turbine-console">
      <div className="console-head">
        <div>
          <p className="label">{activeUnit === 1 ? "P120–P123" : "P113–P119"} · UNIT {activeUnit}</p>
          <h2>Turbine, excitation & MIV</h2>
        </div>
        <div className="button-stack"><span>SYNCHRONOUS SPEED 250 RPM</span><div className="gate-buttons"><PushButton label="UNIT 1" color={activeUnit === 1 ? undefined : "amber"} onClick={() => setActiveUnit(1)} /><PushButton label="UNIT 2" color={activeUnit === 2 ? undefined : "amber"} onClick={() => setActiveUnit(2)} /></div></div>
      </div>
      <section className="unit-desk">
        <Annunciator
          title="TURBINE / EXCITATION"
          items={[
            {
              text: "OIL PRESS LOW",
              color: state.oilPressure < 2.2 ? "red" : "green",
              on: state.oilPressure < 2.2,
            },
            { text: "AVR ENABLED", color: "blue", on: u.autoExcitation },
            { text: "GRID BREAKER CLOSED", color: "green", on: u.c3 },
            { text: "TURBINE RUNUP", color: "green", on: u.autoRunup },
            {
              text: "MIV PARTIAL OPEN",
              color: "amber",
              on: u.miv > 0 && u.miv < 99,
            },
          ]}
        />
        <div className="startup-status" role="status">
          <b>{u.tripped ? "UNIT TRIPPED — RESET ONLY BELOW 5 RPM" : "NEXT STARTUP ACTION"}</b>
          <span>{u.tripped ? "Manual trip is always active; automatic trips only latch above 3 RPM." : nextStep}</span>
        </div>
        <div className="instrument-row">
          <Meter label="RPM" value={u.rpm} max={300} />
          <Meter label="VOLTAGE" value={u.voltage} max={16} unit="kV" />
          <Meter label="WICKET GATE" value={u.wicket} />
          <Meter label="VIBRATION" value={u.vibration} max={5} />
          <Digital label="POWER OUTPUT" value={u.mw} unit="MW" />
        </div>
        <div className="control-banks">
          <div>
            <h4>{activeUnit === 1 ? "P120" : "P113"} · TURBINE CONTROL</h4>
            <Rotary
              label="TURBINE BRAKE"
              on={!u.brake}
              onLabel="RELEASE"
              offLabel="APPLY"
              onChange={(v) => setUnit({ brake: !v })}
            />
            <Rotary
              label="AUTO RUNUP"
              on={u.autoRunup}
              onChange={(v) => setUnit({ autoRunup: v })}
            />
            <Selector
              label="SPEED SELECT"
              value={u.speedTarget}
              options={[0, 100, 200, 250] as const}
              onChange={(v) => setUnit({ speedTarget: v })}
            />
            <Selector
              label="WICKET POWER"
              value={u.wicketHydraulic ? "HYD" : "ELEC"}
              options={["ELEC", "HYD"] as const}
              onChange={(v) =>
                setUnit({ wicketHydraulic: v === "HYD" })
              }
            />
            <div className="gate-buttons">
              <PushButton
                label="COARSE − 5%"
                color="amber"
                onClick={() => adjustWicket(-5)}
              />
              <PushButton
                label="FINE − 1%"
                color="amber"
                onClick={() => adjustWicket(-1)}
              />
              <Digital label="WICKET COMMAND" value={u.wicket} unit="%" />
              <PushButton
                label="FINE + 1%"
                onClick={() => adjustWicket(1)}
              />
              <PushButton
                label="COARSE + 5%"
                onClick={() => adjustWicket(5)}
              />
            </div>
          </div>
          <div>
            <h4>{activeUnit === 1 ? "P122" : "P114"} · EXCITATION CONTROL</h4>
            <Rotary
              label="EXCITATION MASTER"
              on={u.excitationMaster}
              onChange={(v) => setUnit({ excitationMaster: v })}
              guarded
            />
            <Rotary
              label="EXCITATION AUTO"
              on={u.autoExcitation}
              onChange={(v) => setUnit({ autoExcitation: v })}
            />
            <Rotary
              label="BREAKER C3"
              on={u.c3}
              onLabel="CLOSE"
              offLabel="OPEN"
              onChange={setC3}
              guarded
            />
          </div>
          <div>
            <h4>{activeUnit === 1 ? "P123" : "P118"} · MIV CONTROL</h4>
            <Rotary
              label="NITROGEN SYSTEM"
              on={u.nitrogen}
              onChange={(v) => setUnit({ nitrogen: v })}
            />
            <label className="slider">
              MIV BYPASS <b>{Math.round(u.mivBypass)}%</b>
              <input
                type="range"
                min="0"
                max="100"
                value={u.mivBypass}
                onChange={(e) =>
                  setUnit({ mivBypass: +e.target.value })
                }
              />
            </label>
            <div className="button-stack">
              <PushButton
                label="MIV 0%"
                color="red"
                onClick={() => setMiv(0)}
              />
              <PushButton
                label="MIV 50%"
                color="amber"
                onClick={() => setMiv(50)}
              />
              <PushButton
                label="MIV 100%"
                onClick={() => setMiv(100)}
              />
            </div>
            <PushButton label={`UNIT ${activeUnit} TRIP`} color="red" onClick={trip} />
            <PushButton
              label="RESET TRIP"
              color="amber"
              onClick={resetTrip}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
export function ElectricalPanel({ state, command, totalMw }: PanelProps) {
  return (
    <div className="console electrical-console">
      <div className="console-head">
        <div>
          <p className="label">POWER CONTROL</p>
          <h2>Bus, transformer & emergency supply</h2>
        </div>
        <Digital label="GRID DEMAND" value={state.gridDemand} unit="MW" />
      </div>
      <div className="bus-mimic">
        <div
          className={`busline ${state.offsitePower || totalMw > 10 ? "hot" : ""}`}
        />
        {[
          ["MAIN BUS A", state.busA ? "13.8" : "0.0", "busA"],
          ["BUS A1", state.busA1 ? "6.6" : "0.0", "busA1"],
          ["BUS C", state.busC ? "220" : "0", "busC"],
          ["MAIN BUS B", state.busB ? "6.6" : "0.0", "busB"],
        ].map(([name, voltage, key]) => (
          <section key={key}>
            <h3>{name}</h3>
            <Digital label="BUS VOLTAGE" value={voltage} unit="kV" />
            <Rotary
              label={`${name} BREAKER`}
              on={Boolean(state[key as keyof PlantState])}
              onChange={() => command.toggle(key as keyof PlantState)}
            />
          </section>
        ))}
      </div>
      <div className="electrical-controls">
        <Rotary
          label="STARTUP TRANSFORMER"
          on={state.startupTransformer}
          onChange={() => command.toggle("startupTransformer")}
          guarded
        />
        <Rotary
          label="ISLAND POWER FEED"
          on={state.islandFeed}
          onChange={() => command.toggle("islandFeed")}
          guarded
        />
        <Selector
          label="EDG CONTROL"
          value={state.edg}
          options={["off", "runup", "active"] as const}
          onChange={command.setEdg}
        />
        <Meter label="BATTERY" value={state.battery} unit="%" />
        <Rotary
          label="OFFSITE POWER"
          on={state.offsitePower}
          onChange={() => command.toggle("offsitePower")}
          guarded
        />
      </div>
    </div>
  );
}
export function UnitsPanel({ state, command }: PanelProps) {
  const units = [state.unit, state.unit2];
  return (
    <div className="console unit-monitor">
      <div className="console-head">
        <div>
          <p className="label">P232 / P234 · UNITS 1 & 2</p>
          <h2>Unit monitoring & load split</h2>
        </div>
      </div>
      <div className="control-banks">
        {units.map((u) => (
          <section className="monitor-single" key={u.id}>
            <h4>UNIT {u.id}</h4>
            <div className="unit-lamps">
              <Lamp label="UNIT TRIP" color="red" on={u.tripped} />
              <Lamp label="UNIT ONLINE" color="green" on={u.synced} />
              <Lamp label="HYDRAULICS READY" color="green" on={state.hydraulicPressure >= 160} />
              <Lamp label="LUBE SYSTEM" color="green" on={state.oilPressure > 2.2} />
            </div>
            <div className="digital-grid">
              <Digital label="GENERATOR MW" value={u.mw} />
              <Digital label="WICKET POSITION" value={u.wicket} unit="%" />
              <Digital label="RPM" value={u.rpm} />
              <Digital label="EXCITATION" value={u.excitation} unit="%" />
            </div>
            <PushButton label={`TRIP UNIT ${u.id}`} color="red" onClick={u.id === 1 ? command.trip : command.trip2} />
          </section>
        ))}
      </div>
      <section className="hardware-row">
        <Rotary
          label="LOAD SPLITTING"
          on={state.loadSplitting}
          onChange={command.toggleLoadSplitting}
        />
        <p className="panel-note">With both units synchronized, load splitting shares the current grid demand evenly between them.</p>
      </section>
    </div>
  );
}
export function SpillwayPanel({ state, command }: PanelProps) {
  return (
    <div className="console spill-console">
      <div className="console-head">
        <div>
          <p className="label">P234</p>
          <h2>Three spillways & tailwater control</h2>
        </div>
        <span>TAILWATER ON DEMAND IS A MANUAL TARGET</span>
      </div>
      <div className="water-metrics">
        <Meter label="RESERVOIR" value={state.reservoir} unit="%" />
        <Meter label="TAILWATER" value={state.tailwater} max={15} unit="m" />
        <Meter label="DEMAND" value={state.tailwaterDemand} max={15} unit="m" />
        <Digital
          label="TAILWATER ERROR"
          value={state.tailwater - state.tailwaterDemand}
          unit="m"
        />
      </div>
      <div className="hardware-row">
        <Rotary
          label="SETPOINT PRIORITY"
          on={state.spillwaySetpointPriority}
          onChange={() => command.toggle("spillwaySetpointPriority")}
        />
        <label className="slider">
          TAILWATER SETPOINT <b>{state.tailwaterDemand.toFixed(1)} m</b>
          <input
            type="range"
            min="4"
            max="10"
            step="0.1"
            value={state.tailwaterDemand}
            onChange={(event) => command.setTailwaterDemand(+event.target.value)}
          />
        </label>
        <p className="panel-note">Setpoint priority drives all three gates and disables manual gate commands.</p>
      </div>
      <div className="spill-gates">
        {state.spillways.map((gate, i) => (
          <section key={i}>
            <h3>SPILLWAY {i + 1}</h3>
            <Rotary
              label="MOTOR MASTER"
              on={state.spillwayMaster[i]}
              onChange={(v) => command.setSpillMaster(i, v)}
            />
            <Rotary
              label="MOTOR BRAKE"
              on={!state.spillwayBrakes[i]}
              onLabel="RELEASED"
              offLabel="APPLIED"
              onChange={(released) => command.setSpillBrake(i, !released)}
            />
            <label className="vertical-slider">
              <b>{Math.round(gate)}%</b>
              <input
                type="range"
                min="0"
                max="100"
                value={gate}
                onChange={(e) => command.setSpillway(i, +e.target.value)}
              />
            </label>
            <Lamp
              label={gate > 0 ? "IN TRANSIT" : "GATE CLOSED"}
              color={gate > 0 ? "green" : "amber"}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
