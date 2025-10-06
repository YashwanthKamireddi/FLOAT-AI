import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center py-2", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full border border-slate-200/60 bg-gradient-to-r from-slate-100/80 to-slate-50/90 shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-white/10 dark:from-slate-800/60 dark:to-slate-900/70">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-sky-500/90 to-cyan-400/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]" />
    </SliderPrimitive.Track>
    {props.value?.map((_, index) => (
      <SliderPrimitive.Thumb
        key={index}
        className="block h-6 w-6 cursor-grab rounded-full border-2 border-sky-400/70 bg-white shadow-[0_4px_12px_-2px_rgba(14,165,233,0.4),0_0_0_3px_rgba(14,165,233,0.1)] ring-offset-background transition-all duration-200 ease-out hover:scale-110 hover:border-sky-500 hover:shadow-[0_6px_16px_-3px_rgba(14,165,233,0.6),0_0_0_4px_rgba(14,165,233,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 active:cursor-grabbing active:scale-105 disabled:pointer-events-none disabled:opacity-50 dark:border-sky-300/80 dark:bg-slate-900 dark:shadow-[0_4px_12px_-2px_rgba(125,211,252,0.5),0_0_0_3px_rgba(125,211,252,0.15)]"
      />
    ))}
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
