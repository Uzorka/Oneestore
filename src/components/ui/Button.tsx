import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The action hierarchy, enforced by the type system.
 *
 * One primary per screen. Secondary is outlined, tertiary is text only. A
 * screen with two primaries has no primary, so `variant` is the whole API —
 * there is no way to ask for a filled Clay button that is not the main thing
 * on the page.
 */
export type ButtonVariant = "primary" | "secondary" | "tertiary";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-clay text-white shadow-[0_7px_20px_rgb(198_74_38_/_0.28)] hover:bg-clay-deep active:translate-y-px",
  secondary: "bg-paper text-ink border-[1.5px] border-abyss hover:bg-sand",
  tertiary: "bg-transparent text-lagoon hover:text-abyss",
};

const SIZES = {
  lg: "min-h-[54px] px-6 text-[15.5px]",
  md: "min-h-12 px-5 text-sm",
  sm: "min-h-11 px-4 text-[13px]",
} as const;

interface CommonProps {
  variant?: ButtonVariant;
  size?: keyof typeof SIZES;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

function classesFor({
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  className = "",
}: CommonProps & { disabled?: boolean }): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-control font-bold",
    "transition-[transform,background-color,opacity] duration-[var(--m-fast)] ease-[var(--ease-fast)]",
    SIZES[size],
    disabled ? "cursor-not-allowed bg-line text-ink-faint shadow-none" : VARIANTS[variant],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className = "",
  children,
  disabled,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  const isDisabled = disabled === true || loading;

  return (
    <button
      type="button"
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={classesFor({ variant, size, fullWidth, className, disabled: isDisabled, children })}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** The same hierarchy for something that navigates rather than acts. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
}: CommonProps & { href: string }) {
  return (
    <Link
      href={href}
      className={classesFor({ variant, size, fullWidth, className, children })}
    >
      {children}
    </Link>
  );
}
