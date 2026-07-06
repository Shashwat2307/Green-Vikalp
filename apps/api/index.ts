import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth";
import pipelinesRouter from "./routes/pipelines";
import campaignsRouter from "./routes/campaigns";
import leadsRouter from "./routes/leads";
import propertiesRouter from "./routes/properties";
import interactionsRouter from "./routes/interactions";
import foldersRouter from "./routes/folders";
import documentsRouter from "./routes/documents";
import usersRouter from "./routes/users";
import tasksRouter from "./routes/tasks";
import meetingsRouter from "./routes/meetings";
import integrationsRouter from "./routes/integrations";

const app = express();

// Middleware
app.use(cors({
  origin: (process.env.CORS_ORIGIN || "http://localhost:3000").split(","),
  credentials: true, // Allow cookies
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/auth", authRouter);
app.use("/pipelines", pipelinesRouter);
app.use("/campaigns", campaignsRouter);
app.use("/leads", leadsRouter);
app.use("/properties", propertiesRouter);
app.use("/interactions", interactionsRouter);
app.use("/folders", foldersRouter);
app.use("/documents", documentsRouter);
app.use("/users", usersRouter);
app.use("/tasks", tasksRouter);
app.use("/meetings", meetingsRouter);
app.use("/integrations", integrationsRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = parseInt(process.env.PORT || "3001", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API server running on http://localhost:${PORT}`);
});