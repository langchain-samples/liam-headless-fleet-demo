// Next.js 16 renamed the `middleware` file convention to `proxy`.
// NextAuth's `auth` helper is the request handler; re-export it as `proxy`.
export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    // Gate everything EXCEPT: NextAuth routes, Next internals, and static
    // public assets (images/fonts) — the login page is shown logged-out and
    // must be able to load /dunder-mifflin-banner.png, /icon.png, avatars, etc.
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)",
  ],
};
