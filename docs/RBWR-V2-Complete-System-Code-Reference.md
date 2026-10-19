# RBWR V2 — complete system code reference

## What this document is

This is the main English technical reference for the supplied RBWR V2 Roblox
Studio extraction. It explains the program architecture, Unit 2 plant physics,
control/value paths, displays, electrical logic, protection, alarms,
communications, facility systems, and the distinction between authoritative
logic and duplicated/decorative Workspace scripts.

Use this together with the equation-focused Unit 2 document:
[Unit 2 physics engine](RBWR-V2-Unit2-Physics-Engine.md).

The separate Unit 1 document remains available for comparison:
[Unit 1 physics engine](RBWR-V2-Unit1-Physics-Engine.md).

## 1. Extraction-wide map

The supplied script extraction contains 4,488 script files.

| Root | Files | Meaning |
| --- | ---: | --- |
| Workspace | 3,459 | plant panels, models, local controls, indicators, doors, props, sounds and facility objects |
| ServerStorage | 440 | server-side modules/assets, including administrative/support code |
| ServerScriptService | 204 | authoritative simulation, protection, alarms, switches, phones, fire and services |
| ReplicatedStorage | 151 | shared remotes, shared modules and client/server contracts |
| StarterGui | 130 | UI behaviour |
| StarterPlayer | 92 | player/client behaviour |
| other roots | 12 | Teams, Packages, ReplicatedFirst and StarterPack |

This is not a 4,488-equation simulator. A large portion are repeated scripts
attached to individual models, visual animations, click sounds, doors, lifts,
furniture, props and duplicated panel lamps. The authoritative technical
behaviour is concentrated in a relatively small set of server scripts plus
the switch and panel binding scripts.

## 2. Authority hierarchy

1. ServerScriptService.GlownaPetlaUnit2.lua is Unit 2 process authority.
2. Workspace.Reaktor2 is Unit 2 authoritative state.
3. Workspace.ControlRoom2 panel attributes are Unit 2 operator input.
4. ReactorProtectionSystem.Reactor2 makes independent RPS decisions from the
   process state.
5. AnnunciatorSystem.U2Annunciator derives alarms from state; alarms do not
   normally drive the process.
6. Display scripts render state and control attributes; they should not be
   used as the source of plant truth.
7. SwitchSystem validates and replicates actual operator switch interactions.

This distinction is essential for the web port: a visible switch position is
not the same thing as an energized source, an actual pump, a successful valve
lineup, or a calculated display value.

## 3. Unit 2 state contract

| State branch | Role |
| --- | --- |
| Reaktor2.Parametry | core configuration, fuel, total neutron state, rod position, mode, procedures, setpoints and automatic flags |
| Reaktor2.Parametry.Power | APRM, prior APRM, APRM period, local/low-range detector values |
| Reaktor2.Cyrkulacja | RPV water/steam conditions, recirc commands, actual recirc flow, base and indicated level |
| Reaktor2.Chlodzenie | feed, hotwell, condenser and condensate transfer state |
| Reaktor2.Deaerator | DA steam mass proxy, pressure, local pressure, temperature and outlet |
| Reaktor2.Bilans | process mass/steam balance outputs used by gauges and downstream logic |
| Reaktor2.Turbina | main/bypass steam demand, turbine speed, acceleration, generation, vibration, sealing and preheat |
| Reaktor2.Elektryczny | buses, source availability, common-bus interlock, battery, loads and grid export |
| Reaktor2.RodDrive | hydraulic pressure, rod drive flow, requested pump operation and SCRAM capability |
| Reaktor2.Awaryjne | isolation/relief/RCIC-like emergency flows |
| Reaktor2.ADS | ADS armed, active command and out-of-service state |
| Reaktor2.Polishers | polisher condition/conductivity state |

## 4. Simulation timing and update order

The operational control loop uses a 0.05-second wait: 20 Hz nominal. The
neutron core does ten internal diffusion/absorption passes per process step.

The useful conceptual order is:

    read switches, selector states and electrical source state
    -> calculate bus power and available equipment
    -> update core neutronics/instruments
    -> update DA/feedwater/RHR/thermal state
    -> update pressure, steam extraction and inventory
    -> update condenser/hotwell/condensate and electrical loads
    -> update turbine auxiliaries, RPM, phase and generation
    -> update automatic controllers and actuator demands
    -> annunciators, RPS, GUI/physical displays

Historical values are deliberately used to filter pressure and saturation
temperature. They are not unused leftovers; removing them makes the plant
respond differently.

## 5. Unit 2 reactor physics formula ledger

### 5.1 Core geometry

- 6 by 6 coordinate map.
- 24 valid fuel/rod channels.
- 10 axial cells per channel.
- 240 active neutron cells.
- Each physics pass uses current, previous, and temporary arrays.

### 5.2 Temperature, density and recirculation

    M_temperature = 1.02 - 0.00006666 x (T_RPV + 270)

    rho = 1000 x baseLevel / (displayedLevel + 18)

    D(rho) = -5.84e-10rho^3 + 1.35422e-7rho^2
             + 0.001358252042rho + 0.090469568418

    V[1] = 24 x N_old[1] / N_max
    V[k] = 0.9 x V[k-1] + 24 x N_old[k] / N_max

Actual recirc effect is command x health / 100 x applicable source
effectiveness. It becomes zero without the supply bus.

    reported recirc flow = actual recirc effect x 1000

For types 1 through 3:

    M_flow1 = (1 - D) x 1.3 x E1 + D
    M_flow2 = (1 - D) x 1.3 x E2 + D

| Type | Axial modifier |
| --- | --- |
| 1 | M_flow x (1 - 0.8 x V) |
| 2 | M_flow x (1 - 0.4 x V) |
| 3 | M_flow |
| 4 | (2 - D) x (1 + 0.01 x V) |

### 5.3 Diffusion, rods, fuel and xenon

    leakage = 0.97 x N_old[cell]

| Neighbour | Fraction to each valid neighbour |
| --- | ---: |
| same level cardinal | 1/12 |
| same level diagonal | 1/24 |
| adjacent level same coordinate | 1/8 |
| adjacent level cardinal | 1/24 |
| adjacent level diagonal | 1/48 |

Reflector effectiveness is 0.8. Boundary recovery is either
(2/6 + 2/12) x leakage x 0.8 or (2/6 + 1/12) x leakage x 0.8. Top/bottom
axial cells get an extra 0.25 x leakage x 0.8.

