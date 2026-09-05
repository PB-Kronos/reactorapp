import {
  Archive,
  ArrowRight,
  Atom,
  BookOpen,
  Cpu,
  Gauge,
  Radiation,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const entries = [
  {
    title: "Unit 2: The BWR Sim",
    route: "/reactor",
    status: "Active simulation",
    icon: Atom,
    description:
      "A deep RBWR-inspired multi-panel BWR control room with MCC, turbine, ECCS, electrical distribution, RPS, operator terminals, and multi-station support.",
  },
  {
    title: "Naramo Plant",
    route: "/naramo",
    status: "Archive simulation",
    icon: Gauge,
    description:
      "An ANRO/Naramo-inspired two-turbine plant with aggregate rods, grid configurations, refuelling, corporate policies, and emergency procedures.",
  },
  {
    title: "A Core Game",
    route: "/a-core-game",
    status: "Archive simulation",
    icon: Radiation,
    description:
      "A Plasma Reactor Core training simulator with startup primer, laser heating, coolant pools, E-coolant, shield degradation and EMTS.",
  },
  {
    title: "Computer Core APOLLO",
    route: "/apollo",
    status: "Archive simulation",
    icon: Cpu,
    description:
      "A two-installation APOLLO facility: a four-module central discharge-conductor array and the denser TNER experimental power unit, linked through facility support power.",
  },
];

export default function ReactorArchive() {
  return (
    <main className="min-h-screen bg-[#07100f] p-5 font-mono text-slate-100 md:p-10">
      <header className="mx-auto max-w-6xl border-b border-emerald-500/30 pb-7">
        <p className="flex items-center gap-2 text-xs font-black tracking-[.28em] text-emerald-300">
          <Archive className="h-4 w-4" /> REACTOR GAME ARCHIVE
        </p>
        <h1 className="mt-3 text-4xl font-black">Control-room simulations</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          An expanding archive of Roblox reactor games, recreated as browser
          simulations. Each entry keeps its own controls, operating rules,
          responses, and training material.
        </p>
      </header>
      <section className="mx-auto mt-8 grid max-w-6xl gap-5 md:grid-cols-2">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <Card
              key={entry.route}
              className="border-emerald-500/25 bg-slate-900/75"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <Icon className="h-7 w-7 text-emerald-300" />
                  <span className="rounded border border-emerald-500/30 px-2 py-1 text-[10px] font-black tracking-wider text-emerald-200">
                    {entry.status}
                  </span>
                </div>
                <CardTitle className="pt-3 text-xl text-slate-100">
                  {entry.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="min-h-20 text-sm leading-6 text-slate-400">
                  {entry.description}
                </p>
                <Button
                  asChild
                  className="mt-5 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                >
                  <Link to={entry.route}>
                    OPEN SIMULATOR <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>
      <footer className="mx-auto mt-8 flex max-w-6xl gap-3">
        <Button asChild variant="outline">
          <Link to="/">
            <BookOpen className="mr-2 h-4 w-4" />
            RETURN TO TERMINAL
          </Link>
        </Button>
      </footer>
    </main>
  );
}
