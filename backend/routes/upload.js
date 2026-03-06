const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/", optionalAuth, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image provided" });
        }

        const artist = req.body.artist || "Anonymous";
        // Use authenticated uid, or anonymous userId from client, or generate new one
        const userId = req.user ? req.user.uid : (req.body.userId || uuidv4());

        // Upload image to Firebase Storage
        const bucket = admin.storage().bucket();
        const filename = `mushrooms/${uuidv4()}.png`;
        const file = bucket.file(filename);

        await file.save(req.file.buffer, {
            metadata: { contentType: "image/png" },
        });

        // Make file publicly accessible
        await file.makePublic();
        const imageUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

        // Create Firestore document
        const db = admin.firestore();
        const docRef = await db.collection("mushrooms").add({
            image: imageUrl,
            artist: artist,
            userId: userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            upvotes: 0,
            downvotes: 0,
            score: 0,
            deleted: false,
        });

        res.json({
            success: true,
            data: {
                docId: docRef.id,
                image: imageUrl,
                userId: userId,
            },
        });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

module.exports = router;
