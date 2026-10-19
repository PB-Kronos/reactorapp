# RBWR V2 — Unit 1 physics-engine reference

## Purpose and scope

This is an implementation reference for the **Unit 1** physics and control model
in the supplied RBWR V2 Roblox Studio project.  It describes what the running
scripts calculate, rather than treating a panel indication as a source of
truth.  It is intended as the basis for a faithful port into this React
simulator later.

The principal authority is the extracted Roblox server script:

`C:\Users\admin\RBWR\extract\scripts\ServerScriptService\GlownaPetla.lua`

Other Unit 1 scripts principally render instruments, manipulate controls,
raise annunciators, or supply electrical/protection state.  They are not the
primary reactor/thermal-hydraulic calculation loop.

> **Important fidelity note:** RBWR V2 is a game-calibrated dynamic model, not
> a thermodynamic plant code.  Its values mix physical-looking units (Pa, kg,
> °C, RPM) with intentionally empirical multipliers.  A port should preserve
> those relationships and coefficients first; replacing them with real-world
> steam tables would change the game behaviour.

## 1. Execution architecture

### 1.1 Authoritative state

The server keeps the model state under `Workspace.Reaktor` and updates it in
place.  Controls write `Value` objects or part attributes; the physics loop
reads them, calculates new state, then writes the state back.  The visible
gauges are consumers of that same state.

The important state groups are:

| Roblox path/group | Role |
| --- | --- |
| `Reaktor.Parametry` | neutron population, maximum neutron population, average rod position, period, reactor type, power setpoint, SCRAM/automation flags |
| `Reaktor.Cyrkulacja` | RPV temperature, pressure, indicated/base level, recirculation pump demand and flow |
| `Reaktor.Chlodzenie` | feed pumps, feed temperature, hotwell and deaerator inventories |
| `Reaktor.Bilans` | reported steam/feed/preheater/deaerator balances |
| `Reaktor.Turbina` | main turbine and bypass demands, RPM, generation, trip/synchronisation data |
| `Reaktor.Skraplacz` | condenser pressure/vacuum and circulating-water state |
| `Reaktor.Elektryczny` | Bus A/B/S/DC availability and electrical permissives |

### 1.2 Update rate and numerical behaviour

The main loop ends with `task.wait(0.05)`, so its nominal cadence is **20 Hz**
(`Δt ≈ 0.05 s`).  The rod/setpoint coroutine also runs with the same cadence.
Many coefficients are therefore per-tick calibrations, not rates expressed in
SI seconds.  Do not silently change them to a different simulation step.

Several values are deliberately filtered using old samples.  For example,
pressure is averaged with three historic values before the temperature/pressure
update.  This creates lag and is part of the control feel.

### 1.3 Startup state

On initialization, Unit 1 uses approximately:

```text
base RPV inventory      = 16.0 to 20.0 (randomized)
RPV pressure            = 1 Pa
RPV temperature         = 30 to 35 °C (randomized)
hotwell / deaerator     = -2.0 to +2.0 (randomized)
reactor height          = 18
condenser pressure      = 101,300 Pa
```

The `UruchomReaktor()` routine is a convenience/game-start routine, not the
normal physical startup path.  It preloads conditions such as **287 °C**,
**7.1 MPa**, 20% power setpoint, 3,600 RPM, 450 turbine steam, 5,500 Pa
condenser pressure and 50% recirculation demand.

## 2. Signal path at a glance

```text
rod positions + fuel + xenon + density/void + recirculation
                         │
                         ▼
             24 channels × 10 axial levels
                         │ neutron population / period / APRM-like power
                         ▼
              thermal power + residual iodine heat
                         │
 feedwater temperature ──┼──► RPV temperature ─► saturation cap ─► pressure
                         │                                  │
                         │                                  ├──► steam mass
                         │                                  │       ├─ turbine / bypass
                         │                                  │       ├─ preheaters / DA
                         │                                  │       └─ condenser/hotwell
                         ▼                                  ▼
                    RPV inventory ◄── feedwater ◄── DA ◄── condensate pumps
                                                         
main steam flow + pressure ─► turbine RPM / grid generation / electrical buses
```

