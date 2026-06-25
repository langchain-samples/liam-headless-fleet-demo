"use client";
// Dunder Mifflin design-system primitives. Import from "@/components/ui".
import * as React from "react";
import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";

export { cn };

// Re-export the rest of the design system from the barrel so a single
// `@/components/ui` import works for every primitive.
export { useToast, ToastProvider } from "./Toast";
export { Dialog, ConfirmDialog } from "./Dialog";
export { Table, THead, TR, TH, TD } from "./Table";

/* ----------------------------- Button ----------------------------- */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const btnBase =
  "dm-focus inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all disabled:opacity-50 disabled:pointer-events-none select-none active:translate-y-px";
const btnVariants: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white hover:bg-navy-600 shadow-sm",
  secondary: "bg-card text-ink border border-line-strong hover:bg-paper-2",
  ghost: "text-ink-soft hover:bg-paper-2 hover:text-ink",
  danger: "bg-bad text-white hover:brightness-110 shadow-sm",
  accent: "bg-accent text-white hover:brightness-105 shadow-sm",
};
const btnSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-9 w-9 p-0",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(btnBase, btnVariants[variant], btnSizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 dm-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

/* ----------------------------- Card ------------------------------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-card shadow-[0_1px_2px_rgba(20,33,61,0.04)]",
        className,
      )}
      {...props}
    />
  );
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pt-5 pb-3", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[15px] font-semibold text-ink tracking-tight", className)} {...props} />;
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

/* ----------------------------- Badge ------------------------------ */
type BadgeTone = "neutral" | "navy" | "good" | "warn" | "bad" | "accent";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-paper-2 text-ink-soft border-line-strong",
  navy: "bg-navy/10 text-navy border-navy/20",
  good: "bg-good-soft text-good border-good/30",
  warn: "bg-warn-soft text-warn border-warn/30",
  bad: "bg-bad-soft text-bad border-bad/30",
  accent: "bg-accent-soft text-[#7a5a08] border-accent/30",
};
export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

/* --------------------------- Inputs ------------------------------- */
const fieldBase =
  "dm-focus w-full rounded-[10px] border border-line-strong bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-navy-400";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, "min-h-[90px] resize-y font-mono text-[13px]", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(fieldBase, "h-10 cursor-pointer appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-ink-soft", className)} {...props} />;
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="mt-1 text-[12px] text-ink-faint">{hint}</p>}
    </div>
  );
}

/* --------------------------- Spinner / Skeleton ------------------- */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 dm-spin text-ink-faint", className)} />;
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("dm-skeleton rounded-md", className)} />;
}

/* --------------------------- Tabs --------------------------------- */
export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 border-b border-line", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "dm-focus relative -mb-px px-3.5 py-2.5 text-[13px] font-medium transition-colors",
            value === t.id ? "text-navy" : "text-ink-faint hover:text-ink-soft",
          )}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span className="ml-1.5 text-[11px] text-ink-faint">{t.count}</span>
          )}
          {value === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-navy" />}
        </button>
      ))}
    </div>
  );
}

/* --------------------------- EmptyState --------------------------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-paper-2/40 px-6 py-14 text-center",
        className,
      )}
    >
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-faint">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
