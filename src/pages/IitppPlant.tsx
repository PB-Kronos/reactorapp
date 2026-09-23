import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Radio, ShieldAlert, Siren } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

type Announcement = {
  id: string;
  kind: "normal" | "alert";
  text: string;
};

type PowerLaserMode = "OFF" | "LOW" | "REG" | "MAX" | "DESTROYED";
type FanSpeed = "OFF" | "SLOW" | "REGULAR" | "FAST";
type RingMode = "LOW" | "NORMAL" | "HIGH";
type SafeguardStage = "IDLE" | "SEQUENCING" | "ACTIVE" | "FAILED";

const announcements: Record<string, Announcement> = {
  startup: {
    id: "startup",
    kind: "normal",
    text: "Reactor startup complete. Core systems are operating within nominal parameters.",
  },
  cold: {
    id: "cold",
    kind: "alert",
    text: "Warning. Core temperatures critically low. Operations at low temperatures may damage reactor core equipment.",
  },
  safeguard: {
    id: "safeguard",
    kind: "alert",
    text: "Attention. Reactor core temperature is approaching critical conditions. Safeguard sequence is available.",
  },
  meltdown: {
    id: "meltdown",
    kind: "alert",
    text: "Extreme danger. The reactor has reached 4,500 Kelvin. An automatic Code Red directive has been issued.",
  },
  generatorFire: {
    id: "generatorFire",
    kind: "alert",
    text: "Attention. Thermal generator fire detected. Facility control, activate fire suppression immediately.",
  },
  ambientTransit: {
    id: "ambientTransit",
    kind: "normal",
    text: "Facility transit notice. Use the secured rail lines only for their designated access areas.",
  },
  ambientMaintenance: {
    id: "ambientMaintenance",
    kind: "normal",
    text: "Maintenance team blue, verify heat-exchange coolant inventory at the next inspection point.",
  },
  ambientSecurity: {
    id: "ambientSecurity",
    kind: "normal",
    text: "All facility personnel and visitors must carry valid identification in restricted areas.",
  },
  ambientMedical: {
    id: "ambientMedical",
    kind: "normal",
    text: "Personnel experiencing illness or equipment exposure should report to the nearest medical station.",
  },
  ambientLogistics: {
    id: "ambientLogistics",
    kind: "normal",
    text: "Materials handling notice. Cargo transit has cleared the warehouse route.",
  },
  ambientSafety: {
    id: "ambientSafety",
    kind: "normal",
    text: "Facility safety reminder. Report damaged equipment to security or maintenance without delay.",
  },
  ambientComms: {
    id: "ambientComms",
    kind: "normal",
    text: "Communications relay check complete. Routine facility data traffic is operating normally.",
  },
  ambientRecruitment: {
    id: "ambientRecruitment",
    kind: "normal",
    text: "Innovation security recruitment remains open. Contact personnel services for assignment information.",
  },
};

const ambientAnnouncementIds = [
  "ambientTransit",
  "ambientMaintenance",
  "ambientSecurity",
  "ambientMedical",
  "ambientLogistics",
  "ambientSafety",
  "ambientComms",
  "ambientRecruitment",
] as const;

// When the clean official downloads are copied into public/audio, they take
// precedence over the browser speech fallback without changing event logic.
const announcementAssets: Partial<Record<keyof typeof announcements, string>> =
  {
    startup: "/audio/iitpp/announcements/startup-complete.mp3",
    cold: "/audio/iitpp/announcements/freezedown-warning.mp3",
    safeguard: "/audio/iitpp/announcements/safeguard-available.mp3",
    meltdown: "/audio/iitpp/announcements/meltdown-code-red.mp3",
    generatorFire: "/audio/iitpp/announcements/generator-fire.mp3",
  };

const Meter = ({
  label,
  value,
  unit,
  tone = "text-cyan-200",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: string;
}) => (
  <div className="rounded border border-slate-700 bg-black/45 p-3">
    <p className="text-[10px] font-black tracking-[.13em] text-slate-400">
      {label}
    </p>
    <p className={`mt-1 text-2xl font-black ${tone}`}>
      {value}
      {unit && <span className="ml-1 text-sm">{unit}</span>}
    </p>
  </div>
);

