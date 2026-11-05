import React, { useEffect, useRef, useCallback } from 'react';
import { PhysicsWorld } from './physics';
import { GameStats } from './types';

interface GameCanvasProps {
  physics: PhysicsWorld;
  isPaused: boolean;
  onStatsUpdate: (stats: GameStats) => void;
  onGameOver: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  physics,
  isPaused,
  onStatsUpdate,
  onGameOver,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Input states
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseStateRef = useRef<{ isDown: boolean; clientX: number; clientY: number }>({
    isDown: false,
    clientX: 0,
    clientY: 0,
  });

  // Handle Resize
  const handleResize = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvasRef.current.width = clientWidth * dpr;
    canvasRef.current.height = clientHeight * dpr;

    physics.resize(clientWidth, clientHeight);
  }, [physics]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Input event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!keysRef.current[e.code]) {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
          physics.triggerBoxLaunch();
        }
        if (e.code === 'Space') {
          physics.triggerBurstFreeze();
        }
      }
      keysRef.current[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const handleBlur = () => {
      keysRef.current = {};
      mouseStateRef.current.isDown = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Mouse & Touch Controls
  const handlePointerDown = (e: React.PointerEvent) => {
    mouseStateRef.current.isDown = true;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      mouseStateRef.current.clientX = e.clientX - rect.left;
      mouseStateRef.current.clientY = e.clientY - rect.top;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      mouseStateRef.current.clientX = e.clientX - rect.left;
      mouseStateRef.current.clientY = e.clientY - rect.top;
    }
  };

  const handlePointerUp = () => {
    mouseStateRef.current.isDown = false;
  };

  // Main 60fps Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let statsUpdateTimer = 0;

    const render = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.max(0, Math.min(rawDt, 0.05)); // clamp delta time to non-negative for stability

      if (!isPaused && !physics.isGameOver && dt > 0) {
        // 1. Process Inputs
        const keys = keysRef.current;
        const box = physics.playerBox;
        const moveSpeed = 580;
        let moveX = 0;

        if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

        // Mouse follower if mouse is held or hovering
        if (mouseStateRef.current.clientX > 0) {
          const targetX = mouseStateRef.current.clientX;
          const diffX = targetX - box.x;
          if (Math.abs(diffX) > 4) {
            box.x += Math.sign(diffX) * Math.min(Math.abs(diffX), moveSpeed * dt * 1.5);
          }
        }

        if (moveX !== 0) {
          box.x += moveX * moveSpeed * dt;
          box.vx = moveX * moveSpeed;
        } else {
          box.vx = 0;
        }

        // Clamp box within arena bounds
        const halfW = box.width / 2;
        box.x = Math.max(halfW + 10, Math.min(physics.config.width - halfW - 10, box.x));

        // Tilt controls (Q / E)
        let tiltTarget = 0;
        if (keys['KeyQ']) tiltTarget -= 0.32;
        if (keys['KeyE']) tiltTarget += 0.32;
        box.targetTilt = tiltTarget;

        // 2. Step Physics
        physics.update(dt);

        // Check game over
        if (physics.isGameOver) {
          onGameOver();
        }

        // Periodic stats dispatch to React HUD (every 60ms to avoid re-render choke)
        statsUpdateTimer += dt;
        if (statsUpdateTimer > 0.06) {
          statsUpdateTimer = 0;
          onStatsUpdate({ ...physics.stats });
        }
      }

      // 3. Render Canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawScene(ctx, physics, canvas.width, canvas.height);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [physics, isPaused, onStatsUpdate, onGameOver]);

  /**
   * High performance Canvas drawing routine
   */
  const drawScene = (
    ctx: CanvasRenderingContext2D,
    world: PhysicsWorld,
    pixelW: number,
    pixelH: number
  ) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = world.config.width;
    const height = world.config.height;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Apply Camera Shake
    let shakeX = 0;
    let shakeY = 0;
    if (world.cameraShake > 0) {
      shakeX = (Math.random() - 0.5) * world.cameraShake;
      shakeY = (Math.random() - 0.5) * world.cameraShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Clear & Background Gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0a0d1d');
    bgGradient.addColorStop(0.5, '#070914');
    bgGradient.addColorStop(1, '#05070e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle arena grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Bottom Out-of-Bounds drop loss hazard line
    ctx.save();
    const isCritical = world.stats.lives <= 1;
    ctx.strokeStyle = isCritical ? 'rgba(239, 68, 68, 0.65)' : 'rgba(244, 63, 94, 0.28)';
    ctx.lineWidth = isCritical ? 2.5 : 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, height - 4);
    ctx.lineTo(width, height - 4);
    ctx.stroke();
    ctx.restore();

    // Red Damage Flash when life is lost
    if (world.damageFlashTimer > 0) {
      ctx.save();
      const flashAlpha = Math.min(0.4, world.damageFlashTimer * 0.9);
      ctx.fillStyle = `rgba(239, 68, 68, ${flashAlpha})`;
      ctx.fillRect(0, 0, width, height);

      // Intense bottom red glow
      const botGlow = ctx.createLinearGradient(0, height - 90, 0, height);
      botGlow.addColorStop(0, 'rgba(239, 68, 68, 0)');
      botGlow.addColorStop(1, `rgba(239, 68, 68, ${flashAlpha * 1.8})`);
      ctx.fillStyle = botGlow;
      ctx.fillRect(0, height - 90, width, 90);
      ctx.restore();
    }

    // 2. CEILING DANGER ZONE & WARNING LASER SETUP
    const dangerY = world.config.dangerCeilingY;
    const danger = world.stats.dangerLevel;

    // Freeze Active Frosted Aura & Status
    if (world.stats.isFreezeActive) {
      ctx.save();
      const freezeGrad = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, width * 0.85);
      freezeGrad.addColorStop(0, 'rgba(56, 189, 248, 0.03)');
      freezeGrad.addColorStop(0.7, 'rgba(14, 165, 233, 0.12)');
      freezeGrad.addColorStop(1, 'rgba(2, 132, 199, 0.22)');
      ctx.fillStyle = freezeGrad;
      ctx.fillRect(0, 0, width, height);

      // Top Freeze banner
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#7dd3fc';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 8;
      ctx.fillText(`❄ BURST FREEZE ACTIVE (${world.stats.freezeTimeRemaining.toFixed(1)}s) ❄`, width / 2, dangerY + 28);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Danger Zone background glow when active
    if (danger > 0.05) {
      const dangerGradient = ctx.createLinearGradient(0, 0, 0, dangerY);
      dangerGradient.addColorStop(0, `rgba(239, 68, 68, ${0.15 + danger * 0.35})`);
      dangerGradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
      ctx.fillStyle = dangerGradient;
      ctx.fillRect(0, 0, width, dangerY);
    }

    // Danger Ceiling Line (laser wire)
    ctx.save();
    const laserAlpha = 0.4 + danger * 0.6;
    ctx.strokeStyle = danger > 0.4 ? `rgba(239, 68, 68, ${laserAlpha})` : `rgba(245, 158, 11, ${laserAlpha})`;
    ctx.lineWidth = 2 + danger * 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, dangerY);
    ctx.lineTo(width, dangerY);
    ctx.stroke();
    ctx.restore();

    // Laser emitter brackets on walls
    ctx.fillStyle = danger > 0.4 ? '#ef4444' : '#f59e0b';
    ctx.fillRect(0, dangerY - 6, 10, 12);
    ctx.fillRect(width - 10, dangerY - 6, 10, 12);

    // Danger Warning Text if danger > 0.35
    if (danger > 0.35) {
      ctx.save();
      ctx.font = 'bold 12px "Outfit", sans-serif';
      ctx.fillStyle = `rgba(239, 68, 68, ${0.7 + Math.sin(Date.now() * 0.015) * 0.3})`;
      ctx.textAlign = 'center';
      ctx.fillText(
        `⚠ OVERFLOW WARNING ⚠ (${Math.round(danger * 100)}%)`,
        width / 2,
        dangerY - 12
      );
      ctx.restore();
    }

    // 3. TOP DROPPER & CONVEYOR NOZZLE
    const spawnerX = width / 2;
    ctx.save();
    // Dropper guide rail
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(spawnerX - 45, 12, 90, 8);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(spawnerX - 18, 18, 36, 12);

    // Next drop progress arc
    const dropProgress = 1 - (world.stats.nextDropTimer / 3.2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(spawnerX, 24, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, dropProgress)));
    ctx.stroke();
    ctx.restore();

    // 4. AERIAL SCORE HOLES (Floating in mid-air!)
    for (const hole of world.scoreHoles) {
      ctx.save();
      ctx.translate(hole.x, hole.y);

      // Respawn warp scale
      let scale = 1.0;
      if (hole.respawnTimer > 0) {
        scale = Math.max(0.2, 1 - hole.respawnTimer * 3.5);
      }
      ctx.scale(scale, scale);

      const safePulseSize = Math.max(1, hole.radius + Math.sin(hole.pulsePhase) * 2.5);

      // Semi-translucent aura field
      const auraGrad = ctx.createRadialGradient(0, 0, safePulseSize * 0.3, 0, 0, safePulseSize * 1.4);
      auraGrad.addColorStop(0, `${hole.glowColor}30`);
      auraGrad.addColorStop(0.65, `${hole.glowColor}10`);
      auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, safePulseSize * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Hole interior vortex
      const holeGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, safePulseSize);
      holeGrad.addColorStop(0, '#030712');
      holeGrad.addColorStop(0.55, '#0f172a');
      holeGrad.addColorStop(1, `${hole.glowColor}40`);
      ctx.fillStyle = holeGrad;
      ctx.beginPath();
      ctx.arc(0, 0, safePulseSize, 0, Math.PI * 2);
      ctx.fill();

      // Bottom Entrance Aperture (Bright glowing arc where upward balls enter!)
      ctx.strokeStyle = hole.glowColor;
      ctx.lineWidth = 3.2;
      ctx.shadowColor = hole.glowColor;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, safePulseSize, -0.15 * Math.PI, 1.15 * Math.PI);
      ctx.stroke();

      // Top rim (Translucent dashed arc indicating falling balls pass through)
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, safePulseSize, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);

      // Upward Entry Chevrons (▲ pointing up: "下から打ち上げろ！")
      const chevronCycle = (Date.now() * 0.0035 + hole.id * 0.3) % 1;
      const chevronY = 12 - chevronCycle * 22;
      ctx.fillStyle = hole.glowColor;
      ctx.beginPath();
      ctx.moveTo(0, chevronY - 8);
      ctx.lineTo(6, chevronY + 2);
      ctx.lineTo(2.5, chevronY + 2);
      ctx.lineTo(2.5, chevronY + 8);
      ctx.lineTo(-2.5, chevronY + 8);
      ctx.lineTo(-2.5, chevronY + 2);
      ctx.lineTo(-6, chevronY + 2);
      ctx.closePath();
      ctx.fill();

      // Label & Points
      ctx.font = `bold ${hole.type === 'core' ? 10 : 8}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(`${hole.name} ${hole.points}pt`, 0, -safePulseSize * 0.42);
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    // 5. PLAYER BOX ("陣地" / CHAMBER VESSEL)
    const box = world.playerBox;
    ctx.save();
    ctx.translate(box.x, box.y);
    ctx.rotate(box.tilt);

    const halfW = box.width / 2;
    const halfH = box.height / 2;
    const t = box.wallThickness;

    // Upward Kinetic Launch Piston / Bumper on Floor
    const bumperH = 12;
    const bumperGrad = ctx.createLinearGradient(0, halfH - t - bumperH, 0, halfH - t);
    bumperGrad.addColorStop(0, '#0284c7');
    bumperGrad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = bumperGrad;
    ctx.fillRect(-halfW + 8, halfH - t - bumperH, (halfW - 8) * 2, bumperH);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-halfW + 8, halfH - t - bumperH, (halfW - 8) * 2, bumperH);

    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#e0f2fe';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▲ KINETIC LAUNCH PISTON [W / ↑] ▲', 0, halfH - t - bumperH * 0.5);

    // Reinforced Fortified Walls & Floor (26px solid armor)
    ctx.shadowColor = world.stats.isFreezeActive ? '#38bdf8' : '#0284c7';
    ctx.shadowBlur = world.stats.isFreezeActive ? 14 : 8;

    // Floor slab
    const floorGrad = ctx.createLinearGradient(0, halfH - t, 0, halfH);
    floorGrad.addColorStop(0, '#1e293b');
    floorGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(-halfW - t, halfH - t, (halfW + t) * 2, t);

    // Left Wall slab
    const wallGradL = ctx.createLinearGradient(-halfW - t, 0, -halfW, 0);
    wallGradL.addColorStop(0, '#0f172a');
    wallGradL.addColorStop(1, '#1e293b');
    ctx.fillStyle = wallGradL;
    ctx.fillRect(-halfW - t, -halfH, t, halfH * 2 - t);

    // Right Wall slab
    const wallGradR = ctx.createLinearGradient(halfW, 0, halfW + t, 0);
    wallGradR.addColorStop(0, '#1e293b');
    wallGradR.addColorStop(1, '#0f172a');
    ctx.fillStyle = wallGradR;
    ctx.fillRect(halfW, -halfH, t, halfH * 2 - t);

    // Outer Armor Ribs for heavy fortified sci-fi look
    ctx.fillStyle = '#334155';
    for (let ribY = -halfH + 18; ribY < halfH - t - 8; ribY += 22) {
      ctx.fillRect(-halfW - t + 3, ribY, t - 6, 6);
      ctx.fillRect(halfW + 3, ribY, t - 6, 6);
    }

    // Reinforced Neon Rim Caps on Top Opening
    const rimAccent = world.stats.isFreezeActive ? '#38bdf8' : '#0ea5e9';
    ctx.fillStyle = rimAccent;
    ctx.fillRect(-halfW - t, -halfH, t, 5);
    ctx.fillRect(halfW, -halfH, t, 5);

    // U-shaped Silhouette Contour (Accurate solid chamber boundaries, open top)
    ctx.shadowBlur = world.stats.isFreezeActive ? 12 : 4;
    ctx.strokeStyle = world.stats.isFreezeActive ? '#7dd3fc' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Top-left rim
    ctx.moveTo(-halfW, -halfH);
    ctx.lineTo(-halfW - t, -halfH);
    ctx.lineTo(-halfW - t, halfH);
    ctx.lineTo(halfW + t, halfH);
    ctx.lineTo(halfW + t, -halfH);
    ctx.lineTo(halfW, -halfH);
    // Inner contour down and across
    ctx.lineTo(halfW, halfH - t);
    ctx.lineTo(-halfW, halfH - t);
    ctx.closePath();
    ctx.stroke();

    ctx.restore(); // restore box transform

    // 5. BALL TRAILS
    for (const ball of world.balls) {
      if (ball.trail.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(ball.trail[0].x, ball.trail[0].y);
        for (let i = 1; i < ball.trail.length; i++) {
          ctx.lineTo(ball.trail[i].x, ball.trail[i].y);
        }
        ctx.strokeStyle = ball.glowColor;
        ctx.lineWidth = ball.radius * 0.8;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.25;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. BALLS ("3秒爆発玉")
    for (const ball of world.balls) {
      ctx.save();
      ctx.translate(ball.x, ball.y);

      // Warning violent shake in final 0.6s
      if (ball.timer <= 0.6 && !ball.isScoring) {
        const shakeMag = (0.6 - ball.timer) * 9;
        ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
      }

      // Hit/flash or charge flash
      const isFlashing = ball.flashTimer > 0;

      // Outer Countdown Dial (3.0s down to 0.0s)
      const safeRadius = Math.max(1, ball.radius);
      const cycleProgress = Math.max(0, ball.timer / ball.cycleDuration);
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + Math.PI * 2 * cycleProgress;

      ctx.beginPath();
      ctx.arc(0, 0, safeRadius + 4, startAngle, endAngle);
      ctx.strokeStyle = world.stats.isFreezeActive ? '#38bdf8' : ball.timer < 0.8 ? '#ef4444' : ball.glowColor;
      ctx.lineWidth = world.stats.isFreezeActive ? 3 : ball.timer < 0.8 ? 3.5 : 2;
      ctx.stroke();

      // Ball Body Gradient
      const bodyGrad = ctx.createRadialGradient(
        -safeRadius * 0.3,
        -safeRadius * 0.3,
        Math.max(0.1, safeRadius * 0.1),
        0,
        0,
        safeRadius
      );

      if (world.stats.isFreezeActive) {
        bodyGrad.addColorStop(0, '#ffffff');
        bodyGrad.addColorStop(0.3, '#38bdf8');
        bodyGrad.addColorStop(1, '#0c4a6e');
      } else if (isFlashing) {
        bodyGrad.addColorStop(0, '#ffffff');
        bodyGrad.addColorStop(1, '#fed7aa');
      } else {
        bodyGrad.addColorStop(0, '#ffffff');
        bodyGrad.addColorStop(0.3, ball.color);
        bodyGrad.addColorStop(1, '#090d1a');
      }

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(0, 0, safeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Inner Core Ring
      ctx.strokeStyle = world.stats.isFreezeActive ? '#bae6fd' : ball.timer < 0.8 ? '#ffffff' : ball.glowColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Numeric Countdown in center of ball
      if (!ball.isScoring) {
        ctx.font = `bold ${Math.round(safeRadius * 0.72)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = world.stats.isFreezeActive ? '#e0f2fe' : ball.timer < 0.8 ? '#ef4444' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        const textVal = world.stats.isFreezeActive ? '❄ 3.0' : ball.timer.toFixed(1);
        ctx.fillText(textVal, 0, 1);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    }

    // 7. PARTICLES
    for (const p of world.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.type === 'ring' && p.radius !== undefined) {
        const ringRadius = Math.max(0.1, p.radius);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const particleSize = Math.max(0.1, p.size);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, particleSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 8. FLOATING TEXTS
    for (const ft of world.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `bold ${Math.round(18 * ft.scale)}px "Outfit", sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore(); // restore root dpr transform
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <canvas ref={canvasRef} className="block w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
