import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";

/** Official Dunder Mifflin banner wordmark. */
export function DunderMifflinLogo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Image
      src="/dunder-mifflin-banner.png"
      alt="Dunder Mifflin"
      width={387}
      height={111}
      priority
      sizes="320px"
      className={cn(
        "h-auto select-none rounded",
        compact ? "w-[150px]" : "w-full max-w-[200px]",
        className,
      )}
    />
  );
}
