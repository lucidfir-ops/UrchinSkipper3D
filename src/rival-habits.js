export function rivalHabit(team) {
  if (team?.hidden) return 'mystery';
  return ['team-1', 'team-4'].includes(team?.teamId || team?.id) ? 'encroaching' : 'independent';
}
export function workingPatches(w) {
  return w.patches.filter(
    (p) =>
      p.remaining > 0 &&
      w.divers.some((d) => d.patch?.id === p.id && !['ready', 'fatality'].includes(d.state)),
  );
}
