// Surface reports refer only to this diver's actual work. No live hidden-bed
// lookup: an opinion is a sample, not a promise about the whole ground.
const LINES = {
  ada: {
    good: 'Good colour. Mark that drift.',
    poor: 'Thin pick. Worth another drop?',
    tired: 'A breather before the next one.',
  },
  milo: {
    good: 'Now that’s a bag!',
    poor: 'Swam more than I picked.',
    tired: 'Even I could use a rest.',
  },
  nell: {
    good: 'There’s a useful mark for tomorrow.',
    poor: 'Let’s remember this sample.',
    tired: 'Give the next dive a little time.',
  },
  roy: {
    good: 'Compressor’s earning its keep!',
    poor: 'Plenty of swimming, little picking.',
    tired: 'Time for a warm drink.',
  },
};
const samplePercent = (quality, minimum) =>
  quality + 1e-6 < minimum ? Math.floor(quality * 100 + 1e-6) : Math.round(quality * 100);
export function chatterStyle(d) {
  if (d.crewId === 'nell') return 'quiet';
  if (['milo', 'roy'].includes(d.crewId)) return 'chatty';
  if (d.crewId === 'ada' || !d.crewId) return 'ordinary';
  const hash = [...d.crewId].reduce((sum, c) => sum * 31 + c.charCodeAt(0), d.crewSeed || 0) >>> 0;
  return hash % 5 === 0 ? 'quiet' : hash % 5 === 1 ? 'chatty' : 'ordinary';
}
export function refusalText(d, reason = '') {
  if (/AIR RESERVE/i.test(reason)) return 'Low air. Bring me aboard for a fresh tank.';
  if (/QUALITY/i.test(reason))
    return `${d.groundSample?.quality != null ? samplePercent(d.groundSample.quality, d.minQuality) + '% here' : 'This sample'} — below your ${Math.round(d.minQuality * 100)}% minimum.`;
  if (/BAG TIME|PICKING SLOWER/i.test(reason))
    return `Too slow for your ${d.maxBagSeconds}s bag order. Try another spot.`;
  if (/NO PRODUCTIVE|exhaust/i.test(reason)) return 'Nothing left to pick here. Let’s move.';
  if (/TABLE|INTERVAL|ALLOWANCE|BREAK/i.test(reason))
    return 'I need a surface break before another dive.';
  if (/DARK|FLASHLIGHT/i.test(reason)) return 'Too dark. I need a diver flashlight.';
  if (/NO ROOM|DECK FULL/i.test(reason)) return 'No room aboard for another bag.';
  if (/DFO/i.test(reason)) return 'Inspection boat. Bring me aboard.';
  if (/UNFIT|NEEDS TO COME ABOARD|FISHING ENDED/i.test(reason))
    return 'I need to come aboard. We can’t keep fishing.';
  if (/OUT OF RANGE/i.test(reason)) return 'Come a little closer with the bag.';
  if (/PORT/i.test(reason)) return 'Bring your port side alongside me.';
  if (/SLOW/i.test(reason)) return 'Slow down and match my drift.';
  if (/CLEAR.*HULL/i.test(reason)) return 'Give me room beside the hull.';
  if (/DECK BUSY|CREW BUSY/i.test(reason)) return 'Finish the deck work first.';
  if (/GROUNDED|SHALLOW/i.test(reason)) return 'We need deeper water first.';
  return reason
    ? reason.toLowerCase().replace(/^./, (c) => c.toUpperCase()) + '.'
    : 'Bring me aboard before the next drop.';
}
// Direct questions always get an answer, even from the quiet crew. Repeated
// presses extend one bubble rather than enqueueing speech or radio messages.
export function refusalMoment(w, d, reason) {
  d.speech = { icon: '!', text: refusalText(d, reason), until: w.time + 12 };
}
export function surfaceMoment(w, d) {
  const quality = d.bag ? d.qualitySum / d.bag : (d.groundSample?.quality ?? null),
    seconds = d.lastBagSeconds || 0,
    tired = d.fatigue > 0.55,
    reason = d.reason || '',
    poor = d.bag === 0 || (quality !== null && quality < 0.65),
    mood = tired || /break|interval/i.test(reason) ? 'tired' : poor ? 'poor' : 'good',
    qualityMiss = quality !== null && quality + 1e-6 < d.minQuality,
    speedMiss = d.maxBagSeconds > 0 && seconds > d.maxBagSeconds + 0.05,
    problem = /air reserve|exhaust|break|interval|darkness|swept|search time/i.test(reason),
    key = `${w.career?.day || 0}/${w.day.groundId || 'practice'}/${d.groundSample?.patchId || d.patch?.id || `${Math.round((d.dropX ?? d.x) / 25)},${Math.round((d.dropY ?? d.y) / 25)}`}`,
    signature = JSON.stringify([
      quality === null ? null : Math.round(quality * 20),
      Math.round(seconds / 10),
      qualityMiss,
      speedMiss,
      reason,
      tired,
      d.minQuality,
      d.maxBagSeconds || 0,
    ]),
    reports = (d.speechReports ??= {}),
    changed = reports[key] !== signature,
    style = chatterStyle(d);
  if (!changed && (style !== 'chatty' || w.time < (d.nextBanterAt || 0))) return;
  reports[key] = signature;
  const keys = Object.keys(reports);
  if (keys.length > 32) delete reports[keys[0]];
  const facts = [];
  if (qualityMiss)
    facts.push(
      `${samplePercent(quality, d.minQuality)}% here — below your ${Math.round(d.minQuality * 100)}% minimum.`,
    );
  if (speedMiss) facts.push(refusalText(d, 'BAG TIME'));
  if (problem && !qualityMiss && !speedMiss) {
    facts.push(
      /search time/i.test(reason)
        ? 'Nothing meeting your orders on that search.'
        : /swept/i.test(reason)
          ? 'Current swept me off the picking.'
          : refusalText(d, reason),
    );
  }
  if (!facts.length && changed && quality !== null)
    facts.push(
      `${Math.round(quality * 100)}% sample${seconds ? ` · about ${Math.round(seconds)}s a bag` : ''}.`,
    );
  if (tired && changed) facts.push('I’m tiring. Picking’s getting slower.');
  if (!facts.length && style === 'quiet') return;
  if (!facts.length)
    facts.push(
      (LINES[d.crewId] || {
        good: 'That’s this drift’s sample.',
        poor: 'Not much in this bag.',
        tired: 'A rest before we go again.',
      })[mood],
    );
  d.speech = {
    icon: qualityMiss || speedMiss || poor ? '👎' : mood === 'tired' ? '…' : '👍',
    text: facts.join(' '),
    until: w.time + 12,
    pending: Math.hypot(d.x - w.boat.x, d.y - w.boat.y) >= 28,
  };
  d.nextBanterAt = w.time + 150;
}
