import { useState, type ReactNode } from 'react';
import {
  Anchor,
  Bomb,
  Car,
  CircleDot,
  Compass,
  Crown,
  Disc,
  Grid2x2,
  Grid3x3,
  KeyRound,
  Layers,
  Search,
  Spade,
  Sparkles,
  Swords,
  Table2,
  Zap,
} from 'lucide-react';
import type { ExtraGameId, ExtraGamesRecordsMap } from '../arcade/records';
import type { BlackjackRecords } from '../blackjack/engine';
import type { ChessRecords } from '../chess/types';
import { formatRaceTime, type RacingRecords } from '../racing/engine';
import type { SnakeRecords } from '../snake/engine';
import type { TetrisRecords } from '../tetris/engine';
import type { Records2048 } from '../tiles2048/engine';
import { NoirImage } from './NoirImage';
import { RainCanvas } from './RainCanvas';

export type LaunchableGameId =
  | 'detective'
  | 'racing'
  | 'chess'
  | '2048'
  | 'snake'
  | 'tetris'
  | 'blackjack'
  | ExtraGameId;

type CategoryFilter = 'all' | 'strategy' | 'puzzles' | 'arcade';

interface GameLauncherProps {
  backdrops: Record<LaunchableGameId, string>;
  hasSavedCase: boolean;
  savedClueCount: number;
  totalClues: number;
  racingRecords: RacingRecords;
  chessRecords: ChessRecords;
  records2048: Records2048;
  snakeRecords: SnakeRecords;
  tetrisRecords: TetrisRecords;
  blackjackRecords: BlackjackRecords;
  extraRecords: ExtraGamesRecordsMap;
  onSelectGame: (game: LaunchableGameId) => void;
}

interface GameCardDescriptor {
  id: LaunchableGameId;
  category: Exclude<CategoryFilter, 'all'>;
  title: string;
  meta: string;
  description: string;
  statLine: string;
  ctaLabel: string;
  imageAlt: string;
  icon: ReactNode;
}

