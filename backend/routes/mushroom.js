const express = require("express");
const admin = require("firebase-admin");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/mushroom - Fetch mushrooms with sorting
router.get("/", async (req, res) => {
    try {
        const db = admin.firestore();
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const random = req.query.random === "true";
        const orderBy = req.query.orderBy || "createdAt";
        const order = req.query.order || "desc";

        const userId = req.query.userId;

        let query = db
            .collection("mushrooms")
            .where("deleted", "==", false);

        if (userId) {
            query = query.where("userId", "==", userId);
        }

        if (random) {
            // Fetch more and shuffle
            const snapshot = await query.limit(200).get();
            const docs = [];
            snapshot.forEach((doc) => {
                docs.push({ docId: doc.id, ...doc.data() });
            });
            // Fisher-Yates shuffle
            for (let i = docs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [docs[i], docs[j]] = [docs[j], docs[i]];
            }
            return res.json(docs.slice(0, limit));
        }

        const snapshot = await query
            .orderBy(orderBy, order)
            .limit(limit)
            .get();

        const mushrooms = [];
        snapshot.forEach((doc) => {
            mushrooms.push({ docId: doc.id, ...doc.data() });
        });

        res.json(mushrooms);
    } catch (err) {
        console.error("Fetch error:", err);
        res.status(500).json({ error: "Failed to fetch mushrooms" });
    }
});

// POST /api/vote - Vote on a mushroom
router.post("/vote", requireAuth, async (req, res) => {
    try {
        const { mushroomId, voteType } = req.body;

        if (!mushroomId || !["up", "down"].includes(voteType)) {
            return res.status(400).json({ error: "Invalid vote" });
        }

        const db = admin.firestore();
        const docRef = db.collection("mushrooms").doc(mushroomId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: "Mushroom not found" });
        }

        const update =
            voteType === "up"
                ? {
                      upvotes: admin.firestore.FieldValue.increment(1),
                      score: admin.firestore.FieldValue.increment(1),
                  }
                : {
                      downvotes: admin.firestore.FieldValue.increment(1),
                      score: admin.firestore.FieldValue.increment(-1),
                  };

        await docRef.update(update);

        res.json({ success: true });
    } catch (err) {
        console.error("Vote error:", err);
        res.status(500).json({ error: "Vote failed" });
    }
});

// DELETE /api/mushroom/:id - Soft delete a mushroom (owner only)
router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const db = admin.firestore();
        const docRef = db.collection("mushrooms").doc(req.params.id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: "Mushroom not found" });
        }

        if (doc.data().userId !== req.user.uid) {
            return res.status(403).json({ error: "Not your mushroom" });
        }

        await docRef.update({ deleted: true });
        res.json({ success: true });
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ error: "Delete failed" });
    }
});

module.exports = router;