Rods are 0 fully inserted to 100 fully withdrawn. Normal axial absorption
constants are 0.235 and 0.170. Type 4 uses 0.265, 0.230 and a 0.190 displacer.

Type-1 generation:

    N_next[k,x,y] =
      ((6-x)xM_temperaturexM_flow1 + (x-1)xM_temperaturexM_flow2) / 5
      x fuel[k,x,y] x 0.03
      x (1 - xenon[x,y]/4.5)
      x (N_idle/24 + N_tmp[k,x,y])

Type 2 changes the divisor to 6. Types 3 and 4 use 4.5. Type 4 reverses
fuel axial indexing.

### 5.4 Power and period

    P_thermal = (N_total / N_max) x 2.25 / 1.10

    realPeriod = 1 / ln(N_total,next / N_total,previous)
    APRMPeriod = 1 / ln(APRM / oldAPRM)

The real neutron period is stored as CzasReaktora. The Unit 2 controls and RPS
instrument path use Power.Period, the APRM-derived period.

LPRM values are fixed four-cell averages at upper axial level 8 and lower
axial level 3, normalized against N_max and scaled by 100 x 24 x 10.
SRM comes from the selected SRM depth of the same axial field.

## 6. Thermal hydraulics and conservation

### 6.1 RPV level

    rho_water(T) = -0.000004467711T^3 - 0.000560288485T^2
                   - 0.429148844451T + 1010.035413387815

    displayedLevel = baseLevel / (rho_water/1000) - 18

Base level is the conservation value. Displayed level is used for screens,
alarms and level logic. Temperature changes displayed level through density.

### 6.2 Deaerator and preheaters

    F_DA,in = (DA_inlet/100)
              x max(0, 2000 x P_RPV / 10,000,000 / 100)
              x 1.5 x sqrt(abs(previousTotalSteam/1000))

    DA_pressure = DA_steam_inventory x 500
    DA_localPressure = DA_pressure x (1 + (DA_level + 6)/5)
    DA_outflow = max(0, DA_outlet^2 x (DA_localPressure - 1,000,000)/20,000)

    DA_steam_inventory += F_DA,in - DA_outflow

Isolation zeros DA inlet steam. A ruptured disk forces DA outlet to 1.0. The
source also corrects low DA local pressure toward 1 MPa.

    T_feed = T_DA + (T_RPV - T_DA) x 0.75 x preheaterEffect
             x clamp(totalSteam/50, 0, 1)

Three preheaters contribute individual health. Isolation forces feedwater to
30 C.

### 6.3 Temperature, saturation and pressure

    residualHeat = max(0, 0.03 x iodine - P_thermal)
    R = (T_RPV - T_feed)/300

    deltaT = P_thermal
             - (R/3) x (feedEffect + LPCI_term)
             - 0.090 x RHR_effect
             + residualHeat

    T_RPV,next = max(30, T_RPV + 6 x deltaT)

In isolation, emergency feed substitutes normal feed and the RHR coefficient
is 0.060.

    T_sat(pMPa) = -0.0040964052p^6 + 0.1417383107p^5 - 1.9430568125p^4
                  +13.5042849307p^3 -51.2737887815p^2 +118.6853712464p
                  +100.1541546689

Pressure and saturation temperature are filtered by historic samples. The
temperature excess above saturation is smoothed and included in pressure drive:

    T_rel = (T_RPV - 100) x (1 - P_RPV/10,000,000)
    deltaP = 25,000 x (T_rel + 30 x smoothedExcess) / 12.6
    P_RPV,next = max(0, P_RPV + deltaP)

    baseLevel -= (20 x deltaP/20,000) / 2,000 / 5

Pre-calculation pressure cap is 12 MPa; final pressure cap is 11 MPa.

### 6.4 Steam and water transfers

    F_bypass  = (bypassDemand/3) x 2000 x P/10,000,000 / 100
    F_turbine = turbineDemand x 2000 x P/10,000,000 / 100
    F_casing  = turbinePreHeatSteamFlow
    F_total = F_bypass + F_turbine + F_preheater + F_DA,in + F_casing

    pressureLoss = 20,000 x F_total / 20

    F_feed = feedPumpEffect x 2000, only when DA level > -8

    baseLevel += F_feed/2000/5 x (100 - postDA_leakPercent)/100
    baseLevel += F_preheater/2000/5 + 0.99 x F_DA,in/2000/5

Unit 2 separately records steam condensed and steam lost by condenser
limitations. Hotwell, DA and RPV each have drain/cap handling.

## 7. Turbine, generator and auxiliaries

Main inlet is forced to zero by the turbine enable switch. Main movement is
plus/minus 0.25 per tick. Fine movement is plus/minus 0.00625 or 0.025.
Bypass moves plus/minus 0.25 per tick.

Turning gear requires Bus S and drives:

    RPM_next = RPM + (60 - RPM)/150

with a 50 RPM cap.

    eta_seal = 0.59985497997080239 + 3.5234632998448627s
               -10.132281250358904s^2 + 7.7706116447531288s^3

    eta_seal = 0.741 when s > 0.629
    eta_seal /= 0.9688690337

    eta_pressure = 0.0000000610 x P_RPV + 0.5670731695

    RPM_target = eta_seal x 3600 x F_turbine/225 x eta_pressure
                 - 3600x1200/5.65/225/225 x 1.15 x electricalLoad
    RPM_next = max(0, RPM + (RPM_target - RPM)/1000)

Synchronized:

    RPM = 3600
    generation = (F_turbine/225 x eta_pressure x eta_seal - 1) x 1200/5.65

The speed automatic uses 0, 900, 1800, 2700 and 3600 RPM buttons. All
nonzero targets request 7.1 MPa. Near nominal speed it asks for 3598 or 3602,
depending on phase, to converge rather than artificially snapping phase.

## 8. Electrical system

Every major process actuator is power-gated. The loop initially de-energizes
Bus A, Bus B, DC Bus, Safety Bus and common-bus flags, then rebuilds state
from source/breaker/lineup conditions.

Core relationships:

- Offsite plus startup-transformer breaker can energize Bus A.
- A non-tripped turbine plus valid local breakers can energize Bus A and B in
  islanded operation.
