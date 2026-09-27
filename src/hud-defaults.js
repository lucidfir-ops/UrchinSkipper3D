// Screen-space defaults based on the designer's tablet and Deck arrangements.
// User layouts take precedence; these adapt without rewriting saved positions.
function baselineHudRect(id, width, height, touch, tutorial = false) {
  const r = (left, top, w, h) => ({ left, top, width: w, height: h });
  if (!touch && height < 560) {
    // Short desktop windows need side docks rather than stacking instruments
    // into the action panel. Keep the central working water unobstructed.
    const s = Math.min(1, width / 844),
      rail = 242 * s,
      side = width - 270 * s,
      edge = width - 100 * s,
      mapWidth = 150 * s;
    const short = {
      helmPanel: r(8 * s, 8, 216 * s, 166),
      diverPanel: r(8 * s, 182, 216 * s, Math.min(190, height - 190)),
      timepiecePanel: r(rail, 8, 100 * s, 82),
      depthInstrumentPanel: r(rail + 110 * s, 8, 100 * s, 82),
      throttlePanel: r(rail + 220 * s, 8, 100 * s, 108),
      clock: r(rail, 98, 100 * s, 74),
      sounderPanel: r(rail + 110 * s, 98, 100 * s, 74),
      almanacPanel: r(side, 8, 160 * s, 34),
      groundLegend: r(rail, 122, 148 * s, 112),
      navigation: r(side, 170, 160 * s, 72),
      loadPanel: r(side, height - 138, 100 * s, 62),
      hullPanel: r(side, height - 68, 100 * s, 60),
      speedPanel: r(edge, 8, 92 * s, 80),
      fuelPanel: r(edge, 96, 92 * s, 80),
      currentReadout: r(edge, 184, 92 * s, 74),
      minimapPanel: r(width - mapWidth - 8 * s, height - 120, mapWidth, 112),
      message: r(rail, height - 104, Math.max(200, width - 522 * s), 96),
      help: r(rail, height - 186, Math.max(200, width - 522 * s), 72),
      actionFeedback: r(rail, 124, Math.max(160, width - 570 * s), 66),
      electronics: r(side, 50, 160 * s, 72),
      compassPanel: r(side, 170, 90 * s, 74),
      frankAboard: r(rail, 122, Math.max(200, width - 522 * s), Math.min(150, height - 232)),
    }[id];
    if (short) return short;
  }
  if (id === 'almanacPanel')
    return touch && height < 500 ? r(width - 370, 94, 112, 44) : r(width / 2 - 95, 155, 190, 36);
  if (touch) {
    const short = height < 500,
      map = short ? 126 : Math.min(240, width * 0.21),
      start = map + 14,
      available = width - start - 244,
      cell = Math.max(64, available / 5),
      gaugeH = short ? 76 : 104;
    const strip = [
      'timepiecePanel',
      'speedPanel',
      'throttlePanel',
      'fuelPanel',
      'depthInstrumentPanel',
    ];
    if (strip.includes(id)) return r(start + strip.indexOf(id) * cell, 6, cell - 4, gaugeH);
    return {
      minimapPanel: r(6, 6, map, short ? 128 : map + 44),
      clock: r(start, gaugeH + 16, 145, 76),
      sounderPanel: r(start + 152, gaugeH + 16, 145, 76),
      electronics: short ? r(start + 6, 184, 140, 50) : r(width - 236, 52, 144, 94),
      currentReadout: r(width - 86, 52, 80, short ? 74 : 100),
      helmPanel: r(width * 0.6, height - 48, width * 0.4 - 6, 44),
      diverPanel: r(6, height - 48, width * 0.6 - 12, 44),
      frankAboard: r(
        start,
        gaugeH + 14,
        short ? Math.min(290, width * 0.34) : width * 0.4,
        short ? 150 : 186,
      ),
      message: short
        ? r(start + 6, 90, Math.min(220, width * 0.27), 86)
        : r(width * 0.25, height - 234, width * 0.37, 84),
      help: r(
        short && tutorial ? width - 236 : width * 0.25,
        short && tutorial ? 90 : height - (short ? 256 : 294),
        short && tutorial ? 230 : width * 0.4,
        short && tutorial ? 112 : short ? 62 : 64,
      ),
      groundLegend: short ? r(width - 250, 90, 144, 96) : r(width - 176, 164, 170, 104),
      navigation: short ? r(6, 140, 126, 60) : r(start, gaugeH + 14, 214, 64),
      actionFeedback: short
        ? r(width - 370, 194, 264, 40)
        : r(width * 0.64, height * 0.36, 180, 56),
      compassPanel: r(start, height * 0.38, 120, 112),
      hullPanel: r(
        short ? 6 : start + 128,
        short ? 144 : height * 0.38,
        short ? 65 : 120,
        short ? 58 : 112,
      ),
      loadPanel: r(
        short ? start + 156 : start + 256,
        short ? 184 : height * 0.38,
        short ? 70 : 120,
        short ? 50 : 112,
      ),
    }[id];
  }
  // Three.js edition: reserve the centre for the working water, group the
  // helm/crew on the left, and keep navigation instruments in aligned rails.
  // These defaults never replace a player's saved layout; touch remains above.
  const margin = 16,
    left = Math.min(280, width * 0.245),
    gauge = Math.min(128, width * 0.105),
    top = height < 580 ? 90 : 104,
    rail = left + margin + 12,
    right = width - gauge - margin,
    compact = height < 650,
    helmHeight = compact ? 181 : 202,
    crewTop = helmHeight + margin + 10,
    crewHeight = compact ? 174 : 190,
    extraTop = crewTop + crewHeight + 12;
  return {
    helmPanel: r(margin, margin, left, helmHeight),
    diverPanel: r(margin, crewTop, left, crewHeight),
    timepiecePanel: r(rail, margin, gauge, top),
    clock: r(rail, top + margin + 10, gauge * 1.15, 76),
    depthInstrumentPanel: r(rail + gauge + 10, margin, gauge, top),
    sounderPanel: r(rail + gauge * 1.15 + 10, top + margin + 10, gauge, 76),
    throttlePanel: r(rail + gauge * 2 + 20, margin, gauge, top + 20),
    electronics: r(width - gauge * 1.7 - margin, margin, gauge * 1.7, top - 8),
    speedPanel: r(right, top + margin + 14, gauge, 105),
    fuelPanel: r(right, top + margin + 129, gauge, 105),
    currentReadout: r(right, top + margin + 244, gauge, 94),
    minimapPanel: r(
      width - Math.min(224, height * 0.28) - margin,
      height - Math.min(224, height * 0.28) - 48,
      Math.min(224, height * 0.28),
      Math.min(224, height * 0.28) + 32,
    ),
    frankAboard: r(rail, top + margin + 16, width - rail - gauge - margin * 2, height * 0.27),
    message: r(margin, height - 112, Math.min(440, width * 0.38), 96),
    help: r(width * 0.35, height - 94, width * 0.35, 78),
    navigation: r(rail, tutorial ? top + height * 0.3 + 16 : top + margin + 14, 220, 64),
    groundLegend: r(rail, height - 236, 190, 112),
    actionFeedback: r(width * 0.64, height * 0.4, 180, 72),
    compassPanel: r(rail, height * 0.48, 120, 108),
    hullPanel: r(margin, extraTop, left * 0.47, 108),
    loadPanel: r(margin + left * 0.53, extraTop, left * 0.47, 108),
  }[id];
}

