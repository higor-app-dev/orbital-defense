import kaplay from "kaplay";
import "kaplay/global";

kaplay({
    touchToMouse: true,
    letterbox: true,
    width: 480,
    height: 800,
    background: "#0a0a2e",
});

// ── Native input ──────────────────────────────────────────────────
let pendingReverse = false;
let pendingRestart = false;

(function initInput() {
    const tryAttach = () => {
        const c = document.querySelector("canvas");
        if (!c) { setTimeout(tryAttach, 50); return; }
        c.addEventListener("touchstart", (e) => {
            e.preventDefault();
            pendingReverse = true;
        }, { passive: false });
        c.addEventListener("mousedown", () => {
            pendingReverse = true;
        });
    };
    tryAttach();
})();

// ── Scene ─────────────────────────────────────────────────────────
scene("game", () => {
    let score = 0;
    let gameOver = false;
    let rotSpeed = 120;
    let spawnTimer = 0;
    let diffTimer = 0;

    const CX = width() / 2, CY = height() / 2;
    const ORBIT_RADIUS = 100, SHIELD_R = 20, BASE_R = 35, ENEMY_R = 12;

    // ── DEBUG: ring that rotates visibly ─────────────────────────
    // A line/indicator to show orbit is working
    let orbitAngle = 0;

    // Stars
    for (let i = 0; i < 60; i++) add([
        pos(rand(0, width()), rand(0, height())),
        circle(rand(0.5, 2)), color(255, 255, 255),
        opacity(rand(0.2, 0.8)), fixed(), z(1),
    ]);

    // HUD
    add([ text("ORBITAL DEFENSE", { size: 14 }), pos(CX, 14),
          anchor("center"), color(100, 150, 255), fixed(), z(100) ]);
    const scoreLabel = add([ text("Score: 0", { size: 26 }), pos(CX, 42),
          anchor("center"), color(255, 255, 255), fixed(), z(100) ]);

    // DEBUG: show orbit angle
    const debugText = add([ text("", { size: 11 }), pos(10, 10),
          color(255, 255, 0), fixed(), z(200) ]);

    const hintText = add([ text("Toque para inverter a órbita", { size: 12 }),
          pos(CX, height() - 20), anchor("center"),
          color(150, 150, 200), opacity(0.7), fixed(), z(100) ]);

    // Base - BIG so enemies can't miss it (debug)
    add([ pos(CX, CY), circle(BASE_R), color(50, 100, 255),
          outline(3, color(30, 60, 200)), anchor("center"), area(), "base", z(10) ]);

    // Orbit ring - visible
    const orbitRing = add([ pos(CX, CY), circle(ORBIT_RADIUS),
          color(80, 255, 120), opacity(0.15), anchor("center"),
          outline(2, color(80, 255, 120)), z(2) ]);

    // Orbital position indicator (small dot on the ring path)
    const orbitDot = add([ pos(CX + ORBIT_RADIUS, CY), circle(4),
          color(255, 255, 0), anchor("center"), z(3) ]);

    // Shield
    const shield = add([ pos(CX + ORBIT_RADIUS, CY), circle(SHIELD_R),
          color(50, 230, 80), outline(3, color(30, 180, 60)),
          anchor("center"), area(), "shield", z(11) ]);

    // ── Update ──────────────────────────────────────────────────
    let frameCount = 0;
    onUpdate(() => {
        frameCount++;

        // Process input
        if (pendingReverse && !gameOver) {
            pendingReverse = false;
            rotSpeed *= -1;
            shield.outline = outline(3, color(100, 255, 150));
            wait(0.12, () => {
                shield.outline = outline(3, color(30, 180, 60));
            });
        }
        if (pendingRestart && gameOver) {
            pendingRestart = false;
            go("game");
            return;
        }
        if (gameOver) {
            debugText.text = "GAME OVER frame:" + frameCount;
            return;
        }

        // Orbit
        orbitAngle += rotSpeed * dt();

        // Keep angle in 0-360 range
        if (orbitAngle > 360) orbitAngle -= 360;
        if (orbitAngle < 0) orbitAngle += 360;

        const rad = orbitAngle * Math.PI / 180;
        const sx = CX + Math.cos(rad) * ORBIT_RADIUS;
        const sy = CY + Math.sin(rad) * ORBIT_RADIUS;

        shield.moveTo(sx, sy);
        orbitDot.moveTo(sx, sy);

        // DEBUG
        debugText.text = "ang:" + Math.round(orbitAngle) + " spd:" + Math.round(rotSpeed) + " f:" + frameCount;

        // Pulsing orbit ring
        orbitRing.opacity = 0.1 + Math.sin(time() * 2) * 0.05;

        // Spawn
        diffTimer += dt();
        const interval = Math.max(0.35, 1.4 - diffTimer * 0.008);
        spawnTimer += dt();
        if (spawnTimer >= interval) {
            spawnTimer = 0;
            for (let i = 0; i < Math.min(1 + Math.floor(diffTimer / 12), 6); i++)
                spawnEnemy();
        }

        // Collision
        const hits = [];
        for (const e of get("enemy")) {
            if (shield.pos.dist(e.pos) < SHIELD_R + ENEMY_R) {
                hits.push(e);
                score++;
                scoreLabel.text = "Score: " + score;
                shield.color = color(100, 255, 130);
                wait(0.08, () => {
                    if (!gameOver) shield.color = color(50, 230, 80);
                });
                continue;
            }
            if (get("base")[0]?.pos.dist(e.pos) < BASE_R + ENEMY_R) {
                triggerGameOver();
                return;
            }
        }
        for (const e of hits) destroy(e);
    });

    // Backup click
    onClick(() => {
        if (gameOver) pendingRestart = true;
        else pendingReverse = true;
    });

    function spawnEnemy() {
        const side = rand(0, 4), margin = 40;
        let x, y;
        if (side < 1) { x = rand(0, width()); y = -margin; }
        else if (side < 2) { x = width() + margin; y = rand(0, height()); }
        else if (side < 3) { x = rand(0, width()); y = height() + margin; }
        else { x = -margin; y = rand(0, height()); }
        add([
            pos(x, y), circle(ENEMY_R),
            color(255, 40, 40), outline(2, color(200, 20, 20)),
            anchor("center"), area(),
            move(vec2(CX - x, CY - y).unit(), 70 + diffTimer * 2),
            "enemy", z(5),
        ]);
    }

    function triggerGameOver() {
        if (gameOver) return;
        gameOver = true;
        destroyAll("enemy");
        destroy(hintText);

        add([ rect(width(), height()), pos(0, 0), color(0, 0, 0),
              opacity(0.55), z(90), fixed() ]);
        add([ rect(300, 240), pos(CX, CY), color(15, 15, 35),
              anchor("center"), z(95), fixed(), opacity(0.95) ]);
        add([ text("GAME OVER", { size: 38 }), pos(CX, CY - 55),
              color(255, 50, 50), anchor("center"), z(100), fixed() ]);
        add([ text("Score: " + score, { size: 28 }), pos(CX, CY + 5),
              color(255, 255, 255), anchor("center"), z(100), fixed() ]);
        const rt = add([ text("Toque para reiniciar", { size: 16 }),
              pos(CX, CY + 50), color(160, 160, 180),
              anchor("center"), z(100), fixed() ]);
        onUpdate(() => { if (gameOver) rt.opacity = 0.5 + Math.sin(time() * 3) * 0.5; });
    }
});

go("game");