- Unit 1/Unit 2 common-bus switches and demand common-bus state can allow
  Unit 2 to power Unit 1 or be powered by Unit 1.
- Bus A and safety-bus breaker selection can energize Safety Bus.
- Safety Bus plus DC bus breaker can energize DC Bus.
- Emergency bus plus battery connector can also energize DC Bus.
- Dead AC buses zero the actual affected pump output.

Battery starts randomly at 60 to 100. Each update it drains by 0.01/3 when
safety/emergency conditions are unavailable, drains by 0.05/3 in another
emergency condition, and charges by 0.035/3 when Safety Bus is available.
It clamps 0 to 100.

Plant loads are assembled from actual equipment effectiveness. Examples in the
source include recirc pump loads, feed-pump loads, RHR load, condenser pumps,
cooling tower pump, condensate inlet and CST drain loads. The model stores
total, Bus A and Bus B own-use load, then grid export is generation minus
plant load, with a common-bus adjustment when Unit 2 supplies Unit 1.

## 9. RHR, isolation, relief and emergency systems

RHR left/right require their own control, a live safety bus and valid
isolation/crossfeed valve lineup. At RPV pressure below 3 MPa they add to
recirc flow. In RHR/LPCI mode with low enough RPV level, each side adds a
250-unit LPCI factor.

During isolation, normal turbine/bypass/DA/preheater paths are closed and the
emergency turbine/relief/HPCC path applies. Emergency turbine target uses:

    emergencyRPMtarget = 5000 x abs(emergencySteamFlow)^1.2 / 300 x 3/2/10x3x2
    emergencyRPMnext = emergencyRPM + (target - emergencyRPM)/75
    HPCCFeed = emergencyRPMnext/23

Unit 2 selects specific condensate/makeup tank state for actual HPCC flow.
ADS has separate Armed, ActiveCommand and OutOfService values. Six visible
main steam relief controls reduce RPV pressure multiplicatively by 0.995 for
each selected valve during the update; annunciators group them as 1-2, 3-4,
5-6, and ADS 7-8.

## 10. Protection system

ReactorProtectionSystem.Reactor2 has two independent channels. A full trip
requires both channels; half trips can occur at intermediate thresholds.
Auto-trip bypass and rods fully inserted are handled outside individual
condition veto expressions.

| Condition | Full trip | Half trip | Veto/qualification |
| --- | --- | --- | --- |
| low RPV level | level below -4 | below -3.7 | none |
| APRM upscale | APRM above 125 | above 122.5 | none |
| APRM downscale | APRM below 5 | none | startup/mode conditions |
| low reactor period | APRM period below 20 twice, positive | below 22 with old below 24 | rods below 10 or max rod above 50 |
| high pressure | 10 MPa | 9.5 MPa | none |
| offsite loss | offsite false | none | APRM below 50 |
| local low period | any local period below 15 | none | same rod/max-rod veto |
| shutdown mode | startup selector -2 | none | rods already at zero |

SCRAM state causes the physics loop to insert all valid rods by 0.25 per
tick and disables automatic rod/recirc control.

## 11. Annunciator system

U2Annunciator is a state-derived layer. It starts with an automatic acknowledge
window during the global start sequence, then continuously maps actual values
to alarms.

Important thresholds include:

| Alarm group | Condition |
| --- | --- |
| Bus A/B/S/DC unpowered | actual bus boolean false |
| main battery active | battery connector selected |
| turbine reverse power | generation minus own-use load below zero while synchronized |
| high main steam pressure | above 8 MPa |
| high main steam temperature | above 295 C |
| high generator load | above 1500 |
| high turbine RPM | above 3700 |
| high turbine vibration | above 6 |
| condenser vacuum lost | condenser pressure above 7000 |
| low recirc flow | average pump below 10 while APRM above 20 |
| no recirc flow | average pump below 1 while APRM above 20 |
| recirc cavitation | pump above 30 with APRM below 20, or above 90 with APRM below 40 |
| recirc imbalance | flow difference greater than 10 |
| high thermal power | APRM above 108 |
| high RPV level | at least 2.5 |
| low RPV level | below -2 |
| high rod power warning | max rod above 95 |
| low reactor period warning | positive APRM period below 30 |
| rod imbalance | max rod / average rod above 1.01 |
| drive pressure low | rod-drive pressure difference below 0.1 |

The script also maps turbine trip, bypass-open, RHR/shutdown cooling, LPCI,
RPS channel/half trip, ADS state, polisher bypass, hotwell/DA drains and
preheater disabled state. Those are alarm facts, not substitute process
equations.

## 12. Operator controls and value paths

| Area | Controls and values |
| --- | --- |
| ControlRoom2 PanelReaktora Konsola1 | rod selected-group state, rod lever/speed, reactor auto mode, recirc pump/inlet/outlet and demand knobs |
| Konsola2 | turbine enable, coarse/fine main inlet, bypass, six relief valves, sync breaker and speed automatic buttons |
| Konsola3 | feed pumps/inlet/outlet, condenser valve, preheater switches, CST, electrical breaker interfaces |
| LewySrodek | RHR left/right, RHR mode, line valves, crossfeed, isolation, emergency makeup tank selection |
| Turbine ControlRoom MainPanel | turning gear and turbine auxiliary control |
| Turbine CMCR/Polisher | polisher selection/bypass and regeneration support |
| EDG Bay | EDG availability, cooling and power-support hardware |
| ControlRoom2 Indicators | annunciator acknowledgement/silence presentation |

## 13. Shared switch implementation

SwitchSystem.Controller enforces server-authoritative interaction:

1. Validate target is a switch model and input side is L or R.
2. Validate player distance against ClickDetector range.
3. Deny players with SwitchLocked.
4. Deny a switch marked repair-required unless forced by a script.
5. Ask the switch module whether it is clickable.
6. Apply position 0 or 1 and run activated/deactivated callback.
7. Replicate state to all clients.
8. Write a formatted operator/autocontrol log entry.

Repair state is separately replicated. A red-tag repair state cannot be
overridden by a player. A port should keep this server-side authority model.

## 14. Secondary systems in code

### 14.1 Polisher sampling

ProbePolisher listens for replicated FillCIX, EmptyBeaker and RemoveBeaker
events. A sample takes the selected Unit 2 polisher condition as conductivity,
labels the sample P1 or P2, assigns randomized radioactivity 50 to 150, and
equips it to the player. Emptying destroys the sample and gives an empty beaker.