## 3. Core geometry, neutron calculation, and power

### 3.1 Geometry

The core is represented as a **6 × 6 horizontal map with 24 valid rod/fuel
channels**, not a full 36-channel square.  The invalid corner/edge positions
are explicitly skipped.  Each valid channel has **10 axial levels**.

The active neutron field is therefore 24 × 10 = **240 cells**.  Core power,
rod-power indications, vertical maps, and reactor period are derived from this
field rather than from a single reactor-power number.

Each cell has a neutron population:

`N[k, x, y]`

and a previous generation `N_old[k, x, y]`.  Every main simulation update
runs ten internal transport/absorption iterations before calculating a new
generation.

### 3.2 Temperature feedback

The temperature multiplier applied to neutron production is:

```text
M_T = 1.02 − 0.00006666 × (T_RPV + 270)
```

where `T_RPV` is the reactor temperature in °C as stored by the game.  It
falls as temperature increases, giving negative temperature feedback.

### 3.3 Density moderation and recirculation/void feedback

The code derives an effective density from base inventory and indicated level:

```text
ρ = 1000 × baseLevel / (indicatedLevel + reactorHeight)
```

with `reactorHeight = 18`.

The base density moderation function is the cubic:

```text
D(ρ) = −5.84e−10 ρ³ + 1.35422e−7 ρ² + 0.001358252042 ρ + 0.090469568418
```

An axial flow/void-like term is built from each level’s old neutron density:

```text
V[1,x,y] = 24 × N_old[1,x,y] / N_max
V[k,x,y] = 0.9 × V[k−1,x,y] + 24 × N_old[k,x,y] / N_max, for k > 1
```

For the normal reactor types, the two recirculation-pump effects are blended
with the base density factor.  Let `E1` and `E2` be actual pump effectiveness;
each begins as command × pump-health / 100 and is zeroed if its electrical
bus is unavailable.  For types 1–3:

```text
M_flow1 = (1 − D) × 1.3 × E1 + D
M_flow2 = (1 − D) × 1.3 × E2 + D
```

The axial moderation coefficient is then selected by type:

```text
type 1: M_flow × (1 − 0.8 × V)
type 2: M_flow × (1 − 0.4 × V)
type 3: M_flow
other:  (2 − D) × (1 + 0.01 × V)   [the RBMK-style branch]
```

This is why recirculation affects reactivity/power rather than directly
cooling the RPV in this model.  Unit 1’s reported recirculation flow is:

```text
recircFlow_i = E_i × 1000
```

### 3.4 Neutron transport and reflector

For every active cell and internal transport iteration, the model attempts to
move:

```text
escaped = 0.97 × N_old[cell]
```

to adjacent valid cells.  The distribution distinguishes horizontal,
diagonal, and axial neighbours.  Direct horizontal neighbours receive the
largest share, horizontal diagonals less, vertical direct neighbours less
again, and vertical diagonals the least.  The source uses the following
per-neighbour shares:

| Neighbour relation | Share of `escaped` |
| --- | ---: |
| same axial level, cardinal direction | 1/12 |
| same axial level, diagonal | 1/24 |
| adjacent axial level, same x/y | 1/8 |
| adjacent axial level, cardinal direction | 1/24 |
| adjacent axial level, diagonal | 1/48 |

At horizontal boundary classes, a fraction of leakage is returned by the
reflector (`reflectivity = 0.8`).  The return is either
`(2/6 + 2/12) × escaped × 0.8` or
`(2/6 + 1/12) × escaped × 0.8`, depending on the geometry.  At the top and
bottom axial levels, it additionally returns:

```text
(2/4/2) × escaped × 0.8 = 0.25 × escaped × 0.8
```

