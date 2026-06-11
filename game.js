const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ── AUDIO ──────────────────────────────────────────────────────
let ac;
function getAC() { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); return ac; }

function beep(freq, type, dur, vol=0.3) {
  const a = getAC(), o = a.createOscillator(), g = a.createGain();
  o.connect(g); g.connect(a.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.start(); o.stop(a.currentTime + dur);
}

function playFlap()  { beep(520, 'sine', 0.08, 0.2); }
function playScore() {
  [784, 1047].forEach((f,i) => setTimeout(() => beep(f,'sine',0.12,0.25), i*100));
}
function playDie() {
  [300,220,160,100].forEach((f,i) => setTimeout(() => beep(f,'sawtooth',0.1,0.3), i*90));
}
function playStart() {
  [392,494,587,784].forEach((f,i) => setTimeout(() => beep(f,'triangle',0.12,0.2), i*100));
}
function playWin() {
  [523,659,784,880,1047].forEach((f,i) => setTimeout(() => beep(f,'sine',0.18,0.3), i*120));
}

// ── STATE ──────────────────────────────────────────────────────
let bird, pipes, score, bestScore=0, frame, raf, alive, started;
const GRAVITY=0.45, FLAP=-8.5, PIPE_W=60, GAP=150, PIPE_SPEED=2.8;

function startGame() {
  bird   = { x:90, y:H/2, vy:0, w:36, h:28, rot:0, frame:0, tick:0 };
  pipes  = [];
  score  = 0;
  frame  = 0;
  alive  = true;
  started= true;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('score-hud').textContent = 'Score: 0';
  playStart();
  if (raf) cancelAnimationFrame(raf);
  loop();
}

// ── INPUT ──────────────────────────────────────────────────────
function flap() {
  if (!alive) return;
  bird.vy = FLAP;
  playFlap();
}
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); }
});
canvas.addEventListener('click', flap);
canvas.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, {passive:false});

// ── PIPES ──────────────────────────────────────────────────────
function addPipe() {
  const minY = 80, maxY = H - 80 - GAP;
  const topH = Math.random() * (maxY - minY) + minY;
  pipes.push({ x: W + 10, topH });
}