### 14.2 Fire safety

FireSafetySystem is separated into sensor, logic and actuator layers:

- Sensor layer: turbine health, plant signals and manual call points.
- Logic layer: trip handling, failure mode selection, halon countdown and
  avoidance-measure handling.
- Actuator layer: master-panel phone, hazard effects, emitters, buttons and
  alarm control.

This is a hazard/event framework. It observes process/facility signals rather
than replacing reactor physics.

### 14.3 Phone and PMS

PhoneManager contains phone types, direct/standing/cell/virtual phones,
groups, public address, maintenance, HR, grid control, ringtones and call
handling. PhoneCallLogs stores logs. PMS has global message handling,
existing-unit mapping and a UI handler. These are communication systems,
not plant process authority.

### 14.4 Operational platform code

Hydroxide, GIG_Server, ranks, profile service, points, player settings,
radioactivity, doors, zones, time scripts and dialogue are gameplay/platform
systems. They control access, roles, player movement, moderation, logging,
rewards, scenarios and UI. They are intentionally kept separate from the
physical Unit 2 calculation loop.

## 15. Workspace script inventory interpretation

The largest meaningful Workspace clusters are:

| Cluster | Script count | Interpretation |
| --- | ---: | --- |
| ControlRoom2 PanelReaktora | 527 | Unit 2 physical panel controls, displays, indicator animation and local panel scripts |
| ControlRoom1 Unit01Main | 495 | Unit 1 controls/displays |
| Turbine ControlRoom | 129 | shared/Unit 2 turbine, lube, hydraulic and auxiliary panels |
| Turbine CMCR | 93 | condenser/polisher control room systems |
| ControlRoom2 SubPanels | 80 | supplemental panel indicators and panel controls |
| Simulator REACTOR/MCC/TURBINE | 155 | simulator-mode panel equivalents |
| EDGBay EDG1/EDG2/Panel | 79 | generator bay and emergency electrical assets |

The remaining Workspace scripts cover facility animation, elevators, doors,
vending/props, radios, clocks, status televisions, player interactions and
duplicated per-model scripts. They should be inventoried for a full game
recreation, but they do not add hidden equations to the Unit 2 process model.

## 16. Required web-port boundary

To import RBWR V2 faithfully:

1. Port Unit 2 state first, with a fixed 0.05-second server-authoritative
   simulation step.
2. Port the 240-cell core before APRM/LPRM/SRM UI.
3. Preserve both real neutron period and APRM period.
4. Preserve base-level versus displayed-level separation.
5. Port RHR, safety-bus, DC, battery and breaker lineups as actual permissives.
6. Port turbine sealing, preheat and turning gear into the steam/RPM balance.
7. Port RPS and annunciation as separate state consumers.
8. Bind React controls as inputs to those process values; never make panel
   components maintain their own competing physics.

## 17. Source locations

| Source | Scope |
| --- | --- |
| ServerScriptService/GlownaPetlaUnit2.lua | Unit 2 physics, electrical, turbine, automation and many system values |
| ServerScriptService/ReactorProtectionSystem/Reactor2 | two-channel RPS and trip thresholds |
| ServerScriptService/AnnunciatorSystem/U2Annunciator.lua | Unit 2 alarms/thresholds |
| ServerScriptService/SwitchSystem | switch validation, callbacks, repair states, replication and logs |
| ServerScriptService/FireSafetySystem | hazard/fire/halon framework |
| ServerScriptService/PhoneManager and PMS | phone/PMS communications |
| ServerScriptService/ProbePolisher.lua | polisher sample interaction |
| Workspace/ControlRoom2 | physical Unit 2 control and display binding scripts |

This main reference is deliberately written in English terms. The Polish source
names remain useful mappings: Reaktor = reactor, Cyrkulacja = circulation,
Chlodzenie = cooling, Cisnienie = pressure, Poziom = level, Przeplyw = flow,
Nastawa = setpoint/demand, Pret = rod, and Skraplacz = condenser.

## 18. Reading a value path

The safest way to understand or change RBWR is to trace every value through
five distinct stages. A number on a gauge is normally the **last** stage, not
the plant calculation itself.

    physical condition
    -> process state value
    -> availability/permissive and health correction
    -> instrument or protection calculation
    -> physical gauge, SurfaceGui, annunciator, log, or remote event

For example, a recirculation knob does not write a flow gauge directly. It
sets a requested demand. The process loop checks source bus, pump health and
the applicable pump branch, calculates actual recirculation effect, converts
that effect into reported flow, feeds it into the neutron calculation, then
the gauges, APRM, alarm system and load calculator consume the resulting
values.

### 18.1 Value naming used in this manual

The original source uses many short names and a mixture of Polish labels. The
following labels are used below to show what a value actually represents.

| Manual label | Typical source form | What it is | What it is not |
| --- | --- | --- | --- |
| command or demand | Nastawa, selector position, knob value | requested operator output | proof that a device moved |
| actual effect | effect, flow, actual power | process result after power, health and interlocks | the panel position |
| conserved inventory | base level, steam inventory, fuel/xenon arrays | value carried between calculations | the displayed level or gauge value |
| displayed indication | gauge, GUI, analog display | scaled or filtered readback | always an unfiltered physical measurement |
| protection input | RPS condition or annunciator condition | value compared with a threshold | a command to change the plant |
| permissive | bus, valve lineup, mode, availability boolean | condition required before a command has effect | a visible indicator alone |

When documenting a modification, name all five if possible. A statement such
as “increase feedwater flow” is incomplete unless it states whether it changes
the feedwater command, actual pump effect, RPV inventory, the displayed
feedwater gauge, or a controller setpoint.

### 18.2 Translation convention for equations

The source formulas in sections 5 through 9 are kept for traceability. The
tables below also express them as named relationships so an operator or port
author can see their purpose without reverse-engineering a line of Lua.

| Raw-style expression | Operational reading |
| --- | --- |
| `command x health x sourceEffect` | a device only produces output when it is commanded, healthy and supplied |
| `current + (target - current)/timeConstant` | a physical value approaches its target gradually rather than teleporting |
| `inventory += inflow - outflow` | level rises when inflow exceeds outflow and falls when the reverse is true |
| `displayed = conserved / density correction - datum` | heating can move an indicated level without adding or removing water |
| `condition and not veto` | a protection acts only when its initiating condition is true and no allowed inhibit applies |
| `generation - ownUse` | exported electrical power is gross generator production less plant consumption |

