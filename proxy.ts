// Next.js 16 renamed the `middleware` file convention to `proxy`.
// NextAuth's `auth` helper is the request handler; re-export it as `proxy`.
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
