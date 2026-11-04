import { useRef, useState } from 'react';
import type { Machine } from '../types';
import { unlockAudio } from '../sound';
import { reducedMotion } from '../motion';
import { Booth3D } from './Booth3D';

const MACHINES: { id: Machine; name: string; desc: string }[] = [
  { id: 'silver', name: 'Silver', desc: 'Putih bersih, lampu LED dingin' },
  { id: 'red', name: 'Red', desc: 'Marun klasik, trim stainless' },
];

export function MiniBooth({ kind }: { kind: Machine }) {
  return (
    <div className={`mini mini-${kind}`} aria-hidden="true">
      <div className="mini-body">
        <div className="mf mf-front">
          <i className="mf-light" />
          <i className="mf-lens" />
          <i className="mf-screen" />
          <i className="mf-slot" />
        </div>
        <div className="mf mf-side" />
        <div className="mf mf-top" />
      </div>
      <i className="mini-shadow" />
    </div>
  );
}

export function Landing({ onPick }: { onPick: (m: Machine) => void }) {
  const [going, setGoing] = useState<Machine | null>(null);
  const [hover, setHover] = useState<Machine | null>(null);
  const moved = useRef(false);

  const pick = (m: Machine) => {
    if (moved.current) {
      moved.current = false; // that was a rotate drag, not a click
      return;
    }
    if (going) return;
    unlockAudio();
    setGoing(m);
    window.setTimeout(() => onPick(m), reducedMotion() ? 0 : 750);
  };

  return (
    <main className={`landing ${going ? `going going-${going}` : ''}`}>
      <section className="hero">
        <p className="eyebrow">Photobooth online</p>
        <h1>Virtua Box</h1>
        <p className="by">a project by Mirza Muhyidin</p>
        <p className="lede">
          Masuk ke booth, pasang gaya, lalu bawa pulang strip fotomu. Foto diproses di perangkatmu
          sendiri dan tidak diunggah ke mana pun.
        </p>
      </section>

      <section className="machines" aria-label="Pilih mesin">
        <p className="machines-label">Pilih mesin</p>
        <div className="machine-row">
          {MACHINES.map((m) => (
            <button
              key={m.id}
              className={`machine-card ${going === m.id ? 'chosen' : ''}`}
              onClick={() => pick(m.id)}
              onMouseEnter={() => setHover(m.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(m.id)}
              onBlur={() => setHover(null)}
            >
              <Booth3D kind={m.id} hover={hover === m.id} going={going === m.id} moved={moved} />
              <span className="machine-name">{m.name}</span>
              <span className="machine-desc">{m.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="drag-hint">Geser booth ke kiri/kanan untuk memutar. Klik untuk masuk.</p>

      <ol className="steps" aria-label="Alur">
        <li>Pilih mesin</li>
        <li>Atur sesi</li>
        <li>Foto</li>
        <li>Pilih foto</li>
        <li>Hias strip</li>
        <li>Cetak</li>
      </ol>
    </main>
  );
}
