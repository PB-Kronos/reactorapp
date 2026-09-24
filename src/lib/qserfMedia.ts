import { useCallback, useEffect, useRef, useState } from "react";

const root = "/audio/qserf/";

export const qserfMusic = {
  startup: { label: "REACTOR START", path: `${root}music/reactor-start.mp3` },
  maintenance: { label: "MAINTENANCE", path: `${root}music/maintenance.mp3` },
  shutdown: { label: "SHUTDOWN", path: `${root}music/shutdown.mp3` },
  meltdownP1: {
    label: "MELTDOWN — PHASE 1",
    path: `${root}music/meltdown.mp3`,
    // The archived original soundtrack contains both phases as one file.
    // These virtual in/out points keep them operationally separate without
    // duplicating the large source asset.
    startAt: 0,
    // Keep the quiet handoff at the end of Phase 1. The previous cut ended
    // before that recorded silence, which made Phase 1 feel abruptly short.
    endAt: 346,
  },
  meltdownP2: {
    label: "MELTDOWN — PHASE 2",
    path: `${root}music/meltdown.mp3`,
    startAt: 346,
    // Use the actual source endpoint as the detonation reference rather than
    // a timestamp estimated from a separate video recording.
  },
  warhead: { label: "WARHEAD", path: `${root}music/warhead.mp3` },
  nightshift: { label: "NIGHTSHIFT", path: `${root}music/nightshift.mp3` },
} as const;

export type QserfMusicKey = keyof typeof qserfMusic;

export const qserfEndings = {
  emergencyDeath: {
    label: "EMERGENCY ALERT SYSTEM / DEATH ENDING",
    path: `${root}endings/emergency-alert-system-death.mp4`,
  },
  fullNightshift: {
    label: "FULL NIGHTSHIFT ENDING",
    path: `${root}endings/full-nightshift.mp4`,
  },
  goodBlastShelter: {
    label: "GOOD BLAST SHELTER ENDING",
    path: `${root}endings/good-blast-shelter.mp4`,
  },
  mannequin: {
    label: "MANNEQUIN ENDING",
    path: `${root}endings/mannequin.mp4`,
  },
  phase2Shutdown: {
    label: "PHASE 2 SHUTDOWN ENDING",
    path: `${root}endings/phase-2-shutdown.mp4`,
  },
  tartarusZone: {
    label: "TARTARUS ZONE ENDING",
    path: `${root}endings/tartarus-zone.mp4`,
  },
  protocolSaletum: {
    label: "PROTOCOL SALETUM ENDING",
    path: `${root}endings/protocol-saletum.mp4`,
  },
  forImmediateBroadcast: {
    label: "FOR IMMEDIATE BROADCAST ENDING",
    path: `${root}endings/for-immediate-broadcast.mp4`,
  },
} as const;

export type QserfEndingKey = keyof typeof qserfEndings;

export const qserfEffects = {
  startupAlarm: {
    id: "dmr-startup-alarm",
    path: `${root}effects/dmr-startup-alarm.mp3`,
    volume: 0.2,
    alarm: true,
  },
  integrityAlarm: {
    id: "integrity-alarm",
    path: `${root}effects/reactor-integrity-alarm.mp3`,
    volume: 0.2,
    alarm: true,
  },
  majorOverheat: {
    id: "major-overheat",
    path: `${root}effects/major-overheat-alarm.mp3`,
    volume: 0.24,
    alarm: true,
  },
  criticalOverheat: {
    id: "critical-overheat",
    path: `${root}effects/critical-overheat-alarm.mp3`,
    volume: 0.28,
    alarm: true,
  },
  codeRed: {
    id: "code-red-alarm",
    path: `${root}effects/code-red-alarm.mp3`,
    volume: 0.3,
    alarm: true,
  },
  codeBlack: {
    id: "code-black-alarm",
    path: `${root}effects/code-black-alarm.mp3`,
    volume: 0.3,
    alarm: true,
  },
  protocolSaletum: {
    id: "protocol-saletum-alarm",
    path: `${root}effects/protocol-saletum-alarm.mp3`,
    volume: 0.3,
    alarm: true,
  },
  warheadDetonationRinging: {
    id: "warhead-detonation-ringing",
    path: `${root}effects/protocol-saletum-alarm.mp3`,
    volume: 0.34,
  },
  combustionStall: {
    id: "combustion-stall",
    path: `${root}effects/combustion-stall.mp3`,
    volume: 0.24,
    alarm: true,
  },
  dmrExplosion: {
    id: "dmr-explosion",
    path: `${root}effects/dmr-explosion.mp3`,
    volume: 0.34,
  },
  foxtrotExplosion: {
    id: "foxtrot-explosion",
    path: `${root}effects/foxtrot-explosion.mp3`,
    volume: 0.32,
  },
} as const;

