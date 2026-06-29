"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";

// Sign-out control for the sidebar footer. Clears the session and sends the
// user back to the branded /login screen.
export function LogoutButton({ className }: { className?: string }) {
  const [loading, setLoading] = React.useState(false);

  return (
    <button
      type="button"
      title="Log out"
      aria-label="Log out"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        void signOut({ callbackUrl: "/login" });
      }}
      className={cn(
        "dm-focus flex h-9 w-full items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-card text-[13px] font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <LogOut className="h-4 w-4" />
      Log out
    </button>
  );
}
