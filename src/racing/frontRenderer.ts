import {
  buildCamera3D,
  clipQuadToNearPlane,
  computeTurnAdvisory,
  getRelativeCarYaw,
  projectCameraPoint,
  worldToCamera,
  type Camera3DConfig,
  type CamPoint,
} from './projection.ts';
import type { BuiltTrack, CameraMode, RaceWorldState, RacerState } from './types.ts';

let cachedSkyline: HTMLCanvasElement | null = null;

/**
 * Pre-renders a seamless 360-degree nocturnal city skyline panorama once
 * so every 60 FPS frame draws the parallax horizon in 1-2 fast drawImage calls.
 */
function getSkylinePanorama(targetH: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const h = Math.max(160, Math.min(540, Math.round(targetH)));
  if (cachedSkyline && Math.abs(cachedSkyline.height - h) < 8) return cachedSkyline;

  const w = 1600;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!ctx) return null;

  // Deep midnight noir sky gradient with subtle warm sodium-amber city haze near horizon
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, '#05070C');
  skyGrad.addColorStop(0.45, '#0B101A');
  skyGrad.addColorStop(0.78, '#161D2B');
  skyGrad.addColorStop(0.94, '#242024');
  skyGrad.addColorStop(1, '#2E231D');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle overcast moon glow
  const moonGrad = ctx.createRadialGradient(460, 70, 6, 460, 70, 145);
  moonGrad.addColorStop(0, 'rgba(225, 232, 248, 0.24)');
  moonGrad.addColorStop(0.35, 'rgba(130, 155, 195, 0.08)');
  moonGrad.addColorStop(1, 'rgba(130, 155, 195, 0)');
  ctx.fillStyle = moonGrad;
  ctx.fillRect(300, 0, 320, 210);

  ctx.fillStyle = 'rgba(244, 239, 228, 0.78)';
  ctx.beginPath();
  ctx.arc(460, 70, 12, 0, Math.PI * 2);
  ctx.fill();

  // Warm amber district horizon glows
  for (const hx of [180, 760, 1240]) {
    const glow = ctx.createRadialGradient(hx, h, 10, hx, h, 220);
    glow.addColorStop(0, 'rgba(217, 155, 56, 0.2)');
    glow.addColorStop(0.55, 'rgba(217, 155, 56, 0.05)');
    glow.addColorStop(1, 'rgba(217, 155, 56, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(hx - 220, h - 200, 440, 200);
  }

  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Distant skyscraper layer
  ctx.fillStyle = '#0D121D';
  let x = 0;
  while (x < w) {
    const bw = 28 + Math.floor(rand() * 54);
    const bh = 44 + Math.floor(rand() * 116);
    ctx.fillRect(x, h - bh, bw, bh);
    if (rand() > 0.65) {
      ctx.fillRect(x + Math.floor(bw * 0.5), h - bh - 20, 2, 20);
      ctx.fillStyle = '#D95448';
      ctx.fillRect(x + Math.floor(bw * 0.5) - 1, h - bh - 22, 4, 3);
      ctx.fillStyle = '#0D121D';
    }
    x += bw - 4;
  }

  // Closer downtown towers with warm amber & cool office windows
  x = 0;
  while (x < w) {
    const bw = 34 + Math.floor(rand() * 62);
    const bh = 28 + Math.floor(rand() * 92);
    const topY = h - bh;

    ctx.fillStyle = '#080B12';
    ctx.fillRect(x, topY, bw, bh);

    ctx.fillStyle = 'rgba(217, 155, 56, 0.16)';
    ctx.fillRect(x, topY, bw, 1.5);

    for (let wy = topY + 8; wy < h - 10; wy += 9) {
      if (rand() < 0.36) continue;
      for (let wx = x + 6; wx < x + bw - 8; wx += 9) {
        if (rand() < 0.64) continue;
        const warm = rand() < 0.62;
        ctx.fillStyle = warm
          ? `rgba(238, 184, 92, ${0.26 + rand() * 0.48})`
          : `rgba(164, 198, 238, ${0.18 + rand() * 0.34})`;
        ctx.fillRect(wx, wy, 4, 3);
      }
    }

    x += bw + Math.floor(rand() * 8);
  }

  cachedSkyline = canvas;
  return canvas;
}

function appendProjectedPolyToPath(
  ctx: CanvasRenderingContext2D,
  cam: Camera3DConfig,
  camPts: CamPoint[]
): boolean {
  const clipped = clipQuadToNearPlane(camPts, cam.nearZ);
  if (clipped.length < 3) return false;

  const sxArr: number[] = [];
  const syArr: number[] = [];
  let anyOnScreen = false;

  for (let i = 0; i < clipped.length; i++) {
    const sp = projectCameraPoint(cam, clipped[i]);
    if (!sp) return false;
    if (sp.sx >= -320 && sp.sx <= cam.viewW + 320) anyOnScreen = true;
    sxArr.push(sp.sx);
    syArr.push(sp.sy);
  }
  if (!anyOnScreen) return false;

  ctx.moveTo(sxArr[0], syArr[0]);
  for (let i = 1; i < sxArr.length; i++) {
    ctx.lineTo(sxArr[i], syArr[i]);
  }
  ctx.closePath();
  return true;
}

function drawProjectedPoly(
  ctx: CanvasRenderingContext2D,
  cam: Camera3DConfig,
  camPts: CamPoint[],
  fillStyle: string
): boolean {
  ctx.beginPath();
  if (!appendProjectedPolyToPath(ctx, cam, camPts)) return false;
  ctx.fillStyle = fillStyle;
  ctx.fill();
  return true;
}

function sampleEdgeCamPoint(
  cam: Camera3DConfig,
  track: BuiltTrack,
  sampleIdx: number,
  lateral: number,
  elevation = 0
): CamPoint {
  const s = track.samples[sampleIdx];
  return worldToCamera(cam, s.x + s.nx * lateral, s.y + s.ny * lateral, elevation);
}

