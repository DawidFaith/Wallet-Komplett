import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { logAdminAccess } from '@/app/lib/adminAudit';

const isProtectedRoute = createRouteMatcher(['/home(.*)', '/admin(.*)']);
const isApiRoute = createRouteMatcher(['/api(.*)']);
const isAdminApiRoute = createRouteMatcher(['/api/admin(.*)']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export default clerkMiddleware(async (auth, req, event) => {
  if (isProtectedRoute(req)) {
    const session = await auth();
    session.protect();
  }

  // CSRF-Schutz: state-ändernde API-Aufrufe, die der Browser als
  // cross-site markiert, werden geblockt (Fetch-Metadata-Header —
  // vom Client nicht fälschbar). Server-zu-Server-Aufrufe (Stripe-Webhook,
  // eigene Admin-Skripte) senden diesen Header gar nicht und sind ausgenommen.
  if (isApiRoute(req) && !SAFE_METHODS.has(req.method)) {
    if (req.headers.get('sec-fetch-site') === 'cross-site') {
      return NextResponse.json({ error: 'Cross-site request blocked' }, { status: 403 });
    }
  }

  // Audit-Log: jeder Zugriff auf /api/admin/* wird protokolliert (IP, Route,
  // ob das mitgeschickte Secret gültig war), unabhängig vom Ergebnis der
  // eigentlichen Route. Manche Admin-Routen nehmen das Secret im Body statt
  // im Header/Query entgegen — dort bleibt secretValid absichtlich `null`
  // (unbekannt hier), die Route prüft es wie bisher selbst.
  if (isAdminApiRoute(req)) {
    const headerSecret = req.headers.get('x-admin-secret');
    const querySecret = req.nextUrl.searchParams.get('secret');
    const providedSecret = headerSecret ?? querySecret;
    const secretValid = providedSecret !== null ? providedSecret === process.env.MIGRATION_SECRET : null;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

    event.waitUntil(
      logAdminAccess({
        route: req.nextUrl.pathname,
        method: req.method,
        ip,
        secretValid,
        statusCode: null,
      })
    );
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
