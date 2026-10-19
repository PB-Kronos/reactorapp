# RBWR V2 — Unit 2 physics-engine reference

## Scope and authority

This is the primary physics reference for importing RBWR V2. It is based on
Unit 2: its server physics loop, Workspace.Reaktor2 state, and Workspace.ControlRoom2 controls.

Authoritative simulation source:

C:\Users\admin\RBWR\extract\scripts\ServerScriptService\GlownaPetlaUnit2.lua

Unit 2 is not a renamed Unit 1. It shares the same lattice-core family, but
adds APRM/LPRM/SRM instrumentation, hydraulic rod-drive limits, RHR/LPCI
lineups, deaerator pressure and rupture disk behaviour, sealing/preheat/turning
gear turbine auxiliaries, and an expanded electrical/condenser model.

All equations below are direct Lua expressions or algebraic rewrites of them.
They are game-calibrated, not a real steam-table plant model.

## 1. State and tick

The server owns state under Workspace.Reaktor2. Controls in Workspace.ControlRoom2
write panel attributes; the main loop reads attributes, changes process values,
and display scripts consume those values.

| Group | Important state |
| --- | --- |
| Reaktor2.Parametry | neutron population, fuel, rods, reactor type, setpoint, auto state |
| Reaktor2.Parametry.Power | APRM, old APRM, APRM period, LPRM channels |
| Reaktor2.Cyrkulacja | RPV pressure, temperature, base/displayed level, recirc demand/flow |
| Reaktor2.RodDrive | pressure difference, SCRAM availability, rod-drive pump demand |
| Reaktor2.Chlodzenie | feed/condensate pumps, condenser valve, hotwell/DA inventory |
| Reaktor2.Deaerator | steam inventory, local pressure, temperature, outflow, rupture disk |
| Reaktor2.Turbina | inlet/bypass, RPM, sealing, preheat and synchronization |
| Reaktor2.Elektryczny | AC, DC and safety-bus availability and source effectiveness |

The control/actuator loop calls task.wait(0.05), so nominal cadence is 20 Hz.
The core does ten internal transport passes per process update. A web port
must use a 0.05-second simulation accumulator, separate from rendering.

## 2. Dependency path

    controls + fuel + xenon + density/void + recirculation
                              |
                              v
                  24 channels x 10 axial cells
                              |
                 APRM / LPRM / SRM / period
                              |
                              v
                 RPV heat and iodine residual heat
                              |
    feedwater temperature ----+--> RPV temperature --> saturation --> pressure
                              |                              |
                              v                              v
                    RPV base inventory                 steam extraction
                              ^               turbine / bypass / DA / preheat / casing
                              |                              |
                      feedwater <-- DA <-- hotwell <-- condenser
                                                             |
             turbine steam + pressure + sealing ------------+--> RPM/generation

## 3. Core and power model

### 3.1 Geometry

Unit 2 models a 6x6 coordinate map with 24 valid fuel/rod channels. Invalid
outer positions are skipped. Every valid channel has 10 axial cells: 240
active neutron cells.

    N[k,x,y]      current population
    N_old[k,x,y]  prior generation
    N_tmp[k,x,y]  transport and absorption working population

Rod movement changes axial absorption, never APRM directly.

### 3.2 Temperature/density/recirculation feedback

    M_temperature = 1.02 - 0.00006666 x (T_RPV + 270)

    rho = 1000 x baseLevel / (displayedLevel + 18)

    D(rho) = -5.84e-10rho^3 + 1.35422e-7rho^2
             + 0.001358252042rho + 0.090469568418

    V[1] = 24 x N_old[1] / N_max
    V[k] = 0.9 x V[k-1] + 24 x N_old[k] / N_max

Actual recirc effect begins as command x pump health / 100, then multiplies
the applicable bus-generator effectiveness and is zeroed if the source bus is
dead. The reported flow is:

    recircFlow_i = actualEffect_i x 1000

For types 1 through 3:

    M_flow1 = (1 - D) x 1.3 x E1 + D
    M_flow2 = (1 - D) x 1.3 x E2 + D

| Reactor type | Axial moderation |
| --- | --- |
| 1 | M_flow x (1 - 0.8 x V) |
| 2 | M_flow x (1 - 0.4 x V) |
| 3 | M_flow |
| 4 | (2 - D) x (1 + 0.01 x V) |

Recirculation therefore affects reactivity through the core feedback path,
rather than acting as direct independent RPV cooling.

### 3.3 Neutron transport, reflection, rods and xenon

Each of ten internal passes moves:

    leakage = 0.97 x N_old[cell]

| Destination relation | Share to each neighbour |
| --- | ---: |
| same level, cardinal | 1/12 |
| same level, diagonal | 1/24 |
| adjacent level, same coordinate | 1/8 |
| adjacent level, cardinal | 1/24 |
| adjacent level, diagonal | 1/48 |

Reflector effectiveness is 0.8. Horizontal boundary classes return either
(2/6 + 2/12) x leakage x 0.8 or (2/6 + 1/12) x leakage x 0.8. The top/bottom
axial cells get another 0.25 x leakage x 0.8.

