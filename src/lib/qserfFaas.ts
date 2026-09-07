import { useCallback, useEffect, useRef, useState } from "react";

export type FaasPriority = "ambient" | "normal" | "warning" | "emergency";

export type FaasClip = {
  id: string;
  relativePath: string;
  priority?: FaasPriority;
  /** Local annunciator silence applies only to explicitly classified alarms. */
  alarm?: boolean;
};

const priorityValue: Record<FaasPriority, number> = {
  ambient: 0,
  normal: 1,
  warning: 2,
  emergency: 3,
};

const root = "/audio/qserf/faas/";
const clip = (
  id: string,
  relativePath: string,
  priority: FaasPriority = "normal",
  alarm = false,
): FaasClip => ({ id, relativePath, priority, alarm });

const humanAnnouncementPaths = [
  "01_intercom_accident",
  "02_report_inspectors_to_supervisor",
  "03_weekly_DMR_report_due_midnight",
  "04_trash_bins_are_not_toilets",
  "05_security_stop_shooting_control_room",
  "06_security_stay_vigilant",
  "07_employee_bathroom_needs_sink",
  "08_reactor_team_stay_alert_and_energized",
  "09_stop_replacing_my_pens",
  "10_reactor_alertness_interrupted",
  "11_incident_reports_due_midnight",
  "12_missing_lunch_threat",
  "13_not_a_daycare_facility",
  "14_five_days_accident_free",
  "15_sector_B_problem_call_Dr_Peterson",
  "16_exhausted_reactor_operators_report_supervisor",
  "17_lunch_found_Dr_Kyle_no_longer_works_here",
  "18_receptionist_transfer_control_station_11",
  "19_doctors_report_control_station_06",
  "20_security_report_control_station_01",
  "21_maintenance_report_pump_station_alpha",
  "22_stolen_coca_cola_bottle",
  "23_coca_cola_found_call_janitorial",
] as const;

const contextlessAnnouncementPaths = [
  "ALT_01_intercom_accident",
  "ALT_02_stop_replacing_my_pens",
  "ALT_03_reactor_team_stay_alert",
  "ALT_04_reactor_alertness_interrupted",
  "ALT_05_not_a_daycare_facility",
  "ALT_06_sector_B_problem",
  "ALT_07_stolen_coca_cola_bottle",
] as const;

const alt08Followup = clip(
  "ambient-alt-08-coca-cola-followup",
  "09_Contextless_Alternate_Versions/ALT_08_coca_cola_found_call_janitorial.mp3",
  "ambient",
);

const randomAmbientAnnouncements: readonly FaasClip[] = [
  ...humanAnnouncementPaths.map((name) =>
    clip(
      "ambient-human-" + name,
      `08_Human_Announcements/${name}.mp3`,
      "ambient",
    ),
  ),
  ...contextlessAnnouncementPaths.map((name) =>
    clip(
      "ambient-contextless-" + name,
      `09_Contextless_Alternate_Versions/${name}.mp3`,
      "ambient",
    ),
  ),
];

export const chooseAmbientAnnouncement = () => {
  const lead =
    randomAmbientAnnouncements[
      Math.floor(Math.random() * randomAmbientAnnouncements.length)
    ];
  return {
    lead,
    // ALT_08 is deliberately excluded from the random pool. It only supplies
    // the janitorial follow-up after the ALT_07 stolen-cola announcement.
    followup:
      lead.id === "ambient-contextless-ALT_07_stolen_coca_cola_bottle"
        ? alt08Followup
        : null,
  };
};

