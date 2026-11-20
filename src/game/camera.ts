import type { EmotionalState, WorkspaceTab } from './types';

export interface CameraTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface LocationTransitionPreset {
  enterY: number;
  exitY: number;
  enterScale: number;
  exitScale: number;
  directionLabel: string;
}

export interface NarrativeBeat {
  id: string;
  kind: 'location' | 'clue' | 'contradiction' | 'interrogation' | 'verdict';
  kicker: string;
  headline: string;
  durationMs: number;
  letterbox: boolean;
  vignetteStrength: 'normal' | 'tight' | 'crimson';
}

const FLOOR_ORDER: Record<string, number> = {
  'penthouse-study': 42,
  'security-room': -1,
  'underground-garage': -2,
};

/**
 * Strictly clamps camera pan so the zoomed scene image never exposes empty letterbox margins.
 */
export function clampCameraPan(
  x: number,
  y: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number } {
  if (zoom <= 1 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { x: 0, y: 0 };
  }
  const maxX = ((zoom - 1) * viewportWidth) / 2;
  const maxY = ((zoom - 1) * viewportHeight) / 2;
  const clampedX = Math.round(Math.max(-maxX, Math.min(maxX, x)));
  const clampedY = Math.round(Math.max(-maxY, Math.min(maxY, y)));
  return {
    x: clampedX === 0 ? 0 : clampedX,
    y: clampedY === 0 ? 0 : clampedY,
  };
}

/**
 * Computes a smooth, edge-safe dolly & zoom transform that brings a percentage-positioned
 * crime scene hotspot toward the visual center of the viewport.
 */
export function computeHotspotFocusTransform(
  hotspotXPercent: number,
  hotspotYPercent: number,
  viewportWidth: number,
  viewportHeight: number,
  targetZoom = 1.72
): CameraTransform {
  const safeZoom = Math.max(1, Math.min(2.2, Number(targetZoom.toFixed(2))));
  if (safeZoom <= 1 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  // Offset of hotspot from center in normalized [-0.5, 0.5] coordinates
  const normDx = hotspotXPercent / 100 - 0.5;
  const normDy = hotspotYPercent / 100 - 0.5;

  // Desired screen-space translation after scaling around center
  const desiredX = -normDx * viewportWidth * safeZoom;
  const desiredY = -normDy * viewportHeight * safeZoom;

  const clamped = clampCameraPan(desiredX, desiredY, safeZoom, viewportWidth, viewportHeight);
  return {
    x: clamped.x,
    y: clamped.y,
    zoom: safeZoom,
  };
}

/**
 * Computes directional elevator/floor camera motion when transitioning between crime scenes.
 */
export function getLocationTransitionPreset(
  fromLocationId: string | null,
  toLocationId: string
): LocationTransitionPreset {
  const fromFloor = fromLocationId ? (FLOOR_ORDER[fromLocationId] ?? 0) : 42;
  const toFloor = FLOOR_ORDER[toLocationId] ?? 0;

  if (!fromLocationId || fromLocationId === toLocationId) {
    return {
      enterY: 0,
      exitY: 0,
      enterScale: 1.06,
      exitScale: 0.98,
      directionLabel: 'ESTABLISHING SHOT',
    };
  }

  // Descending (e.g., 42F -> B1 -> B2): camera drifts down into the darker lower level
  if (toFloor < fromFloor) {
    return {
      enterY: 26,
      exitY: -20,
      enterScale: 1.07,
      exitScale: 0.96,
      directionLabel: 'DESCENDING LIFT',
    };
  }

  // Ascending (e.g., B2 -> B1 -> 42F): camera rises smoothly
  return {
    enterY: -26,
    exitY: 20,
    enterScale: 1.07,
    exitScale: 0.96,
    directionLabel: 'ASCENDING LIFT',
  };
}

/**
 * Maps suspect emotional pressure to subtle film-noir portrait lens framing.
 */
export function getSuspectPortraitCamera(
  emotion: EmotionalState,
  justContradicted: boolean
): { scale: number; y: number; contrast: number; vignetteOpacity: number } {
  if (justContradicted) {
    return { scale: 1.13, y: -4, contrast: 1.12, vignetteOpacity: 0.88 };
  }
  switch (emotion) {
    case 'rattled':
      return { scale: 1.11, y: -3, contrast: 1.09, vignetteOpacity: 0.84 };
    case 'defensive':
      return { scale: 1.06, y: -2, contrast: 1.05, vignetteOpacity: 0.72 };
    case 'guarded':
      return { scale: 1.03, y: -1, contrast: 1.02, vignetteOpacity: 0.62 };
    case 'cooperative':
      return { scale: 1.02, y: 0, contrast: 1.0, vignetteOpacity: 0.55 };
    case 'composed':
    default:
      return { scale: 1.0, y: 0, contrast: 1.0, vignetteOpacity: 0.58 };
  }
}

/**
 * Provides distinct noir camera choreography when switching between major workspace views.
 */
export function getWorkspaceCameraVariants(tab: WorkspaceTab): {
  initial: { opacity: number; scale: number; y: number };
  animate: { opacity: number; scale: number; y: number };
  exit: { opacity: number; scale: number; y: number };
} {
  switch (tab) {
    case 'interrogation':
      // Tight dolly-in into the interrogation chamber
      return {
        initial: { opacity: 0, scale: 1.04, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.985, y: -6 },
      };
    case 'board':
      // Pull back slightly to survey the detective evidence pinboard
      return {
        initial: { opacity: 0, scale: 0.97, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 1.02, y: -6 },
      };
    case 'notebook':
      // Clean editorial dossier slide
      return {
        initial: { opacity: 0, scale: 0.99, y: 12 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.99, y: -8 },
      };
    case 'scenes':
    default:
      // Establishing crime scene depth reveal
      return {
        initial: { opacity: 0, scale: 1.03, y: 0 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: 0 },
      };
  }
}
