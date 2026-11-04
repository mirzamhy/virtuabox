import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Machine } from '../types';
import { createBooth, type BoothHandle } from '../three/booth3d';
import { reducedMotion } from '../motion';
import { MiniBooth } from './Landing';

/** 3D booth on a landing card. Horizontal drag rotates it; `moved` lets the card ignore the click after a drag. */
export function Booth3D({
  kind,
  hover,
  going,
  moved,
}: {
  kind: Machine;
  hover: boolean;
  going: boolean;
  moved: MutableRefObject<boolean>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const handle = useRef<BoothHandle | null>(null);
  const drag = useRef<{ x: number; total: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      handle.current = createBooth(ref.current!, kind, reducedMotion());
    } catch {
      setFailed(true); // no WebGL: fall back to the CSS booth
    }
    return () => {
      handle.current?.dispose();
      handle.current = null;
    };
  }, [kind]);

  useEffect(() => {
    handle.current?.setHover(hover);
  }, [hover]);
  useEffect(() => {
    if (going) handle.current?.go();
  }, [going]);

  if (failed) return <MiniBooth kind={kind} />;

  return (
    <canvas
      ref={ref}
      className="booth3d"
      aria-hidden="true"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, total: 0 };
        moved.current = false;
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        d.x = e.clientX;
        d.total += Math.abs(dx);
        if (d.total > 6) moved.current = true;
        handle.current?.drag(dx);
      }}
      onPointerUp={() => {
        drag.current = null;
        handle.current?.release();
      }}
      onPointerLeave={() => {
        drag.current = null;
        handle.current?.release();
      }}
    />
  );
}
