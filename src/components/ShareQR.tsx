import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

type Share = { link: string; qr: string } | 'loading' | 'off';

// One upload per strip, even if the dialog is closed and opened again.
const cache = new Map<string, Promise<Share>>();

async function share(dataUrl: string): Promise<Share> {
  const png = await (await fetch(dataUrl)).blob();
  const res = await fetch('/api/share', { method: 'POST', body: png, headers: { 'Content-Type': 'image/png' } });
  if (!res.ok) return 'off';
  const { url } = (await res.json()) as { url: string };
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#17191c', light: '#ffffff' } });
  return { link: url, qr };
}

/** QR code that opens the strip on a phone (server/share.mjs). */
export function ShareQR({ url }: { url: string }) {
  const [state, setState] = useState<Share>('loading');

  useEffect(() => {
    let alive = true;
    let job = cache.get(url);
    if (!job) {
      job = share(url).catch((): Share => 'off');
      cache.set(url, job);
    }
    void job.then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, [url]);

  // No share server (e.g. a static build): keep the dialog as it was.
  if (state === 'off') return null;

  return (
    <div className="share-card" aria-live="polite">
      {state === 'loading' ? (
        <div className="share-qr share-wait">Menyiapkan QR…</div>
      ) : (
        <img className="share-qr" src={state.qr} alt={`QR code ke ${state.link}`} />
      )}
      <p className="share-title">Scan untuk ambil fotomu di HP</p>
      <p className="share-note">Buka di HP lalu tekan Unduh foto.</p>
      {state !== 'loading' && <p className="share-link">{state.link.replace(/^http:\/\//, '')}</p>}
    </div>
  );
}
