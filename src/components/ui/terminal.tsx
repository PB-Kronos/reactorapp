"use client";

import { useState } from "react";

interface TerminalLineProps {
  children: string;
}

export const TerminalLine = ({ children }: TerminalLineProps) => {
  return <div className="mb-1">{children}</div>;
};

interface TerminalInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
}

export const TerminalInput = ({ value, onChange, onEnter }: TerminalInputProps) => {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyPress={(e) => {
        if (e.key === 'Enter') {
          onEnter();
        }
      }}
      className="bg-transparent border-none text-cyan-400 outline-none font-mono text-sm"
      placeholder="> Enter command..."
    />
  );
};

interface TerminalOutputProps {
  children: string;
}

export const TerminalOutput = ({ children }: TerminalOutputProps) => {
  return <div className="text-gray-300">{children}</div>;
};

interface TerminalProps {
  children: React.ReactNode;
}

export const Terminal = ({ children }: TerminalProps) => {
  return (
    <div className="terminal-output">
      {children}
    </div>
  );
};