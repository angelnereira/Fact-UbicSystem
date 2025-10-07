import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-lg font-semibold font-headline",
        className
      )}
    >
      <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Zap className="h-4 w-4" />
      </div>
      <span className="group-data-[collapsible=icon]:hidden">
        Fact-UbicSystem
      </span>
    </div>
  );
}
