const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// =====================================================
// SCREEN
// =====================================================

function screenWidth() {
    if (window.visualViewport) {
        return Math.floor(window.visualViewport.width);
    }

    return window.innerWidth;
}

function screenHeight() {
    if (window.visualViewport) {
        return Math.floor(window.visualViewport.height);
    }

    return window.innerHeight;
}

function resizeCanvas() {
    const w = screenWidth();
    const h = screenHeight();

    canvas.width = w;
    canvas.height = h;

    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
}

resizeCanvas();

window.addEventListener("resize", resizeCanvas);

window.addEventListener("orientationchange", function () {
    setTimeout(resizeCanvas, 250);
});

if (window.visualViewport) {
    window.visualViewport.addEventListener(
        "resize",
        resizeCanvas
    );
}

function groundY() {
    const mobile = isMobileDevice();

    return screenHeight() - (mobile ? 70 : 90);
}
// =====================================================
// IMAGES
// =====================================================

const heroImage = new Image();
heroImage.src = "images/hero.png";

const background1 = new Image();
background1.src = "images/background.png";

const background2 = new Image();
background2.src = "images/background1.png";

// =====================================================
// AUDIO
// =====================================================

let audioContext = null;
let musicTimer = null;
let musicStep = 0;
let soundEnabled = true;
let musicEnabled = true;

function ensureAudio() {

    if (!audioContext) {
        audioContext =
            new (window.AudioContext ||
                window.webkitAudioContext)();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

function playTone(
    frequency,
    duration = 0.1,
    volume = 0.04,
    type = "sine"
) {

    if (!soundEnabled) return;

    ensureAudio();

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    const now = audioContext.currentTime;

    gain.gain.setValueAtTime(volume, now);

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + duration
    );

    oscillator.start(now);
    oscillator.stop(now + duration);
}

function soundJump() {
    playTone(480, 0.07, 0.04, "square");
    setTimeout(() =>
        playTone(660, 0.07, 0.035, "square"), 45);
}

function soundCoin() {
    playTone(900, 0.08, 0.05);
    setTimeout(() =>
        playTone(1250, 0.1, 0.05), 60);
}

function soundHit() {
    playTone(180, 0.12, 0.05, "square");
}

function soundPower() {

    [523, 659, 784, 1046].forEach(
        (note, i) => {

            setTimeout(() => {
                playTone(
                    note,
                    0.12,
                    0.04,
                    "triangle"
                );
            }, i * 80);
        }
    );
}

function soundDeath() {

    [400, 300, 220, 150].forEach(
        (note, i) => {

            setTimeout(() => {
                playTone(
                    note,
                    0.13,
                    0.05,
                    "sawtooth"
                );
            }, i * 90);
        }
    );
}

function soundComplete() {

    [523, 659, 784, 1046, 1318].forEach(
        (note, i) => {

            setTimeout(() => {
                playTone(
                    note,
                    0.18,
                    0.05,
                    "triangle"
                );
            }, i * 100);
        }
    );
}

// =====================================================
// MUSIC
// =====================================================

const music1 = [
    523, 659, 784, 659,
    587, 698, 880, 698
];

const music2 = [
    220, 261, 293, 246,
    196, 220, 174, 196
];

function stopMusic() {

    if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
    }
}

function startMusic() {

    stopMusic();

    if (!musicEnabled)
        return;

    musicStep = 0;

    musicTimer =
        setInterval(() => {

            if (
                !gameStarted ||
                gameOver ||
                paused ||
                levelCompleted
            ) {
                return;
            }

            const melody =
                currentWorld === 1
                    ? music1
                    : music2;

            const note =
                melody[
                musicStep %
                melody.length
                ];

            playTone(
                note,
                0.22,
                0.012,
                currentWorld === 1
                    ? "triangle"
                    : "sine"
            );

            musicStep++;

        }, 330);
}

// =====================================================
// SPRITES
// =====================================================

const walkFrames = [
    { x: 575, y: 10, w: 180, h: 250 },
    { x: 760, y: 10, w: 190, h: 250 },
    { x: 945, y: 10, w: 205, h: 250 },
    { x: 1130, y: 10, w: 190, h: 250 },
    { x: 1310, y: 10, w: 200, h: 250 }
];

const jumpFrame = {
    x: 760,
    y: 280,
    w: 220,
    h: 260
};

const attackFrame = {
    x: 1000,
    y: 280,
    w: 230,
    h: 260
};

// =====================================================
// SAVE
// =====================================================

let highScore =
    Number(
        localStorage.getItem(
            "jumpHeroHighScore"
        ) || 0
    );

let unlockedLevel =
    Number(
        localStorage.getItem(
            "jumpHeroUnlockedLevel"
        ) || 1
    );

function saveProgress() {

    if (score > highScore) {

        highScore = score;

        localStorage.setItem(
            "jumpHeroHighScore",
            highScore
        );
    }

    localStorage.setItem(
        "jumpHeroUnlockedLevel",
        unlockedLevel
    );
}

// =====================================================
// GAME STATE
// =====================================================

let gameStarted = false;
let gameOver = false;
let paused = false;
let levelCompleted = false;

let currentWorld = 1;
let currentLevel = 1;

let score = 0;
let lives = 3;

let levelTime = 120;
let timerCounter = 0;

let cameraX = 0;
let worldWidth = 3600;

let checkpointX = 100;

// =====================================================
// PLAYER
// =====================================================

const player = {

    x: 100,
    y: 100,

    width: 60,
    height: 85,

    speed: 6,

    velocityY: 0,

    jumpPower: 20,

    onGround: false,

    jumpsUsed: 0,
    maxJumps: 2,

    attacking: false,
    attackTimer: 0,

    dashing: false,
    dashTimer: 0,
    dashCooldown: 0,

    shield: false,
    shieldTimer: 0,

    speedBoost: false,
    speedBoostTimer: 0,

    hasKey: false
};

let facingRight = true;
let currentFrame = 0;
let animationCounter = 0;

// =====================================================
// WORLD DATA
// =====================================================

let pits = [];
let platforms = [];
let movingPlatforms = [];
let collapsingPlatforms = [];
let spikes = [];
let coins = [];
let hearts = [];
let stars = [];
let crates = [];
let chests = [];

