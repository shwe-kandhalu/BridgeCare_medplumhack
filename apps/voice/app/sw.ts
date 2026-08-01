import { NetworkFirst, Serwist } from 'serwist';
declare global { interface ServiceWorkerGlobalScope { __SW_MANIFEST: Array<{ url: string; revision?: string }> } }
declare const self: ServiceWorkerGlobalScope;
new Serwist({ precacheEntries: self.__SW_MANIFEST, skipWaiting: true, clientsClaim: true, runtimeCaching: [{ matcher: ({ request }) => request.destination === 'document', handler: new NetworkFirst({ cacheName: 'pages' }) }] }).addEventListeners();
