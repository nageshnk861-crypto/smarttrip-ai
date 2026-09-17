import { NextResponse } from 'next/server';
import { getSession } from './lib/auth';

// Middleware to check authentication
export async function middleware(req) {
    const session = await getSession(req);

    // If the user is not authenticated, redirect to the login page
    if (!session) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    // Allow the request to continue
    return NextResponse.next();
}

// Define the paths that should use the middleware
export const config = {
    matcher: ['/dashboard/:path*', '/planner/:path*'],
};