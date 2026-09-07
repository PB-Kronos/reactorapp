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
};

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
  const [coolantPumps, setCoolantPumps] = useState([
    false,
    false,
    false,
    false,
  ]);
  const [stabilizer, setStabilizer] = useState(false);
  const [crystalRaised, setCrystalRaised] = useState(false);
  const [ringOnline, setRingOnline] = useState(false);
  const [powerLasers, setPowerLasers] = useState([false, false, false, false]);
  const [coolantLasers, setCoolantLasers] = useState([false, false, false]);
  const [online, setOnline] = useState(false);
  const [temperature, setTemperature] = useState(293);
  const [output, setOutput] = useState(0);
  const [safeguard, setSafeguard] = useState(false);
  const [generatorFire, setGeneratorFire] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [officialPaOpen, setOfficialPaOpen] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<Announcement | null>(null);
  const [paAudioEnabled, setPaAudioEnabled] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const announcementAudio = useRef<HTMLAudioElement | null>(null);
  const lastAnnouncement = useRef<string | null>(null);

  const coolantCount = coolantPumps.filter(Boolean).length;
  const laserCount = powerLasers.filter(Boolean).length;
  const coolantLaserCount = coolantLasers.filter(Boolean).length;
  const startupReady =
    facilityPower &&
    primer &&
    coolantCount >= 2 &&
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
        ? "NOMINAL"
        : temperature < 4500
          ? "SAFEGUARD WINDOW"
          : "MELTDOWN";

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
    window.setTimeout(
      () => {
        const asset = announcementAssets[id];
        if (!asset) {
          speakFallback();
          return;
        }
        announcementAudio.current?.pause();
        const audio = new Audio(asset);
        audio.volume = 0.9;
        announcementAudio.current = audio;
        audio.addEventListener("error", speakFallback, { once: true });
        void audio.play().catch(speakFallback);
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
      const heating = laserCount * 18 + (crystalRaised ? 4 : 0);
      const cooling =
        coolantCount * 14 + coolantLaserCount * 8 + (stabilizer ? 8 : 0);
      const runaway = temperature > 3500 ? (temperature - 3400) / 65 : 0;
      const safeguardCooling = safeguard ? 92 : 0;
      setTemperature((current) =>
        clamp(
          current + (heating - cooling + runaway - safeguardCooling) * 0.5,
          0,
          6000,
        ),
      );
      setOutput(() =>
        clamp(
          (laserCount * 18 + (temperature - 500) * 0.02) *
            (ringOnline ? 1 : 0.25),
          0,
          120,
        ),
      );
    }, 500);
    return () => window.clearInterval(interval);
  }, [
    online,
    laserCount,
    coolantCount,
    coolantLaserCount,
    stabilizer,
    crystalRaised,
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
    setCoolantPumps([false, false, false, false]);
    setStabilizer(false);
    setCrystalRaised(false);
    setRingOnline(false);
    setPowerLasers([false, false, false, false]);
    setCoolantLasers([false, false, false]);
    setOnline(false);
    setTemperature(293);
    setOutput(0);
    setSafeguard(false);
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
      setCoolantPumps([true, true, true, false]);
      setStabilizer(true);
      setCrystalRaised(true);
      setRingOnline(true);
      setPowerLasers([true, true, true, true]);
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
          value={`${coolantCount} / 4`}
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
                      PUMP {index + 1}: {running ? "ON" : "OFF"}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  At least two pumps are required before core startup. More
                  running pumps give stronger heat removal.
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
                  {powerLasers.map((active, index) => (
                    <Button
                      key={index}
                      disabled={!facilityPower}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => toggleAt(setPowerLasers, index)}
                    >
                      P-L {index + 1}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {coolantLasers.map((active, index) => (
                    <Button
                      key={index}
                      disabled={!facilityPower}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => toggleAt(setCoolantLasers, index)}
                    >
                      C-L {index + 1}
                    </Button>
                  ))}
                </div>
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
                    : "Startup permissives incomplete."}
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
              <Button
                disabled={!online || temperature < 3500}
                variant={safeguard ? "default" : "destructive"}
                onClick={() => {
                  setSafeguard((value) => !value);
                  if (!safeguard) announce("safeguard");
                }}
              >
                {safeguard ? "SAFEGUARD ACTIVE" : "ACTIVATE SAFEGUARD"}
              </Button>
              <Button
                variant={generatorFire ? "destructive" : "outline"}
                onClick={() => {
                  setGeneratorFire((value) => !value);
                  if (!generatorFire) announce("generatorFire");
                }}
              >
                {generatorFire
                  ? "FIRE SUPPRESSION ACTIVE"
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
