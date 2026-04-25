const SEA_PASS_APPROVED_SHELL_SOURCE_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/2odahwrylhqkr8gb1jwp4.png';

app.get('/seapass-approved-shell', async (c) => {
  console.log('[Hono] SeaPass approved shell proxy requested');

  try {
    const response = await fetch(SEA_PASS_APPROVED_SHELL_SOURCE_URL);

    if (!response.ok || !response.body) {
      console.error('[Hono] SeaPass approved shell proxy failed', {
        status: response.status,
      });
      return c.text('Unable to load approved SeaPass shell', 502);
    }

    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('content-type') ?? 'image/png');
    headers.set('Cache-Control', 'public, max-age=86400');

    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[Hono] SeaPass approved shell proxy error', error);
    return c.text('Unable to load approved SeaPass shell', 502);
  }
});