This is a game-specific spatial diffusion model—not a normalized Monte Carlo
or real reactor-kinetics solver—so a direct port must retain its ordering and
boundary treatment if it is to reproduce RBWR responses.

### 3.5 Rod insertion/absorption

Rod values are stored from **0 = fully inserted** to **100 = fully withdrawn**.
For the normal branches, the code reverses/scales the rod coordinate into the
10 axial layers, then applies multiplicative absorption by layer.  Its main
constants are:

```text
minimum absorption = 0.235
maximum absorption = 0.170
```

Thus a fully covered layer is multiplied by roughly `1 − 0.235 = 0.765`,
while the less-absorbed region is roughly `1 − 0.170 = 0.830`; the transition
layer is linearly interpolated by fractional rod position.  The alternative
RBMK-like branch uses separate values (`0.265`, `0.230`, and a `0.190`
displacer term).

The consequence is significant: rod movement does not directly set power.
It changes spatial absorption; transport, fuel, xenon, density, and the next
generation calculate the delayed local and total power response.

### 3.6 Next generation, xenon, and thermal power

After transport and rod absorption, each valid cell creates the next neutron
generation.  In the type-1 branch, the expression is:

```text
N_next[k,x,y] =
  ((6−x) × M_T × M_flow1 + (x−1) × M_T × M_flow2) / 5
  × fuel[k,x,y]
  × 0.03
  × (1 − xenon[x,y] / 4.5)
  × (N_idle / 24 + N_transport[k,x,y])
```

Type 2 changes the blending divisor from `5` to `6`; type 3 and the
alternate branch use `4.5`.  The alternate branch also reverses the fuel
axial lookup (`fuel[x,y,11−k]`).

The summed population is the next total generation `N_total,next`.  The base
reactor-power fraction is:

```text
P_neutron = N_total / N_max
P_thermal = P_neutron × 2.25 / 1.10
```

`P_thermal` is the empirical heat term used by the RPV temperature model.
The panel APRM-like displays are based on `N_total / N_max × 100`, while local
and axial indicators use their individual cell/rod sums normalized against
`N_max`.

### 3.7 Period

The Unit 1 reactor period is calculated directly from two total generations:

```text
period = 1 / ln(N_total,next / N_total,previous)
```

Positive period represents growth; negative period represents decay.  The
display and automatic controls consume this raw calculation, so a port should
guard zero/invalid populations only to prevent `NaN`/infinity—not replace the
underlying equation.

### 3.8 Residual heat

Iodine is used as a residual heat proxy:

```text
residualHeat = max(0, 0.03 × iodine − P_thermal)
```

It is added to the temperature change term below.  The script also maintains
per-channel iodine/xenon tables, which provide the delayed poisoning response
in the neutron-generation term.

## 4. RPV temperature, saturation, pressure, and level

### 4.1 Feedwater/decay heat balance

Define:

```text
R_T = (T_RPV − T_feed) / 300
```

Each feed pump’s actual effectiveness is command × health / 100, zeroed if
its respective AC bus is dead, and ignored below 0.25.  The average feed
effectiveness is:

```text
E_feed = (E_feed1 + E_feed2) / 200
```

Shutdown-cooling effectiveness is derived from the two shutdown cooling
controls, halved, unavailable without the safety bus, and disabled below
31 °C.  In normal (non-isolation) operation:

```text
ΔT_drive = P_thermal
           − (R_T / 3) × (E_feed + LPCI_term)
           − 0.090 × E_shutdown
           + residualHeat

T_RPV,next = T_RPV + 6 × ΔT_drive
```

In isolation the normal-feed term is replaced by emergency-feed flow, and the
shutdown cooling coefficient changes from `0.090` to `0.060`.

This explains an important RBWR behaviour: feedwater is both inventory and
cooling.  It does not independently “make pressure”; it controls temperature
and therefore the pressure source.

### 4.2 Saturation-temperature ceiling

