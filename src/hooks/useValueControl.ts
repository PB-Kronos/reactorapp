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
      const interval = setInterval(() => {
        onChange(prev => {
          const newVal = prev + direction * incrementPerSecond;
          return Math.min(Math.max(newVal, min), max);
        });
      }, 1000); // Update every second for smoother control
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