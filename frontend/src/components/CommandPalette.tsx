import type { ComponentType } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Zap,
  Layers,
  Map,
  LineChart,
  Code2,
  Filter,
  Eraser,
  Thermometer,
  Droplets,
  Activity,
  Anchor,
  Compass,
} from "lucide-react";

type PersonaMode = "guided" | "expert";

type FocusMetric = "temperature" | "salinity" | "pressure" | "oxygen" | "density";

interface PaletteFilters {
  focusMetric: FocusMetric;
  floatId?: string;
  depthRange?: [number | null, number | null];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PersonaMode;
  onAction: (action: string, payload?: string) => void;
  recentQueries: string[];
  filters: PaletteFilters;
  activeTab: string;
  quickQueries: Array<{ label: string; prompt: string }>;
}

const focusMetricOptions: Array<{ value: FocusMetric; label: string; icon: ComponentType<any> }> = [
  { value: "temperature", label: "Temperature focus", icon: Thermometer },
  { value: "salinity", label: "Salinity focus", icon: Droplets },
  { value: "pressure", label: "Pressure profile", icon: Activity },
  { value: "oxygen", label: "Dissolved oxygen", icon: Anchor },
  { value: "density", label: "Water density", icon: Zap },
];

const viewOptions = [
  { value: "analysis", label: "Open analysis table", icon: Layers, action: "open-analysis" },
  { value: "map", label: "Show ocean map", icon: Map, action: "open-map" },
  { value: "profiles", label: "Inspect profiles", icon: LineChart, action: "open-profiles" },
  { value: "sql", label: "Reveal SQL query", icon: Code2, action: "open-sql" },
];

const CommandPalette = ({
  open,
  onOpenChange,
  mode,
  onAction,
  recentQueries,
  filters,
  activeTab,
  quickQueries,
}: CommandPaletteProps) => {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search for an action…" />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>

        <CommandGroup heading="Persona mode">
          <CommandItem onSelect={() => onAction("switch-guided")}>
            <Sparkles className="mr-2 h-4 w-4" />
            <span>Switch to Guided Mode</span>
            {mode === "guided" && <CommandShortcut>Active</CommandShortcut>}
          </CommandItem>
          <CommandItem onSelect={() => onAction("switch-expert")}>
            <Zap className="mr-2 h-4 w-4" />
            <span>Switch to Expert Mode</span>
            {mode === "expert" && <CommandShortcut>Active</CommandShortcut>}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Views">
          {viewOptions.map(({ value, label, icon: Icon, action }) => (
            <CommandItem key={value} onSelect={() => onAction(action)}>
              <Icon className="mr-2 h-4 w-4" />
              <span>{label}</span>
              {activeTab === value && (
                <Badge className="ml-auto rounded-full bg-primary/15 px-2 py-0 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-primary">
                  Current
                </Badge>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Focus metric">
          {focusMetricOptions.map(({ value, label, icon: Icon }) => (
            <CommandItem key={value} onSelect={() => onAction(`focus-${value}`, value)}>
              <Icon className="mr-2 h-4 w-4" />
              <span>{label}</span>
              {filters.focusMetric === value && <CommandShortcut>Selected</CommandShortcut>}
            </CommandItem>
          ))}
          <CommandItem onSelect={() => onAction("clear-filters")}>
            <Eraser className="mr-2 h-4 w-4" />
            <span>Clear filters</span>
          </CommandItem>
        </CommandGroup>

        {quickQueries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick actions">
              {quickQueries.map(({ label, prompt }) => (
                <CommandItem key={`${label}-${prompt}`} onSelect={() => onAction("prefill-query", prompt)}>
                  <Compass className="mr-2 h-4 w-4" />
                  <span className="truncate text-sm">{label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {recentQueries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent queries">
              {recentQueries.map((query) => (
                <CommandItem key={query} onSelect={() => onAction("prefill-query", query)}>
                  <Filter className="mr-2 h-4 w-4" />
                  <span className="truncate text-sm">{query}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
