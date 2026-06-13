import kaplay from "kaplay";
import "kaplay/global";

kaplay({
    touchToMouse: true,
    letterbox: true,
    width: 480,
    height: 800,
    background: "#0a0a2e",
});

// ── Native input (funciona em QUALQUER dispositivo) ───────────────
let pendingReverse = false;
let pendingRestart = false;

(function initNativeInput() {
    const check = () => {
        const c = document.querySelector("canvas");
        if (!c) { setTimeout(check, 50); return; }
        c.addEventListener("touchstart", (e) => {
            e.preventDefault();
            pendingReverse = true;
        }, { passive: false });
        c.addEventListener("mousedown", () => {
            pendingReverse = true;
        });
    };
    // Tenta imediatamente e via onLoad como fallback
    check();
    onLoad(() => {
        const c = document.querySelector("canvas");
        if (c) {
            c.addEventListener("touchstart", (e) => {
                e.preventDefault();
                pendingReverse = true;
            }, { passive: false });
        }
    });
})();

// ── Scene ─────────────────────────────────────────────────────────
scene("game", () => {
    let score = 0;
    let gameOver = false;
    let rotSpeed = 120;
    let spawnTimer = 0;
    let difficultyTimer = 0;

    const CX = width() / 2;
    const CY = height() / 2;
    const ORBIT_RADIUS = 100;
    const SHIELD_R = 20;
    const BASE_R = 35;
    const ENEMY_R = 12;

    // Stars
    for (let i = 0; i < 60; i++) {
        add([
            pos(rand(0, width()), rand(0, height())),
            circle(rand(0.5, 2)),
            color(255, 255, 255),
            opacity(rand(0.2, 0.8)),
            fixed(), z(1),
        ]);
    }

    // HUD
    add([
        text("ORBITAL DEFENSE", { size: 14 }),
        pos(CX, 14), anchor("center"),
        color(100, 150, 255), fixed(), z(100),
    ]);

    const scoreLabel = add([
        text("Score: 0", { size: 26 }),
        pos(CX, 42), anchor("center"),
        color(255, 255, 255), fixed(), z(100),
    ]);

    const hintText = add([
        text("Toque para inverter a órbita", { size: 12 }),
        pos(CX, height() - 20), anchor("center"),
        color(150, 150, 200), opacity(0.7), fixed(), z(100),
    ]);

    // Base
    add([
        pos(CX, CY), circle(BASE_R),
        color(50, 100, 255), outline(3, color(30, 60, 200)),
        anchor("center"), area(), "base", z(10),
    ]);
    add([
        pos(CX, CY), circle(BASE_R - 8),
        color(80, 140, 255), opacity(0.15), anchor("center"), z(9),
    ]);

    // Orbit
    const orbitPivot = add([
        pos(CX, CY), anchor("center"), { angle: 0 }, z(9),
    ]);

    const shield = add([
        pos(CX + ORBIT_RADIUS, CY), circle(SHIELD_R),
        color(50, 230, 80), outline(3, color(30, 180, 60)),
        anchor("center"), area(), "shield", z(11),
    ]);

    add([
        pos(CX, CY), circle(ORBIT_RADIUS),
        color(80, 255, 120), opacity(0.07), anchor("center"),
        outline(1, color(80, 255, 120, 0.15)), z(2),
    ]);

    // ── Main update ──────────────────────────────────────────────
    onUpdate(() => {
        if (gameOver) return;

        // Process native input
        if (pendingReverse) {
            pendingReverse = false;
            rotSpeed *= -1;
            shield.outline = outline(3, color(100, 255, 150));
            wait(0.12, () => {
                shield.outline = outline(3, color(30, 180, 60));
            });
        }

        // Orbit rotation
        orbitPivot.angle += rotSpeed * dt();
        const rad = orbitPivot.angle * Math.PI / 180;
        shield.pos.x = orbitPivot.pos.x + Math.cos(rad) * ORBIT_RADIUS;
        shield.pos.y = orbitPivot.pos.y + Math.sin(rad) * ORBIT_RADIUS;

        // Difficulty
        difficultyTimer += dt();
        const interval = Math.max(0.35, 1.4 - difficultyTimer * 0.008);
        spawnTimer += dt();
        if (spawnTimer >= interval) {
            spawnTimer = 0;
            const count = 1 + Math.floor(difficultyTimer / 12);
            for (let i = 0; i < Math.min(count, 6); i++) spawnEnemy();
        }

        // Collision
        const shieldHits = [];
        for (const e of get("enemy")) {
            if (shield.pos.dist(e.pos) < SHIELD_R + ENEMY_R) {
                shieldHits.push(e);
                score++;
                scoreLabel.text = "Score: " + score;
                shield.color = color(100, 255, 130);
                wait(0.08, () => {
                    if (!gameOver) shield.color = color(50, 230, 80);
                });
                continue;
            }
            const baseObj = get("base")[0];
            if (baseObj && baseObj.pos.dist(e.pos) < BASE_R + ENEMY_R) {
                triggerGameOver();
                return;
            }
        }
        for (const e of shieldHits) destroy(e);

        // Restart
        if (pendingRestart && gameOver) {
            pendingRestart = false;
            go("game");
        }
    });

    // Kaplay onClick as backup
    onClick(() => {
        if (gameOver) { pendingRestart = true; return; }
        rotSpeed *= -1;
        shield.outline = outline(3, color(100, 255, 150));
        wait(0.12, () => {
            shield.outline = outline(3, color(30, 180, 60));
        });
    });

    // ── Enemy spawn ──────────────────────────────────────────────
    function spawnEnemy() {
        const side = rand(0, 4);
        const margin = 40;
        let x, y;
        if (side < 1) { x = rand(0, width()); y = -margin; }
        else if (side < 2) { x = width() + margin; y = rand(0, height()); }
        else if (side < 3) { x = rand(0, width()); y = height() + margin; }
        else { x = -margin; y = rand(0, height()); }

        const dir = vec2(CX - x, CY - y).unit();
        add([
            pos(x, y), circle(ENEMY_R),
            color(255, 40, 40), outline(2, color(200, 20, 20)),
            anchor("center"), area(),
            move(dir, 70 + difficultyTimer * 2), "enemy", z(5),
        ]);
    }

    // ── Game Over ────────────────────────────────────────────────
    function triggerGameOver() {
        if (gameOver) return;
        gameOver = true;
        pendingRestart = false;
        destroyAll("enemy");
        destroy(hintText);

        add([
            rect(width(), height()), pos(0, 0),
            color(0, 0, 0), opacity(0.55), z(90), fixed(),
        ]);
        add([
            rect(300, 240), pos(CX, CY),
            color(15, 15, 35), anchor("center"), z(95), fixed(), opacity(0.95),
        ]);
        add([
            text("GAME OVER", { size: 38 }),
            pos(CX, CY - 55), color(255, 50, 50), anchor("center"), z(100), fixed(),
        ]);
        add([
            text("Score: " + score, { size: 28 }),
            pos(CX, CY + 5), color(255, 255, 255), anchor("center"), z(100), fixed(),
        ]);

        const rt = add([
            text("Toque para reiniciar", { size: 16 }),
            pos(CX, CY + 50), color(160, 160, 180), anchor("center"), z(100), fixed(),
        ]);

        onUpdate(() => {
            if (!gameOver) return;
            rt.opacity = 0.5 + Math.sin(time() * 3) * 0.5;
        });
    }
});

go("game");
