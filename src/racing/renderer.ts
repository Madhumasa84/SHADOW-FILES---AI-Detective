import { renderFrontViewFrame } from './frontRenderer.ts';
import type { BuiltTrack, CameraMode, RaceWorldState, RacerState } from './types.ts';

interface TrackRenderCache {
  circuitId: string;
  canvas: HTMLCanvasElement;
  originX: number;
  originY: number;
}

let cachedTrackLayer: TrackRenderCache | null = null;

function drawClosedPolyline(
  ctx: CanvasRenderingContext2D,
  track: BuiltTrack,
  lateralOffset: number
): void {
  const { samples } = track;
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const x = s.x + s.nx * lateralOffset;
    const y = s.y + s.ny * lateralOffset;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Pre-renders the entire static circuit (barriers, wet asphalt, 480 curb blocks,
 * start/finish gantry, streetlamp light pools, and terrain grid) once per circuit
 * onto an offscreen canvas so each 60 FPS frame draws the track with a single blit.
 */
function getOrBuildTrackCache(track: BuiltTrack): TrackRenderCache | null {
  if (typeof document === 'undefined') return null;
  if (cachedTrackLayer && cachedTrackLayer.circuitId === track.def.id) {
    return cachedTrackLayer;
  }

  const pad = 160;
  const originX = Math.floor(track.bounds.minX - pad);
  const originY = Math.floor(track.bounds.minY - pad);
  const width = Math.ceil(track.bounds.maxX - track.bounds.minX + pad * 2);
  const height = Math.ceil(track.bounds.maxY - track.bounds.minY + pad * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.save();
  ctx.translate(-originX, -originY);

  // Subtle nocturnal city grid on surrounding terrain
  const gridStep = 180;
  const gxStart = Math.floor(originX / gridStep) * gridStep;
  const gxEnd = originX + width;
  const gyStart = Math.floor(originY / gridStep) * gridStep;
  const gyEnd = originY + height;
  ctx.strokeStyle = 'rgba(34, 42, 58, 0.34)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = gxStart; gx <= gxEnd; gx += gridStep) {
    ctx.moveTo(gx, originY);
    ctx.lineTo(gx, originY + height);
  }
  for (let gy = gyStart; gy <= gyEnd; gy += gridStep) {
    ctx.moveTo(originX, gy);
    ctx.lineTo(originX + width, gy);
  }
  ctx.stroke();

  const { samples, def } = track;
  const roadW = def.roadHalfWidth * 2;
  const outerW = (def.roadHalfWidth + def.shoulderWidth) * 2;

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Concrete safety barrier rim
  drawClosedPolyline(ctx, track, 0);
  ctx.strokeStyle = '#2C3445';
  ctx.lineWidth = outerW + 18;
  ctx.stroke();

  // 2. Wet dark runoff shoulder
  drawClosedPolyline(ctx, track, 0);
  ctx.strokeStyle = '#151922';
  ctx.lineWidth = outerW;
  ctx.stroke();

  // 3. Outer shoulder border
  drawClosedPolyline(ctx, track, 0);
  ctx.strokeStyle = '#242B3A';
  ctx.lineWidth = roadW + 16;
  ctx.stroke();

  // 4. Main dark wet asphalt surface
  drawClosedPolyline(ctx, track, 0);
  ctx.strokeStyle = '#1D222C';
  ctx.lineWidth = roadW;
  ctx.stroke();

  // 5. Inner polished racing groove
  drawClosedPolyline(ctx, track, 0);
  ctx.strokeStyle = '#181C25';
  ctx.lineWidth = roadW * 0.6;
  ctx.stroke();

  // 6. Alternating red & warm-cream racing curbs (batched into 2 paths per side!)
  const curbWidth = 8;
  for (const side of [-1, 1]) {
    const offset = side * (def.roadHalfWidth + curbWidth * 0.45);
    for (let parity = 0; parity < 2; parity++) {
      ctx.beginPath();
      for (let i = parity; i < samples.length; i += 2) {
        const a = samples[i];
        const b = samples[(i + 1) % samples.length];
        ctx.moveTo(a.x + a.nx * offset, a.y + a.ny * offset);
        ctx.lineTo(b.x + b.nx * offset, b.y + b.ny * offset);
      }
      ctx.strokeStyle = parity === 0 ? '#B53838' : '#CFC7B6';
      ctx.lineWidth = curbWidth;
      ctx.stroke();
    }
  }

  // 7. Dashed amber center lane guide
  ctx.save();
  drawClosedPolyline(ctx, track, 0);
  ctx.strokeStyle = 'rgba(217, 155, 56, 0.28)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([22, 26]);
  ctx.stroke();
  ctx.restore();

  // 8. Start / Finish checkered line, grid boxes & gantry towers
  const start = samples[0];
  const startAng = Math.atan2(start.ty, start.tx);
  ctx.save();
  ctx.translate(start.x, start.y);
  ctx.rotate(startAng);

  const sq = 12;
  const rows = Math.floor((def.roadHalfWidth * 2) / sq);
  const startY = -(rows * sq) / 2;
  for (let col = 0; col < 2; col++) {
    for (let row = 0; row < rows; row++) {
      ctx.fillStyle = (col + row) % 2 === 0 ? '#F2ECDC' : '#12151C';
      ctx.fillRect((col - 1) * sq, startY + row * sq, sq, sq);
    }
  }

  ctx.strokeStyle = 'rgba(242, 236, 220, 0.34)';
  ctx.lineWidth = 2;
  const gridOffsets = [
    { x: -75, y: -34 },
    { x: -135, y: 34 },
    { x: -195, y: -34 },
    { x: -255, y: 34 },
  ];
  for (const g of gridOffsets) {
    ctx.beginPath();
    ctx.moveTo(g.x + 18, g.y - 16);
    ctx.lineTo(g.x + 26, g.y - 16);
    ctx.lineTo(g.x + 26, g.y + 16);
    ctx.lineTo(g.x + 18, g.y + 16);
    ctx.stroke();
  }

  const towerOffset = def.roadHalfWidth + 16;
  ctx.fillStyle = '#2B3344';
  ctx.fillRect(-10, -towerOffset - 12, 20, 14);
  ctx.fillRect(-10, towerOffset - 2, 20, 14);
  ctx.fillStyle = '#D99B38';
  ctx.fillRect(-6, -towerOffset - 9, 12, 4);
  ctx.fillRect(-6, towerOffset + 5, 12, 4);
  ctx.restore();

  // 9. Warm amber trackside streetlamps baked into the static canvas
  for (let i = 8; i < samples.length; i += 16) {
    const s = samples[i];
    const side = i % 32 === 8 ? 1 : -1;
    const lampDist = def.roadHalfWidth + def.shoulderWidth + 14;
    const lx = s.x + s.nx * side * lampDist;
    const ly = s.y + s.ny * side * lampDist;

    const grad = ctx.createRadialGradient(lx, ly, 4, lx, ly, 120);
    grad.addColorStop(0, 'rgba(235, 181, 86, 0.24)');
    grad.addColorStop(0.5, 'rgba(217, 155, 56, 0.06)');
    grad.addColorStop(1, 'rgba(217, 155, 56, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lx, ly, 120, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F5CF7B';
    ctx.beginPath();
    ctx.arc(lx, ly, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  cachedTrackLayer = {
    circuitId: track.def.id,
    canvas,
    originX,
    originY,
  };
  return cachedTrackLayer;
}

function drawDynamicBoostPads(ctx: CanvasRenderingContext2D, track: BuiltTrack, elapsedMs: number): void {
  const pulse = 0.65 + 0.35 * Math.sin(elapsedMs * 0.008);
  for (const pad of track.def.boostPads) {
    const s = track.samples[pad.sampleIndex % track.samples.length];
    const px = s.x + s.nx * pad.lateralOffset;
    const py = s.y + s.ny * pad.lateralOffset;
    const ang = Math.atan2(s.ty, s.tx);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = `rgba(217, 155, 56, ${0.14 + pulse * 0.14})`;
    ctx.fillRect(-pad.length * 0.5, -pad.width * 0.5, pad.length, pad.width);

    ctx.strokeStyle = `rgba(242, 198, 108, ${0.55 + pulse * 0.4})`;
    ctx.lineWidth = 2.5;
    for (let c = -1; c <= 1; c++) {
      const cx = c * 22;
      ctx.beginPath();
      ctx.moveTo(cx - 8, -pad.width * 0.32);
      ctx.lineTo(cx + 8, 0);
      ctx.lineTo(cx - 8, pad.width * 0.32);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawRacerCar(ctx: CanvasRenderingContext2D, car: RacerState): void {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // 1. Headlight cones projected forward onto the wet asphalt
  ctx.fillStyle = car.isPlayer ? 'rgba(255, 232, 175, 0.16)' : 'rgba(215, 228, 255, 0.12)';
  ctx.beginPath();
  ctx.moveTo(16, -7);
  ctx.lineTo(145, -34);
  ctx.lineTo(145, 34);
  ctx.lineTo(16, 7);
  ctx.closePath();
  ctx.fill();

  // 2. Soft ground drop shadow
  ctx.fillStyle = 'rgba(4, 6, 10, 0.55)';
  ctx.beginPath();
  ctx.roundRect(-22, -13, 46, 28, 7);
  ctx.fill();

  // 3. Tires (front pair turns visually with steerAngle)
  ctx.fillStyle = '#0D1016';
  ctx.fillRect(-16, -13.5, 10, 4);
  ctx.fillRect(-16, 9.5, 10, 4);
  for (const wy of [-11.5, 11.5]) {
    ctx.save();
    ctx.translate(12, wy);
    ctx.rotate(car.steerAngle * 0.55);
    ctx.fillRect(-5, -2, 10, 4);
    ctx.restore();
  }

  // 4. Sculpted GT Coupe Body
  ctx.fillStyle = car.hitFlash > 0.2 ? '#FFF4D8' : car.primaryColor;
  ctx.beginPath();
  ctx.roundRect(-21, -11.5, 43, 23, 6.5);
  ctx.fill();

  // Dark metallic cabin contour
  ctx.fillStyle = 'rgba(10, 13, 19, 0.34)';
  ctx.beginPath();
  ctx.roundRect(-14, -9, 31, 18, 4.5);
  ctx.fill();

  // Center racing stripe
  ctx.fillStyle = car.accentColor;
  ctx.fillRect(-20, -2, 41, 4);

  // Tinted windshield & rear glass
  ctx.fillStyle = '#111722';
  ctx.beginPath();
  ctx.roundRect(-8, -8, 17, 16, 3.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(180, 205, 240, 0.22)';
  ctx.fillRect(3, -6.5, 4.5, 13);

  // Rear carbon GT wing
  ctx.fillStyle = '#151923';
  ctx.fillRect(-22, -12, 4.5, 24);

  // Car outline sheen
  ctx.strokeStyle = car.isPlayer ? 'rgba(255, 242, 204, 0.72)' : 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-21, -11.5, 43, 23, 6.5);
  ctx.stroke();

  // Headlight bulbs
  ctx.fillStyle = '#FFF5D6';
  ctx.fillRect(19.5, -9, 2.5, 4);
  ctx.fillRect(19.5, 5, 2.5, 4);

  // Crimson tail / brake lights
  const brakeGlow = car.braking || car.drifting;
  ctx.fillStyle = brakeGlow ? '#FF4646' : '#A62828';
  ctx.fillRect(-22, -9, 2.2, 4.5);
  ctx.fillRect(-22, 4.5, 2.2, 4.5);
  if (brakeGlow) {
    ctx.fillStyle = 'rgba(255, 68, 68, 0.35)';
    ctx.beginPath();
    ctx.arc(-22, -6.5, 7, 0, Math.PI * 2);
    ctx.arc(-22, 6.5, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Twin nitro flame cones
  if (car.boosting) {
    const flicker = 14 + Math.random() * 14;
    ctx.fillStyle = '#F5B544';
    ctx.beginPath();
    ctx.moveTo(-22, -5.5);
    ctx.lineTo(-22 - flicker, -3.5);
    ctx.lineTo(-22, -1.5);
    ctx.moveTo(-22, 1.5);
    ctx.lineTo(-22 - flicker, 3.5);
    ctx.lineTo(-22, 5.5);
    ctx.fill();
  }

  ctx.restore();

  // Subtle driver number label above opponent cars
  if (!car.isPlayer) {
    ctx.save();
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(12, 14, 18, 0.78)';
    ctx.fillRect(car.x - 14, car.y - 29, 28, 13);
    ctx.fillStyle = '#E6E0D3';
    ctx.fillText(`#${car.number}`, car.x, car.y - 19.5);
    ctx.restore();
  }
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  world: RaceWorldState,
  viewW: number,
  viewH: number
): void {
  const { track, racers } = world;
  const mapW = viewW < 640 ? 120 : 164;
  const mapH = viewW < 640 ? 86 : 114;
  const pad = viewW < 640 ? 12 : 20;
  const x0 = pad;
  const y0 = viewH - mapH - (viewW < 640 ? 104 : pad);

  ctx.save();
  ctx.fillStyle = 'rgba(12, 15, 21, 0.88)';
  ctx.strokeStyle = 'rgba(54, 65, 86, 0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x0, y0, mapW, mapH, 6);
  ctx.fill();
  ctx.stroke();

  const { minX, maxX, minY, maxY } = track.bounds;
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((mapW - 22) / spanX, (mapH - 22) / spanY);
  const offsetX = x0 + (mapW - spanX * scale) * 0.5;
  const offsetY = y0 + (mapH - spanY * scale) * 0.5;

  const toMapX = (wx: number) => offsetX + (wx - minX) * scale;
  const toMapY = (wy: number) => offsetY + (wy - minY) * scale;

  ctx.beginPath();
  for (let i = 0; i < track.samples.length; i += 3) {
    const s = track.samples[i];
    const mx = toMapX(s.x);
    const my = toMapY(s.y);
    if (i === 0) ctx.moveTo(mx, my);
    else ctx.lineTo(mx, my);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.lineWidth = 4;
  ctx.stroke();

  const s0 = track.samples[0];
  ctx.fillStyle = '#F2ECDC';
  ctx.fillRect(toMapX(s0.x) - 2, toMapY(s0.y) - 2, 4, 4);

  const ordered = [...racers].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer));
  for (const r of ordered) {
    ctx.beginPath();
    ctx.arc(toMapX(r.x), toMapY(r.y), r.isPlayer ? 4.2 : 3.1, 0, Math.PI * 2);
    ctx.fillStyle = r.isPlayer ? '#F5C45E' : r.primaryColor;
    ctx.fill();
    if (r.isPlayer) {
      ctx.strokeStyle = '#0C0E12';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function renderRaceFrame(
  ctx: CanvasRenderingContext2D,
  world: RaceWorldState,
  viewW: number,
  viewH: number,
  cameraMode: CameraMode = 'chase'
): void {
  if (cameraMode !== 'topdown') {
    renderFrontViewFrame(ctx, world, viewW, viewH, cameraMode);
    drawMinimap(ctx, world, viewW, viewH);
    return;
  }

  // Classic Top-Down Camera Mode
  // 1. Deep nocturnal slate-obsidian ground fill
  ctx.fillStyle = '#0B0E14';
  ctx.fillRect(0, 0, viewW, viewH);

  // 2. Chase camera transform with trauma-squared shake
  const trauma = world.camera.shakeTrauma;
  const shakeMag = trauma * trauma * 12;
  const shakeX = shakeMag > 0.1 ? (Math.random() - 0.5) * 2 * shakeMag : 0;
  const shakeY = shakeMag > 0.1 ? (Math.random() - 0.5) * 2 * shakeMag : 0;

  const viewportScale = viewW < 640 ? 0.66 : viewW < 1024 ? 0.84 : 1.0;
  const zoom = world.camera.zoom * viewportScale;

  ctx.save();
  ctx.translate(viewW * 0.5 + shakeX, viewH * 0.5 + shakeY);
  ctx.scale(zoom, zoom);
  ctx.translate(-world.camera.x, -world.camera.y);

  // 3. Single fast blit of pre-rendered circuit layer
  const cache = getOrBuildTrackCache(world.track);
  if (cache) {
    ctx.drawImage(cache.canvas, cache.originX, cache.originY);
  }

  // 4. Dynamic pulsing nitro boost pads
  drawDynamicBoostPads(ctx, world.track, world.elapsedMs);

  // 5. Batched tire skid marks
  ctx.strokeStyle = 'rgba(8, 10, 14, 0.34)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < world.skids.length; i++) {
    const s = world.skids[i];
    if (!s.active) continue;
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();

  // 6. Pooled drift / boost / spark particles
  for (let i = 0; i < world.particles.length; i++) {
    const p = world.particles[i];
    if (!p.active) continue;
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * alpha), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 7. All 4 racing cars
  for (const car of world.racers) {
    drawRacerCar(ctx, car);
  }

  ctx.restore();

  // 8. Subtle atmospheric noir rain streaks
  const t = world.elapsedMs * 0.06;
  ctx.strokeStyle = 'rgba(175, 195, 224, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 36; i++) {
    const rx = ((i * 197 + t * 1.4) % (viewW + 120)) - 60;
    const ry = ((i * 131 + t * 5.2) % (viewH + 120)) - 60;
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 5, ry + 16);
  }
  ctx.stroke();

  // 9. Live real-geometry circuit minimap
  drawMinimap(ctx, world, viewW, viewH);
}
