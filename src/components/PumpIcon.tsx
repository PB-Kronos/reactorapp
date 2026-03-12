import React from "react";
import { Droplets } from "lucide-react";

interface PumpIconProps {
  isOnline: boolean;
  size?: number;
}

export const PumpIcon: React.FC<PumpIconProps> = ({ isOnline, size = 24 }) => (
  <Droplets size={size} className={isOnline ? "text-blue-400" : "text-gray-500"} />
);