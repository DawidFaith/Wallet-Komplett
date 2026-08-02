import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/home(.*)', '/admin(.*)']);
const isApiRoute = createRouteMatcher(['/api(.*)']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export default clerkMiddleware(async (auth, req) => {
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
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
