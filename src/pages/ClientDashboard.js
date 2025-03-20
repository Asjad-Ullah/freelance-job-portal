import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles.css";

function ClientDashboard() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [postedJobs, setPostedJobs] = useState([]);
  const [ongoingJobs, setOngoingJobs] = useState([]);
  const [, setError] = useState("");

  useEffect(() => {
    if (!user || !user.id) {
      setError("Error fetching jobs: User not found.");
      return;
    }

    // Fetch Posted Jobs
    fetch(`http://localhost:5000/client-jobs?client_id=${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        setPostedJobs(data);
      })
      .catch((err) => {
        setError("Failed to fetch posted jobs.");
        console.error("Error fetching jobs:", err);
      });

    fetch(`http://localhost:5000/ongoing-jobs?client_id=${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        setOngoingJobs(data);
      })
      .catch((err) => {
        setError("");
        console.error("Error fetching ongoing jobs:", err);
      });
  }, [user]);

  return (
    <div className="dashboard-container">
      <h2>Client Dashboard</h2>

      {/* Posted Jobs */}
      <h3>Your Posted Jobs</h3>
      {postedJobs.length === 0 ? <p className="error-message">No jobs posted yet.</p> : null}
      <div className="job-cards-container">
        {postedJobs.map((job) => (
          <div className="job-card" key={job.id}>
            <h3>{job.title}</h3>
            <p>{job.description}</p>
            <p><strong>Budget:</strong> ${job.budget}</p>
            <Link to={`/view-proposals/${job.id}`} className="view-proposals-btn">
              View Proposals
            </Link>
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
            <p><strong>Freelancer:</strong> {job.freelancerName}</p>
            <p><strong>Bid Amount:</strong> ${job.bidAmount}</p>
            <p><strong>Status:</strong> {job.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ClientDashboard;