interface Drawable3D {
  depthZ: number;
  draw: () => void;
}

function drawStreetlamp(
  ctx: CanvasRenderingContext2D,
  cam: Camera3DConfig,
  baseX: number,
  baseY: number,
  inwardNx: number,
  inwardNy: number,
  distanceFade: number
): void {
  const baseCam = worldToCamera(cam, baseX, baseY, 0);
  if (baseCam.cz < 55) return;
  const pBase = projectCameraPoint(cam, baseCam);
  const pTop = projectCameraPoint(cam, worldToCamera(cam, baseX, baseY, 108));
  const pArm = projectCameraPoint(
    cam,
    worldToCamera(cam, baseX + inwardNx * 34, baseY + inwardNy * 34, 104)
  );
  if (!pBase || !pTop || !pArm) return;
  if (pBase.sx < -160 || pBase.sx > cam.viewW + 160) return;

  const poleW = Math.max(1.2, Math.min(16, pBase.scale * 3.4));

  ctx.strokeStyle = `rgba(42, 51, 68, ${(0.92 * distanceFade).toFixed(2)})`;
  ctx.lineWidth = poleW;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pBase.sx, pBase.sy);
  ctx.lineTo(pTop.sx, pTop.sy);
  ctx.lineTo(pArm.sx, pArm.sy);
  ctx.stroke();

  const haloR = Math.max(4, Math.min(72, pArm.scale * 28));
  ctx.fillStyle = `rgba(235, 181, 86, ${(0.15 * distanceFade).toFixed(2)})`;
  ctx.beginPath();
  ctx.arc(pArm.sx, pArm.sy, haloR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(255, 232, 166, ${(0.95 * distanceFade).toFixed(2)})`;
  ctx.beginPath();
  ctx.arc(pArm.sx, pArm.sy, Math.max(1.8, Math.min(14, pArm.scale * 5)), 0, Math.PI * 2);
  ctx.fill();

  const roadRefPt = projectCameraPoint(
    cam,
    worldToCamera(cam, baseX + inwardNx * 34, baseY + inwardNy * 34, 0)
  );
  if (roadRefPt && roadRefPt.sy <= cam.viewH + 60) {
    const rw = Math.max(3, Math.min(90, roadRefPt.scale * 22));
    const rh = Math.max(1.5, Math.min(28, roadRefPt.scale * 6.5));
    ctx.fillStyle = `rgba(235, 181, 86, ${(0.16 * distanceFade).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(roadRefPt.sx, roadRefPt.sy, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStartGantry(
  ctx: CanvasRenderingContext2D,
  cam: Camera3DConfig,
  track: BuiltTrack,
  countdownRemaining: number
): void {
  const s = track.samples[0];
  const span = track.def.roadHalfWidth + track.def.shoulderWidth - 4;
  const lx = s.x - s.nx * span;
  const ly = s.y - s.ny * span;
  const rx = s.x + s.nx * span;
  const ry = s.y + s.ny * span;

  const centerCam = worldToCamera(cam, s.x, s.y, 0);
  if (centerCam.cz < 52) return;

  const pLB = projectCameraPoint(cam, worldToCamera(cam, lx, ly, 0));
  const pLT = projectCameraPoint(cam, worldToCamera(cam, lx, ly, 128));
  const pRB = projectCameraPoint(cam, worldToCamera(cam, rx, ry, 0));
  const pRT = projectCameraPoint(cam, worldToCamera(cam, rx, ry, 128));
  const pLBar = projectCameraPoint(cam, worldToCamera(cam, lx, ly, 102));
  const pRBar = projectCameraPoint(cam, worldToCamera(cam, rx, ry, 102));

  if (!pLB || !pLT || !pRB || !pRT || !pLBar || !pRBar) return;

  const colW = Math.max(3, Math.min(36, pLB.scale * 11));

  ctx.strokeStyle = '#1E2534';
  ctx.lineWidth = colW;
  ctx.beginPath();
  ctx.moveTo(pLB.sx, pLB.sy);
  ctx.lineTo(pLT.sx, pLT.sy);
  ctx.moveTo(pRB.sx, pRB.sy);
  ctx.lineTo(pRT.sx, pRT.sy);
  ctx.stroke();

  ctx.fillStyle = '#131823';
  ctx.beginPath();
  ctx.moveTo(pLT.sx, pLT.sy);
  ctx.lineTo(pRT.sx, pRT.sy);
  ctx.lineTo(pRBar.sx, pRBar.sy);
  ctx.lineTo(pLBar.sx, pLBar.sy);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#D99B38';
  ctx.lineWidth = Math.max(1.2, pLBar.scale * 2.5);
  ctx.stroke();

  const lightsLit =
    countdownRemaining > 0 ? Math.min(5, Math.max(1, 4 - Math.ceil(countdownRemaining))) : 5;
  const lightColor = countdownRemaining > 0 ? '#E84747' : '#58D68D';
  const r = Math.max(2, pLBar.scale * 4.5);
  for (let i = 0; i < 5; i++) {
    const t = 0.26 + (i / 4) * 0.48;
    const gx = pLBar.sx + (pRBar.sx - pLBar.sx) * t;
    const gy = pLBar.sy + (pRBar.sy - pLBar.sy) * t + r * 0.3;
    ctx.fillStyle = i < lightsLit ? lightColor : '#252C3B';
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const bannerWidth = Math.hypot(pRT.sx - pLT.sx, pRT.sy - pLT.sy);
  if (bannerWidth > 110) {
    const midX = (pLT.sx + pRT.sx + pLBar.sx + pRBar.sx) * 0.25;
    const midY = (pLT.sy + pRT.sy + pLBar.sy + pRBar.sy) * 0.25;
    const fontSize = Math.max(9, Math.min(24, bannerWidth * 0.055));
    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(Math.atan2(pRT.sy - pLT.sy, pRT.sx - pLT.sx));
    ctx.font = `700 ${fontSize.toFixed(1)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#F4EFE4';
    ctx.fillText('NIGHT CIRCUIT', 0, -fontSize * 0.12);
    ctx.restore();
  }
}

/**
 * Renders a detailed 3D-perspective GT Coupe (for opponents at any distance
 * and for the player hero car in Chase View).
 */
function drawPerspectiveCar(
  ctx: CanvasRenderingContext2D,
  cam: Camera3DConfig,
  car: RacerState,
  isHeroPlayer: boolean,
  steerSway: number
): void {
  const carCam = worldToCamera(cam, car.x, car.y, 0);
  if (carCam.cz < cam.nearZ + 4 || carCam.cz > cam.farZ) return;

  const sp = projectCameraPoint(cam, carCam);
  if (!sp) return;

  const w = sp.scale * (isHeroPlayer ? 35 : 32);
  if (w < 4) return;
  const h = w * 0.56;

  const relYaw = getRelativeCarYaw(car.angle, cam.angle);
  const yawSkew = Math.max(-0.55, Math.min(0.55, Math.sin(relYaw) * 0.82));
  const bodyRoll = isHeroPlayer
    ? steerSway * 0.085
    : Math.max(-0.08, Math.min(0.08, car.steerAngle * 0.1));
  const brakeGlow = car.braking || car.drifting;

  // Forward warm headlight cones cast onto wet asphalt with smooth distance falloff
  if (isHeroPlayer) {
    const fwdX = Math.cos(car.angle);
    const fwdY = Math.sin(car.angle);
    const rightX = -fwdY;
    const rightY = fwdX;
    const beamGrad = ctx.createLinearGradient(0, sp.sy - h * 0.4, 0, Math.max(cam.horizonY + 24, sp.sy - h * 2.5));
    beamGrad.addColorStop(0, 'rgba(255, 228, 162, 0.16)');
    beamGrad.addColorStop(0.55, 'rgba(255, 222, 148, 0.06)');
    beamGrad.addColorStop(1, 'rgba(255, 220, 140, 0)');
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const ox = car.x + fwdX * 18 + rightX * (side * 10);
      const oy = car.y + fwdY * 18 + rightY * (side * 10);
      const fx = car.x + fwdX * 260 + rightX * (side * 54);
      const fy = car.y + fwdY * 260 + rightY * (side * 54);
      const ix = car.x + fwdX * 260 + rightX * (side * 3);
      const iy = car.y + fwdY * 260 + rightY * (side * 3);
      appendProjectedPolyToPath(ctx, cam, [
        worldToCamera(cam, ox, oy, 0.5),
        worldToCamera(cam, ix, iy, 0.5),
        worldToCamera(cam, fx, fy, 0.5),
        worldToCamera(cam, ox + rightX * side * 6, oy + rightY * side * 6, 0.5),
      ]);
    }
    ctx.fillStyle = beamGrad;
    ctx.fill();
  }

  ctx.save();
  ctx.translate(sp.sx, sp.sy);
  ctx.rotate(bodyRoll);

  // 1. Ground shadow & wet crimson taillight reflection
  ctx.fillStyle = 'rgba(3, 5, 9, 0.72)';
  ctx.beginPath();
  ctx.ellipse(yawSkew * w * 0.12, h * 0.02, w * 0.58, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = brakeGlow ? 'rgba(255, 62, 62, 0.28)' : 'rgba(210, 44, 44, 0.14)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.14, w * 0.44, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Wide low-profile rear tires
  const tireW = w * 0.21;
  const tireH = h * 0.36;
  ctx.fillStyle = '#0A0D12';
  ctx.fillRect(-w * 0.49, -tireH * 0.88, tireW, tireH);
  ctx.fillRect(w * 0.49 - tireW, -tireH * 0.88, tireW, tireH);

  // Subtle 3/4 side flank visible when car corners across view
  if (Math.abs(yawSkew) > 0.09) {
    const sideDir = Math.sign(yawSkew);
    const flankDepth = Math.abs(yawSkew) * w * 0.52;
    const edgeX = sideDir > 0 ? -w * 0.46 : w * 0.46;
    const farEdgeX = edgeX - sideDir * flankDepth;
    ctx.fillStyle = 'rgba(14, 18, 26, 0.78)';
    ctx.beginPath();
    ctx.moveTo(edgeX, -h * 0.18);
    ctx.lineTo(farEdgeX, -h * 0.26);
    ctx.lineTo(farEdgeX, -h * 0.58);
    ctx.lineTo(edgeX, -h * 0.56);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0A0D12';
    ctx.fillRect(
      farEdgeX - (sideDir > 0 ? 0 : tireW * 0.55),
      -h * 0.34,
      tireW * 0.55,
      tireH * 0.72
    );
  }

  // 3. Rear carbon diffuser & bumper skirt
  ctx.fillStyle = '#12161F';
  ctx.fillRect(-w * 0.47, -h * 0.34, w * 0.94, h * 0.24);
  if (w > 48) {
    ctx.fillStyle = '#252D3D';
    for (const fx of [-0.22, -0.08, 0.08, 0.22]) {
      ctx.fillRect(w * fx - 1, -h * 0.28, 2, h * 0.16);
    }
  }

  // 4. Sculpted GT main chassis haunches
  const bodyColor = car.hitFlash > 0.2 ? '#FFF4D8' : car.primaryColor;
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(-w * 0.49, -h * 0.26);
  ctx.lineTo(-w * 0.46, -h * 0.62);
  ctx.lineTo(-w * 0.34 + yawSkew * w * 0.12, -h * 0.76);
  ctx.lineTo(w * 0.34 + yawSkew * w * 0.12, -h * 0.76);
  ctx.lineTo(w * 0.46, -h * 0.62);
  ctx.lineTo(w * 0.49, -h * 0.26);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  ctx.moveTo(-w * 0.42, -h * 0.58);
  ctx.lineTo(-w * 0.31 + yawSkew * w * 0.1, -h * 0.73);
  ctx.lineTo(w * 0.31 + yawSkew * w * 0.1, -h * 0.73);
  ctx.lineTo(w * 0.42, -h * 0.58);
  ctx.closePath();
  ctx.fill();

  // 5. Fastback cabin roofline & dark tinted rear window
  const roofShift = yawSkew * w * 0.16;
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(-w * 0.35 + roofShift * 0.6, -h * 0.74);
  ctx.lineTo(-w * 0.26 + roofShift, -h * 1.02);
  ctx.lineTo(w * 0.26 + roofShift, -h * 1.02);
  ctx.lineTo(w * 0.35 + roofShift * 0.6, -h * 0.74);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0F1521';
  ctx.beginPath();
  ctx.moveTo(-w * 0.29 + roofShift * 0.65, -h * 0.74);
  ctx.lineTo(-w * 0.22 + roofShift, -h * 0.96);
  ctx.lineTo(w * 0.22 + roofShift, -h * 0.96);
  ctx.lineTo(w * 0.29 + roofShift * 0.65, -h * 0.74);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(182, 208, 244, 0.2)';
  ctx.beginPath();
  ctx.moveTo(-w * 0.14 + roofShift * 0.85, -h * 0.95);
  ctx.lineTo(-w * 0.03 + roofShift * 0.85, -h * 0.95);
  ctx.lineTo(-w * 0.12 + roofShift * 0.65, -h * 0.75);
  ctx.lineTo(-w * 0.2 + roofShift * 0.65, -h * 0.75);
  ctx.closePath();
  ctx.fill();

  // Center dual racing stripe
  ctx.fillStyle = car.accentColor;
  ctx.fillRect(-w * 0.07 + roofShift * 0.3, -h * 0.72, w * 0.055, h * 0.42);
  ctx.fillRect(w * 0.015 + roofShift * 0.3, -h * 0.72, w * 0.055, h * 0.42);
  ctx.fillRect(-w * 0.06 + roofShift, -h * 1.02, w * 0.048, h * 0.07);
  ctx.fillRect(w * 0.012 + roofShift, -h * 1.02, w * 0.048, h * 0.07);

  // 6. Raised carbon-fiber GT rear wing spoiler
  ctx.fillStyle = '#151A24';
  ctx.fillRect(-w * 0.24, -h * 0.84, Math.max(1.5, w * 0.04), h * 0.16);
  ctx.fillRect(w * 0.2, -h * 0.84, Math.max(1.5, w * 0.04), h * 0.16);
  ctx.fillStyle = '#1B212E';
  ctx.fillRect(-w * 0.48, -h * 0.88, w * 0.96, Math.max(2, h * 0.08));
  ctx.fillStyle = '#0D1017';
  ctx.fillRect(-w * 0.5, -h * 0.91, Math.max(2, w * 0.045), h * 0.14);
  ctx.fillRect(w * 0.455, -h * 0.91, Math.max(2, w * 0.045), h * 0.14);

  // 7. Crimson LED taillights
  const tailY = -h * 0.56;
  const tailH = Math.max(2, h * 0.11);
  ctx.fillStyle = brakeGlow ? '#FF4848' : '#B82929';
  ctx.fillRect(-w * 0.44, tailY, w * 0.24, tailH);
  ctx.fillRect(w * 0.2, tailY, w * 0.24, tailH);
  ctx.fillStyle = brakeGlow ? 'rgba(255, 84, 84, 0.9)' : 'rgba(184, 41, 41, 0.55)';
  ctx.fillRect(-w * 0.2, tailY + tailH * 0.3, w * 0.4, Math.max(1, tailH * 0.35));

  if (brakeGlow) {
    ctx.fillStyle = 'rgba(255, 68, 68, 0.34)';
    ctx.beginPath();
    ctx.ellipse(-w * 0.32, tailY + tailH * 0.5, w * 0.2, h * 0.16, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.32, tailY + tailH * 0.5, w * 0.2, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 8. Twin exhaust tips & Nitro flame plumes
  const exY = -h * 0.2;
  const exR = Math.max(1.5, w * 0.045);
  ctx.fillStyle = '#2B3446';
  ctx.beginPath();
  ctx.arc(-w * 0.24, exY, exR, 0, Math.PI * 2);
  ctx.arc(w * 0.24, exY, exR, 0, Math.PI * 2);
  ctx.fill();

  if (car.boosting) {
    const flicker = 0.8 + Math.random() * 0.5;
    for (const exX of [-w * 0.24, w * 0.24]) {
      ctx.fillStyle = 'rgba(245, 181, 68, 0.85)';
      ctx.beginPath();
      ctx.ellipse(exX, exY + exR * 0.4, exR * 1.6 * flicker, exR * 2.1 * flicker, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(112, 195, 255, 0.95)';
      ctx.beginPath();
      ctx.ellipse(exX, exY + exR * 0.2, exR * 0.9 * flicker, exR * 1.2 * flicker, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 9. Rear racing number plate
  if (w > 54) {
    const plateW = w * 0.22;
    const plateH = h * 0.15;
    ctx.fillStyle = '#0D1017';
    ctx.fillRect(-plateW * 0.5, -h * 0.42, plateW, plateH);
    ctx.strokeStyle = 'rgba(217, 155, 56, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-plateW * 0.5, -h * 0.42, plateW, plateH);
    ctx.font = `700 ${Math.max(7, plateH * 0.72).toFixed(1)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#F4EFE4';
    ctx.fillText(car.number, 0, -h * 0.42 + plateH * 0.52);
  }

  ctx.restore();

  // Floating driver number badge above close opponents
  if (!isHeroPlayer && carCam.cz < 1150 && w > 12) {
    const alpha = Math.max(0.28, Math.min(0.95, 1 - (carCam.cz - 300) / 900));
    const tagY = sp.sy - h * 1.24 - 10;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10, 13, 19, 0.84)';
    ctx.fillRect(sp.sx - 18, tagY - 9, 36, 14);
    ctx.fillStyle = car.primaryColor;
    ctx.fillRect(sp.sx - 18, tagY - 9, 3, 14);
    ctx.fillStyle = '#ECE6D8';
    ctx.fillText(`#${car.number}`, sp.sx + 1, tagY + 1.5);
    ctx.restore();
  }
}

/**
 * Renders the sculpted driver-perspective GT Hood foreground overlay for Hood View.
 */
function drawDriverHoodOverlay(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  player: RacerState,
  steerSway: number,
  elapsedMs: number
): void {
  const hoodH = Math.min(138, viewH * 0.175);
  const topY = viewH - hoodH;
  const vibration =
    Math.abs(player.speed) > 40 ? Math.sin(elapsedMs * 0.045) * (player.boosting ? 2.4 : 1.1) : 0;
  const rollShift = steerSway * 22;

  ctx.save();
  ctx.translate(0, vibration);

  // Dual warm headlight glow cones with soft atmospheric distance falloff
  const beamEndY = viewH * 0.52;
  const hoodBeamGrad = ctx.createLinearGradient(0, topY + 12, 0, beamEndY);
  hoodBeamGrad.addColorStop(0, 'rgba(255, 228, 162, 0.15)');
  hoodBeamGrad.addColorStop(0.55, 'rgba(255, 220, 146, 0.05)');
  hoodBeamGrad.addColorStop(1, 'rgba(255, 218, 140, 0)');
  ctx.fillStyle = hoodBeamGrad;
  ctx.beginPath();
  ctx.moveTo(viewW * 0.25 + rollShift, topY + 12);
  ctx.lineTo(viewW * 0.08, beamEndY);
  ctx.lineTo(viewW * 0.44, beamEndY);
  ctx.closePath();
  ctx.moveTo(viewW * 0.75 + rollShift, topY + 12);
  ctx.lineTo(viewW * 0.56, beamEndY);
  ctx.lineTo(viewW * 0.92, beamEndY);
  ctx.closePath();
  ctx.fill();

  // Sculpted Noir Gold GT Hood silhouette
  ctx.fillStyle = '#A67222';
  ctx.beginPath();
  ctx.moveTo(viewW * 0.14 + rollShift * 0.4, viewH + 8);
  ctx.lineTo(viewW * 0.24 + rollShift, topY + 14);
  ctx.quadraticCurveTo(viewW * 0.5 + rollShift, topY - 8, viewW * 0.76 + rollShift, topY + 14);
  ctx.lineTo(viewW * 0.86 + rollShift * 0.4, viewH + 8);
  ctx.closePath();
  ctx.fill();

  // Darker lower hood contour shadow
  ctx.fillStyle = 'rgba(14, 18, 26, 0.35)';
  ctx.beginPath();
  ctx.moveTo(viewW * 0.14 + rollShift * 0.4, viewH + 8);
  ctx.lineTo(viewW * 0.21 + rollShift * 0.7, topY + 52);
  ctx.quadraticCurveTo(viewW * 0.5 + rollShift * 0.7, topY + 34, viewW * 0.79 + rollShift * 0.7, topY + 52);
  ctx.lineTo(viewW * 0.86 + rollShift * 0.4, viewH + 8);
  ctx.closePath();
  ctx.fill();

  // Leading-edge champagne highlight
  ctx.strokeStyle = 'rgba(255, 236, 186, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(viewW * 0.24 + rollShift, topY + 14);
  ctx.quadraticCurveTo(viewW * 0.5 + rollShift, topY - 8, viewW * 0.76 + rollShift, topY + 14);
  ctx.stroke();

  // Dual center racing stripes
  ctx.fillStyle = 'rgba(255, 240, 194, 0.86)';
  ctx.beginPath();
  ctx.moveTo(viewW * 0.478 + rollShift, topY + 4);
  ctx.lineTo(viewW * 0.494 + rollShift, topY + 4);
  ctx.lineTo(viewW * 0.491 + rollShift * 0.4, viewH + 8);
  ctx.lineTo(viewW * 0.464 + rollShift * 0.4, viewH + 8);
  ctx.closePath();
  ctx.moveTo(viewW * 0.506 + rollShift, topY + 4);
  ctx.lineTo(viewW * 0.522 + rollShift, topY + 4);
  ctx.lineTo(viewW * 0.536 + rollShift * 0.4, viewH + 8);
  ctx.lineTo(viewW * 0.509 + rollShift * 0.4, viewH + 8);
  ctx.closePath();
  ctx.fill();

  // Recessed dark carbon hood heat-extractor vents
  ctx.fillStyle = 'rgba(12, 15, 22, 0.78)';
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(viewW * (0.5 + side * 0.08) + rollShift * 0.8, topY + 34);
    ctx.lineTo(viewW * (0.5 + side * 0.15) + rollShift * 0.8, topY + 38);
    ctx.lineTo(viewW * (0.5 + side * 0.17) + rollShift * 0.6, topY + 74);
    ctx.lineTo(viewW * (0.5 + side * 0.09) + rollShift * 0.6, topY + 68);
    ctx.closePath();
  }
  ctx.fill();

  // Dark suede dashboard cowl at very bottom edge
  ctx.fillStyle = '#0B0E14';
  ctx.beginPath();
  ctx.moveTo(0, viewH);
  ctx.lineTo(0, viewH - 22);
  ctx.quadraticCurveTo(viewW * 0.5, viewH - 42, viewW, viewH - 22);
  ctx.lineTo(viewW, viewH);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawUpcomingCornerIndicator(
  ctx: CanvasRenderingContext2D,
  world: RaceWorldState,
  player: RacerState,
  viewW: number,
  horizonY: number
): void {
  if (world.countdownRemaining > 0 || Math.abs(player.speed) < 150) return;
  const adv = computeTurnAdvisory(world.track, player.trackSampleIdx);
  if (adv.direction === 'none') return;

  const isSharp = adv.severity === 'sharp';
  const pulse = 0.62 + 0.38 * Math.sin(world.elapsedMs * 0.014);
  const label =
    adv.direction === 'right'
      ? isSharp
        ? 'SHARP RIGHT  ▶▶'
        : 'CURVE RIGHT  ▶'
      : isSharp
      ? '◀◀  SHARP LEFT'
      : '◀  CURVE LEFT';

  const y = Math.max(76, horizonY * 0.36);
  ctx.save();
  ctx.font = '600 11px "IBM Plex Mono", monospace';
  const textW = ctx.measureText(label).width;
  const boxW = textW + 24;
  const boxH = 26;
  const boxX = (viewW - boxW) * 0.5;

  ctx.fillStyle = 'rgba(13, 16, 23, 0.86)';
  ctx.strokeStyle = isSharp
    ? `rgba(235, 181, 86, ${(0.55 + pulse * 0.4).toFixed(2)})`
    : 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = isSharp ? 1.5 : 1;
  ctx.beginPath();
  ctx.roundRect(boxX, y, boxW, boxH, 4);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isSharp ? '#F5C45E' : '#D5DCE8';
  ctx.fillText(label, viewW * 0.5, y + boxH * 0.5 + 0.5);
  ctx.restore();
}

export function renderFrontViewFrame(
  ctx: CanvasRenderingContext2D,
  world: RaceWorldState,
  viewW: number,
  viewH: number,
  mode: Exclude<CameraMode, 'topdown'>
): void {
  const player = world.racers.find((r) => r.isPlayer) ?? world.racers[0];
  const { track } = world;
  const count = track.samples.length;

  const trauma = world.camera.shakeTrauma;
  const shakeMag = trauma * trauma * 10;
  const shakeX = shakeMag > 0.1 ? (Math.random() - 0.5) * 2 * shakeMag : 0;
  const shakeY = shakeMag > 0.1 ? (Math.random() - 0.5) * 2 * shakeMag : 0;
  const speedRatio = Math.min(1, Math.abs(player.speed) / 760);

  const cam = buildCamera3D({
    mode,
    playerX: player.x,
    playerY: player.y,
    camAngle: world.camera.angle,
    speedRatio,
    boosting: player.boosting,
    shakeX,
    shakeY,
    viewW,
    viewH,
  });

  // 1. Parallax Midnight Sky & Cityscape Panorama (exact 1:1 unscaled memcpy blit!)
  const skyH = Math.max(160, Math.ceil(cam.horizonY + 6));
  const sky = getSkylinePanorama(skyH);
  if (sky) {
    const normAng = ((cam.angle / (Math.PI * 2)) % 1 + 1) % 1;
    const srcStart = Math.floor(normAng * sky.width);
    const neededW = Math.min(sky.width, Math.ceil(viewW) + 2);
    const firstChunk = Math.min(neededW, sky.width - srcStart);

    ctx.drawImage(sky, srcStart, 0, firstChunk, sky.height, 0, 0, firstChunk, sky.height);
    const rem = neededW - firstChunk;
    if (rem > 0) {
      ctx.drawImage(sky, 0, 0, rem, sky.height, firstChunk, 0, rem, sky.height);
    }
  } else {
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, viewW, skyH);
  }

  // 2. Deep Nocturnal Wet Ground Plane
  ctx.fillStyle = '#0A0E16';
  ctx.fillRect(0, cam.horizonY, viewW, viewH - cam.horizonY + 4);
  ctx.fillStyle = 'rgba(217, 155, 56, 0.08)';
  ctx.fillRect(0, cam.horizonY - 2, viewW, 5);

  // 3. Compact Adaptive-LOD Track Slices (~26 crisp convex quads from bumper to horizon)
  const { roadHalfWidth, shoulderWidth } = track.def;
  const curbOuter = roadHalfWidth + 11;
  const barrierOuter = roadHalfWidth + shoulderWidth;

  interface SegmentSlice {
    idx: number;
    nextIdx: number;
    depthZ: number;
  }

  const slices: SegmentSlice[] = [];
  for (let offset = -4; offset < 56; ) {
    const step = offset < 12 ? 1 : offset < 32 ? 2 : 4;
    const idx = (player.trackSampleIdx + offset + count) % count;
    const nextIdx = (idx + step) % count;
    const sA = track.samples[idx];
    const sB = track.samples[nextIdx];
    const cA = worldToCamera(cam, sA.x, sA.y, 0);
    const cB = worldToCamera(cam, sB.x, sB.y, 0);
    const maxZ = Math.max(cA.cz, cB.cz);
    const minZ = Math.min(cA.cz, cB.cz);
    if (maxZ >= cam.nearZ && minZ <= cam.farZ) {
      slices.push({
        idx,
        nextIdx,
        depthZ: (cA.cz + cB.cz) * 0.5,
      });
    }
    offset += step;
  }

  slices.sort((a, b) => b.depthZ - a.depthZ);

  const boostPadBySample = new Map<number, (typeof track.def.boostPads)[number]>();
  for (const pad of track.def.boostPads) {
    boostPadBySample.set(pad.sampleIndex % count, pad);
  }
  const boostPulse = 0.65 + 0.35 * Math.sin(world.elapsedMs * 0.009);

  // 4. Individual Simple Convex Quad Road Slices (Skia fast-path: 4 vertices per fill, zero multi-subpath stall!)
  for (const slice of slices) {
    const { idx, nextIdx, depthZ } = slice;
    const alt = Math.floor(idx / 2) % 2 === 0;
    const curbAlt = idx % 2 === 0;

    // Wet runoff shoulder
    drawProjectedPoly(
      ctx,
      cam,
      [
        sampleEdgeCamPoint(cam, track, idx, -barrierOuter),
        sampleEdgeCamPoint(cam, track, idx, barrierOuter),
        sampleEdgeCamPoint(cam, track, nextIdx, barrierOuter),
        sampleEdgeCamPoint(cam, track, nextIdx, -barrierOuter),
      ],
      alt ? '#121620' : '#10141D'
    );

    // Alternating crimson & warm-cream curbs
    const curbColor = curbAlt ? '#B53838' : '#CFC7B6';
    drawProjectedPoly(
      ctx,
      cam,
      [
        sampleEdgeCamPoint(cam, track, idx, -curbOuter),
        sampleEdgeCamPoint(cam, track, idx, -roadHalfWidth),
        sampleEdgeCamPoint(cam, track, nextIdx, -roadHalfWidth),
        sampleEdgeCamPoint(cam, track, nextIdx, -curbOuter),
      ],
      curbColor
    );
    drawProjectedPoly(
      ctx,
      cam,
      [
        sampleEdgeCamPoint(cam, track, idx, roadHalfWidth),
        sampleEdgeCamPoint(cam, track, idx, curbOuter),
        sampleEdgeCamPoint(cam, track, nextIdx, curbOuter),
        sampleEdgeCamPoint(cam, track, nextIdx, roadHalfWidth),
      ],
      curbColor
    );

    // Main wet asphalt road surface
    drawProjectedPoly(
      ctx,
      cam,
      [
        sampleEdgeCamPoint(cam, track, idx, -roadHalfWidth),
        sampleEdgeCamPoint(cam, track, idx, roadHalfWidth),
        sampleEdgeCamPoint(cam, track, nextIdx, roadHalfWidth),
        sampleEdgeCamPoint(cam, track, nextIdx, -roadHalfWidth),
      ],
      alt ? '#1E2330' : '#191E29'
    );

    // Dashed amber centerline guide
    if (curbAlt && depthZ < 1300) {
      drawProjectedPoly(
        ctx,
        cam,
        [
          sampleEdgeCamPoint(cam, track, idx, -3),
          sampleEdgeCamPoint(cam, track, idx, 3),
          sampleEdgeCamPoint(cam, track, nextIdx, 3),
          sampleEdgeCamPoint(cam, track, nextIdx, -3),
        ],
        'rgba(217, 155, 56, 0.52)'
      );
    }

    // Start / Finish checkered strip across road on sample 0
    if (idx === 0) {
      const tiles = 8;
      const tileW = (roadHalfWidth * 2) / tiles;
      for (let t = 0; t < tiles; t++) {
        const lat0 = -roadHalfWidth + t * tileW;
        const lat1 = lat0 + tileW;
        drawProjectedPoly(
          ctx,
          cam,
          [
            sampleEdgeCamPoint(cam, track, idx, lat0),
            sampleEdgeCamPoint(cam, track, idx, lat1),
            sampleEdgeCamPoint(cam, track, nextIdx, lat1),
            sampleEdgeCamPoint(cam, track, nextIdx, lat0),
          ],
          t % 2 === 0 ? '#F2ECDC' : '#11151D'
        );
      }
    }

    // Glowing nitro boost pad
    const pad = boostPadBySample.get(idx);
    if (pad) {
      const padHalfW = pad.width * 0.72;
      const pL = pad.lateralOffset - padHalfW;
      const pR = pad.lateralOffset + padHalfW;
      const endIdx = (idx + 2) % count;
      drawProjectedPoly(
        ctx,
        cam,
        [
          sampleEdgeCamPoint(cam, track, idx, pL, 0.4),
          sampleEdgeCamPoint(cam, track, idx, pR, 0.4),
          sampleEdgeCamPoint(cam, track, endIdx, pR, 0.4),
          sampleEdgeCamPoint(cam, track, endIdx, pL, 0.4),
        ],
        `rgba(235, 181, 86, ${(0.3 + boostPulse * 0.25).toFixed(2)})`
      );
      drawProjectedPoly(
        ctx,
        cam,
        [
          sampleEdgeCamPoint(cam, track, idx, pad.lateralOffset - padHalfW * 0.45, 0.7),
          sampleEdgeCamPoint(cam, track, idx, pad.lateralOffset + padHalfW * 0.45, 0.7),
          sampleEdgeCamPoint(cam, track, endIdx, pad.lateralOffset, 0.7),
          sampleEdgeCamPoint(cam, track, endIdx, pad.lateralOffset, 0.7),
        ],
        `rgba(112, 195, 255, ${(0.58 + boostPulse * 0.32).toFixed(2)})`
      );
    }
  }

  // 5. Depth-Sorted 3D Vertical World Queue (guardrails, streetlamps, gantry, opponent cars, particles)
  const queue: Drawable3D[] = [];

  for (const slice of slices) {
    const { idx, nextIdx, depthZ } = slice;
    const alt = idx % 2 === 0;
    const distanceFade = Math.max(0.2, 1 - depthZ / cam.farZ);
    const sA = track.samples[idx];
    const sB = track.samples[nextIdx];
    const sharpCorner = Math.abs(sA.curvature) > 0.0018;

    // 3D Guardrail walls within 1150 units
    if (depthZ < 1150) {
      for (const side of [-1, 1]) {
        const wallLat = side * barrierOuter;
        const b0 = worldToCamera(cam, sA.x + sA.nx * wallLat, sA.y + sA.ny * wallLat, 0);
        const b1 = worldToCamera(cam, sB.x + sB.nx * wallLat, sB.y + sB.ny * wallLat, 0);
        const wallDepth = (b0.cz + b1.cz) * 0.5;
        if (wallDepth < cam.nearZ || wallDepth > 1150) continue;

        const t0 = worldToCamera(cam, sA.x + sA.nx * wallLat, sA.y + sA.ny * wallLat, 17);
        const t1 = worldToCamera(cam, sB.x + sB.nx * wallLat, sB.y + sB.ny * wallLat, 17);
        const isOuterCorner = sharpCorner && Math.sign(sA.curvature) === -side;

        queue.push({
          depthZ: wallDepth,
          draw: () => {
            drawProjectedPoly(ctx, cam, [b0, b1, t1, t0], alt ? '#232B3B' : '#1C2230');
            if (isOuterCorner || alt) {
              const st0 = worldToCamera(cam, sA.x + sA.nx * wallLat, sA.y + sA.ny * wallLat, 11);
              const st1 = worldToCamera(cam, sB.x + sB.nx * wallLat, sB.y + sB.ny * wallLat, 11);
              const stT0 = worldToCamera(cam, sA.x + sA.nx * wallLat, sA.y + sA.ny * wallLat, 14.5);
              const stT1 = worldToCamera(cam, sB.x + sB.nx * wallLat, sB.y + sB.ny * wallLat, 14.5);
              drawProjectedPoly(
                ctx,
                cam,
                [st0, st1, stT1, stT0],
                isOuterCorner ? (alt ? '#EBB556' : '#D64545') : 'rgba(217, 155, 56, 0.56)'
              );
            }
          },
        });
      }
    }

    // Trackside overhead sodium-amber streetlamps every 12 samples
    if (idx % 12 === 0) {
      const side = idx % 24 === 0 ? 1 : -1;
      const lampDist = barrierOuter + 10;
      const lx = sA.x + sA.nx * side * lampDist;
      const ly = sA.y + sA.ny * side * lampDist;
      const lCam = worldToCamera(cam, lx, ly, 0);
      if (lCam.cz >= cam.nearZ && lCam.cz <= cam.farZ) {
        queue.push({
          depthZ: lCam.cz,
          draw: () =>
            drawStreetlamp(ctx, cam, lx, ly, -sA.nx * side, -sA.ny * side, distanceFade),
        });
      }
    }

    // Overhead Start / Finish gantry at sample 0
    if (idx === 0) {
      const gCam = worldToCamera(cam, sA.x, sA.y, 0);
      if (gCam.cz >= cam.nearZ && gCam.cz <= cam.farZ) {
        queue.push({
          depthZ: gCam.cz,
          draw: () => drawStartGantry(ctx, cam, track, world.countdownRemaining),
        });
      }
    }
  }

  // Opponent cars in exact 3D depth order
  for (const car of world.racers) {
    if (car.isPlayer) continue;
    const cPt = worldToCamera(cam, car.x, car.y, 0);
    if (cPt.cz < cam.nearZ + 4 || cPt.cz > cam.farZ) continue;
    queue.push({
      depthZ: cPt.cz,
      draw: () => drawPerspectiveCar(ctx, cam, car, false, 0),
    });
  }

  // 3D particles (sparks, drift smoke, boost embers)
  for (let i = 0; i < world.particles.length; i++) {
    const p = world.particles[i];
    if (!p.active) continue;
    const pCam = worldToCamera(cam, p.x, p.y, 6);
    if (pCam.cz < cam.nearZ + 4 || pCam.cz > 1100) continue;
    const sp = projectCameraPoint(cam, pCam);
    if (!sp) continue;
    const alpha = Math.max(0, p.life / p.maxLife);
    const radius = Math.max(1.2, sp.scale * p.size * 0.75);
    queue.push({
      depthZ: pCam.cz,
      draw: () => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sp.sx, sp.sy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      },
    });
  }

  queue.sort((a, b) => b.depthZ - a.depthZ);
  for (let i = 0; i < queue.length; i++) {
    queue[i].draw();
  }

  // 6. Player Hero GT Car (Chase View) or Sculpted GT Hood (Hood View)
  if (mode === 'chase') {
    drawPerspectiveCar(ctx, cam, player, true, world.camera.steerSway);
  } else {
    drawDriverHoodOverlay(ctx, viewW, viewH, player, world.camera.steerSway, world.elapsedMs);
  }

  // 7. High-Speed / Nitro Radial Motion Lines around outer edges
  if (speedRatio > 0.68 || player.boosting) {
    const intensity = player.boosting ? 0.34 : (speedRatio - 0.68) * 0.45;
    const cx = viewW * 0.5;
    const cy = cam.horizonY + viewH * 0.04;
    const t = world.elapsedMs * 0.03;
    ctx.strokeStyle = player.boosting
      ? `rgba(245, 196, 94, ${intensity.toFixed(2)})`
      : `rgba(200, 214, 238, ${intensity.toFixed(2)})`;
    ctx.lineWidth = player.boosting ? 1.8 : 1.1;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const ang = (i * 2.39996 + Math.floor(t) * 0.27) % (Math.PI * 2);
      const innerR = Math.min(viewW, viewH) * 0.38;
      const outerR = Math.hypot(viewW, viewH) * 0.62;
      ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
      ctx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR);
    }
    ctx.stroke();
  }

  // 8. Atmospheric Noir Rain Streaks
  const rainTime = world.elapsedMs * 0.075;
  const rainTilt = -6 - world.camera.steerSway * 10;
  ctx.strokeStyle = 'rgba(180, 200, 232, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 34; i++) {
    const rx = ((i * 197 + rainTime * 1.6) % (viewW + 140)) - 70;
    const ry = ((i * 131 + rainTime * (5.2 + speedRatio * 3.8)) % (viewH + 140)) - 70;
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + rainTilt, ry + 18 + speedRatio * 8);
  }
  ctx.stroke();

  // 9. Upcoming Sharp Corner Advisory Chevron
  drawUpcomingCornerIndicator(ctx, world, player, viewW, cam.horizonY);
}
