// ==========================================
// 1. INITIALIZATION & SYSTEM STATE
// ==========================================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let currentLevel = 0;
let score = 0;
let lives = 3;
let timer = 90;
let timerInterval = null;
let musicEnabled = false;
let audioCtx = null;
let bgmInterval = null;
let bgmStep = 0;

// Level Config (Puzzle Sudoku 4x4 Valid & Tested)
const levels = [
  {
    name: "Level 1: Pemula",
    initial: [
      [1, 0, 0, 4],
      [0, 4, 1, 0],
      [0, 1, 4, 0],
      [4, 0, 0, 1]
    ],
    solution: [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1]
    ],
    timeLimit: 90
  },
  {
    name: "Level 2: Menengah",
    initial: [
      [2, 0, 0, 0],
      [0, 1, 0, 3],
      [1, 0, 3, 0],
      [0, 0, 0, 4]
    ],
    solution: [
      [2, 3, 4, 1],
      [4, 1, 2, 3],
      [1, 4, 3, 2],
      [3, 2, 1, 4]
    ],
    timeLimit: 75
  },
  {
    name: "Level 3: Tantangan",
    initial: [
      [0, 4, 0, 0],
      [1, 0, 0, 4],
      [0, 0, 2, 0],
      [2, 0, 0, 3]
    ],
    solution: [
      [3, 4, 1, 2],
      [1, 2, 3, 4],
      [4, 3, 2, 1],
      [2, 1, 4, 3]
    ],
    timeLimit: 60
  }
];

let currentGrid = [];
let selectedCell = { r: 0, c: 0 };

// Character & Enemy Entities
const player = { r: 0, c: 0, pulse: 0 };
const enemy = { r: 0, c: 3, pathIndex: 0 };
const enemyPath = [
  {r:0, c:3}, {r:1, c:3}, {r:2, c:3}, {r:3, c:3},
  {r:3, c:2}, {r:3, c:1}, {r:3, c:0}, {r:2, c:0},
  {r:1, c:0}, {r:0, c:0}, {r:0, c:1}, {r:0, c:2}
];

let particles = [];

// ==========================================
// 2. AUDIO SYNTHESIZER
// ==========================================
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.1) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

function playSFX(name) {
  initAudio();
  if (name === 'select') playTone(440, 'sine', 0.08, 0.1);
  else if (name === 'correct') {
    playTone(523.25, 'triangle', 0.15, 0.15);
    setTimeout(() => playTone(659.25, 'triangle', 0.2, 0.15), 80);
  } else if (name === 'wrong') {
    playTone(150, 'sawtooth', 0.25, 0.2);
  } else if (name === 'win') {
    playTone(523.25, 'sine', 0.1, 0.2);
    setTimeout(() => playTone(659.25, 'sine', 0.1, 0.2), 100);
    setTimeout(() => playTone(783.99, 'sine', 0.1, 0.2), 200);
    setTimeout(() => playTone(1046.50, 'sine', 0.3, 0.2), 300);
  }
}

function startBGM() {
  if (bgmInterval) clearInterval(bgmInterval);
  const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
  bgmInterval = setInterval(() => {
    if (musicEnabled && audioCtx) {
      playTone(notes[bgmStep % notes.length], 'sine', 0.15, 0.03);
      bgmStep++;
    }
  }, 250);
}

function toggleMusic() {
  initAudio();
  musicEnabled = !musicEnabled;
  const btn = document.getElementById("musicBtn");
  btn.innerText = musicEnabled ? "🎵 Musik: On" : "🎵 Musik: Off";
  if (musicEnabled) startBGM();
  else if (bgmInterval) clearInterval(bgmInterval);
}

// ==========================================
// 3. GAME LOGIC & OBSTACLES
// ==========================================
function initLevel(lvlIdx) {
  if (lvlIdx >= levels.length) {
    playSFX('win');
    alert("🎉 Selamat! Kamu berhasil memenangkan seluruh level Sudoku Mini!");
    currentLevel = 0;
    score = 0;
  }

  const lvl = levels[currentLevel];
  currentGrid = JSON.parse(JSON.stringify(lvl.initial));
  timer = lvl.timeLimit;
  lives = 3;
  selectedCell = { r: 0, c: 0 };
  player.r = 0; player.c = 0;
  enemy.pathIndex = 0;

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (timer > 0) {
      timer--;
      if (timer % 2 === 0) {
        enemy.pathIndex = (enemy.pathIndex + 1) % enemyPath.length;
        enemy.r = enemyPath[enemy.pathIndex].r;
        enemy.c = enemyPath[enemy.pathIndex].c;
      }
    } else {
      playSFX('wrong');
      alert("⏰ Waktu Habis! Level diulang.");
      initLevel(currentLevel);
    }
  }, 1000);
}

