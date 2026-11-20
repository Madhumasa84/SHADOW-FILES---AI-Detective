import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  Eye,
  Focus,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  clampCameraPan,
  computeHotspotFocusTransform,
  getLocationTransitionPreset,
} from '../game/camera';
import type { CaseFile, Clue, CrimeLocation, SceneHotspot } from '../game/types';
import { noirAudio } from '../utils/audio';
import { NoirImage } from './NoirImage';
import { RainCanvas } from './RainCanvas';

interface CrimeSceneViewProps {
  caseFile: CaseFile;
  activeLocationId: string;
  discoveredClueIds: string[];
  onSelectLocation: (locationId: string) => void;
  onCollectClue: (clueId: string) => void;
  onOpenOnBoard: () => void;
}

export function CrimeSceneView({
  caseFile,
  activeLocationId,
  discoveredClueIds,
  onSelectLocation,
  onCollectClue,
  onOpenOnBoard,
}: CrimeSceneViewProps) {
  const activeLocation: CrimeLocation =
    caseFile.locations.find((l) => l.id === activeLocationId) ?? caseFile.locations[0];

  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [highlightAll, setHighlightAll] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [collectionFlash, setCollectionFlash] = useState(false);

  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const stageSizeRef = useRef<{ width: number; height: number }>({ width: 960, height: 540 });
  const prevLocationIdRef = useRef<string | null>(null);
  const panOriginRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number } | null>(
    null
  );

  const transitionPreset = getLocationTransitionPreset(prevLocationIdRef.current, activeLocation.id);

  // Preload all crime scene artworks so directional floor transitions never flash blank
  useEffect(() => {
    for (const loc of caseFile.locations) {
      const img = new Image();
      img.src = loc.imageUrl;
    }
  }, [caseFile.locations]);

  // Track live stage dimensions for exact edge-safe camera clamping
  useEffect(() => {
    if (!stageEl) return;
    const measure = () => {
      const rect = stageEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        stageSizeRef.current = { width: rect.width, height: rect.height };
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stageEl);
    return () => ro.disconnect();
  }, [stageEl]);

  // Reset camera framing smoothly when switching rooms
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedHotspotId(null);
    return () => {
      prevLocationIdRef.current = activeLocationId;
    };
  }, [activeLocationId]);

  const handleResetView = useCallback(() => {
    if (zoom > 1.01) {
      noirAudio.playCameraZoom(false);
    }
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [zoom]);

  // Keyboard shortcuts: [H] toggles Evidence Highlight, [0] pulls camera back
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'h' || e.key === 'H') {
        setHighlightAll((prev) => !prev);
      } else if (e.key === '0') {
        handleResetView();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleResetView]);

  const focusOnHotspot = useCallback((hs: SceneHotspot) => {
    setSelectedHotspotId(hs.id);
    const { width, height } = stageSizeRef.current;
    const target = computeHotspotFocusTransform(hs.x, hs.y, width, height, 1.72);
    setZoom(target.zoom);
    setPan({ x: target.x, y: target.y });
    noirAudio.playCameraZoom(true);
  }, []);

  const selectedHotspot: SceneHotspot | null =
    activeLocation.hotspots.find((h) => h.id === selectedHotspotId) ?? null;
  const selectedClue: Clue | null = selectedHotspot
    ? caseFile.clues.find((c) => c.id === selectedHotspot.clueId) ?? null
    : null;
  const isSelectedCollected = selectedClue ? discoveredClueIds.includes(selectedClue.id) : false;

  const handleZoomChange = (delta: number) => {
    setZoom((prev) => {
      const next = Math.max(1, Math.min(2.2, Number((prev + delta).toFixed(2))));
      const { width, height } = stageSizeRef.current;
      setPan((p) => clampCameraPan(p.x, p.y, next, width, height));
      if (next !== prev) {
        noirAudio.playCameraZoom(next > prev);
      }
      return next;
    });
  };

  const handleCollectWithBeat = (clueId: string) => {
    onCollectClue(clueId);
    setCollectionFlash(true);
    window.setTimeout(() => setCollectionFlash(false), 420);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    if ((e.target as HTMLElement).closest('button')) return;
    setIsPanning(true);
    panOriginRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || !panOriginRef.current) return;
    const dx = e.clientX - panOriginRef.current.x;
    const dy = e.clientY - panOriginRef.current.y;
    const { width, height } = stageSizeRef.current;
    setPan(
      clampCameraPan(
        panOriginRef.current.startPanX + dx,
        panOriginRef.current.startPanY + dy,
        zoom,
        width,
        height
      )
    );
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    panOriginRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) < 4) return;
    handleZoomChange(e.deltaY < 0 ? 0.2 : -0.2);
  };

  const collectedClues = caseFile.clues.filter((c) => discoveredClueIds.includes(c.id));
  const isZoomed = zoom > 1.05;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0C0E12] overflow-y-auto lg:overflow-hidden">
      {/* Top Location Selector & Scene Controls Bar */}
      <div className="shrink-0 border-b border-[#202633] bg-[#12161E] px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2.5 overflow-x-auto">
          {/* 3 Explorable Crime Scene Tabs */}
          <div
            className="flex items-center gap-1.5 sm:gap-2 shrink-0"
            role="tablist"
            aria-label="Crime scene locations"
          >
            {caseFile.locations.map((loc) => {
              const foundHere = loc.hotspots.filter((h) =>
                discoveredClueIds.includes(h.clueId)
              ).length;
              const isCurrent = loc.id === activeLocation.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  onClick={() => onSelectLocation(loc.id)}
                  className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-md border px-2.5 py-1.5 sm:px-3 text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isCurrent
                      ? 'border-[#D99B38] bg-[#1F242F] text-[#F4EFE4] font-semibold'
                      : 'border-[#252D3B] bg-[#141821] text-[#A4AEBE] hover:border-[#39455A] hover:text-[#ECE6D8]'
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5 text-[#D99B38]" aria-hidden="true" />
                  <span>{loc.name}</span>
                  <span className="font-mono-tabular text-[11px] text-[#98A2B3]">
                    {foundHere}/{loc.hotspots.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Zoom + Evidence Highlight Tools */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setHighlightAll((v) => !v)}
              aria-pressed={highlightAll}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 sm:px-3 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                highlightAll
                  ? 'border-[#D99B38]/80 bg-[#D99B38]/15 text-[#F0C472]'
                  : 'border-[#28303F] bg-[#161B24] text-[#98A2B3] hover:text-[#ECE6D8]'
              }`}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Highlight Clues [H]</span>
              <span className="sm:hidden">Clues</span>
            </button>

            <div className="flex items-center rounded-md border border-[#28303F] bg-[#151922]">
              <button
                type="button"
                onClick={() => handleZoomChange(-0.25)}
                disabled={zoom <= 1}
                aria-label="Zoom out scene"
                className="px-2 py-1.5 sm:px-2.5 text-[#C5CCD8] hover:text-[#F2ECDC] disabled:opacity-40 cursor-pointer"
              >
                <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span className="px-1.5 font-mono-tabular text-xs text-[#A9B3C4]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => handleZoomChange(0.25)}
                disabled={zoom >= 2.2}
                aria-label="Zoom in scene"
                className="px-2 py-1.5 sm:px-2.5 text-[#C5CCD8] hover:text-[#F2ECDC] disabled:opacity-40 cursor-pointer"
              >
                <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              {isZoomed && (
                <button
                  type="button"
                  onClick={handleResetView}
                  aria-label="Reset scene zoom"
                  title="Pull Camera Back [0]"
                  className="border-l border-[#28303F] px-2 py-1.5 text-[#EBB556] hover:text-[#FFF2D2] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Interactive Scene Viewport + Inspection Side Panel */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col lg:flex-row">
        {/* Interactive 2.5D Crime Scene Canvas/Viewport */}
        <div className="relative flex min-h-[240px] sm:min-h-[340px] flex-1 flex-col overflow-hidden bg-[#090B0E]">
          <div
            data-testid="crime-scene-viewport"
            data-camera-zoom={zoom.toFixed(2)}
            data-focused-hotspot={selectedHotspotId ?? ''}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            className={`relative flex-1 overflow-hidden select-none ${
              isZoomed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
          >
            {/* Directional Crime Scene Camera Cut (42F / B1 / B2) — seamless overlapping cross-dissolve */}
            <AnimatePresence initial={false}>
              <motion.div
                key={activeLocation.id}
                initial={{
                  opacity: 0,
                  scale: transitionPreset.enterScale,
                  y: transitionPreset.enterY,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  scale: transitionPreset.exitScale,
                  y: transitionPreset.exitY,
                  pointerEvents: 'none',
                }}
                transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {/* Live Camera Dolly & Zoom Rig (instant while manually dragging, cinematic curve on focus) */}
                <div
                  ref={setStageEl}
                  className={`relative aspect-video w-full max-h-full overflow-hidden will-change-transform ${
                    isPanning
                      ? 'transition-none'
                      : 'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]'
                  }`}
                  style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                >
                  <NoirImage
                    src={activeLocation.imageUrl}
                    alt={`${activeLocation.name} crime scene`}
                    className="h-full w-full object-cover"
                  />

                  {/* Subtle atmospheric storm rain in penthouse & garage */}
                  {activeLocation.id !== 'security-room' && (
                    <div className="pointer-events-none absolute inset-0 opacity-45">
                      <RainCanvas intensity="subtle" />
                    </div>
                  )}

                  {/* Subtle bottom dark gradient so room title stays crisp */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#090B0F]/80 to-transparent"
                  />

                  {/* Interactive Clickable Hotspots */}
                  {activeLocation.hotspots.map((hs, idx) => {
                    const collected = discoveredClueIds.includes(hs.clueId);
                    const isSelected = selectedHotspotId === hs.id;
                    return (
                      <button
                        key={hs.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          focusOnHotspot(hs);
                        }}
                        aria-label={`Inspect ${hs.label}${collected ? ' (Collected)' : ''}`}
                        style={{
                          left: `${hs.x}%`,
                          top: `${hs.y}%`,
                        }}
                        className="group absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center h-11 w-11 rounded-full focus-visible:outline-none cursor-pointer"
                      >
                        {/* Outer glowing forensic ring */}
                        {(highlightAll || isSelected) && !collected && (
                          <span
                            aria-hidden="true"
                            className="animate-hotspot-ring absolute inset-1 rounded-full border border-[#EBB556]/80"
                          />
                        )}

                        {/* Inner target pin */}
                        <span
                          className={`relative flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-mono-tabular font-semibold shadow-lg transition-transform duration-150 group-hover:scale-110 ${
                            isSelected
                              ? 'border-[#FFF4DA] bg-[#EBB556] text-[#0C0E12] scale-110'
                              : collected
                              ? 'border-[#4D9A76] bg-[#12261E]/95 text-[#7FD4AA]'
                              : highlightAll
                              ? 'border-[#EBB556] bg-[#14171F]/90 text-[#F2CA7B]'
                              : 'border-[#505B70] bg-[#12161E]/75 text-[#B4BECE] opacity-75 group-hover:opacity-100'
                          }`}
                        >
                          {collected ? (
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            idx + 1
                          )}
                        </span>

                        {/* Hover / Selected Label */}
                        <span
                          className={`pointer-events-none absolute top-full mt-1 rounded bg-[#0E1117]/95 px-2 py-0.5 text-[11px] font-medium text-[#F2ECDC] border border-[#2C3445] shadow-md whitespace-nowrap transition-opacity duration-150 ${
                            isSelected
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                          }`}
                        >
                          {hs.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Dynamic Chiaroscuro Focus Vignette (tightens smoothly when camera dollies in on a clue) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 transition-opacity duration-500"
              style={{
                opacity: isZoomed ? 1 : 0.45,
                background: isZoomed
                  ? 'radial-gradient(circle at center, transparent 42%, rgba(8, 10, 14, 0.72) 100%)'
                  : 'radial-gradient(circle at center, transparent 62%, rgba(8, 10, 14, 0.45) 100%)',
              }}
            />

            {/* Brief Amber Forensic Shutter Flash on Clue Capture */}
            <AnimatePresence>
              {collectionFlash && (
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0.45 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(circle at center, rgba(235, 181, 86, 0.24) 0%, transparent 72%)',
                  }}
                />
              )}
            </AnimatePresence>

            {/* Unobtrusive Scene Caption Strip (desktop/tablet only so mobile hotspots stay 100% clear) */}
            <div className="pointer-events-none hidden sm:flex absolute bottom-3 left-3 right-3 flex-wrap items-end justify-between gap-2">
              <div className="max-w-lg rounded-md bg-[#0E1117]/90 border border-[#262E3D] px-3.5 py-2">
                <p className="font-mono-tabular text-[11px] text-[#D99B38]">
                  {activeLocation.floorLabel}
                </p>
                <p className="mt-0.5 text-xs text-[#D3CDC0] leading-snug">
                  {activeLocation.atmosphereNote}
                </p>
              </div>
              {isZoomed && (
                <div className="pointer-events-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetView}
                    className="inline-flex items-center gap-1.5 rounded bg-[#0E1117]/95 border border-[#D99B38]/60 px-3 py-1.5 font-mono-tabular text-[11px] text-[#F0C472] hover:bg-[#191E29] cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    <span>Pull Back [0]</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Evidence Inventory Strip */}
          <div className="shrink-0 border-t border-[#222836] bg-[#11151D] px-4 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-[#DCD6C8]">
                Evidence Inventory
              </span>
              <span className="font-mono-tabular text-xs text-[#98A2B3]">
                {collectedClues.length} of {caseFile.clues.length} collected
              </span>
            </div>
            {collectedClues.length === 0 ? (
              <p className="text-xs text-[#8D97A8]">
                Click numbered markers in the scene to inspect objects and log evidence into your
                case file.
              </p>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {collectedClues.map((clue) => {
                  const hs = activeLocation.hotspots.find((h) => h.clueId === clue.id);
                  const active = selectedClue?.id === clue.id;
                  return (
                    <button
                      key={clue.id}
                      type="button"
                      onClick={() => {
                        if (clue.locationId !== activeLocation.id) {
                          onSelectLocation(clue.locationId);
                        } else if (hs) {
                          setSelectedHotspotId(hs.id);
                        }
                      }}
                      className={`inline-flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'border-[#D99B38] bg-[#212734] text-[#F5EFE2]'
                          : 'border-[#273040] bg-[#171C26] text-[#C8C2B5] hover:border-[#414F68]'
                      }`}
                    >
                      <span className="font-mono-tabular text-[11px] text-[#D99B38]">
                        {clue.code}
                      </span>
                      <span>{clue.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Inspection Panel */}
        <aside
          aria-label="Object inspection panel"
          className="w-full lg:w-[360px] xl:w-[390px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#222836] bg-[#12161E] flex flex-col min-h-0"
        >
          <div className="flex-1 overflow-y-auto p-5">
            <AnimatePresence mode="wait">
              {selectedHotspot && selectedClue ? (
                <motion.div
                  key={selectedHotspot.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular text-[#98A2B3]">
                    <span className="text-[#D99B38]">{selectedClue.code}</span>
                    <span>
                      {selectedClue.category.charAt(0).toUpperCase() +
                        selectedClue.category.slice(1)}
                      {selectedClue.timestamp ? ` · ${selectedClue.timestamp}` : ''}
                    </span>
                  </div>

                  <div>
                    <h2 className="font-display text-xl font-semibold text-[#F4EFE4]">
                      {selectedHotspot.label}
                    </h2>
                    <p className="mt-1.5 text-sm text-[#B8C0CF] leading-relaxed">
                      {selectedHotspot.inspectSummary}
                    </p>
                  </div>

                  <div className="rounded-md border border-[#283142] bg-[#171C26] p-4 space-y-2.5">
                    <div className="text-xs font-semibold text-[#D99B38]">
                      Forensic Examination
                    </div>
                    <p className="text-sm text-[#EAE4D7] leading-relaxed">
                      {selectedHotspot.detailedExamination}
                    </p>
                  </div>

                  {isSelectedCollected ? (
                    <div className="space-y-3">
                      <div className="rounded-md border border-[#4D9A76]/45 bg-[#12241C] p-3.5 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#7AD2A7]">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          <span>Logged as {selectedClue.title}</span>
                        </div>
                        <p className="text-xs text-[#C6DFD1] leading-relaxed">
                          {selectedClue.forensicNote}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={onOpenOnBoard}
                        className="w-full rounded-md border border-[#343F54] bg-[#19202D] px-4 py-2.5 text-xs font-medium text-[#ECE6D8] hover:border-[#D99B38]/60 hover:bg-[#202838] transition-colors cursor-pointer"
                      >
                        Examine on Evidence Board
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCollectWithBeat(selectedClue.id)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#D99B38] px-4 py-3 text-sm font-semibold text-[#0C0E12] shadow transition-colors hover:bg-[#EBB556] cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      <span>Collect Evidence ({selectedClue.code})</span>
                    </button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty-inspect"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-5"
                >
                  <div className="flex items-center gap-2 text-xs font-mono-tabular text-[#D99B38]">
                    <Search className="h-4 w-4" aria-hidden="true" />
                    <span>SCENE BRIEFING</span>
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-semibold text-[#F4EFE4]">
                      {activeLocation.name}
                    </h2>
                    <p className="mt-2 text-sm text-[#B8C0CF] leading-relaxed">
                      {activeLocation.shortDescription}
                    </p>
                  </div>

                  <div className="border-t border-[#232A38] pt-4 space-y-2.5">
                    <h3 className="text-xs font-semibold text-[#D6D0C2]">
                      Points of Interest in This Room
                    </h3>
                    <div className="space-y-2">
                      {activeLocation.hotspots.map((hs, idx) => {
                        const done = discoveredClueIds.includes(hs.clueId);
                        return (
                          <button
                            key={hs.id}
                            type="button"
                            onClick={() => setSelectedHotspotId(hs.id)}
                            className="flex w-full items-center justify-between gap-2 rounded-md border border-[#252D3B] bg-[#161B24] px-3 py-2.5 text-left text-xs transition-colors hover:border-[#D99B38]/60 hover:bg-[#1C222E] cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono-tabular text-[#D99B38]">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <span className="truncate text-[#EAE4D7] font-medium">
                                {hs.label}
                              </span>
                            </span>
                            <span
                              className={`font-mono-tabular text-[11px] shrink-0 ${
                                done ? 'text-[#6CC89B]' : 'text-[#8C96A8]'
                              }`}
                            >
                              {done ? 'Collected' : 'Inspect'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>
    </div>
  );
}
