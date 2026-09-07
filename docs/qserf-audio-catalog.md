# QSERF audio catalogue

The deployed audio library is kept under `public/audio/qserf/`.

## Production audio

The web build uses stable, descriptive copies under `public/audio/qserf/`:

- `faas/` — the 141-clip FAAS package, its manifest, and event playback plan.
- `effects/` — alarms and one-shot incident effects. They are low-level effects
  beneath the FAAS voice channel, never substitutes for a FAAS announcement.
- `music/` — optional background tracks with an independent 0–100% control and
  1.5× gain multiplier. They do not automatically duck under FAAS.
- `endings/` — MP4 aftermath recordings. A video is shown only after its matching
  terminal event outcome; it is not normal background media.

## Deliberately not wired into automatic playback

Recordings with player movement, UI noise, or reference speech are intentionally
excluded from automatic playback rather than being mixed with the clean FAAS
channel.

## Current event mapping

- DMR startup: startup alarm effect + selected FAAS startup variant + optional
  reactor-start music.
- High temperature / integrity: matching FAAS warning plus a quiet alarm effect.
- Terminal DMR integrity loss: FAAS evacuation call, implosion effect, then the
  Emergency Alert System / Death aftermath video.
- Maintenance: matching FAAS maintenance call with optional maintenance music.

Future Protocol Saletum, Tartarus, phase-two shutdown, Nightshift, shelter, and
Mannequin scenarios have their matching video assets staged but are not triggered
until those state machines exist.
