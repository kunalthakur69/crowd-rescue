import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Role-to-dashboard mapping
const ROLE_DASHBOARDS: Record<string, string> = {
  student: "/dashboard/student",
  SecurityGuard: "/dashboard/SecurityGuard",
  ambulance: "/dashboard/ambulance",
};

// Dashboard paths that require authentication
const PROTECTED_PATHS = [
  "/dashboard/student",
  "/dashboard/SecurityGuard",
  "/dashboard/ambulance",
];
const AUTH_PAGES = ["/signin", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth-token")?.value;

  // If the user is on a protected dashboard page
  const isProtectedPath = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (isProtectedPath) {
    if (!token) {
      // Not authenticated — redirect to signin
      return NextResponse.redirect(new URL("/signin", request.url));
    }

    try {
      // Decode JWT payload (without verification — verification happens on the server)
      // Middleware runs on the Edge, so we only do a basic decode here
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64").toString(),
      );
      const userRole = payload.role;

      // Check if the user has the correct role for this dashboard
      const allowedPath = ROLE_DASHBOARDS[userRole];
      if (allowedPath && !pathname.startsWith(allowedPath)) {
        // Redirect to the correct dashboard for their role
        return NextResponse.redirect(new URL(allowedPath, request.url));
      }
    } catch {
      // Invalid token — redirect to signin
      const response = NextResponse.redirect(new URL("/signin", request.url));
      response.cookies.delete("auth-token");
      return response;
    }
  }

  // If the user is on signin/signup but already authenticated, redirect to dashboard
  if (isAuthPage && token) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64").toString(),
      );
      const userRole = payload.role;
      const dashboardPath = ROLE_DASHBOARDS[userRole];
      if (dashboardPath) {
        return NextResponse.redirect(new URL(dashboardPath, request.url));
      }
    } catch {
      // Invalid token — let them proceed to auth pages
      const response = NextResponse.next();
      response.cookies.delete("auth-token");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/signin", "/signup"],
};
