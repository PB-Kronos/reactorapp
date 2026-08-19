import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Guide = {
  title: string;
  purpose: string;
  steps: string[];
  targets: string[];
  caution: string;
};

const guides: Record<string, Guide> = {
  status: {
    title: "Plant overview",
    purpose: "Monitor Unit Status here.",
    steps: ["Check APRM, reactor pressure and temperature.", "Confirm reactor level is near 0.00 m and no red annunciators are active.", "Use the recirculation controls only after a stable rod condition is established."],
    targets: ["Normal main steam pressure: 7100 kPa", "Operate reactor level near 0.00 m", "Keep reactor period above 20 seconds"],
    caution: "A stable-looking overview does not replace checking the related MCC, turbine, and RPS pages before startup.",
  },
  "startup-shutdown": {
    title: "Reactor startup and shutdown",
    purpose: "Start or stop the reactor core. Rod withdrawal itself is performed on the Control Rods page.",
    steps: ["For a normal start, ensure water inventory and protection are ready, then press Start Reactor.", "Use SRM, then IPR, to perform the controlled rod startup sequence.", "Use Normal Stop for a planned shutdown; use SCRAM only for an emergency."],
    targets: ["Initial state: cold shutdown", "Use RHR after shutdown when decay-heat cooling is needed"],
    caution: "Instant Startup is a test shortcut. It bypasses rod startup but does not prepare the turbine or correct water flow.",
  },
  "control-rods": {
    title: "Control rods and APRM",
    purpose: "Use this panel to control the nuclear reactions happening inside the reactor.",
    steps: ["MANUAL STARTUP STEPS: ", "Select SRM and withdraw permitted rods to the first 5% block.", "Select IPR and complete each 5% cycle before Advance IPR Cycle becomes valid.", "After the final IPR cycle, select RUN for normal regulation.", "AUTOMATIC STARTUP: ", "Set Auto-APRM to around 20%, all operations will be done for you", "Use Auto APRM only after choosing a sensible target and rod or recirculation control mode."],
    targets: ["SRM: one 5% withdrawal cycle", "IPR: three 5% withdrawal cycles", "Keep reactor period above 20 seconds"],
    caution: "Hold the drive lever only as long as needed, if the reactor period gets too close to 20 seconds the reactor may trip. Be aware recirculation pumps can only be used when the APR is above 20%",
  },
  mcc: {
    title: "MCC and water inventory",
    purpose: "Balance steam output, condensate flow, and feedwater flow so reactor and hotwell levels remain steady.",
    steps: ["Enable MCC Circulation Pump before expecting normal inventory movement.", "Start condensate and feedwater pumps, then raise their flows toward total steam flow.", "Use MCC Auto for assisted balancing; it takes back flow control after manual adjustment is released.", "Use CST/hotwell makeup or drain only to correct level errors."],
    targets: ["Reactor and hotwell: near 0.00 m", "Each pump: up to 1000 kg/s", "Match steam, hotwell outflow, and feedwater outflow"],
    caution: "In Full mode, DA controls affect DA temperature and pressure. In Simple mode, the DA is bypassed.",
  },
  condenser: {
    title: "Condenser and vacuum",
    purpose: "Create a low condenser pressure so steam can condense and the turbine can produce efficient output.",
    steps: ["Start condenser circulation.", "Use CAR A/B while condenser pressure is above 850 mbar.", "Hold the vacuum lever open gradually until condenser pressure settles in range.", "Keep the bypass open during early steam handling before turbine loading."],
    targets: ["Normal condenser pressure: 40–70 mbar", "CAR operating range: above 850 mbar"],
    caution: "Poor condenser vacuum reduces turbine output and can trip or unsynchronize the turbine.",
  },
  "power-grid": {
    title: "Turbine and generator",
    purpose: "Warm, run up, synchronize, and load the turbine-generator using steam flow.",
    steps: ["In Full mode, satisfy the RPS turbine run-up checklist first.", "Open main steam inlet, use bypass and main valve to establish controlled steam flow and speed.", "At synchronism, enable exciter and close grid breaker.", "After synchronization, increase APRM and let the main valve regulate pressure near nominal."],
    targets: ["Nominal main steam pressure: 7100 kPa", "Full-mode oil temperature: 35–65 °C", "Synchronize only when speed and phase are aligned"],
    caution: "Simple mode bypasses turbine preparation. Full mode requires healthy lube, hydraulic, preheat, and run-up conditions.",
  },
  electrical: {
    title: "Electrical distribution",
    purpose: "Provide sufficient power to normal and safety plant loads without overloading a bus.",
    steps: ["Use Startup Bus A before the turbine is online.", "After synchronization, enable Bus B for its additional capacity and Pump B loads.", "Enable Safety Bus S before using RCIC, LPCI/RHR, CST, or hotwell pumps.", "Watch kW load indications and remove load before a breaker trips."],
    targets: ["Startup Bus A capacity: 30 kW", "Bus B capacity: 60 kW", "Safety Bus S capacity: 30 kW"],
    caution: "A bus overload opens its breaker; Bus B overload also trips the turbine-generator.",
  },
  safety: {
    title: "ECCS, ADS, and relief valves",
    purpose: "Restore reactor level or remove pressure during abnormal conditions.",
    steps: ["Use RCIC at any pressure: enable Safety Bus S, isolation valve, then turbopump valve.", "Use LPCI only below 3500 kPa; use RHR only for shutdown cooling.", "Select at least one LPCI train before ADS can arm.", "Use ADS to SCRAM and open all SRVs for a severe low-level depressurization response."],
    targets: ["LPCI available below 3500 kPa", "ADS automatic low-level actuation: −4.50 m"],
    caution: "SRVs and ADS deliberately reduce pressure. Do not use them as a normal turbine pressure-control method.",
  },
  rps: {
    title: "Reactor Protection System",
    purpose: "Monitor reactor and turbine trip conditions and reset them only when the plant is safe.",
    steps: ["Review every active trip node and correct its initiating condition.", "Use Reset Trip Nodes only after the condition has cleared.", "Keep Roll-down Protection enabled during normal turbine operation.", "Use Trip Inhibit only for controlled testing, then return it off immediately."],
    targets: ["All active RPS nodes: CLEAR", "Trip Inhibit: OFF during normal operation"],
    caution: "Trip Inhibit blocks automatic protection. It is intentionally dangerous and should not be used for ordinary operation.",
  },
};

