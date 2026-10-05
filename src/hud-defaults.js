// Screen-space defaults based on the designer's tablet and Deck arrangements.
// User layouts take precedence; these adapt without rewriting saved positions.
export const instrumentShelf = (touch) =>
  touch
    ? ['timepiecePanel', 'speedPanel', 'throttlePanel', 'fuelPanel', 'depthInstrumentPanel']
    : [
        'timepiecePanel',
        'depthInstrumentPanel',
        'throttlePanel',
        'speedPanel',
        'fuelPanel',
        'loadPanel',
      ];

function baselineHudRect(id, width, height, touch, tutorial = false, visibleShelf) {
  const r = (left, top, w, h) => ({ left, top, width: w, height: h });
  if (touch && id === 'almanacPanel')
    return height < 500 ? r(width - 370, 94, 112, 44) : r(width / 2 - 95, 155, 190, 36);
  if (touch) {
    const short = height < 500,
      map = short ? 126 : Math.min(240, width * 0.21),
      start = map + 14,
      available = width - start - 244,
      cell = Math.max(64, available / 5),
      gaugeH = short ? 76 : 104;
    const strip = visibleShelf || instrumentShelf(true);
    if (strip.includes(id)) return r(start + strip.indexOf(id) * cell, 6, cell - 4, gaugeH);
    return {
      minimapPanel: r(6, 6, map, short ? 128 : map + 44),
      clock: r(start, gaugeH + 16, 145, 76),
      sounderPanel: r(start + 152, gaugeH + 16, 145, 76),
      electronics: short ? r(start + 6, 184, 140, 50) : r(width - 236, 52, 144, 94),
      currentReadout: r(width - 86, 52, 80, short ? 74 : 100),
      helmPanel: r(width * 0.6, height - 48, width * 0.4 - 6, 44),
      // Two dive slates of at most ~330 px each; wide tablets keep open water.
      diverPanel: r(6, height - 64, Math.min(width * 0.6 - 12, 664), 60),
      frankAboard: r(
        start,
        gaugeH + 14,
        short ? Math.min(290, width * 0.34) : width * 0.4,
        short ? 132 : 186,
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
        short ? 6 : start + 256,
        short ? 140 : height * 0.38,
        short ? 126 : 120,
        short ? 40 : 112,
      ),
    }[id];
  }
  // A working wheelhouse: one instrument shelf, crew to port, navigation to
  // starboard, and open water through the middle. Each remains an independent
  // window. HudWindows applies a saved position/size after these defaults.
  const compact = height < 560,
    margin = compact ? 8 : 14,
    gap = compact ? 6 : 8,
    side = compact ? 176 : Math.min(224, width * 0.19),
    shelfHeight = compact ? 90 : 112,
    wide = width >= 1100 && !compact,
    gauge = (width - margin * 2 - side - gap * 6 - (wide ? side + gap : 0)) / 6,
    start = margin + side + gap,
    right = width - side - margin,
    under = margin + shelfHeight + gap,
    map = compact ? 138 : Math.min(side, height * 0.29),
    dockTop = height - (compact ? 119 : 164),
    crewHeight = compact ? 148 : 242;
  const strip = visibleShelf || instrumentShelf(false);
  if (strip.includes(id))
    return r(start + strip.indexOf(id) * (gauge + gap), margin, gauge, shelfHeight);
  if (compact) {
    const compactWindows = {
      diverPanel: r(margin, under, side, 132),
      message: r(margin, under + 136, side, 40),
      groundLegend: r(start, under, 142, 94),
      currentReadout: r(start, under + 100, 142, 60),
      electronics: r(width - 302, under, 142, 66),
      navigation: r(width - 302, under + 72, 142, 62),
      almanacPanel: r(width - 302, under + 140, 142, 36),
      minimapPanel: r(width - 150, under, 142, 176),
      help: r(start, under, width - start - 318, 92),
    }[id];
    if (compactWindows) return compactWindows;
  }
  return {
    helmPanel: r(margin, margin, side, shelfHeight),
    diverPanel: r(margin, under, side, crewHeight),
    electronics: r(
      wide && visibleShelf ? start + strip.length * (gauge + gap) : right,
      wide ? margin : under,
      side,
      wide ? shelfHeight : 66,
    ),
    navigation: r(right, wide ? under : under + 72, side, compact ? 56 : 76),
    almanacPanel: r(right, under + (wide ? 84 : 150), side, 42),
    currentReadout: r(right, under + (wide ? 134 : 198), side, compact ? 66 : 74),
    minimapPanel: r(width - map - margin, dockTop - map - gap, map, map),
    frankAboard: r(start, under, Math.max(260, right - start - gap), compact ? 122 : 146),
    message: r(
      margin,
      compact ? dockTop - 70 : dockTop - 116,
      compact ? side + 32 : Math.max(side, 320),
      compact ? 64 : 108,
    ),
    help: r(
      start + (compact ? 28 : 104),
      dockTop - (compact ? 78 : 94),
      Math.max(210, right - start - (compact ? 48 : 128)),
      compact ? 72 : 86,
    ),
    groundLegend: r(margin, under + crewHeight + gap, side, compact ? 82 : 104),
    actionFeedback: r(
      start + 12,
      under + (compact ? 130 : 162),
      Math.min(320, right - start - 24),
      70,
    ),
    clock: r(start, under, Math.min(180, gauge * 1.6), 72),
    sounderPanel: r(
      start + Math.min(180, gauge * 1.6) + gap,
      under,
      Math.min(160, gauge * 1.5),
      72,
    ),
    compassPanel: r(margin, under + crewHeight + 120, side / 2 - gap, 94),
    hullPanel: r(margin + side / 2, under + crewHeight + 120, side / 2, 94),
  }[id];
}

