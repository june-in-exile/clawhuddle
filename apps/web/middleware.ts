import { auth } from '@/lib/auth';

export default auth((req) => {
  if (!req.auth) {
    const url = req.url.replace(req.nextUrl.pathname, '/login');
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ['/chat/:path*', '/admin/:path*', '/settings/:path*'],
};
