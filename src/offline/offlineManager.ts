/** Readiness is tied to every exact URL in the current production build. */
export type OfflineStatus = 'preparing' | 'ready' | 'unavailable' | 'failed';
export interface OfflineState {
  status: OfflineStatus;
  controllerReady: boolean;
  datasetsReady: boolean;
  shellReady: boolean;
  message: string;
}
export interface OfflineManifest {
  schemaVersion: 1;
  buildId: string;
  cacheName: string;
  assets: string[];
}

export function parseOfflineManifest(value: unknown): OfflineManifest {
  const v = value as Partial<OfflineManifest> | null;
  if (!v || v.schemaVersion !== 1 || typeof v.buildId !== 'string' || !/^[a-f0-9]{16}$/.test(v.buildId) ||
      v.cacheName !== `dimminglab-build-${v.buildId}` || !Array.isArray(v.assets) ||
      !v.assets.every(url => typeof url === 'string' && /^\/(?!\/)/.test(url) && !url.includes('..'))) {
    throw new Error('Invalid offline build manifest.');
  }
  const required = ['/index.html', '/offline-manifest.json',
    ...['case_a_kepler8b', 'case_b_eclipsing_binary', 'case_c_single_dropout', 'case_d_injection'].map(id => `/data/${id}.json`)];
  if (!required.every(url => v.assets!.includes(url)) ||
      !v.assets.some(url => /^\/assets\/index-.*\.js$/.test(url)) ||
      !v.assets.some(url => /^\/assets\/.*\.css$/.test(url)) ||
      !v.assets.some(url => /^\/assets\/searchWorker-.*\.js$/.test(url)) ||
      !v.assets.some(url => /^\/assets\/search-.*\.js$/.test(url))) {
    throw new Error('Offline manifest is missing required application resources.');
  }
  return v as OfflineManifest;
}

export async function missingOfflineAssets(cache: Pick<Cache, 'match'>, manifest: OfflineManifest): Promise<string[]> {
  const present = await Promise.all(manifest.assets.map(async url => (await cache.match(url))?.ok === true));
  return manifest.assets.filter((_, index) => !present[index]);
}

export async function checkOfflineSupport(): Promise<OfflineState> {
  const state: OfflineState = { status: 'preparing', controllerReady: false, datasetsReady: false, shellReady: false,
    message: 'Preparing offline classroom pack…' };
  if (!('serviceWorker' in navigator) || !('caches' in window)) {
    return { ...state, status: 'unavailable', message: 'Offline installation is unavailable in this browser.' };
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    registration.update().catch(() => undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ready = await Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 12000); }),
    ]);
    clearTimeout(timer);
    if (!ready) return state;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(resolve => {
        const done = () => { clearTimeout(timeout); navigator.serviceWorker.removeEventListener('controllerchange', done); resolve(); };
        const timeout = setTimeout(done, 3000);
        navigator.serviceWorker.addEventListener('controllerchange', done);
      });
    }
    state.controllerReady = navigator.serviceWorker.controller !== null;
    const response = await fetch('/offline-manifest.json', { cache: 'no-store' });
    if (!response.ok) return state;
    const manifest = parseOfflineManifest(await response.json());
    const cache = await caches.open(manifest.cacheName);
    const missing = await missingOfflineAssets(cache, manifest);
    state.datasetsReady = !missing.some(url => url.startsWith('/data/'));
    state.shellReady = !missing.includes('/index.html');
    if (state.controllerReady && missing.length === 0) {
      return { ...state, status: 'ready', message: 'Offline Classroom Pack Ready (Works without internet)' };
    }
    return state;
  } catch {
    return { ...state, status: 'failed', message: 'Offline installation is incomplete. Connect to the internet and reload.' };
  }
}

export async function initOfflineSupport(): Promise<boolean> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const state = await checkOfflineSupport();
    if (state.status === 'ready') return true;
    if (state.status !== 'preparing' || !state.controllerReady) return false;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}
