import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { PhysicsWorld } from './game/physics';
import { GameState, GameStats } from './game/types';
import { soundEngine } from './game/audio';
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Flame,
  Trophy,
  Activity,
  Zap,
  Snowflake,
  Heart,
  Minus,
  Plus,
  AlertTriangle,
} from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE');
  const [isMuted, setIsMuted] = useState<boolean>(soundEngine.getMuted());
  const [startingLives, setStartingLives] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('burst_chamber_starting_lives');
      if (saved) {
        const val = parseInt(saved, 10);
        if (val > 0 && val <= 50) return val;
      }
    } catch {
      // ignore
    }
    return 5;
  });

  const [stats, setStats] = useState<GameStats>({
    score: 0,
    highScore: 0,
    combo: 1,
    maxCombo: 1,
    ballsScored: 0,
    survivalTime: 0,
    dangerLevel: 0,
    nextDropTimer: 3.2,
    feverMode: false,
    feverTimeRemaining: 0,
    freezeCooldown: 0,
    freezeMaxCooldown: 10.0,
    isFreezeActive: false,
    freezeTimeRemaining: 0,
    lives: 5,
    maxLives: 5,
    totalLifeLost: 0,
  });

  const physics = useMemo(() => new PhysicsWorld(), []);

  // Sync high score on initial load
  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      highScore: physics.stats.highScore,
    }));
  }, [physics]);

  // Handle Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'TITLE' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        startGame();
      } else if (gameState === 'PLAYING') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          setGameState('PAUSED');
        }
      } else if (gameState === 'PAUSED') {
        if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Space') {
          e.preventDefault();
          setGameState('PLAYING');
        }
      } else if (gameState === 'GAME_OVER') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          startGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const handleLivesChange = (newVal: number) => {
    const clamped = Math.max(1, Math.min(30, newVal));
    setStartingLives(clamped);
    try {
      localStorage.setItem('burst_chamber_starting_lives', String(clamped));
    } catch {
      // ignore
    }
  };

  const startGame = () => {
    physics.reset(startingLives);
    setStats({ ...physics.stats });
    setGameState('PLAYING');
  };

  const handleGameOver = () => {
    setGameState('GAME_OVER');
    setStats({ ...physics.stats });
  };

  const toggleSound = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans select-none">
      {/* Central 60fps Physics Arena */}
      <div className="relative w-full h-full max-w-2xl max-h-[960px] flex flex-col bg-[#070914] shadow-2xl">
        <GameCanvas
          physics={physics}
          isPaused={gameState !== 'PLAYING'}
          onStatsUpdate={setStats}
          onGameOver={handleGameOver}
        />

        {/* ---------------- HUD OVERLAY (Only during PLAYING or PAUSED) ---------------- */}
        {gameState !== 'TITLE' && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 z-10">
            {/* Top Perimeter Cluster */}
            <div className="flex items-center justify-between gap-4 pointer-events-auto">
              {/* Score & Combo */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Score</span>
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono-numbers text-white drop-shadow-sm">
                    {stats.score.toLocaleString()}
                  </span>
                </div>

                {/* Combo / Fever Tag */}
                {stats.combo > 1 && (
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-transform duration-150 ${
                      stats.feverMode
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {stats.feverMode ? (
                      <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
                    )}
                    <span className="text-xs font-black tracking-wide font-mono-numbers">
                      {stats.feverMode ? `FEVER x${stats.combo}` : `COMBO x${stats.combo}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Lives Counter with Hearts */}
              <div
                className={`flex items-center gap-2 bg-slate-900/90 border px-3 py-1.5 rounded-lg shadow-sm transition-colors ${
                  stats.lives <= 1
                    ? 'border-red-500/70 bg-red-950/40'
                    : stats.lives <= 2
                    ? 'border-rose-500/50 bg-rose-950/30'
                    : 'border-slate-700/60'
                }`}
              >
                <Heart
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    stats.lives <= 1
                      ? 'text-red-500 fill-red-500 animate-ping'
                      : stats.lives <= 2
                      ? 'text-rose-400 fill-rose-400 animate-pulse'
                      : 'text-rose-500 fill-rose-500'
                  }`}
                />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">LIVES</span>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-base sm:text-lg font-black font-mono-numbers ${
                        stats.lives <= 1
                          ? 'text-red-400 font-extrabold animate-pulse'
                          : stats.lives <= 2
                          ? 'text-rose-400 font-extrabold'
                          : 'text-rose-300'
                      }`}
                    >
                      {stats.lives}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono-numbers">/ {stats.maxLives}</span>
                  </div>
                </div>

                {/* Miniature visual life pips for up to 10 lives */}
                {stats.maxLives <= 10 && (
                  <div className="hidden sm:flex items-center gap-1 ml-1.5">
                    {Array.from({ length: stats.maxLives }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          idx < stats.lives
                            ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                            : 'bg-slate-800 border border-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Ceiling Danger Alert Bar */}
              <div className="hidden sm:flex flex-col items-center gap-1 w-32">
                <div className="flex items-center justify-between w-full text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>Ceiling Alert</span>
                  <span
                    className={`font-mono-numbers ${
                      stats.dangerLevel > 0.4 ? 'text-red-400 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {Math.round(stats.dangerLevel * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      stats.dangerLevel > 0.6
                        ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                        : stats.dangerLevel > 0.3
                        ? 'bg-amber-400'
                        : 'bg-cyan-500'
                    }`}
                    style={{ width: `${Math.min(100, stats.dangerLevel * 100)}%` }}
                  />
                </div>
              </div>

              {/* Utility Action Buttons: Pause & Mute */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGameState(gameState === 'PLAYING' ? 'PAUSED' : 'PLAYING')}
                  className="p-2 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors cursor-pointer"
                  title="Pause (Esc)"
                  aria-label="Pause"
                >
                  {gameState === 'PLAYING' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleSound}
                  className="p-2 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                  aria-label="Toggle Sound"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Bottom Freeze Ability & Mobile Touch Controls */}
            <div className="flex flex-col gap-3">
              {/* Burst Freeze Action Gauge Button */}
              <button
                onClick={() => physics.triggerBurstFreeze()}
                disabled={stats.freezeCooldown > 0 && !stats.isFreezeActive}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg border self-center pointer-events-auto transition-all cursor-pointer ${
                  stats.isFreezeActive
                    ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(56,189,248,0.5)] animate-pulse'
                    : stats.freezeCooldown > 0
                    ? 'bg-slate-900/80 border-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-cyan-950/70 border-cyan-500/70 text-cyan-300 hover:bg-cyan-900/80 hover:border-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.25)] active:scale-95'
                }`}
                title="Burst Freeze (Space) - 3.5s Stop & Reset All Ball Timers"
              >
                <Snowflake
                  className={`w-4 h-4 shrink-0 ${
                    stats.isFreezeActive
                      ? 'animate-spin text-cyan-300'
                      : stats.freezeCooldown <= 0
                      ? 'text-cyan-400'
                      : 'text-slate-500'
                  }`}
                />
                <div className="flex flex-col w-40 sm:w-56 text-left">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-0.5">
                    <span>
                      {stats.isFreezeActive
                        ? '❄ FREEZE ACTIVE!'
                        : stats.freezeCooldown > 0
                        ? 'FREEZE RECHARGE'
                        : 'BURST FREEZE'}
                    </span>
                    <span className="font-mono-numbers">
                      {stats.isFreezeActive
                        ? `${stats.freezeTimeRemaining.toFixed(1)}s`
                        : stats.freezeCooldown > 0
                        ? `${Math.ceil(stats.freezeCooldown)}s`
                        : 'READY'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-100 ${
                        stats.isFreezeActive
                          ? 'bg-cyan-300'
                          : stats.freezeCooldown > 0
                          ? 'bg-cyan-600/70'
                          : 'bg-cyan-400'
                      }`}
                      style={{
                        width: stats.isFreezeActive
                          ? `${(stats.freezeTimeRemaining / 3.5) * 100}%`
                          : stats.freezeCooldown > 0
                          ? `${((stats.freezeMaxCooldown - stats.freezeCooldown) / stats.freezeMaxCooldown) * 100}%`
                          : '100%',
                      }}
                    />
                  </div>
                </div>
                <span className="hidden sm:inline text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-300">
                  [Space]
                </span>
              </button>

              {/* Mobile/Touch On-Screen Quick Buttons */}
              <div className="flex sm:hidden items-center justify-between gap-1.5 pointer-events-auto">
                <button
                  onPointerDown={() => (physics.playerBox.targetTilt = -0.32)}
                  onPointerUp={() => (physics.playerBox.targetTilt = 0)}
                  className="flex-1 py-2.5 bg-slate-900/80 border border-slate-700 rounded text-xs font-bold active:bg-cyan-900/50"
                >
                  ◀ 傾き
                </button>
                <button
                  onClick={() => physics.triggerBoxLaunch()}
                  className="flex-1 py-2.5 bg-sky-600/40 border border-sky-400/60 text-sky-200 rounded text-xs font-black active:bg-sky-500/60"
                >
                  ▲ 打ち上げ
                </button>
                <button
                  onClick={() => physics.triggerBurstFreeze()}
                  disabled={stats.freezeCooldown > 0 && !stats.isFreezeActive}
                  className={`flex-1 py-2.5 border rounded text-xs font-bold active:scale-95 transition-all ${
                    stats.isFreezeActive
                      ? 'bg-cyan-500/40 border-cyan-400 text-cyan-200 animate-pulse'
                      : stats.freezeCooldown > 0
                      ? 'bg-slate-900/60 border-slate-800 text-slate-500'
                      : 'bg-cyan-600/30 border-cyan-500/60 text-cyan-200'
                  }`}
                >
                  {stats.isFreezeActive
                    ? `❄ ${stats.freezeTimeRemaining.toFixed(1)}s`
                    : stats.freezeCooldown > 0
                    ? `❄ ${Math.ceil(stats.freezeCooldown)}s`
                    : '❄ 爆発停止'}
                </button>
                <button
                  onPointerDown={() => (physics.playerBox.targetTilt = 0.32)}
                  onPointerUp={() => (physics.playerBox.targetTilt = 0)}
                  className="flex-1 py-2.5 bg-slate-900/80 border border-slate-700 rounded text-xs font-bold active:bg-cyan-900/50"
                >
                  傾き ▶
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- TITLE SCREEN OVERLAY ---------------- */}
        {gameState === 'TITLE' && (
          <div className="absolute inset-0 z-20 flex flex-col justify-between items-center p-6 sm:p-10 bg-slate-950/85">
            {/* Top Mute Toggle */}
            <div className="w-full flex justify-end">
              <button
                onClick={toggleSound}
                className="p-2 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Center Hero Lockup */}
            <div className="flex flex-col items-center text-center max-w-md">
              {/* Bespoke Title SVG Logo */}
              <div className="mb-4">
                <svg
                  className="w-20 h-20 text-cyan-400 animate-pulse"
                  viewBox="0 0 100 100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                >
                  <circle cx="50" cy="50" r="42" strokeDasharray="6 4" />
                  <circle cx="50" cy="50" r="28" stroke="currentColor" fill="rgba(56, 189, 248, 0.1)" />
                  <path d="M50 22 L50 36 M50 64 L50 78 M22 50 L36 50 M64 50 L78 50" strokeWidth="3" />
                  <circle cx="50" cy="50" r="10" fill="#f97316" stroke="#fb923c" />
                </svg>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display text-white mb-2">
                BURST CHAMBER
              </h1>
              <p className="text-sm font-medium text-cyan-300 mb-6 tracking-wide">
                3秒爆発空中ターゲットパズル
              </p>

              {/* Game Core Concept Rule Cards */}
              <div className="flex flex-col gap-2.5 text-left text-xs text-slate-300 bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 mb-4 w-full">
                <div className="flex items-start gap-2.5">
                  <span className="text-orange-400 font-bold shrink-0 font-mono-numbers">01.</span>
                  <span>天井から落ちる玉は各々が<strong>「3秒おき」に激しく爆発推進</strong>！</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-cyan-400 font-bold shrink-0 font-mono-numbers">02.</span>
                  <span>空中の<strong>コア＆サブサークルは下からの玉にのみ反応</strong>！ピストン[W/↑]で<strong>下から打ち上げて誘導</strong>！</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold shrink-0 font-mono-numbers">03.</span>
                  <span>陣地から外へこぼれて画面外へ落下すると<strong>ライフが1減少（ダメージ）</strong>！</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-sky-300 font-bold shrink-0 font-mono-numbers">04.</span>
                  <span>ピンチの時は<strong>【爆発一斉停止[Space]】</strong>（リチャージ10秒）で全玉を安全に停止＆タイマーリセット！</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-amber-400 font-bold shrink-0 font-mono-numbers">05.</span>
                  <span><strong>ライフが0になる</strong>か、または玉が溢れて<strong>天井危険ラインに接触</strong>するとゲームオーバー。</span>
                </div>
              </div>

              {/* Starting Lives Configuration Box */}
              <div className="w-full bg-slate-900/95 border border-rose-500/35 rounded-xl p-3.5 mb-5 shadow-lg shadow-rose-950/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />
                    <span className="text-xs font-bold text-rose-300 tracking-wide uppercase">
                      INITIAL LIVES (初期ライフ設定)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    落下耐久: <strong className="text-rose-400 font-bold font-mono-numbers">{startingLives}</strong> 回
                  </span>
                </div>

                {/* Stepper & Preset Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  {/* Stepper with - / count / + */}
                  <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-lg p-1 w-full sm:w-auto justify-center">
                    <button
                      onClick={() => handleLivesChange(startingLives - 1)}
                      disabled={startingLives <= 1}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 cursor-pointer active:scale-95"
                      title="Decrease lives"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1.5 px-3">
                      <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                      <span className="text-base font-black font-mono-numbers text-white min-w-[24px] text-center">
                        {startingLives}
                      </span>
                    </div>

                    <button
                      onClick={() => handleLivesChange(startingLives + 1)}
                      disabled={startingLives >= 30}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 cursor-pointer active:scale-95"
                      title="Increase lives"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center">
                    {[
                      { count: 3, label: '3 (HARD)' },
                      { count: 5, label: '5 (STD)' },
                      { count: 10, label: '10 (EASY)' },
                      { count: 20, label: '20 (PRACTICE)' },
                    ].map((preset) => (
                      <button
                        key={preset.count}
                        onClick={() => handleLivesChange(preset.count)}
                        className={`px-2 py-1.5 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${
                          startingLives === preset.count
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                            : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 mt-2 text-center sm:text-left">
                  ※ 陣地から玉がこぼれて画面外に落下するとライフ -1。ライフが0になるとゲームオーバー！
                </p>
              </div>

              {/* Primary Start Action */}
              <button
                onClick={startGame}
                className="w-full sm:w-64 py-3.5 px-6 rounded-lg font-bold text-sm tracking-wide bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98] cursor-pointer"
              >
                START GAME
              </button>
            </div>

            {/* Flat Control Hints Bar */}
            <div className="text-[11px] text-slate-400 font-mono tracking-tight text-center">
              <span>A / D or Drag: 移動 · Q / E: 傾き · W / ↑: 打ち上げ · Space: 爆発停止 · Esc: 停止</span>
            </div>
          </div>
        )}

        {/* ---------------- PAUSE MODAL ---------------- */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-6">
            <div className="flex flex-col items-center bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 w-full max-w-xs shadow-2xl text-center">
              <h2 className="text-xl font-bold font-display text-white mb-4">PAUSED</h2>

              <div className="flex flex-col gap-2.5 w-full mb-6">
                <button
                  onClick={() => setGameState('PLAYING')}
                  className="w-full py-2.5 px-4 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  RESUME
                </button>
                <button
                  onClick={startGame}
                  className="w-full py-2.5 px-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
                >
                  RESTART
                </button>
                <button
                  onClick={() => setGameState('TITLE')}
                  className="w-full py-2.5 px-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 font-medium text-xs transition-colors cursor-pointer"
                >
                  TITLE MENU
                </button>
              </div>

              <div className="text-[11px] text-slate-400">
                Press [Esc] or [Space] to Resume
              </div>
            </div>
          </div>
        )}

        {/* ---------------- GAME OVER MODAL ---------------- */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 p-6">
            <div className="flex flex-col items-center bg-slate-900 border border-red-500/30 rounded-xl p-6 sm:p-8 w-full max-w-sm shadow-2xl text-center">
              {stats.gameOverReason === 'LIVES_DEPLETED' ? (
                <div className="flex flex-col items-center mb-3">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold mb-1">
                    <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                    <span>LIVES DEPLETED (ライフ全滅)</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    玉が画面外に落下し耐久ライフがゼロになりました
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center mb-3">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span>CEILING OVERFLOW (天井限界突破)</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    玉が溢れ天井の危険ラインに接触・蓄積しました
                  </span>
                </div>
              )}

              <h2 className="text-3xl font-extrabold font-display text-white mb-5">
                GAME OVER
              </h2>

              {/* Score Breakdown Table */}
              <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-lg p-4 mb-6 flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Final Score</span>
                  <span className="text-lg font-bold font-mono-numbers text-cyan-300">
                    {stats.score.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-800 pt-2">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    High Score
                  </span>
                  <span className="font-bold font-mono-numbers text-amber-400">
                    {stats.highScore.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-800 pt-2">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    Max Combo
                  </span>
                  <span className="font-bold font-mono-numbers text-white">
                    x{stats.maxCombo}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-800 pt-2">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    Balls Cleared (獲得)
                  </span>
                  <span className="font-bold font-mono-numbers text-emerald-400">
                    {stats.ballsScored}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-800 pt-2">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    Balls Dropped (落下損失)
                  </span>
                  <span className="font-bold font-mono-numbers text-rose-400">
                    {stats.totalLifeLost} 個
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={startGame}
                  className="w-full py-3 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  PLAY AGAIN
                </button>
                <button
                  onClick={() => setGameState('TITLE')}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 font-medium text-xs transition-colors cursor-pointer"
                >
                  TITLE MENU
                </button>
              </div>

              <span className="text-[10px] text-slate-400 mt-4">
                Press [Space] or [Enter] to Restart
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
