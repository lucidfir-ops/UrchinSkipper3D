import { instrumentStyle, setInstrumentStyle } from './instruments.js';
import { paintChartNotes } from './chart-notes.js';
import { paintSectorMap, sectorChartSvg, vectorNotes } from './chart-art.js';
import { chartMode, minimapViewport, stepChartZoom } from './chart-presentation.js';
import { assist } from './assists.js';
import { seaLevel } from './world.js';
import { soundingDepth } from './hazard-depth.js';
import { boatSpec } from './boats.js';
import { setText } from './dom-view.js';

export function renderNavigationWindows(ui, w) {
  if (!ui.minimapCanvas) {
    const panel = document.createElement('aside');
    panel.id = 'minimapPanel';
    panel.className = 'navigation-window';
    panel.innerHTML =
      '<div class="minimap-heading"><strong>CHART · N ↑</strong><div class="minimap-zoom" role="group" aria-label="Chart minimap zoom"><button type="button" data-minimap-open aria-label="Open enlarged chart">↗</button><button type="button" data-minimap-zoom="-1" aria-label="Zoom chart out">−</button><output aria-live="polite">1×</output><button type="button" data-minimap-zoom="1" aria-label="Zoom chart in">+</button></div></div><div class="minimap-chart" aria-label="Chart"><canvas width="240" height="240" aria-label="Current area chart: pink crosses are charted rocks, triangle is your boat"></canvas><svg class="minimap-vector" hidden aria-label="Current area vector chart"></svg></div><p class="minimap-text"></p><small>Pink × rocks · △ your boat · tap to fade</small>';
    panel.querySelector('[data-minimap-open]').onclick = () =>
      ui.open(ui.hooks.world().career ? 'knowledge' : 'chart');
    const simple = document.createElement('button');
    simple.type = 'button';
    simple.dataset.minimapStyle = 'chart';
    simple.textContent = 'Chart only';
    simple.title = 'Hide the chart heading and legend. Change this in Arrange UI.';
    simple.onclick = () => {
      setInstrumentStyle('minimapPanel', 'chart');
      panel.dataset.presentation = 'chart';
    };
    panel.querySelector('small').append(' · ', simple);
    panel.querySelectorAll('[data-minimap-zoom]').forEach((button) => {
      button.onclick = () => {
        ui.chartZoom = stepChartZoom(ui.chartZoom, Number(button.dataset.minimapZoom));
      };
    });
    document.body.append(panel);
    ui.minimapPanel = panel;
    ui.minimapCanvas = panel.querySelector('canvas');
    ui.minimapSvg = panel.querySelector('.minimap-vector');
    ui.minimapBase = document.createElement('canvas');
    ui.minimapComposite = document.createElement('canvas');
    ui.minimapBase.width = ui.minimapBase.height = 240;
    ui.minimapComposite.width = ui.minimapComposite.height = 240;
    const sounder = document.createElement('aside');
    sounder.id = 'sounderPanel';
    sounder.className = 'navigation-window';
    sounder.innerHTML = '<strong>SOUNDER · BELOW BOAT</strong><output></output><small></small>';
    document.body.append(sounder);
    ui.sounderPanel = sounder;
  }
  const playing =
    ui.started && !ui.screen && !ui.ended && !['planning', 'complete'].includes(w.day.phase);
  ui.minimapPanel.hidden = !playing || !assist(w, 'minimap', ui.realistic);
  ui.sounderPanel.hidden = !playing || !assist(w, 'sounder', ui.realistic);
  if (!ui.sounderPanel.hidden) {
    const depth = Math.max(0, soundingDepth(w, w.boat.x, w.boat.y)),
      clearance = depth - boatSpec(w).draft;
    setText(ui.sounderPanel.querySelector('output'), `${depth.toFixed(1)} m`);
    setText(
      ui.sounderPanel.querySelector('small'),
      clearance <= 0 ? 'KEEL CONTACT' : `Below keel ${clearance.toFixed(1)} m`,
    );
    ui.sounderPanel.classList.toggle('shallow', clearance < 0.5);
  }
  if (!ui.minimapPanel.hidden) {
    setText(
      ui.minimapPanel.querySelector('.minimap-text'),
      `${w.terrain.name || 'Current area'} · Boat ${Math.round(w.boat.x)} m E / ${Math.round(w.boat.y)} m S · Heading ${(((w.boat.heading * 180) / Math.PI + 360) % 360).toFixed(0)}°`,
    );
    const noText = instrumentStyle('minimapPanel') === 'chart';
    const rendition = chartMode(ui),
      zoom = minimapViewport(240, 0, 0, ui.chartZoom).zoom,
      zoomIndex = [1, 2, 4].indexOf(zoom),
      zoomButtons = ui.minimapPanel.querySelectorAll('[data-minimap-zoom]');
    ui.chartZoom = zoom;
    setText(
      ui.minimapPanel.querySelector('.minimap-heading > strong'),
      `${rendition.toUpperCase()} CHART · N ↑`,
    );
    setText(ui.minimapPanel.querySelector('.minimap-zoom output'), `${zoom}×`);
    zoomButtons[0].disabled = zoomIndex === 0;
    zoomButtons[1].disabled = zoomIndex === 2;

    const tide = Math.round(seaLevel(w) * 10) / 10,
      showPatches = assist(w, 'chartGrounds', ui.realistic),
      coastOnly = !assist(w, 'reefClarity', ui.realistic),
      exit = w.day.phase === 'working' ? w.day.returnExit?.edge : null,
      notes = w.career?.knowledge[w.day.groundId] || {},
      key = JSON.stringify([
        tide,
        noText,
        showPatches,
        coastOnly,
        exit,
        rendition,
        (w.rocks || []).map((r) => r.id),
        w.terrain.patches.map((p) => [p.id, p.charted, p.remaining <= 0.001]),
      ]);
    const mapScale = 240 / w.terrain.size,
      viewport = minimapViewport(240, w.boat.x * mapScale, w.boat.y * mapScale, zoom),
      displayScale = 240 / viewport.size;
    if (rendition === 'vector') {
      ui.minimapCanvas.hidden = true;
      ui.minimapSvg.hidden = false;
      const reports = showPatches
          ? Object.values(notes.grounds || {}).filter(
              (p) => w.terrain.patches.find((q) => q.id === p.id)?.charted !== false,
            )
          : [],
        noteOptions = {
          compact: true,
          tracks: notes.tracks || [],
          reports,
          marks: (w.career?.marks || []).filter((mark) => mark.sector === w.day.groundId),
        },
        notesKey = JSON.stringify(noteOptions);
      if (ui.minimapVectorKey !== key || ui.minimapVectorTerrain !== w.terrain) {
        const markup = sectorChartSvg(w.terrain, {
          tide,
          exact: false,
          labels: false,
          compact: true,
          noText,
          showPatches,
          coastOnly,
          exit,
          rocks: w.rocks || [],
          boat: w.boat,
          ...noteOptions,
          ariaLabel:
            'Current area vector chart: pink crosses are charted rocks, triangle is your boat',
        });
        const holder = document.createElement('div');
        holder.innerHTML = markup;
        ui.minimapSvg.replaceWith(holder.firstElementChild);
        ui.minimapSvg = ui.minimapPanel.querySelector('.sector-chart-vector');
        ui.minimapVectorKey = key;
        ui.minimapVectorTerrain = w.terrain;
        ui.minimapNotesKey = notesKey;
      } else if (ui.minimapNotesKey !== notesKey) {
        ui.minimapSvg.querySelector('.chart-notes').outerHTML = vectorNotes(noteOptions);
        ui.minimapNotesKey = notesKey;
      }
      const vectorViewport = {
        x: (viewport.x / 240) * w.terrain.size,
        y: (viewport.y / 240) * w.terrain.size,
        size: (viewport.size / 240) * w.terrain.size,
      };
      ui.minimapSvg.setAttribute(
        'viewBox',
        `${vectorViewport.x} ${vectorViewport.y} ${vectorViewport.size} ${vectorViewport.size}`,
      );
      ui.minimapSvg
        .querySelector('[data-chart-boat]')
        ?.setAttribute(
          'transform',
          `translate(${w.boat.x} ${w.boat.y}) rotate(${(w.boat.heading * 180) / Math.PI})`,
        );
      return;
    }
    ui.minimapSvg.hidden = true;
    ui.minimapCanvas.hidden = false;
    if (ui.minimapTerrain !== w.terrain || ui.minimapKey !== key) {
      paintSectorMap(ui.minimapBase, w.terrain, {
        tide,
        exact: false,
        labels: false,
        compact: true,
        noText,
        showPatches,
        coastOnly,
        exit,
        rocks: w.rocks || [],
        rendition,
      });
      ui.minimapTerrain = w.terrain;
      ui.minimapKey = key;
    }

    const composite = ui.minimapComposite.getContext('2d');
    composite.clearRect(0, 0, 240, 240);
    composite.drawImage(ui.minimapBase, 0, 0);
    if (w.career && w.day.phase === 'working')
      paintChartNotes(
        ui.minimapComposite,
        w.terrain,
        w,
        w.day.groundId,
        { realistic: ui.realistic },
        true,
      );

    const ctx = ui.minimapCanvas.getContext('2d');
    ctx.clearRect(0, 0, 240, 240);
    ctx.imageSmoothingEnabled = zoom === 1;
    ctx.drawImage(
      ui.minimapComposite,
      viewport.x,
      viewport.y,
      viewport.size,
      viewport.size,
      0,
      0,
      240,
      240,
    );
    ctx.save();
    ctx.translate(
      (w.boat.x * mapScale - viewport.x) * displayScale,
      (w.boat.y * mapScale - viewport.y) * displayScale,
    );
    ctx.rotate(w.boat.heading);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#102c3c';
    ctx.stroke();
    ctx.fillStyle = '#fff3cf';
    ctx.fill();
    ctx.restore();
  }
}