export default function IitppPlant() {
  const [facilityPower, setFacilityPower] = useState(false);
  const [primer, setPrimer] = useState(false);
  const [coolantPumps, setCoolantPumps] = useState([false, false]);
  const [stabilizer, setStabilizer] = useState(false);
  const [crystalRaised, setCrystalRaised] = useState(false);
  const [ringOnline, setRingOnline] = useState(false);
  const [powerLasers, setPowerLasers] = useState<PowerLaserMode[]>([
    "OFF",
    "OFF",
    "OFF",
    "OFF",
  ]);
  const [overloadedLasers, setOverloadedLasers] = useState([
    false,
    false,
    false,
    false,
  ]);
  const [coolantLasers, setCoolantLasers] = useState([false, false, false]);
  const [fanSpeed, setFanSpeed] = useState<FanSpeed>("REGULAR");
  const [ringMode, setRingMode] = useState<RingMode>("NORMAL");
  const [online, setOnline] = useState(false);
  const [temperature, setTemperature] = useState(293);
  const [output, setOutput] = useState(0);
  const [safeguard, setSafeguard] = useState(false);
  const [safeguardCoreKey, setSafeguardCoreKey] = useState(false);
  const [safeguardFacilityKey, setSafeguardFacilityKey] = useState(false);
  const [safeguardStage, setSafeguardStage] = useState<SafeguardStage>("IDLE");
  const [generatorFire, setGeneratorFire] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [officialPaOpen, setOfficialPaOpen] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<Announcement | null>(null);
  const [paAudioEnabled, setPaAudioEnabled] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const announcementAudio = useRef<HTMLAudioElement | null>(null);
  const lastAnnouncement = useRef<string | null>(null);
  const playHtAudioUrlCache = useRef<Record<string, string>>({});
  const lastAmbientAnnouncement = useRef<string | null>(null);

  const alphaPumpOnline = coolantPumps[0];
  const betaPumpOnline = coolantPumps[1];
  const coolantCount = coolantPumps.filter(Boolean).length;
  const laserCount = powerLasers.filter((mode) => mode !== "OFF" && mode !== "DESTROYED").length;
  const coolantLaserCount = coolantLasers.filter(Boolean).length;
  const startupReady =
    facilityPower &&
    primer &&
    alphaPumpOnline &&
    stabilizer &&
    crystalRaised &&
    ringOnline &&
    laserCount === 4 &&
    coolantLaserCount === 3;
  const status = !online
    ? "OFFLINE"
    : temperature < 500
      ? "FREEZEDOWN RISK"
      : temperature < 3500
        ? temperature < 750
          ? "LOW ENERGY"
          : "NOMINAL"
        : temperature < 4500
          ? "SAFEGUARD WINDOW"
          : "MELTDOWN";
  const safeguardRisk =
    temperature < 3500 || temperature >= 4500
      ? null
      : temperature < 3850
        ? 0
        : temperature < 4200
          ? 4
          : 12;

  const soundChime = (priority: Announcement["kind"]) => {
    const context = audioContext.current;
    if (!context || context.state !== "running") return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = priority === "alert" ? 330 : 740;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.26);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.27);
  };
  const powerLaserHeat = powerLasers.reduce(
    (total, mode) =>
      total + (mode === "LOW" ? 1 : mode === "REG" ? 2 : mode === "MAX" ? 3 : 0),
    0,
  );
  const fanCooling =
    fanSpeed === "SLOW" ? 3 : fanSpeed === "REGULAR" ? 6 : fanSpeed === "FAST" ? 8 : 0;
  const ringRiskMultiplier = (rawDelta: number) => {
    if (!ringOnline) return rawDelta;
    const movingTowardHighEvent = temperature >= 3000 && rawDelta > 0;
    const movingTowardLowEvent = temperature <= 500 && rawDelta < 0;
    if (!movingTowardHighEvent && !movingTowardLowEvent) return rawDelta;
    if (ringMode === "HIGH") return rawDelta * 0.6;
    if (ringMode === "LOW") return rawDelta * 1.3;
    return rawDelta;
  };
  const announce = (id: keyof typeof announcements, force = false) => {
    const announcement = announcements[id];
    setActiveAnnouncement(announcement);
    if (!paAudioEnabled || (!force && lastAnnouncement.current === id)) return;
    lastAnnouncement.current = id;
    soundChime(announcement.kind);
    const speakFallback = () => {
      const utterance = new SpeechSynthesisUtterance(announcement.text);
      utterance.rate = announcement.kind === "alert" ? 0.91 : 0.97;
      utterance.pitch = announcement.kind === "alert" ? 0.78 : 0.9;
      utterance.volume = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };
    const playAudioUrl = (url: string, onFailure: () => void) => {
      announcementAudio.current?.pause();
      const audio = new Audio(url);
      audio.volume = 0.9;
      announcementAudio.current = audio;
      audio.addEventListener("error", onFailure, { once: true });
      void audio.play().catch(onFailure);
    };
    const playBundledFallback = () => {
      const asset = announcementAssets[id];
      if (!asset) {
        speakFallback();
        return;
      }
      playAudioUrl(asset, speakFallback);
    };
    const playPlayHt = async () => {
      const cachedUrl = playHtAudioUrlCache.current[id];
      if (cachedUrl) {
        playAudioUrl(cachedUrl, playBundledFallback);
        return;
      }
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: announcement.text }),
        });
        if (!response.ok) throw new Error("PlayHT synthesis unavailable");
        const audio = await response.blob();
        if (!audio.size || !audio.type.startsWith("audio/")) {
          throw new Error("PlayHT returned no audio");
        }
        const audioUrl = URL.createObjectURL(audio);
        playHtAudioUrlCache.current[id] = audioUrl;
        playAudioUrl(audioUrl, playBundledFallback);
      } catch {
        playBundledFallback();
      }
    };
    window.setTimeout(
      () => {
        void playPlayHt();
      },
      announcement.kind === "alert" ? 340 : 120,
    );
  };
  const enablePaAudio = async () => {
    audioContext.current ??= new AudioContext();
    await audioContext.current.resume();
    setPaAudioEnabled(true);
    soundChime("normal");
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!online) return;
      // IITPP's core has a temperature-dependent natural heating rate. The
      // lasers and cooling controls then move that rate; they do not set a
      // fixed target temperature.
      const naturalHeating =
        temperature < 1000 ? 5 : temperature < 2000 ? 3 : temperature < 3000 ? 4 : temperature < 3500 ? 5 : 16;
      const lowEnergyHeating = temperature < 500 ? 2 : naturalHeating;
      const cooling =
        fanCooling +
        (alphaPumpOnline ? coolantLaserCount * 10 : 0);
      const rawDelta = lowEnergyHeating + powerLaserHeat - cooling;
      const stabilizedDelta = ringRiskMultiplier(rawDelta);
      const safeguardCooling = safeguard ? 130 : 0;
      setTemperature((current) =>
        clamp(
          current + (stabilizedDelta - safeguardCooling) * 0.5,
          0,
          6000,
        ),
      );
      setOutput(() => {
        if (safeguard) return 0;
        if (temperature <= 100) return 0;
        if (temperature < 500) return 5 + ((temperature - 100) / 400) * 10;
        if (temperature >= 4500) return clamp(500 + (temperature - 4500) * 0.27, 500, 900);
        if (temperature < 750) return 15 + ((temperature - 500) / 250) * 45;
        return clamp(60 + ((temperature - 750) / 2250) * 15, 60, 75);
      });
    }, 500);
    return () => window.clearInterval(interval);
  }, [
    online,
    powerLaserHeat,
    alphaPumpOnline,
    coolantLaserCount,
    fanCooling,
    ringMode,
    ringOnline,
    temperature,
    safeguard,
  ]);

  useEffect(() => {
    if (!online) return;
    if (temperature >= 4500) announce("meltdown");
    else if (temperature >= 3500 && !safeguard) announce("safeguard");
    else if (temperature < 500) announce("cold");
  }, [online, temperature, safeguard]);

  useEffect(() => {
    const eventActive =
      generatorFire || temperature < 500 || temperature >= 3500 || safeguard;
    if (!online || !paAudioEnabled || eventActive) return;

    const timeout = window.setTimeout(
      () => {
        const eligible = ambientAnnouncementIds.filter(
          (id) => id !== lastAmbientAnnouncement.current,
        );
        const id = eligible[Math.floor(Math.random() * eligible.length)];
        lastAmbientAnnouncement.current = id;
        announce(id, true);
      },
      70_000 + Math.random() * 40_000,
    );
    return () => window.clearTimeout(timeout);
  }, [online, paAudioEnabled, generatorFire, temperature < 500, temperature >= 3500, safeguard]);

  const eventLabel = useMemo(() => {
    if (temperature >= 4500) return "CODE RED — MELTDOWN";
    if (generatorFire) return "THERMAL GENERATOR FIRE";
    if (temperature >= 3500) return "SAFEGUARD REQUIRED";
    if (temperature < 500 && online) return "FREEZEDOWN WARNING";
    return "NO ACTIVE FACILITY EVENT";
  }, [temperature, online, generatorFire]);

  const reset = () => {
    setFacilityPower(false);
    setPrimer(false);
    setCoolantPumps([false, false]);
    setStabilizer(false);
    setCrystalRaised(false);
    setRingOnline(false);
    setPowerLasers(["OFF", "OFF", "OFF", "OFF"]);
    setOverloadedLasers([false, false, false, false]);
    setCoolantLasers([false, false, false]);
    setFanSpeed("REGULAR");
    setRingMode("NORMAL");
    setOnline(false);
    setTemperature(293);
    setOutput(0);
    setSafeguard(false);
    setSafeguardCoreKey(false);
    setSafeguardFacilityKey(false);
    setSafeguardStage("IDLE");
    setGeneratorFire(false);
    setActiveAnnouncement(null);
  };
  const testEvent = (
    event:
      "startup" | "freezedown" | "safeguard" | "meltdown" | "generatorFire",
  ) => {
    if (event === "startup") {
      setFacilityPower(true);
      setPrimer(true);
      setCoolantPumps([true, true]);
      setStabilizer(true);
      setCrystalRaised(true);
      setRingOnline(true);
      setPowerLasers(["REG", "REG", "REG", "REG"]);
      setOverloadedLasers([false, false, false, false]);
      setCoolantLasers([true, true, true]);
      setOnline(true);
      setTemperature(950);
      setSafeguard(false);
      setGeneratorFire(false);
    }
    if (event === "freezedown") {
      setOnline(true);
      setTemperature(240);
      setSafeguard(false);
    }
    if (event === "safeguard") {
      setOnline(true);
      setTemperature(3850);
      setSafeguard(false);
    }
    if (event === "meltdown") {
      setOnline(true);
      setTemperature(4550);
      setSafeguard(false);
    }
    if (event === "generatorFire") setGeneratorFire(true);
    announce(event === "freezedown" ? "cold" : event, true);
  };
  const toggleAt = (
    setter: React.Dispatch<React.SetStateAction<boolean[]>>,
    index: number,
  ) =>
    setter((previous) =>
      previous.map((value, item) => (item === index ? !value : value)),
    );
  const cyclePowerLaser = (index: number) => {
    const modes: PowerLaserMode[] = ["OFF", "LOW", "REG", "MAX"];
    setPowerLasers((previous) =>
      previous.map((mode, item) => {
        if (item !== index || mode === "DESTROYED") return mode;
        return modes[(modes.indexOf(mode) + 1) % modes.length];
      }),
    );
  };
  const overloadPowerLaser = (index: number) => {
    if (
      !online ||
      temperature < 100 ||
      temperature > 500 ||
      overloadedLasers[index] ||
      powerLasers[index] === "DESTROYED"
    )
      return;
    // The documented early-startup overload has a roughly 60% failure rate.
    // A surviving laser is consumed by the procedure and no longer adds heat.
    const failed = Math.random() < 0.6;
    setOverloadedLasers((previous) =>
      previous.map((value, item) => (item === index ? !failed : value)),
    );
    setPowerLasers((previous) =>
      previous.map((mode, item) =>
        item === index ? (failed ? "DESTROYED" : "OFF") : mode,
      ),
    );
    if (!failed) {
      const nextSuccesses = overloadedLasers.filter(Boolean).length + 1;
      if (nextSuccesses >= 2) setTemperature(1500);
    }
  };
  const attemptSafeguard = () => {
    if (
      !online ||
      temperature < 3500 ||
      temperature >= 4500 ||
      !safeguardCoreKey ||
      !safeguardFacilityKey ||
      safeguardStage !== "IDLE"
    )
      return;
    const risk = temperature < 3850 ? 0 : temperature < 4200 ? 4 : 12;
    const successChance = risk === 0 ? 1 : risk === 4 ? 0.75 : 0.4;
    setSafeguardStage("SEQUENCING");
    announce("safeguard", true);
    if (risk === 0) setPowerLasers(["OFF", "OFF", "OFF", "OFF"]);
    if (risk === 4) setPowerLasers(["OFF", "OFF", "OFF", powerLasers[3]]);
    window.setTimeout(() => {
      if (Math.random() <= successChance) {
        setSafeguard(true);
        setSafeguardStage("ACTIVE");
        setTemperature(1500);
      } else {
        setSafeguard(false);
        setSafeguardStage("FAILED");
        setTemperature((current) => Math.max(current, 4500));
      }
    }, 2600);
  };

  return (
    <main className="min-h-screen bg-[#070a0e] p-4 font-mono text-slate-100 md:p-7">
      <header className="mx-auto mb-5 flex max-w-7xl flex-wrap items-end justify-between gap-4 border-b border-amber-400/35 pb-5">
        <div>
          <p className="text-xs font-black tracking-[.3em] text-amber-300">
            REACTOR GAME ARCHIVE // IITPP
          </p>
          <h1 className="mt-1 text-3xl font-black">
            Innovation Inc. Thermal Power Plant
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Geo-Thermonuclear core operations, ASAS announcements,
            event-response training, and embedded official music.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>
            RESET FACILITY
          </Button>
          <Button asChild>
            <Link to="/archive">ARCHIVE</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Meter
          label="CORE TEMPERATURE"
          value={temperature.toFixed(0)}
          unit="K"
          tone={
            temperature >= 4500
              ? "text-red-400"
              : temperature >= 3500
                ? "text-amber-300"
                : "text-cyan-200"
          }
        />
        <Meter
          label="REACTOR OUTPUT"
          value={output.toFixed(1)}
          unit="MW"
          tone="text-emerald-300"
        />
        <Meter
          label="COOLANT PUMPS"
          value={`${coolantCount} / ${coolantPumps.length}`}
          tone={coolantCount >= 2 ? "text-emerald-300" : "text-red-300"}
        />
        <Meter
          label="CORE STATUS"
          value={status}
          tone={status === "NOMINAL" ? "text-emerald-300" : "text-amber-300"}
        />
        <Meter
          label="EVENT STATUS"
          value={eventLabel}
          tone={eventLabel.startsWith("NO") ? "text-slate-300" : "text-red-300"}
        />
      </section>

      <section className="mx-auto mt-5 grid max-w-7xl gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="grid gap-5">
          <Card className="border-amber-400/30 bg-slate-900/75">
            <CardHeader>
              <CardTitle className="text-amber-200">
                FACILITY STARTUP PANEL
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-xs font-black tracking-wider text-slate-400">
                  FACILITY CONTROL
                </p>
                <Button
                  className="w-full"
                  variant={facilityPower ? "default" : "outline"}
                  onClick={() => setFacilityPower((value) => !value)}
                >
                  {facilityPower
                    ? "FACILITY POWER ONLINE"
                    : "ENABLE FACILITY POWER"}
                </Button>
                <Button
                  className="w-full"
                  disabled={!facilityPower}
                  variant={primer ? "default" : "outline"}
                  onClick={() => setPrimer((value) => !value)}
                >
                  {primer ? "STARTUP PRIMER READY" : "ARM STARTUP PRIMER"}
                </Button>
                <p className="text-xs text-slate-400">
                  Start the facility supply, arm the primer, establish coolant,
                  then align the stabilizer, crystal, ring, and laser arrays.
                </p>
              </div>
              <div className="space-y-3 rounded border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-xs font-black tracking-wider text-slate-400">
                  MAIN COOLANT PUMPS
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {coolantPumps.map((running, index) => (
                    <Button
                      key={index}
                      disabled={!facilityPower}
                      variant={running ? "default" : "outline"}
                      onClick={() => toggleAt(setCoolantPumps, index)}
                    >
                      {index === 0 ? "ALPHA / CORE" : "BETA / GENERATORS"}: {running ? "ON" : "OFF"}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  Alpha supplies the reactor core and coolant lasers. Beta
                  cools the thermal generators and prevents generator fires.
                </p>
              </div>
              <div className="space-y-3 rounded border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-xs font-black tracking-wider text-slate-400">
                  CORE ALIGNMENT
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    disabled={!facilityPower}
                    variant={stabilizer ? "default" : "outline"}
                    onClick={() => setStabilizer((value) => !value)}
                  >
                    STABILIZER
                  </Button>
                  <Button
                    disabled={!facilityPower}
                    variant={crystalRaised ? "default" : "outline"}
                    onClick={() => setCrystalRaised((value) => !value)}
                  >
                    CRYSTAL
                  </Button>
                  <Button
                    disabled={!facilityPower}
                    variant={ringOnline ? "default" : "outline"}
                    onClick={() => setRingOnline((value) => !value)}
                  >
                    RING
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {powerLasers.map((mode, index) => (
                    <Button
                      key={index}
                      disabled={!facilityPower}
                      size="sm"
                      variant={mode === "OFF" || mode === "DESTROYED" ? "outline" : "default"}
                      onClick={() => cyclePowerLaser(index)}
                    >
                      P-L {index + 1}: {mode}
                    </Button>
                  ))}
                </div>
                {online && temperature >= 100 && temperature <= 500 && (
                  <div className="grid grid-cols-2 gap-2">
                    {powerLasers.map((mode, index) => (
                      <Button
                        key={`overload-${index}`}
                        size="sm"
                        variant="destructive"
                        disabled={
                          mode === "DESTROYED" || overloadedLasers[index]
                        }
                        onClick={() => overloadPowerLaser(index)}
                      >
                        {mode === "DESTROYED"
                          ? `P-L ${index + 1} DESTROYED`
                          : overloadedLasers[index]
                            ? `P-L ${index + 1} OVERLOADED`
                            : `OVERLOAD P-L ${index + 1}`}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {coolantLasers.map((active, index) => (
                    <Button
                      key={index}
                      disabled={!facilityPower || !alphaPumpOnline}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => toggleAt(setCoolantLasers, index)}
                    >
                      C-L {index + 1}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const speeds: FanSpeed[] = ["OFF", "SLOW", "REGULAR", "FAST"];
                      setFanSpeed(speeds[(speeds.indexOf(fanSpeed) + 1) % speeds.length]);
                    }}
                  >
                    CORE FANS: {fanSpeed}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const modes: RingMode[] = ["LOW", "NORMAL", "HIGH"];
                      setRingMode(modes[(modes.indexOf(ringMode) + 1) % modes.length]);
                    }}
                  >
                    RING MODE: {ringMode}
                  </Button>
                </div>
                <p className="text-xs text-slate-400">
                  Power lasers heat by 1/2/3 K/s at LOW/REG/MAX. Fans cool by
                  0/3/6/8 K/s. The ring on HIGH reduces movement toward an event;
                  LOW accelerates it. Between 100–500 K, an overload can bring
                  the core back to 1,500 K if at least two lasers survive.
                </p>
              </div>
              <div className="rounded border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-xs font-black tracking-wider text-slate-400">
                  CORE CONTROL
                </p>
                <Button
                  className="mt-3 w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  disabled={!startupReady || online}
                  onClick={() => {
                    setOnline(true);
                    announce("startup");
                  }}
                >
                  START GEO-THERMONUCLEAR CORE
                </Button>
                <Button
                  className="mt-2 w-full"
                  variant="outline"
                  disabled={!online}
                  onClick={() => setOnline(false)}
                >
                  CONTROLLED SHUTDOWN
                </Button>
                <p className="mt-3 text-xs text-slate-400">
                  {startupReady
                    ? "All startup permissives are satisfied."
                    : "Startup permissives incomplete. Alpha pump, all four power lasers, and all coolant lasers must be aligned."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/30 bg-slate-900/75">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-200">
                <ShieldAlert className="h-5 w-5" /> EVENT AND SAFEGUARD TRAINING
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded border border-red-400/25 bg-black/30 p-3 md:col-span-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black tracking-[.13em] text-red-200">
                    SAFEGUARD KEYS + COMBUSTION STALL
                  </p>
                  <span className="text-xs text-slate-400">
                    {safeguardStage === "IDLE"
                      ? safeguardRisk === null
                        ? "AVAILABLE ONLY AT 3,500–4,499 K"
                        : `${safeguardRisk} RISKS`
                      : `SEQUENCE: ${safeguardStage}`}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <Button
                    size="sm"
                    variant={safeguardCoreKey ? "default" : "outline"}
                    disabled={!online || safeguardStage !== "IDLE"}
                    onClick={() => setSafeguardCoreKey((value) => !value)}
                  >
                    CORE ROOM KEY: {safeguardCoreKey ? "INSERTED" : "OUT"}
                  </Button>
                  <Button
                    size="sm"
                    variant={safeguardFacilityKey ? "default" : "outline"}
                    disabled={!online || safeguardStage !== "IDLE"}
                    onClick={() => setSafeguardFacilityKey((value) => !value)}
                  >
                    FACILITY KEY: {safeguardFacilityKey ? "INSERTED" : "OUT"}
                  </Button>
                  <Button
                    size="sm"
                    variant={safeguard ? "default" : "destructive"}
                    disabled={
                      safeguard ||
                      safeguardRisk === null ||
                      !safeguardCoreKey ||
                      !safeguardFacilityKey ||
                      safeguardStage !== "IDLE"
                    }
                    onClick={attemptSafeguard}
                  >
                    {safeguard ? "SAFEGUARD ACTIVE" : "ACTIVATE SAFEGUARD"}
                  </Button>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Two keys are required. The documented risk bands are 0 risks
                  below 3,850 K, 4 risks below 4,200 K, and 12 risks below 4,500 K.
                  A successful safeguard shuts down the lasers and rapidly returns
                  the core to 1,500 K.
                </p>
              </div>
              <Button
                variant={generatorFire ? "destructive" : "outline"}
                onClick={() => {
                  setGeneratorFire((value) => !value);
                  if (!generatorFire) announce("generatorFire");
                }}
              >
                {generatorFire
                  ? "FIRE SUPPRESSION ACTIVE"
                  : betaPumpOnline
                    ? "SIMULATE GENERATOR FIRE (BETA ONLINE)"
                    : "SIMULATE GENERATOR FIRE"}
              </Button>
              <Button variant="outline" onClick={() => announce("meltdown")}>
                <AlertTriangle className="mr-2 h-4 w-4" /> TEST CODE RED PA
              </Button>
              <div className="md:col-span-3 rounded border border-red-400/25 bg-black/30 p-3">
                <p className="text-[10px] font-black tracking-[.16em] text-red-200">
                  EVENT TEST CONSOLE — SETS STATE AND PLAYS THE MATCHING ASAS
                  CAPTION
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testEvent("startup")}
                  >
                    STARTUP SUCCESS
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testEvent("freezedown")}
                  >
                    FREEZEDOWN
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testEvent("safeguard")}
                  >
                    SAFEGUARD
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => testEvent("meltdown")}
                  >
                    MELTDOWN
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testEvent("generatorFire")}
                  >
                    GENERATOR FIRE
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card
            className={`border ${activeAnnouncement?.kind === "alert" ? "border-red-400/70" : "border-cyan-400/50"} bg-slate-950/90`}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-200">
                <Siren className="h-5 w-5" /> ASAS ANNOUNCEMENT SYSTEM
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeAnnouncement ? (
                <>
                  <p
                    className={`text-xs font-black tracking-[.18em] ${activeAnnouncement.kind === "alert" ? "text-red-300" : "text-cyan-300"}`}
                  >
                    {activeAnnouncement.kind === "alert"
                      ? "PRIORITY ALERT"
                      : "FACILITY ANNOUNCEMENT"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-100">
                    {activeAnnouncement.text}
                  </p>
                  <Button
                    className="mt-4 w-full"
                    variant="outline"
                    onClick={() => {
                      announcementAudio.current?.pause();
                      window.speechSynthesis.cancel();
                      setActiveAnnouncement(null);
                    }}
                  >
                    ACKNOWLEDGE CAPTION
                  </Button>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  ASAS standing by. Reactor events will publish captioned
                  announcements here.
                </p>
              )}
              <Button
                className="mt-4 w-full"
                variant={paAudioEnabled ? "default" : "outline"}
                onClick={enablePaAudio}
              >
                {paAudioEnabled
                  ? "PA AUDIO ENABLED — TEST EVENT TO HEAR"
                  : "ENABLE ASAS AUDIO"}
              </Button>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                The local voice is a temporary event fallback. The official
                announcement playlist is available below, without storing its
                audio in this website.
              </p>
              <Button
                className="mt-3 w-full"
                variant="outline"
                onClick={() => setOfficialPaOpen((value) => !value)}
              >
                {officialPaOpen
                  ? "HIDE OFFICIAL ASAS PLAYER"
                  : "OPEN OFFICIAL ASAS PLAYER"}
              </Button>
              {officialPaOpen && (
                <iframe
                  className="mt-3 aspect-video w-full rounded border border-cyan-400/35"
                  src="https://www.youtube-nocookie.com/embed/videoseries?list=PLAczXyUQu4LkdTF5kcyZcKTJq-kHUoV2z&autoplay=1&rel=0"
                  title="Official IITPP announcements"
                  allow="autoplay; encrypted-media"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              )}
            </CardContent>
          </Card>
          <Card className="border-fuchsia-400/35 bg-slate-900/75">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-fuchsia-200">
                <Radio className="h-5 w-5" /> OFFICIAL IITPP SOUNDTRACK
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs leading-5 text-slate-400">
                Embedded from the supplied official playlist. Playback requires
                your click because browsers block automatic audio start.
              </p>
              <Button
                className="mt-3 w-full"
                variant="outline"
                onClick={() => setMusicOpen((value) => !value)}
              >
                {musicOpen ? "HIDE SOUNDTRACK" : "OPEN SOUNDTRACK PLAYER"}
              </Button>
              {musicOpen && (
                <iframe
                  className="mt-3 aspect-video w-full rounded border border-fuchsia-400/30"
                  src="https://www.youtube-nocookie.com/embed/videoseries?list=PLeEAPHQbLYMuK3opwHeN0-_jw18GUciif&autoplay=1&rel=0"
                  title="Official IITPP soundtrack"
                  allow="autoplay; encrypted-media"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              )}
              {musicOpen && (
                <p className="mt-2 text-[11px] text-slate-500">
                  The player was opened by your click and is requested to play
                  automatically. If YouTube still blocks it, use its visible
                  Play control once.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-slate-700 bg-slate-900/75">
            <CardContent className="pt-6 text-xs leading-5 text-slate-400">
              This first IITPP build focuses on the core startup/control loop,
              conditions for safeguard and freezedown, ASAS caption events, and
              soundtrack integration. Major endings and side events can now be
              added on the same event framework.
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}
