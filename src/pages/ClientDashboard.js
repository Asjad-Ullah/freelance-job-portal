import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import "../styles.css";

function ClientDashboard() {
  // Memoize the user object to prevent unnecessary re-renders
  const user = useMemo(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  }, []); // Empty dependency array since localStorage.getItem doesn't change during component lifecycle

  const [postedJobs, setPostedJobs] = useState([]);
  const [ongoingJobs, setOngoingJobs] = useState([]);
  const [postedJobsError, setPostedJobsError] = useState("");
  const [ongoingJobsError, setOngoingJobsError] = useState("");

  useEffect(() => {
    if (!user || !user.id) {
      setPostedJobsError("User not found.");
      setOngoingJobsError("User not found.");
      return;
    }

    // Fetch Posted Jobs
    const fetchPostedJobs = async () => {
      try {
        const res = await fetch(`http://localhost:5000/client-jobs?client_id=${user.id}`);
        if (!res.ok) throw new Error("Failed to fetch posted jobs.");
        const data = await res.json();
        setPostedJobs(data);
        setPostedJobsError(""); // Clear error on success
      } catch (err) {
        console.error("Error fetching posted jobs:", err);
        setPostedJobsError("Failed to fetch posted jobs.");
      }
    };

    // Fetch Ongoing Jobs
    const fetchOngoingJobs = async () => {
      try {
        const res = await fetch(`http://localhost:5000/ongoing-jobs?client_id=${user.id}`);
        if (!res.ok) throw new Error("Failed to fetch ongoing jobs.");
        const data = await res.json();
        setOngoingJobs(data);
        setOngoingJobsError(""); // Clear error on success
      } catch (err) {
        console.error("Error fetching ongoing jobs:", err);
        setOngoingJobsError("Failed to fetch ongoing jobs.");
      }
    };

    fetchPostedJobs();
    fetchOngoingJobs();
  }, [user?.id]); // Depend on user.id instead of the entire user object

  return (
    <div className="dashboard-container">
      <h2>Client Dashboard</h2>

      {/* Posted Jobs */}
      <h3>Your Posted Jobs</h3>
      {postedJobsError && <p className="error-message">{postedJobsError}</p>}
      {postedJobs.length === 0 && !postedJobsError ? (
        <p className="error-message">No jobs posted yet.</p>
      ) : null}
      <div className="job-cards-container">
        {postedJobs.map((job) => (
          <div className="job-card" key={job.id}>
            <h3>{job.title}</h3>
            <p>{job.description}</p>
            <p>
              <strong>Budget:</strong> ${job.budget?.toFixed(2)}
            </p>
            <Link to={`/view-proposals/${job.id}`} className="view-proposals-btn">
              View Proposals
            </Link>
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
            <p>
              <strong>Freelancer:</strong> {job.freelancerName}
            </p>
            <p>
              <strong>Bid Amount:</strong> ${job.bidAmount?.toFixed(2)}
            </p>
            <p>
              <strong>Status:</strong> {job.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ClientDashboard;
