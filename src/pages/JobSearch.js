import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../styles.css";

function JobSearch() {
  const [jobs, setJobs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [bookmarks, setBookmarks] = useState([]);
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    // Fetch jobs
    fetch("http://localhost:5000/jobs")
      .then((res) => res.json())
      .then((data) => setJobs(data))
      .catch((err) => console.error("Error fetching jobs:", err));

    // Fetch bookmarks if freelancer
    if (user?.role === "freelancer") {
      fetch(`http://localhost:5000/bookmarks?freelancer_id=${user.id}`)
        .then((res) => res.json())
        .then((data) => setBookmarks(data.map((job) => job.id)))
        .catch((err) => console.error("Error fetching bookmarks:", err));
    }
  }, [user]);

  const toggleBookmark = (jobId) => {
    if (!user || user.role !== "freelancer") {
      alert("Please log in as a freelancer to bookmark jobs!");
      return;
    }

    fetch("http://localhost:5000/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freelancer_id: user.id, job_id: jobId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message.includes("added")) {
          setBookmarks((prev) => [...prev, jobId]);
        } else {
          setBookmarks((prev) => prev.filter((id) => id !== jobId));
        }
      })
      .catch((err) => console.error("Error toggling bookmark:", err));
  };

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
              <Link to={`/jobs/${job.id}`} state={{ job }}>
                View Details
              </Link>
              {user?.role === "freelancer" && (
                <button
                  className={`bookmark-btn ${bookmarks.includes(job.id) ? "bookmarked" : ""}`}
                  onClick={() => toggleBookmark(job.id)}
                  title={bookmarks.includes(job.id) ? "Remove Bookmark" : "Add Bookmark"}
                >
                  {bookmarks.includes(job.id) ? "★" : "☆"}
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="no-jobs-message">No jobs found.</p>
        )}
      </div>
    </div>
  );
}

export default JobSearch;