let enemies = [];
let shooterEnemies = [];
let projectiles = [];

let checkpoint = null;
let keyItem = null;
let door = null;
let flag = null;
let boss = null;

// =====================================================
// INPUT
// =====================================================

const keys = {};

document.addEventListener(
    "keydown",
    e => {

        keys[e.code] = true;

        if (!gameStarted) {

            if (
                e.code === "Enter" ||
                e.code === "Space"
            ) {
                startGame();
            }

            return;
        }

        if (e.code === "KeyP") {
            paused = !paused;
            return;
        }

        if (e.code === "KeyR") {
            resetPlayer();
            return;
        }

        if (
            e.code === "ControlLeft" ||
            e.code === "ControlRight"
        ) {
            attack();
        }

        if (
            e.code === "ShiftLeft" ||
            e.code === "ShiftRight"
        ) {
            dash();
        }

        if (
            e.code === "Enter" &&
            gameOver
        ) {
            restartGame();
        }

        if (
            e.code === "Enter" &&
            levelCompleted
        ) {
            nextLevel();
        }
    }
);

document.addEventListener(
    "keyup",
    e => {
        keys[e.code] = false;
    }
);

// =====================================================
// MOBILE
// =====================================================

const mobileControls = {
    left: false,
    right: false,
    jump: false,
    attack: false,
    dash: false
};

function isMobileDevice() {

    return (
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0
    );
}

function getMobileButtons() {

    const w = canvas.width;
    const h = canvas.height;

    // حجم مناسب لشاشات الهاتف القصيرة بالعرض
    const size = Math.max(
        42,
        Math.min(
            64,
            h * 0.14,
            w * 0.085
        )
    );

    const margin = Math.max(12, size * 0.22);
    const gap = Math.max(8, size * 0.16);

    // وضع الأزرار فوق أسفل الشاشة بقليل
    const y = h - size - margin;

    return {

        left: {
            x: margin,
            y: y,
            width: size,
            height: size
        },

        right: {
            x: margin + size + gap,
            y: y,
            width: size,
            height: size
        },

        dash: {
            x: margin + (size + gap) * 2,
            y: y,
            width: size,
            height: size
        },

        attack: {
            x: w - margin - size * 2 - gap,
            y: y,
            width: size,
            height: size
        },

        jump: {
            x: w - margin - size,
            y: y,
            width: size,
            height: size
        }
    };
}

function insideButton(
    x,
    y,
    b
) {

    return (
        x >= b.x &&
        x <= b.x + b.width &&
        y >= b.y &&
        y <= b.y + b.height
    );
}

function resetMobileControls() {

    mobileControls.left = false;
    mobileControls.right = false;
    mobileControls.jump = false;
    mobileControls.attack = false;
    mobileControls.dash = false;
}

canvas.addEventListener(
    "touchstart",
    handleTouches,
    { passive: false }
);

canvas.addEventListener(
    "touchmove",
    handleTouches,
    { passive: false }
);

canvas.addEventListener(
    "touchend",
    e => {

        e.preventDefault();

        resetMobileControls();

        handleTouches(e);

    },
    { passive: false }
);

function handleTouches(e) {

    e.preventDefault();

    if (!gameStarted) {

        if (e.touches.length > 0)
            startGame();

        return;
    }

    resetMobileControls();

    const rect =
        canvas.getBoundingClientRect();

    const buttons =
        getMobileButtons();

    for (const touch of e.touches) {

        const x =
            touch.clientX -
            rect.left;

        const y =
            touch.clientY -
            rect.top;

        if (
            insideButton(
                x,
                y,
                buttons.left
            )
        ) {
            mobileControls.left = true;
        }

        if (
            insideButton(
                x,
                y,
                buttons.right
            )
        ) {
            mobileControls.right = true;
        }

        if (
            insideButton(
                x,
                y,
                buttons.jump
            )
        ) {
            mobileControls.jump = true;
        }

        if (
            insideButton(
                x,
                y,
                buttons.attack
            )
        ) {

            attack();

            mobileControls.attack = true;
        }

        if (
            insideButton(
                x,
                y,
                buttons.dash
            )
        ) {

            dash();

            mobileControls.dash = true;
        }
    }
}

// =====================================================
// HELPERS
// =====================================================

function createEnemy(
    x,
    minX,
    maxX
) {

    return {

        x,

        width: 50,
        height: 45,

        speed: 2,
        direction: 1,

        minX,
        maxX,

        alive: true
    };
}

function createShooter(
    x
) {

    return {

        x,

        width: 55,
        height: 55,

        alive: true,

        cooldown: 0
    };
}

// =====================================================
// START
// =====================================================

function startGame() {
if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
} else if (document.documentElement.webkitRequestFullscreen) {
    document.documentElement.webkitRequestFullscreen();
}
    ensureAudio();

    gameStarted = true;
    gameOver = false;

    score = 0;
    lives = 3;

    currentWorld = 1;
    currentLevel = 1;

    loadLevel();

    startMusic();
}

// =====================================================
// LOAD LEVEL
// =====================================================

