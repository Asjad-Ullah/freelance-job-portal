import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../styles.css";

function JobSearch() {
  const [jobs, setJobs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/jobs")
      .then((res) => res.json())
      .then((data) => setJobs(data))
      .catch((err) => console.error("Error fetching jobs:", err));
  }, []);

  const filteredJobs = jobs.filter((job) =>
    job.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="job-search-container">
      <h2>Find Jobs</h2>
      <input
        type="text"
        placeholder="Search for jobs..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="job-list">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => (
            <div key={job.id} className="job-card">
              <h3>{job.title}</h3>
              <p>{job.description}</p>
              <p>
                <strong>Budget:</strong> ${job.budget}
              </p>
              <Link
                to={`/jobs/${job.id}`}
                className="view-details-btn"
                state={{ job }} // ✅ Passing job data via state
              >
                View Details
              </Link>
            </div>
          ))
        ) : (
          <p>No jobs found.</p>
        )}
      </div>
    </div>
  );
}

export default JobSearch;
