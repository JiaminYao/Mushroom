(function () {
    const params = new URLSearchParams(window.location.search);
    const viewUserId = params.get("userId");

    const loginPrompt = document.getElementById("login-prompt");
    const profileContent = document.getElementById("profile-content");
    const avatarEl = document.getElementById("profile-avatar");
    const nameEl = document.getElementById("profile-name");
    const dateEl = document.getElementById("profile-date");
    const editNameBtn = document.getElementById("edit-name-btn");
    const nameEdit = document.getElementById("name-edit");
    const nameInput = document.getElementById("name-input");
    const nameSave = document.getElementById("name-save");
    const nameCancel = document.getElementById("name-cancel");
    const toastEl = document.getElementById("profile-toast");

    // Determine which user to show
    let userId = viewUserId;
    let isOwnProfile = false;

    if (!userId) {
        // No userId param — show own profile
        if (!MushroomUtils.isLoggedIn()) {
            loginPrompt.style.display = "block";
            return;
        }
        const userData = MushroomUtils.getUserData();
        userId = userData.uid;
        isOwnProfile = true;
    } else {
        const userData = MushroomUtils.getUserData();
        isOwnProfile = userData && userData.uid === userId;
    }

    profileContent.style.display = "block";

    // Show edit button only for own profile
    if (isOwnProfile) {
        editNameBtn.style.display = "inline-block";
    }

    // Load profile data
    loadProfile(userId);

    async function loadProfile(uid) {
        try {
            const res = await fetch(`${MushroomUtils.BACKEND_URL}/api/profile/${uid}`);
            if (!res.ok) throw new Error("Failed to fetch profile");
            const data = await res.json();

            // Avatar
            const initial = (data.displayName || "?").charAt(0).toUpperCase();
            avatarEl.textContent = initial;

            // Name
            const suffix = isOwnProfile ? "" : "";
            nameEl.textContent = data.displayName + suffix;

            // Join date
            if (data.createdAt) {
                const date = new Date(data.createdAt);
                dateEl.textContent = "Joined " + date.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                });
            }

            // Stats
            document.getElementById("stat-mushrooms").textContent = data.mushroomCount;
            const scoreEl = document.getElementById("stat-score");
            scoreEl.textContent = data.totalScore;
            if (data.totalScore > 0) scoreEl.classList.add("stat-up");
            else if (data.totalScore < 0) scoreEl.classList.add("stat-down");

            document.getElementById("stat-upvotes").textContent = data.totalUpvotes;
            document.getElementById("stat-downvotes").textContent = data.totalDownvotes;
        } catch (err) {
            console.error("Profile load error:", err);
            nameEl.textContent = "Error loading profile";
        }
    }

    // Edit name
    editNameBtn.addEventListener("click", () => {
        const currentName = nameEl.textContent.replace("", "");
        nameInput.value = currentName;
        nameEdit.style.display = "flex";
        editNameBtn.style.display = "none";
        nameEl.style.display = "none";
        nameInput.focus();
    });

    nameCancel.addEventListener("click", cancelEdit);

    nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveName();
        if (e.key === "Escape") cancelEdit();
    });

    nameSave.addEventListener("click", saveName);

    function cancelEdit() {
        nameEdit.style.display = "none";
        editNameBtn.style.display = "inline-block";
        nameEl.style.display = "block";
    }

    async function saveName() {
        const newName = nameInput.value.trim();
        if (!newName) return;

        nameSave.disabled = true;
        nameSave.textContent = "Saving...";

        try {
            const res = await fetch(`${MushroomUtils.BACKEND_URL}/api/profile/${userId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...MushroomUtils._authHeaders(),
                },
                body: JSON.stringify({ displayName: newName }),
            });

            if (!res.ok) throw new Error("Update failed");

            nameEl.textContent = newName + "";
            avatarEl.textContent = newName.charAt(0).toUpperCase();

            // Update localStorage
            const userData = MushroomUtils.getUserData();
            if (userData) {
                userData.displayName = newName;
                localStorage.setItem("userData", JSON.stringify(userData));
            }

            cancelEdit();
            showToast("Name updated!");
        } catch (err) {
            console.error("Name update error:", err);
            showToast("Failed to update name");
        } finally {
            nameSave.disabled = false;
            nameSave.textContent = "Save";
        }
    }

    // My Meadow
    document.getElementById("my-meadow-btn").addEventListener("click", () => {
        window.location.href = `meadow.html?userId=${userId}`;
    });

    // My mushrooms
    document.getElementById("my-mushrooms-btn").addEventListener("click", () => {
        window.location.href = `rank.html?sort=my`;
    });

    // Share profile
    document.getElementById("share-btn").addEventListener("click", () => {
        const url = `${window.location.origin}${window.location.pathname}?userId=${userId}`;
        if (navigator.share) {
            navigator.share({ title: "Mushroom Profile", url });
        } else {
            navigator.clipboard.writeText(url).then(() => {
                showToast("Profile link copied!");
            });
        }
    });

    function showToast(message) {
        toastEl.textContent = message;
        toastEl.classList.add("show");
        setTimeout(() => toastEl.classList.remove("show"), 3000);
    }
})();