// ── COLLISION ─────────────────────────────────────────────────
function rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh) {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

// ── DRAW HELPERS ─────────────────────────────────────────────
function drawSky() {
  // gradient sky
  const sky = ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,   '#1a1a2e');
  sky.addColorStop(0.5, '#0f3460');
  sky.addColorStop(1,   '#16213e');
  ctx.fillStyle = sky;
  ctx.fillRect(0,0,W,H);

  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  [[40,40],[120,80],[200,30],[300,60],[360,20],[80,150],[250,120],[330,170]].forEach(([x,y]) => {
    ctx.beginPath(); ctx.arc(x,y,1.2,0,Math.PI*2); ctx.fill();
  });

  // moon
  ctx.fillStyle = '#fffde7';
  ctx.shadowColor = '#fffde7'; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(340, 55, 22, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  // moon crater
  ctx.fillStyle = '#e8e0b0';
  ctx.beginPath(); ctx.arc(334, 50, 5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(348, 62, 3, 0, Math.PI*2); ctx.fill();

  // clouds
  drawCloud(50,  200, 0.5);
  drawCloud(260, 160, 0.4);
  drawCloud(150, 310, 0.35);
}

function drawCloud(x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#c8daf0';
  [[0,0,40,20],[30,-10,50,25],[-25,-5,35,18],[40,5,30,16]].forEach(([dx,dy,rw,rh]) => {
    ctx.beginPath();
    ctx.ellipse(x+dx, y+dy, rw, rh, 0, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.restore();
}

function drawPipe(px, topH) {
  const r = 8;
  // top pipe
  const tg = ctx.createLinearGradient(px,0,px+PIPE_W,0);
  tg.addColorStop(0,'#2d6a1f'); tg.addColorStop(0.5,'#4caf50'); tg.addColorStop(1,'#1b4a10');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.roundRect(px, 0, PIPE_W, topH - 10, [0,0,r,r]);
  ctx.fill();
  // top cap
  ctx.fillStyle = '#66bb6a';
  ctx.beginPath();
  ctx.roundRect(px - 6, topH - 30, PIPE_W + 12, 26, r);
  ctx.fill();
  // pipe shine
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(px + 8, 0, 10, topH - 10);

  // bottom pipe
  const botY = topH + GAP;
  const bg2 = ctx.createLinearGradient(px,0,px+PIPE_W,0);
  bg2.addColorStop(0,'#2d6a1f'); bg2.addColorStop(0.5,'#4caf50'); bg2.addColorStop(1,'#1b4a10');
  ctx.fillStyle = bg2;
  ctx.beginPath();
  ctx.roundRect(px, botY + 10, PIPE_W, H - botY - 10, [r,r,0,0]);
  ctx.fill();
  // bottom cap
  ctx.fillStyle = '#66bb6a';
  ctx.beginPath();
  ctx.roundRect(px - 6, botY, PIPE_W + 12, 26, r);
  ctx.fill();
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(px + 8, botY + 10, 10, H - botY - 10);
}

function drawBird() {
  const { x, y, w, h, rot } = bird;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  // body
  const bg = ctx.createRadialGradient(-4,-4,2, 0,0,18);
  bg.addColorStop(0,'#FFE066'); bg.addColorStop(1,'#FFC107');
  ctx.fillStyle = bg;
  ctx.shadowColor = 'rgba(255,193,7,0.5)'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.ellipse(0, 0, w/2, h/2, 0, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;

  // wing (flap animation)
  const wingY = Math.sin(bird.tick * 0.4) * 5;
  ctx.fillStyle = '#FF8F00';
  ctx.beginPath(); ctx.ellipse(-6, wingY, 10, 6, -0.4, 0, Math.PI*2); ctx.fill();

  // eye white
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(8, -5, 7, 0, Math.PI*2); ctx.fill();
  // pupil
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath(); ctx.arc(10, -5, 4, 0, Math.PI*2); ctx.fill();
  // eye shine
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(11, -7, 1.5, 0, Math.PI*2); ctx.fill();

  // beak
  ctx.fillStyle = '#FF6F00';
  ctx.beginPath();
  ctx.moveTo(14, -2); ctx.lineTo(22, 0); ctx.lineTo(14, 4); ctx.closePath(); ctx.fill();

  ctx.restore();
}

function drawGround() {
  // ground strip
  const grd = ctx.createLinearGradient(0, H-50, 0, H);
  grd.addColorStop(0, '#4caf50'); grd.addColorStop(0.3, '#388e3c'); grd.addColorStop(1, '#1b5e20');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.roundRect(0, H-50, W, 50, [8,8,0,0]); ctx.fill();
  // grass detail
  ctx.fillStyle = '#66bb6a';
  for (let i=0; i<W; i+=18) {
    ctx.beginPath();
    ctx.moveTo(i, H-50); ctx.lineTo(i+6, H-62); ctx.lineTo(i+12, H-50);
    ctx.fill();
  }
}

function drawScore() {
  ctx.fillStyle = 'white';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6;
  ctx.font = 'bold 42px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText(score, W/2, 80);
  ctx.shadowBlur = 0;
}

// ── MAIN LOOP ─────────────────────────────────────────────────
function loop() {
  frame++;
  ctx.clearRect(0,0,W,H);
  drawSky();

  // spawn pipes
  if (frame % 90 === 0) addPipe();

  // update & draw pipes
  pipes.forEach(p => {
    p.x -= PIPE_SPEED;
    drawPipe(p.x, p.topH);

    // score when bird passes pipe centre
    if (!p.scored && p.x + PIPE_W < bird.x) {
      p.scored = true;
      score++;
      document.getElementById('score-hud').textContent = 'Score: ' + score;
      playScore();
      if (score > bestScore) {
        bestScore = score;
        document.getElementById('best-hud').textContent = 'Best: ' + bestScore;
      }
    }

    // collision
    const margin = 4;
    if (
      rectsOverlap(bird.x - bird.w/2 + margin, bird.y - bird.h/2 + margin,
                   bird.w - margin*2, bird.h - margin*2,
                   p.x, 0, PIPE_W, p.topH) ||
      rectsOverlap(bird.x - bird.w/2 + margin, bird.y - bird.h/2 + margin,
                   bird.w - margin*2, bird.h - margin*2,
                   p.x, p.topH + GAP, PIPE_W, H - p.topH - GAP)
    ) {
      die();
    }
  });

  // remove off-screen pipes
  pipes = pipes.filter(p => p.x + PIPE_W > 0);

  // physics
  bird.vy += GRAVITY;
  bird.y  += bird.vy;
  bird.rot = Math.min(Math.max(bird.vy * 0.055, -0.5), 1.2);
  bird.tick++;

  // ground / ceiling collision
  if (bird.y + bird.h/2 >= H - 50 || bird.y - bird.h/2 <= 0) die();

  drawGround();
  drawBird();
  drawScore();

  if (alive) raf = requestAnimationFrame(loop);
}

function die() {
  if (!alive) return;
  alive = false;
  playDie();
  setTimeout(() => {
    const won = score >= 10;
    const medal = score >= 20 ? '🥇' : score >= 10 ? '🥈' : score >= 5 ? '🥉' : '';
    document.getElementById('medal').textContent = medal;
    document.getElementById('ov-title').textContent = won ? '🏆 Awesome!' : '💥 Game Over';
    document.getElementById('ov-msg').textContent  = `Score: ${score}  |  Best: ${bestScore}`;
    document.getElementById('ov-hint').textContent = won ? 'You scored 10+! Legend! 🎉' : 'Tap or Space to flap!';
    document.getElementById('ov-btn').textContent  = '▶ Play Again';
    if (won) playWin();
    document.getElementById('overlay').style.display = 'flex';
  }, 600);
}

// initial static draw
drawSky(); drawGround();
ctx.fillStyle='white'; ctx.font='bold 20px Segoe UI';
ctx.textAlign='center'; ctx.fillText('Press Start!', W/2, H/2);