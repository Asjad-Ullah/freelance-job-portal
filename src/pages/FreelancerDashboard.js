import { useEffect, useState } from "react";
import "../styles.css";

function FreelancerDashboard() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [availableJobs, setAvailableJobs] = useState([]);
  const [ongoingJobs, setOngoingJobs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !user.id) return; // Wait until user is available

    const fetchJobs = async () => {
      try {
        const jobsRes = await fetch("http://localhost:5000/jobs");
        const jobsData = await jobsRes.json();
        setAvailableJobs(jobsData);

        const ongoingRes = await fetch(`http://localhost:5000/ongoing-jobs?freelancer_id=${user.id}`);
        const ongoingData = await ongoingRes.json();
        setOngoingJobs(ongoingData);
      } catch (err) {
        setError("");
      }
    };

    fetchJobs();
  }, [user]); // Runs when `user` is updated

  const handleJobCompletion = async (jobId) => {
    try {
      const response = await fetch(`http://localhost:5000/complete-job/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        alert("Job marked as completed!");
        setOngoingJobs((prevJobs) => prevJobs.filter((job) => job.id !== jobId));
      } else {
        alert("Failed to mark job as completed.");
      }
    } catch {
      alert("Error completing job.");
    }
  };

  return (
    <div className="dashboard-container">
      <h2>Freelancer Dashboard</h2>
      {error && <p className="error-message">{error}</p>}

      {/* Available Jobs */}
      <h3>Available Jobs</h3>
      {availableJobs.length === 0 ? <p className="error-message">No jobs available.</p> : null}
      <div className="job-cards-container">
        {availableJobs.map((job) => (
          <div className="job-card" key={job.id}>
            <h3>{job.title}</h3>
            <p><strong>Category:</strong> {job.category}</p>
            <p>{job.description}</p>
            <p><strong>Budget:</strong> ${job.budget}</p>
            <button className="apply-button">Apply Now</button>
          </div>
        ))}
      </div>

      {/* Ongoing Jobs */}
      <h3>Ongoing Jobs</h3>
      {ongoingJobs.length === 0 ? <p className="error-message">No ongoing jobs.</p> : null}
      <div className="job-cards-container">
        {ongoingJobs.map((job) => (
          <div className="job-card" key={job.id}>
            <h3>{job.title}</h3>
            <p><strong>Client:</strong> {job.clientName}</p>
            <p><strong>Bid Amount:</strong> ${job.bidAmount}</p>
            <p><strong>Status:</strong> {job.status}</p>
            <button className="mark-complete-btn" onClick={() => handleJobCompletion(job.id)}>
              Mark as Completed
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FreelancerDashboard;