## 19. Display and gauge source catalogue

This section identifies where the major Unit 2 indications originate. It is
intended for anyone changing a display, adding a remote station, or checking
whether a disagreement is a real process problem or an instrument-path issue.

### 19.1 Reactor and neutron instruments

| Indication | Authoritative source | Calculation path | Important behaviour |
| --- | --- | --- | --- |
| APRM | `Reaktor2.Parametry.Power.APRM` | total neutron population normalized against `N_max`, then thermal scale | APRM is an instrumented normalized power value, not rod position and not turbine MW |
| previous APRM | `Power.oldAPRM` | retained prior APRM sample | used to derive APRM period and some protection logic |
| APRM period | `Power.Period` | `1 / ln(APRM / oldAPRM)` | separate from real neutron period; use this for RPS/APRM controls |
| real reactor period | `Parametry.CzasReaktora` | ratio of successive total neutron populations | reflects the core iteration rather than the display-scale APRM change |
| SRM | selected source-range depth slice | selected axial neutron field value | range/depth selection changes what is displayed, not core reactivity |
| LPRM upper/lower | fixed channel/axial cell groups | four-cell average, `N_max` normalized, scaled | local signal; it can disagree with APRM during spatial imbalance |
| rod position | individual rod state in `Parametry` | actual drive movement after hydraulic limit and blocks | 0 is inserted and 100 is withdrawn in source code |
| fuel/rod temperature | cell fuel state | neutron heat, cooling, fuel condition and axial location | do not derive this directly from aggregate APRM |

The practical rule is: use APRM for plant power, LPRM/SRM for local or startup
information, and the actual rod value for motion/withdrawal logic. Do not
substitute one for another in a port.

### 19.2 RPV and steam instruments

| Indication | Source value | Meaning and processing |
| --- | --- | --- |
| RPV pressure | `Reaktor2.Cyrkulacja.CisnienieReaktora` | primary vessel pressure after temperature/saturation drive, steam loss, relief handling and limits; source units are Pa even where an operator display labels MPa/kPa |
| RPV temperature | circulation thermal state | bulk vessel temperature after feed/RHR/LPCI cooling and saturation constraint |
| base level | circulation stored inventory | conserved water inventory used by mass balance; normally not the gauge value |
| RPV level gauge | density-corrected level | base level divided by calculated water density, then referenced to the -18 datum |
| main steam flow | `Bilans` total/turbine steam branch | pressure-dependent actual turbine extraction plus related steam branches |
| bypass flow | `Bilans` bypass branch | pressure-dependent bypass extraction; it reduces vessel inventory/pressure and is not merely a visual valve position |
| main steam temperature | derived steam/vessel temperature path | high-temperature alarm compares the indicated value against 295 C |
| SRV/ADS state | individual relief command and ADS state | visible valve state plus actual pressure-reduction effect; group lamps do not replace individual valve truth |

### 19.3 MCC, condenser and deaerator instruments

| Indication | Source | Interpretation |
| --- | --- | --- |
| total steam flow | `Reaktor2.Bilans` | reactor-to-condenser side of the mass balance |
| hotwell level | cooling/hotwell inventory | rises with effective condensation and falls with condensate outflow |
| hotwell outflow | actual condensate-pump/valve effect | transfer from hotwell toward the DA, not an independent source of water |
| DA level | `Reaktor2.Deaerator` inventory | changes with hotwell inflow versus DA/feedwater outflow |
| DA pressure | DA steam inventory times pressure scale | local DA pressure further depends on DA level |
| DA temperature | DA heating and steam/preheater contribution | normal operating target is about 108 C; it is a consequence of steam/flow balance, not simply a thermostat |
| feedwater flow | actual feed-pump effect | transfer from DA toward RPV, only valid while DA inventory/lineup permits it |
| condenser pressure/vacuum | condenser process state | in the game source the loss alarm is tied to pressure above 7000; user-facing screens may express the same condition in mbar/vacuum terminology |
| preheater status | three individual preheater health/effect values | modifies feedwater temperature and therefore reactor cooling/pressure response |

### 19.4 Turbine and electrical instruments

| Indication | Source | Notes |
| --- | --- | --- |
| turbine RPM | `Reaktor2.Turbina` shaft speed | approaches a target from admitted steam, sealing and load; it is not calculated from main valve position alone |
| synchronoscope/phase | turbine/grid phase state | phase correction is a separate convergence path from shaft RPM |
| generator load | turbine generation branch | calculated after turbine flow, pressure efficiency, sealing efficiency and electrical demand relationship |
| grid export | electrical total generation minus own use | may differ from generator load because plant loads and common-bus exchange are included |
| Bus A/B/S/DC lamps | `Reaktor2.Elektryczny` actual bus booleans | a closed breaker is not enough; source and lineup must truly energize the bus |
| battery indication | electrical battery charge/source selection | charge is initialized randomly in the source and changes with safety/emergency availability |
| pump ammeter/load | actual equipment effect/load | no live source or tripped/bad equipment means zero process effect even if the operator command remains selected |

## 20. System by system internal operation

### 20.1 Core, fuel, rods and xenon

**Purpose.** The core turns the current neutron field, fuel condition,
moderation/density, recirculation and rod absorption into the next neutron
field. APRM is derived after this calculation; it is not the input that makes
the core critical in the Roblox source.

**Inputs.** Individual rod positions, 240-cell neutron arrays, cell fuel,
xenon values, vessel temperature, density/void modifiers, two actual recirc
effects and valid neighbouring cells.

**Outputs.** Next neutron field, total neutron population, fuel temperature,
cell/local detector values, APRM, APRM period, real period, LPRM and SRM.

**Editable relationships.** Fuel multiplication, rod absorption constants,
the type map, reflector coefficient, leakage coefficient and recirculation
modifiers all change reactivity. Changing the APRM display scale does not.

**Normal operating implication.** A rod move changes the neutron source
distribution first. Instruments and bulk thermal conditions follow the
iteration/history path. This is why a credible port must model delay and
spatial/local response rather than directly assigning APRM from rod position.

### 20.2 Rod drive, startup modes and withdrawal blocks

**Purpose.** CRD turns a selected withdrawal/insertion request into bounded
rod movement and enforces startup procedure limits.