Rods use 0 fully inserted and 100 fully withdrawn. Normal branches use
absorption constants 0.235 and 0.170, giving multipliers roughly 0.765 and
0.830 across axial regions; the boundary layer is interpolated. Type 4 has
0.265, 0.230 and a 0.190 displacer term.

Type-1 next-cell calculation:

    N_next[k,x,y] =
      ((6-x)xM_temperaturexM_flow1 + (x-1)xM_temperaturexM_flow2) / 5
      x fuel[k,x,y] x 0.03
      x (1 - xenon[x,y]/4.5)
      x (N_idle/24 + N_tmp[k,x,y])

Type 2 has divisor 6. Types 3/4 use 4.5; type 4 reverses fuel axial lookup.
This creates delayed, spatially unequal power changes after rod/recirc action.

### 3.4 APRM, LPRM, SRM and period

    P_thermal = (N_total / N_max) x 2.25 / 1.10

Unit 2 retains two periods:

    realPeriod = 1 / ln(N_total,next / N_total,previous)
    APRMPeriod = 1 / ln(APRM / oldAPRM)

Parametry.CzasReaktora is real neutron-generation period. Parametry.Power.Period
is APRM-derived period used by Unit 2 instruments and automatic controls.

LPRMs are fixed four-cell averages: upper channels use axial level 8; lower
channels use axial level 3. Each normalizes to N_max and scales by
100 x 24 x 10. SRM derives from the selected SRM_Depth field slice. These
instruments are process values, not rod-position displays.

## 4. RPV, deaerator, water and steam

### 4.1 Density-corrected level

    rho_water(T) = -0.000004467711T^3 - 0.000560288485T^2
                   - 0.429148844451T + 1010.035413387815

    displayedLevel = baseLevel / (rho_water/1000) - 18

Use base level for conservation and displayed level for gauges/trips. Heating
can change displayed level without adding water.

### 4.2 Deaerator and preheat

    F_DA,in = (DA_inlet/100)
              x max(0, 2000 x P_RPV / 10,000,000 / 100)
              x 1.5 x sqrt(abs(previousTotalSteam/1000))

It is zero during isolation. A ruptured disk forces DA outlet to 1.0.

    DA_pressure = DA_steam_inventory x 500
    DA_localPressure = DA_pressure x (1 + (DA_level + 6)/5)
    DA_outflow = max(0, DA_outlet^2 x (DA_localPressure - 1,000,000)/20,000)
    DA_steam_inventory += F_DA,in - DA_outflow

The source additionally corrects low local DA pressure toward 1 MPa. DA
temperature is steam heating plus a main-steam/preheater term and is saturation
limited.

Three preheaters have individual health:

    T_feed = T_DA + (T_RPV - T_DA) x 0.75 x preheaterEffect
             x clamp(totalSteam/50, 0, 1)

Isolation forces feed temperature to 30 C.

### 4.3 RHR/LPCI, RPV temperature and pressure

Let R = (T_RPV - T_feed)/300. RHR trains require selected controls, safety-bus
power, and valid valve/crossfeed lineup. Below 3 MPa, the selected RHR mode
may add LPCI contribution below level 5.

    residualHeat = max(0, 0.03 x iodine - P_thermal)

    deltaT = P_thermal
             - (R/3) x (feedEffect + LPCI_term)
             - 0.090 x RHR_effect
             + residualHeat

    T_RPV,next = max(30, T_RPV + 6 x deltaT)

Isolation substitutes emergency feed and changes the RHR coefficient to 0.060.

Pressure is first averaged with three history samples. Saturation temperature:

    T_sat(pMPa) = -0.0040964052p^6 + 0.1417383107p^5 - 1.9430568125p^4
                  +13.5042849307p^3 -51.2737887815p^2 +118.6853712464p
                  +100.1541546689

The model caps temperature to filtered saturation temperature and uses the
excess as a smoothed boiling term:

    T_rel = (T_RPV - 100) x (1 - P_RPV/10,000,000)
    deltaP = 25,000 x (T_rel + 30 x smoothedExcess) / 12.6
    P_RPV,next = max(0, P_RPV + deltaP)

Pressure formation consumes base level:

    baseLevel -= (20 x deltaP/20,000) / 2,000 / 5

Unit 2 caps input pressure at 12 MPa before calculation, then final pressure
at 11 MPa after relief handling.

### 4.4 Steam, condensation and feedwater return

    F_bypass  = (bypassDemand/3) x 2000 x P/10,000,000 / 100
    F_turbine = turbineDemand x 2000 x P/10,000,000 / 100
    F_casing  = turbinePreHeatSteamFlow
    F_total = F_bypass + F_turbine + F_preheater + F_DA,in + F_casing
    pressureLoss = 20,000 x F_total / 20

Unit 2 explicitly separates condensed steam from steam lost by condenser
limitations when updating hotwell inventory.

    F_feed = feedPumpEffect x 2000, only when DA level > -8

    baseLevel += F_feed/2000/5 x (100 - postDA_leakPercent)/100
    baseLevel += F_preheater/2000/5 + 0.99 x F_DA,in/2000/5

