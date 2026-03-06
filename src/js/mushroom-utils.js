// ===== Mushroom Utilities (API-backed) =====
const MushroomUtils = {
    // Auto-detect backend URL
    BACKEND_URL: (() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("local") === "true") return "http://localhost:8080";
        if (params.get("prod") === "true")
            return "https://mushroom-backend-484914785040.us-central1.run.app"; // TODO: replace after deploy
        if (
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1"
        )
            return "http://localhost:8080";
        return "https://mushroom-backend-484914785040.us-central1.run.app"; // TODO: replace after deploy
    })(),

    // --- Auth helpers ---
    getToken() {
        return localStorage.getItem("userToken");
    },

    getUserData() {
        try {
            return JSON.parse(localStorage.getItem("userData"));
        } catch {
            return null;
        }
    },

    isLoggedIn() {
        return !!(this.getToken() && this.getUserData());
    },

    saveAuth(token, user) {
        localStorage.setItem("userToken", token);
        localStorage.setItem("userData", JSON.stringify(user));
    },

    logout() {
        localStorage.removeItem("userToken");
        localStorage.removeItem("userData");
        if (typeof auth !== "undefined") {
            auth.signOut();
        }
    },

    getDisplayName() {
        const user = this.getUserData();
        return user ? user.displayName || user.email : null;
    },

    _authHeaders() {
        const headers = {};
        const token = this.getToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
        return headers;
    },

    // --- Mushroom API ---
    async getMushrooms(sort = "recent", limit = 50, userId = null) {
        let url;
        if (sort === "random") {
            url = `${this.BACKEND_URL}/api/mushroom?random=true&limit=${limit}`;
        } else if (sort === "score-desc") {
            url = `${this.BACKEND_URL}/api/mushroom?orderBy=score&order=desc&limit=${limit}`;
        } else if (sort === "score-asc") {
            url = `${this.BACKEND_URL}/api/mushroom?orderBy=score&order=asc&limit=${limit}`;
        } else {
            url = `${this.BACKEND_URL}/api/mushroom?orderBy=createdAt&order=desc&limit=${limit}`;
        }
        if (userId) url += `&userId=${encodeURIComponent(userId)}`;

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Fetch failed");
            return await res.json();
        } catch (err) {
            console.error("getMushrooms error:", err);
            return [];
        }
    },

    async uploadMushroom(imageBlob, artist) {
        const formData = new FormData();
        formData.append("image", imageBlob, "mushroom.png");
        formData.append("artist", artist);

        // Send anonymous userId if not logged in
        const anonId = localStorage.getItem("anonymousUserId");
        if (anonId && !this.isLoggedIn()) {
            formData.append("userId", anonId);
        }

        try {
            const res = await fetch(`${this.BACKEND_URL}/uploadmushroom`, {
                method: "POST",
                headers: this._authHeaders(),
                body: formData,
            });
            if (!res.ok) throw new Error("Upload failed");
            const result = await res.json();

            // Save anonymous userId from server (only when not logged in)
            if (result && result.data && result.data.userId && !this.isLoggedIn()) {
                localStorage.setItem("anonymousUserId", result.data.userId);
            }

            return result;
        } catch (err) {
            console.error("uploadMushroom error:", err);
            return null;
        }
    },

    async deleteMushroom(mushroomId) {
        try {
            const res = await fetch(`${this.BACKEND_URL}/api/mushroom/${mushroomId}`, {
                method: "DELETE",
                headers: this._authHeaders(),
            });
            if (!res.ok) throw new Error("Delete failed");
            return await res.json();
        } catch (err) {
            console.error("deleteMushroom error:", err);
            return null;
        }
    },

    async vote(mushroomId, type) {
        if (!this.isLoggedIn()) {
            return { error: "login_required" };
        }

        try {
            const res = await fetch(`${this.BACKEND_URL}/api/vote`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...this._authHeaders(),
                },
                body: JSON.stringify({ mushroomId, voteType: type }),
            });
            if (!res.ok) throw new Error("Vote failed");
            return await res.json();
        } catch (err) {
            console.error("vote error:", err);
            return null;
        }
    },

    async report(mushroomId, reason) {
        if (!this.isLoggedIn()) {
            return { error: "login_required" };
        }

        try {
            const res = await fetch(`${this.BACKEND_URL}/api/report`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...this._authHeaders(),
                },
                body: JSON.stringify({ mushroomId, reason }),
            });
            return await res.json();
        } catch (err) {
            console.error("report error:", err);
            return null;
        }
    },

    // --- Auth UI helper ---
    updateAuthNav() {
        const navAuth = document.getElementById("nav-auth");
        if (!navAuth) return;

        if (this.isLoggedIn()) {
            const name = this.getDisplayName() || "User";
            navAuth.innerHTML = `
                <a href="#" id="logout-link">Logout</a>
            `;
            document.getElementById("logout-link").addEventListener("click", (e) => {
                e.preventDefault();
                this.logout();
                window.location.reload();
            });
        } else {
            navAuth.innerHTML = `<a href="login.html">Login</a>`;
        }
    },
};
