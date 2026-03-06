// ===== Login Page =====
(function () {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const tabs = document.querySelectorAll(".login-tab");
    const errorDiv = document.getElementById("login-error");
    const googleBtn = document.getElementById("google-login");

    // Get redirect URL from query string
    const params = new URLSearchParams(window.location.search);
    const redirectUrl = params.get("redirect") || "index.html";

    // If already logged in, redirect
    if (MushroomUtils.isLoggedIn()) {
        window.location.href = redirectUrl;
        return;
    }

    // Tab switching
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            tabs.forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            if (tab.dataset.tab === "login") {
                loginForm.style.display = "";
                registerForm.style.display = "none";
            } else {
                loginForm.style.display = "none";
                registerForm.style.display = "";
            }
            errorDiv.textContent = "";
        });
    });

    function showError(msg) {
        errorDiv.textContent = msg;
    }

    // Migrate anonymous mushrooms after auth
    async function migrateAndRedirect(realUid, token) {
        const anonymousId = localStorage.getItem("anonymousUserId");
        if (anonymousId && anonymousId !== realUid) {
            try {
                await fetch(`${MushroomUtils.BACKEND_URL}/auth/migrate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ anonymousUserId: anonymousId }),
                });
            } catch (err) {
                console.error("Migration error:", err);
            }
        }
        // Clear anonymous id after migration, real uid is tracked by auth
        localStorage.removeItem("anonymousUserId");
        window.location.href = redirectUrl;
    }

    // Email/Password Login
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorDiv.textContent = "";

        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;

        try {
            const credential = await auth.signInWithEmailAndPassword(
                email,
                password,
            );
            const token = await credential.user.getIdToken();
            MushroomUtils.saveAuth(token, {
                uid: credential.user.uid,
                email: credential.user.email,
                displayName:
                    credential.user.displayName || email.split("@")[0],
            });
            await migrateAndRedirect(credential.user.uid, token);
        } catch (err) {
            showError(err.message || "Login failed");
        }
    });

    // Email/Password Register
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorDiv.textContent = "";

        const email = document.getElementById("register-email").value;
        const name = document.getElementById("register-name").value;
        const password = document.getElementById("register-password").value;

        try {
            const credential = await auth.createUserWithEmailAndPassword(
                email,
                password,
            );
            if (name) {
                await credential.user.updateProfile({ displayName: name });
            }
            const token = await credential.user.getIdToken();
            MushroomUtils.saveAuth(token, {
                uid: credential.user.uid,
                email: credential.user.email,
                displayName: name || email.split("@")[0],
            });
            await migrateAndRedirect(credential.user.uid, token);
        } catch (err) {
            showError(err.message || "Registration failed");
        }
    });

    // Google Sign In
    googleBtn.addEventListener("click", async () => {
        errorDiv.textContent = "";

        try {
            const result = await auth.signInWithPopup(googleProvider);
            const token = await result.user.getIdToken();
            MushroomUtils.saveAuth(token, {
                uid: result.user.uid,
                email: result.user.email,
                displayName:
                    result.user.displayName || result.user.email,
            });
            await migrateAndRedirect(result.user.uid, token);
        } catch (err) {
            showError(err.message || "Google sign-in failed");
        }
    });

    // Update nav auth
    MushroomUtils.updateAuthNav();
})();