export const OperatorManual = ({ page }: { page: string }) => {
  const guide = guides[page] || guides.status;
  return <Dialog><DialogTrigger asChild><Button variant="outline" className="operator-manual-trigger min-h-11 border-cyan-500/70 text-cyan-200 hover:bg-cyan-950"><BookOpen className="h-4 w-4" />PAGE MANUAL</Button></DialogTrigger><DialogContent className="max-h-[85vh] overflow-y-auto border-cyan-500/60 bg-[#07111d] font-mono text-slate-100 sm:max-w-2xl"><DialogHeader><DialogTitle className="text-cyan-200">{guide.title}</DialogTitle><DialogDescription className="text-slate-300">{guide.purpose}</DialogDescription></DialogHeader><div className="space-y-5 text-sm"><section><h3 className="mb-2 font-bold tracking-wide text-emerald-300">OPERATING ORDER</h3><ol className="space-y-2 text-slate-200">{guide.steps.map((step, index) => <li key={step} className="flex gap-3"><span className="font-bold text-cyan-300">{index + 1}.</span><span>{step}</span></li>)}</ol></section><section><h3 className="mb-2 font-bold tracking-wide text-emerald-300">NORMAL TARGETS</h3><ul className="space-y-1 text-slate-200">{guide.targets.map(target => <li key={target}>• {target}</li>)}</ul></section><section className="rounded border border-amber-500/50 bg-amber-950/25 p-3"><h3 className="mb-1 font-bold text-amber-300">OPERATOR CAUTION</h3><p className="text-amber-100/90">{guide.caution}</p></section></div></DialogContent></Dialog>;
};
