import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("group/scroll relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">{children}</ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "group/scrollbar flex touch-none select-none transition-all duration-300",
      orientation === "vertical"
        ? "h-full w-3 rounded-full bg-white/20 px-[3px] py-[6px] backdrop-blur-sm dark:bg-white/[0.08]"
        : "h-3 w-full flex-col rounded-full bg-white/20 px-[6px] py-[3px] backdrop-blur-sm dark:bg-white/[0.08]",
      "hover:bg-white/30 dark:hover:bg-white/[0.12]",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-gradient-to-b from-sky-400/80 via-indigo-500/80 to-purple-500/80 shadow-[0_8px_24px_-12px_rgba(37,99,235,0.65)] transition-all after:absolute after:inset-0 after:rounded-full after:border after:border-white/30 group-hover/scrollbar:from-sky-300/90 group-hover/scrollbar:to-indigo-400/90 dark:from-sky-300/50 dark:via-indigo-400/60 dark:to-purple-500/60" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
