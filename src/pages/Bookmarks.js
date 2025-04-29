import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../styles.css";

function Bookmarks({ user }) {
  const [bookmarks, setBookmarks] = useState([]);
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
        setError("Please log in to view bookmarks.");
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
      setError("Only freelancers can view bookmarks!");
      setLoading(false);
      return;
    }

    fetch(`http://localhost:5000/bookmarks?freelancer_id=${currentUser.id}`)
      .then((res) => res.json())
      .then((data) => {
        setBookmarks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching bookmarks:", err);
        setError("Failed to load bookmarks.");
        setLoading(false);
      });
  }, [currentUser]);

  const toggleBookmark = (jobId) => {
    fetch("http://localhost:5000/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freelancer_id: currentUser.id, job_id: jobId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message.includes("added")) {
          fetch(`http://localhost:5000/jobs/${jobId}`)
            .then((res) => res.json())
            .then((job) => {
              setBookmarks((prev) => [...prev, job]);
            });
        } else {
          setBookmarks((prev) => prev.filter((job) => job.id !== jobId));
        }
      })
      .catch((err) => {
        console.error("Error toggling bookmark:", err);
        setError("Failed to update bookmark.");
      });
  };

  if (loading) {
    return <div className="profile-loading">Loading bookmarks...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!currentUser) {
    return <div className="error-message">Please log in to view bookmarks.</div>;
  }

  return (
    <div className="bookmarks-container">
      <h2>Bookmarked Jobs</h2>
      <div className="bookmark-list">
        {bookmarks.length > 0 ? (
          bookmarks.map((job) => (
            <div key={job.id} className="bookmark-item">
              <h3>{job.title}</h3>
              <p>{job.description}</p>
              <p>
                <strong>Budget:</strong> ${job.budget}
              </p>
              <Link to={`/jobs/${job.id}`} state={{ job }}>
                View Details
              </Link>
              <button
                className="bookmark-btn bookmarked"
                onClick={() => toggleBookmark(job.id)}
                title="Remove Bookmark"
              >
                ★
              </button>
            </div>
          ))
        ) : (
          <p className="no-jobs-message">No bookmarked jobs found.</p>
        )}
      </div>
    </div>
  );
}

export default Bookmarks;