const express = require("express");
const admin = require("firebase-admin");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");

const router = express.Router();

// POST /api/report - Submit a report (requires login)
router.post("/report", requireAuth, async (req, res) => {
    try {
        const { mushroomId, reason } = req.body;

        if (!mushroomId || !reason) {
            return res.status(400).json({ error: "mushroomId and reason required" });
        }

        const db = admin.firestore();

        // Check if mushroom exists
        const mushroomDoc = await db.collection("mushrooms").doc(mushroomId).get();
        if (!mushroomDoc.exists) {
            return res.status(404).json({ error: "Mushroom not found" });
        }

        // Check for duplicate report
        const existing = await db
            .collection("reports")
            .where("mushroomId", "==", mushroomId)
            .where("reporterId", "==", req.user.uid)
            .where("status", "==", "pending")
            .get();

        if (!existing.empty) {
            return res.status(400).json({ error: "You already reported this mushroom" });
        }

        await db.collection("reports").add({
            mushroomId,
            reporterId: req.user.uid,
            reason,
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ success: true });
    } catch (err) {
        console.error("Report error:", err);
        res.status(500).json({ error: "Report failed" });
    }
});

// GET /api/admin/reports - Get pending reports (admin only)
router.get("/admin/reports", requireAdmin, async (req, res) => {
    try {
        const db = admin.firestore();
        let snapshot;
        try {
            snapshot = await db
                .collection("reports")
                .where("status", "==", "pending")
                .orderBy("createdAt", "desc")
                .get();
        } catch (indexErr) {
            // If index doesn't exist yet, fall back to unordered query
            console.warn("Index not ready, falling back:", indexErr.message);
            snapshot = await db
                .collection("reports")
                .where("status", "==", "pending")
                .get();
        }

        const reports = [];
        for (const doc of snapshot.docs) {
            const report = { id: doc.id, ...doc.data() };

            // Fetch associated mushroom data
            const mushroomDoc = await db.collection("mushrooms").doc(report.mushroomId).get();
            if (mushroomDoc.exists) {
                const m = mushroomDoc.data();
                report.mushroom = {
                    image: m.image,
                    artist: m.artist,
                    score: (m.upvotes || 0) - (m.downvotes || 0),
                };
            }

            reports.push(report);
        }

        res.json(reports);
    } catch (err) {
        console.error("Fetch reports error:", err);
        res.status(500).json({ error: "Failed to fetch reports" });
    }
});

// POST /api/admin/reports/:id/resolve - Resolve a report (admin only)
router.post("/admin/reports/:id/resolve", requireAdmin, async (req, res) => {
    try {
        const { action } = req.body;

        if (!["delete", "dismiss"].includes(action)) {
            return res.status(400).json({ error: "action must be 'delete' or 'dismiss'" });
        }

        const db = admin.firestore();
        const reportRef = db.collection("reports").doc(req.params.id);
        const reportDoc = await reportRef.get();

        if (!reportDoc.exists) {
            return res.status(404).json({ error: "Report not found" });
        }

        const report = reportDoc.data();

        if (action === "delete") {
            // Soft delete the mushroom
            await db.collection("mushrooms").doc(report.mushroomId).update({ deleted: true });

            // Also resolve all pending reports for this mushroom
            const otherReports = await db
                .collection("reports")
                .where("mushroomId", "==", report.mushroomId)
                .where("status", "==", "pending")
                .get();

            const batch = db.batch();
            otherReports.forEach((doc) => {
                batch.update(doc.ref, {
                    status: "resolved",
                    resolvedBy: req.user.uid,
                    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            await batch.commit();
        } else {
            // Dismiss this report only
            await reportRef.update({
                status: "dismissed",
                resolvedBy: req.user.uid,
                resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Resolve report error:", err);
        res.status(500).json({ error: "Failed to resolve report" });
    }
});

module.exports = router;