function selectCell(r, c) {
  selectedCell = { r, c };
  player.r = r;
  player.c = c;
  playSFX('select');
}

function inputNumber(num) {
  const lvl = levels[currentLevel];
  if (lvl.initial[selectedCell.r][selectedCell.c] !== 0) return;

  // Interaksi Rintangan Musuh
  if (selectedCell.r === enemy.r && selectedCell.c === enemy.c) {
    playSFX('wrong');
    timer = Math.max(0, timer - 5);
    createParticles(selectedCell.r, selectedCell.c, "#e74c3c");
    return;
  }

  currentGrid[selectedCell.r][selectedCell.c] = num;

  if (num === lvl.solution[selectedCell.r][selectedCell.c]) {
    playSFX('correct');
    score += 100;
    createParticles(selectedCell.r, selectedCell.c, "#2ecc71");
    checkWin();
  } else {
    playSFX('wrong');
    lives--;
    score = Math.max(0, score - 30);
    createParticles(selectedCell.r, selectedCell.c, "#e74c3c");
    if (lives <= 0) {
      alert("💔 Kesempatan habis! Level diulang.");
      initLevel(currentLevel);
    }
  }
}

function checkWin() {
  const lvl = levels[currentLevel];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (currentGrid[r][c] !== lvl.solution[r][c]) return;
    }
  }

  playSFX('win');
  setTimeout(() => {
    score += timer * 10;
    alert(`🌟 Level Selesai! Bonus Waktu: +${timer * 10}`);
    currentLevel++;
    initLevel(currentLevel);
  }, 200);
}

function resetLevel() {
  initLevel(currentLevel);
}

function createParticles(r, c, color) {
  const offsetX = 40;
  const offsetY = 100;
  const cellSize = 100;
  const px = offsetX + c * cellSize + 50;
  const py = offsetY + r * cellSize + 50;

  for (let i = 0; i < 10; i++) {
    particles.push({
      x: px, y: py,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 1.0,
      color: color
    });
  }
}

// ==========================================
// 4. RENDERING ENGINE
// ==========================================
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background Layer
  const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgGrad.addColorStop(0, "#f8f5fc");
  bgGrad.addColorStop(1, "#ede4f7");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Logo Badge "SUDOKU MINI"
  ctx.fillStyle = "#5e35b1";
  ctx.beginPath();
  ctx.roundRect(20, 15, 180, 42, 10);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SUDOKU MINI", 110, 41);

  // HUD Text
  ctx.fillStyle = "#332940";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`Level: ${currentLevel + 1}`, canvas.width - 20, 25);
  ctx.fillText(`Skor: ${score}`, canvas.width - 20, 43);
  ctx.fillText(`Waktu: ${timer}s  ${"❤️".repeat(lives)}`, canvas.width - 20, 61);

  // Grid Sudoku Layer
  const offsetX = 40;
  const offsetY = 100;
  const cellSize = 100;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const x = offsetX + c * cellSize;
      const y = offsetY + r * cellSize;

      if (r === enemy.r && c === enemy.c) {
        ctx.fillStyle = "#fadbd8";
      } else if (selectedCell.r === r && selectedCell.c === c) {
        ctx.fillStyle = "#e1d0f7";
      } else {
        ctx.fillStyle = "#ffffff";
      }
      ctx.fillRect(x, y, cellSize, cellSize);

      ctx.strokeStyle = "#e0d6eb";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cellSize, cellSize);

      const val = currentGrid[r][c];
      if (val !== 0) {
        const isInitial = levels[currentLevel].initial[r][c] !== 0;
        ctx.fillStyle = isInitial ? "#221b2e" : "#7c4dff";
        ctx.font = isInitial ? "bold 34px sans-serif" : "34px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(val, x + 50, y + 50);
      }
    }
  }

  // Border Sub-grid 2x2
  ctx.strokeStyle = "#4a2c82";
  ctx.lineWidth = 3;
  ctx.strokeRect(offsetX, offsetY, cellSize * 4, cellSize * 4);
  ctx.beginPath();
  ctx.moveTo(offsetX + cellSize * 2, offsetY);
  ctx.lineTo(offsetX + cellSize * 2, offsetY + cellSize * 4);
  ctx.moveTo(offsetX, offsetY + cellSize * 2);
  ctx.lineTo(offsetX + cellSize * 4, offsetY + cellSize * 2);
  ctx.stroke();

  // Player Entity Cursor
  player.pulse += 0.08;
  const pX = offsetX + player.c * cellSize + 20;
  const pY = offsetY + player.r * cellSize + 20;
  ctx.fillStyle = "#7c4dff";
  ctx.beginPath();
  ctx.arc(pX, pY, 8 + Math.sin(player.pulse) * 2, 0, Math.PI * 2);
  ctx.fill();

  // Enemy Entity
  const eX = offsetX + enemy.c * cellSize + 80;
  const eY = offsetY + enemy.r * cellSize + 20;
  ctx.fillStyle = "#e74c3c";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("👾", eX, eY);

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.life -= 0.04;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  // Controls Layer (Numpad & Joystick)
  drawNumpad();
  drawJoystick();

  requestAnimationFrame(render);
}

