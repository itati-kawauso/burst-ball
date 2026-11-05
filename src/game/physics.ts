import { Ball, BallType, PlayerBox, ScoreHole, Particle, FloatingText, GameStats } from './types';
import { soundEngine } from './audio';

export interface WorldConfig {
  width: number;
  height: number;
  gravity: number;
  dangerCeilingY: number;
}

export class PhysicsWorld {
  public config: WorldConfig = {
    width: 600,
    height: 780,
    gravity: 680,
    dangerCeilingY: 76,
  };

  public balls: Ball[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public scoreHoles: ScoreHole[] = [];
  public playerBox: PlayerBox;

  public stats: GameStats = {
    score: 0,
    highScore: 0,
    combo: 1,
    maxCombo: 1,
    ballsScored: 0,
    survivalTime: 0,
    dangerLevel: 0,
    nextDropTimer: 2.5,
    feverMode: false,
    feverTimeRemaining: 0,
    freezeCooldown: 0,
    freezeMaxCooldown: 10.0,
    isFreezeActive: false,
    freezeTimeRemaining: 0,
    lives: 5,
    maxLives: 5,
    totalLifeLost: 0,
  };

  public startingLives: number = 5;
  public damageFlashTimer: number = 0;
  public isGameOver: boolean = false;
  public cameraShake: number = 0;
  public hitStopTimer: number = 0;
  private nextBallId: number = 1;
  private nextTextId: number = 1;
  private comboTimer: number = 0;
  private spawnInterval: number = 3.2;
  private timeSinceLastAlarm: number = 0;

  constructor() {
    this.playerBox = {
      x: this.config.width / 2,
      y: this.config.height - 120,
      width: 250,
      height: 140,
      wallThickness: 26,
      tilt: 0,
      targetTilt: 0,
      vx: 0,
    };

    // Load saved lives setting if exists
    try {
      const savedLives = localStorage.getItem('burst_chamber_starting_lives');
      if (savedLives) {
        const parsed = parseInt(savedLives, 10);
        if (parsed > 0 && parsed <= 50) {
          this.startingLives = parsed;
          this.stats.lives = parsed;
          this.stats.maxLives = parsed;
        }
      }
    } catch {
      // ignore
    }

    this.initScoreHoles();
    this.loadHighScore();
  }

  private loadHighScore() {
    try {
      const saved = localStorage.getItem('burst_chamber_high_score');
      if (saved) {
        this.stats.highScore = parseInt(saved, 10) || 0;
      }
    } catch {
      // ignore
    }
  }

  public saveHighScore() {
    try {
      if (this.stats.score > this.stats.highScore) {
        this.stats.highScore = this.stats.score;
        localStorage.setItem('burst_chamber_high_score', String(this.stats.highScore));
      }
    } catch {
      // ignore
    }
  }

  public resize(width: number, height: number) {
    this.config.width = width;
    this.config.height = height;
    this.config.dangerCeilingY = Math.max(70, height * 0.1);
    
    // Adjust player box positioning
    this.playerBox.x = Math.max(this.playerBox.width / 2 + 20, Math.min(width - this.playerBox.width / 2 - 20, this.playerBox.x));
    this.playerBox.y = height - 125;
    this.initScoreHoles();
  }

  public generateHolePosition(existingHoles: ScoreHole[], radius: number): { x: number; y: number } {
    const minX = radius + 35;
    const maxX = Math.max(minX + 40, this.config.width - radius - 35);
    const minY = this.config.dangerCeilingY + 60;
    const maxY = Math.max(minY + 60, this.playerBox.y - 110);

    for (let attempt = 0; attempt < 40; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      let ok = true;
      for (const other of existingHoles) {
        const dist = Math.hypot(x - other.baseX, y - other.baseY);
        if (dist < 95) {
          ok = false;
          break;
        }
      }
      if (ok) return { x, y };
    }
    return {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };
  }

  public initScoreHoles() {
    this.scoreHoles = [];

    // 1 Core Hole (Larger, radiant cyan/gold, 300 pts)
    const corePos = this.generateHolePosition(this.scoreHoles, 32);
    this.scoreHoles.push({
      id: 1,
      x: corePos.x,
      y: corePos.y,
      baseX: corePos.x,
      baseY: corePos.y,
      radius: 32,
      type: 'core',
      name: 'CORE',
      points: 300,
      multiplierBonus: 1,
      glowColor: '#38bdf8', // radiant cyan
      pulsePhase: 0,
      floatSpeed: 2.2,
      floatAmplitude: 8,
      respawnTimer: 0,
    });

    // 2 Sub Holes (Medium, emerald & purple, 150 pts each)
    const sub1Pos = this.generateHolePosition(this.scoreHoles, 25);
    this.scoreHoles.push({
      id: 2,
      x: sub1Pos.x,
      y: sub1Pos.y,
      baseX: sub1Pos.x,
      baseY: sub1Pos.y,
      radius: 25,
      type: 'sub',
      name: 'SUB',
      points: 150,
      multiplierBonus: 1,
      glowColor: '#34d399', // emerald
      pulsePhase: Math.PI * 0.7,
      floatSpeed: 1.8,
      floatAmplitude: 6,
      respawnTimer: 0,
    });

    const sub2Pos = this.generateHolePosition(this.scoreHoles, 25);
    this.scoreHoles.push({
      id: 3,
      x: sub2Pos.x,
      y: sub2Pos.y,
      baseX: sub2Pos.x,
      baseY: sub2Pos.y,
      radius: 25,
      type: 'sub',
      name: 'SUB',
      points: 150,
      multiplierBonus: 1,
      glowColor: '#c084fc', // purple
      pulsePhase: Math.PI * 1.4,
      floatSpeed: 2.5,
      floatAmplitude: 7,
      respawnTimer: 0,
    });
  }

  public reset(startingLives?: number) {
    if (startingLives !== undefined) {
      this.startingLives = startingLives;
    }
    this.balls = [];
    this.particles = [];
    this.floatingTexts = [];
    this.isGameOver = false;
    this.cameraShake = 0;
    this.hitStopTimer = 0;
    this.comboTimer = 0;
    this.spawnInterval = 3.2;
    this.damageFlashTimer = 0;
    this.stats = {
      score: 0,
      highScore: this.stats.highScore,
      combo: 1,
      maxCombo: 1,
      ballsScored: 0,
      survivalTime: 0,
      dangerLevel: 0,
      nextDropTimer: 1.2,
      feverMode: false,
      feverTimeRemaining: 0,
      freezeCooldown: 0,
      freezeMaxCooldown: 10.0,
      isFreezeActive: false,
      freezeTimeRemaining: 0,
      lives: this.startingLives,
      maxLives: this.startingLives,
      totalLifeLost: 0,
      gameOverReason: undefined,
    };
    this.playerBox.x = this.config.width / 2;
    this.playerBox.tilt = 0;
    this.playerBox.targetTilt = 0;

    // Spawn 2 initial starter balls
    this.spawnBall(this.config.width * 0.45, 110, 'plasma', 0.8);
    this.spawnBall(this.config.width * 0.55, 95, 'plasma', 2.2);
  }

  public spawnBall(x?: number, y?: number, forcedType?: BallType, startTimer?: number): Ball {
    const types: BallType[] = ['plasma', 'plasma', 'volatile', 'heavy', 'prism'];
    const chosenType = forcedType || types[Math.floor(Math.random() * types.length)];
    
    let radius = 18;
    let mass = 1.0;
    let restitution = 0.72;
    let color = '#38bdf8';
    let glowColor = '#0ea5e9';

    if (chosenType === 'volatile') {
      radius = 19;
      mass = 1.1;
      color = '#f97316';
      glowColor = '#ea580c';
    } else if (chosenType === 'heavy') {
      radius = 23;
      mass = 2.4;
      restitution = 0.55;
      color = '#eab308';
      glowColor = '#ca8a04';
    } else if (chosenType === 'prism') {
      radius = 16;
      mass = 0.8;
      restitution = 0.85;
      color = '#c084fc';
      glowColor = '#a855f7';
    }

    const ballX = x !== undefined ? x : this.config.width * (0.3 + Math.random() * 0.4);
    const ballY = y !== undefined ? y : 90;

    const ball: Ball = {
      id: this.nextBallId++,
      type: chosenType,
      x: ballX,
      y: ballY,
      vx: (Math.random() - 0.5) * 60,
      vy: 40 + Math.random() * 50,
      radius,
      mass,
      restitution,
      cycleDuration: 3.0,
      timer: startTimer !== undefined ? startTimer : 3.0,
      flashTimer: 0,
      color,
      glowColor,
      angle: Math.random() * Math.PI * 2,
      angularVelocity: (Math.random() - 0.5) * 4,
      trail: [],
    };

    this.balls.push(ball);

    // Spawn effect
    this.createBlastRing(ball.x, ball.y, ball.glowColor, 35, 12);
    return ball;
  }

  public addFloatingText(text: string, x: number, y: number, color: string = '#ffffff', scale: number = 1.0) {
    this.floatingTexts.push({
      id: this.nextTextId++,
      text,
      x,
      y,
      color,
      alpha: 1.0,
      scale,
      vy: -55,
    });
  }

  public createSparks(x: number, y: number, color: string, count: number = 10, speed: number = 180) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1.0,
        decay: 1.8 + Math.random() * 1.5,
        type: 'spark',
      });
    }
  }

  public createBlastRing(x: number, y: number, color: string, maxRadius: number = 60, count: number = 8) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 2,
      radius: 5,
      maxRadius,
      color,
      alpha: 1.0,
      decay: 2.8,
      type: 'ring',
    });
    this.createSparks(x, y, color, count, maxRadius * 2.8);
  }

  /**
   * Main Physics & Game Loop Update
   */
  public update(dt: number) {
    if (this.isGameOver) return;

    // Hit-stop support for meaty impacts
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    // Decay camera shake
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 25);
    }

    // Decay damage red flash
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
    }

    this.stats.survivalTime += dt;

    // Smooth tilt interpolation
    this.playerBox.tilt += (this.playerBox.targetTilt - this.playerBox.tilt) * Math.min(1.0, dt * 14);

    // Update Freeze Ability Cooldown & Active Timer
    if (this.stats.freezeCooldown > 0) {
      this.stats.freezeCooldown = Math.max(0, this.stats.freezeCooldown - dt);
    }
    if (this.stats.isFreezeActive) {
      this.stats.freezeTimeRemaining -= dt;
      if (this.stats.freezeTimeRemaining <= 0) {
        this.stats.isFreezeActive = false;
      }
    }

    // Fever mode duration
    if (this.stats.feverMode) {
      this.stats.feverTimeRemaining -= dt;
      if (this.stats.feverTimeRemaining <= 0) {
        this.stats.feverMode = false;
        this.stats.combo = 1;
      }
    }

    // Combo timer decay
    if (this.stats.combo > 1 && !this.stats.feverMode) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.stats.combo = 1;
      }
    }

    // Progressive Spawner Cadence
    this.stats.nextDropTimer -= dt;
    // Speed up drops gradually based on survival time and score
    this.spawnInterval = Math.max(1.8, 3.2 - (this.stats.survivalTime * 0.015) - (this.stats.score * 0.0001));
    if (this.stats.nextDropTimer <= 0) {
      this.spawnBall();
      this.stats.nextDropTimer = this.spawnInterval;
    }

    // Track ceiling hazard proximity
    let highestBallY = this.config.height;
    let ballsAboveDangerLine = 0;

    // 1. Update Ball Timers, Explosions, and Visuals (once per frame)
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];

      // Handle Scoring animation
      if (ball.isScoring) {
        ball.scoreProgress = (ball.scoreProgress || 0) + Math.max(0, dt * 4.5);
        ball.radius = Math.max(1, ball.radius * Math.max(0.1, 1 - dt * 3.5));
        ball.trail.length = 0;
        if (ball.scoreProgress >= 1.0) {
          this.balls.splice(i, 1);
        }
        continue;
      }

      // 3-SECOND CYCLE LOGIC
      // If Freeze is ACTIVE, all ball timers are frozen!
      if (!this.stats.isFreezeActive) {
        ball.timer -= dt;

        // Charge warning tick sound & flash in last 0.7s
        if (ball.timer <= 0.75 && ball.timer > 0) {
          if (Math.sin(ball.timer * 28) > 0.6) {
            ball.flashTimer = 0.08;
          }
        }

        // Flash timer decay
        if (ball.flashTimer > 0) {
          ball.flashTimer -= dt;
        }

        // EXPLOSION IMPULSE!
        if (ball.timer <= 0) {
          this.triggerBallBurst(ball);
          ball.timer = ball.cycleDuration; // Reset to 3.0s
        }
      } else {
        // Active freeze: calm flash & emit gentle frosty sparkles
        ball.flashTimer = 0;
        if (Math.random() < 0.12) {
          this.particles.push({
            x: ball.x + (Math.random() - 0.5) * ball.radius,
            y: ball.y + (Math.random() - 0.5) * ball.radius,
            vx: (Math.random() - 0.5) * 16,
            vy: -15 - Math.random() * 20,
            size: 2,
            color: '#7dd3fc',
            alpha: 0.8,
            decay: 2.2,
            type: 'spark',
          });
        }
      }
    }

    // 2. High-Precision Multi-Substepping Physics Simulation (Zero Wall-Tunneling)
    const clampedDt = Math.min(dt, 0.04);
    const subSteps = 6;
    const subDt = clampedDt / subSteps;

    for (let step = 0; step < subSteps; step++) {
      for (let i = 0; i < this.balls.length; i++) {
        const ball = this.balls[i];
        if (ball.isScoring) continue;

        // Gravity
        ball.vy += this.config.gravity * subDt;

        // Air damping
        ball.vx *= Math.pow(0.996, subDt * 60);
        ball.vy *= Math.pow(0.996, subDt * 60);

        // Clamp extreme speeds to prevent physics glitches
        const spd = Math.hypot(ball.vx, ball.vy);
        const maxSpd = 1050;
        if (spd > maxSpd) {
          ball.vx = (ball.vx / spd) * maxSpd;
          ball.vy = (ball.vy / spd) * maxSpd;
        }

        // Move ball by subDt
        ball.x += ball.vx * subDt;
        ball.y += ball.vy * subDt;
        ball.angle += ball.angularVelocity * subDt;

        // Screen boundary reflections
        if (ball.x - ball.radius < 0) {
          ball.x = ball.radius;
          ball.vx = -ball.vx * ball.restitution;
          soundEngine.playBounce(Math.abs(ball.vx));
        } else if (ball.x + ball.radius > this.config.width) {
          ball.x = this.config.width - ball.radius;
          ball.vx = -ball.vx * ball.restitution;
          soundEngine.playBounce(Math.abs(ball.vx));
        }

        // Hard Ceiling physical bounce (roof buffer)
        if (ball.y - ball.radius < 20) {
          ball.y = 20 + ball.radius;
          ball.vy = Math.abs(ball.vy) * ball.restitution;
        }

        // Box collision check
        this.resolveBoxCollision(ball);

        // Score circle absorption (only upward moving balls)
        this.checkScoreHoleAbsorption(ball);
      }

      // Ball-to-Ball Elastic Collisions
      this.resolveBallCollisions();

      // Post-ball collision box containment pass
      for (let i = 0; i < this.balls.length; i++) {
        const ball = this.balls[i];
        if (!ball.isScoring) {
          this.resolveBoxCollision(ball);
        }
      }
    }

    // 3. Post-Physics Trail Updates & Off-Screen Despawn Check
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      if (ball.isScoring) continue;

      // Update Trail
      if (Math.hypot(ball.vx, ball.vy) > 200) {
        ball.trail.push({ x: ball.x, y: ball.y, alpha: 0.6 });
        if (ball.trail.length > 5) ball.trail.shift();
      } else if (ball.trail.length > 0) {
        ball.trail.shift();
      }

      // BALLS FALLING OUTSIDE BOX DISAPPEAR OFF-SCREEN -> DAMAGE LIFE!
      if (ball.y - ball.radius > this.config.height + 25) {
        this.balls.splice(i, 1);
        this.onBallDropped(ball);
        if (this.isGameOver) return;
        continue;
      }

      // Ceiling contact & Danger tracking
      if (ball.y - ball.radius < this.config.dangerCeilingY) {
        ballsAboveDangerLine++;
      }
      if (ball.y < highestBallY) {
        highestBallY = ball.y;
      }
    }

    // 4. Danger Level calculation & Game Over Check
    // If balls breach the ceiling line
    if (ballsAboveDangerLine > 0 || highestBallY < this.config.dangerCeilingY + 25) {
      const breachSeverity = Math.max(0, (this.config.dangerCeilingY + 30 - highestBallY) / 50);
      this.stats.dangerLevel = Math.min(1.0, this.stats.dangerLevel + dt * (0.45 + breachSeverity * 0.8));
      
      this.timeSinceLastAlarm += dt;
      if (this.timeSinceLastAlarm > 0.35) {
        soundEngine.playDangerWarning();
        this.timeSinceLastAlarm = 0;
      }
      if (this.stats.dangerLevel >= 1.0) {
        this.triggerGameOver('CEILING_OVERFLOW');
        return;
      }
    } else {
      this.stats.dangerLevel = Math.max(0, this.stats.dangerLevel - dt * 0.35);
    }

    // 4. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.type === 'ring' && p.radius !== undefined && p.maxRadius !== undefined) {
        const factor = Math.max(0, Math.min(1.0, dt * 14));
        p.radius = Math.max(0.1, p.radius + (p.maxRadius - p.radius) * factor);
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 80 * dt; // slight particle gravity
      }
    }

    // 5. Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.alpha -= dt * 1.2;
      ft.y += ft.vy * dt;
      ft.scale = Math.max(0.8, ft.scale - dt * 0.2);
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update Hole Floating & Pulse
    for (const hole of this.scoreHoles) {
      hole.pulsePhase += dt * 3.5;
      if (hole.respawnTimer > 0) {
        hole.respawnTimer = Math.max(0, hole.respawnTimer - dt);
      }
      hole.y = hole.baseY + Math.sin(hole.pulsePhase * hole.floatSpeed) * hole.floatAmplitude;
      hole.x = hole.baseX + Math.cos(hole.pulsePhase * hole.floatSpeed * 0.6) * (hole.floatAmplitude * 0.4);
    }
  }

  /**
   * 3-Second Violent Burst Explosion execution
   */
  public triggerBallBurst(ball: Ball) {
    // Generate high-impulse blast vector
    const basePower = ball.type === 'volatile' ? 760 : ball.type === 'heavy' ? 480 : 640;
    const randomAngle = Math.random() * Math.PI * 2;
    const blastPower = basePower * (0.8 + Math.random() * 0.4);

    const impulseX = Math.cos(randomAngle) * blastPower;
    const impulseY = Math.sin(randomAngle) * blastPower;

    ball.vx = impulseX;
    ball.vy = impulseY;
    ball.angularVelocity = (Math.random() - 0.5) * 20;

    // Visual & Sound Feedback
    const intensity = ball.type === 'volatile' ? 1.5 : ball.type === 'heavy' ? 1.2 : 1.0;
    soundEngine.playBurst(intensity);

    this.cameraShake = Math.min(18, this.cameraShake + 8 * intensity);

    // Shockwave affecting nearby balls
    const shockRadius = (ball.type === 'volatile' ? 130 : 80);
    for (const other of this.balls) {
      if (other.id === ball.id || other.isScoring) continue;
      const dx = other.x - ball.x;
      const dy = other.y - ball.y;
      const dist = Math.hypot(dx, dy);
      if (dist < shockRadius && dist > 1) {
        const force = (1 - dist / shockRadius) * blastPower * 0.75;
        other.vx += (dx / dist) * force;
        other.vy += (dy / dist) * force;
        other.flashTimer = 0.12;
      }
    }

    // Spawn shockwave ring and sparks
    this.createBlastRing(ball.x, ball.y, ball.glowColor, shockRadius, 14);
  }

  /**
   * Resolve collision between a Ball and the Player's Chamber Box
   * Uses solid thickened slab AABBs (Circle vs AABB) in box local coordinate space.
   * Completely eliminates tunneling during high-velocity bursts.
   */
  public resolveBoxCollision(ball: Ball) {
    const box = this.playerBox;
    const cos = Math.cos(-box.tilt);
    const sin = Math.sin(-box.tilt);
    const cosInv = Math.cos(box.tilt);
    const sinInv = Math.sin(box.tilt);

    // Transform ball position to box local space (center is 0, 0)
    const relX = ball.x - box.x;
    const relY = ball.y - box.y;
    let localX = relX * cos - relY * sin;
    let localY = relX * sin + relY * cos;

    const halfW = box.width / 2;
    const halfH = box.height / 2;
    const t = box.wallThickness; // 26px reinforced armor walls

    let collidedAny = false;

    // 1. Left Wall Slab: [-halfW - t, -halfW] x [-halfH, halfH - t]
    const leftRes = this.testSlabCollision(
      ball, localX, localY,
      -halfW - t, -halfW, -halfH, halfH - t,
      cosInv, sinInv, box.vx
    );
    if (leftRes.collided) {
      localX = leftRes.localX;
      localY = leftRes.localY;
      collidedAny = true;
    }

    // 2. Right Wall Slab: [halfW, halfW + t] x [-halfH, halfH - t]
    const rightRes = this.testSlabCollision(
      ball, localX, localY,
      halfW, halfW + t, -halfH, halfH - t,
      cosInv, sinInv, box.vx
    );
    if (rightRes.collided) {
      localX = rightRes.localX;
      localY = rightRes.localY;
      collidedAny = true;
    }

    // 3. Bottom Floor Slab: [-halfW - t, halfW + t] x [halfH - t, halfH]
    const floorRes = this.testSlabCollision(
      ball, localX, localY,
      -halfW - t, halfW + t, halfH - t, halfH,
      cosInv, sinInv, box.vx
    );
    if (floorRes.collided) {
      localX = floorRes.localX;
      localY = floorRes.localY;
      collidedAny = true;
    }

    if (collidedAny) {
      // Transform corrected local position back to world coordinates
      ball.x = box.x + (localX * cosInv - localY * sinInv);
      ball.y = box.y + (localX * sinInv + localY * cosInv);
    }
  }

  /**
   * Circle vs AABB (solid slab) with deep penetration ejection and rounded corner deflections
   */
  private testSlabCollision(
    ball: Ball,
    localX: number,
    localY: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    cosInv: number,
    sinInv: number,
    boxVx: number
  ): { localX: number; localY: number; collided: boolean } {
    const r = ball.radius;

    // A. Center is INSIDE the solid slab (deep penetration recovery)
    if (localX >= minX && localX <= maxX && localY >= minY && localY <= maxY) {
      const dLeft = localX - minX;
      const dRight = maxX - localX;
      const dTop = localY - minY;
      const dBottom = maxY - localY;
      const minD = Math.min(dLeft, dRight, dTop, dBottom);

      let nx = 0;
      let ny = 0;
      let depth = 0;

      if (minD === dLeft) {
        nx = -1; ny = 0; depth = dLeft + r;
      } else if (minD === dRight) {
        nx = 1; ny = 0; depth = dRight + r;
      } else if (minD === dTop) {
        nx = 0; ny = -1; depth = dTop + r;
      } else {
        nx = 0; ny = 1; depth = dBottom + r;
      }

      localX += nx * depth;
      localY += ny * depth;

      this.applyWallBounce(ball, nx, ny, cosInv, sinInv, boxVx);
      return { localX, localY, collided: true };
    }

    // B. Center is outside slab: closest point on AABB
    const qx = Math.max(minX, Math.min(maxX, localX));
    const qy = Math.max(minY, Math.min(maxY, localY));
    const dx = localX - qx;
    const dy = localY - qy;
    const distSq = dx * dx + dy * dy;

    if (distSq < r * r) {
      const dist = Math.sqrt(distSq);
      const depth = r - dist;
      let nx = 0;
      let ny = -1;
      if (dist > 0.0001) {
        nx = dx / dist;
        ny = dy / dist;
      }

      localX += nx * depth;
      localY += ny * depth;

      this.applyWallBounce(ball, nx, ny, cosInv, sinInv, boxVx);
      return { localX, localY, collided: true };
    }

    return { localX, localY, collided: false };
  }

  /**
   * Apply realistic impulse reflection with restitution and surface friction
   */
  private applyWallBounce(
    ball: Ball,
    nx: number,
    ny: number,
    cosInv: number,
    sinInv: number,
    boxVx: number
  ) {
    // Relative velocity of ball with respect to moving box
    const relVx = ball.vx - boxVx;
    const relVy = ball.vy;

    // Transform relative velocity to box local coordinate frame
    // (forward rotation by -tilt)
    const localVx = relVx * cosInv + relVy * sinInv;
    const localVy = -relVx * sinInv + relVy * cosInv;

    const dot = localVx * nx + localVy * ny;
    if (dot < 0) {
      const rest = ball.restitution;
      const normVx = dot * nx;
      const normVy = dot * ny;
      const tangVx = localVx - normVx;
      const tangVy = localVy - normVy;

      // Restitution on normal, friction on tangential
      const newLocalVx = tangVx * 0.95 - normVx * rest;
      const newLocalVy = tangVy * 0.95 - normVy * rest;

      // Transform velocity back to world space and add box horizontal momentum
      ball.vx = (newLocalVx * cosInv - newLocalVy * sinInv) + boxVx * 0.45;
      ball.vy = (newLocalVx * sinInv + newLocalVy * cosInv);

      soundEngine.playBounce(Math.abs(dot));
      if (Math.abs(dot) > 160) {
        this.createSparks(ball.x, ball.y, '#38bdf8', 4, 120);
      }
    }
  }

  /**
   * Check if a ball enters any of the aerial Score Circles
   * CRITICAL REQUIREMENT: "天井から落ちる玉には反応せず、下からくる玉にのみ反応させてください。"
   */
  public checkScoreHoleAbsorption(ball: Ball) {
    if (ball.isScoring) return;

    // ONLY react to balls coming from below with upward velocity!
    // Falling balls (vy >= -10) from the ceiling or falling after peak will NOT trigger absorption.
    if (ball.vy >= -15) return;

    for (const hole of this.scoreHoles) {
      if (hole.respawnTimer > 0) continue;

      const dx = ball.x - hole.x;
      const dy = ball.y - hole.y;
      const dist = Math.hypot(dx, dy);

      // Must be within absorption range AND entering from below (dy >= -hole.radius * 0.4)
      if (dist < (hole.radius * 0.95 + ball.radius * 0.5) && dy >= -hole.radius * 0.4) {
        // Trigger Score!
        ball.isScoring = true;
        ball.scoreProgress = 0;

        // Calculate points
        let typeMultiplier = 1.0;
        if (ball.type === 'heavy') typeMultiplier = 3.0;
        else if (ball.type === 'volatile') typeMultiplier = 1.5;
        else if (ball.type === 'prism') typeMultiplier = 2.0;

        const basePoints = Math.round(hole.points * typeMultiplier);
        const earned = basePoints * this.stats.combo;

        this.stats.score += earned;
        this.saveHighScore();
        this.stats.ballsScored++;

        // Combo progression
        this.comboTimer = 2.4;
        this.stats.combo++;
        if (this.stats.combo > this.stats.maxCombo) {
          this.stats.maxCombo = this.stats.combo;
        }

        // Check Fever trigger at combo >= 6
        if (this.stats.combo >= 6 && !this.stats.feverMode) {
          this.stats.feverMode = true;
          this.stats.feverTimeRemaining = 8.0;
          this.addFloatingText('FEVER MODE!', hole.x, hole.y - 45, '#f59e0b', 1.4);
          this.createBlastRing(hole.x, hole.y, '#f59e0b', 110, 20);
        }

        // Sound & Floating Text
        soundEngine.playScore(this.stats.combo, this.stats.feverMode);

        const comboText = this.stats.combo > 2 ? `+${earned} x${this.stats.combo} (${hole.name})` : `+${earned} (${hole.name})`;
        this.addFloatingText(comboText, hole.x, hole.y - 20, hole.glowColor, 1.25);

        // Visual hole feedback
        this.createBlastRing(hole.x, hole.y, hole.glowColor, 75, 14);
        this.hitStopTimer = 0.035; // micro hitstop
        this.cameraShake = Math.min(10, this.cameraShake + 3);

        // Relocate this hole to a new random mid-air position!
        const otherHoles = this.scoreHoles.filter(h => h.id !== hole.id);
        const newPos = this.generateHolePosition(otherHoles, hole.radius);
        hole.baseX = newPos.x;
        hole.baseY = newPos.y;
        hole.x = newPos.x;
        hole.y = newPos.y;
        hole.respawnTimer = 0.25; // brief warp in
        this.createBlastRing(hole.x, hole.y, hole.glowColor, 40, 8);
        break;
      }
    }
  }

  /**
   * Launch bumper / piston to fling balls from the box upward
   */
  public triggerBoxLaunch() {
    const box = this.playerBox;
    let launched = 0;
    for (const ball of this.balls) {
      if (ball.isScoring) continue;
      const inBoxX = Math.abs(ball.x - box.x) < box.width * 0.52;
      const inBoxY = Math.abs(ball.y - box.y) < box.height * 0.65;
      if (inBoxX && inBoxY) {
        ball.vy = -620 - Math.random() * 80;
        ball.vx += (Math.random() - 0.5) * 140 + box.tilt * 320;
        ball.flashTimer = 0.15;
        launched++;
      }
    }
    if (launched > 0) {
      soundEngine.playBounce(380);
      this.createSparks(box.x, box.y + box.height * 0.3, '#38bdf8', 12, 160);
    }
  }

  /**
   * Freeze/stop all ball explosions simultaneously with a ~10-second recharge
   */
  public triggerBurstFreeze(): boolean {
    if (this.stats.freezeCooldown > 0 || this.isGameOver) return false;

    this.stats.freezeCooldown = this.stats.freezeMaxCooldown; // 10.0s cooldown
    this.stats.isFreezeActive = true;
    this.stats.freezeTimeRemaining = 3.5; // active 3.5s

    // Freeze and stabilize all balls
    for (const ball of this.balls) {
      if (ball.isScoring) continue;
      ball.timer = ball.cycleDuration; // reset timer to full 3.0s
      ball.flashTimer = 0;
      ball.vx *= 0.45;
      ball.vy *= 0.45;
    }

    soundEngine.playFreeze();
    this.addFloatingText('BURST FREEZE! (爆発停止)', this.config.width / 2, this.config.height * 0.45, '#38bdf8', 1.4);
    this.createBlastRing(this.config.width / 2, this.config.height * 0.5, '#38bdf8', 140, 24);
    this.cameraShake = Math.min(10, this.cameraShake + 4);
    return true;
  }

  /**
   * Elastic circle-circle collision
   */
  public resolveBallCollisions() {
    const len = this.balls.length;
    for (let i = 0; i < len; i++) {
      const b1 = this.balls[i];
      if (b1.isScoring) continue;

      for (let j = i + 1; j < len; j++) {
        const b2 = this.balls[j];
        if (b2.isScoring) continue;

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = b1.radius + b2.radius;

        if (dist < minDist && dist > 0.001) {
          // De-penetration
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          const totalMass = b1.mass + b2.mass;
          const m1Ratio = b2.mass / totalMass;
          const m2Ratio = b1.mass / totalMass;

          b1.x -= nx * overlap * m1Ratio;
          b1.y -= ny * overlap * m1Ratio;
          b2.x += nx * overlap * m2Ratio;
          b2.y += ny * overlap * m2Ratio;

          // Relative velocity along normal
          const kx = b1.vx - b2.vx;
          const ky = b1.vy - b2.vy;
          const p = 2 * (nx * kx + ny * ky) / totalMass;

          if (nx * kx + ny * ky > 0) {
            const restitution = (b1.restitution + b2.restitution) * 0.5;
            b1.vx -= p * b2.mass * nx * (1 + restitution) * 0.5;
            b1.vy -= p * b2.mass * ny * (1 + restitution) * 0.5;
            b2.vx += p * b1.mass * nx * (1 + restitution) * 0.5;
            b2.vy += p * b1.mass * ny * (1 + restitution) * 0.5;

            const impactSpeed = Math.abs(nx * kx + ny * ky);
            if (impactSpeed > 150) {
              soundEngine.playBounce(impactSpeed);
            }
          }
        }
      }
    }
  }

  /**
   * Called when a ball spills outside the chamber and drops off-screen
   */
  private onBallDropped(ball: Ball) {
    this.stats.lives = Math.max(0, this.stats.lives - 1);
    this.stats.totalLifeLost++;
    this.damageFlashTimer = 0.45;
    this.cameraShake = Math.min(20, this.cameraShake + 10);

    soundEngine.playLifeLost();
    this.addFloatingText('-1 LIFE!', ball.x, this.config.height - 40, '#ef4444', 1.4);
    this.createBlastRing(ball.x, this.config.height - 15, '#ef4444', 75, 16);
    this.createSparks(ball.x, this.config.height - 10, '#f87171', 12, 140);

    // If all lives are lost, trigger GAME OVER!
    if (this.stats.lives <= 0) {
      this.triggerGameOver('LIVES_DEPLETED');
    }
  }

  public triggerGameOver(reason: 'LIVES_DEPLETED' | 'CEILING_OVERFLOW' = 'CEILING_OVERFLOW') {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.stats.gameOverReason = reason;
    soundEngine.playGameOver();
    this.saveHighScore();
    this.cameraShake = 24;

    if (reason === 'CEILING_OVERFLOW') {
      // Huge blast along the danger ceiling line
      for (let x = 40; x < this.config.width - 40; x += 50) {
        this.createBlastRing(x, this.config.dangerCeilingY, '#ef4444', 70, 10);
      }
    } else {
      // Huge blast along bottom screen void (lost all lives)
      for (let x = 40; x < this.config.width - 40; x += 50) {
        this.createBlastRing(x, this.config.height - 20, '#ef4444', 70, 10);
      }
    }
  }
}
