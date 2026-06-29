"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Loader2, Lock } from "lucide-react";
import { DunderMifflinLogo } from "@/components/brand/DunderMifflinLogo";
import { Button, Card, CardBody } from "@/components/ui";

// Branded sign-in screen for the Headless Fleet demo. Replaces NextAuth's
// default page (wired via `pages.signIn` in auth.ts). Rendered standalone —
// AppShell skips its chrome for /login.
export default function LoginPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Where to land after a successful sign-in. We read NextAuth's callbackUrl
  // but only honor it when it's a relative same-origin path, so a crafted
  // ?callbackUrl=https://evil.example can't turn this into an open redirect.
  const callbackUrl = React.useMemo(() => {
    if (typeof window === "undefined") return "/";
    const raw = new URLSearchParams(window.location.search).get("callbackUrl");
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return "/";
  }, []);

  // Surface NextAuth's ?error=... (e.g. AccessDenied for a non-allowed domain).
  React.useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code === "AccessDenied") {
      setError("That account isn't allowed. Use your Dunder Mifflin (@langchain.dev) Google account.");
    } else if (code) {
      setError("Sign-in failed. Please try again.");
    }
  }, []);

  function handleSignIn() {
    setLoading(true);
    setError(null);
    void signIn("google", { callbackUrl });
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4 py-10">
      {/* Soft paper-and-navy backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, var(--color-paper-2), transparent 60%), radial-gradient(800px 500px at 110% 110%, var(--color-accent-soft), transparent 55%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <DunderMifflinLogo className="mb-6 w-[380px] max-w-[88vw]" />
          <h1 className="font-serif text-3xl font-bold tracking-tight text-navy">
            Headless Fleet Demo
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Build and run agents for Dunder Mifflin Paper Co.
          </p>
        </div>

        <Card className="shadow-[0_8px_30px_rgba(11,37,69,0.08)]">
          <CardBody className="pt-5">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleSignIn}
              loading={loading}
              aria-label="Continue with Google"
            >
              {!loading && <GoogleMark />}
              Continue with Google
            </Button>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-[8px] border border-bad/30 bg-bad-soft px-3 py-2 text-[13px] text-bad"
              >
                {error}
              </p>
            )}

            <div className="mt-4 flex items-start gap-2 rounded-[8px] bg-paper-2 px-3 py-2.5 text-[12px] text-ink-soft">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
              <span>
                Restricted to <span className="font-medium text-ink">@langchain.dev</span> Google
                accounts. Other accounts will be declined.
              </span>
            </div>
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-[11px] text-ink-faint">
          Powered by{" "}
          <a
            href="https://api.smith.langchain.com/v1/fleet/docs/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="dm-focus rounded font-medium text-ink-soft underline decoration-line-strong underline-offset-2 transition-colors hover:text-navy hover:decoration-navy"
          >
            LangChain Headless Fleet
          </a>
        </p>
      </div>
    </main>
  );
}

/** Multi-color Google "G" mark, sized to sit inside the button. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="#FFC107"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#FF3D00"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
        transform="translate(0 0)"
      />
      <path fill="#4CAF50" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" />
      <path fill="#1976D2" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
