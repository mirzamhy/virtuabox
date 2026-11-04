import type { Dispatch, SetStateAction } from 'react';
import type { LayoutId, Settings, Takes, TimerSec } from '../types';
import { LAYOUTS, LAYOUT_LIST } from '../layouts';
import { STYLES } from '../filters';
import { unlockAudio } from '../sound';

const TIMERS: TimerSec[] = [3, 5, 10];
const TAKES: Takes[] = [4, 6, 8];

function LayoutIcon({ id }: { id: LayoutId }) {
  const L = LAYOUTS[id];
  return (
    <span className={`licon licon-${id}`} aria-hidden="true">
      {Array.from({ length: id === 'double3' || id === 'film' ? 6 : L.slots }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

export function Options({
  settings,
  setSettings,
  onStart,
  onBack,
}: {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  onStart: () => void;
  onBack: () => void;
}) {
  const slots = LAYOUTS[settings.layout].slots;

  const setLayout = (id: LayoutId) =>
    setSettings((s) => {
      const need = LAYOUTS[id].slots;
      const takes = s.takes >= need ? s.takes : (TAKES.find((t) => t >= need) ?? 8);
      return { ...s, layout: id, takes };
    });

  return (
    <main className="options-wrap">
      <div className="panel">
        <div className="panel-head">
          <span className="screw" />
          <h2>Pilihan</h2>
          <p>Atur sesi fotomu. Semua sudah punya pilihan awal, jadi bisa langsung mulai.</p>
          <span className="screw" />
        </div>

        <fieldset className="group">
          <legend>Strip</legend>
          {[
            { name: 'Tegak', list: LAYOUT_LIST.filter((l) => l.height > l.width) },
            { name: 'Melebar & kotak', list: LAYOUT_LIST.filter((l) => l.height <= l.width) },
          ].map((row) => (
            <div key={row.name} className="layout-row">
              <p className="sub-legend">{row.name}</p>
              <div className="keys keys-layout">
                {row.list.map((l) => (
                  <button
                    key={l.id}
                    className="key"
                    aria-pressed={settings.layout === l.id}
                    onClick={() => setLayout(l.id)}
                  >
                    <LayoutIcon id={l.id} />
                    <b>{l.label}</b>
                    <small>{l.desc}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="hint">
            Foto kamera berbentuk 4:3. Template melebar dan 1×4 memuat foto utuh. Template tegak lain
            memotong sisi kiri-kanan, dan batasnya terlihat di layar booth.
          </p>
        </fieldset>

        <fieldset className="group">
          <legend>Timer</legend>
          <div className="keys">
            {TIMERS.map((t) => (
              <button
                key={t}
                className="key"
                aria-pressed={settings.timer === t}
                onClick={() => setSettings((s) => ({ ...s, timer: t }))}
              >
                <b>{t} dtk</b>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>Style</legend>
          <div className="keys">
            {STYLES.map((st) => (
              <button
                key={st.id}
                className="key"
                aria-pressed={settings.style === st.id}
                onClick={() => setSettings((s) => ({ ...s, style: st.id }))}
              >
                <span className={`swatch swatch-${st.id}`} aria-hidden="true" />
                <b>{st.label}</b>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>Jumlah take</legend>
          <div className="keys">
            {TAKES.map((t) => (
              <button
                key={t}
                className="key"
                aria-pressed={settings.takes === t}
                disabled={t < slots}
                title={t < slots ? `Strip ini butuh minimal ${slots} foto` : undefined}
                onClick={() => setSettings((s) => ({ ...s, takes: t }))}
              >
                <b>{t} foto</b>
              </button>
            ))}
          </div>
          <p className="hint">
            Kamu akan memilih {slots} dari {settings.takes} foto untuk strip.
          </p>
        </fieldset>

        <div className="panel-actions">
          <button className="ghost" onClick={onBack}>
            Ganti mesin
          </button>
          <button
            className="primary big"
            onClick={() => {
              unlockAudio();
              onStart();
            }}
          >
            Masuk booth
          </button>
        </div>
      </div>
    </main>
  );
}
