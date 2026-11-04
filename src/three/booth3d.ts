import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Machine } from '../types';

/**
 * Procedural 3D photobooth: an open-front cabin (walls, checker floor, ceiling light)
 * with a kiosk inside (capsule light canopy, LED bars, camera, screen, print slot with a strip).
 * Units are metres.
 */

interface Theme {
  wall: number;
  ceiling: number;
  floorA: string;
  floorB: string;
  kiosk: number;
  kioskDark: number;
  trim: number;
  frame: number;
  screenBg: [string, string];
  screenInk: string;
  glow: number;
}

const THEMES: Record<Machine, Theme> = {
  silver: {
    wall: 0x858b92,
    ceiling: 0x6c7177,
    floorA: '#f1f1ee',
    floorB: '#1c1d1f',
    kiosk: 0xf5f6f8,
    kioskDark: 0xc9cdd2,
    trim: 0xbfc4ca,
    frame: 0x9ea4ab,
    screenBg: ['#f3f6f8', '#d2dbe3'],
    screenInk: '#1c1f23',
    glow: 0xffffff,
  },
  red: {
    wall: 0x6a1a1f,
    ceiling: 0x4a1013,
    floorA: '#f3eeea',
    floorB: '#8a2228',
    kiosk: 0x7a1f24,
    kioskDark: 0x5c1519,
    trim: 0xc9cdd2,
    frame: 0xc9cdd2,
    screenBg: ['#fbf6f2', '#efe0da'],
    screenInk: '#5c1519',
    glow: 0xfff3e3,
  },
};

export interface BoothHandle {
  setHover(h: boolean): void;
  drag(dx: number): void;
  release(): void;
  go(): void;
  dispose(): void;
}