**Inputs.** Selected rod/group, lever direction and speed, mode selector,
rod-drive pressure difference, CRD pump availability, SCRAM availability and
the RWM/startup sequence state.

**Output.** A limited position step for each permitted rod. The source limits
the maximum step by `RodDrive.PressureDifference / 100`; insufficient
hydraulic pressure requests/depends on the drive pump and prevents the normal
movement rate.

**Modes.** SRM and IPR are instrumentation/procedure stages, not direct
reactivity multipliers. They govern which movement is allowed and which
detector/range information is operational. RUN permits normal power
operation after the startup line-up.

**SCRAM.** The source inserts valid rods by 0.25 per 0.05-second process tick.
This is an actual position movement. It should not be replaced by assigning
APRM = 0, because steam pressure, delayed heat and inventory remain active
after a trip.

### 20.3 Recirculation system

**Purpose.** Recirculation modifies moderation/void feedback and thus core
power after the core has a viable neutron population. It is a power-control
system, not an independent APRM injector.

**Inputs.** Pump command, speed/demand, pump health, Bus A or B availability,
actual source effectiveness and the current core field.

**Actual output relationship.**

    actualRecircEffect = requestedDrive x pumpHealth x poweredSourceEffect
    displayedRecircFlow = actualRecircEffect x 1000

**Interlocks and alarms.** A powerless train reads no actual flow. Cavitation
warning applies above 30 demand below 20 APRM, and above 90 demand below 40
APRM. The source compares actual flow difference for imbalance, not the two
knob positions. Low/no-flow alarms are meaningful only above 20 APRM.

### 20.4 RPV, feedwater and inventory

**Purpose.** This system conserves RPV water and steam inventory while
converting thermal conditions into temperature, pressure and indicated level.

**Inputs.** Core thermal power, feedwater temperature/effect, DA/preheater
return, RHR/LPCI/HPCC contribution, isolation state, steam extraction and
relief discharge.

**Internal distinction.** Base level is the stored water amount. Displayed
level is a density-corrected instrument. A warmer vessel can show a higher or
lower indication without an equivalent water transfer. Protection uses the
source's displayed circulation level, so changing its density path changes
trip behaviour.

**Normal behaviour.** Feedwater adds mass; turbine/bypass/relief extraction
removes steam and drives pressure/inventory loss; cooling changes temperature
and density; pressure follows the saturation/history calculation. A stable
level requires effective feed/return to match effective steam loss, not merely
matching panel percentages.

### 20.5 Deaerator and preheaters

**Purpose.** The DA is the intermediate thermal/inventory buffer between
condensate/hotwell and feedwater. Preheaters raise feedwater temperature using
steam, reducing the thermal shock/cooling contribution made by incoming water.

**Inputs.** DA inlet opening, prior steam flow, RPV pressure, DA level, DA
outlet position, isolation, disk state and individual preheater health.

**Outputs.** DA steam inventory, local pressure, DA temperature, DA outflow,
feedwater temperature and RPV feed contribution.

**Failure/maintenance effect.** A ruptured DA disk changes the outlet path;
isolation removes normal inlet steam; an unavailable preheater reduces
feedwater temperature effect. None of these conditions should be simulated by
only changing a panel lamp, since each alters the RPV heat/mass path.

### 20.6 Condenser, hotwell and condensate

**Purpose.** The condenser turns turbine/bypass steam into usable water and
the hotwell/condensate train returns that water to the DA.

**Inputs.** Steam arriving at the condenser, condenser circulation equipment,
air removal equipment, condenser valve demand, condensate pump effect and
electrical availability.

**Outputs.** Condenser pressure, amount condensed versus lost, hotwell
inventory and hotwell outflow. The source deliberately distinguishes steam
that condenses from steam that is lost because the condenser cannot accept it.

**Normal behaviour.** Total steam flow enters the hotwell side. Condensate
outflow moves it toward the DA. If hotwell outflow is too low, hotwell rises;
if it is too high, hotwell falls and the DA may briefly rise before RPV feed
is affected. This is the correct way to explain MCC level changes.

### 20.7 Turbine, sealing, preheat and generator

**Purpose.** The turbine converts actual admitted steam into shaft speed and
generation, subject to sealing efficiency and electrical loading.

**Inputs.** Main inlet demand, bypass demand, vessel pressure, preheat flow,
sealing supply/leak state, turbine auxiliary availability, turning gear,
acceleration/target selection, phase and electrical own-use load.

**Important distinction.** Main valve demand is a request. Actual turbine
flow is pressure dependent. That flow then contributes to RPM; RPM/phase
allow synchronization; synchronized generation is calculated after the
electrical load relationship. A correct model must not calculate MW directly
from valve position.

**Normal conditions.** Turning gear supports low-speed warm-up, preheat raises
casing condition, oil/hydraulic/sealing support must remain valid, then steam
admission raises shaft speed. Unit 2 source nominal synchronous logic is
3600 RPM. Any port operating at another nominal RPM is an intentional
simulation adaptation and should document its conversion.

### 20.8 Electrical distribution, battery and common bus

**Purpose.** Electrical state determines whether process commands can produce
actual work. It also converts turbine generation into plant own-use and grid
export.

**Inputs.** Offsite state, transformer/breaker positions, turbine status/RPM,
islanding eligibility, common-bus configuration, EDG/battery conditions and
individual machine commands.

**Outputs.** Actual Bus A, Bus B, Safety Bus, emergency/DC/common-bus
availability; battery charge; actual machine source effect; load totals;
generation/export and related annunciators.

**Normal rule.** Always derive a bus from a valid upstream source and a valid
closed path. Then derive each machine from that bus. Never use a breaker
boolean alone as the pump's power source. This prevents stale-flow and
“closed but unpowered” errors.

### 20.9 RHR, LPCI, RCIC/HPCC, ADS and relief

**Purpose.** These are pressure/level recovery systems with different source
requirements and operating regions.

| System | Principal entry condition | Main effect | Key limitation |
| --- | --- | --- | --- |
| RHR / shutdown cooling | valid RHR lineup and safety power | removes heat and supports cooldown | requires valves/crossfeed/power selection |
| LPCI | low-pressure region, selected RHR mode and valid source | high-volume level recovery | source logic applies below 3 MPa and requires water/source availability |
| RCIC or HPCC branch | isolation/low level/emergency conditions | steam-driven or emergency feed | output depends on available steam/tank state |
| ADS | armed/commanded emergency logic | opens depressurization path | distinct state from ordinary MSRVs |
| MSRVs | individual operator/automatic commands | rapidly removes steam/pressure | consumes vessel inventory and can worsen level if feed is not restored |