export function avoidContextTarget(rect, target, band) {
  if (
    !target ||
    target.x < rect.left - 12 ||
    target.x > rect.left + rect.width + 12 ||
    target.y < rect.top - 12 ||
    target.y > rect.top + rect.height + 12
  )
    return rect;
  const minimum = Math.min(rect.width, 300),
    leftWidth = Math.min(rect.width, target.x - 18 - band.left),
    rightWidth = Math.min(rect.width, band.right - target.x - 18),
    options = [];
  if (leftWidth >= minimum) options.push({ ...rect, left: band.left, width: leftWidth });
  if (rightWidth >= minimum) options.push({ ...rect, left: target.x + 18, width: rightWidth });
  return (
    options.sort(
      (a, b) =>
        Math.abs(a.left - rect.left) +
        (rect.width - a.width) / 2 -
        Math.abs(b.left - rect.left) -
        (rect.width - b.width) / 2,
    )[0] || rect
  );
}

export function defaultHudRect(
  id,
  width,
  height,
  touch,
  tutorial = false,
  controlsTop,
  visibleShelf,
  activeMessage = false,
  compactMessage = false,
  targetPoint,
  tutorialInstruments = visibleShelf || [],
) {
  let rect;
  if (tutorial && !touch && height < 560 && width > height && id === 'diverPanel')
    return { left: width - 184, top: height - 252, width: 176, height: 132 };
  if (tutorial && height < 560 && width > height && tutorialInstruments.includes(id)) {
    // Opted-in tutorial instruments use the free starboard area, clear of
    // Frank to port, the followed boat and the lower touch controls.
    const columns = tutorialInstruments.length > 4 ? 3 : 2,
      start = width / 2 + 110,
      cell = (width - start - 12) / columns,
      index = tutorialInstruments.indexOf(id),
      left = start + (index % columns) * cell,
      top = 54 + Math.floor(index / columns) * 82,
      // The lower port column shares this band with the compact keyboard
      // crew station at starboard. Keep a gap between their default borders.
      panelWidth =
        !touch && index >= columns && index % columns === 0
          ? Math.min(cell - 6, width - 192 - left)
          : cell - 6;
    return {
      left,
      top,
      width: panelWidth,
      height: 76,
    };
  }
  if (id === 'frankAboard' && tutorial) {
    const portrait = width < height,
      hasShelf = tutorialInstruments.some((item) => instrumentShelf(touch).includes(item));
    if (height < 560 && !portrait)
      return { left: 10, top: 60, width: Math.min(300, width / 2 - 76), height: 126 };
    return {
      left: portrait ? 6 : Math.max(12, (width - 560) / 2),
      top: portrait ? (hasShelf ? 128 : 90) : 134,
      width: portrait ? width - 12 : Math.min(560, width - 260),
      height: portrait ? (hasShelf ? 132 : 170) : 160,
    };
  }
  if (tutorial && touch && width < height) {
    if (id === 'clock') return { left: 4, top: 296, width: 134, height: 68 };
    if (id === 'electronics') return { left: width - 138, top: 296, width: 134, height: 84 };
    if (id === 'sounderPanel') return { left: 4, top: 372, width: 134, height: 68 };
  }
  if (tutorial && !touch && height >= 560 && ['clock', 'sounderPanel'].includes(id))
    return {
      left: width - 194,
      top: id === 'clock' ? 134 : 214,
      width: 180,
      height: 72,
    };
  if (id === 'message' && activeMessage && !tutorial && !(touch && width < height)) {
    if (touch && height < 500)
      return { left: 140, top: 86, width: Math.min(220, width * 0.292), height: 134 };
    if (height < 560) {
      const left = 190;
      return {
        left,
        top: 104,
        width: Math.min(168, Math.max(140, width / 2 - left - 54)),
        height: height - 214,
      };
    }
    const left = 14 + Math.min(224, width * 0.19) + 8;
    return avoidContextTarget(
      { left, top: 134, width: Math.min(500, width - left - 240), height: 176 },
      targetPoint,
      { left, right: width - Math.min(224, width * 0.19) - 14 },
    );
  }
  if (touch && width < height) {
    const cell = (width - 20) / 5,
      controls =
        controlsTop === undefined
          ? 64 + ((width <= 700 ? 225 : 170) * touchScale()) / 100
          : height - controlsTop + 10,
      workTop = height - controls,
      lessonHeight = 150,
      lessonTop = workTop - lessonHeight;
    if (id === 'message' && activeMessage && !tutorial)
      return compactMessage
        ? { left: 4, top: workTop - 82, width: width - 8, height: 82 }
        : { left: width - 158, top: 326, width: 154, height: Math.max(170, workTop - 326) };
    const top = visibleShelf || instrumentShelf(true);
    if (top.includes(id))
      rect = { left: 4 + top.indexOf(id) * (cell + 3), top: 50, width: cell, height: 72 };
    else
      rect = {
        minimapPanel: { left: 4, top: 130, width: 100, height: 110 },
        clock: { left: 110, top: 122, width: 134, height: 68 },
        sounderPanel: { left: 250, top: 122, width: width - 254, height: 68 },
        diverPanel: { left: 4, top: height - 64, width: width - 8, height: 60 },
        helmPanel: { left: 110, top: 210, width: width - 114, height: 44 },
        hullPanel: { left: 4, top: 240, width: 74, height: 68 },
        loadPanel: { left: 110, top: 130, width: 74, height: 74 },
        currentReadout: { left: width - 78, top: 130, width: 74, height: 74 },
        almanacPanel: { left: 4, top: 248, width: 100, height: 44 },
        electronics: { left: 190, top: 130, width: Math.max(96, width - 274), height: 74 },
        actionFeedback: { left: 154, top: 252, width: width - 160, height: 46 },
        frankAboard: {
          left: 6,
          top: lessonTop,
          width: width - 12,
          height: lessonHeight,
        },
        message: { left: 6, top: height - controls - 60, width: width - 12, height: 60 },
        navigation: { left: 110, top: 260, width: width - 114, height: 60 },
        groundLegend: { left: 4, top: 298, width: 100, height: 132 },
        help: {
          left: tutorial ? width - 104 : 6,
          top: tutorial ? 260 : workTop - 142,
          width: tutorial ? 100 : width - 12,
          height: tutorial ? Math.min(110, lessonTop - 268) : 48,
        },
      }[id];
  }
  rect ||= baselineHudRect(id, width, height, touch, tutorial, visibleShelf);
  return rect;
}
import { touchScale } from './touch-scale.js';
