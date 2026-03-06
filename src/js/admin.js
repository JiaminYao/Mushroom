// ===== Admin Page =====
(function () {
    const denied = document.getElementById("admin-denied");
    const content = document.getElementById("admin-content");
    const grid = document.getElementById("admin-grid");
    const emptyMsg = document.getElementById("admin-empty");

    if (!MushroomUtils.isLoggedIn()) {
        denied.style.display = "block";
        return;
    }

    async function loadReports() {
        try {
            const res = await fetch(`${MushroomUtils.BACKEND_URL}/api/admin/reports`, {
                headers: MushroomUtils._authHeaders(),
            });

            if (res.status === 403) {
                denied.style.display = "block";
                return;
            }

            if (!res.ok) throw new Error("Fetch failed");

            const reports = await res.json();
            content.style.display = "block";

            if (reports.length === 0) {
                grid.style.display = "none";
                emptyMsg.style.display = "block";
                return;
            }

            grid.style.display = "";
            emptyMsg.style.display = "none";
            grid.innerHTML = "";

            reports.forEach((r) => {
                const card = document.createElement("div");
                card.className = "admin-card";

                const dateStr = r.createdAt
                    ? new Date(
                          r.createdAt._seconds
                              ? r.createdAt._seconds * 1000
                              : r.createdAt,
                      ).toLocaleString()
                    : "";

                card.innerHTML = `
                    <div class="admin-card-img">
                        ${r.mushroom ? `<img src="${r.mushroom.image}" alt="Mushroom" crossorigin="anonymous">` : "<span>Deleted</span>"}
                    </div>
                    <div class="admin-card-info">
                        <div class="admin-card-artist">${r.mushroom ? r.mushroom.artist : "Unknown"}</div>
                        <div class="admin-card-reason"><strong>Reason:</strong> ${r.reason}</div>
                        <div class="admin-card-date">${dateStr}</div>
                    </div>
                    <div class="admin-card-actions">
                        <button class="admin-btn delete" data-id="${r.id}">Delete Mushroom</button>
                        <button class="admin-btn dismiss" data-id="${r.id}">Dismiss</button>
                    </div>
                `;

                grid.appendChild(card);
            });

            // Delete button listeners
            grid.querySelectorAll(".admin-btn.delete").forEach((btn) => {
                btn.addEventListener("click", async () => {
                    if (!confirm("Delete this mushroom permanently?")) return;
                    await resolveReport(btn.dataset.id, "delete");
                });
            });

            // Dismiss button listeners
            grid.querySelectorAll(".admin-btn.dismiss").forEach((btn) => {
                btn.addEventListener("click", async () => {
                    await resolveReport(btn.dataset.id, "dismiss");
                });
            });
        } catch (err) {
            console.error("Load reports error:", err);
            content.style.display = "block";
            grid.style.display = "none";
            emptyMsg.style.display = "block";
            emptyMsg.textContent = "Error loading reports: " + err.message;
        }
    }

    async function resolveReport(reportId, action) {
        try {
            const res = await fetch(
                `${MushroomUtils.BACKEND_URL}/api/admin/reports/${reportId}/resolve`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...MushroomUtils._authHeaders(),
                    },
                    body: JSON.stringify({ action }),
                },
            );

            if (!res.ok) throw new Error("Resolve failed");
            loadReports(); // Refresh list
        } catch (err) {
            console.error("Resolve error:", err);
            alert("Failed to resolve report");
        }
    }

    loadReports();
})();