These systems must consume the same RPV pressure/inventory values as the
normal process. Creating a separate “emergency level” variable will make
recovery behaviour incorrect.

### 20.10 RPS and annunciation

**RPS purpose.** Two-channel protection decides whether the reactor must
scram. It uses process/instrument values and vetoes. It does not inspect
whether an alarm lamp has been acknowledged.

**Annunciator purpose.** Annunciators inform the operator of state/threshold
conditions, latch/acknowledge/silence according to their own mechanism, and
may expose a trip channel. They do not normally command the underlying
physics.

**Modification rule.** Add a new alarm by consuming an existing authoritative
value. Add a new trip by defining its full condition, half-trip condition,
veto and reset condition. Do not make a UI lamp its own process source.

## 21. Protection and operating setpoint register

Values below are source values unless specifically marked as an operating
guide. Pressure source values are converted to their readable MPa/kPa form.

| Area | Setting or threshold | Effect |
| --- | ---: | --- |
| RPS low level full trip | below -4.0 m | both trip channels initiate SCRAM logic |
| RPS low level half trip | below -3.7 m | one channel may trip |
| RPS APRM upscale full trip | above 125% | high-power protection |
| RPS APRM upscale half trip | above 122.5% | one-channel precursor |
| RPS APRM downscale | below 5% | only valid outside startup/mode veto conditions |
| RPS low APRM period full trip | below 20 s twice, positive | subject to rod/max-rod veto |
| RPS low APRM period half trip | below 22 s with old period below 24 s | subject to same veto |
| RPS high pressure full trip | 10 MPa / 10000 kPa | vessel overpressure protection |
| RPS high pressure half trip | 9.5 MPa / 9500 kPa | one-channel precursor |
| RPS offsite-loss enable | APRM at least 50% | offsite loss vetoed below this power |
| local low-period trip | local period below 15 s | subject to rod/max-rod veto |
| high steam pressure annunciator | above 8 MPa | operator warning below RPS pressure trip |
| high steam temperature annunciator | above 295 C | steam/thermal warning |
| high generator load annunciator | above 1500 | generator overload indication |
| high turbine RPM annunciator | above 3700 RPM | overspeed warning |
| high turbine vibration annunciator | above 6 | turbine mechanical warning |
| condenser vacuum-loss annunciator | pressure above 7000 | loss of effective vacuum condition |
| low/no recirc flow alarm enable | APRM above 20% | prevents low-power nuisance alarm |
| recirc cavitation warning | demand above 30 below 20 APRM; above 90 below 40 APRM | operating-range protection |
| high RPV level annunciator | at least 2.5 m | level warning |
| low RPV level annunciator | below -2.0 m | early level warning before RPS trip |
| main turbine pressure target | 7.1 MPa | source speed automatic target / normal operating target |
| LPCI pressure region | at or below 3 MPa | low-pressure injection becomes applicable |
| turning gear target/cap | approaches 60 RPM, capped at 50 RPM | turbine warm-up support |

## 22. Normal Unit 2 startup as an internal state trace

This is not just an operator checklist. It explains what changes internally
when a normal realistic startup is performed. The sequence follows the Unit 2
guide-board order and should be used as a regression scenario for a port.

### 22.1 Initial line-up

1. **CRD pump and accumulator.** The requested CRD drive becomes an actual
   hydraulic pressure difference only with its electrical/mechanical
   permissives. Rod movement is then bounded by that pressure. Before this,
   a correctly displayed withdrawal command should not materially move rods.
2. **Shutdown cooling off.** RHR/SDC cooling contribution is removed from the
   RPV temperature equation. Leaving it active can counter normal heat-up.
3. **Feedwater-pump preheat.** Local auxiliary/preheat state improves the
   later feedwater train readiness; it does not create reactor feed flow by
   itself.

### 22.2 SRM and IPR rise

4. **Withdraw in the RWM sequence.** Each permitted rod position changes
   local absorber state. The core updates neutron cells, then SRM/LPRM/APRM
   paths respond. A port should show delayed power response but immediate
   correctly permitted rod motion.
5. **Track SRM / increment IPR.** These actions advance procedure/range
   state and remove withdrawal blocks. They do not add heat directly.
6. **Stabilize near 5% APRM and select RUN.** APRM downscale protection is
   no longer startup-vetoed in normal RUN operation, so entering RUN with a
   genuinely low APRM creates a real protection concern.

### 22.3 Steam, condenser and pressure availability

7. **Start recirc near the guide value of 28%.** With valid power, actual
   recirc flow modifies core moderation/void response. The effect is not a
   direct gauge override.
8. **Open bypass about 35%.** Actual bypass flow is pressure dependent and
   removes steam, helping control vessel pressure while the heat/mass balance
   establishes itself.
9. **Start cooling, CAR, condenser circulation and SJAE.** Steam can now
   condense into the hotwell, hotwell water can move through condensate/DA,
   and condenser pressure can improve. A valve command without the associated
   pump/source should have no actual transfer effect.
10. **Build pressure above 5 MPa.** The reactor must have sufficient thermal
    and inventory state to create steam. This is an internal availability
    condition for useful turbine run-up, not merely a gauge target.

### 22.4 Turbine run-up and synchronization

11. **Prepare turbine auxiliaries and turning/preheat equipment.** Lube,
    hydraulic, sealing, casing/preheat and turning gear influence whether the
    shaft can be started safely and what steam flow turns into RPM.
12. **Raise APRM to 10 to 15% and admit steam.** Main-turbine flow rises only
    when pressure and main inlet demand both permit it. Vessel pressure falls
    or stabilizes according to steam removal versus heat generation.
13. **Synchronize at nominal speed/phase.** The source calculates shaft
    target and phase convergence before the sync path becomes valid; forcing a
    breaker boolean without those conditions is not equivalent.
14. **Raise to 20%, target 7.1 MPa, establish DA at 108 C, then raise to 30%.**
    The steam/condensate/DA/feedwater chain must now conserve inventory. At
    this point recirculation becomes the normal faster power-control path,
    while rods remain part of the neutron/longer-term control path.

