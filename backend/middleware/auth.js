const admin = require("firebase-admin");

// Optional auth - attaches user if token present, continues either way
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        req.user = null;
        return next();
    }

    const token = authHeader.split("Bearer ")[1];
    admin
        .auth()
        .verifyIdToken(token)
        .then((decoded) => {
            req.user = decoded;
            next();
        })
        .catch(() => {
            req.user = null;
            next();
        });
}

// Required auth - rejects if no valid token
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required" });
    }

    const token = authHeader.split("Bearer ")[1];
    admin
        .auth()
        .verifyIdToken(token)
        .then((decoded) => {
            req.user = decoded;
            next();
        })
        .catch(() => {
            res.status(401).json({ error: "Invalid token" });
        });
}

module.exports = { optionalAuth, requireAuth };