High-level drains/caps apply to RPV, hotwell and DA. A command produces no
actual pumping when its source bus is unavailable.

## 5. Turbine and auxiliaries

Main inlet is forced to zero by the turbine enable switch. Normal inlet
movement is +/-0.25 per tick. Fine selector increments:

| Fine selector | Movement per tick |
| --- | ---: |
| +/-1 | +/-0.00625 |
| +/-2 | +/-0.025 |

Bypass moves +/-0.25 per tick.

With turning gear selected and Bus S live:

    RPM_next = RPM + (60 - RPM)/150, capped at 50 RPM

Sealing efficiency from sealing pressure s:

    eta_seal = 0.59985497997080239 + 3.5234632998448627s
               -10.132281250358904s^2 + 7.7706116447531288s^3
    eta_seal = 0.741 when s > 0.629
    eta_seal /= 0.9688690337

    eta_pressure = 0.0000000610 x P_RPV + 0.5670731695

    RPM_target = eta_seal x 3600 x F_turbine/225 x eta_pressure
                 - 3600x1200/5.65/225/225 x 1.15 x electricalLoad
    RPM_next = max(0, RPM + (RPM_target - RPM)/1000)

When synchronized:

    generation = (F_turbine/225 x eta_pressure x eta_seal - 1) x 1200/5.65

The Unit 2 turbine automatic buttons select 0/900/1800/2700/3600 RPM and
target 7.1 MPa for nonzero selections. Near 3,600 RPM, it commands 3,598 or
3,602 depending on phase, allowing synchronization convergence.

## 6. Rod drive and automation

### 6.1 Hydraulic rod-drive limit

    maximum rod step = RodDrive.PressureDifference / 100

A movement demand beyond that requests the rod-drive pump. After the autostart
grace interval it is clamped to this hydraulic limit. SCRAMAvailable false
blocks positive withdrawal.

Manual base steps are 0.01, 0.005 and 0.0025 per tick, rescaled by
24/selectedCount. SCRAM moves each valid rod inward by 0.25 per tick.

### 6.2 Auto rods

    error = (powerSetpoint - APRM)/500
    rate = (APRM - oldAPRM)/15
    autoRod = (error - rate) x 24/selectedCount

Near setpoint it attenuates to 1/2 inside 1%, 1/5 inside 0.5%, and 1/10
inside 0.25%. After 12 seconds of autostart grace:

| Positive APRM period | Positive withdrawal |
| --- | --- |
| 0-35 s | blocked |
| 35-40 s | divided by 4 |
| 40-50 s | divided by 2 |
| 50-60 s | divided by 1.5 |

The command clamps to +/-24x0.01/selectedCount and to rod-drive pressure.

### 6.3 Auto recirculation

A pump participates only if its pump, inlet and outlet are all selected.

    error = (powerSetpoint - APRM)/500/typeScale
    rate = (APRM - oldAPRM)/typeRateDivisor
    autoRecirc = (error - rate) x 50

Type 1/2 use divisor 80; type 3 uses 10; type 4 uses divisor 200 and scale
10. Two pumps split the command; zero operating pumps forces zero; output
clamps to +/-0.05 per tick; it cannot increase power when period is below 40 s.

## 7. Unit 2 control/value map

| Workspace area | Process effects |
| --- | --- |
| ControlRoom2.PanelReaktora.Konsola1 | selected rods, rod speed/motion, recirc pumps/inlets/outlets/demand |
| Konsola2 | turbine enable, inlet/fine inlet, bypass, synchronization, speed auto |
| Konsola3 | feed pump/inlet/outlet demand, condenser valve, preheaters, electrical |
| LewySrodek | RHR L/R, RHR modes, valve lineups, crossfeed, makeup tank choice |
| Workspace.Turbine.ControlRoom.MainPanel | turning gear and turbine auxiliary controls |
| Reaktor2.Deaerator controls | DA inlet/outlet and rupture-disk behaviour |
| Reaktor2.Elektryczny | actual actuator power availability |

## 8. Source locators and porting requirements

| Unit 2 source lines | Content |
| --- | --- |
| 267-275 | density-corrected RPV level |
| 1294-1648 | core arrays and constants |
| 1938-2450 | feedback, transport, rods, APRM/period/LPRM/SRM |
| 2450-3168 | DA/preheat, RHR/LPCI, feed, temperature, pressure, steam/inventory |
| 5058-5201 | turbine auto/synchronization trimming |
| 5495-5607 | sealing and preheat |
| 5785-7054 | controls, rod drive, automatic systems, pump/valve motion |

For the port: isolate Unit 2 state, use the 0.05-second fixed update, preserve
pressure/saturation history, keep base level separate from displayed level,
preserve both period calculations, and gate real actuator output by electrical
state/lineup rather than switch visual state.

The separate [Unit 1 reference](RBWR-V2-Unit1-Physics-Engine.md) remains
available for comparison. This Unit 2 document is the source-of-truth reference
for the RBWR simulator import.