export function GameLauncher({
  backdrops,
  hasSavedCase,
  savedClueCount,
  totalClues,
  racingRecords,
  chessRecords,
  records2048,
  snakeRecords,
  tetrisRecords,
  blackjackRecords,
  extraRecords,
  onSelectGame,
}: GameLauncherProps) {
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const bestObsidian = racingRecords.bestLapByCircuit['obsidian-ring'];
  const bestHarbor = racingRecords.bestLapByCircuit['harbor-chicane'];
  const fastestBestLap =
    bestObsidian !== undefined && bestHarbor !== undefined
      ? Math.min(bestObsidian, bestHarbor)
      : bestObsidian ?? bestHarbor;

  const best2048 = Math.max(records2048.bestScore4, records2048.bestScore5);

  const games: GameCardDescriptor[] = [
    {
      id: 'detective',
      category: 'puzzles',
      title: 'SHADOW FILES',
      meta: 'Detective Mystery · 3 Scenes · 4 Suspects',
      description:
        'Investigate the Midnight Disappearance across Obsidian Tower. Examine physical evidence, question suspects, link contradictions, and deliver your final verdict.',
      statLine: hasSavedCase
        ? `Saved Case · ${savedClueCount}/${totalClues} Clues Logged`
        : 'Case 01 Ready · 16 Clues',
      ctaLabel: 'Play Shadow Files',
      imageAlt: 'Rain-soaked midnight skyline seen from the Obsidian Tower penthouse window',
      icon: <Search className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'racing',
      category: 'arcade',
      title: 'NIGHT CIRCUIT',
      meta: '3D Front-View Racing · 2 Tracks · 3 Rivals',
      description:
        'Race in 3D forward chase or driver hood view against three rivals over three rain-soaked laps. Drift corners to charge nitro and chase the checkered flag.',
      statLine:
        fastestBestLap !== undefined
          ? `Best Lap ${formatRaceTime(fastestBestLap)} · ${racingRecords.winsCount} Wins`
          : 'Front Chase · Hood Cam · Top-Down',
      ctaLabel: 'Play Night Circuit',
      imageAlt: 'Grand touring cars drifting around a rain-slicked midnight racing circuit',
      icon: <Car className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'chess',
      category: 'strategy',
      title: 'MIDNIGHT GAMBIT',
      meta: 'Automated Chess · Custom Elo 500–3000',
      description:
        'Choose any automated opponent rating from 500 Novice to 3000 Apex Engine. Play full FIDE chess with live evaluation, algebraic notation, hints, and undo.',
      statLine:
        chessRecords.highestEloBeaten !== null
          ? `Best Win ${chessRecords.highestEloBeaten} Elo · ${chessRecords.wins}W-${chessRecords.draws}D-${chessRecords.losses}L`
          : 'Choose Any Rating · 500 to 3000 Elo',
      ctaLabel: 'Play Midnight Gambit',
      imageAlt: 'Obsidian and brushed brass Staunton chess set illuminated by a warm lamp',
      icon: <Crown className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'connect4',
      category: 'strategy',
      title: 'OBSIDIAN FOUR',
      meta: 'Connect Four · Depth-6 Alpha-Beta AI',
      description:
        'Drop gleaming gold discs into a brushed brass 6×7 cabinet against a depth-6 Minimax engine with center-control heuristics, tactical hints, and undo.',
      statLine:
        extraRecords.connect4.wins + extraRecords.connect4.losses > 0
          ? `${extraRecords.connect4.wins}W – ${extraRecords.connect4.losses}L · Streak ${extraRecords.connect4.bestStreak}`
          : 'Street · Master · Grandmaster AI',
      ctaLabel: 'Play Obsidian Four',
      imageAlt: 'Brushed brass and obsidian Connect Four cabinet on a dark slate desk',
      icon: <CircleDot className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'reversi',
      category: 'strategy',
      title: 'ECLIPSE OTHELLO',
      meta: '8×8 Reversi · Mobility & Corner AI',
      description:
        'Outflank ivory discs on emerald velvet felt. Trade early territory for corner locks against an Alpha-Beta opponent tuned for mobility and endgame sweeps.',
      statLine:
        extraRecords.reversi.wins + extraRecords.reversi.losses > 0
          ? `${extraRecords.reversi.wins}W – ${extraRecords.reversi.losses}L · Peak ${extraRecords.reversi.bestScore} Discs`
          : 'Club · Tactician · Apex AI',
      ctaLabel: 'Play Eclipse Othello',
      imageAlt: 'Emerald felt Reversi table with glossy obsidian and ivory tokens',
      icon: <Disc className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'checkers',
      category: 'strategy',
      title: 'NOIR DRAUGHTS',
      meta: '8×8 Checkers · Mandatory Multi-Jumps',
      description:
        'Classic American Checkers on carved walnut and slate. Chain mandatory double- and triple-jumps, crown kings, and battle a depth-5 tactical AI.',
      statLine:
        extraRecords.checkers.wins + extraRecords.checkers.losses > 0
          ? `${extraRecords.checkers.wins}W – ${extraRecords.checkers.losses}L · Streak ${extraRecords.checkers.bestStreak}`
          : 'Forced Captures · King Promotion',
      ctaLabel: 'Play Noir Draughts',
      imageAlt: 'Carved walnut and slate checkers board with beveled brass and obsidian kings',
      icon: <Swords className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'battleship',
      category: 'strategy',
      title: 'IRON FLEET',
      meta: '10×10 Naval Tactics · Bayesian Density AI',
      description:
        'Command a five-ship midnight armada across dual sonar grids. Toggle the Bayesian Probability Heatmap to spot optimal firing lanes against Admiral-tier AI.',
      statLine:
        extraRecords.battleship.wins + extraRecords.battleship.losses > 0
          ? `${extraRecords.battleship.wins}W – ${extraRecords.battleship.losses}L · Best ${extraRecords.battleship.bestScore}% Acc`
          : 'Live Sonar Heatmap · 5 Warships',
      ctaLabel: 'Play Iron Fleet',
      imageAlt: 'Dark steel naval sonar command table with illuminated brass warships',
      icon: <Anchor className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'gomoku',
      category: 'strategy',
      title: 'FIVE IN A ROW',
      meta: '15×15 Gomoku · Threat-Space Pattern AI',
      description:
        'Lay obsidian stones across a lacquered mahogany Goban. Engineer double-threes and open-fours while countering a 2-ply threat-recognition AI.',
      statLine:
        extraRecords.gomoku.wins + extraRecords.gomoku.losses > 0
          ? `${extraRecords.gomoku.wins}W – ${extraRecords.gomoku.losses}L · Streak ${extraRecords.gomoku.bestStreak}`
          : '15×15 Goban · Threat-Space AI',
      ctaLabel: 'Play Five in a Row',
      imageAlt: 'Lacquered mahogany 15x15 Gomoku board with glossy obsidian and ivory stones',
      icon: <Compass className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'sudoku',
      category: 'puzzles',
      title: 'VAULT SUDOKU',
      meta: '9×9 Logic Grid · Unique-Solution Generator',
      description:
        'Crack uniquely solvable brass vault puzzles across three tiers, backed by pencil notes, conflict spotlighting, undo, and a Smart Logic Hint tutor.',
      statLine:
        extraRecords.sudoku.wins > 0
          ? `${extraRecords.sudoku.wins} Solved${extraRecords.sudoku.bestTimeSec ? ` · Best ${extraRecords.sudoku.bestTimeSec}s` : ''}`
          : 'Naked & Hidden Single Logic Tutor',
      ctaLabel: 'Play Vault Sudoku',
      imageAlt: 'Brushed brass and slate 9x9 Sudoku vault dial mechanism',
      icon: <Grid3x3 className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'minesweeper',
      category: 'puzzles',
      title: 'MINEFIELD NOIR',
      meta: 'Tactical Sweeper · CSP Logic Solver',
      description:
        'Clear riveted steel sectors with safe-first-click openings, instant chord-reveals, and a Constraint-Satisfaction Hint Engine that proves safe tiles and mines.',
      statLine:
        extraRecords.minesweeper.wins > 0
          ? `${extraRecords.minesweeper.wins} Cleared${extraRecords.minesweeper.bestTimeSec ? ` · Best ${extraRecords.minesweeper.bestTimeSec}s` : ''}`
          : '9×9 · 12×12 · 16×12 Sectors',
      ctaLabel: 'Play Minefield Noir',
      imageAlt: 'Tactical riveted steel minesweeper grid illuminated with amber markers',
      icon: <Bomb className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'cipher',
      category: 'puzzles',
      title: 'CIPHER VAULT',
      meta: '5-Letter Deduction · Shannon Entropy Hints',
      description:
        'Decrypt 5-letter syndicate passcodes in six attempts on mechanical split-flap tiles, assisted by an Information-Entropy Hint Engine ranking optimal probes.',
      statLine:
        extraRecords.cipher.wins > 0
          ? `${extraRecords.cipher.wins} Cracked · Best Streak ${extraRecords.cipher.bestStreak}`
          : '1,000+ Word Lexicon · Hard Mode',
      ctaLabel: 'Play Cipher Vault',
      imageAlt: 'Mechanical brass and obsidian split-flap cipher decoder panel',
      icon: <KeyRound className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'breakout',
      category: 'arcade',
      title: 'PRISM BREAKER',
      meta: '60 FPS Brick Breaker · 5 Stages · Power-Ups',
      description:
        'Shatter five art-deco stained-glass stages with responsive paddle deflection, multi-hit crystal prisms, Wide/Multi-Ball/Pierce/Slow capsules, and glow trails.',
      statLine:
        extraRecords.breakout.bestScore > 0
          ? `Best ${extraRecords.breakout.bestScore.toLocaleString()} · ${extraRecords.breakout.wins} Clears`
          : '5 Handcrafted Stages · 4 Power-Ups',
      ctaLabel: 'Play Prism Breaker',
      imageAlt: 'Art-deco stained glass prism bricks shattering under a golden energy sphere',
      icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'pong',
      category: 'arcade',
      title: 'VELVET PONG',
      meta: '60 FPS Spin Tennis · Predictive Intercept AI',
      description:
        'First to 7 on a midnight slate arena. Bend shots with paddle velocity spin against an AI that computes multi-bounce wall reflections in real time.',
      statLine:
        extraRecords.pong.wins + extraRecords.pong.losses > 0
          ? `${extraRecords.pong.wins}W – ${extraRecords.pong.losses}L · Best Rally ${extraRecords.pong.bestScore}`
          : 'Rookie · Pro · Apex Predictive AI',
      ctaLabel: 'Play Velvet Pong',
      imageAlt: 'Midnight slate tabletop arena with glowing brass and sapphire paddles',
      icon: <Table2 className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'tetris',
      category: 'arcade',
      title: 'STACKLINE NOIR',
      meta: 'Falling Blocks · 7-Bag · Hold & Ghost',
      description:
        'Clear four-row Tetrises with SRS wall kicks, piece hold, ghost landing previews, combo streaks, and escalating level speed.',
      statLine:
        tetrisRecords.bestScore > 0
          ? `Best ${tetrisRecords.bestScore.toLocaleString()} · ${tetrisRecords.bestLines} Lines`
          : 'Levels 1–15 · Classic 10×20 Well',
      ctaLabel: 'Play Stackline Noir',
      imageAlt: 'Faceted amber, sapphire, and crimson geometric glass blocks in an art-deco frame',
      icon: <Layers className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: '2048',
      category: 'puzzles',
      title: 'MIDNIGHT 2048',
      meta: 'Tile Merge Puzzle · 4×4 & 5×5 Boards',
      description:
        'Slide matching obsidian tiles to forge the golden 2048 block and push into endless mode, backed by 3 tactical undos per run.',
      statLine:
        best2048 > 0
          ? `Best ${best2048.toLocaleString()} · Peak Tile ${records2048.highestTile}`
          : 'Classic 4×4 & Extended 5×5 Vault',
      ctaLabel: 'Play Midnight 2048',
      imageAlt: 'Beveled obsidian stone and brushed brass puzzle tiles in a dark walnut tray',
      icon: <Grid2x2 className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'snake',
      category: 'arcade',
      title: 'NEON VIPER',
      meta: 'Arcade Snake · 3 Speeds · Combo Orbs',
      description:
        'Glide across a rain-wet midnight grid, chain amber orbs up to 5× streaks, hunt timed bonus spheres, and toggle solid or wrap walls.',
      statLine:
        snakeRecords.bestScore > 0
          ? `Best ${snakeRecords.bestScore} · Longest ${snakeRecords.bestLength}`
          : 'Cruise · Classic · Turbo Speeds',
      ctaLabel: 'Play Neon Viper',
      imageAlt: 'Glowing amber articulated serpent gliding across a dark rain-wet grid',
      icon: <Zap className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'blackjack',
      category: 'strategy',
      title: 'VELVET 21',
      meta: '6-Deck Blackjack · Pays 3:2 · Split & Double',
      description:
        'Take a seat at a dark emerald noir felt table with $1,000 in chips. Hit, stand, double down, or split pairs against a house dealer who stands on all 17s.',
      statLine:
        blackjackRecords.handsPlayed > 0
          ? `Peak $${blackjackRecords.peakBankroll.toLocaleString()} · ${blackjackRecords.handsWon} Hands Won`
          : '$1,000 Stack · 6-Deck Casino Shoe',
      ctaLabel: 'Play Velvet 21',
      imageAlt: 'Dark emerald velvet blackjack table with obsidian and gold casino chips',
      icon: <Spade className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  const visibleGames =
    filter === 'all' ? games : games.filter((g) => g.category === filter);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0B0D11] text-[#F2ECDC] flex flex-col">
      {/* Subtle atmospheric rain over deep noir canvas */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-35">
        <RainCanvas intensity="subtle" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-[1380px] flex-1 flex-col px-5 py-8 sm:px-8 sm:py-10">
        {/* Editorial Collection Header + Category Filter Controls */}
        <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="font-mono-tabular text-xs tracking-[0.22em] text-[#D99B38]">
              MIDNIGHT NOIR COLLECTION · SEVENTEEN PLAYABLE EXPERIENCES
            </div>
            <h1 className="mt-2 font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#F4EFE4] text-balance">
              Choose Your Game
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-[#B6BECA] leading-relaxed">
              Seventeen standalone, offline-ready noir games powered by local Alpha-Beta AI,
              Bayesian sonar, Shannon-entropy &amp; CSP logic solvers, and 60 FPS canvas action.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter games by genre"
            className="inline-flex flex-wrap items-center gap-1 self-start rounded-md border border-[#242C3B] bg-[#11151E] p-1"
          >
            {(
              [
                { id: 'all', label: 'All Games (17)' },
                { id: 'strategy', label: 'Strategy & AI (7)' },
                { id: 'puzzles', label: 'Puzzles & Mystery (5)' },
                { id: 'arcade', label: 'Arcade & Action (5)' },
              ] as const
            ).map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab.id)}
                  className={`rounded px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#D99B38] text-[#0C0E12] font-semibold'
                      : 'text-[#B2BCCB] hover:text-[#F4EFE4]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* Responsive 17-Game Showcase Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
          {visibleGames.map((game, idx) => {
            const isTrailingSingleton =
              idx === visibleGames.length - 1 && visibleGames.length % 3 === 1;
            return (
              <section
                key={game.id}
                aria-labelledby={`game-card-${game.id}`}
                className={`group flex flex-col overflow-hidden rounded-lg border border-[#242C3B] bg-[#12161F] transition-colors duration-200 hover:border-[#D99B38]/65 ${
                  isTrailingSingleton ? 'lg:col-span-3 lg:flex-row' : ''
                }`}
              >
                <div
                  className={`relative aspect-[16/9] w-full overflow-hidden bg-[#090B0E] ${
                    isTrailingSingleton ? 'lg:w-[46%] lg:aspect-auto lg:min-h-[260px]' : ''
                  }`}
                >
                  <NoirImage
                    src={backdrops[game.id]}
                    alt={game.imageAlt}
                    className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden="true"
                    className={`absolute inset-0 bg-gradient-to-t from-[#12161F] via-[#12161F]/25 to-transparent ${
                      isTrailingSingleton
                        ? 'lg:bg-gradient-to-r lg:from-transparent lg:via-[#12161F]/20 lg:to-[#12161F]'
                        : ''
                    }`}
                  />
                </div>

                <div
                  className={`flex flex-1 flex-col justify-between p-5 ${
                    isTrailingSingleton ? 'lg:p-8' : ''
                  }`}
                >
                  <div>
                    <div className="text-[11px] font-mono-tabular text-[#D99B38]">{game.meta}</div>
                    <h2
                      id={`game-card-${game.id}`}
                      className={`mt-1.5 font-display font-bold text-[#F4EFE4] ${
                        isTrailingSingleton ? 'text-2xl lg:text-3xl' : 'text-2xl'
                      }`}
                    >
                      {game.title}
                    </h2>
                    <p
                      className={`mt-2 text-sm text-[#C3C9D4] leading-relaxed ${
                        isTrailingSingleton ? 'max-w-xl' : ''
                      }`}
                    >
                      {game.description}
                    </p>
                  </div>

                  <div
                    className={`mt-5 flex flex-col gap-3 border-t border-[#202735] pt-4 ${
                      isTrailingSingleton ? 'lg:flex-row lg:items-center lg:justify-between' : ''
                    }`}
                  >
                    <span className="text-xs font-mono-tabular text-[#98A2B3]">{game.statLine}</span>

                    <button
                      type="button"
                      onClick={() => onSelectGame(game.id)}
                      className={`inline-flex items-center justify-center gap-2 rounded-md bg-[#D99B38] px-5 py-2.5 text-sm font-semibold text-[#0C0E12] transition-colors hover:bg-[#EBB556] whitespace-nowrap cursor-pointer ${
                        isTrailingSingleton ? 'w-full lg:w-auto' : 'w-full'
                      }`}
                    >
                      {game.icon}
                      <span>{game.ctaLabel}</span>
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <footer className="mt-8 border-t border-[#1D2330] pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#7E8798]">
          <span>Switch freely between all seventeen games anytime from any title or pause menu.</span>
          <span className="font-mono-tabular">100% Local &amp; Offline Ready · Zero API Keys</span>
        </footer>
      </main>
    </div>
  );
}
