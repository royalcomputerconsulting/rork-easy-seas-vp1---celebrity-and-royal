const BACKEND_TARGET = 'https://rork-easy-seas-vp1-2nep.onrender.com';
const API_PREFIX = '/api';

declare const Deno: {
  serve: (options: { port: number }, handler: (request: Request) => Response | Promise<Response>) => unknown;
  env?: {
    get: (name: string) => string | undefined;
  };
};

function buildCorsHeaders(request: Request): Headers {
  const origin = request.headers.get('origin') ?? '*';
  const requestHeaders = request.headers.get('access-control-request-headers') ?? 'content-type, authorization, trpc-accept';
  const headers = new Headers();

  headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set('access-control-allow-headers', requestHeaders);
  headers.set('access-control-max-age', '86400');
  headers.set('vary', 'Origin, Access-Control-Request-Headers');

  return headers;
}

function normalizeProxyPath(pathname: string): string {
  if (pathname === API_PREFIX) {
    return '/';
  }

  if (pathname.startsWith(`${API_PREFIX}/`)) {
    return pathname.slice(API_PREFIX.length) || '/';
  }

  return pathname;
}

async function proxyRequest(request: Request): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const normalizedPathname = normalizeProxyPath(incomingUrl.pathname);
  const targetUrl = `${BACKEND_TARGET}${normalizedPathname}${incomingUrl.search}`;
  const method = request.method.toUpperCase();

  console.log('[BackendProxy] Forwarding request:', {
    method,
    pathname: incomingUrl.pathname,
    normalizedPathname,
    search: incomingUrl.search,
    targetUrl,
  });

  const headers = new Headers(request.headers);
  headers.delete('host');

  const shouldIncludeBody = method !== 'GET' && method !== 'HEAD';
  const body = shouldIncludeBody ? await request.arrayBuffer() : undefined;

  const upstreamResponse = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: 'follow',
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  const corsHeaders = buildCorsHeaders(request);
  corsHeaders.forEach((value, key) => {
    responseHeaders.set(key, value);
  });

  console.log('[BackendProxy] Upstream response:', {
    method,
    pathname: incomingUrl.pathname,
    normalizedPathname,
    status: upstreamResponse.status,
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

const port = parseInt(Deno.env?.get('PORT') ?? '3000', 10);

console.log('[BackendProxy] Starting proxy server on port', port);
console.log('[BackendProxy] Upstream target:', BACKEND_TARGET);

Deno.serve({ port }, async (request: Request) => {
  const incomingUrl = new URL(request.url);

  if (request.method.toUpperCase() === 'OPTIONS') {
    console.log('[BackendProxy] Handling CORS preflight for', incomingUrl.pathname);
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(request),
    });
  }

  try {
    return await proxyRequest(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[BackendProxy] Request failed:', {
      method: request.method,
      pathname: incomingUrl.pathname,
      normalizedPathname: normalizeProxyPath(incomingUrl.pathname),
      message,
    });

    const headers = buildCorsHeaders(request);
    headers.set('content-type', 'application/json');

    return new Response(JSON.stringify({
      group: 'api',
      code: 'proxy_error',
      message: 'The backend proxy could not complete the request',
      details: message,
    }), {
      status: 502,
      headers,
    });
  }
});
