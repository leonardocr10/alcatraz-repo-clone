import { Sun, Sunset, Moon } from "lucide-react";

const SCHEDULE_OPTIONS = [
  { value: "manha", label: "Manhã", icon: Sun },
  { value: "tarde", label: "Tarde", icon: Sunset },
  { value: "noite", label: "Noite", icon: Moon },
] as const;

interface Props {
  selected: string[];
  onChange: (schedule: string[]) => void;
  size?: "sm" | "md";
}

export function PlayScheduleSelector({ selected, onChange, size = "md" }: Props) {
  const toggle = (val: string) => {
    onChange(
      selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val]
    );
  };

  const btnSize = size === "sm" ? "p-2" : "p-3";
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const textSize = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <div className="grid grid-cols-3 gap-2">
      {SCHEDULE_OPTIONS.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`flex flex-col items-center gap-1 ${btnSize} rounded-xl border transition-all ${
              active
                ? "border-primary bg-primary/15 shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                : "border-border/40 hover:border-muted-foreground/30"
            }`}
          >
            <opt.icon className={`${iconSize} ${active ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`${textSize} font-display font-bold uppercase tracking-wider ${active ? "text-primary" : "text-muted-foreground"}`}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
