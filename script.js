const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

const scoreElement = document.getElementById('score');
const linesElement = document.getElementById('lines');
const levelElement = document.getElementById('level');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const toggleSoundBtn = document.getElementById('toggle-sound-btn');

// --- 常數設定 ---
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const NEXT_BLOCK_SIZE = 30;

// 計算 Canvas 實際大小
ctx.canvas.width = COLS * BLOCK_SIZE;
ctx.canvas.height = ROWS * BLOCK_SIZE;
nextCtx.canvas.width = 4 * NEXT_BLOCK_SIZE;
nextCtx.canvas.height = 4 * NEXT_BLOCK_SIZE;

// --- 音效系統 (Web Audio API) ---
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!soundEnabled || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    switch (type) {
        case 'move':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
            break;
        case 'rotate':
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(600, now + 0.05);
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        case 'drop': // Hard drop
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        case 'clear':
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(800, now + 0.1);
            osc.frequency.setValueAtTime(1200, now + 0.2);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
        case 'gameover':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 1);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 1);
            osc.start(now);
            osc.stop(now + 1);
            break;
    }
}

toggleSoundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    toggleSoundBtn.textContent = soundEnabled ? '🔊 聲音: 開' : '🔇 聲音: 關';
    if (soundEnabled) initAudio();
});

// --- 方塊定義 ---
const COLORS = [
    null,
    '#0ea5e9', // I (Cyan)
    '#3b82f6', // J (Blue)
    '#f97316', // L (Orange)
    '#eab308', // O (Yellow)
    '#22c55e', // S (Green)
    '#a855f7', // T (Purple)
    '#ef4444'  // Z (Red)
];

const TETROMINOES = [
    [], // 空
    // I
    [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    // J
    [
        [2, 0, 0],
        [2, 2, 2],
        [0, 0, 0]
    ],
    // L
    [
        [0, 0, 3],
        [3, 3, 3],
        [0, 0, 0]
    ],
    // O
    [
        [4, 4],
        [4, 4]
    ],
    // S
    [
        [0, 5, 5],
        [5, 5, 0],
        [0, 0, 0]
    ],
    // T
    [
        [0, 6, 0],
        [6, 6, 6],
        [0, 0, 0]
    ],
    // Z
    [
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0]
    ]
];

// --- 遊戲狀態 ---
let board = [];
let score = 0;
let lines = 0;
let level = 1;
let currentPiece = null;
let nextPiece = null;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isGameOver = true;
let isPaused = false;
let animationId = null;

// --- 輔助函數：繪製單一方塊 ---
function drawBlock(ctx, x, y, colorId, size) {
    if (colorId === 0) return;
    
    const color = COLORS[colorId];
    
    // 主體
    ctx.fillStyle = color;
    ctx.fillRect(x * size, y * size, size, size);
    
    // 亮部邊緣 (Top, Left)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(x * size, y * size);
    ctx.lineTo((x + 1) * size, y * size);
    ctx.lineTo((x + 1) * size - 4, y * size + 4);
    ctx.lineTo(x * size + 4, y * size + 4);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(x * size, y * size);
    ctx.lineTo(x * size, (y + 1) * size);
    ctx.lineTo(x * size + 4, (y + 1) * size - 4);
    ctx.lineTo(x * size + 4, y * size + 4);
    ctx.fill();
    
    // 暗部邊緣 (Bottom, Right)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.moveTo((x + 1) * size, y * size);
    ctx.lineTo((x + 1) * size, (y + 1) * size);
    ctx.lineTo((x + 1) * size - 4, (y + 1) * size - 4);
    ctx.lineTo((x + 1) * size - 4, y * size + 4);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(x * size, (y + 1) * size);
    ctx.lineTo((x + 1) * size, (y + 1) * size);
    ctx.lineTo((x + 1) * size - 4, (y + 1) * size - 4);
    ctx.lineTo(x * size + 4, (y + 1) * size - 4);
    ctx.fill();
    
    // 內框
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeRect(x * size, y * size, size, size);
}

function drawGhostBlock(ctx, x, y, colorId, size) {
    if (colorId === 0) return;
    const color = COLORS[colorId];
    
    // 繪製半透明的本體
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(x * size, y * size, size, size);
    
    // 恢復透明度並繪製外框
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x * size, y * size, size, size);
    ctx.lineWidth = 1; // 恢復預設線寬
}

// --- Board 邏輯 ---
function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 畫網格線 (選用)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * BLOCK_SIZE, 0);
        ctx.lineTo(i * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * BLOCK_SIZE);
        ctx.lineTo(canvas.width, i * BLOCK_SIZE);
        ctx.stroke();
    }

    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value > 0) {
                drawBlock(ctx, x, y, value, BLOCK_SIZE);
            }
        });
    });
}

// --- Piece 邏輯 ---
class Piece {
    constructor(matrix) {
        this.matrix = matrix;
        this.pos = {
            x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2),
            y: 0
        };
    }
    
    draw(context, size, offsetX = 0, offsetY = 0) {
        this.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value > 0) {
                    drawBlock(context, this.pos.x + x + offsetX, this.pos.y + y + offsetY, value, size);
                }
            });
        });
    }
}

function createPiece() {
    // 隨機產生 1~7
    const typeId = Math.floor(Math.random() * 7) + 1;
    return new Piece(TETROMINOES[typeId]);
}

