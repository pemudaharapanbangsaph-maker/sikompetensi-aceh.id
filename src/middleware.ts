import {
  NextResponse,
} from "next/server";

import type {
  NextRequest,
} from "next/server";

const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/2fa/verify-login",
  "/api/2fa/verify-setup",
  "/api/portal/pendaftaran",
  "/api/portal/pelatihan-list",
  "/api/programs/public",
  "/api/settings/logo",
];

const SETUP_ROUTES = [
  "/api/setup-db",
  "/api/seed",
];

function matchesRoute(
  pathname: string,
  route: string
): boolean {
  return (
    pathname === route ||
    pathname.startsWith(`${route}/`)
  );
}

function isRouteMatched(
  pathname: string,
  routes: string[]
): boolean {
  return routes.some((route) =>
    matchesRoute(pathname, route)
  );
}

export function middleware(
  request: NextRequest
) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const isPublic = isRouteMatched(
    pathname,
    PUBLIC_ROUTES
  );

  if (isPublic) {
    return NextResponse.next();
  }

  const isSetup = isRouteMatched(
    pathname,
    SETUP_ROUTES
  );

  if (isSetup) {
    const authHeader =
      request.headers.get("authorization");

    const queryToken =
      request.nextUrl.searchParams.get(
        "token"
      );

    const seedToken =
      process.env.SEED_TOKEN;

    if (!seedToken) {
      return NextResponse.json(
        {
          error:
            "Endpoint tidak tersedia",
        },
        {
          status: 404,
        }
      );
    }

    const bearerToken =
      authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : undefined;

    const token =
      bearerToken || queryToken;

    if (token !== seedToken) {
      return NextResponse.json(
        {
          error: "Akses ditolak",
        },
        {
          status: 403,
        }
      );
    }

    return NextResponse.next();
  }

  const sessionCookie =
    request.cookies.get(
      "bpsdm_session"
    );

  if (!sessionCookie?.value) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
