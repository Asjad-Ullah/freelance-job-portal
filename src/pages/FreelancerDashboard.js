import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles.css";

function FreelancerDashboard() {
  // Memoize the user object to prevent unnecessary re-renders
  const user = useMemo(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  }, []); // Empty dependency array since localStorage.getItem doesn't change during component lifecycle

  const navigate = useNavigate();
  const [availableJobs, setAvailableJobs] = useState([]);
  const [ongoingJobs, setOngoingJobs] = useState([]);
  const [availableJobsError, setAvailableJobsError] = useState("");
  const [ongoingJobsError, setOngoingJobsError] = useState("");

  useEffect(() => {
    if (!user || !user.id) return; // Wait until user is available

    const fetchAvailableJobs = async () => {
      try {
        const jobsRes = await fetch("http://localhost:5000/jobs");
        if (!jobsRes.ok) throw new Error("Failed to fetch available jobs.");
        const jobsData = await jobsRes.json();
        setAvailableJobs(jobsData);
        setAvailableJobsError(""); // Clear error on success
      } catch (err) {
        console.error("Fetch available jobs error:", err);
        setAvailableJobsError("Failed to fetch available jobs.");
      }
    };

    const fetchOngoingJobs = async () => {
      try {
        const ongoingRes = await fetch(`http://localhost:5000/ongoing-jobs?freelancer_id=${user.id}`);
        if (!ongoingRes.ok) throw new Error("Failed to fetch ongoing jobs.");
        const ongoingData = await ongoingRes.json();
        setOngoingJobs(ongoingData);
        setOngoingJobsError(""); // Clear error on success
      } catch (err) {
        console.error("Fetch ongoing jobs error:", err);
        setOngoingJobsError("Failed to fetch ongoing jobs.");
      }
    };

    fetchAvailableJobs();
    fetchOngoingJobs();
  }, [user?.id]); // Depend on user.id instead of the entire user object

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

  const handleApply = (jobId) => {
    navigate(`/jobs/${jobId}`);
  };

  return (
    <div className="dashboard-container">
      <h2>Freelancer Dashboard</h2>

      {/* Available Jobs */}
      <h3>Available Jobs</h3>
      {availableJobsError && <p className="error-message">{availableJobsError}</p>}
      {availableJobs.length === 0 && !availableJobsError ? (
        <p className="error-message">No jobs available.</p>
      ) : null}
      <div className="job-cards-container">
        {availableJobs.map((job) => (
          <div className="job-card" key={job.id}>
            <h3>{job.title}</h3>
            <p>{job.description}</p>
            <p><strong>Budget:</strong> ${job.budget?.toFixed(2)}</p>
            <button className="apply-button" onClick={() => handleApply(job.id)}>
              Apply Now
            </button>
          </div>
        ))}
      </div>

      {/* Ongoing Jobs */}
      <h3>Ongoing Jobs</h3>
      {ongoingJobsError && <p className="error-message">{ongoingJobsError}</p>}
      {ongoingJobs.length === 0 && !ongoingJobsError ? (
        <p className="error-message">No ongoing jobs.</p>
      ) : null}
      <div className="job-cards-container">
        {ongoingJobs.map((job) => (
          <div className="job-card" key={job.id}>
            <h3>{job.title}</h3>
            <p><strong>Client:</strong> {job.clientName}</p>
            <p><strong>Bid Amount:</strong> ${job.bidAmount?.toFixed(2)}</p>
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
