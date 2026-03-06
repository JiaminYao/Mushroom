const express = require("express");
const admin = require("firebase-admin");

const router = express.Router();

// Migrate anonymous mushrooms to authenticated user
async function migrateAnonymousMushrooms(anonymousUserId, realUserId) {
    if (!anonymousUserId || anonymousUserId === realUserId) return;

    const db = admin.firestore();
    const snapshot = await db
        .collection("mushrooms")
        .where("userId", "==", anonymousUserId)
        .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.forEach((doc) => {
        batch.update(doc.ref, { userId: realUserId });
    });
    await batch.commit();
    console.log(`Migrated ${snapshot.size} mushrooms from ${anonymousUserId} to ${realUserId}`);
}

// POST /auth/register - Create user with email/password
router.post("/register", async (req, res) => {
    try {
        const { email, password, displayName, userId } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }

        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: (displayName || email.split("@")[0]).slice(0, 50),
        });

        // Migrate anonymous mushrooms
        if (userId) {
            await migrateAnonymousMushrooms(userId, userRecord.uid);
        }

        // Create custom token for immediate login
        const token = await admin.auth().createCustomToken(userRecord.uid);

        res.json({
            success: true,
            token,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
            },
        });
    } catch (err) {
        console.error("Register error:", err);
        if (err.code === "auth/email-already-exists") {
            return res.status(400).json({ error: "Email already in use" });
        }
        res.status(500).json({ error: "Registration failed" });
    }
});

// POST /auth/google - Verify Google credential
router.post("/google", async (req, res) => {
    try {
        const { idToken, userId } = req.body;
        if (!idToken) {
            return res.status(400).json({ error: "ID token required" });
        }

        const decoded = await admin.auth().verifyIdToken(idToken);

        // Migrate anonymous mushrooms
        if (userId) {
            await migrateAnonymousMushrooms(userId, decoded.uid);
        }

        res.json({
            success: true,
            user: {
                uid: decoded.uid,
                email: decoded.email,
                displayName: decoded.name || decoded.email,
            },
        });
    } catch (err) {
        console.error("Google auth error:", err);
        res.status(401).json({ error: "Invalid Google credential" });
    }
});

// POST /auth/migrate - Migrate anonymous mushrooms to authenticated user
const { requireAuth } = require("../middleware/auth");

router.post("/migrate", requireAuth, async (req, res) => {
    try {
        const { anonymousUserId } = req.body;
        if (!anonymousUserId) {
            return res.status(400).json({ error: "anonymousUserId required" });
        }

        await migrateAnonymousMushrooms(anonymousUserId, req.user.uid);
        res.json({ success: true });
    } catch (err) {
        console.error("Migrate error:", err);
        res.status(500).json({ error: "Migration failed" });
    }
});

module.exports = router;
