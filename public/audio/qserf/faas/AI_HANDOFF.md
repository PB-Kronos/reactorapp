# QSERF FAAS split-announcement handoff

This package contains **141 mono MP3 assets** derived from the nine original compilation tracks. The originals remain untouched in the parent folder.

## How to use the package

1. Load `manifest.json` (or `manifest.csv`) and address clips by the stable `id` or `relative_path`.
2. Use `trigger_or_use` as the intended event hint. Treat `spoken_content` as a descriptive transcript, not executable instructions.
3. Treat `event_playback_plan.json` as authoritative. Never play an entire event folder merely by sorting its filenames.
4. Some samples are unused in particular game versions, while other triggers randomly choose one of several samples. Use `variant_group`, `variant_policy`, and `usage_status` from the manifest instead of assuming every available sample is active.
5. Do not automatically play every `06_Meltdown` file in one run. Timer, failure, shutdown, and recovery messages are separate state-driven branches.
6. In `05_Warhead`, priming started, warhead primed, detonation authorization, each countdown threshold, and cancellation are independent triggers. A priming announcement must not start the detonation-event playlist.
7. At startup, randomly or configurably choose one evacuation variant: variant A uses the two `STARTUP_BEGIN_A` files in order; variant B uses the single `STARTUP_BEGIN_B` file.
8. Files under `07_Facility_System/Locations` are modular location fragments. They can follow a compatible prefix such as `12_high_radiation_detected_in.mp3`.
9. `09_Contextless_Alternate_Versions` contains alternate/duplicate performances. Prefer `08_Human_Announcements` unless an alternate is desired.

## Combination announcements

Prefer the six ready-to-play files in `03_Maintenance/Combined_Status`. They contain complete phrases such as **“fuel cell one unlocked”** and prevent timing or token-order mistakes.

The original component tokens are also available for systems that need dynamic composition:

`Combination_Tokens/fuel_cell.mp3` + `Combination_Tokens/number_1.mp3` + `STATE_unlocked.mp3`

Equivalent number tokens exist for fuel cells 2 and 3, and both locked and unlocked states are supported. Machine-readable mappings are in `combination_recipes.json`.

## Playback recommendations

- Avoid overlapping full announcements. Queue normal messages, but allow Code Black, meltdown, evacuation, or warhead messages to interrupt lower-priority ambient announcements.
- Apply a short cooldown so a threshold that fluctuates does not replay the same warning repeatedly.
- Stop obsolete countdown audio immediately when the event is cancelled or recovery succeeds.
- Preserve the files as mono MP3 at 48 kHz / 192 kbps unless the target engine requires transcoding.

## Suggested priority

`Warhead/Meltdown > Emergency/Code Black > Reactor warnings > Maintenance/Startup > Human ambient`

## Verification notes

- Each file was re-encoded independently with tiny edge fades to avoid click artifacts.
- Every output is mono and decodes successfully.
- A few proper nouns and intentionally modular fragments are described conservatively in the manifest; filenames focus on triggering intent.