function drawNumpad() {
  const startY = 525;
  const numbers = [1, 2, 3, 4];
  numbers.forEach((num, idx) => {
    const x = 35 + idx * 62;
    ctx.fillStyle = "#6d3bbd";
    ctx.beginPath();
    ctx.roundRect(x, startY, 52, 52, 10);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(num, x + 26, startY + 26);
  });
}

function drawJoystick() {
  const jx = 395;
  const jy = 551;

  ctx.fillStyle = "#dcd0f0";
  ctx.beginPath();
  ctx.arc(jx, jy, 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6d3bbd";
  ctx.beginPath();
  ctx.arc(jx, jy, 15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PAD", jx, jy);
}

// ==========================================
// 5. INPUT EVENTS
// ==========================================
canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  const offsetX = 40;
  const offsetY = 100;
  const cellSize = 100;

  if (x >= offsetX && x <= offsetX + cellSize * 4 && y >= offsetY && y <= offsetY + cellSize * 4) {
    const c = Math.floor((x - offsetX) / cellSize);
    const r = Math.floor((y - offsetY) / cellSize);
    selectCell(r, c);
  }

  if (y >= 525 && y <= 577) {
    [1, 2, 3, 4].forEach((num, idx) => {
      const btnX = 35 + idx * 62;
      if (x >= btnX && x <= btnX + 52) {
        inputNumber(num);
      }
    });
  }

  const jx = 395;
  const jy = 551;
  if (Math.hypot(x - jx, y - jy) <= 35) {
    const dx = x - jx;
    const dy = y - jy;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && selectedCell.c < 3) selectCell(selectedCell.r, selectedCell.c + 1);
      else if (dx < 0 && selectedCell.c > 0) selectCell(selectedCell.r, selectedCell.c - 1);
    } else {
      if (dy > 0 && selectedCell.r < 3) selectCell(selectedCell.r + 1, selectedCell.c);
      else if (dy < 0 && selectedCell.r > 0) selectCell(selectedCell.r - 1, selectedCell.c);
    }
  }
});

window.addEventListener("keydown", (e) => {
  if (["1", "2", "3", "4"].includes(e.key)) inputNumber(parseInt(e.key));
  else if (e.key === "ArrowUp" && selectedCell.r > 0) selectCell(selectedCell.r - 1, selectedCell.c);
  else if (e.key === "ArrowDown" && selectedCell.r < 3) selectCell(selectedCell.r + 1, selectedCell.c);
  else if (e.key === "ArrowLeft" && selectedCell.c > 0) selectCell(selectedCell.r, selectedCell.c - 1);
  else if (e.key === "ArrowRight" && selectedCell.c < 3) selectCell(selectedCell.r, selectedCell.c + 1);
});

// Run Game
initLevel(0);
render();
