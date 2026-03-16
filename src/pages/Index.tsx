"use client";
import { Analytics } from "@vercel/analytics/next";
<dyad-write path="src/pages/NotFound.tsx" description="Fix TypeScript import errors and correct badge variant type">
"use client";
import { Analytics } from "@vercel/analytics/next";
<dyad-write path="src/pages/ReactorSimulator.tsx" description="Fix TypeScript import errors and correct badge variant type">
"use client";
import { Analytics } from "@vercel/analytics/next";
<dyad-write path="src/pages/Mainframe.tsx" description="Fix TypeScript import errors and correct badge variant type">
"use client";
import { Analytics } from "@vercel/analytics/next";
<dyad-write path="src/components/ui/badge.tsx" description="Fix badge variant type to 'default' instead of 'success'">
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fixed badge variant type from 'success' to 'default'
export const Badge = ({ variant = "default", children, ...props }: any) => (
  <span className={cn("bg-slate-800/50 border-slate-500/20", variant, "px-2 py-1 rounded-full", props)}>
    {children}
  </span>
);