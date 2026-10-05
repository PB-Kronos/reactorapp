import { useEffect, useMemo, useRef, useState } from "react";

export type Page =
  | "overview"
  | "turbine"
  | "auxiliaries"
  | "electrical"
  | "units"
  | "spillway"
  | "procedures";
export type LampColor = "red" | "amber" | "green" | "blue";
export type LogEntry = {
  id: number;
  time: string;
  text: string;
  level: "ok" | "warn" | "alarm";
};
export type UnitState = {
  id: 1 | 2;
  brake: boolean;
  nitrogen: boolean;
  mivBypass: number;
  /** Operator command; the indicated MIV position follows the water-wave model. */
  mivCommand: number;
  miv: number;
  turbineFill: number;
  wicket: number;
  wicketHydraulic: boolean;
  autoRunup: boolean;
  speedTarget: 0 | 100 | 200 | 248;
  rpm: number;
  excitationMaster: boolean;
  autoExcitation: boolean;
  excitation: number;
  voltage: number;
  c3: boolean;
  mw: number;
  synced: boolean;
  tripped: boolean;
  vibration: number;
  bearingTemp: number;
  shaftPumpLatched: boolean;
};
export type PlantState = {
  controls: {
    t1HydraulicIsolator: boolean;
    t2HydraulicIsolator: boolean;
    hydraulicAutoPressure: boolean;
    hydraulicPressureSetpoint: number;
    hydraulicTransferPump: boolean;
    pumpATripped: boolean;
    pumpBTripped: boolean;
    nitrogenIsolator: boolean;
    nitrogenCharge1: number;
    nitrogenCharge2: number;
    fireAuto: boolean;
    fireDischarge: boolean;
    t2IntakeGate: boolean;
    t2TurningGear: boolean;
    t2JackingPump: boolean;
    t2DraftTubeDrain: boolean;
    unit1IntakeGate: boolean;
    unit1WicketBreaker: boolean;
    oilRefillValve: boolean;
    oilPumpSpeed: number;
    generatorPumpSpeed: number;
    generatorAutoCooling: boolean;
    generatorRefill1: boolean;
    generatorRefill2: boolean;
    recirculationPump: boolean;
    transformerFan1: 0 | 1 | 2;
    transformerFan2: 0 | 1 | 2;
    lvBus: boolean;
    villageBus: boolean;
    grid400V: boolean;
    u1OilCoolingPump: boolean;
    u2OilCoolingPump: boolean;
    u1GeneratorPreheater: boolean;
    u2GeneratorPreheater: boolean;
    u1GeneratorPump: boolean;
    u2GeneratorPump: boolean;
    u1GeneratorAutoCooling: boolean;
    u2GeneratorAutoCooling: boolean;
    t1TrashRackAuto: boolean;
    t2TrashRackAuto: boolean;
    edgFuelValve: boolean;
    edgFuelPump1: boolean;
    edgFuelPump2: boolean;
    edgAutoMode: boolean;
    edgIgnitionBreaker: boolean;
    edgFanSpeed: number;
  };
  hydraulicPump: "off" | "A" | "B";
  hydraulicAuto: boolean;
  hydraulicPressure: number;
  hydraulicTemps: [number, number];
  hydraulicPreheaters: [boolean, boolean];
  hydraulicFans: [boolean, boolean];
  hydraulicRpm: [number, number];
  electricOilPump: boolean;
  oilCooling: boolean;
  oilAuto: boolean;
  oilPressure: number;
  oilTemp: number;
  oilFilter: "A" | "B";
  oilFilterDiff: [number, number];
  oilFilterBypass: boolean;
  maintenanceCalled: boolean;
  coolantValve: boolean;
  coolantPumps: [boolean, boolean];
  coolantFilter: "A" | "B";
  coolantFilterDiff: [number, number];
  coolantTemp: number;
  generatorCooling: boolean;
  generatorPreheater: boolean;
  generatorTemp: number;
  trashRackAuto: boolean;
  trashRackRunning: boolean;
  startupTransformer: boolean;
  islandFeed: boolean;
  busA: boolean;
  busA1: boolean;
  busB: boolean;
  busC: boolean;
  inverter: boolean;
  battery: number;
  edg: "off" | "runup" | "active";
  edgFuelLevel: number;
  offsitePower: boolean;
  spillwayMaster: [boolean, boolean, boolean, boolean];
  spillwayBrakes: [boolean, boolean, boolean, boolean];
  spillwaySetpointPriority: boolean;
  spillways: [number, number, number, number];
  reservoir: number;
  tailwater: number;
  tailwaterDemand: number;
  gridDemand: number;
  points: number;
  unit: UnitState;
  unit2: UnitState;
  loadSplitting: boolean;
  acknowledged: boolean;
  logs: LogEntry[];
};
const coldUnit = (id: 1 | 2 = 1): UnitState => ({
  id,
  brake: true,
  // The nitrogen accumulator is charged at shutdown. It is discharged by a
  // turbine trip to force the wicket gates shut; it is not a start permissive.
  nitrogen: true,
  mivBypass: 0,
  mivCommand: 0,
  miv: 0,
  turbineFill: 0,
  wicket: 0,
  wicketHydraulic: false,
  autoRunup: false,
  speedTarget: 0,
  rpm: 0,
  excitationMaster: false,
  autoExcitation: false,
  excitation: 0,
  voltage: 0,
  c3: false,
  mw: 0,
  synced: false,
  tripped: false,
  vibration: 0.3,
  bearingTemp: 25,
  shaftPumpLatched: false,
});
const initial: PlantState = {
  controls: {
    t1HydraulicIsolator: false, t2HydraulicIsolator: false, hydraulicAutoPressure: false,
    hydraulicPressureSetpoint: 175, hydraulicTransferPump: false, pumpATripped: false,
    pumpBTripped: false, nitrogenIsolator: false, nitrogenCharge1: 0, nitrogenCharge2: 0,
    fireAuto: false, fireDischarge: false, t2IntakeGate: false, t2TurningGear: false,
    t2JackingPump: false, t2DraftTubeDrain: false, unit1IntakeGate: false,
    unit1WicketBreaker: false, oilRefillValve: false, oilPumpSpeed: 50,
    generatorPumpSpeed: 50, generatorAutoCooling: false, generatorRefill1: false,
    generatorRefill2: false, recirculationPump: false, transformerFan1: 0,
    transformerFan2: 0, lvBus: false, villageBus: false, grid400V: true,
    u1OilCoolingPump: false, u2OilCoolingPump: false,
    u1GeneratorPreheater: false, u2GeneratorPreheater: false,
    u1GeneratorPump: false, u2GeneratorPump: false,
    u1GeneratorAutoCooling: false, u2GeneratorAutoCooling: false,
    t1TrashRackAuto: false, t2TrashRackAuto: false, edgFuelValve: false,
    edgFuelPump1: false, edgFuelPump2: false, edgAutoMode: true,
    edgIgnitionBreaker: false, edgFanSpeed: 0,
  },
  hydraulicPump: "off",
  hydraulicAuto: false,
  hydraulicPressure: 0,
  hydraulicTemps: [24, 24],
  hydraulicPreheaters: [false, false],
  hydraulicFans: [false, false],
  hydraulicRpm: [0, 0],
  electricOilPump: false,
  oilCooling: false,
  oilAuto: false,
  oilPressure: 0,
  oilTemp: 24,
  oilFilter: "A",
  oilFilterDiff: [1.2, 1.2],
  oilFilterBypass: false,
  maintenanceCalled: false,
  coolantValve: false,
  coolantPumps: [false, false],
  coolantFilter: "A",
  coolantFilterDiff: [1.1, 1.1],
  coolantTemp: 21,
  generatorCooling: false,
  generatorPreheater: false,
  generatorTemp: 24,
  trashRackAuto: false,
  trashRackRunning: false,
  startupTransformer: true,
  islandFeed: false,
  busA: true,
  busA1: false,
  busB: false,
  busC: false,
  inverter: true,
  battery: 100,
  edg: "off",
  edgFuelLevel: 75,
  offsitePower: true,
  spillwayMaster: [false, false, false, false],
  spillwayBrakes: [true, true, true, true],
  spillwaySetpointPriority: false,
  spillways: [0, 0, 0, 0],
  reservoir: 78.4,
  tailwater: 5.2,
  tailwaterDemand: 6,
  gridDemand: 10.9,
  points: 6420,
  unit: coldUnit(),
  unit2: coldUnit(2),
  loadSplitting: false,
  acknowledged: false,
  logs: [],
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
const stamp = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
const ease = (value: number, target: number, factor: number) =>
  value + (target - value) * factor;

export function usePlantSimulator() {
  const [state, setState] = useState<PlantState>(() => {
    try {
      const saved = localStorage.getItem("hes-simulator-v3");
      if (!saved) return initial;
      const restored = JSON.parse(saved) as Partial<PlantState>;
      // Spillway 4 is retained as an explicitly inoperable, closed gate.
      // Older saved plants remain usable instead of producing an invalid panel.
      const oldGates = restored.spillways || initial.spillways;
      const oldMasters = restored.spillwayMaster || initial.spillwayMaster;
      return {
        ...initial,
        ...restored,
        controls: { ...initial.controls, ...restored.controls },
        logs: [],
        spillways: [oldGates[0] || 0, oldGates[1] || 0, oldGates[2] || 0, 0],
        spillwayMaster: [Boolean(oldMasters[0]), Boolean(oldMasters[1]), Boolean(oldMasters[2]), false],
        spillwayBrakes: [Boolean(restored.spillwayBrakes?.[0] ?? true), Boolean(restored.spillwayBrakes?.[1] ?? true), Boolean(restored.spillwayBrakes?.[2] ?? true), true],
        spillwaySetpointPriority: restored.spillwaySetpointPriority || false,
        unit: { ...coldUnit(), ...restored.unit, turbineFill: Number.isFinite(restored.unit?.turbineFill) ? restored.unit!.turbineFill : 0, mivCommand: Number.isFinite(restored.unit?.mivCommand) ? restored.unit!.mivCommand : restored.unit?.miv ?? 0, speedTarget: (restored.unit?.speedTarget as number | undefined) === 250 ? 248 : restored.unit?.speedTarget },
        unit2: { ...coldUnit(2), ...restored.unit2, id: 2, turbineFill: Number.isFinite(restored.unit2?.turbineFill) ? restored.unit2!.turbineFill : 0, mivCommand: Number.isFinite(restored.unit2?.mivCommand) ? restored.unit2!.mivCommand : restored.unit2?.miv ?? 0, speedTarget: (restored.unit2?.speedTarget as number | undefined) === 250 ? 248 : restored.unit2?.speedTarget },
      };
    } catch {
      return initial;
    }
  });
  const latest = useRef(state);
  latest.current = state;
  const log = (text: string, level: LogEntry["level"] = "ok") =>
    setState((s) => ({
      ...s,
      logs: [
        { id: Date.now() + Math.random(), time: stamp(), text, level },
        ...s.logs,
      ].slice(0, 30),
    }));
  const patch = (value: Partial<PlantState>) =>
    setState((s) => ({ ...s, ...value }));
  const patchUnit = (value: Partial<UnitState>) =>
    setState((s) => ({ ...s, unit: { ...s.unit, ...value } }));
  const patchUnit2 = (value: Partial<UnitState>) =>
    setState((s) => ({ ...s, unit2: { ...s.unit2, ...value } }));
  const patchControls = (value: Partial<PlantState["controls"]>) =>
    setState((s) => ({ ...s, controls: { ...s.controls, ...value } }));

  useEffect(() => {
    const timer = setInterval(
      () =>
        setState((s) => {
          const u = s.unit;
          // Hydraulic auxiliaries retain their off-site/bus supply when a
          // generator breaker opens; C3 is not a hydraulic interlock.
          const busBAvailable = s.busB || s.offsitePower || u.synced;
          const hydraulicPreheaters = [...s.hydraulicPreheaters] as [
            boolean,
            boolean,
          ];
          const hydraulicFans = [...s.hydraulicFans] as [boolean, boolean];
          if (s.hydraulicAuto) {
            [0, 1].forEach((i) => {
              const powered = i === 0 ? s.offsitePower : busBAvailable;
              if (powered) {
                if (s.hydraulicTemps[i] < 39) {
                  hydraulicPreheaters[i] = true;
                  hydraulicFans[i] = false;
                } else if (s.hydraulicTemps[i] > 40) {
                  hydraulicPreheaters[i] = false;
                  hydraulicFans[i] = true;
                } else {
                  hydraulicPreheaters[i] = false;
                  hydraulicFans[i] = false;
                }
              }
            });
          }
          const hydraulicTemps = [0, 1].map((i) => {
            const powered = i === 0 ? s.offsitePower : busBAvailable;
            const heat = hydraulicPreheaters[i] && powered ? 0.16 : 0;
            const cool = hydraulicFans[i] && powered ? 0.1 : 0;
            return clamp(
              s.hydraulicTemps[i] +
                heat -
                cool -
                (s.hydraulicTemps[i] - 23) * 0.003,
              5,
              85,
            );
          }) as [number, number];
          // Temperature automation conditions the selected pump; it must not
          // silently transfer pumps when C3 changes state.
          const hydraulicPump = s.hydraulicPump;
          const selected =
            hydraulicPump === "A" ? 0 : hydraulicPump === "B" ? 1 : -1;
          const selectedPowered =
            selected === 0
              ? s.offsitePower && !s.controls.pumpATripped
              : selected === 1
                ? busBAvailable && !s.controls.pumpBTripped
                : false;
          const temp =
            selected === 0
              ? hydraulicTemps[0]
              : selected === 1
                ? hydraulicTemps[1]
                : 24;
          const hydraulicRpmTarget =
            selectedPowered && temp >= 37 && temp <= 45
              ? 100
              : selectedPowered
                ? clamp(100 - Math.abs(temp - 41) * 13, 0, 100)
                : 0;
          const hydraulicRpm = [
            ease(
              s.hydraulicRpm[0],
              selected === 0 ? hydraulicRpmTarget : 0,
              0.1,
            ),
            ease(
              s.hydraulicRpm[1],
              selected === 1 ? hydraulicRpmTarget : 0,
              0.1,
            ),
          ] as [number, number];
          const rawHydraulicPressure = clamp(
            ease(
              s.hydraulicPressure,
              selected === 0
                ? hydraulicRpm[0] * (s.controls.hydraulicAutoPressure ? s.controls.hydraulicPressureSetpoint / 100 : 1.82)
                : selected === 1
                  ? hydraulicRpm[1] * (s.controls.hydraulicAutoPressure ? s.controls.hydraulicPressureSetpoint / 100 : 1.82)
                  : 0,
              0.08,
            ),
            0,
            185,
          );
          const hydraulicPressure = (s.controls.t1HydraulicIsolator || s.controls.t2HydraulicIsolator)
            ? Math.min(rawHydraulicPressure, 25)
            : rawHydraulicPressure;
          const coolantFlow =
            s.coolantValve && s.coolantPumps[0] && s.coolantPumps[1];
          const activeCoolant = s.coolantFilter === "A" ? 0 : 1;
          const coolantDiff = [...s.coolantFilterDiff] as [number, number];
          coolantDiff[activeCoolant] = clamp(
            coolantDiff[activeCoolant] + (coolantFlow ? 0.0005 : 0),
            0.2,
            6,
          );
          const coolantTemp = clamp(
            ease(s.coolantTemp, coolantFlow ? 25 : 55, 0.012),
            5,
            90,
          );
          // Once the shaft pump picks up at 125 RPM it stays primed until the
          // rotor stops, so the electric-to-shaft-pump handover is stable.
          const shaftPumpLatched =
            u.rpm > 3 && (u.shaftPumpLatched || u.rpm >= 125);
          const shaftPump = shaftPumpLatched;
          const oilTarget = s.electricOilPump || shaftPump ? 4.2 : 0;
          const oilPressure = clamp(
            ease(
              s.oilPressure,
              oilTarget * (s.oilFilterBypass ? 0.82 : 1),
              0.09,
            ),
            0,
            5,
          );
          const activeOil = s.oilFilter === "A" ? 0 : 1;
          const oilDiff = [...s.oilFilterDiff] as [number, number];
          oilDiff[activeOil] = clamp(
            oilDiff[activeOil] + (oilPressure > 0 ? 0.0012 : 0),
            0.5,
            6,
          );
          const oilCooling = (s.oilAuto || s.controls.u1OilCoolingPump || s.controls.u2OilCoolingPump)
            ? s.oilTemp > 50
              ? true
              : s.oilTemp < 42
                ? false
                : s.oilCooling
            : s.oilCooling;
          const oilTempTarget = u.rpm > 10 ? 62 : 24;
          const oilTemp = clamp(
            ease(
              s.oilTemp,
              oilTempTarget,
              oilCooling && coolantFlow ? 0.007 + s.controls.oilPumpSpeed / 5000 : 0.007,
            ),
            8,
            110,
          );
    // Wickets use electric drive at low speed; hydraulic drive takes over after pressure is available.
    const gatePower = u.wicketHydraulic ? hydraulicPressure >= 150 : s.offsitePower && s.controls.unit1WicketBreaker;
          // In the observed automatic run-up, the governor settles at about
          // 20% wicket opening (about 0.20 water flow) as the unit reaches
          // 250 RPM; manual wicket controls take over once auto-runup is off.
          const commandedWicket = u.autoRunup && u.speedTarget === 248
            ? ease(u.wicket, 20, 0.035)
            : u.wicket;
          const wicket =
            gatePower && !u.tripped ? commandedWicket : Math.max(0, u.wicket - 1.25);
          const lubricationSafe =
            oilPressure > 2.2 &&
            (s.electricOilPump || shaftPump);
          // The scroll case and runner do not fill instantly when an MIV moves.
          // Keeping the fill as a state gives the MIV/fill instruments a useful,
          // observable relationship during instruction and run-up.
          const miv = u.mivCommand >= 99
            ? 97.5 + 2.5 * Math.sin(Date.now() / 1700 + u.id)
            : ease(u.miv, u.mivCommand, 0.08);
          const turbineFill = clamp(ease(Number.isFinite(u.turbineFill) ? u.turbineFill : 0, miv, 0.045), 0, 100);
          const canTurn =
            !u.brake && miv > 90 && turbineFill > 90 && lubricationSafe && !u.tripped;
          // Prior to synchronization, Auto Runup governs the selected speed
          // (or the operator may hold speed manually with the wicket gates).
          // Once C3 is manually closed in synchronism, grid frequency holds
          // the runner at 250 RPM and wicket movement changes MW instead.
          const turbineRpmTarget = canTurn
            ? u.c3
              ? 250
              : u.autoRunup
                ? u.speedTarget === 248 ? 250 : u.speedTarget
                : Math.min(250, wicket * 12.5)
            : 0;
          const rpm = clamp(ease(u.rpm, turbineRpmTarget, 0.035), 0, 285);
          const excitation = clamp(
            ease(
              u.excitation,
              u.excitationMaster ? (u.autoExcitation ? 82 : u.excitation) : 0,
              0.05,
            ),
            0,
            110,
          );
          const voltage = clamp(((rpm / 250) * 13.8 * excitation) / 82, 0, 16);
          const preGenTemp = s.generatorTemp;
          const generatorTemp = clamp(
            (s.generatorCooling || s.controls.generatorAutoCooling || s.controls.u1GeneratorPump || s.controls.u2GeneratorPump || s.controls.u1GeneratorAutoCooling || s.controls.u2GeneratorAutoCooling) && coolantFlow
              ? ease(preGenTemp, 34, 0.006 + s.controls.generatorPumpSpeed / 5000)
              : (s.generatorPreheater || s.controls.u1GeneratorPreheater || s.controls.u2GeneratorPreheater)
                ? ease(preGenTemp, 42, 0.015)
                : preGenTemp,
            3,
            120,
          );
          // A stopped shaft cannot be damaged by an automatic turbine trip.  Faults
          // still annunciates at standstill, but protection only latches after 3 RPM.
          // The lube system has no low-temperature trip: it starts at ambient and
          // warms naturally as the shaft turns; only overheating is destructive.
          const generatorTrip = generatorTemp < 12 || generatorTemp > 85;
          const oilTrip = oilTemp > 78;
          const pressureTrip =
            u.wicketHydraulic && hydraulicPressure < 35 && wicket <= 0;
          const preliminaryMw =
            u.c3 && Math.abs(rpm - 250) < 3 && Math.abs(voltage - 13.8) < 1
              ? clamp(13 * (wicket / 100) * (turbineFill / 100), 0, 13)
              : 0;
          const bearingTemp = clamp(
            ease(
              u.bearingTemp,
              25 + preliminaryMw * 0.11 + (oilPressure < 2 ? 38 : 0),
              0.01,
            ),
            15,
            125,
          );
          const vibration = clamp(
            0.3 + Math.abs(250 - rpm) / 90 + (wicket > 90 ? 0.5 : 0),
            0.2,
            5,
          );
          const automaticTrip =
            rpm > 3 &&
            (generatorTrip ||
              oilTrip ||
              pressureTrip ||
              bearingTemp > 105 ||
              vibration > 4);
          const trip = u.tripped || automaticTrip;
          const synced =
            u.c3 &&
            !trip &&
            Math.abs(rpm - 250) < 3 &&
            Math.abs(voltage - 13.8) < 1;
          const unit = {
            ...u,
            rpm,
            excitation,
            voltage,
            wicket: trip
              ? Math.max(0, wicket - (u.nitrogen ? 6 : 0.35))
              : wicket,
            miv: trip ? Math.max(0, miv - 2) : miv,
            mivCommand: trip ? 0 : u.mivCommand,
            nitrogen: trip && wicket <= 6 ? false : u.nitrogen,
            turbineFill,
            c3: u.c3 && !trip,
            mw: trip ? 0 : preliminaryMw,
            synced,
            tripped: trip,
            bearingTemp,
            vibration,
            shaftPumpLatched,
          };
          // Unit 2 shares the plant hydraulic header and cooling/filtration
          // services, but retains its own turbine, MIV and excitation controls.
          const u2 = s.unit2;
          const miv2 = u2.mivCommand >= 99
            ? 97.5 + 2.5 * Math.sin(Date.now() / 1700 + u2.id)
            : ease(u2.miv, u2.mivCommand, 0.08);
          const turbineFill2 = clamp(ease(Number.isFinite(u2.turbineFill) ? u2.turbineFill : 0, miv2, 0.045), 0, 100);
          const canTurn2 = !u2.brake && miv2 > 90 && turbineFill2 > 90 && lubricationSafe && !u2.tripped && s.controls.t2IntakeGate && (u2.rpm >= 5 || (s.controls.t2TurningGear && s.controls.t2JackingPump));
          const commandedWicket2 = u2.autoRunup && u2.speedTarget === 248
            ? ease(u2.wicket, 20, 0.035)
            : u2.wicket;
          const wicket2 = u2.wicketHydraulic && hydraulicPressure >= 150 && !u2.tripped
            ? commandedWicket2
            : Math.max(0, u2.wicket - 1.25);
          const rpm2 = clamp(ease(u2.rpm, canTurn2 ? (u2.c3 ? 250 : u2.autoRunup ? (u2.speedTarget === 248 ? 250 : u2.speedTarget) : Math.min(250, wicket2 * 12.5)) : 0, 0.035), 0, 285);
          const excitation2 = clamp(ease(u2.excitation, u2.excitationMaster ? (u2.autoExcitation ? 82 : u2.excitation) : 0, 0.05), 0, 110);
          const voltage2 = clamp(((rpm2 / 250) * 13.8 * excitation2) / 82, 0, 16);
          const preliminaryMw2 = u2.c3 && Math.abs(rpm2 - 250) < 3 && Math.abs(voltage2 - 13.8) < 1
            ? clamp(13 * (wicket2 / 100) * (turbineFill2 / 100), 0, 13)
            : 0;
          const automaticTrip2 = rpm2 > 3 && (generatorTrip || oilTrip || u2.bearingTemp > 105 || u2.vibration > 4);
          const trip2 = u2.tripped || automaticTrip2;
          const unit2 = {
            ...u2,
            rpm: rpm2,
            excitation: excitation2,
            voltage: voltage2,
            wicket: trip2
              ? Math.max(0, wicket2 - (u2.nitrogen ? 6 : 0.35))
              : wicket2,
            miv: trip2 ? Math.max(0, miv2 - 2) : miv2,
            mivCommand: trip2 ? 0 : u2.mivCommand,
            nitrogen: trip2 && wicket2 <= 6 ? false : u2.nitrogen,
            turbineFill: turbineFill2,
            c3: u2.c3 && !trip2,
            mw: trip2 ? 0 : preliminaryMw2,
            synced: u2.c3 && !trip2 && Math.abs(rpm2 - 250) < 3 && Math.abs(voltage2 - 13.8) < 1,
            tripped: trip2,
            bearingTemp: clamp(ease(u2.bearingTemp, 25 + preliminaryMw2 * 0.11 + (oilPressure < 2 ? 38 : 0), 0.01), 15, 125),
            vibration: clamp(0.3 + Math.abs(250 - rpm2) / 90 + (u2.wicket > 90 ? 0.5 : 0), 0.2, 5),
            shaftPumpLatched: rpm2 > 3 && (u2.shaftPumpLatched || rpm2 >= 125),
          };
          const splitTarget = clamp((s.gridDemand / 2 / 13) * 100, 0, 100);
          if (s.loadSplitting && unit.synced && unit2.synced) {
            unit.wicket = ease(unit.wicket, splitTarget, 0.04);
            unit2.wicket = ease(unit2.wicket, splitTarget, 0.04);
          }
          const spillways = s.spillwaySetpointPriority
            ? (s.spillways.map((_, index) =>
                index === 3 ? 0 : clamp((s.tailwaterDemand - s.tailwater + 3) * 16, 0, 100),
              ) as PlantState["spillways"])
            : s.spillways;
          const flow =
            (unit.wicket * (unit.miv / 100)) + (unit2.wicket * (unit2.miv / 100)) +
            spillways.reduce((a, b) => a + b, 0) * 0.55;
          const reservoir = clamp(
            s.reservoir + 0.006 - flow * 0.000035,
            4,
            100,
          );
          const tailwater = clamp(
            ease(s.tailwater, 2.5 + flow * 0.035, 0.025),
            0,
            15,
          );
          const autoCount = [
            s.hydraulicAuto,
            s.oilAuto,
            u.autoExcitation,
          ].filter(Boolean).length;
          const autoDeduction = autoCount * 0.05;
          const trashRackRunning = (s.trashRackAuto || s.controls.t1TrashRackAuto || s.controls.t2TrashRackAuto) && (unit.wicket > 15 || unit2.wicket > 15);
          const edgFuelLevel = clamp(s.edgFuelLevel + (s.controls.edgFuelValve ? 0.025 : 0) - (s.edg === "active" ? 0.012 : 0), 0, 100);
          const edg = s.edg === "active" && edgFuelLevel <= 0 ? "off" : s.edg;
          return {
            ...s,
            hydraulicPump,
            hydraulicPreheaters,
            hydraulicFans,
            hydraulicTemps,
            hydraulicRpm,
            hydraulicPressure,
            coolantFilterDiff: coolantDiff,
            coolantTemp,
            oilCooling,
            oilPressure,
            oilFilterDiff: oilDiff,
            oilTemp,
            generatorTemp,
            unit,
            unit2,
            spillways,
            reservoir,
            tailwater,
            busB: busBAvailable,
            trashRackRunning,
            edgFuelLevel,
            edg,
            points: Math.max(0, s.points - autoDeduction / 4),
            acknowledged: false,
          };
        }),
      250,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setState((s) => ({
          ...s,
          gridDemand: clamp(
            s.gridDemand +
              (Math.random() > 0.5 ? 1 : -1) *
                (0.1 + Math.random() * 1.4),
            0.5,
            26,
          ),
        })),
      55000,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = setInterval(
      () =>
        localStorage.setItem(
          "hes-simulator-v3",
          JSON.stringify({ ...latest.current, logs: [] }),
        ),
      2000,
    );
    return () => clearInterval(timer);
  }, []);
  const totalMw = state.unit.mw + state.unit2.mw;
  const alarms = useMemo(() => {
    const a: { text: string; color: LampColor }[] = [];
    const u = state.unit;
    if (state.hydraulicPressure < 160)
      a.push({ text: "HYDRAULIC PRESSURE LOW", color: "red" });
    else a.push({ text: "PRESSURE NORMAL", color: "green" });
    if (state.hydraulicTemps[0] < 37 || state.hydraulicTemps[0] > 45)
      a.push({ text: "PUMP A TEMP OUTSIDE BAND", color: "amber" });
    if (state.hydraulicTemps[1] < 37 || state.hydraulicTemps[1] > 45)
      a.push({ text: "PUMP B TEMP OUTSIDE BAND", color: "amber" });
    if (
      state.oilFilterDiff[state.oilFilter === "A" ? 0 : 1] >= 4 &&
      !state.oilFilterBypass
    )
      a.push({ text: "OIL FILTER DIFFERENTIAL HIGH", color: "red" });
    if (state.generatorTemp < 12)
      a.push({ text: "GENERATOR TEMP LOW", color: "red" });
    if (state.generatorTemp > 85)
      a.push({ text: "GENERATOR TEMP HIGH", color: "red" });
    if (u.tripped) a.push({ text: "UNIT 1 TRIP", color: "red" });
    if (state.unit2.tripped) a.push({ text: "UNIT 2 TRIP", color: "red" });
    if (u.synced) a.push({ text: "UNIT 1 SYNCED", color: "green" });
    if (state.unit2.synced) a.push({ text: "UNIT 2 SYNCED", color: "green" });
    if (state.loadSplitting) a.push({ text: "LOAD SPLITTING ACTIVE", color: "blue" });
    if (state.edg === "runup") a.push({ text: "EDG RUNUP", color: "green" });
    if (state.edg === "active") a.push({ text: "EDG ACTIVE", color: "green" });
    if (state.islandFeed) a.push({ text: "ISLAND POWER FEED", color: "green" });
    if (state.controls.t1HydraulicIsolator || state.controls.t2HydraulicIsolator) a.push({ text: "HYDRAULIC SHUTOFF", color: "red" });
    if (state.controls.pumpATripped) a.push({ text: "PUMP A TRIP", color: "red" });
    if (state.controls.pumpBTripped) a.push({ text: "PUMP B TRIP", color: "red" });
    if (state.hydraulicAuto) a.push({ text: "HYDRAULIC AUTO CONTROL", color: "blue" });
    if (state.oilAuto) a.push({ text: "OIL TEMPERATURE AUTO", color: "blue" });
    if (state.controls.generatorAutoCooling) a.push({ text: "AUTOMATIC GENERATOR COOLING", color: "blue" });
    if (!state.controls.nitrogenIsolator) a.push({ text: "NITROGEN ISOLATED", color: "red" });
    if (Math.min(state.controls.nitrogenCharge1, state.controls.nitrogenCharge2) < 60) a.push({ text: "SUPPRESSION PRESSURE INSUFFICIENT", color: "red" });
    if (state.controls.t2TurningGear) a.push({ text: "TURNING GEAR ENGAGED", color: "green" });
    if (state.controls.t2JackingPump && state.oilPressure > 2.2) a.push({ text: "JACKING PRESSURE OK", color: "green" });
    if (state.controls.fireDischarge) a.push({ text: "FIRE SUPPRESSION DISCHARGED", color: "amber" });
    if (!state.coolantPumps[0] || !state.coolantPumps[1]) a.push({ text: "COOLANT PUMP TRIP", color: "red" });
    if (state.coolantFilterDiff[0] >= 4) a.push({ text: "FILTER A DELTAP HIGH", color: "amber" });
    if (state.coolantFilterDiff[1] >= 4) a.push({ text: "FILTER B DELTAP HIGH", color: "amber" });
    if (state.controls.transformerFan1 === 0 && state.unit.mw > 10) a.push({ text: "XMFR 1 TEMPERATURE HIGH", color: "amber" });
    if (state.controls.transformerFan2 === 0 && state.unit2.mw > 10) a.push({ text: "XMFR 2 TEMPERATURE HIGH", color: "amber" });
    if (u.autoExcitation) a.push({ text: "AVR ENABLED", color: "blue" });
    if (totalMw < state.gridDemand - 5)
      a.push({ text: "UNDER DEMAND", color: "amber" });
    if (totalMw > state.gridDemand + 5)
      a.push({ text: "OVER DEMAND", color: "amber" });
    if (Math.abs(state.tailwater - state.tailwaterDemand) < 0.5)
      a.push({ text: "TAILWATER ON DEMAND", color: "green" });
    return a;
  }, [state, totalMw]);
  const command = {
    setHydraulicPump: (hydraulicPump: PlantState["hydraulicPump"]) => {
      patch({ hydraulicPump });
      log(
        `Hydraulic pump ${hydraulicPump === "off" ? "stopped" : hydraulicPump + " selected"}`,
      );
    },
    toggle: (key: keyof PlantState) =>
      setState((s) => ({ ...s, [key]: !s[key] })),
    setHydraulicTempControl: (
      i: 0 | 1,
      key: "preheater" | "fan",
      value: boolean,
    ) =>
      setState((s) => {
        const arr = [
          ...(key === "preheater" ? s.hydraulicPreheaters : s.hydraulicFans),
        ] as [boolean, boolean];
        arr[i] = value;
        return key === "preheater"
          ? { ...s, hydraulicPreheaters: arr }
          : { ...s, hydraulicFans: arr };
      }),
    setCoolantPump: (i: 0 | 1, v: boolean) =>
      setState((s) => {
        const pumps = [...s.coolantPumps] as [boolean, boolean];
        pumps[i] = v;
        return { ...s, coolantPumps: pumps };
      }),
    setCoolantFilter: (v: "A" | "B") => patch({ coolantFilter: v }),
    setOilFilter: (v: "A" | "B") => patch({ oilFilter: v }),
    callMaintenance: () => {
      setState((s) => {
        const oil = [0.6, 0.6] as [number, number];
        const cool = [0.6, 0.6] as [number, number];
        return {
          ...s,
          maintenanceCalled: true,
          oilFilterDiff: oil,
          coolantFilterDiff: cool,
        };
      });
      log("Maintenance called — filters replaced");
    },
    setEdg: (edg: PlantState["edg"]) => patch({ edg }),
    setUnit: (value: Partial<UnitState>) => patchUnit(value),
    setUnit2: (value: Partial<UnitState>) => patchUnit2(value),
    setMiv: (target: number) => {
      const u = latest.current.unit;
      if (target > 0 && (u.mivBypass < 99 || latest.current.hydraulicPressure < 150)) {
        log("MIV open blocked — 150 bar and fully open bypass required", "warn");
        return;
      }
      patchUnit({ mivCommand: target });
      log(`MIV commanded ${target}%`);
    },
    setMiv2: (target: number) => {
      const u = latest.current.unit2;
      if (target > 0 && (u.mivBypass < 99 || latest.current.hydraulicPressure < 150)) {
        log("Unit 2 MIV open blocked — 150 bar and fully open bypass required", "warn");
        return;
      }
      patchUnit2({ mivCommand: target });
      log(`Unit 2 MIV commanded ${target}%`);
    },
    setC3: (closed: boolean) => {
      const u = latest.current.unit;
      if (
        closed &&
        (Math.abs(u.rpm - 250) > 3 || Math.abs(u.voltage - 13.8) > 1)
      ) {
        log("C3 close blocked — generator not synchronized", "alarm");
        return;
      }
      patchUnit({ c3: closed });
      log(`Breaker C3 ${closed ? "closed" : "opened"}`, closed ? "ok" : "warn");
    },
    setC32: (closed: boolean) => {
      const u = latest.current.unit2;
      if (closed && (Math.abs(u.rpm - 250) > 3 || Math.abs(u.voltage - 13.8) > 1)) {
        log("Unit 2 C3 close blocked — generator not synchronized", "alarm");
        return;
      }
      patchUnit2({ c3: closed });
      log(`Unit 2 breaker C3 ${closed ? "closed" : "opened"}`, closed ? "ok" : "warn");
    },
    adjustWicket: (percent: number) => {
      const s = latest.current;
      const hydraulicDrive = s.unit.wicketHydraulic && s.hydraulicPressure >= 150;
      const electricDrive = !s.unit.wicketHydraulic && s.offsitePower && s.controls.unit1WicketBreaker;
      if (!hydraulicDrive && !electricDrive) {
        log("Unit 1 wicket command blocked — select hydraulic drive at 150 bar or close the electric wicket breaker", "warn");
        return;
      }
      patchUnit({ wicket: clamp(s.unit.wicket + percent, 0, 100) });
      log(`Unit 1 wicket demand ${percent > 0 ? "+" : ""}${percent}%`);
    },
    adjustWicket2: (percent: number) => {
      const s = latest.current;
      if (!s.unit2.wicketHydraulic || s.hydraulicPressure < 150) {
        log("Unit 2 wicket command blocked — hydraulic wicket drive and 150 bar are required", "warn");
        return;
      }
      patchUnit2({ wicket: clamp(s.unit2.wicket + percent, 0, 100) });
      log(`Unit 2 wicket demand ${percent > 0 ? "+" : ""}${percent}%`);
    },
    trip: () => {
      patchUnit({ tripped: true, c3: false, autoRunup: false });
      log("UNIT 1 MANUAL TRIP", "alarm");
    },
    resetTrip: () => {
      if (latest.current.unit.rpm > 5) {
        log("Trip reset blocked — shaft turning", "warn");
        return;
      }
      patchUnit({ tripped: false });
      log("Unit 1 trip reset");
    },
    trip2: () => {
      patchUnit2({ tripped: true, c3: false, autoRunup: false });
      log("UNIT 2 MANUAL TRIP", "alarm");
    },
    resetTrip2: () => {
      if (latest.current.unit2.rpm > 5) {
        log("Unit 2 trip reset blocked — shaft turning", "warn");
        return;
      }
      patchUnit2({ tripped: false });
      log("Unit 2 trip reset");
    },
    setSpillway: (i: number, v: number) =>
      setState((s) => {
        const gates = [...s.spillways] as PlantState["spillways"];
        gates[i] = i < 3 && s.spillwayMaster[i] && !s.spillwayBrakes[i] && !s.spillwaySetpointPriority ? v : 0;
        return { ...s, spillways: gates };
      }),
    setSpillMaster: (i: number, v: boolean) =>
      setState((s) => {
        const masters = [...s.spillwayMaster] as PlantState["spillwayMaster"];
        masters[i] = i < 3 && v;
        return { ...s, spillwayMaster: masters };
      }),
    setSpillBrake: (i: number, applied: boolean) =>
      setState((s) => {
        const brakes = [...s.spillwayBrakes] as PlantState["spillwayBrakes"];
        brakes[i] = i < 3 ? applied : true;
        return { ...s, spillwayBrakes: brakes };
      }),
    setTailwaterDemand: (tailwaterDemand: number) =>
      patch({ tailwaterDemand: clamp(tailwaterDemand, 4, 10) }),
    setControl: (value: Partial<PlantState["controls"]>) => patchControls(value),
    resetHydraulicPump: (pump: "A" | "B") => {
      const temperature = latest.current.hydraulicTemps[pump === "A" ? 0 : 1];
      if (temperature < 37 || temperature > 45) {
        log(`${pump} pump reset blocked — temperature outside 37–45°C`, "warn");
        return;
      }
      patchControls(pump === "A" ? { pumpATripped: false } : { pumpBTripped: false });
      log(`Pump ${pump} trip reset`);
    },
    toggleLoadSplitting: () => patch({ loadSplitting: !latest.current.loadSplitting }),
    setDemand: (gridDemand: number) => patch({ gridDemand }),
    acknowledge: () => patch({ acknowledged: true }),
    reset: () => {
      setState({
        ...initial,
        logs: [
          {
            id: Date.now(),
            time: stamp(),
            text: "Simulator reset to cold plant",
            level: "warn",
          },
        ],
      });
      localStorage.removeItem("hes-simulator-v3");
    },
    warmStart: () => {
      const u = {
        ...coldUnit(),
        brake: false,
        nitrogen: true,
        mivBypass: 100,
        mivCommand: 100,
        miv: 100,
        wicket: 62,
        wicketHydraulic: true,
        autoRunup: true,
        speedTarget: 248 as const,
        rpm: 250,
        excitationMaster: true,
        autoExcitation: false,
        excitation: 82,
        voltage: 13.8,
        c3: true,
        synced: true,
        turbineFill: 98,
        mw: 8,
      };
      setState((s) => ({
        ...s,
        hydraulicPump: "B",
        hydraulicPressure: 182,
        hydraulicTemps: [41, 41],
        hydraulicRpm: [0, 100],
        oilCooling: true,
        oilPressure: 4.2,
        oilTemp: 42,
        coolantValve: true,
        coolantPumps: [true, true],
        generatorCooling: true,
        generatorTemp: 38,
        islandFeed: true,
        edg: "active",
        controls: { ...s.controls, nitrogenIsolator: true, nitrogenCharge1: 100, nitrogenCharge2: 100, unit1WicketBreaker: true, t2IntakeGate: true },
        startupTransformer: false,
        busA1: true,
        busB: true,
        busC: true,
        unit: u,
        unit2: { ...u, id: 2, wicket: 0, c3: false, synced: false, mw: 0, rpm: 0, autoRunup: false, speedTarget: 0 },
        logs: [
          {
            id: Date.now(),
            time: stamp(),
            text: "Warm Unit 1 operating scenario loaded",
            level: "ok",
          },
        ],
      }));
    },
  };
  return { state, totalMw, alarms, command, log };
}
export const rank = (p: number) =>
  p >= 300000
    ? "Manager"
    : p >= 150000
      ? "CCRO"
      : p >= 75000
        ? "Senior Supervisor"
        : p >= 25000
          ? "Supervisor"
          : p >= 10000
            ? "Senior Operator"
            : p >= 5000
              ? "Operator"
              : p >= 2000
                ? "Junior Operator"
                : p >= 500
                  ? "Trainee"
                  : "Visitor";