export function defaultHudRect(id, width, height, touch, tutorial = false, controlsTop) {
  let rect;
  if (touch && width < height) {
    const cell = (width - 20) / 5,
      controls =
        controlsTop === undefined
          ? 64 + ((width <= 700 ? 225 : 170) * touchScale()) / 100
          : height - controlsTop + 10;
    const top = [
      'timepiecePanel',
      'speedPanel',
      'throttlePanel',
      'fuelPanel',
      'depthInstrumentPanel',
    ];
    if (top.includes(id))
      rect = { left: 4 + top.indexOf(id) * (cell + 3), top: 50, width: cell, height: 65 };
    else
      rect = {
        minimapPanel: { left: 4, top: 122, width: 100, height: 110 },
        clock: { left: 110, top: 122, width: 134, height: 68 },
        sounderPanel: { left: 250, top: 122, width: width - 254, height: 68 },
        diverPanel: { left: 4, top: height - 52, width: width - 8, height: 48 },
        helmPanel: { left: 110, top: 198, width: width - 114, height: 45 },
        hullPanel: { left: 4, top: 240, width: 74, height: 68 },
        loadPanel: { left: 110, top: 122, width: 74, height: 68 },
        currentReadout: { left: width - 78, top: 122, width: 74, height: 68 },
        electronics: { left: 154, top: 308, width: width - 160, height: 48 },
        actionFeedback: { left: 154, top: 252, width: width - 160, height: 46 },
        frankAboard: {
          left: 6,
          top: 312,
          width: width - 12,
          height: Math.min(160, height - 312 - controls),
        },
        message: { left: 6, top: height - controls - 80, width: width - 12, height: 80 },
        navigation: { left: 4, top: 366, width: 140, height: 74 },
        groundLegend: { left: 4, top: 252, width: 140, height: 106 },
        help: { left: 6, top: height - controls - 125, width: width - 12, height: 54 },
      }[id];
  }
  rect ||= baselineHudRect(id, width, height, touch, tutorial);
  return rect;
}
import { touchScale } from './touch-scale.js';