The model calculates a pressure-dependent maximum water temperature from RPV
pressure `p` in MPa:

```text
T_sat(p) = −0.0040964052p⁶ + 0.1417383107p⁵ − 1.9430568125p⁴
           +13.5042849307p³ −51.2737887815p² +118.6853712464p
           +100.1541546689
```

It filters this with two old samples:

```text
T_sat,filtered = (T_sat + T_sat,old2 + T_sat,old3) / 3
T_sat,filtered = max(100, T_sat,filtered)
```

If the predicted RPV temperature exceeds that ceiling, it is clamped and the
excess is converted into a nonlinear pressure-driving term:

```text
excess = (T_pred − T_sat) × T_pred / 50
excess = filtered over current/old2/old3, then divided by 3
```

The same saturation polynomial is also used in deaerator calculations.

### 4.3 Pressure generation

Before computing pressure, Unit 1 averages current pressure with the last
three saved values:

```text
p_filtered = (p + p_old + p_old2 + p_old3) / 4
```

Its pressure-driving temperature is:

```text
T_rel = (T_RPV − 100) × (1 − p_filtered / 10,000,000)
```

and the per-tick pressure increase is:

```text
Δp = 25,000 × (T_rel + 30 × excess) / 12.6
p_next = max(0, p_filtered + Δp)
```

The loop caps stored pressure at 12,000,000 Pa before this calculation.
Pressure creation also removes base RPV inventory (steam formation):

```text
baseLevel -= (steamScale × Δp / 20,000) / 2,000 / 5
```

where `steamScale = 20` in the supplied script.

### 4.4 Indicated versus base RPV level

The displayed RPV level is not raw inventory.  Its density correction is:

```text
ρ_water(T) = −0.000004467711T³ − 0.000560288485T²
             − 0.429148844451T + 1010.035413387815

level_indicated = baseLevel / (ρ_water / 1000) − 18
```

Therefore temperature alone moves the apparent level.  Use `baseLevel` for
mass bookkeeping and `level_indicated` for panel display, annunciators, and
level-control behaviour.

## 5. Steam extraction and water inventory chain

### 5.1 Main turbine and bypass steam

With isolation inactive, valve demands are translated to steam extraction as:

```text
F_turbine = turbineDemand × 2000 × p / 10,000,000 / 100
F_bypass  = (bypassDemand / 3) × 2000 × p / 10,000,000 / 100
```

Bypass demand under 1 is treated as zero.  During isolation both normal
extractions become zero.

Total extraction also includes preheater and deaerator steam:

```text
F_steam = F_bypass + F_turbine + F_preheaters + F_deaerator
```

The pressure loss associated with it is:

```text
pressureLoss = 20,000 × F_steam / steamScale
p_next -= pressureLoss
```

The balance panel reports this using `steamScale / 20`; with the supplied
value of 20 this leaves the displayed number numerically unchanged.

### 5.2 Isolation/emergency path

During isolation, relief and emergency-turbine flow are each one-third of the
normal full-capacity relation:

```text
F_relief = reliefDemand × 2000 × p / 10,000,000 / 100 / 3
F_turbo  = turboDemand  × 2000 × p / 10,000,000 / 100 / 3
```

The emergency turbine has first-order RPM response:

```text
RPM_target = 5000 × F_turbo^1.2 / 300 × 3/2/10×3×2
RPM_next   = RPM + (RPM_target − RPM) / 75
HPCC_feed  = RPM_next / 23
```

HPCC feed adds to base RPV level at:

```text
baseLevel += HPCC_feed / 2000 × steamScale / 20 / 5.4
```

LPCI is available only if its control is on, pressure is below 3 MPa, and the
safety bus is energized; it adds `0.2 / 5` base-level units per update.

### 5.3 Condenser, hotwell, deaerator, and feedwater

Steam condensed into the hotwell is scaled by condenser effectiveness.  In
the normal case it is 1.0.  If condenser pressure exceeds 9,000 Pa while steam
flow is greater than 300, retention becomes:

