import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ADMIN_HOSTS = ["admin.localhost:3000", "topofword.com"];
const ADMIN_ROUTE_PREFIXES = ["/admin", "/api/admin"];
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SHARED_ROUTE_PREFIXES = [
  "/api/auth",
  "/password-reset",
  "/sign-in",
  "/verify-email",
];

export function middleware(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host"));
  const pathname = request.nextUrl.pathname;
  const requestHeaders = createForwardHeaders(request, pathname);
  const adminHosts = getAdminHosts();
  const isAdminHost = adminHosts.includes(host);

  const csrfError = validateSameOriginMutation(request, pathname);
  if (csrfError) {
    return withSecurityHeaders(csrfError);
  }

  if (isAdminHost) {
    return withSecurityHeaders(routeAdminHostRequest(request, pathname, requestHeaders));
  }

  const adminBaseUrl = normalizeBaseUrl(process.env.ADMIN_BASE_URL);
  const currentBaseUrl = normalizeBaseUrl(request.nextUrl.origin);

  if (
    adminBaseUrl &&
    adminBaseUrl !== currentBaseUrl &&
    ADMIN_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    const redirectUrl = new URL(`${pathname}${request.nextUrl.search}`, adminBaseUrl);
    return withSecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  return withSecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

function routeAdminHostRequest(
  request: NextRequest,
  pathname: string,
  requestHeaders: Headers,
) {
  if (pathname === "/") {
    return rewriteTo(request, "/admin", requestHeaders);
  }

  if (
    ADMIN_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    SHARED_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return rewriteTo(request, `/admin${pathname}`, requestHeaders);
}

function rewriteTo(request: NextRequest, pathname: string, requestHeaders: Headers) {
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = pathname;
  return NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders,
    },
  });
}

function createForwardHeaders(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-gg-pathname", pathname);
  return requestHeaders;
}

function getAdminHosts() {
  const configuredHosts = process.env.ADMIN_HOSTS?.split(",")
    .map(normalizeHost)
    .filter(Boolean);

  return configuredHosts?.length ? configuredHosts : DEFAULT_ADMIN_HOSTS;
}

function normalizeHost(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function normalizeBaseUrl(value?: string) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return "";
  }

  return trimmedValue.endsWith("/") ? trimmedValue.slice(0, -1) : trimmedValue;
}

function validateSameOriginMutation(request: NextRequest, pathname: string) {
  if (!pathname.startsWith("/api/") || !MUTATING_METHODS.has(request.method)) {
    return null;
  }

  const requestOrigin = normalizeOrigin(request.nextUrl.origin);
  const allowedOrigins = new Set(
    [
      requestOrigin,
      normalizeOrigin(process.env.GGITEM_BASE_URL),
      normalizeOrigin(process.env.ADMIN_BASE_URL),
      normalizeOrigin(process.env.NEXT_PUBLIC_ADMIN_BASE_URL),
    ].filter(Boolean),
  );

  const headerOrigin =
    normalizeOrigin(request.headers.get("origin")) ||
    normalizeOriginFromReferer(request.headers.get("referer"));

  if (!headerOrigin) {
    return null;
  }

  if (!allowedOrigins.has(headerOrigin)) {
    return NextResponse.json(
      { message: "요청 출처를 확인할 수 없습니다." },
      { status: 403 },
    );
  }

  return null;
}

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  return response;
}

function normalizeOrigin(value?: string | null) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return "";
  }

  try {
    return new URL(trimmedValue).origin.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeOriginFromReferer(value?: string | null) {
  return normalizeOrigin(value);
}
