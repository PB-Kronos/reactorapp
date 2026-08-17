"use client";
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const ReactorSimulator = lazy(() => import("./pages/ReactorSimulator"));
const Mainframe = lazy(() => import("./pages/Mainframe"));
const queryClient = new QueryClient();
const Loading = () => <div className="grid min-h-screen place-items-center bg-slate-950 font-mono text-cyan-300">Loading Unit 2 systems…</div>;

const App = () => <QueryClientProvider client={queryClient}><TooltipProvider><Toaster /><Sonner /><BrowserRouter><Suspense fallback={<Loading />}><Routes><Route path="/" element={<Index />} /><Route path="/reactor" element={<ReactorSimulator />} /><Route path="/mainframe" element={<Mainframe />} /><Route path="*" element={<NotFound />} /></Routes></Suspense></BrowserRouter></TooltipProvider></QueryClientProvider>;
export default App;
