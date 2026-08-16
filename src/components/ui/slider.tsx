import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, defaultValue, min = 0, max = 100, step = 1, onValueChange, disabled, ...props }, ref) => {
  const currentValue = value?.[0] ?? defaultValue?.[0] ?? min;
  const changeBy = (amount: number) => onValueChange?.([Math.max(min, Math.min(max, currentValue + amount))]);

  return (
    <div className="flex items-center gap-3" data-slider-control>
      <button type="button" aria-label="Decrease value" disabled={disabled || currentValue <= min} onClick={() => changeBy(-step)} className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-slate-600 bg-slate-800 text-xl font-bold text-slate-100 active:bg-slate-700 disabled:opacity-40">−</button>
      <SliderPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={onValueChange}
        className={cn("relative flex min-h-11 w-full touch-none select-none items-center", className)}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-secondary">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-7 w-7 rounded-full border-2 border-primary bg-background shadow-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Root>
      <button type="button" aria-label="Increase value" disabled={disabled || currentValue >= max} onClick={() => changeBy(step)} className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-slate-600 bg-slate-800 text-xl font-bold text-slate-100 active:bg-slate-700 disabled:opacity-40">+</button>
    </div>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
