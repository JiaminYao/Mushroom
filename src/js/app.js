// ===== Drawing Page =====
(function () {
    const canvas = document.getElementById("draw-canvas");
    const ctx = canvas.getContext("2d");
    const wrapper = document.getElementById("canvas-wrapper");
    const toolsBar = document.getElementById("tools");
    const aiFeedback = document.getElementById("ai-feedback");
    const submitBtn = document.getElementById("submit-btn");
    const submitModal = document.getElementById("submit-modal");
    const modalContent = document.getElementById("modal-content");
    const modalTitle = document.getElementById("modal-title");
    const modalDesc = document.getElementById("modal-desc");
    const artistInput = document.getElementById("artist-input");
    const modalCancel = document.getElementById("modal-cancel");
    const modalConfirm = document.getElementById("modal-confirm");

    // ===== State =====
    let isDrawing = false;
    let currentColor = "#000000";
    let currentSize = 6;
    let isEraser = false;
    let undoStack = [];
    const MAX_UNDO = 30;
    let hasDrawn = false;

    // ===== Colors =====
    const COLORS = [
        "#000000",
        "#ffffff",
        "#808080",
        "#3e2723",
        "#795548",
        "#c8a96e",
        "#ffcc99",
        "#f5deb3",
        "#c0392b",
        "#e74c3c",
        "#e67e22",
        "#f39c12",
        "#f1c40f",
        "#27ae60",
        "#1abc9c",
        "#90ee90",
        "#1a3a5c",
        "#2980b9",
        "#85c1e9",
        "#9b59b6",
        "#c39bd3",
        "#e91e63",
        "#ff7f7f",
        "#f8b4c8",
    ];

    // ===== Init Tools =====
    function initTools() {
        // --- Color palette row ---
        const colorRow = document.createElement("div");
        colorRow.className = "tools-color-row";
        COLORS.forEach((color) => {
            const btn = document.createElement("button");
            btn.className =
                "color-btn" + (color === currentColor ? " active" : "");
            btn.style.background = color;
            if (color === "#ffffff") btn.style.border = "2px solid #ccc";
            btn.addEventListener("click", () => {
                isEraser = false;
                currentColor = color;
                updateToolState();
            });
            colorRow.appendChild(btn);
        });
        toolsBar.appendChild(colorRow);

        // --- Action buttons row ---
        const actionRow = document.createElement("div");
        actionRow.className = "tools-action-row";

        // Size slider
        const sizeGroup = document.createElement("div");
        sizeGroup.className = "size-group";
        const sizeLabel = document.createElement("span");
        sizeLabel.className = "size-label";
        sizeLabel.textContent = "Size";
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "1";
        slider.max = "20";
        slider.value = String(currentSize);
        slider.className = "size-slider";
        slider.addEventListener("input", (e) => {
            currentSize = parseInt(e.target.value);
        });
        sizeGroup.appendChild(sizeLabel);
        sizeGroup.appendChild(slider);
        actionRow.appendChild(sizeGroup);

        // Eraser
        const eraserBtn = document.createElement("button");
        eraserBtn.className = "tool-btn";
        eraserBtn.textContent = "Eraser";
        eraserBtn.id = "eraser-btn";
        eraserBtn.addEventListener("click", () => {
            isEraser = !isEraser;
            updateToolState();
        });
        actionRow.appendChild(eraserBtn);

        // Undo
        const undoBtn = document.createElement("button");
        undoBtn.className = "tool-btn";
        undoBtn.textContent = "Undo";
        undoBtn.addEventListener("click", undo);
        actionRow.appendChild(undoBtn);

        // Clear
        const clearBtn = document.createElement("button");
        clearBtn.className = "tool-btn";
        clearBtn.textContent = "Clear";
        clearBtn.addEventListener("click", clearCanvas);
        actionRow.appendChild(clearBtn);

        toolsBar.appendChild(actionRow);
    }

    function updateToolState() {
        // Update color buttons
        toolsBar.querySelectorAll(".color-btn").forEach((btn, i) => {
            btn.classList.toggle(
                "active",
                COLORS[i] === currentColor && !isEraser,
            );
        });
        // Update eraser
        const eraserBtn = document.getElementById("eraser-btn");
        eraserBtn.classList.toggle("active", isEraser);
    }

    // ===== Canvas Drawing =====
    function saveState() {
        if (undoStack.length >= MAX_UNDO) undoStack.shift();
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }

    function undo() {
        if (undoStack.length === 0) return;
        const state = undoStack.pop();
        ctx.putImageData(state, 0, 0);
    }

    function clearCanvas() {
        saveState();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn = false;
        aiFeedback.textContent = "";
        wrapper.style.background = "#fff";
    }

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if (e.touches) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY,
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    }

    function startDraw(e) {
        e.preventDefault();
        isDrawing = true;
        saveState();
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);

        ctx.lineWidth = currentSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (isEraser) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = currentColor;
        }

        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    function endDraw(e) {
        if (!isDrawing) return;
        isDrawing = false;
        ctx.beginPath();
        hasDrawn = true;
        checkMushroom();
    }

    // Mouse events
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", endDraw);
    canvas.addEventListener("mouseleave", endDraw);

    // Touch events
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", endDraw);
    canvas.addEventListener("touchcancel", endDraw);

    // Keyboard shortcut
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
            e.preventDefault();
            undo();
        }
    });

    // ===== AI Check (Simple heuristic for MVP) =====
    function checkMushroom() {
        if (!hasDrawn) return;

        // Simple heuristic: check if there's enough drawn content
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let filledPixels = 0;
        const totalPixels = canvas.width * canvas.height;

        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] > 0) filledPixels++;
        }

        const fillRatio = filledPixels / totalPixels;

        // For MVP: accept anything with enough content (>2% filled)
        if (fillRatio > 0.02) {
            const confidence = Math.min(0.95, fillRatio * 5 + 0.3);
            aiFeedback.textContent = `Mushroom: ${(confidence * 100).toFixed(0)}%`;
            aiFeedback.style.color = "#27ae60";
            wrapper.style.background = "#eaffea";
        } else {
            aiFeedback.textContent = "Keep drawing...";
            aiFeedback.style.color = "#999";
            wrapper.style.background = "#fff";
        }
    }

    // ===== Submit =====
    submitBtn.addEventListener("click", () => {
        if (!hasDrawn) return;

        // Check if canvas has content
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let filledPixels = 0;
        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] > 0) filledPixels++;
        }
        if (filledPixels < canvas.width * canvas.height * 0.01) {
            aiFeedback.textContent = "Draw more!";
            aiFeedback.style.color = "#c0392b";
            return;
        }

        // Default artist name
        artistInput.value = "Anonymous";
        modalConfirm.disabled = false;
        submitModal.classList.add("show");
    });

    // Disable Plant button when name is empty
    artistInput.addEventListener("input", () => {
        modalConfirm.disabled = !artistInput.value.trim();
    });

    modalCancel.addEventListener("click", () => {
        submitModal.classList.remove("show");
    });

    submitModal.addEventListener("click", (e) => {
        if (e.target === submitModal) submitModal.classList.remove("show");
    });

    modalConfirm.addEventListener("click", async () => {
        const artist = artistInput.value.trim();
        if (!artist) return;

        // Disable button during upload
        modalConfirm.disabled = true;
        modalConfirm.textContent = "Planting...";

        // Convert canvas to blob and upload via API
        canvas.toBlob(async (blob) => {
            try {
                const result = await MushroomUtils.uploadMushroom(blob, artist);
                if (result && result.success) {
                    submitModal.classList.remove("show");
                    window.location.href = "meadow.html";
                } else {
                    modalConfirm.disabled = false;
                    modalConfirm.textContent = "Plant it!";
                    alert("Upload failed. Please try again.");
                }
            } catch (err) {
                console.error("Submit error:", err);
                modalConfirm.disabled = false;
                modalConfirm.textContent = "Plant it!";
                alert("Upload failed. Please try again.");
            }
        }, "image/png");
    });

    // ===== Init =====
    initTools();
    ctx.fillStyle = "transparent";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
})();