function loadLevel() {

    levelCompleted = false;
    paused = false;

    player.hasKey = false;
    player.shield = false;
    player.speedBoost = false;

    checkpointX = 100;

    projectiles = [];

    timerCounter = 0;

    // ==========================================
    // WORLD 1
    // ==========================================

    if (currentWorld === 1) {

        levelTime = 120;

        worldWidth = 3900;

        pits = [
            { x: 850, width: 150 },
            { x: 1750, width: 170 },
            { x: 2700, width: 180 }
        ];

        platforms = [
            {
                x: 300,
                yOffset: 180,
                width: 180,
                height: 25
            },
            {
                x: 620,
                yOffset: 230,
                width: 180,
                height: 25
            },
            {
                x: 1150,
                yOffset: 200,
                width: 200,
                height: 25
            },
            {
                x: 2050,
                yOffset: 220,
                width: 180,
                height: 25
            },
            {
                x: 3000,
                yOffset: 200,
                width: 210,
                height: 25
            }
        ];

        movingPlatforms = [
            {
                x: 1450,
                yOffset: 270,
                width: 150,
                height: 20,

                minX: 1380,
                maxX: 1650,

                speed: 2,
                direction: 1
            }
        ];

        collapsingPlatforms = [
            {
                x: 2350,
                yOffset: 260,
                width: 160,
                height: 20,

                active: true,
                collapseTimer: 0
            }
        ];

        spikes = [
            {
                x: 1020,
                width: 80
            },

            {
                x: 3250,
                width: 100
            }
        ];

        coins = [
            {
                x: 360,
                yOffset: 220,
                collected: false
            },
            {
                x: 680,
                yOffset: 275,
                collected: false
            },
            {
                x: 1220,
                yOffset: 245,
                collected: false
            },
            {
                x: 2100,
                yOffset: 260,
                collected: false
            },
            {
                x: 3050,
                yOffset: 245,
                collected: false
            }
        ];

        hearts = [
            {
                x: 1550,
                yOffset: 160,
                collected: false
            }
        ];

        stars = [
            {
                x: 1850,
                yOffset: 320,
                collected: false
            }
        ];

        crates = [
            {
                x: 500,
                width: 55,
                height: 55,
                broken: false
            },

            {
                x: 2200,
                width: 55,
                height: 55,
                broken: false
            }
        ];

        chests = [
            {
                x: 2500,
                width: 70,
                height: 55,
                opened: false
            }
        ];

        enemies = [
            createEnemy(
                700,
                650,
                800
            ),

            createEnemy(
                1300,
                1250,
                1450
            ),

            createEnemy(
                2900,
                2850,
                3150
            )
        ];

        shooterEnemies = [
            createShooter(3350)
        ];

        checkpoint = {
            x: 1900,
            reached: false
        };

        keyItem = {
            x: 2600,
            yOffset: 170,
            collected: false
        };

        door = {
            x: 3500,
            width: 70,
            height: 130,
            opened: false
        };

        flag = {
            x: 3750,
            width: 15,
            height: 170
        };

        boss = null;
    }

    // ==========================================
    // WORLD 2 / BOSS
    // ==========================================

    else {

        levelTime = 150;

        worldWidth = 4300;

        pits = [
            { x: 700, width: 170 },
            { x: 1500, width: 200 },
            { x: 2550, width: 200 },
            { x: 3400, width: 180 }
        ];

        platforms = [
            {
                x: 300,
                yOffset: 190,
                width: 180,
                height: 25
            },
            {
                x: 950,
                yOffset: 240,
                width: 180,
                height: 25
            },
            {
                x: 1800,
                yOffset: 220,
                width: 190,
                height: 25
            },
            {
                x: 2850,
                yOffset: 240,
                width: 200,
                height: 25
            }
        ];

        movingPlatforms = [];

        collapsingPlatforms = [
            {
                x: 2150,
                yOffset: 290,
                width: 160,
                height: 20,

                active: true,
                collapseTimer: 0
            }
        ];

        spikes = [
            {
                x: 1100,
                width: 100
            },

            {
                x: 3100,
                width: 100
            }
        ];

        coins = [
            {
                x: 370,
                yOffset: 230,
                collected: false
            },
            {
                x: 1000,
                yOffset: 280,
                collected: false
            },
            {
                x: 1850,
                yOffset: 260,
                collected: false
            },
            {
                x: 2900,
                yOffset: 280,
                collected: false
            }
        ];

        hearts = [
            {
                x: 2350,
                yOffset: 160,
                collected: false
            }
        ];

        stars = [
            {
                x: 1700,
                yOffset: 320,
                collected: false
            }
        ];

        crates = [
            {
                x: 600,
                width: 55,
                height: 55,
                broken: false
            }
        ];

        chests = [
            {
                x: 3250,
                width: 70,
                height: 55,
                opened: false
            }
        ];

        enemies = [
            createEnemy(
                500,
                450,
                650
            ),

            createEnemy(
                1900,
                1800,
                2050
            )
        ];

        shooterEnemies = [
            createShooter(1200),
            createShooter(3000)
        ];

        checkpoint = {
            x: 2200,
            reached: false
        };

        keyItem = null;
        door = null;
        flag = null;

        boss = {

            x: 3900,

            width: 130,
            height: 130,

            health: 8,

            alive: true,

            speed: 2,

            direction: 1,

            minX: 3700,
            maxX: 4150
        };
    }

    resetPlayer();
}

// =====================================================
// PLAYER ACTIONS
// =====================================================

function attack() {

    if (
        player.attacking ||
        gameOver ||
        paused
    ) return;

    player.attacking = true;
    player.attackTimer = 14;

    soundHit();
}

function dash() {

    if (
        player.dashCooldown > 0 ||
        gameOver ||
        paused
    ) return;

    player.dashing = true;
    player.dashTimer = 9;
    player.dashCooldown = 60;

    playTone(
        320,
        0.08,
        0.04,
        "sawtooth"
    );
}

function resetPlayer() {

    player.x = checkpointX;

    player.y =
        groundY() -
        player.height;

    player.velocityY = 0;

    player.onGround = true;

    player.jumpsUsed = 0;

    player.attacking = false;
    player.dashing = false;

    cameraX =
        Math.max(
            0,
            checkpointX -
            300
        );
}

// =====================================================
// LIFE
// =====================================================

function loseLife() {

    if (player.shield) {

        player.shield = false;

        soundHit();

        return;
    }

    lives--;

    soundDeath();

    if (lives <= 0) {

        lives = 0;

        gameOver = true;

        stopMusic();

        saveProgress();

        return;
    }

    resetPlayer();
}

function restartGame() {

    lives = 3;
    score = 0;

    currentWorld = 1;
    currentLevel = 1;

    gameOver = false;

    loadLevel();

    startMusic();
}

function nextLevel() {

    if (currentWorld === 1) {

        currentWorld = 2;

        unlockedLevel =
            Math.max(
                unlockedLevel,
                2
            );

        saveProgress();

        loadLevel();

        startMusic();

    } else {

        saveProgress();

        gameStarted = false;

        currentWorld = 1;

        stopMusic();
    }
}

