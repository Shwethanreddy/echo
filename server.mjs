import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ Cloud‑ready port
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serve only your frontend folder

// API route
app.post("/api/ask", async (req, res) => {
  const { conversation } = req.body;

  try {
    const ollamaRes = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral", // or any model you pulled
        messages: conversation,
        stream: true
      })
    });

    // Set up Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          const content = data.message?.content || "";
          if (content) {
            // Send JSON chunk to frontend
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch {
          // ignore partial JSON
        }
      }
    }

    res.write("event: done\ndata: {}\n\n");
    res.end();
  } catch (err) {
    console.error("Streaming error:", err);
    res.write(
      `event: error\ndata: ${JSON.stringify({ error: "Streaming failed" })}\n\n`
    );
    res.end();
  }
});

// ✅ Serve your frontend entry point (home.html)
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "home.html"))
);

app.listen(PORT, () => {
  console.log(`Echo server running on port ${PORT}`);
});