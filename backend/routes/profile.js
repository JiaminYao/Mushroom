const express = require("express");
const admin = require("firebase-admin");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/profile/:userId - Get user profile + stats
router.get("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        // Get user info from Firebase Auth
        let userRecord;
        try {
            userRecord = await admin.auth().getUser(userId);
        } catch {
            return res.status(404).json({ error: "User not found" });
        }

        // Get mushroom stats for this user
        const db = admin.firestore();
        const snapshot = await db
            .collection("mushrooms")
            .where("userId", "==", userId)
            .where("deleted", "==", false)
            .get();

        let totalUpvotes = 0;
        let totalDownvotes = 0;
        let totalScore = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            totalUpvotes += data.upvotes || 0;
            totalDownvotes += data.downvotes || 0;
            totalScore += data.score || 0;
        });

        res.json({
            userId: userId,
            displayName: userRecord.displayName || userRecord.email.split("@")[0],
            email: userRecord.email,
            createdAt: userRecord.metadata.creationTime,
            mushroomCount: snapshot.size,
            totalUpvotes,
            totalDownvotes,
            totalScore,
        });
    } catch (err) {
        console.error("Profile fetch error:", err);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

// PUT /api/profile/:userId - Update display name
router.put("/:userId", requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { displayName } = req.body;

        // Only allow users to edit their own profile
        if (req.user.uid !== userId) {
            return res.status(403).json({ error: "Cannot edit another user's profile" });
        }

        if (!displayName || displayName.trim().length === 0) {
            return res.status(400).json({ error: "Display name required" });
        }

        await admin.auth().updateUser(userId, {
            displayName: displayName.trim().slice(0, 50),
        });

        res.json({ success: true, displayName: displayName.trim().slice(0, 50) });
    } catch (err) {
        console.error("Profile update error:", err);
        res.status(500).json({ error: "Failed to update profile" });
    }
});

module.exports = router;
