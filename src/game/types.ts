export type GameState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type BallType = 'plasma' | 'volatile' | 'heavy' | 'prism';

export interface Ball {
  id: number;
  type: BallType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  restitution: number;
  
  // 3-second cycle timer
  cycleDuration: number; // exactly 3.0 seconds
  timer: number; // counts down from 3.0 to 0.0
  flashTimer: number; // for hit/burst flash
  
  // Visuals
  color: string;
  glowColor: string;
  angle: number;
  angularVelocity: number;
  trail: { x: number; y: number; alpha: number }[];
  isScoring?: boolean;
  scoreProgress?: number;
}

export interface ScoreHole {
  id: number;
  x: number; // world coordinate in mid-air
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  type: 'core' | 'sub';
  name: string;
  points: number;
  multiplierBonus: number;
  glowColor: string;
  pulsePhase: number;
  floatSpeed: number;
  floatAmplitude: number;
  respawnTimer: number;
}

export interface PlayerBox {
  x: number; // center x
  y: number; // center y (bottom region)
  width: number; // width of the box
  height: number; // height of the box
  wallThickness: number;
  tilt: number; // angle in radians (-0.35 to 0.35)
  targetTilt: number;
  vx: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  type: 'spark' | 'smoke' | 'blast' | 'score' | 'ring';
  radius?: number;
  maxRadius?: number;
}

export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  scale: number;
  vy: number;
}

export interface GameStats {
  score: number;
  highScore: number;
  combo: number;
  maxCombo: number;
  ballsScored: number;
  survivalTime: number;
  dangerLevel: number; // 0.0 to 1.0 (overflow danger towards ceiling)
  nextDropTimer: number;
  feverMode: boolean;
  feverTimeRemaining: number;
  freezeCooldown: number; // 0.0 when ready, up to 10.0s
  freezeMaxCooldown: number; // 10.0s
  isFreezeActive: boolean;
  freezeTimeRemaining: number; // 3.0s while active
  // Lives System
  lives: number; // Current remaining lives
  maxLives: number; // Starting lives configured on title screen
  totalLifeLost: number; // Total balls lost off-screen
  gameOverReason?: 'LIVES_DEPLETED' | 'CEILING_OVERFLOW';
}
