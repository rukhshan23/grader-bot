import express from "express";
import cors from "cors";
import fs from "fs";
import csv from "csv-parser";
import fastCsv from "fast-csv";
import multer from "multer";
import { v4 as uuidv4 } from "uuid"; // Unique filename generator

import { generate } from "./LLM.js"; // Import the function

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

let userFiles = {}; // Store user session => uploaded file path

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// **API: Upload CSV (Handles Unique Filenames)**
app.post("/api/upload-csv", upload.single("file"), (req, res) => {
  const fileExt = req.file.originalname.split(".").pop();
  const uniqueFilename = `${uuidv4()}.${fileExt}`; // Create unique file name
  const uploadedFilePath = `uploads/${uniqueFilename}`;

  fs.rename(req.file.path, uploadedFilePath, (err) => {
    if (err) return res.status(500).json({ error: "Error processing file" });

    const userSession = uuidv4(); // Generate a unique session ID for this user
    userFiles[userSession] = { filePath: uploadedFilePath, timestamp: Date.now() };

    let submissions = [];

    // Parse CSV and store in memory
    fs.createReadStream(uploadedFilePath)
      .pipe(csv())
      .on("data", (row) => {
        const reviewKey = Object.keys(row).find(key => key.trim().toLowerCase().includes("please enter your paper review below"));
        submissions.push({
            review: row[reviewKey]?.trim() || "ERROR: Review column missing",
            botOutput: row["botOutput"] || "" // Preserve botOutput if present
        });
    })
      .on("end", () => {
        res.json({
          message: "File uploaded successfully",
          sessionId: userSession, // Send session ID to the frontend
          data: submissions,
        });
      });
  });
});

// **API: Get Submissions (User-Specific)**
app.get("/api/get-submissions", (req, res) => {
  const { sessionId } = req.query;
  if (!userFiles[sessionId]) return res.status(400).json({ error: "No file uploaded for this session" });

  let submissions = [];
  fs.createReadStream(userFiles[sessionId].filePath)
    .pipe(csv())
    .on("data", (row) => {
      const reviewKey = Object.keys(row).find(key => key.trim().toLowerCase().includes("please enter your paper review below"));
      submissions.push({
          review: row[reviewKey]?.trim() || "ERROR: Review column missing",
          botOutput: row["botOutput"] || "" // Preserve botOutput if present
      });
  })
  .on("end", () => {
    res.json(submissions);
});

});

// **API: Generate LLM Output**
app.post("/api/generate-output", async (req, res) => {
  const {prompt, userSessionID, review} = req.body;
  
  if (!userSessionID || userSessionID.trim() === "") {
    return res.status(400).json({ error: "The required field is missing." });
  }

  try {
    const response = await generate("gpt4-new", "Give your best response.", review + prompt, 0.2, 0, userSessionID);
    res.json({ output: response["response"] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// **API: Save Output to CSV (User-Specific)**
app.post("/api/save-output", (req, res) => {
  const { sessionId, index, botOutput } = req.body;
  if (!userFiles[sessionId]) return res.status(400).json({ error: "No file uploaded for this session" });

  let submissions = [];
  const filePath = userFiles[sessionId].filePath;

  // Read and update CSV data
  fs.createReadStream(filePath)
  .pipe(csv())
  .on("data", (row) => {
    submissions.push(row); // Collect all rows
  })
  .on("end", () => {
    //console.log("Before Update:", submissions); // Debugging
    if (index >= 0 && index < submissions.length) {
      submissions[index] = {
        ...submissions[index],
        botOutput: botOutput
    };
    }
    //console.log("After Update:", submissions); // Debugging


    const ws = fs.createWriteStream(filePath);
    fastCsv.write(submissions, { headers: true }).pipe(ws);
    
    ws.on("finish", () => {
      //console.log("CSV updated successfully.");
      res.json({ message: "CSV updated successfully" });
    });
  })
  .on("error", (error) => {
    console.error("Error writing CSV:", error);
    res.status(500).json({ error: "Error reading CSV file" });
  });
});

// **API: Download Updated CSV (User-Specific)**
app.get("/api/download-csv", (req, res) => {
  const { sessionId } = req.query;
  if (!userFiles[sessionId]) return res.status(400).json({ error: "No file uploaded for this session" });

  res.download(userFiles[sessionId].filePath, "updated_submissions.csv");
});

// **API: Delete File on Session End**
app.post("/api/end-session", (req, res) => {
  const { sessionId } = req.body;
  if (userFiles[sessionId]) {
    fs.unlink(userFiles[sessionId].filePath, (err) => {
      if (err) console.error("Error deleting file:", err);
      delete userFiles[sessionId]; // Remove session tracking
    });
  }
  res.json({ message: "Session ended, file deleted." });
});

// Start Server
app.listen(port, () => console.log(`Server running on port ${port}`));
