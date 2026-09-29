require("dotenv").config();
const env = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 3001;
const express = require("express");
const cors = require("cors");
const { sequelize } = require("./models");
const errorHandler = require("./middleware/errorHandler");

const usersRoutes = require("./routes/users");
const userRoutes = require("./routes/user");
const articlesRoutes = require("./routes/articles");
const profilesRoutes = require("./routes/profiles");
const tagsRoutes = require("./routes/tags");

const app = express();
app.use(cors());
app.use(express.json());

// The schema is managed by migrations (sequelize-cli db:migrate, run once per deploy),
// not by sync(): every replica altering the schema at startup races and is unsafe in prod.
(async () => {
  try {
    await sequelize.authenticate();
    console.log(`Connection with ${env} database has been established.`);
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
})();

if (process.env.NODE_ENV === "production") {
  app.use(express.static("../frontend/dist"));
} else {
  app.get("/", (req, res) => res.json({ status: "API is running on /api" }));
}
// Health checks. Liveness never touches the DB: a short DB outage (e.g. RDS Multi-AZ failover)
// must not restart every pod. Readiness takes the pod out of the Service (and so out of traffic)
// while the DB is unreachable or the pod is shutting down.
let shuttingDown = false;

// version: the image's git commit SHA (set at build time), so a deploy can be verified from outside
app.get("/api/health/live", (req, res) =>
  res.json({ status: "ok", version: process.env.APP_VERSION || "unknown" }),
);

app.get("/api/health/ready", async (req, res) => {
  if (shuttingDown) {
    return res.status(503).json({ status: "shutting down" });
  }
  try {
    await Promise.race([
      sequelize.query("SELECT 1"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 2000),
      ),
    ]);
    res.json({ status: "ok" });
  } catch (error) {
    res.status(503).json({ status: "database unavailable" });
  }
});

app.use("/api/users", usersRoutes);
app.use("/api/user", userRoutes);
app.use("/api/articles", articlesRoutes);
app.use("/api/profiles", profilesRoutes);
app.use("/api/tags", tagsRoutes);
app.get("/*any", (req, res) =>
  res.status(404).json({ errors: { body: ["Not found"] } }),
);
app.use(errorHandler);

const server = app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);

// Graceful shutdown (SIGTERM from Kubernetes, forwarded by tini): fail readiness, stop accepting
// new connections, let in-flight requests finish, close the DB pool, exit before the grace period.
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down gracefully`);

  server.close(async () => {
    await sequelize.close();
    console.log("HTTP server and DB pool closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 25000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
