// Preparation is explicit: gameplay never starts with required content missing.
const tasks = new Map();
const interfaceImages = new Map();
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const fail = () => {
      clearTimeout(timeout);
      reject(new Error('Image unavailable: ' + url));
    };
    const timeout = setTimeout(fail, 20000);
    image.onload = () => {
      clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = fail;
    image.src = url;
  });
}
export async function prepareInterfaceArt() {
  const urls = [
    ...['ada', 'milo', 'nell', 'roy', 'inez', 'robinson', 'murphy', 'dave', 'remaining-atlas'].map(
      (name) => `crew/${name}.png`,
    ),
    'harbour/frank-v1.png',
    'harbour/harbour-training-mode-v1.png',
    'brand/channelmaster-title.png',
    'instruments/atlas.png',
    'charts/nautical-material-atlas.png',
  ];
  for (const url of urls) {
    if (interfaceImages.has(url)) continue;
    const image = await loadImage(`./assets/${url}`);
    interfaceImages.set(url, image);
  }
}
let overlay;
function render() {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'preparation';
    overlay.setAttribute('role', 'status');
    overlay.innerHTML =
      '<strong>URCHIN SKIPPER</strong><p></p><button hidden>Retry preparation</button>';
    document.body.append(overlay);
  }
  overlay.hidden = tasks.size === 0;
  document.body.classList.toggle('preparing-game', tasks.size > 0);
  const task = [...tasks.values()].find((t) => t.error) || tasks.values().next().value;
  if (!task) return;
  overlay.querySelector('p').textContent = task.error
    ? 'Some game artwork could not be loaded. Check the connection and retry.'
    : task.label;
  const retry = overlay.querySelector('button');
  retry.hidden = !task.error;
  retry.onclick = task.retry;
}
export const preparing = () => tasks.size > 0;
export function prepareContent(key, label, work) {
  const task = { label };
  tasks.set(key, task);
  const run = async () => {
    task.error = false;
    render();
    try {
      await work((next) => {
        task.label = next;
        render();
      });
      if (tasks.get(key) === task) tasks.delete(key);
    } catch (error) {
      task.error = true;
      task.retry = run;
    }
    render();
  };
  run();
}