// =====================================================
// COLLISION HELPERS
// =====================================================

function rectCollision(a, b) {

    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function circleCollision(
    x,
    y,
    radius
) {

    const closestX =
        Math.max(
            player.x,
            Math.min(
                x,
                player.x +
                player.width
            )
        );

    const closestY =
        Math.max(
            player.y,
            Math.min(
                y,
                player.y +
                player.height
            )
        );

    const dx =
        x - closestX;

    const dy =
        y - closestY;

    return (
        Math.sqrt(
            dx * dx +
            dy * dy
        ) < radius
    );
}

function overPit() {

    const center =
        player.x +
        player.width / 2;

    return pits.some(
        pit =>
            center >
            pit.x &&
            center <
            pit.x +
            pit.width
    );
}

function platformCollision(
    x,
    y,
    width,
    height
) {

    const bottom =
        player.y +
        player.height;

    if (
        player.x +
        player.width > x &&

        player.x <
        x + width &&

        bottom >= y &&

        bottom <=
        y + height + 15 &&

        player.velocityY >= 0
    ) {

        player.y =
            y -
            player.height;

        player.velocityY = 0;

        player.onGround = true;

        player.jumpsUsed = 0;

        return true;
    }

    return false;
}

// =====================================================
// UPDATE
// =====================================================

function update() {

    if (
        !gameStarted ||
        paused ||
        gameOver ||
        levelCompleted
    ) return;

    const gY = groundY();

    // TIMER
    timerCounter++;

    if (timerCounter >= 60) {

        timerCounter = 0;
        levelTime--;

        if (levelTime <= 0) {

            loseLife();

            levelTime =
                currentWorld === 1
                    ? 120
                    : 150;
        }
    }

    // TIMERS
    if (player.dashCooldown > 0)
        player.dashCooldown--;

    if (player.speedBoost) {

        player.speedBoostTimer--;

        if (
            player.speedBoostTimer <= 0
        ) {
            player.speedBoost = false;
        }
    }

    if (player.shield) {

        player.shieldTimer--;

        if (
            player.shieldTimer <= 0
        ) {
            player.shield = false;
        }
    }

    // MOVEMENT

    let speed =
        player.speedBoost
            ? 9
            : player.speed;

    if (player.dashing) {

        player.x +=
            facingRight
                ? 16
                : -16;

        player.dashTimer--;

        if (
            player.dashTimer <= 0
        ) {
            player.dashing = false;
        }

    } else {

        if (
            keys["ArrowRight"] ||
            keys["KeyD"] ||
            mobileControls.right
        ) {

            player.x += speed;

            facingRight = true;
        }

        if (
            keys["ArrowLeft"] ||
            keys["KeyA"] ||
            mobileControls.left
        ) {

            player.x -= speed;

            facingRight = false;
        }
    }

    // JUMP / DOUBLE JUMP

    const jumpPressed =
        keys["Space"] ||
        keys["ArrowUp"] ||
        mobileControls.jump;

    if (
        jumpPressed &&
        player.jumpsUsed <
        player.maxJumps &&
        !player.jumpLock
    ) {

        player.velocityY =
            -player.jumpPower;

        player.onGround = false;

        player.jumpsUsed++;

        player.jumpLock = true;

        soundJump();
    }

    if (!jumpPressed) {
        player.jumpLock = false;
    }

    mobileControls.jump = false;

    // GRAVITY

    player.velocityY += 0.8;

    player.y +=
        player.velocityY;

    player.onGround = false;

    // GROUND

    if (
        !overPit() &&
        player.y +
        player.height >=
        gY
    ) {

        player.y =
            gY -
            player.height;

        player.velocityY = 0;

        player.onGround = true;

        player.jumpsUsed = 0;
    }

    if (
        player.y >
        screenHeight() +
        150
    ) {

        loseLife();
        return;
    }

    // PLATFORMS

    for (
        const p
        of platforms
    ) {

        platformCollision(
            p.x,
            gY -
            p.yOffset,
            p.width,
            p.height
        );
    }

    // MOVING PLATFORMS

    for (
        const p
        of movingPlatforms
    ) {

        p.x +=
            p.speed *
            p.direction;

        if (
            p.x <= p.minX ||
            p.x >= p.maxX
        ) {
            p.direction *= -1;
        }

        platformCollision(
            p.x,
            gY -
            p.yOffset,
            p.width,
            p.height
        );
    }

    // COLLAPSING PLATFORMS

    for (
        const p
        of collapsingPlatforms
    ) {

        if (!p.active)
            continue;

        const standing =
            platformCollision(
                p.x,
                gY -
                p.yOffset,
                p.width,
                p.height
            );

        if (standing) {

            p.collapseTimer++;

            if (
                p.collapseTimer >
                45
            ) {
                p.active = false;
            }
        }
    }

    // SPIKES

    for (
        const spike
        of spikes
    ) {

        const spikeRect = {

            x:
                spike.x,

            y:
                gY - 30,

            width:
                spike.width,

            height:
                30
        };

        if (
            rectCollision(
                player,
                spikeRect
            )
        ) {

            loseLife();
            return;
        }
    }

    // COINS

    for (
        const coin
        of coins
    ) {

        if (coin.collected)
            continue;

        if (
            circleCollision(
                coin.x,
                gY -
                coin.yOffset,
                15
            )
        ) {

            coin.collected = true;

            score++;

            soundCoin();
        }
    }

    // HEART

    for (
        const heart
        of hearts
    ) {

        if (heart.collected)
            continue;

        if (
            circleCollision(
                heart.x,
                gY -
                heart.yOffset,
                20
            )
        ) {

            heart.collected = true;

            lives =
                Math.min(
                    5,
                    lives + 1
                );

            soundPower();
        }
    }

    // STAR

    for (
        const star
        of stars
    ) {

        if (star.collected)
            continue;

        if (
            circleCollision(
                star.x,
                gY -
                star.yOffset,
                20
            )
        ) {

            star.collected = true;

            score += 10;

            soundPower();
        }
    }

    // CRATES

    for (
        const crate
        of crates
    ) {

        if (crate.broken)
            continue;

        const crateRect = {

            x:
                crate.x,

            y:
                gY -
                crate.height,

            width:
                crate.width,

            height:
                crate.height
        };

        if (
            player.attacking &&
            rectCollision(
                getAttackBox(),
                crateRect
            )
        ) {

            crate.broken = true;

            score += 3;

            soundHit();
        }
    }

    // CHESTS

    for (
        const chest
        of chests
    ) {

        if (chest.opened)
            continue;

        const chestRect = {

            x:
                chest.x,

            y:
                gY -
                chest.height,

            width:
                chest.width,

            height:
                chest.height
        };

        if (
            rectCollision(
                player,
                chestRect
            ) &&
            player.attacking
        ) {

            chest.opened = true;

            score += 20;

            player.speedBoost = true;

            player.speedBoostTimer = 600;

            soundPower();
        }
    }

    // CHECKPOINT

    if (
        checkpoint &&
        !checkpoint.reached &&
        player.x >
        checkpoint.x
    ) {

        checkpoint.reached = true;

        checkpointX =
            checkpoint.x;

        soundPower();
    }

    // KEY

    if (
        keyItem &&
        !keyItem.collected
    ) {

        if (
            circleCollision(
                keyItem.x,
                gY -
                keyItem.yOffset,
                20
            )
        ) {

            keyItem.collected = true;

            player.hasKey = true;

            soundPower();
        }
    }

    // DOOR

    if (
        door &&
        !door.opened
    ) {

        const d = {

            x:
                door.x,

            y:
                gY -
                door.height,

            width:
                door.width,

            height:
                door.height
        };

        if (
            rectCollision(
                player,
                d
            )
        ) {

            if (
                player.hasKey
            ) {

                door.opened = true;

                score += 5;

                soundPower();

            } else {

                player.x =
                    door.x -
                    player.width -
                    3;
            }
        }
    }

    // ATTACK

    if (
        player.attacking
    ) {

        player.attackTimer--;

        attackEnemies(gY);

        if (
            player.attackTimer <= 0
        ) {
            player.attacking = false;
        }
    }

    // NORMAL ENEMIES

    for (
        const enemy
        of enemies
    ) {

        if (!enemy.alive)
            continue;

        enemy.x +=
            enemy.speed *
            enemy.direction;

        if (
            enemy.x <= enemy.minX ||
            enemy.x >= enemy.maxX
        ) {
            enemy.direction *= -1;
        }

        checkEnemy(
            enemy,
            gY -
            enemy.height
        );
    }

    // SHOOTERS

    for (
        const enemy
        of shooterEnemies
    ) {

        if (!enemy.alive)
            continue;

        enemy.cooldown--;

        if (
            enemy.cooldown <= 0
        ) {

            projectiles.push({

                x:
                    enemy.x,

                y:
                    gY -
                    enemy.height -
                    10,

                width: 18,

                height: 18,

                speed:
                    player.x <
                        enemy.x
                        ? -5
                        : 5
            });

            enemy.cooldown = 120;
        }

        checkEnemy(
            enemy,
            gY -
            enemy.height
        );
    }

    // PROJECTILES

    for (
        const projectile
        of projectiles
    ) {

        projectile.x +=
            projectile.speed;

        if (
            rectCollision(
                player,
                projectile
            )
        ) {

            projectile.dead = true;

            loseLife();
        }
    }

    projectiles =
        projectiles.filter(
            p =>
                !p.dead &&
                p.x > 0 &&
                p.x < worldWidth
        );

    // BOSS

    if (
        boss &&
        boss.alive
    ) {

        boss.x +=
            boss.speed *
            boss.direction;

        if (
            boss.x <= boss.minX ||
            boss.x >= boss.maxX
        ) {
            boss.direction *= -1;
        }

        const bossY =
            gY -
            boss.height;

        const bossRect = {

            x:
                boss.x,

            y:
                bossY,

            width:
                boss.width,

            height:
                boss.height
        };

        if (
            rectCollision(
                player,
                bossRect
            )
        ) {

            if (
                player.velocityY > 0 &&
                player.y +
                player.height <
                bossY + 45
            ) {

                boss.health--;

                player.velocityY = -12;

                soundHit();

            } else if (
                !player.attacking
            ) {

                loseLife();
            }
        }

        if (
            player.attacking &&
            rectCollision(
                getAttackBox(),
                bossRect
            )
        ) {

            boss.health--;

            player.attacking = false;

            soundHit();
        }

        if (
            boss.health <= 0
        ) {

            boss.alive = false;

            score += 50;

            levelCompleted = true;

            stopMusic();

            soundComplete();

            saveProgress();
        }
    }

    // FLAG

    if (flag) {

        const f = {

            x:
                flag.x,

            y:
                gY -
                flag.height,

            width:
                flag.width,

            height:
                flag.height
        };

        if (
            rectCollision(
                player,
                f
            )
        ) {

            levelCompleted = true;

            stopMusic();

            soundComplete();

            saveProgress();
        }
    }

    // WORLD LIMIT

    player.x =
        Math.max(
            0,
            Math.min(
                player.x,
                worldWidth -
                player.width
            )
        );

    // CAMERA

    cameraX =
        player.x -
        screenWidth() / 2;

    cameraX =
        Math.max(
            0,
            Math.min(
                cameraX,
                Math.max(
                    0,
                    worldWidth -
                    screenWidth()
                )
            )
        );
}

// =====================================================
// ATTACK COLLISION
// =====================================================

function getAttackBox() {

    const range = 75;

    return {

        x:
            facingRight
                ? player.x +
                player.width
                : player.x -
                range,

        y:
            player.y + 10,

        width:
            range,

        height:
            player.height - 15
    };
}

function attackEnemies(gY) {

    const hitBox =
        getAttackBox();

    const allEnemies = [
        ...enemies,
        ...shooterEnemies
    ];

    for (
        const enemy
        of allEnemies
    ) {

        if (!enemy.alive)
            continue;

        const enemyRect = {

            x:
                enemy.x,

            y:
                gY -
                enemy.height,

            width:
                enemy.width,

            height:
                enemy.height
        };

        if (
            rectCollision(
                hitBox,
                enemyRect
            )
        ) {

            enemy.alive = false;

            score += 5;

            soundHit();
        }
    }
}

function checkEnemy(
    enemy,
    enemyY
) {

    const r = {

        x:
            enemy.x,

        y:
            enemyY,

        width:
            enemy.width,

        height:
            enemy.height
    };

    if (
        !rectCollision(
            player,
            r
        )
    ) return;

    const jumped =
        player.velocityY > 0 &&
        player.y +
        player.height <
        enemyY + 30;

    if (jumped) {

        enemy.alive = false;

        player.velocityY = -9;

        score += 5;

        soundHit();

    } else if (
        !player.attacking
    ) {

        loseLife();
    }
}

// =====================================================
// BACKGROUND
// =====================================================

function drawBackground() {

    const image =
        currentWorld === 1
            ? background1
            : background2;

    if (
        image.complete &&
        image.naturalWidth > 0
    ) {

        const speed =
            currentWorld === 1
                ? 0.18
                : 0.12;

        const offset =
            -(
                cameraX *
                speed %
                screenWidth()
            );

        ctx.drawImage(
            image,
            offset,
            0,
            screenWidth(),
            screenHeight()
        );

        ctx.drawImage(
            image,
            offset +
            screenWidth(),
            0,
            screenWidth(),
            screenHeight()
        );

    } else {

        ctx.fillStyle =
            currentWorld === 1
                ? "#69c8ff"
                : "#161022";

        ctx.fillRect(
            0,
            0,
            screenWidth(),
            screenHeight()
        );
    }
}

// =====================================================
// START SCREEN
// =====================================================

function drawStartScreen() {

    if (
        background1.complete &&
        background1.naturalWidth > 0
    ) {

        ctx.drawImage(
            background1,
            0,
            0,
            screenWidth(),
            screenHeight()
        );
    }

    ctx.fillStyle =
        "rgba(0,0,0,0.4)";

    ctx.fillRect(
        0,
        0,
        screenWidth(),
        screenHeight()
    );

    ctx.textAlign = "center";

    ctx.fillStyle = "white";

    ctx.font =
        "bold 60px Arial";

    ctx.fillText(
        "JUMP HERO",
        screenWidth() / 2,
        screenHeight() / 2 - 80
    );

    ctx.font =
        "22px Arial";

    ctx.fillText(
        "Run • Jump • Dash • Fight",
        screenWidth() / 2,
        screenHeight() / 2 - 30
    );

    ctx.fillStyle =
        "#f5a623";

    ctx.fillRect(
        screenWidth() / 2 - 130,
        screenHeight() / 2 + 30,
        260,
        70
    );

    ctx.fillStyle = "white";

    ctx.font =
        "bold 34px Arial";

    ctx.fillText(
        "▶ PLAY",
        screenWidth() / 2,
        screenHeight() / 2 + 76
    );

    ctx.font =
        "18px Arial";

    ctx.fillText(
        "High Score: " + highScore,
        screenWidth() / 2,
        screenHeight() / 2 + 135
    );

    ctx.textAlign = "left";
}

// =====================================================
// DRAW
// =====================================================

function draw() {

    ctx.clearRect(
        0,
        0,
        screenWidth(),
        screenHeight()
    );

    if (!gameStarted) {

        drawStartScreen();

        return;
    }

    const gY = groundY();

    drawBackground();

    ctx.save();

    ctx.translate(
        -cameraX,
        0
    );

    drawGround(gY);

    drawPlatforms(gY);

    drawCollectibles(gY);

    drawHazards(gY);

    drawEnemies(gY);

    drawPlayer();

    ctx.restore();

    drawHUD();

    if (
        isMobileDevice()
    ) {
        drawMobileControls();
    }

    if (paused) {
        drawPause();
    }

    if (gameOver) {
        drawGameOver();
    }

    if (levelCompleted) {
        drawLevelComplete();
    }
}

// =====================================================
// DRAW WORLD
// =====================================================

function drawGround(gY) {

    let start = 0;

    const sorted =
        [...pits]
            .sort(
                (a, b) =>
                    a.x -
                    b.x
            );

    for (
        const pit
        of sorted
    ) {

        ctx.fillStyle =
            currentWorld === 1
                ? "#477f31"
                : "#21132d";

        ctx.fillRect(
            start,
            gY,
            pit.x - start,
            screenHeight() -
            gY
        );

        ctx.fillStyle =
            currentWorld === 1
                ? "#65b632"
                : "#713f91";

        ctx.fillRect(
            start,
            gY,
            pit.x - start,
            10
        );

        ctx.fillStyle =
            currentWorld === 1
                ? "#111"
                : "#ff4715";

        ctx.fillRect(
            pit.x,
            gY,
            pit.width,
            screenHeight() -
            gY
        );

        start =
            pit.x +
            pit.width;
    }

    if (
        start <
        worldWidth
    ) {

        ctx.fillStyle =
            currentWorld === 1
                ? "#477f31"
                : "#21132d";

        ctx.fillRect(
            start,
            gY,
            worldWidth -
            start,
            screenHeight() -
            gY
        );

        ctx.fillStyle =
            currentWorld === 1
                ? "#65b632"
                : "#713f91";

        ctx.fillRect(
            start,
            gY,
            worldWidth -
            start,
            10
        );
    }
}

function drawPlatforms(gY) {

    for (
        const p
        of platforms
    ) {

        ctx.fillStyle =
            currentWorld === 1
                ? "#8b5a2b"
                : "#3d2655";

        ctx.fillRect(
            p.x,
            gY -
            p.yOffset,
            p.width,
            p.height
        );
    }

    for (
        const p
        of movingPlatforms
    ) {

        ctx.fillStyle =
            "#777";

        ctx.fillRect(
            p.x,
            gY -
            p.yOffset,
            p.width,
            p.height
        );
    }

    for (
        const p
        of collapsingPlatforms
    ) {

        if (!p.active)
            continue;

        ctx.fillStyle =
            "#c46b2c";

        ctx.fillRect(
            p.x,
            gY -
            p.yOffset,
            p.width,
            p.height
        );
    }
}

function drawCollectibles(gY) {

    for (
        const coin
        of coins
    ) {

        if (coin.collected)
            continue;

        ctx.beginPath();

        ctx.arc(
            coin.x,
            gY -
            coin.yOffset,
            14,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "gold";
        ctx.fill();
    }

    for (
        const heart
        of hearts
    ) {

        if (heart.collected)
            continue;

        ctx.font =
            "35px Arial";

        ctx.fillText(
            "❤️",
            heart.x,
            gY -
            heart.yOffset
        );
    }

    for (
        const star
        of stars
    ) {

        if (star.collected)
            continue;

        ctx.fillStyle = "yellow";

        ctx.font =
            "38px Arial";

        ctx.fillText(
            "★",
            star.x,
            gY -
            star.yOffset
        );
    }

    for (
        const crate
        of crates
    ) {

        if (crate.broken)
            continue;

        ctx.fillStyle =
            "#9b5a2e";

        ctx.fillRect(
            crate.x,
            gY -
            crate.height,
            crate.width,
            crate.height
        );

        ctx.strokeStyle =
            "#5e3218";

        ctx.strokeRect(
            crate.x,
            gY -
            crate.height,
            crate.width,
            crate.height
        );
    }

    for (
        const chest
        of chests
    ) {

        if (chest.opened)
            continue;

        ctx.fillStyle =
            "#704214";

        ctx.fillRect(
            chest.x,
            gY -
            chest.height,
            chest.width,
            chest.height
        );

        ctx.fillStyle =
            "gold";

        ctx.fillRect(
            chest.x,
            gY -
            chest.height,
            chest.width,
            12
        );
    }

    if (
        checkpoint
    ) {

        ctx.fillStyle =
            checkpoint.reached
                ? "lime"
                : "white";

        ctx.fillRect(
            checkpoint.x,
            gY - 120,
            10,
            120
        );

        ctx.fillStyle =
            checkpoint.reached
                ? "lime"
                : "red";

        ctx.fillRect(
            checkpoint.x + 10,
            gY - 120,
            60,
            35
        );
    }

    if (
        keyItem &&
        !keyItem.collected
    ) {

        ctx.font =
            "38px Arial";

        ctx.fillText(
            "🔑",
            keyItem.x,
            gY -
            keyItem.yOffset
        );
    }

    if (
        door &&
        !door.opened
    ) {

        ctx.fillStyle =
            "#5b3116";

        ctx.fillRect(
            door.x,
            gY -
            door.height,
            door.width,
            door.height
        );
    }

    if (flag) {

        ctx.fillStyle =
            "#222";

        ctx.fillRect(
            flag.x,
            gY -
            flag.height,
            12,
            flag.height
        );

        ctx.fillStyle =
            "gold";

        ctx.fillRect(
            flag.x + 12,
            gY -
            flag.height,
            70,
            40
        );
    }
}

function drawHazards(gY) {

    for (
        const spike
        of spikes
    ) {

        for (
            let x =
                spike.x;
            x <
            spike.x +
            spike.width;
            x += 25
        ) {

            ctx.fillStyle =
                "#ccc";

            ctx.beginPath();

            ctx.moveTo(
                x,
                gY
            );

            ctx.lineTo(
                x + 12,
                gY - 30
            );

            ctx.lineTo(
                x + 25,
                gY
            );

            ctx.closePath();

            ctx.fill();
        }
    }

    for (
        const p
        of projectiles
    ) {

        ctx.fillStyle =
            "#ff5500";

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            9,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }
}

function drawEnemies(gY) {

    for (
        const enemy
        of enemies
    ) {

        if (!enemy.alive)
            continue;

        drawEnemy(
            enemy.x,
            gY -
            enemy.height,
            enemy.width,
            enemy.height
        );
    }

    for (
        const enemy
        of shooterEnemies
    ) {

        if (!enemy.alive)
            continue;

        ctx.fillStyle =
            "#c02a2a";

        ctx.fillRect(
            enemy.x,
            gY -
            enemy.height,
            enemy.width,
            enemy.height
        );

        ctx.fillStyle =
            "white";

        ctx.font =
            "22px Arial";

        ctx.fillText(
            "🔥",
            enemy.x + 15,
            gY - 16
        );
    }

    if (
        boss &&
        boss.alive
    ) {

        const y =
            gY -
            boss.height;

        ctx.fillStyle =
            "#800014";

        ctx.fillRect(
            boss.x,
            y,
            boss.width,
            boss.height
        );

        ctx.font =
            "58px Arial";

        ctx.fillText(
            "👹",
            boss.x + 35,
            y + 75
        );

        ctx.fillStyle =
            "#222";

        ctx.fillRect(
            boss.x,
            y - 25,
            150,
            15
        );

        ctx.fillStyle =
            "red";

        ctx.fillRect(
            boss.x,
            y - 22,
            boss.health *
            18,
            9
        );
    }
}

function drawEnemy(
    x,
    y,
    width,
    height
) {

    ctx.fillStyle =
        "#7625a7";

    ctx.fillRect(
        x,
        y,
        width,
        height
    );

    ctx.fillStyle =
        "white";

    ctx.fillRect(
        x + 8,
        y + 8,
        8,
        8
    );

    ctx.fillRect(
        x + 30,
        y + 8,
        8,
        8
    );
}

// =====================================================
// DRAW PLAYER
// =====================================================

function drawPlayer() {

    let frame;

    if (player.attacking) {

        frame =
            attackFrame;

    } else if (
        !player.onGround
    ) {

        frame =
            jumpFrame;

    } else {

        frame =
            walkFrames[
            currentFrame
            ];
    }

    ctx.save();

    if (
        player.shield
    ) {

        ctx.beginPath();

        ctx.arc(
            player.x +
            player.width / 2,

            player.y +
            player.height / 2,

            55,

            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "rgba(0,220,255,0.25)";

        ctx.fill();

        ctx.strokeStyle =
            "cyan";

        ctx.lineWidth = 3;

        ctx.stroke();
    }

    if (!facingRight) {

        ctx.translate(
            player.x +
            player.width,
            player.y
        );

        ctx.scale(-1, 1);

        ctx.drawImage(
            heroImage,

            frame.x,
            frame.y,
            frame.w,
            frame.h,

            0,
            0,

            player.width,
            player.height
        );

    } else {

        ctx.drawImage(
            heroImage,

            frame.x,
            frame.y,
            frame.w,
            frame.h,

            player.x,
            player.y,

            player.width,
            player.height
        );
    }

    ctx.restore();
}

// =====================================================
// HUD
// =====================================================

function drawHUD() {

    const w = canvas.width;
    const h = canvas.height;

    const compact =
        isMobileDevice() ||
        w < 900 ||
        h < 600;

    const margin = compact ? 8 : 15;

    const hudHeight =
        compact ? 48 : 68;

    const hudWidth =
        compact
            ? w - margin * 2
            : Math.min(
                650,
                w - margin * 2
            );

    // خلفية الشريط
    ctx.fillStyle =
        "rgba(0,0,0,0.67)";

    ctx.fillRect(
        margin,
        margin,
        hudWidth,
        hudHeight
    );

    ctx.fillStyle = "white";

    ctx.textBaseline = "middle";

    const fontSize =
        compact
            ? Math.max(
                12,
                Math.min(
                    18,
                    w / 45
                )
            )
            : 21;

    ctx.font =
        `bold ${fontSize}px Arial`;

    const y =
        margin +
        hudHeight / 2;

    let heartsText = "";

    for (
        let i = 0;
        i < lives;
        i++
    ) {
        heartsText += "❤️";
    }

    if (compact) {

        // SCORE
        ctx.fillText(
            "Score: " + score,
            margin + 12,
            y
        );

        // HEARTS
        ctx.fillText(
            heartsText,
            margin +
            hudWidth * 0.20,
            y
        );

        // TIME
        ctx.fillText(
            "Time: " + levelTime,
            margin +
            hudWidth * 0.48,
            y
        );

        // WORLD
        ctx.fillText(
            "World " + currentWorld,
            margin +
            hudWidth * 0.70,
            y
        );

        // DASH READY
        if (
            player.dashCooldown <= 0
        ) {

            ctx.fillText(
                "💨",
                margin +
                hudWidth * 0.90,
                y
            );
        }

    } else {

        ctx.fillText(
            "Score: " + score,
            30,
            y
        );

        ctx.fillText(
            heartsText,
            160,
            y
        );

        ctx.fillText(
            "Time: " + levelTime,
            320,
            y
        );

        ctx.fillText(
            "World " + currentWorld,
            455,
            y
        );

        if (
            player.dashCooldown <= 0
        ) {

            ctx.fillText(
                "💨",
                565,
                y
            );
        }
    }

    ctx.textBaseline =
        "alphabetic";
}

// =====================================================
// MOBILE DRAW
// =====================================================

function drawMobileControls() {

    const b =
        getMobileButtons();

    drawTouchButton(
        b.left,
        "◀",
        mobileControls.left
    );

    drawTouchButton(
        b.right,
        "▶",
        mobileControls.right
    );

    drawTouchButton(
        b.dash,
        "💨",
        mobileControls.dash
    );

    drawTouchButton(
        b.attack,
        "⚔",
        mobileControls.attack
    );

    drawTouchButton(
        b.jump,
        "⬆",
        mobileControls.jump
    );
}

function drawTouchButton(
    button,
    text,
    active
) {

    ctx.save();

    ctx.globalAlpha =
        active
            ? 0.85
            : 0.5;

    ctx.fillStyle =
        "#111";

    ctx.beginPath();

    ctx.arc(
        button.x +
        button.width / 2,

        button.y +
        button.height / 2,

        button.width / 2,

        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.strokeStyle =
        "white";

    ctx.lineWidth = 2;

    ctx.stroke();

    ctx.fillStyle =
        "white";

    ctx.font =
        `${button.width *
        0.38}px Arial`;

    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "middle";

    ctx.fillText(
        text,
        button.x +
        button.width / 2,
        button.y +
        button.height / 2
    );

    ctx.restore();

    ctx.textAlign =
        "left";

    ctx.textBaseline =
        "alphabetic";
}

// =====================================================
// MENUS
// =====================================================

function overlay() {

    ctx.fillStyle =
        "rgba(0,0,0,0.75)";

    ctx.fillRect(
        0,
        0,
        screenWidth(),
        screenHeight()
    );
}

function drawPause() {

    overlay();

    ctx.textAlign =
        "center";

    ctx.fillStyle =
        "white";

    ctx.font =
        "bold 55px Arial";

    ctx.fillText(
        "PAUSED",
        screenWidth() / 2,
        screenHeight() / 2
    );

    ctx.font =
        "22px Arial";

    ctx.fillText(
        "Press P to continue",
        screenWidth() / 2,
        screenHeight() / 2 + 50
    );

    ctx.textAlign =
        "left";
}

function drawGameOver() {

    overlay();

    ctx.textAlign =
        "center";

    ctx.fillStyle =
        "white";

    ctx.font =
        "bold 60px Arial";

    ctx.fillText(
        "GAME OVER",
        screenWidth() / 2,
        screenHeight() / 2
    );

    ctx.font =
        "22px Arial";

    ctx.fillText(
        "Press ENTER",
        screenWidth() / 2,
        screenHeight() / 2 + 50
    );

    ctx.textAlign =
        "left";
}

function drawLevelComplete() {

    overlay();

    ctx.textAlign =
        "center";

    ctx.fillStyle =
        "white";

    ctx.font =
        "bold 52px Arial";

    ctx.fillText(
        currentWorld === 1
            ? "WORLD 1 COMPLETE!"
            : "BOSS DEFEATED!",
        screenWidth() / 2,
        screenHeight() / 2
    );

    ctx.font =
        "24px Arial";

    ctx.fillText(
        currentWorld === 1
            ? "Press ENTER for World 2"
            : "Final Score: " +
            score,
        screenWidth() / 2,
        screenHeight() / 2 + 55
    );

    ctx.textAlign =
        "left";
}

// =====================================================
// LOOP
// =====================================================

function gameLoop() {

    update();

    draw();

    requestAnimationFrame(
        gameLoop
    );
}

gameLoop();
