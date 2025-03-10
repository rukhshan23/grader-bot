import React, { useState, useEffect } from "react";
import axios from "axios";

import "./GraderBot.css"; // Import the CSS file

export default function GraderBot() {
  const [prompt, setPrompt] = useState("Enter grading prompt...");
  const [userSessionID, setUserSessionID] = useState(""); // User-entered session ID
  const [submissions, setSubmissions] = useState([]);
  const [originalSubmissions, setOriginalSubmissions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [botOutput, setBotOutput] = useState("");
  const [fileUploaded, setFileUploaded] = useState(false);
  const [fileName, setFileName] = useState(""); // Store uploaded file name
  const [sessionConfirmed, setSessionConfirmed] = useState(false); // Track if user session ID is entered
  const [backendSessionID, setBackendSessionID] = useState(null); // Backend-generated session ID
  const BACKEND_URL = "http://54.208.79.51:3001";
  // const BACKEND_URL = "http://localhost:3001";

  


  // Fetch submissions when a file is uploaded and session ID is confirmed
  useEffect(() => {
    if (fileUploaded && sessionConfirmed) {
      axios.get(`${BACKEND_URL}/api/get-submissions?sessionId=${backendSessionID}`).then((res) => {
        setSubmissions(res.data);
        setOriginalSubmissions(res.data);
      });
    }
  }, [fileUploaded, sessionConfirmed]);

  // Ensure files are deleted when the user refreshes or leaves
  useEffect(() => {
    const handleUnload = async () => {
      if (backendSessionID) {
        await axios.post(`${BACKEND_URL}/api/end-session`, { sessionId: backendSessionID });
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [backendSessionID]);

  // Reset botOutput when switching submissions
  useEffect(() => {
    if (submissions.length > 0) {
      setBotOutput(submissions[currentIndex]?.botOutput || "");
    }
  }, [currentIndex, submissions]);
  

  // Handle CSV Upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/upload-csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setBackendSessionID(res.data.sessionId); // Backend session ID for file tracking
      setFileName(file.name);
      setFileUploaded(true);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file. Please try again.");
    }
  };

  // Download updated CSV
  const downloadCSV = () => {
    if (!sessionConfirmed) {
      alert("No session ID entered yet.");
      return;
    }
    
    // Just trigger download without ending session
    window.open(`${BACKEND_URL}/api/download-csv?sessionId=${backendSessionID}`, "_blank");
  };
  

  // Generate AI Output
  const regenerateOutput = async () => {
    if (!sessionConfirmed) {
      alert("Please enter the session ID before generating output.");
      return;
    }

    const review = submissions[currentIndex]?.review || "";

    try {
      const res = await axios.post(`${BACKEND_URL}/api/generate-output`, {
        prompt,
        userSessionID, // User-entered Session ID
        review,
      });
      setBotOutput(res.data.output);
    } catch (error) {
      console.error("Error generating output:", error);
      alert("Failed to generate output.");
    }
  };

  // Save output to CSV
  const saveOutput = async () => {
    if (!sessionConfirmed) {
      alert("No session ID entered yet.");
      return;
    }
  
    try {
      await axios.post(`${BACKEND_URL}/api/save-output`, {
        sessionId: backendSessionID,
        index: currentIndex,
        botOutput, // Ensure it saves the latest edited feedback
      });
  
      // Re-fetch the updated CSV
      const res = await axios.get(`${BACKEND_URL}/api/get-submissions?sessionId=${backendSessionID}`);
      console.log("Fetched Submissions:", res.data); // Debugging
      setSubmissions(res.data);
      setOriginalSubmissions(res.data);
      alert("Output saved successfully!");
    } catch (error) {
      console.error("Error saving output:", error);
      alert("Failed to save output.");
    }
  };
  

  return (
    <div className="grader-container">
      <div className="input-group">
        <h2>Grader Bot</h2>
      </div>

      {/* File Upload Section */}
      <div className="input-group">
        {fileUploaded ? (
          <p><strong>Uploaded File:</strong> {fileName}</p>
        ) : (
          <>
            <label>Upload CSV:</label>
            <input type="file" accept=".csv" onChange={handleFileUpload} />
          </>
        )}
      </div>

      {/* Show session ID input after file upload */}
      {fileUploaded && !sessionConfirmed && (
        <div className="input-group">
          <label>Enter the session ID which has access to the relevant paper as RAG:</label>
          <input 
            type="text" 
            className="small-input" 
            value={userSessionID} 
            onChange={(e) => setUserSessionID(e.target.value)} 
          />
          <button onClick={() => setSessionConfirmed(true)} disabled={!userSessionID.trim()}>
            Confirm
          </button>
        </div>
      )}

      {/* Show session ID after confirmation */}
      {sessionConfirmed && (
        <div className="input-group">
          <p><strong>Session ID:</strong> {userSessionID}</p>
          <p></p>
        </div>
      )}

      {/* Show grading interface only after session ID is confirmed */}
      {sessionConfirmed && (
        <>
          <div className="input-group">
            <label>Student Submission:</label>
            <textarea className="text-area" value={submissions[currentIndex]?.review || "No review found"} readOnly />

          </div>

          <div className="input-group">
            <label>Grading Prompt (the student submission will be appended before the grading prompt):</label>
            <textarea className="text-area" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </div>

          <div className="input-group">
            <label>AI Feedback:</label>
            <textarea className="text-area" value={botOutput} onChange={(e) => setBotOutput(e.target.value)} />
          </div>

          <div className="button-group">
            <button onClick={regenerateOutput}>Generate LLM output</button>
            <button onClick={saveOutput}>Save output to CSV</button>
            <button onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}>Previous submission</button>
            <button onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, submissions.length - 1))}>Next submission</button>
            <button onClick={downloadCSV}>Download Updated CSV</button>
          </div>
        </>
      )}
    </div>
  );
}