function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextPiece) return;
    
    // 將預覽方塊置中
    const offsetX = (4 - nextPiece.matrix[0].length) / 2 - nextPiece.pos.x;
    const offsetY = (4 - nextPiece.matrix.length) / 2 - nextPiece.pos.y;
    
    nextPiece.draw(nextCtx, NEXT_BLOCK_SIZE, offsetX, offsetY);
}

function getGhostY() {
    let ghostY = currentPiece.pos.y;
    const tempPiece = { matrix: currentPiece.matrix, pos: { x: currentPiece.pos.x, y: ghostY } };
    while (!collide(board, tempPiece)) {
        tempPiece.pos.y++;
    }
    return tempPiece.pos.y - 1;
}

function drawGhostPiece() {
    if (isGameOver || !currentPiece) return;
    const ghostY = getGhostY();
    currentPiece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value > 0) {
                drawGhostBlock(ctx, currentPiece.pos.x + x, ghostY + y, value, BLOCK_SIZE);
            }
        });
    });
}

function merge(board, piece) {
    piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value > 0) {
                board[y + piece.pos.y][x + piece.pos.x] = value;
            }
        });
    });
}

function collide(board, piece) {
    const m = piece.matrix;
    const o = piece.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function rotate(matrix, dir) {
    // 轉置矩陣
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    // 反轉每一行 (順時針)
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        // 反轉矩陣本身 (逆時針)
        matrix.reverse();
    }
}

function playerRotate(dir) {
    const pos = currentPiece.pos.x;
    let offset = 1;
    rotate(currentPiece.matrix, dir);
    // 處理靠牆旋轉 (Wall kick)
    while (collide(board, currentPiece)) {
        currentPiece.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > currentPiece.matrix[0].length) {
            // 旋轉失敗，轉回來
            rotate(currentPiece.matrix, -dir);
            currentPiece.pos.x = pos;
            return;
        }
    }
    playSound('rotate');
}

function playerMove(dir) {
    currentPiece.pos.x += dir;
    if (collide(board, currentPiece)) {
        currentPiece.pos.x -= dir;
    } else {
        playSound('move');
    }
}

function playerDrop() {
    currentPiece.pos.y++;
    if (collide(board, currentPiece)) {
        currentPiece.pos.y--;
        merge(board, currentPiece);
        playerReset();
        arenaSweep();
        updateScore();
        playSound('drop');
    }
    dropCounter = 0;
}

function playerHardDrop() {
    while (!collide(board, currentPiece)) {
        currentPiece.pos.y++;
    }
    currentPiece.pos.y--;
    merge(board, currentPiece);
    playerReset();
    arenaSweep();
    updateScore();
    playSound('drop');
    dropCounter = 0;
}

function playerReset() {
    if (!nextPiece) {
        nextPiece = createPiece();
    }
    currentPiece = nextPiece;
    nextPiece = createPiece();
    drawNextPiece();
    
    currentPiece.pos.y = 0;
    currentPiece.pos.x = Math.floor(COLS / 2) - Math.floor(currentPiece.matrix[0].length / 2);
    
    if (collide(board, currentPiece)) {
        // Game Over
        isGameOver = true;
        playSound('gameover');
        gameOverScreen.classList.remove('hidden');
    }
}

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = board.length - 1; y >= 0; --y) {
        for (let x = 0; x < board[y].length; ++x) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        ++y;
        rowCount++;
    }
    
    if (rowCount > 0) {
        playSound('clear');
        // 分數計算：1行=100, 2行=300, 3行=500, 4行=800
        const lineScores = [0, 100, 300, 500, 800];
        score += lineScores[rowCount] * level;
        lines += rowCount;
        
        // 每 10 行升一級
        if (lines >= level * 10) {
            level++;
            // 每升一級，下落間隔減少 10%
            dropInterval *= 0.9;
        }
    }
}

function updateScore() {
    scoreElement.innerText = score;
    linesElement.innerText = lines;
    levelElement.innerText = level;
}

// --- 輸入處理 ---
document.addEventListener('keydown', event => {
    if (isGameOver || isPaused) return;
    
    // 防止預設行為 (如空白鍵捲動頁面)
    if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(event.code) > -1) {
        event.preventDefault();
    }

    switch (event.keyCode) {
        case 37: // Left
            playerMove(-1);
            break;
        case 39: // Right
            playerMove(1);
            break;
        case 40: // Down
            playerDrop();
            break;
        case 38: // Up
            playerRotate(1);
            break;
        case 90: // Z 鍵
        case 17: // Ctrl
            playerRotate(-1);
            break;
        case 32: // Space
            playerHardDrop();
            break;
    }
});

// --- 遊戲迴圈 ---
function update(time = 0) {
    if (isGameOver) return;
    
    const deltaTime = time - lastTime;
    lastTime = time;
    
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }
    
    drawBoard();
    drawGhostPiece();
    currentPiece.draw(ctx, BLOCK_SIZE);
    
    animationId = requestAnimationFrame(update);
}

function startGame() {
    initAudio();
    board = createMatrix(COLS, ROWS);
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    updateScore();
    
    nextPiece = null;
    playerReset();
    
    isGameOver = false;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    update();
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// 初始化繪製空版面
drawBoard();
