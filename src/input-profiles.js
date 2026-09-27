// Add newly introduced actions to a stored device profile without dropping its
// confirmed physical mappings. Missing optional shortcuts yield to existing ones.
export function migrateInputProfile(profile, defaults, validCode, overlaps, standard) {
  if (
    !profile?.map ||
    typeof profile.map !== 'object' ||
    !profile.map.work ||
    !profile.map.recoverDiver
  )
    return null;
  for (const [action, codes] of Object.entries(profile.map)) {
    if (!(action in defaults)) continue;
    if (!Array.isArray(codes) || !codes.every(validCode)) return null;
  }
  const migrated = structuredClone(profile),
    map = migrated.map;
  if (
    !map.assists &&
    !migrated.explicit?.includes('quickOrders') &&
    map.quickOrders?.length === 2 &&
    map.quickOrders.includes('KeyO') &&
    map.quickOrders.includes('b11')
  )
    map.quickOrders = ['KeyO'];
  for (const [action, codes] of Object.entries(defaults)) {
    if (map[action]) continue;
    map[action] = codes.filter(
      (code) =>
        (standard || !/^(b\d+|a\d+[+-])$/.test(code)) &&
        !Object.entries(map).some(
          ([other, saved]) =>
            other in defaults &&
            other !== action &&
            overlaps(action, other) &&
            saved.includes(code),
        ),
    );
  }
  return migrated;
}
