import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Using process.env directly here because middleware runs on Edge
// and might have issues importing heavy server-side validation schemas
// depending on their dependencies, though zod usually works.
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "session";

const publicRoutes = ["/login", "/forgot-password", "/reset-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip API routes, static files, images, etc.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".") // crude check for files
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE_NAME);
  const isPublicRoute = publicRoutes.includes(pathname);

  // 1. Unauthenticated user trying to access protected route -> redirect to login
  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 2. Authenticated user trying to access login -> redirect to dashboard
  if (session && isPublicRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