// Paths use the handoff manifest's stable relative_path values. The complete
// manifest is also deployed alongside the clips for future trigger expansion.
export const faasClips = {
  startupA: [
    clip(
      "startup-a-1",
      "01_Startup_Sequence/STARTUP_BEGIN_A_01_sequence_initiated.mp3",
    ),
    clip(
      "startup-a-2",
      "01_Startup_Sequence/STARTUP_BEGIN_A_02_vacate_immediately.mp3",
    ),
  ],
  startupB: [
    clip(
      "startup-b",
      "01_Startup_Sequence/STARTUP_BEGIN_B_ignition_initialized_vacate_at_this_time.mp3",
    ),
  ],
  gravitationalLasers: clip(
    "gravity-lasers",
    "01_Startup_Sequence/GRAVITATIONAL_LASERS_ONLINE.mp3",
  ),
  superstructureRaising: clip(
    "superstructure-raising",
    "01_Startup_Sequence/SUPERSTRUCTURE_RAISING.mp3",
  ),
  superstructureCentered: clip(
    "superstructure-centered",
    "01_Startup_Sequence/SUPERSTRUCTURE_CENTERED.mp3",
  ),
  powerLasersActivating: clip(
    "power-lasers-activating",
    "01_Startup_Sequence/POWER_LASERS_ACTIVATING.mp3",
  ),
  powerLasersOnline: clip(
    "power-lasers-online",
    "01_Startup_Sequence/POWER_LASERS_ONLINE.mp3",
  ),
  combustionIntake: clip(
    "combustion-intake",
    "01_Startup_Sequence/COMBUSTION_INTAKE_OPENING.mp3",
  ),
  reactorOnline: [
    clip("startup-complete", "01_Startup_Sequence/STARTUP_COMPLETED.mp3"),
    clip("reactor-core-online", "01_Startup_Sequence/REACTOR_CORE_ONLINE.mp3"),
  ],
  // The supplied catalog has no dedicated sustainability line. Keep this as
  // the neutral FAAS warning chime; the simulator panel provides the full
  // source-faithful wording and recovery instruction.
  combustionSustainability: clip(
    "combustion-sustainability-warning",
    "07_Facility_System/09_warning.mp3",
    "warning",
    true,
  ),
  combustionStalled: clip(
    "combustion-stalled-blackout",
    "07_Facility_System/05_reactor_controls_unresponsive.mp3",
    "warning",
    true,
  ),
  coreTemperature: clip(
    "core-temperature",
    "02_Reactor_Warnings/TEMP_01_core_temperature_outside_safe_parameters.mp3",
    "warning", true,
  ),
  coreTemperatureHigh: clip(
    "core-temperature-high",
    "02_Reactor_Warnings/TEMP_02_core_temperatures_exceeding_safe_levels.mp3",
    "warning", true,
  ),
  integrity75: clip(
    "integrity-75",
    "02_Reactor_Warnings/STRUCT_01_integrity_75_percent.mp3",
    "warning", true,
  ),
  integrity50: clip(
    "integrity-50",
    "02_Reactor_Warnings/STRUCT_02_integrity_50_percent.mp3",
    "warning", true,
  ),
  integrity25: clip(
    "integrity-25",
    "02_Reactor_Warnings/STRUCT_03_integrity_25_percent.mp3",
    "emergency", true,
  ),
  integrityDanger: clip(
    "integrity-danger",
    "02_Reactor_Warnings/STRUCT_04_integrity_dropping_engage_thermal.mp3",
    "emergency", true,
  ),
  maintenanceEntered: clip(
    "maintenance-entered",
    "03_Maintenance/STATE_maintenance_mode_entered.mp3",
  ),
  maintenanceComplete: clip(
    "maintenance-complete",
    "03_Maintenance/STATE_maintenance_completed_restart.mp3",
  ),
  fuelLow: clip(
    "fuel-low",
    "03_Maintenance/FUEL_02_fuel_cell_capacity_low.mp3",
    "warning", true,
  ),
  fuelDepleted: clip(
    "fuel-depleted",
    "03_Maintenance/FUEL_03_fuel_cells_depleted_replace_immediately.mp3",
    "warning", true,
  ),
  replacementRequired: clip(
    "fuel-replacement-required",
    "03_Maintenance/02_fuel_capsule_replacement_required.mp3",
    "warning",
  ),
  replacementComplete: clip(
    "fuel-replacement-complete",
    "03_Maintenance/03_fuel_capsule_replacement_completed.mp3",
  ),
  fuelLocked: [
    clip(
      "fuel-1-locked",
      "03_Maintenance/Combined_Status/fuel_cell_1_locked.mp3",
    ),
    clip(
      "fuel-2-locked",
      "03_Maintenance/Combined_Status/fuel_cell_2_locked.mp3",
    ),
    clip(
      "fuel-3-locked",
      "03_Maintenance/Combined_Status/fuel_cell_3_locked.mp3",
    ),
  ],
  fuelUnlocked: [
    clip(
      "fuel-1-unlocked",
      "03_Maintenance/Combined_Status/fuel_cell_1_unlocked.mp3",
    ),
    clip(
      "fuel-2-unlocked",
      "03_Maintenance/Combined_Status/fuel_cell_2_unlocked.mp3",
    ),
    clip(
      "fuel-3-unlocked",
      "03_Maintenance/Combined_Status/fuel_cell_3_unlocked.mp3",
    ),
  ],
  emergencyEvacuate: clip(
    "emergency-evacuate",
    "04_Emergency/02_reactor_operations_evacuate_immediately.mp3",
    "emergency",
  ),
  codeRed: clip(
    "code-red",
    "04_Emergency/09_code_red_override_evacuate_not_a_drill.mp3",
    "emergency",
  ),
  warheadPrimed: clip(
    "warhead-primed",
    "05_Warhead/TRIGGER_WARHEAD_PRIMED_READY.mp3",
    "emergency",
  ),
  protocolSaletumActivated: clip(
    "protocol-saletum-activated",
    "05_Warhead/TRIGGER_PROTOCOL_ACTIVATED.mp3",
    "emergency",
  ),
  warheadPrimingStarted: clip(
    "warhead-priming-started",
    "05_Warhead/TRIGGER_PRIMING_STARTED_T40.mp3",
    "emergency",
  ),
  warheadDetonationAuthorized: clip(
    "warhead-detonation-authorized",
    "05_Warhead/TRIGGER_DETONATION_AUTHORIZED.mp3",
    "emergency",
  ),
  warheadTimer200: clip(
    "warhead-timer-200",
    "05_Warhead/TRIGGER_TIMER_T200.mp3",
    "emergency",
  ),
  warheadTimer60: clip(
    "warhead-timer-60",
    "05_Warhead/TRIGGER_TIMER_T60.mp3",
    "emergency",
  ),
  warheadTimer30: clip(
    "warhead-timer-30",
    "05_Warhead/TRIGGER_TIMER_T30_FULL_COUNTDOWN.mp3",
    "emergency",
  ),
  warheadCancelled: clip(
    "warhead-cancelled",
    "05_Warhead/TRIGGER_WARHEAD_CANCELLED.mp3",
    "warning",
  ),
  meltdown10: clip(
    "meltdown-10",
    "06_Meltdown/TRIGGER_TIMER_T10_explosion_warning.mp3",
    "emergency",
  ),
  meltdown5: clip(
    "meltdown-5",
    "06_Meltdown/TRIGGER_TIMER_T5_explosion_warning.mp3",
    "emergency",
  ),
  meltdown2: clip(
    "meltdown-2",
    "06_Meltdown/TRIGGER_TIMER_T2_explosion_warning.mp3",
    "emergency",
  ),
  meltdown1: clip(
    "meltdown-1",
    "06_Meltdown/TRIGGER_TIMER_T1_explosion_warning.mp3",
    "emergency",
  ),
  meltdownInstability: clip(
    "meltdown-instability",
    "06_Meltdown/FAILURE_03_instability_power_fluctuations.mp3",
    "emergency",
  ),
  integrityMonitorFailed: clip(
    "integrity-monitor-failed",
    "06_Meltdown/FAILURE_02_integrity_monitor_reboot_failure_unknown.mp3",
    "emergency",
  ),
  integrityMonitorNoData: clip(
    "integrity-monitor-no-data",
    "06_Meltdown/FAILURE_05_pressure_monitor_failure_status_unknown.mp3",
    "emergency",
  ),
  shutdownAttemptWarning: clip(
    "shutdown-attempt-warning",
    "04_Emergency/08_operations_attempt_shutdown_only_warning.mp3",
    "emergency",
  ),
  phase1TemperatureRequirement: clip(
    "phase-1-temperature-requirement",
    "06_Meltdown/TRIGGER_SHUTDOWN_TEMPERATURE_REQUIREMENT.mp3",
    "emergency",
  ),
  // Phase 2 is the improvised, last-chance combustion-stall route. This
  // announcement is played only after Code Black when the hatch can be used.
  phase2Available: clip(
    "phase-2-available",
    "04_Emergency/10_last_chance_combustion_stall_instructions.mp3",
    "emergency",
  ),
  // The source announcement covers the alternative outcome: no usable manual
  // shutdown route remains, so personnel must continue evacuating.
  phase2Unavailable: clip(
    "phase-2-unavailable",
    "07_Facility_System/18_emergency_shutdown_failure_keep_evacuating.mp3",
    "emergency",
  ),
  phase2ShutdownInProgress: clip(
    "phase-2-shutdown-in-progress",
    "06_Meltdown/RECOVERY_01_fuel_ejected_combustion_stalled.mp3",
    "emergency",
  ),
  phase2Lowering: clip(
    "phase-2-lowering",
    "06_Meltdown/RECOVERY_02_lowering_superstructure_for_maintenance.mp3",
    "emergency",
  ),
  scientificEvacuation: clip(
    "scientific-evacuation",
    "04_Emergency/05_scientific_personnel_11_minute_evacuation.mp3",
    "emergency",
  ),
  codeBlack: clip(
    "code-black",
    "07_Facility_System/02_code_black_evacuate_tartarus.mp3",
    "emergency",
  ),
  phase1Window: clip(
    "phase-1-window",
    "06_Meltdown/TRIGGER_SHUTDOWN_OPTION_NOW_ACTIVE.mp3",
    "emergency",
  ),
  phase1Deadline: clip(
    "phase-1-deadline",
    "06_Meltdown/TRIGGER_SHUTDOWN_DEADLINE_T5.mp3",
    "emergency",
  ),
  phase1Expired: clip(
    "phase-1-expired",
    "06_Meltdown/TRIGGER_SHUTDOWN_EXPIRED_ESTIMATING_DESTRUCTION.mp3",
    "emergency",
  ),
  seekShelter: clip(
    "seek-shelter",
    "07_Facility_System/11_seek_shelter_or_evacuate.mp3",
    "emergency",
  ),
  nearestShelter: clip(
    "nearest-shelter",
    "07_Facility_System/15_proceed_to_nearest_shelter.mp3",
    "emergency",
  ),
  tartarusZone: clip(
    "tartarus-zone",
    "07_Facility_System/Locations/tartarus_zone.mp3",
    "emergency",
  ),
  blastShelterMinute: clip(
    "blast-shelter-minute",
    "04_Emergency/BLAST_01_closing_in_1_minute_lockdown.mp3",
    "emergency",
  ),
  blastShelterThirty: clip(
    "blast-shelter-thirty",
    "04_Emergency/BLAST_02_closing_in_30_seconds.mp3",
    "emergency",
  ),
  blastShelterTen: clip(
    "blast-shelter-ten",
    "04_Emergency/BLAST_03_closing_in_10_seconds.mp3",
    "emergency",
  ),
  blastDoorsClosing: clip(
    "blast-doors-closing",
    "04_Emergency/BLAST_04_doors_closing_stand_clear.mp3",
    "emergency",
  ),
  codeOmni: clip(
    "code-omni",
    "07_Facility_System/21_code_omni_issued.mp3",
    "emergency",
  ),
  meltdownEvacuate: clip(
    "meltdown-evacuate",
    "06_Meltdown/FAILURE_07_evacuate_immediately.mp3",
    "emergency",
  ),
  shutdownSucceeded: clip(
    "shutdown-succeeded",
    "06_Meltdown/RECOVERY_05_shutdown_successful_crisis_averted.mp3",
    "emergency",
  ),
  humanAlert: clip(
    "human-alert",
    "08_Human_Announcements/08_reactor_team_stay_alert_and_energized.mp3",
    "ambient",
  ),
} as const;

