import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// TODO: add rate limiting
export function middleware(request: NextRequest) {
  // Log requests in development
  if (process.env.NODE_ENV === "development") {
    console.log(`[${request.method}] ${request.nextUrl.pathname}`);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
