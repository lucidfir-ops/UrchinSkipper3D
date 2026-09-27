try {
  const response = await fetch(process.argv[2], { signal: AbortSignal.timeout(500) });
  const html = await response.text();
  process.exitCode =
    response.ok &&
    html.includes('name="urchin-skipper-app" content="deck-playtest-3d"') &&
    (!process.argv.includes('--production') ||
      (response.headers.get('x-urchin-build') === 'production' &&
        response.headers.get('x-urchin-edition') === 'three'))
      ? 0
      : 1;
} catch {
  process.exitCode = 1;
}