type QueueItem = FaasClip & { priority: FaasPriority };

/**
 * A one-at-a-time announcement queue. Emergency traffic interrupts the active
 * lower-priority call; normal traffic follows it. Browser autoplay policy is
 * respected: callers must first press the Enable Audio control.
 */
export function useFaasAudio() {
  const [enabled, setEnabledState] = useState(false);
  // Keep this in sync immediately, rather than only after React has rendered
  // the state update. Critical console actions may arm audio and issue their
  // first announcement in the same user gesture.
  const enabledRef = useRef(false);
  const setEnabled = useCallback((next: boolean) => {
    enabledRef.current = next;
    setEnabledState(next);
  }, []);
  // The panel's 0–100 control maps to a deliberately capped 0–50% output.
  const [volumePercent, setVolumePercent] = useState(100);
  const [alarmsMuted, setAlarmsMutedState] = useState(false);
  const [currentClip, setCurrentClip] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentPriorityRef = useRef<FaasPriority | null>(null);
  const currentAlarmRef = useRef(false);
  const queueRef = useRef<QueueItem[]>([]);
  const lastPlayedRef = useRef<Record<string, number>>({});
  const advanceRef = useRef<() => void>(() => undefined);
  const alarmsMutedRef = useRef(false);

  const advance = useCallback(() => {
    if (audioRef.current || !enabledRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      setCurrentClip(null);
      return;
    }
    const audio = new Audio(`${root}${next.relativePath}`);
    audio.preload = "auto";
    audio.volume = volumePercent / 200;
    audioRef.current = audio;
    currentPriorityRef.current = next.priority;
    currentAlarmRef.current = Boolean(next.alarm);
    setCurrentClip(next.id);
    const finish = () => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      currentPriorityRef.current = null;
      currentAlarmRef.current = false;
      setCurrentClip(null);
      advanceRef.current();
    };
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
    void audio.play().catch(finish);
  }, [volumePercent]);

  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volumePercent / 200;
  }, [volumePercent]);

  const setAlarmsMuted = useCallback((muted: boolean) => {
    alarmsMutedRef.current = muted;
    setAlarmsMutedState(muted);
    if (!muted) return;
    // Silence only explicitly classified annunciator traffic. Meltdown PA
    // calls may use emergency priority but are not local alarms.
    queueRef.current = queueRef.current.filter(
      (item) => !item.alarm,
    );
    if (
      audioRef.current &&
      currentAlarmRef.current
    ) {
      audioRef.current.pause();
      audioRef.current = null;
      currentPriorityRef.current = null;
      currentAlarmRef.current = false;
      setCurrentClip(null);
      window.setTimeout(() => advanceRef.current(), 0);
    }
  }, []);

  const play = useCallback(
    (input: FaasClip | readonly FaasClip[], cooldownMs = 9000) => {
      if (!enabledRef.current) return false;
      const clips = Array.isArray(input) ? input : [input];
      const now = Date.now();
      const nextItems = clips.filter((item) => {
        if (
          alarmsMutedRef.current &&
          item.alarm
        ) {
          return false;
        }
        const last = lastPlayedRef.current[item.id] ?? 0;
        if (now - last < cooldownMs) return false;
        lastPlayedRef.current[item.id] = now;
        return true;
      }) as FaasClip[];
      if (!nextItems.length) return false;
      const top = nextItems[0];
      const priority = top.priority ?? "normal";
      const activePriority = currentPriorityRef.current;
      if (
        audioRef.current &&
        activePriority &&
        priorityValue[priority] > priorityValue[activePriority]
      ) {
        audioRef.current.pause();
        audioRef.current = null;
        currentPriorityRef.current = null;
        currentAlarmRef.current = false;
      }
      queueRef.current.push(
        ...nextItems.map((item) => ({
          ...item,
          priority: item.priority ?? "normal",
        })),
      );
      queueRef.current.sort(
        (left, right) =>
          priorityValue[right.priority] - priorityValue[left.priority],
      );
      advanceRef.current();
      return true;
    },
    [],
  );

  const stop = useCallback(() => {
    queueRef.current = [];
    audioRef.current?.pause();
    audioRef.current = null;
    currentPriorityRef.current = null;
    currentAlarmRef.current = false;
    setCurrentClip(null);
  }, []);

  const delayedTimersRef = useRef<Set<number>>(new Set());
  const playAfterDelay = useCallback(
    (
      input: FaasClip | readonly FaasClip[],
      delayMs: number,
      cooldownMs = 9000,
    ) => {
      if (!enabledRef.current) return false;
      const timer = window.setTimeout(() => {
        delayedTimersRef.current.delete(timer);
        play(input, cooldownMs);
      }, delayMs);
      delayedTimersRef.current.add(timer);
      return true;
    },
    [play],
  );

  const stopWithDelayedTraffic = useCallback(() => {
    delayedTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    delayedTimersRef.current.clear();
    stop();
  }, [stop]);

  useEffect(() => () => stopWithDelayedTraffic(), [stopWithDelayedTraffic]);

  return {
    enabled,
    setEnabled,
    volumePercent,
    setVolumePercent,
    alarmsMuted,
    setAlarmsMuted,
    currentClip,
    play,
    playAfterDelay,
    stop: stopWithDelayedTraffic,
  };
}
