import { useEffect, useRef } from "react";

interface UseValueControlProps {
  initialValue: number;
  onChange: (value: number | ((prev: number) => number)) => void;
  direction: number;
  min?: number;
  max?: number;
  incrementPerSecond: number;
}

export const useValueControl = ({
  initialValue,
  onChange,
  direction,
  min = 0,
  max = 100,
  incrementPerSecond
}: UseValueControlProps) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (direction !== 0) {
      const increment = direction * incrementPerSecond / 10; // 100ms interval
      const interval = setInterval(() => {
        onChange(prev => {
          const newVal = prev + increment;
          return Math.min(Math.max(newVal, min), max);
        });
      }, 100); // Update every 100ms for smoother control
      intervalRef.current = interval;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [direction, incrementPerSecond, min, max, onChange]);
};