```text
retention = (101,300 − condenserPressure) / 101,300
```

Hotwell update includes:

```text
hotwell += F_steam / 1000 / (steamScale/20) × retention / 5
hotwell -= F_preheaters / 1000 / 5
hotwell -= F_deaerator / 1000 / 5
```

Condenser-pump effectiveness is limited by both pump capacity and condensate
valve setting.  Pumps are electrically gated by Bus A/Bus B.  Their resulting
hotwell-to-deaerator flow is approximately:

```text
F_hotwell_to_DA = min(condensateValve, pump1 + pump2) × 2000
```

provided the hotwell is above its low cutoff.

Feedwater flow from deaerator to RPV is:

```text
F_feed = E_feed × 2000, if deaeratorLevel > −8; otherwise 0
```

Then the RPV receives:

```text
baseLevel += F_feed / 2000 × steamScale / 20 / 5
             × (100 − postDA_leakPercent) / 100
baseLevel += F_preheaters / 2000 / 5
baseLevel += 0.99 × F_deaerator / 2000 / 5
```

The model applies soft/high-level drains at indicated reactor level > 6.1 and
a stronger drain at ≥ 7.5.  Hotwell and deaerator are softly reduced above
6.1 and capped at 8.

### 5.4 Condenser vacuum model

The circulating-water pump flow uses:

```text
condenserCircFlow = condenserPumpEffectiveness × 5000
```

The condenser pressure moves toward its vacuum floor through a high-gain
empirical term based on condenser steam flow and circulating-pump
effectiveness.  Its important control characteristics are more reliable than
its literal coefficient: greater valid circulating flow lowers pressure;
high steam flow with poor vacuum reduces condensation retention; and the
annunciator thresholds identify > 7,000 Pa as low vacuum and > 9,000 Pa under
high flow as ineffective condensation.

## 6. Turbine, generator, synchronisation, and load

### 6.1 Valve movement

At 20 Hz, main turbine demand changes by:

| Lever position | Demand movement per tick |
| --- | ---: |
| +1 / −1 | +0.05 / −0.05 |
| +2 / −2 | +0.25 / −0.25 |

It is clamped to 0–100 and forced closed if the main steam valve is closed.
Bypass movement uses ±0.25 per tick in the examined control block.

### 6.2 Pressure efficiency

The main turbine applies this linear pressure efficiency:

```text
η_pressure = 0.0000000610 × p_RPV + 0.5670731695
```

At 7.1 MPa it is almost exactly 1.0.  This coefficient is essential to
matching RBWR turbine response away from nominal pressure.

### 6.3 Unsynchronised turbine

When not synchronised, local AC loading from closed Bus A and/or B breakers
opposes turbine acceleration (only once RPM is above 1,600).  The target is:

```text
RPM_target = 3600 × F_turbine / 225 × η_pressure
             − 3600 × 1200 / 5.65 / 225 / 225 × 1.15 × electricalLoad

acceleration = (RPM_target − RPM) / 1000
RPM_next = max(0, RPM + acceleration)
```

If target RPM is zero and current RPM is below 50, the target is set to −20 to
finish the coastdown.  An open main steam valve adds 10 to the target.

Turbine phase advances with:

```text
phase = (phase + 3 × (RPM − 3600)) mod 3600
```

### 6.4 Synchronised generator

When synchronised, the model locks turbine speed to **3,600 RPM** and calculates
generation from steam flow and pressure efficiency:

```text
generation = (F_turbine / 225 × η_pressure − 1) × 1200 / 5.65
```

This is a calibrated generator output formula; it permits negative/reverse
power at low steam flow.  The Unit 1 annunciator checks reverse power when
generation is negative while the generator is connected.

Turbine vibration includes acceleration plus resonance peaks centred near
1,050, 2,100, and 3,250 RPM.  Each peak is a clamped quadratic term, providing
the characteristic three critical-speed bands.

