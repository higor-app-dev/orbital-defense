import kaplay from "kaplay";
import "kaplay/global";

// ── Initialization ────────────────────────────────────────────────
kaplay({
    touchToMouse: true,
    letterbox: true,
    width: 480,
    height: 800,
    background: "#0a0a2e",
});

// ── Scene ─────────────────────────────────────────────────────────
scene("game", () => {
    let score = 0;
    let gameOver = false;
    let rotSpeed = 120; // degrees per second
    let spawnTimer = 0;
    let difficultyTimer = 0;

    const CX = width() / 2;
    const CY = height() / 2;

    const ORBIT_RADIUS = 100;
    const SHIELD_R = 20;
    const BASE_R = 35;
    const ENEMY_R = 12;

    // ── Stars background ─────────────────────────────────────────
    for (let i = 0; i < 60; i++) {
        add([
            pos(rand(0, width()), rand(0, height())),
            circle(rand(0.5, 2)),
            color(255, 255, 255),
            opacity(rand(0.2, 0.8)),
            fixed(),
            z(1),
        ]);
    }

    // ── HUD ──────────────────────────────────────────────────────
    add([
        text("ORBITAL DEFENSE", { size: 14 }),
        pos(CX, 14),
        anchor("center"),
        color(100, 150, 255),
        fixed(),
        z(100),
    ]);

    const scoreLabel = add([
        text("Score: 0", { size: 26 }),
        pos(CX, 42),
        anchor("center"),
        color(255, 255, 255),
        fixed(),
        z(100),
    ]);

    const hintText = add([
        text("Toque para inverter a órbita", { size: 12 }),
        pos(CX, height() - 20),
        anchor("center"),
        color(150, 150, 200),
        opacity(0.7),
        fixed(),
        z(100),
    ]);

    // ── Base (Núcleo) ────────────────────────────────────────────
    const base = add([
        pos(CX, CY),
        circle(BASE_R),
        color(50, 100, 255),
        outline(3, color(30, 60, 200)),
        anchor("center"),
        area(),
        "base",
        z(10),
    ]);

    // Indoor glow ring
    add([
        pos(CX, CY),
        circle(BASE_R - 8),
        color(80, 140, 255),
        opacity(0.15),
        anchor("center"),
        z(9),
    ]);

    // ── Orbital center (invisible, rotates) ─────────────────────
    const orbitPivot = add([
        pos(CX, CY),
        anchor("center"),
        { angle: 0 },
        z(9),
    ]);

    // ── Shield (Escudo) ──────────────────────────────────────────
    const shield = add([
        pos(CX + ORBIT_RADIUS, CY),
        circle(SHIELD_R),
        color(50, 230, 80),
        outline(3, color(30, 180, 60)),
        anchor("center"),
        area(),
        "shield",
        z(11),
    ]);

    // Orbit trail ring (visual only)
    add([
        pos(CX, CY),
        circle(ORBIT_RADIUS),
        color(80, 255, 120),
        opacity(0.07),
        anchor("center"),
        outline(1, color(80, 255, 120, 0.15)),
        z(2),
    ]);

    // ── Orbit update ─────────────────────────────────────────────
    onUpdate(() => {
        if (gameOver) return;
        orbitPivot.angle += rotSpeed * dt();
        const rad = orbitPivot.angle * Math.PI / 180;
        shield.pos.x = orbitPivot.pos.x + Math.cos(rad) * ORBIT_RADIUS;
        shield.pos.y = orbitPivot.pos.y + Math.sin(rad) * ORBIT_RADIUS;
    });

    // ── Tap-to-reverse ───────────────────────────────────────────
    function handleReverse() {
        if (gameOver) return;
        rotSpeed *= -1;
        // Visual feedback
        shield.outline = outline(3, color(100, 255, 150));
        wait(0.12, () => {
            shield.outline = outline(3, color(30, 180, 60));
        });
    }

    onTouchStart(handleReverse);

    // ── Enemy spawning ───────────────────────────────────────────
    function spawnEnemy() {
        const side = rand(0, 4);
        const margin = 40;
        let x, y;

        if (side < 1) { x = rand(0, width()); y = -margin; }
        else if (side < 2) { x = width() + margin; y = rand(0, height()); }
        else if (side < 3) { x = rand(0, width()); y = height() + margin; }
        else { x = -margin; y = rand(0, height()); }

        const dir = vec2(CX - x, CY - y).unit();
        const speed = 70 + difficultyTimer * 2;

        add([
            pos(x, y),
            circle(ENEMY_R),
            color(255, 40, 40),
            outline(2, color(200, 20, 20)),
            anchor("center"),
            area(),
            move(dir, speed),
            "enemy",
            z(5),
        ]);
    }

    onUpdate(() => {
        if (gameOver) return;
        difficultyTimer += dt();
        const interval = Math.max(0.35, 1.4 - difficultyTimer * 0.008);
        spawnTimer += dt();
        if (spawnTimer >= interval) {
            spawnTimer = 0;
            const count = 1 + Math.floor(difficultyTimer / 12);
            for (let i = 0; i < Math.min(count, 6); i++) {
                spawnEnemy();
            }
        }
    });

    // ── Manual collision (onCollide broken in v4000) ────────────
    onUpdate(() => {
        if (gameOver) return;

        const shieldHits = [];
        for (const e of get("enemy")) {
            // Shield collision
            if (shield.pos.dist(e.pos) < SHIELD_R + ENEMY_R) {
                shieldHits.push(e);
                score++;
                scoreLabel.text = "Score: " + score;
                // Flash shield
                shield.color = color(100, 255, 130);
                wait(0.08, () => {
                    if (!gameOver) shield.color = color(50, 230, 80);
                });
                continue;
            }
            // Base collision = game over
            if (base.pos.dist(e.pos) < BASE_R + ENEMY_R) {
                triggerGameOver();
                return;
            }
        }
        for (const e of shieldHits) destroy(e);
    });

    // ── Game Over ────────────────────────────────────────────────
    function triggerGameOver() {
        if (gameOver) return;
        gameOver = true;

        destroyAll("enemy");
        destroy(hintText);

        // Dim overlay
        add([
            rect(width(), height()),
            pos(0, 0),
            color(0, 0, 0),
            opacity(0.55),
            z(90),
            fixed(),
        ]);

        // Panel
        add([
            rect(300, 240),
            pos(CX, CY),
            color(15, 15, 35),
            anchor("center"),
            z(95),
            fixed(),
            opacity(0.95),
        ]);

        add([
            text("GAME OVER", { size: 38 }),
            pos(CX, CY - 55),
            color(255, 50, 50),
            anchor("center"),
            z(100),
            fixed(),
        ]);

        add([
            text("Score: " + score, { size: 28 }),
            pos(CX, CY + 5),
            color(255, 255, 255),
            anchor("center"),
            z(100),
            fixed(),
        ]);

        const restartText = add([
            text("Toque para reiniciar", { size: 16 }),
            pos(CX, CY + 50),
            color(160, 160, 180),
            anchor("center"),
            z(100),
            fixed(),
        ]);

        // Pulsing restart text
        onUpdate(() => {
            if (!gameOver) return;
            restartText.opacity = 0.5 + Math.sin(time() * 3) * 0.5;
        });

        // Restart on touch
        onTouchStart(() => {
            if (gameOver) go("game");
        });
    }
});

go("game");
