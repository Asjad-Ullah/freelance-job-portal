import { useState, useEffect } from "react";
import "../styles.css";

function History({ user }) {
  const [completedJobs, setCompletedJobs] = useState([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(user);

  useEffect(() => {
    // If user prop is not available, try to get from localStorage
    if (!user) {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      if (storedUser) {
        setCurrentUser(storedUser);
      } else {
        setError("Please log in to view job history.");
        setLoading(false);
        return;
      }
    } else {
      setCurrentUser(user);
    }
  }, [user]);

  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.role !== "freelancer") {
      setError("Only freelancers can view job history!");
      setLoading(false);
      return;
    }

    // Fetch completed jobs
    fetch(`http://localhost:5000/completed-jobs?freelancer_id=${currentUser.id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch completed jobs.");
        }
        return res.json();
      })
      .then((data) => {
        setCompletedJobs(data);
        // Calculate total earnings
        const earnings = data.reduce((sum, job) => sum + (job.bidAmount || 0), 0);
        setTotalEarnings(earnings.toFixed(2));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching completed jobs:", err);
        setError("Failed to load job history.");
        setLoading(false);
      });
  }, [currentUser]);

  if (loading) {
    return <div className="profile-loading">Loading job history...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!currentUser) {
    return <div className="error-message">Please log in to view job history.</div>;
  }

  return (
    <div className="history-container">
      <h2>Job History</h2>
      <div className="total-earnings">
        <h3>Total Earnings</h3>
        <p>${totalEarnings}</p>
      </div>
      <div className="history-list">
        {completedJobs.length > 0 ? (
          completedJobs.map((job) => (
            <div key={job.id} className="history-item">
              <h3>{job.title}</h3>
              <p>{job.description}</p>
              <p>
                <strong>Budget:</strong> ${job.budget.toFixed(2)}
              </p>
              <p>
                <strong>Your Bid:</strong> ${job.bidAmount.toFixed(2)}
              </p>
              <p>
                <strong>Client:</strong> {job.clientName}
              </p>
            </div>
          ))
        ) : (
          <p className="no-jobs-message">No completed jobs found.</p>
        )}
      </div>
    </div>
  );
}

export default History;