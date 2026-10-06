# AI Handover

## Update policy

Update this file for every subsequent implementation update. Record the commit,
what changed, the user-provided source/calibration data used, verification
performed, and known gaps. Do not treat unverified simulator assumptions as
game-accurate behavior.

## Current HES simulator status

The HES simulator is at `src/archive/hes/`. The archive entry is password
protected in the site UI. The working model has separate Unit 1 and Unit 2
controls, shared auxiliaries, electrical/islanding/EDG panels, spillways, and
the instrumentation needed to teach a normal run-up.

### Recent commits

| Commit | Summary |
| --- | --- |
| `4456dab` | Upgraded simulator baseline. |
| `4710968` | Decoupled hydraulic auxiliary power/pump selection from C3, so opening the generator breaker does not remove wicket hydraulic pressure. |
| `dc8c9c8` | Corrected generator synchronization behavior and scaled each unit to a maximum 13.0 MW. |
| `ecc3790` | Calibrated run-up/MIV behavior from Unit 2 debug captures. |
| `92ed925` | Added run-up instrumentation, persisted-state migration protection, and Unit 2 layout improvements. |

### Implemented behaviors

- A fully commanded MIV indicates a 95–100% water-wave oscillation; turbine
  fill remains a separate, slower state.
- Auto Runup has a 248 RPM setpoint and settles around 250 RPM. Around 20%
  wicket is represented as 0.20 water flow during run-up.
- Generator MW is limited to 13.0 MW per unit and is zero until the operator
  manually closes C3 while speed and voltage meet synchronism conditions.
- After manual C3 closure, grid frequency holds approximately 250 RPM and
  wicket movement changes MW. Opening C3 must not reset wickets or make Auto
  Runup an unlock requirement.
- Nitrogen is modeled as charged at standby and used during a turbine trip to
  close wicket gates; it is not a normal MIV-start permissive.

### Calibration evidence supplied by the user

Unit 2 shutdown debug: zero RPM/water flow/wickets/MIV/fill, brake engaged,
generator breaker open, no oil or jacking pressure, generator coolant shared
tank 100%, local generator tanks 89.30%, and nitrogen ready around 35 bar.

Unit 2 run-up debug: 250 RPM, about 21.4% wickets, 0.21 water flow, MIV 100%,
turbine fill 91.80%, oil pressure 54.30, jacking oil pressure 60, oil shaft
pump running, AVR enabled with excitation level 8.38, and generator synced.

### Verification performed

`pnpm exec esbuild` was run successfully for HES `App.tsx`, `Controls.tsx`,
and `simulator.ts`; `git diff --check` also passed. The HES run-up path was
also exercised through the local UI before the later calibration refinements.

### Known gaps / next work

- Re-test the latest Unit 1 run-up and manual C3 sequence in the local UI.
- Calibrate oil, jacking-oil, excitation, coolant, vibration, and temperature
  gauge scales against further debug captures rather than inferred values.
- Keep updating this handover file in the same change/commit as every future
  simulator update.