## 7. Manual and automatic reactor control

### 7.1 Rod motion

The rod speed switch maps to base movement per tick:

```text
fast   = 0.010
normal = 0.005
slow   = 0.0025
```

For selected rods, Unit 1 rescales movement by `24 / selectedCount`.  This
makes the aggregate worth broadly similar whether a single selected rod or a
group is moved.  Position is always clamped 0–100.

SCRAM disables rod/recirc automatic control and moves every valid rod inward
by 0.25 per tick, until the 24-rod average reaches zero.

### 7.2 Auto rods

When Auto Control is enabled in Rod mode:

```text
error = (powerSetpointPercent − powerPercent) / 500
rate  = (powerPercent − oldPowerPercent) / 15
rodCommand = error − rate
```

After 12 seconds beyond automatic startup, positive withdrawal is constrained
when average rod position exceeds 9 and period is short:

| Positive period | Withdrawal treatment |
| --- | --- |
| 0–33 s | block (`rodCommand = 0`) |
| 33–35 s | ÷4 |
| 35–45 s | ÷2 |
| 45–60 s | ÷1.5 |

The output is clamped to ±0.01 per tick after that startup grace interval.
Near setpoint (`abs(error) < 0.001` with power > 25%), it is halved.

### 7.3 Auto recirculation

In Recirc mode, the controller first verifies which recirc pumps, inlets, and
outlets are actually running.  It calculates:

```text
error = (powerSetpointPercent − powerPercent) / 500 / typeScale
rate  = (powerPercent − oldPowerPercent) / typeRateDivisor
recircCommand = (error − rate) × 50
```

For types 1/2 the divisor is 80; type 3 uses 10; the alternate branch uses
200 and a scale of 10.  A two-pump command is split in half; zero operating
pumps force it to zero.  It is clamped to ±0.05 per tick and prevented from
increasing power when positive period is below 40 s.  The alternate reactor
branch reverses the sign.

## 8. Displays, alarms, and protection boundaries

### 8.1 Display derivation

The important display mappings are:

| Display | Derived from |
| --- | --- |
| APRM-like power | `totalNeutrons / maxNeutrons × 100` |
| Rod/axial local power | cell or channel neutron population normalized to `maxNeutrons` |
| Period | `1 / ln(nextGeneration / previousGeneration)` |
| RPV level | density-corrected base level, not raw inventory |
| Steam/feed/DA balance | mass extraction and return terms above |
| Turbine RPM/generation | turbine steam, RPV pressure, local load, and sync state |
| Condenser vacuum | condenser pressure; lower absolute pressure means higher vacuum |

### 8.2 Annunciators are mostly state-derived

`U1Annunciators.lua` calculates alarms from actual state, including:

- low RPV level ≤ −3 and high RPV level > 2.5;
- high thermal power > 108%;
- local rod imbalance (`maxRodPower / reactorPower > 1.05`);
- high rod power > 120;
- low period;
- condenser low vacuum > 7,000 Pa and ineffective condensation above
  9,000 Pa during high steam flow;
- Bus A/B/S/DC power state;
- turbine trip, reverse power, and high main steam pressure/temperature.

These alarms are separate from the core calculation, so a port should avoid
making the breaker position itself the alarm source when the original uses the
energized state.

### 8.3 Protection-system caveat

The extracted `ReactorProtectionSystem\Reactor2` package is explicitly wired
to `Workspace.Reaktor2`, so it is **not used as Unit 1 physics evidence** in
this reference.  Unit 1’s main loop and `U1Annunciators.lua` do include
direct SCRAM behaviour and certain direct high-pressure actions.  A later
port should map Unit 1’s actual RPS assets separately rather than copying
Unit 2 thresholds by assumption.

## 9. Constants worth preserving verbatim