type Effect = {
  id: string;
  path: string;
  volume: number;
  /** Alarm effects follow the local MUTE ALARMS control; incident effects do not. */
  alarm?: boolean;
};

/**
 * Background music and discrete effects live on separate, operator-controlled
 * buses. They keep their independently configured levels while FAAS speaks.
 * Effects are only available after the same user gesture that arms FAAS audio,
 * preserving browser autoplay rules.
 */
export function useQserfSoundscape(audioArmed: boolean, alarmsMuted = false) {
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicKey, setMusicKey] = useState<QserfMusicKey | null>(null);
  const [musicVolumePercent, setMusicVolumePercent] = useState(20);
  const [musicElapsedSeconds, setMusicElapsedSeconds] = useState(0);
  const [musicDurationSeconds, setMusicDurationSeconds] = useState(0);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const effectRef = useRef<HTMLAudioElement | null>(null);
  const effectVolumeRef = useRef(0);
  const activeEffectIsAlarmRef = useRef(false);
  const lastEffectRef = useRef<Record<string, number>>({});
  const transitionInProgressRef = useRef(false);
  const musicFadeTimersRef = useRef<Set<number>>(new Set());
  const musicGain = Math.min(1, (musicVolumePercent / 100) * 1.5);

  useEffect(() => {
    if (transitionInProgressRef.current) {
      // transitionMusic already owns both audio elements; do not let the
      // declarative music-key effect interrupt the crossfade it just started.
      transitionInProgressRef.current = false;
      return;
    }
    musicRef.current?.pause();
    musicRef.current = null;
    setMusicElapsedSeconds(0);
    setMusicDurationSeconds(0);
    if (!audioArmed || !musicEnabled || !musicKey) return;
    const audio = new Audio(qserfMusic[musicKey].path);
    audio.preload = "auto";
    const track = qserfMusic[musicKey];
    audio.loop =
      track.startAt === undefined && musicKey !== "shutdown";
    audio.volume = musicGain;
    audio.addEventListener("loadedmetadata", () => {
      const startAt = track.startAt ?? 0;
      const endAt = track.endAt ?? audio.duration;
      audio.currentTime = startAt;
      setMusicDurationSeconds(
        Number.isFinite(endAt) ? Math.max(0, endAt - startAt) : 0,
      );
    });
    audio.addEventListener("timeupdate", () => {
      const startAt = track.startAt ?? 0;
      const endAt = track.endAt;
      if (endAt !== undefined && audio.currentTime >= endAt) {
        audio.pause();
        setMusicElapsedSeconds(endAt - startAt);
        return;
      }
      setMusicElapsedSeconds(audio.currentTime - startAt);
    });
    audio.addEventListener("ended", () => setMusicElapsedSeconds(audio.duration));
    musicRef.current = audio;
    void audio.play().catch(() => undefined);
    return () => {
      if (transitionInProgressRef.current) return;
      audio.pause();
      if (musicRef.current === audio) musicRef.current = null;
    };
  }, [audioArmed, musicEnabled, musicKey]);

  const transitionMusic = useCallback(
    (nextKey: QserfMusicKey, durationMs = 5_000) => {
      if (!audioArmed || !musicEnabled || musicKey === nextKey) {
        setMusicKey(nextKey);
        return false;
      }
      const outgoing = musicRef.current;
      const incoming = new Audio(qserfMusic[nextKey].path);
      incoming.preload = "auto";
      const track = qserfMusic[nextKey];
      incoming.loop = track.startAt === undefined && nextKey !== "shutdown";
      incoming.volume = 0;
      incoming.addEventListener("loadedmetadata", () => {
        const startAt = track.startAt ?? 0;
        const endAt = track.endAt ?? incoming.duration;
        incoming.currentTime = startAt;
        setMusicDurationSeconds(
          Number.isFinite(endAt) ? Math.max(0, endAt - startAt) : 0,
        );
      });
      incoming.addEventListener("timeupdate", () => {
        const startAt = track.startAt ?? 0;
        const endAt = track.endAt;
        if (endAt !== undefined && incoming.currentTime >= endAt) {
          incoming.pause();
          setMusicElapsedSeconds(endAt - startAt);
          return;
        }
        setMusicElapsedSeconds(incoming.currentTime - startAt);
      });
      incoming.addEventListener("ended", () =>
        setMusicElapsedSeconds(incoming.duration),
      );
      transitionInProgressRef.current = true;
      musicRef.current = incoming;
      setMusicElapsedSeconds(0);
      setMusicKey(nextKey);
      void incoming.play().catch(() => undefined);
      const steps = Math.max(1, Math.round(durationMs / 50));
      const outgoingVolume = outgoing?.volume ?? 0;
      let step = 0;
      const timer = window.setInterval(() => {
        step += 1;
        const progress = Math.min(1, step / steps);
        incoming.volume = musicGain * progress;
        if (outgoing) outgoing.volume = outgoingVolume * (1 - progress);
        if (progress < 1) return;
        window.clearInterval(timer);
        musicFadeTimersRef.current.delete(timer);
        outgoing?.pause();
      }, 50);
      musicFadeTimersRef.current.add(timer);
      return true;
    },
    [audioArmed, musicEnabled, musicGain, musicKey],
  );

  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = musicGain;
    if (effectRef.current) effectRef.current.volume = effectVolumeRef.current;
  }, [musicGain]);

  useEffect(() => {
    if (audioArmed) return;
    musicRef.current?.pause();
    effectRef.current?.pause();
    setActiveEffect(null);
  }, [audioArmed]);

  useEffect(() => {
    if (!alarmsMuted || !activeEffectIsAlarmRef.current) return;
    // Alarm silence must stop an already-playing local effect as well as block
    // future warning effects. FAAS voice traffic has its own equivalent gate.
    effectRef.current?.pause();
    effectRef.current = null;
    activeEffectIsAlarmRef.current = false;
    setActiveEffect(null);
  }, [alarmsMuted]);

  const playEffect = useCallback(
    (effect: Effect, cooldownMs = 12_000) => {
      if (!audioArmed) return false;
      if (alarmsMuted && effect.alarm) return false;
      const now = Date.now();
      if (now - (lastEffectRef.current[effect.id] ?? 0) < cooldownMs)
        return false;
      lastEffectRef.current[effect.id] = now;
      effectRef.current?.pause();
      const audio = new Audio(effect.path);
      audio.preload = "auto";
      effectVolumeRef.current = effect.volume;
      activeEffectIsAlarmRef.current = Boolean(effect.alarm);
      audio.volume = effect.volume;
      effectRef.current = audio;
      setActiveEffect(effect.id);
      const finish = () => {
        if (effectRef.current === audio) {
          effectRef.current = null;
          activeEffectIsAlarmRef.current = false;
          setActiveEffect(null);
        }
      };
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      void audio.play().catch(finish);
      return true;
    },
    [alarmsMuted, audioArmed],
  );

  const stopSoundscape = useCallback(() => {
    musicFadeTimersRef.current.forEach((timer) => window.clearInterval(timer));
    musicFadeTimersRef.current.clear();
    musicRef.current?.pause();
    effectRef.current?.pause();
    musicRef.current = null;
    effectRef.current = null;
    activeEffectIsAlarmRef.current = false;
    setMusicEnabled(false);
    setMusicKey(null);
    setMusicElapsedSeconds(0);
    setMusicDurationSeconds(0);
    setActiveEffect(null);
  }, []);

  /** Fade the active music bed without cutting it off at the transition frame. */
  const fadeOutMusic = useCallback((durationMs = 3_000) => {
    const outgoing = musicRef.current;
    if (!outgoing) {
      setMusicEnabled(false);
      setMusicKey(null);
      return;
    }
    musicFadeTimersRef.current.forEach((timer) => window.clearInterval(timer));
    musicFadeTimersRef.current.clear();
    const originalVolume = outgoing.volume;
    const steps = Math.max(1, Math.round(durationMs / 50));
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      outgoing.volume = originalVolume * Math.max(0, 1 - step / steps);
      if (step < steps) return;
      window.clearInterval(timer);
      musicFadeTimersRef.current.delete(timer);
      outgoing.pause();
      if (musicRef.current === outgoing) musicRef.current = null;
      setMusicEnabled(false);
      setMusicKey(null);
      setMusicElapsedSeconds(0);
      setMusicDurationSeconds(0);
    }, 50);
    musicFadeTimersRef.current.add(timer);
  }, []);

  useEffect(() => () => stopSoundscape(), [stopSoundscape]);

  return {
    musicEnabled,
    setMusicEnabled,
    musicKey,
    setMusicKey,
    musicVolumePercent,
    setMusicVolumePercent,
    musicElapsedSeconds,
    musicDurationSeconds,
    transitionMusic,
    fadeOutMusic,
    activeEffect,
    playEffect,
    stopSoundscape,
  };
}
