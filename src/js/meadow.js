// ===== Meadow - Mushroom Jumping with Jelly Stem Physics =====
(function () {
    const canvas = document.getElementById("meadow-canvas");
    const ctx = canvas.getContext("2d");
    const countLabel = document.getElementById("mushroom-count");
    const rainBtn = document.getElementById("rain-btn");
    const infoModal = document.getElementById("info-modal");
    const infoImg = document.getElementById("info-img");
    const infoArtist = document.getElementById("info-artist");
    const infoDate = document.getElementById("info-date");
    const upCount = document.getElementById("up-count");
    const downCount = document.getElementById("down-count");
    const voteUpBtn = document.getElementById("vote-up");
    const voteDownBtn = document.getElementById("vote-down");
    const infoClose = document.getElementById("info-close");

    // ===== Constants =====
    const GRAVITY = 0.4;
    const MUSHROOM_SCALE = 0.25; // scale factor for drawn mushrooms
    const NUM_SEGMENTS = 5; // number of chain-follow segments
    const SPRING_STIFFNESS = 0.15;
    const SPRING_DAMPING = 0.75;
    const CAP_RATIO = 0.4; // top 40% is cap, bottom 60% is stem
    const JUMP_VELOCITY_MIN = -5;
    const JUMP_VELOCITY_MAX = -9;
    const JUMP_INTERVAL_MIN = 1500;
    const JUMP_INTERVAL_MAX = 4000;
    const WALK_SPEED = 0; // no sliding, mushrooms only move by hopping

    const meadowParams = new URLSearchParams(window.location.search);
    const meadowUserId = meadowParams.get("userId");

    let mushrooms = [];
    let rainDrops = [];
    let isRaining = false;
    let selectedMushroom = null;
    let animTime = 0;
    let maxCapacity = 50;
    const POLL_INTERVAL = 30000; // 30 seconds

    // ===== Resize =====
    function resize() {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // ===== Ground Y =====
    // Each mushroom gets its own groundY in the meadow area (below sky)
    // Range: from 35% to 92% of canvas height (below sky)
    function randomGroundY() {
        return canvas.height * (0.35 + Math.random() * 0.57);
    }

    // ===== Load Mushrooms =====
    function addMushroomToScene(m) {
        // Skip if already loaded
        if (mushrooms.find((existing) => existing.id === (m.docId || m.id))) return;

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const groundY = randomGroundY();
            const w = img.width * MUSHROOM_SCALE;
            const h = img.height * MUSHROOM_SCALE;
            const x = Math.random() * canvas.width - w;

            // Create offscreen canvas for the mushroom
            const mushroomCanvas = document.createElement("canvas");
            mushroomCanvas.width = img.width;
            mushroomCanvas.height = img.height;
            const mctx = mushroomCanvas.getContext("2d");
            mctx.drawImage(img, 0, 0);

            // Chain-follow segments (from cap to base)
            const segments = [];
            for (let i = 0; i < NUM_SEGMENTS; i++) {
                segments.push({ offsetY: 0, vy: 0 });
            }

            // At capacity: remove oldest mushroom
            if (mushrooms.length >= maxCapacity) {
                mushrooms.shift();
            }

            mushrooms.push({
                id: m.docId || m.id,
                data: m,
                mushroomCanvas,
                x,
                baseY: groundY - h,
                y: groundY - h,
                vy: 0,
                width: w,
                height: h,
                groundY,
                isGrounded: true,
                segments,
                nextJumpTime: Date.now() + Math.random() * 2000 + 500,
                enterTime: Date.now(),
                enterDuration: 800,
                vx: 0,
                stiffness: SPRING_STIFFNESS + (Math.random() - 0.5) * 0.06,
                damping: SPRING_DAMPING + (Math.random() - 0.5) * 0.1,
                walkSpeed: WALK_SPEED + Math.random() * 0.3,
            });
        };
        img.src = m.image;
    }

    async function loadMushrooms() {
        const sortMode = meadowUserId ? "random" : "recent";
        const data = await MushroomUtils.getMushrooms(sortMode, maxCapacity, meadowUserId);
        const label = meadowUserId ? "My meadow: " : "";
        countLabel.textContent =
            label + data.length + " mushroom" + (data.length !== 1 ? "s" : "");
        data.forEach(addMushroomToScene);
    }

    // Poll for new mushrooms (skip polling for user-filtered meadow)
    async function checkForNewMushrooms() {
        if (meadowUserId) return;
        const data = await MushroomUtils.getMushrooms("recent", 5);
        data.forEach(addMushroomToScene);
        // Update count
        const total = await MushroomUtils.getMushrooms("recent", 1);
        if (total.length > 0) {
            countLabel.textContent =
                mushrooms.length + " mushroom" + (mushrooms.length !== 1 ? "s" : "");
        }
    }

    // ===== Physics Update =====
    function updateMushroom(m, dt) {
        const now = Date.now();

        // --- Jump trigger ---
        if (m.isGrounded && now >= m.nextJumpTime) {
            m.vy =
                JUMP_VELOCITY_MIN +
                Math.random() * (JUMP_VELOCITY_MAX - JUMP_VELOCITY_MIN);
            m.isGrounded = false;
            m.nextJumpTime =
                now +
                JUMP_INTERVAL_MIN +
                Math.random() * (JUMP_INTERVAL_MAX - JUMP_INTERVAL_MIN);
            // Forward hop impulse (mostly rightward)
            m.vx = 2 + Math.random() * 2;
        }

        // --- Vertical physics (cap) ---
        if (!m.isGrounded) {
            m.vy += GRAVITY;
            m.y += m.vy;

            // Landing
            if (m.y >= m.baseY) {
                m.y = m.baseY;
                m.vy = 0;
                m.isGrounded = true;
                // Landing impact: push segments down (compression)
                for (let i = 1; i < m.segments.length; i++) {
                    m.segments[i].vy += (i / m.segments.length) * 6;
                }
            }
        }

        // --- Horizontal movement: steady left-to-right, loop around ---
        m.x += m.walkSpeed + m.vx;
        m.vx *= m.isGrounded ? 0.85 : 0.99; // low friction in air, high on ground

        // Wrap around: exit right edge → re-enter from left
        if (m.x > canvas.width + m.width) {
            m.x = -m.width;
        }

        // --- Chain-follow spring physics for stem segments ---
        // Segment 0 = cap (follows m.y directly)
        m.segments[0].offsetY = 0;

        for (let i = 1; i < m.segments.length; i++) {
            const target = m.segments[i - 1].offsetY;
            const seg = m.segments[i];

            // Spring force toward parent segment
            const force = (target - seg.offsetY) * m.stiffness;
            seg.vy += force;
            seg.vy *= m.damping;
            seg.offsetY += seg.vy;

            // Clamp to prevent extreme deformation
            const maxOffset = m.height * 0.3;
            seg.offsetY = Math.max(
                -maxOffset,
                Math.min(maxOffset, seg.offsetY),
            );
        }
    }

    // ===== Render Mushroom with Jelly Stem =====
    function drawMushroom(m) {
        const now = Date.now();
        const src = m.mushroomCanvas;
        const srcW = src.width;
        const srcH = src.height;

        // Entrance animation
        let alpha = 1;
        let scale = 1;
        const enterProgress = Math.min(
            1,
            (now - m.enterTime) / m.enterDuration,
        );
        if (enterProgress < 1) {
            alpha = enterProgress;
            scale = 0.3 + 0.7 * easeOutBack(enterProgress);
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        const capEndRow = Math.floor(srcH * CAP_RATIO);
        const stemRows = srcH - capEndRow;

        // The mushroom's top-left render position
        const renderX = m.x;
        const renderY = m.y;

        // Scaled dimensions
        const dstW = m.width * scale;
        const dstH = m.height * scale;
        const capH = (capEndRow / srcH) * dstH;
        const stemH = dstH - capH;
        const rowHeight = Math.max(1, stemH / stemRows);

        // --- Draw Cap (rigid body, no deformation) ---
        ctx.drawImage(
            src,
            0,
            0,
            srcW,
            capEndRow,
            renderX + (m.width - dstW) * 0.5,
            renderY,
            dstW,
            capH,
        );

        // --- Draw Stem row-by-row with jelly offset ---
        const stemStartY = renderY + capH;

        for (let row = 0; row < stemRows; row++) {
            // How far down the stem we are (0 = just below cap, 1 = base)
            const t = row / stemRows;

            // Interpolate segment influence
            const segIndex = t * (m.segments.length - 1);
            const segLow = Math.floor(segIndex);
            const segHigh = Math.min(segLow + 1, m.segments.length - 1);
            const segFrac = segIndex - segLow;

            const offsetY = lerp(
                m.segments[segLow].offsetY,
                m.segments[segHigh].offsetY,
                segFrac,
            );

            // Volume preservation: when compressed vertically, stretch horizontally
            const verticalStrain = offsetY / (m.height * 0.3 || 1);
            const scaleX = 1 + verticalStrain * 0.3 * t; // more stretch at base

            const rowDstY = stemStartY + t * stemH + offsetY;
            const rowDstW = dstW * scaleX;
            const rowDstX = renderX + (m.width - rowDstW) * 0.5; // center horizontally

            ctx.drawImage(
                src,
                0,
                capEndRow + row,
                srcW,
                1,
                rowDstX,
                rowDstY,
                rowDstW,
                rowHeight,
            );
        }

        ctx.restore();
    }

    // ===== Background =====
    const SKY_RATIO = 0.3; // top 30% is sky

    function drawBackground() {
        const w = canvas.width;
        const h = canvas.height;
        const skyH = h * SKY_RATIO;

        // --- Sky ---
        const skyGrad = ctx.createLinearGradient(0, 0, 0, skyH);
        skyGrad.addColorStop(0, "#87CEEB");
        skyGrad.addColorStop(0.7, "#B0E0F0");
        skyGrad.addColorStop(1, "#c8e6c0");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, skyH);

        // Clouds
        drawClouds(animTime, skyH);

        // --- Grass meadow (fills rest of screen) ---
        const meadowGrad = ctx.createLinearGradient(0, skyH, 0, h);
        meadowGrad.addColorStop(0, "#a8d860"); // light green (far horizon)
        meadowGrad.addColorStop(0.3, "#8cc840");
        meadowGrad.addColorStop(0.7, "#6ab030");
        meadowGrad.addColorStop(1, "#509828"); // darker green (near)
        ctx.fillStyle = meadowGrad;
        ctx.fillRect(0, skyH, w, h - skyH);

        // Grass tufts scattered across the meadow
        drawGrassTufts(skyH);
    }

    function drawClouds(time, skyH) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        const clouds = [
            { x: 100, y: 0.3, r: 30 },
            { x: 130, y: 0.2, r: 40 },
            { x: 160, y: 0.3, r: 30 },
            { x: 400, y: 0.45, r: 25 },
            { x: 425, y: 0.35, r: 35 },
            { x: 450, y: 0.45, r: 25 },
            { x: 700, y: 0.25, r: 28 },
            { x: 725, y: 0.15, r: 38 },
            { x: 755, y: 0.25, r: 28 },
        ];
        clouds.forEach((c) => {
            const drift = Math.sin(time * 0.0003 + c.x * 0.01) * 10;
            ctx.beginPath();
            ctx.arc(c.x + drift, c.y * skyH, c.r, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawGrassTufts(skyH) {
        const w = canvas.width;
        const h = canvas.height;
        const meadowH = h - skyH;

        for (let i = 0; i < 800; i++) {
            const seed = i * 137.5;
            const gx = (seed * 7.3) % w;
            // Grass only in meadow area (below sky)
            const gy = skyH + ((seed * 3.7) % meadowH);
            const t = (gy - skyH) / meadowH; // 0=far, 1=near
            const bladeH = 8 + t * 20;
            const sway = Math.sin(animTime * 0.002 + i * 0.8) * (1 + t * 2);

            ctx.strokeStyle = `rgba(30,80,10,${0.35 + t * 0.4})`;
            ctx.lineWidth = 1 + t * 1.5;
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.quadraticCurveTo(
                gx + sway,
                gy - bladeH,
                gx + sway * 0.5,
                gy - bladeH,
            );
            ctx.stroke();
        }
    }

    // ===== Rain =====
    function updateRain() {
        if (isRaining) {
            // Spawn drops
            for (let i = 0; i < 3; i++) {
                rainDrops.push({
                    x: Math.random() * canvas.width,
                    y: -10,
                    vy: 4 + Math.random() * 3,
                    size: 1 + Math.random() * 2,
                });
            }
        }

        // Update drops
        for (let i = rainDrops.length - 1; i >= 0; i--) {
            const drop = rainDrops[i];
            drop.y += drop.vy;

            // Hit ground or mushroom
            if (drop.y > canvas.height) {
                rainDrops.splice(i, 1);
                continue;
            }

            // Check mushroom collision - make them jump
            for (const m of mushrooms) {
                if (
                    m.isGrounded &&
                    drop.x > m.x &&
                    drop.x < m.x + m.width &&
                    drop.y > m.y &&
                    drop.y < m.y + m.height * 0.3
                ) {
                    m.vy = JUMP_VELOCITY_MIN + Math.random() * 3;
                    m.isGrounded = false;
                    rainDrops.splice(i, 1);
                    break;
                }
            }
        }
    }

    function drawRain() {
        ctx.strokeStyle = "rgba(100, 149, 237, 0.6)";
        ctx.lineWidth = 1.5;
        for (const drop of rainDrops) {
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x, drop.y + drop.size * 4);
            ctx.stroke();
        }
    }

    // ===== Click Interaction =====
    canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        // Check if clicked on a mushroom
        for (const m of mushrooms) {
            if (x > m.x && x < m.x + m.width && y > m.y && y < m.y + m.height) {
                showInfo(m);
                return;
            }
        }

        // Scare nearby mushrooms
        for (const m of mushrooms) {
            const dx = m.x + m.width / 2 - x;
            const dy = m.y + m.height / 2 - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200 && m.isGrounded) {
                m.vy = JUMP_VELOCITY_MAX + Math.random() * 3;
                m.isGrounded = false;
                m.vx += (dx / dist) * 3;
            }
        }
    });

    // ===== Info Modal =====
    function showInfo(m) {
        selectedMushroom = m;
        infoImg.src = m.data.image;
        infoArtist.textContent = m.data.artist || "Anonymous";
        infoDate.textContent = new Date(m.data.createdAt).toLocaleDateString();
        upCount.textContent = m.data.upvotes || 0;
        downCount.textContent = m.data.downvotes || 0;
        infoModal.classList.add("show");
    }

    infoClose.addEventListener("click", () => {
        infoModal.classList.remove("show");
        selectedMushroom = null;
    });

    infoModal.addEventListener("click", (e) => {
        if (e.target === infoModal) {
            infoModal.classList.remove("show");
            selectedMushroom = null;
        }
    });

    voteUpBtn.addEventListener("click", async () => {
        if (!selectedMushroom) return;
        const result = await MushroomUtils.vote(selectedMushroom.id, "up");
        if (result && result.error === "login_required") {
            if (confirm("Login required to vote. Go to login page?")) {
                window.location.href = "login.html?redirect=meadow.html";
            }
            return;
        }
        selectedMushroom.data.upvotes =
            (selectedMushroom.data.upvotes || 0) + 1;
        upCount.textContent = selectedMushroom.data.upvotes;
    });

    voteDownBtn.addEventListener("click", async () => {
        if (!selectedMushroom) return;
        const result = await MushroomUtils.vote(selectedMushroom.id, "down");
        if (result && result.error === "login_required") {
            if (confirm("Login required to vote. Go to login page?")) {
                window.location.href = "login.html?redirect=meadow.html";
            }
            return;
        }
        selectedMushroom.data.downvotes =
            (selectedMushroom.data.downvotes || 0) + 1;
        downCount.textContent = selectedMushroom.data.downvotes;
    });

    // ===== Rain Button =====
    rainBtn.addEventListener("click", () => {
        isRaining = !isRaining;
        rainBtn.textContent = isRaining ? "Stop Rain" : "Rain";
    });

    // ===== Animation Loop =====
    function animate(timestamp) {
        animTime = timestamp || 0;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawBackground();

        // Update & draw rain
        updateRain();
        drawRain();

        // Update & draw mushrooms
        for (const m of mushrooms) {
            updateMushroom(m, 16);
        }

        // Sort by Y for depth (further back = drawn first)
        const sorted = [...mushrooms].sort((a, b) => a.baseY - b.baseY);
        for (const m of sorted) {
            drawMushroom(m);
        }

        requestAnimationFrame(animate);
    }

    // ===== Helpers =====
    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    // ===== Init =====
    loadMushrooms();
    requestAnimationFrame(animate);

    // Poll for new mushrooms every 30 seconds
    setInterval(checkForNewMushrooms, POLL_INTERVAL);
})();
