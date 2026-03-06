// ===== Ranking Page =====
(function () {
    const grid = document.getElementById("rank-grid");
    const emptyMsg = document.getElementById("rank-empty");
    const sortBtns = document.querySelectorAll(".sort-btn");
    const myMushroomBtn = document.getElementById("my-mushroom-btn");

    const deleteModal = document.getElementById("delete-modal");
    const deleteConfirm = document.getElementById("delete-confirm");
    const deleteCancel = document.getElementById("delete-cancel");
    let deleteMushroomId = null;

    deleteCancel.addEventListener("click", () => {
        deleteModal.style.display = "none";
    });

    deleteModal.addEventListener("click", (e) => {
        if (e.target === deleteModal) deleteModal.style.display = "none";
    });

    deleteConfirm.addEventListener("click", async () => {
        deleteConfirm.disabled = true;
        deleteConfirm.textContent = "Deleting...";
        const result = await MushroomUtils.deleteMushroom(deleteMushroomId);
        deleteModal.style.display = "none";
        deleteConfirm.disabled = false;
        deleteConfirm.textContent = "Delete";
        if (result && result.success) render();
    });

    const reportModal = document.getElementById("report-modal");
    const reportInput = document.getElementById("report-input");
    const reportSubmit = document.getElementById("report-submit");
    const reportCancel = document.getElementById("report-cancel");
    let reportMushroomId = null;

    const params = new URLSearchParams(window.location.search);
    const currentUser = MushroomUtils.getUserData();

    // Report modal input validation
    reportInput.addEventListener("input", () => {
        reportSubmit.disabled = !reportInput.value.trim();
    });

    reportCancel.addEventListener("click", () => {
        reportModal.style.display = "none";
    });

    reportModal.addEventListener("click", (e) => {
        if (e.target === reportModal) reportModal.style.display = "none";
    });

    reportSubmit.addEventListener("click", async () => {
        const reason = reportInput.value.trim();
        if (!reason) return;

        reportSubmit.disabled = true;
        reportSubmit.textContent = "Submitting...";

        const result = await MushroomUtils.report(reportMushroomId, reason);
        if (result && result.error === "login_required") {
            if (confirm("Login required to report. Go to login page?")) {
                window.location.href = "login.html?redirect=rank.html";
            }
        } else if (result && result.error === "You already reported this mushroom") {
            alert("You have already reported this mushroom.");
        } else if (result && result.success) {
            alert("Thank you for your report. We will review it.");
        }

        reportModal.style.display = "none";
        reportSubmit.textContent = "Submit Report";
        reportSubmit.disabled = true;
        reportInput.value = "";
    });

    // Show "My Mushroom" button only when logged in
    if (currentUser && myMushroomBtn) {
        myMushroomBtn.style.display = "";
    }

    const initialSort = params.get("sort") || "score-desc";
    let currentSort = initialSort;

    // Highlight the correct sort button
    sortBtns.forEach((b) => {
        const sort = b.dataset.sort;
        b.classList.toggle("active", sort === currentSort || (sort === "score-desc" && currentSort === "score-asc"));
    });

    // Update Score button label based on direction
    function updateScoreBtn() {
        const scoreBtn = document.querySelector('.sort-btn[data-sort="score-desc"]');
        if (scoreBtn) {
            if (currentSort === "score-asc") {
                scoreBtn.innerHTML = "Score &#9650;";
                scoreBtn.dataset.sort = "score-asc";
            } else {
                scoreBtn.innerHTML = "Score &#9660;";
                scoreBtn.dataset.sort = "score-desc";
            }
        }
    }
    updateScoreBtn();

    // Update title based on sort mode
    function updateTitle() {
        const title = document.querySelector(".rank-title");
        if (title) {
            title.textContent = currentSort === "my" ? "My Mushrooms" : "Mushroom Ranking";
        }
    }
    updateTitle();

    async function render() {
        let mushrooms;
        if (currentSort === "my" && currentUser) {
            mushrooms = await MushroomUtils.getMushrooms("recent", 100, currentUser.uid);
        } else {
            mushrooms = await MushroomUtils.getMushrooms(currentSort, 100);
        }

        if (mushrooms.length === 0) {
            grid.style.display = "none";
            emptyMsg.style.display = "block";
            return;
        }

        grid.style.display = "";
        emptyMsg.style.display = "none";
        grid.innerHTML = "";

        mushrooms.forEach((m, index) => {
            const card = document.createElement("div");
            card.className = "rank-card";

            const id = m.docId || m.id;
            const isScoreSort = currentSort === "score-desc" || currentSort === "score-asc";
            const rank = isScoreSort ? index + 1 : null;
            const score = (m.upvotes || 0) - (m.downvotes || 0);
            const dateStr = m.createdAt
                ? new Date(
                      m.createdAt._seconds
                          ? m.createdAt._seconds * 1000
                          : m.createdAt,
                  ).toLocaleDateString()
                : "";

            const showDelete = currentSort === "my" && currentUser && m.userId === currentUser.uid;

            card.innerHTML = `
                ${rank ? `<div class="rank-badge">#${rank}</div>` : ""}
                <img class="rank-img" src="${m.image}" alt="Mushroom" crossorigin="anonymous">
                <div class="rank-info">
                    <div class="rank-artist">${m.artist || "Anonymous"}</div>
                    <div class="rank-date">${dateStr}</div>
                    <div class="rank-score">Score: ${score >= 0 ? "+" : ""}${score}</div>
                </div>
                <div class="rank-actions">
                    <button class="rank-vote-btn up" data-id="${id}" data-type="up">\ud83d\udc4d ${m.upvotes || 0}</button>
                    <button class="rank-vote-btn down" data-id="${id}" data-type="down">\ud83d\udc4e ${m.downvotes || 0}</button>
                    <button class="rank-report-btn" data-id="${id}" title="Report inappropriate content">\ud83d\udea9</button>
                </div>
                ${showDelete ? `<button class="rank-delete-btn" data-id="${id}" title="Delete">&#10005;</button>` : ""}
            `;

            grid.appendChild(card);
        });

        // Delete button listeners
        grid.querySelectorAll(".rank-delete-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                deleteMushroomId = btn.dataset.id;
                deleteModal.style.display = "flex";
            });
        });

        // Vote button listeners
        grid.querySelectorAll(".rank-vote-btn").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const result = await MushroomUtils.vote(
                    btn.dataset.id,
                    btn.dataset.type,
                );
                if (result && result.error === "login_required") {
                    if (confirm("Login required to vote. Go to login page?")) {
                        window.location.href = "login.html?redirect=rank.html";
                    }
                    return;
                }
                render();
            });
        });

        // Report button listeners
        grid.querySelectorAll(".rank-report-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                reportMushroomId = btn.dataset.id;
                reportInput.value = "";
                reportSubmit.disabled = true;
                reportModal.style.display = "flex";
            });
        });
    }

    // Sort button listeners
    sortBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const sort = btn.dataset.sort;

            // Toggle score direction when clicking the Score button again
            if (sort === "score-desc" || sort === "score-asc") {
                currentSort = currentSort === "score-desc" ? "score-asc" : "score-desc";
                btn.dataset.sort = currentSort;
                btn.innerHTML = currentSort === "score-asc" ? "Score &#9650;" : "Score &#9660;";
            } else {
                currentSort = sort;
            }

            sortBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            updateTitle();
            render();
        });
    });

    render();
})();
