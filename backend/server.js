const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

// Initialize Firebase Admin
// In production, Cloud Run provides default credentials automatically
// For local dev, set GOOGLE_APPLICATION_CREDENTIALS env var to your service account key
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: process.env.STORAGE_BUCKET || "mushroom-game-c7205.firebasestorage.app",
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const uploadRoutes = require("./routes/upload");
const mushroomRoutes = require("./routes/mushroom");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const adminRoutes = require("./routes/admin");

app.use("/uploadmushroom", uploadRoutes);
app.use("/api/mushroom", mushroomRoutes);
app.use("/api", mushroomRoutes); // for /api/vote
app.use("/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api", adminRoutes);

// Health check
app.get("/", (req, res) => {
    res.json({ status: "ok", service: "mushroom-backend" });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Mushroom backend running on port ${PORT}`);
});