| Constant | Value | Effect |
| --- | ---: | --- |
| main-loop period | 0.05 s | 20 Hz model cadence |
| active channels / axial slices | 24 / 10 | 240-cell neutron field |
| neutron leakage fraction | 0.97 | diffusion each internal iteration |
| reflector effectiveness | 0.8 | boundary leakage return |
| recirc report multiplier | 1000 | effective pump demand → reported flow |
| condenser circ multiplier | 5000 | condenser pump effect → reported flow |
| steam scale | 20 | internal mass/pressure balancing scale |
| RPV pressure ceiling | 12,000,000 Pa | pre-calculation cap |
| normal turbine base capacity | 2,000 | valve × pressure flow calibration |
| pressure generation multiplier | 25,000 / 12.6 | temperature/excess → Pa per tick |
| turbine nominal speed | 3,600 RPM | grid synchronised speed |
| high condenser vacuum alarm | < 4,000 Pa | low absolute pressure condition |
| low condenser vacuum alarm | > 7,000 Pa | poor vacuum condition |

## 10. Porting guidance for the RBWR web simulator

1. **Port the shared state graph first.**  Do not reimplement the gauges as
   independent formulae.  All pages must read the same RPV, neutron, balance,
   turbine, and bus state.
2. **Use a fixed 0.05 s accumulator.**  Render may run at browser frame rate,
   but execute the RBWR update exactly at 20 Hz.  Cap catch-up work after a
   background-tab pause to prevent runaway simulation.
3. **Port in this order:** core lattice → temperature/pressure → steam and
   inventory chain → turbine/grid → automation → displays/annunciators.
   This respects the real dependency order in `GlownaPetla.lua`.
4. **Keep base and indicated level separate.**  This one distinction prevents
   many false level/pressure behaviours when temperature changes.
5. **Keep electrical gating at the actuator boundary.**  A dead bus zeros the
   corresponding actual pump effect, not merely its lamp or panel command.
6. **Preserve the empirical filters.**  Pressure history, saturation history,
   emergency turbine lag, and controller rate terms are part of the original
   feel and stability.
7. **Treat reactor-type branches as configurable profiles.**  Unit 1’s normal
   type-1 path is the first port target, but retain the type-specific divisor
   and moderation hooks rather than hard-coding only one behaviour.

## 11. Source map and confidence

| Source | Used for |
| --- | --- |
| `ServerScriptService/GlownaPetla.lua` | authoritative Unit 1 lattice, thermals, inventories, turbine, automatic controls, and many display writes |
| `ServerScriptService/AnnunciatorSystem/U1Annunciators.lua` | Unit 1 annunciator thresholds and state relationships |
| Unit 1 panel assets under `Workspace/ControlRoom1/Unit01Main` | control and gauge binding names |

### Key source locators

The following line locations refer to the extracted `GlownaPetla.lua` copy at
the time of analysis.  They make future validation against the Studio place
straightforward without making the document dependent on panel script order.

| Lines | Calculation block |
| --- | --- |
| 355–410 | initial values and density-corrected `PrzeliczPoziomReaktora` level function |
| 949–1321 | core arrays, pump-health state, neutron-loss/reflector constants, steam scale |
| 1562–1903 | axial void term, recirculation moderation, ten-pass transport, rod absorption, neutron generation, period |
| 2166–2694 | thermal balance, saturation polynomial, pressure, steam extraction, isolation, inventories, level |
| 3387–3419 | condenser circulating-water flow and pressure response |
| 4264–4579 | rod movement, SCRAM, rod automatic controller, recirculation automatic controller |
| 4758–4824 | main turbine pressure efficiency, unsynchronised RPM, synchronised generation |
| 5028 | nominal 0.05-second main-loop wait |

Every equation above is taken from the extracted script or is an algebraic
rewriting of its Lua expression.  Where the source uses comments such as
“empirical,” this document preserves that classification.  Where a loop’s
literal coefficients are unwieldy (notably condenser pressure), its input and
behaviour are documented rather than pretending it is a validated physical
law.

