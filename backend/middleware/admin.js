const admin = require("firebase-admin");
const { requireAuth } = require("./auth");

// Required admin - rejects if not an admin
function requireAdmin(req, res, next) {
    // First verify auth
    requireAuth(req, res, () => {
        if (!req.user) return;

        const db = admin.firestore();
        db.collection("admins")
            .doc(req.user.uid)
            .get()
            .then((doc) => {
                if (!doc.exists) {
                    return res.status(403).json({ error: "Admin access required" });
                }
                req.isAdmin = true;
                next();
            })
            .catch(() => {
                res.status(500).json({ error: "Admin check failed" });
            });
    });
}

module.exports = { requireAdmin };
