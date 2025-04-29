import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles.css";

function JobPosting() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  const handleJobPost = async (e) => {
    e.preventDefault();

    // Get client ID from local storage
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
      alert("You must be logged in to post a job!");
      return;
    }

    const response = await fetch("http://localhost:5000/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        budget,
        client_id: user.id,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      setSuccessMessage("Job posted successfully!");
      setTimeout(() => {
        navigate("/jobs"); // Redirect after success
      }, 1500);
    } else {
      alert(data.message);
    }
  };

  return (
    <div className="job-posting-container">
      <h2>Post a Job</h2>
      {successMessage && <p className="success-message">{successMessage}</p>}
      <form onSubmit={handleJobPost} className="job-posting-form">
        <label>Job Title</label>
        <input
          type="text"
          placeholder="Enter job title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <label>Job Description</label>
        <textarea
          placeholder="Describe the job requirements..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <label>Budget ($)</label>
        <input
          type="number"
          placeholder="Enter budget amount"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          required
        />

        <button type="submit">Post Job</button>
      </form>
    </div>
  );
}

export default JobPosting;