### 22.5 Expected internal checks at each milestone

| Milestone | Values that should be nonzero/true | Values that should remain controlled |
| --- | --- | --- |
| rod motion allowed | CRD pressure, selected rod command, valid mode | withdrawal block and SCRAM availability |
| source range | local neutron/SRM values | low period, rod pattern and fuel imbalance |
| steam available | RPV temperature, pressure, steam generation | RPV level and relief/bypass demand |
| condenser established | CAR/SJAE/circulation effect, condensation, hotwell inventory | condenser pressure and hotwell level |
| turbine ready | lube/hydraulic/seal/preheat state, steam inlet, shaft RPM | vibration, casing condition, pressure |
| synchronized generator | valid phase/RPM, sync path, exciter/grid state | own-use load, bus capacity and export |
| normal load raising | APRM, recirc effect, turbine flow, generator output | DA/hotwell/RPV levels, pressure, condenser condition |

## 23. Controlled shutdown and emergency-response state trace

### 23.1 Normal shutdown

1. Lower APRM to 20% or less so the unit is within a manageable thermal/steam
   range.
2. Remove the B-side cooling/feed/condenser trains when their process load is
   no longer required, then transfer Bus A to a valid startup source as the
   procedure requires.
3. SCRAM. Rod positions move in, neutron power falls, but stored heat,
   pressure and inventory do not disappear.
4. Select both RHR trains for shutdown cooling and maintain valid MCC flow.
5. Continue tracking RPV, DA and hotwell conservation until temperature is
   below 50 C and steam flow is below 5 kg/s before taking remaining plant
   equipment out of service.

### 23.2 Low-level / loss-of-power recovery

At low level, the essential question is not whether an ECCS button is lit; it
is whether the system has its actual source path. Restore/confirm Safety Bus
or a valid emergency source, establish RCIC/HPCC where applicable, lower
pressure toward the LPCI region, then use the selected low-pressure injection
and shutdown-cooling path. The RPV level, CST source inventory, pressure and
actual injection flow must all be from the same conservation model.

### 23.3 Useful diagnostic order

1. Read the displayed condition and its source state.
2. Check supply bus/source and breaker path.
3. Check commanded position versus actual effect.
4. Check upstream/downstream inventory and pressure.
5. Check protective veto/lineup/mode conditions.
6. Only then treat a persistent disagreement as a malfunction or bad module.

## 24. Change-impact guide for maintainers

| Intended change | Change the authoritative layer | Do not change only | Regression case to run |
| --- | --- | --- | --- |
| different pump capacity | actual pump-effect calculation and electrical load | gauge scale | pump on with/without source, level conservation and bus overload |
| new rod worth curve | core absorption/fuel/neutron layer | APRM display mapping only | SRM/IPR/RUN rod sequence, period and APRM response |
| new RPS threshold | RPS full/half/veto conditions and reset logic | annunciator label alone | boundary values on both channels and reset rejection |
| new alarm | annunciator condition consuming process state | a hard-coded visual lamp | alarm onset, acknowledge, silence and clearing |
| new valve travel rate | actuator position process | downstream gauge script | hold/step input, actual flow and automatic-controller stability |
| new transformer/bus | electrical source graph and machine power gates | breaker display | source loss, islanding, overload and recovery |
| changed turbine rating | steam/RPM/generation/load equations together | MW text only | run-up, synchronizing, full load and reverse power |
| new emergency injection | RPV mass/pressure path and source tank | RPV level setter | no-power, low-pressure, depletion and trip recovery |

## 25. Regression and acceptance scenarios

Any change to process, electrical, protection or display wiring should be
tested with the following scenarios. The point is to validate value paths, not
just whether buttons render.

### 25.1 Cold state

- All rods inserted, no actual neutron power, pressure near atmospheric and
  turbine stopped.
- Opening a powerless pump/valve command must not create flow.
- A relief command must affect vessel pressure only through its valid path.
- Indicated level must remain distinct from base inventory if temperature is
  changed.

### 25.2 Manual startup

- CRD hydraulic permissive established before rod movement.
- SRM/IRM/RWM sequence permits only the expected rod motion.
- APRM and local instruments rise after the delayed core response rather than
  instantly assigning full power.
- Recirc produces actual effect only after its supply bus is energized.
- Pressure becomes useful above 5 MPa; bypass and turbine admission change
  steam extraction rather than deleting pressure as a one-time value.

### 25.3 Grid and normal power

- Turbine auxiliaries/preheat/sealing establish valid run-up conditions.
- RPM and phase converge before synchronization.
- Bus A/B sources, own-use load and export update after synchronization.
- At 7.1 MPa and normal steam admission, the system reaches a stable operating
  region rather than a permanent pressure drain or runaway.
- DA/hotwell/RPV level changes follow each flow imbalance in the expected
  direction.

### 25.4 Protection and recovery

- Test both sides of every full and half RPS threshold.
- Confirm each source veto: startup mode, APRM below offsite-loss threshold,
  rod/max-rod low-period veto and reset conditions.
- Verify SCRAM inserts rods through the same physical rod path.
- Verify dead Bus S/DC disables the dependent actual equipment, not merely its
  illumination.
- Verify ADS/MSRV/LPCI/RHR/RCIC actions use the shared pressure and inventory
  state and can be recovered from by restoring valid sources/lineups.

## 26. Scope notes

This document intentionally omits loading zones, decorative prop scripts,
ordinary doors, unrelated player cosmetics and other non-plant gameplay
plumbing except where they determine authority, access, logging or a real
control permissive. The aim is to teach how the simulated plant is wired,
calculated, protected, displayed and safely changed.

## 27. Operator reference sources

The extracted scripts are the authority for formulas and thresholds. The RBWR
wiki is useful as an operational cross-check for intended normal line-ups and
human procedure:

- [RBWR guide boards](https://rbwr.fandom.com/wiki/Guide_Boards)
- [Unit 2 MCR overview](https://rbwr.fandom.com/wiki/U2_MCR)
- [Emergency systems guide](https://rbwr.fandom.com/wiki/Emergency_Systems)
- [Turbine Control Room startup guide](https://rbwr.fandom.com/wiki/Turbine_Control_Room)

Where a guide and source disagree, treat the process source as the exact code
behaviour for the extracted build and record the guide difference as a version
or procedure difference rather than silently changing a formula.