const W = 1.7; // cabin width
const D = 1.5; // cabin depth
const H = 2.3; // cabin height
const T = 0.06; // wall thickness
const KW = 0.84; // kiosk width
const BACK = -D / 2;

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, redraw: () => (draw(c.getContext('2d')!), (t.needsUpdate = true)) };
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function createBooth(canvas: HTMLCanvasElement, kind: Machine, reduced: boolean): BoothHandle {
  const th = THEMES[kind];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = kind === 'silver' ? 0.82 : 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Soft studio reflections so chrome and stainless parts read as metal, not black.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 40);
  const root = new THREE.Group();
  scene.add(root);

  const trash: { dispose(): void }[] = [];
  const keep = <X extends { dispose(): void }>(x: X) => (trash.push(x), x);
  const std = (p: THREE.MeshStandardMaterialParameters) => keep(new THREE.MeshStandardMaterial(p));
  const basic = (p: THREE.MeshBasicMaterialParameters) => keep(new THREE.MeshBasicMaterial(p));

  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = root) => {
    keep(geo);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) =>
    add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);

  // ── materials ──
  const wallM = std({ color: th.wall, roughness: 0.85 });
  const ceilM = std({ color: th.ceiling, roughness: 0.9 });
  const frameM = std({ color: th.frame, metalness: 0.75, roughness: 0.32 });
  const kioskM = std({ color: th.kiosk, roughness: 0.42, metalness: kind === 'silver' ? 0.15 : 0.05 });
  const kioskDarkM = std({ color: th.kioskDark, roughness: 0.5 });
  const trimM = std({ color: th.trim, metalness: 0.85, roughness: 0.28 });
  const blackM = std({ color: 0x0c0d0f, roughness: 0.35 });
  const lensM = std({ color: 0x050506, roughness: 0.05, metalness: 0.4 });
  const glowM = basic({ color: th.glow });

  // ── textures ──
  const checker = canvasTexture(64, 64, (g) => {
    g.fillStyle = th.floorA;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = th.floorB;
    g.fillRect(0, 0, 32, 32);
    g.fillRect(32, 32, 32, 32);
  });
  checker.tex.wrapS = checker.tex.wrapT = THREE.RepeatWrapping;
  checker.tex.repeat.set(4, 3.5);
  checker.tex.magFilter = THREE.NearestFilter;
  keep(checker.tex);

  const screen = canvasTexture(640, 400, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 400);
    grd.addColorStop(0, th.screenBg[0]);
    grd.addColorStop(1, th.screenBg[1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, 640, 400);
    g.fillStyle = th.screenInk;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 78px Archivo, Arial, sans-serif';
    g.fillText('VIRTUA BOX', 320, 160);
    g.font = "500 22px 'JetBrains Mono', monospace";
    g.fillText('p h o t o b o o t h', 320, 215);
    roundRect(g, 210, 268, 220, 54, 27);
    g.fill();
    g.fillStyle = th.screenBg[0];
    g.font = '700 22px Archivo, Arial, sans-serif';
    g.fillText('MULAI', 320, 296);
  });
  keep(screen.tex);
  document.fonts?.ready.then(() => screen.redraw()).catch(() => {});

  const strip = canvasTexture(120, 380, (g) => {
    g.fillStyle = '#fbfbf8';
    g.fillRect(0, 0, 120, 380);
    for (let i = 0; i < 4; i++) {
      const y = 10 + i * 80;
      const grd = g.createLinearGradient(0, y, 0, y + 72);
      grd.addColorStop(0, '#cfc8bf');
      grd.addColorStop(1, '#8f877d');
      g.fillStyle = grd;
      g.fillRect(10, y, 100, 72);
      g.fillStyle = i % 2 ? '#3a332e' : '#5b4b40';
      for (const cx of [42, 78]) {
        g.beginPath();
        g.arc(cx, y + 30, 11, 0, Math.PI * 2);
        g.fill();
        g.fillRect(cx - 16, y + 44, 32, 28);
      }
    }
    g.fillStyle = '#1c1d1f';
    g.font = '900 15px Archivo, Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('VIRTUA BOX', 60, 358);
  });
  keep(strip.tex);

  const label = canvasTexture(320, 64, (g) => {
    g.fillStyle = kind === 'silver' ? '#2a2d31' : '#e9ebee';
    g.font = '800 30px Archivo, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('YOUR PHOTOS HERE', 160, 34);
  });
  keep(label.tex);

  const glowTex = canvasTexture(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });
  keep(glowTex.tex);
  const glows: THREE.SpriteMaterial[] = [];
  const glow = (x: number, y: number, z: number, sx: number, sy: number, parent: THREE.Object3D = root) => {
    const m = keep(
      new THREE.SpriteMaterial({
        map: glowTex.tex,
        color: th.glow,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.6,
      }),
    );
    glows.push(m);
    const s = new THREE.Sprite(m);
    s.position.set(x, y, z);
    s.scale.set(sx, sy, 1);
    parent.add(s);
  };

  // ── cabin ──
  const floor = add(
    new THREE.PlaneGeometry(W, D),
    std({ map: checker.tex, roughness: 0.35, metalness: 0.05 }),
    0,
    0,
    0,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;

  box(W + 2 * T, H, T, wallM, 0, H / 2, BACK - T / 2); // back
  box(T, H, D + T, wallM, -W / 2 - T / 2, H / 2, -T / 2); // left
  box(T, H, D + T, wallM, W / 2 + T / 2, H / 2, -T / 2); // right
  box(W + 2 * T, T, D + T, ceilM, 0, H + T / 2, -T / 2); // ceiling

  // front frame (posts, lintel, threshold)
  const FZ = D / 2;
  box(0.09, H + T, 0.09, frameM, -W / 2 - T / 2, (H + T) / 2, FZ);
  box(0.09, H + T, 0.09, frameM, W / 2 + T / 2, (H + T) / 2, FZ);
  box(W + 2 * T + 0.09, 0.18, 0.09, frameM, 0, H - 0.05, FZ);
  box(W + 2 * T + 0.09, 0.03, 0.09, frameM, 0, 0.015, FZ);

  // wall rails (Photoculto-style horizontal trim)
  box(W, 0.025, 0.012, trimM, 0, 1.38, BACK + 0.006);
  box(0.012, 0.025, D, trimM, -W / 2 + 0.006, 1.38, 0);
  box(0.012, 0.025, D, trimM, W / 2 - 0.006, 1.38, 0);

  // ceiling light strip
  box(0.6, 0.02, 0.07, glowM, 0, H - 0.012, 0.15).castShadow = false;
  glow(0, H - 0.08, 0.2, 1.1, 0.35);

  // ── kiosk ──
  // base cabinet
  box(KW + 0.02, 0.06, 0.54, kioskDarkM, 0, 0.03, BACK + 0.27);
  box(KW, 0.86, 0.52, kioskM, 0, 0.06 + 0.43, BACK + 0.26);
  box(KW + 0.05, 0.035, 0.58, kind === 'red' ? trimM : kioskDarkM, 0, 0.935, BACK + 0.29);

  const baseFront = BACK + 0.52;
  // panel seam + door outline
  box(KW - 0.1, 0.004, 0.004, blackM, 0, 0.82, baseFront + 0.002);
  // print slot
  box(0.32, 0.1, 0.02, trimM, 0.15, 0.67, baseFront + 0.01);
  box(0.27, 0.026, 0.024, blackM, 0.15, 0.67, baseFront + 0.014);
  const lab = add(new THREE.PlaneGeometry(0.28, 0.056), basic({ map: label.tex, transparent: true }), 0.15, 0.755, baseFront + 0.003);
  lab.castShadow = false;
  const s = add(new THREE.PlaneGeometry(0.1, 0.316), std({ map: strip.tex, roughness: 0.6 }), 0.15, 0.506, baseFront + 0.03);
  s.rotation.x = 0.1;
  // coin / card slot
  box(0.1, 0.14, 0.02, blackM, -0.2, 0.68, baseFront + 0.01);
  box(0.06, 0.012, 0.022, trimM, -0.2, 0.71, baseFront + 0.012);
  // key lock
  const lock = add(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), trimM, 0.34, 0.5, baseFront + 0.005);
  lock.rotation.x = Math.PI / 2;

  // upper panel
  const UP_Y0 = 0.952;
  const UP_H = 0.72;
  box(KW, UP_H, 0.14, kioskM, 0, UP_Y0 + UP_H / 2, BACK + 0.07);
  const upFront = BACK + 0.14;
  box(0.57, 0.375, 0.022, blackM, 0, 1.25, upFront + 0.011);
  const scr = add(new THREE.PlaneGeometry(0.53, 0.33), basic({ map: screen.tex }), 0, 1.25, upFront + 0.0225);
  scr.castShadow = false;
  // camera
  const camHouse = add(new THREE.CylinderGeometry(0.048, 0.048, 0.03, 32), blackM, 0, 1.53, upFront + 0.015);
  camHouse.rotation.x = Math.PI / 2;
  const lens = add(new THREE.CylinderGeometry(0.026, 0.03, 0.02, 32), lensM, 0, 1.53, upFront + 0.035);
  lens.rotation.x = Math.PI / 2;
  // LED bars
  for (const x of [-0.355, 0.355]) {
    add(new THREE.CapsuleGeometry(0.034, 0.4, 6, 16), trimM, x, 1.27, upFront + 0.008).scale.set(1, 1, 0.4);
    const bar = add(new THREE.CapsuleGeometry(0.022, 0.4, 6, 16), glowM, x, 1.27, upFront + 0.02);
    bar.castShadow = false;
    glow(x, 1.27, upFront + 0.08, 0.32, 0.85);
  }

  // canopy head with capsule light, tilted to face the user
  const head = new THREE.Group();
  head.position.set(0, UP_Y0 + UP_H, BACK);
  head.rotation.x = 0.2;
  root.add(head);
  box(KW, 0.38, 0.36, kioskM, 0, 0.19, 0.18, head);
  const bezel = add(new THREE.CapsuleGeometry(0.118, 0.5, 8, 24), trimM, 0, 0.2, 0.358, head);
  bezel.rotation.z = Math.PI / 2;
  bezel.scale.set(1, 1, 0.1);
  const cap = add(new THREE.CapsuleGeometry(0.1, 0.48, 8, 24), glowM, 0, 0.2, 0.364, head);
  cap.rotation.z = Math.PI / 2;
  cap.scale.set(1, 1, 0.12);
  cap.castShadow = false;
  glow(0, 0.2, 0.5, 1.5, 0.7, head);

  // ── lights ──
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a2a, 0.45));
  const spot = new THREE.SpotLight(0xffffff, kind === 'silver' ? 12 : 20, 7, 0.75, 0.6, 1.4);
  spot.position.set(0, H - 0.1, 0.55);
  spot.target.position.set(0, 0.7, BACK + 0.3);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  root.add(spot, spot.target);
  const capLight = new THREE.PointLight(th.glow, 2.4, 3.2, 1.6);
  capLight.position.set(0, 1.78, BACK + 0.65);
  root.add(capLight);
  const fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(1.6, 2.2, 4);
  scene.add(fill);

  // ── camera rig + loop ──
  const BASE_YAW = -0.42;
  const CAM_FAR = new THREE.Vector3(0, 1.4, 6.1);
  const CAM_IN = new THREE.Vector3(0, 1.25, 0.9);
  const LOOK = new THREE.Vector3(0, 1.08, 0);
  camera.position.copy(CAM_FAR);
  camera.lookAt(LOOK);

  let hover = false;
  let hoverT = 0;
  let dragYaw = 0;
  let dragging = false;
  let going = false;
  let goT = 0;
  let yaw = BASE_YAW;
  let visible = true;
  let raf = 0;
  let last = performance.now();
  const t0 = last;

  const resize = () => {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 375;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(canvas);

  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) return;
    const t = (now - t0) / 1000;

    hoverT += ((hover ? 1 : 0) - hoverT) * Math.min(1, dt * 6);
    if (!dragging) dragYaw *= Math.pow(0.25, dt);
    const sway = reduced ? 0 : Math.sin(t * 0.45) * 0.14;
    let target = (BASE_YAW + sway) * (1 - hoverT * 0.55) + dragYaw;

    if (going) {
      goT = Math.min(1, goT + dt / 0.7);
      const k = ease(goT);
      target = target * (1 - k);
      camera.position.lerpVectors(CAM_FAR, CAM_IN, k);
      camera.lookAt(LOOK);
    }
    yaw += (target - yaw) * Math.min(1, dt * 5);
    root.rotation.y = yaw;

    for (const g of glows) g.opacity = 0.5 + hoverT * 0.35;
    capLight.intensity = 2.4 + hoverT * 1.6;

    renderer.render(scene, camera);
  };
  frame();

  return {
    setHover: (h) => (hover = h),
    drag: (dx) => {
      dragging = true;
      dragYaw = Math.max(-1.1, Math.min(1.1, dragYaw + dx * 0.009));
    },
    release: () => (dragging = false),
    go: () => (going = true),
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      trash.forEach((x) => x.dispose());
      envRT.dispose();
      renderer.dispose();
    },
  };
}
