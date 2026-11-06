import { useEffect, useState } from 'react';
import type { EditState, Machine, Phase, Settings } from './types';
import { LAYOUTS } from './layouts';
import { setMuted } from './sound';
import { Landing } from './components/Landing';
import { Options } from './components/Options';
import { Booth } from './components/Booth';
import { Pick } from './components/Pick';
import { Edit } from './components/Edit';
import { Print } from './components/Print';

const DEFAULT_SETTINGS: Settings = { layout: 'strip4', timer: 3, style: 'asli', takes: 6 };

const frameFor = (m: Machine) => (m === 'silver' ? '#F4F1EA' : '#7A1F24');

export default function App() {
  const [phase, setPhase] = useState<Phase>('landing');
  const [machine, setMachine] = useState<Machine>('silver');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [shots, setShots] = useState<HTMLCanvasElement[]>([]);
  const [picked, setPicked] = useState<HTMLCanvasElement[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [retakeAt, setRetakeAt] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState>({
    adjust: [],
    frameColor: frameFor('silver'),
    pattern: 'polos',
    shape: 'kotak',
    style: 'asli',
    caption: '',
    showDate: true,
  });
  const [strip, setStrip] = useState('');
  const [mute, setMute] = useState(false);

  useEffect(() => {
    setMuted(mute);
  }, [mute]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  const layout = LAYOUTS[settings.layout];

  const resetSession = () => {
    setShots([]);
    setPicked([]);
    setSel([]);
    setRetakeAt(null);
    setStrip('');
  };

  return (
    <div className={`app phase-${phase}`} data-machine={phase === 'landing' ? 'silver' : machine}>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            resetSession();
            setPhase('landing');
          }}
        >
          Virtua Box
        </button>
        <button className="mute" aria-pressed={mute} onClick={() => setMute((m) => !m)}>
          {mute ? 'Suara mati' : 'Suara nyala'}
        </button>
      </header>

      {phase === 'landing' && (
        <Landing
          onPick={(m) => {
            setMachine(m);
            setEdit((e) => ({ ...e, frameColor: frameFor(m) }));
            setPhase('options');
          }}
        />
      )}

      {phase === 'options' && (
        <Options
          settings={settings}
          setSettings={setSettings}
          onBack={() => setPhase('landing')}
          onStart={() => {
            resetSession();
            setPhase('booth');
          }}
        />
      )}

      {phase === 'booth' && (
        <Booth
          key={retakeAt ?? 'all'}
          settings={settings}
          retake={retakeAt === null ? undefined : { index: retakeAt, shots }}
          onBack={() => {
            if (retakeAt === null) return setPhase('options');
            setRetakeAt(null);
            setPhase('pick');
          }}
          onDone={(s) => {
            setShots(s);
            setRetakeAt(null);
            setPhase('pick');
          }}
        />
      )}

      {phase === 'pick' && (
        <Pick
          shots={shots}
          need={layout.slots}
          style={settings.style}
          sel={sel}
          setSel={setSel}
          onRetake={() => {
            resetSession();
            setPhase('booth');
          }}
          onRetakeOne={(i) => {
            setRetakeAt(i);
            setPhase('booth');
          }}
          onNext={(idx) => {
            setPicked(idx.map((i) => shots[i]));
            setEdit((e) => ({
              ...e,
              style: settings.style,
              adjust: idx.map(() => ({ x: 0, y: 0, zoom: 1 })),
            }));
            setPhase('edit');
          }}
        />
      )}

      {phase === 'edit' && (
        <Edit
          photos={picked}
          layout={layout}
          edit={edit}
          setEdit={setEdit}
          onBack={() => setPhase('pick')}
          onPrint={(url) => {
            setStrip(url);
            setPhase('print');
          }}
        />
      )}

      {phase === 'print' && (
        <Print
          url={strip}
          shots={shots}
          layout={layout}
          machine={machine}
          onAgain={() => {
            resetSession();
            setPhase('options');
          }}
          onHome={() => {
            resetSession();
            setPhase('landing');
          }}
        />
      )}
    </div>
  );
}
