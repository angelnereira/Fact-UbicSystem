import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string;
  icon: LucideIcon;
  description: string;
  progress?: number;
  status?: "success" | "warning" | "danger";
};

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  progress,
  status,
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold flex items-center gap-2">
          {status && (
            <span
              className={cn("h-2 w-2 rounded-full", {
                "bg-green-500": status === "success",
                "bg-yellow-500": status === "warning",
                "bg-red-500": status === "danger",
              })}
            />
          )}
          {value}
        </div>
        <p className="text-xs text-muted-foreground pt-1">{description}</p>
        {progress !== undefined && (
          <Progress value={progress} className="mt-4 h-2" />
        )}
      </CardContent>
    </Card>
  );
}
