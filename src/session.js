export async function exitSession(location = window.location, request = fetch) {
  const params = new URLSearchParams(location.hash.slice(1));
  const port = params.get('sessionPort'),
    token = params.get('sessionToken');
  const fallback =
    'SESSION ENDED — You can close this browser tab or return to the title. On Steam Deck, press Steam → Exit Game.';
  if (!/^\d+$/.test(port || '') || !token) return fallback;
  try {
    const response = await request(`http://127.0.0.1:${port}/exit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error('exit refused');
    return 'SESSION ENDED — Closing the game window. If it remains open, press Steam → Exit Game.';
  } catch {
    return `${fallback} The launcher could not be reached.`;
  }
}
