import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles.css";

function CustomJob() {
  const [freelancers, setFreelancers] = useState([]);
  const [filteredFreelancers, setFilteredFreelancers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFreelancer, setSelectedFreelancer] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [customJobs, setCustomJobs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Memoize user to ensure stable reference
  const user = useMemo(() => JSON.parse(localStorage.getItem("user")), []);

  useEffect(() => {
    // If user is not authenticated or doesn't have a valid role, redirect to login
    if (!user || !user.id || !["client", "freelancer"].includes(user.role)) {
      setError("Please log in to access this page.");
      setLoading(false);
      navigate("/login");
      return;
    }

    setLoading(true);
    if (user.role === "client") {
      fetch("http://localhost:5000/freelancers")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch freelancers.");
          return res.json();
        })
        .then((data) => {
          setFreelancers(data);
          setFilteredFreelancers(data);
          setLoading(false);
          setError("");
        })
        .catch((err) => {
          console.error("Error fetching freelancers:", err);
          setError("Error fetching freelancers.");
          setLoading(false);
        });
    } else if (user.role === "freelancer") {
      fetch(`http://localhost:5000/custom-jobs?freelancer_id=${user.id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch custom jobs.");
          return res.json();
        })
        .then((data) => {
          setCustomJobs(data.filter((job) => job.status === "Pending"));
          setLoading(false);
          setError("");
        })
        .catch((err) => {
          console.error("Error fetching custom jobs:", err);
          setError("Error fetching custom jobs.");
          setLoading(false);
        });
    }
  }, [navigate]); // Removed user from dependency array

  // Handle freelancer search (client-side)
  useEffect(() => {
    setFilteredFreelancers(
      freelancers.filter((freelancer) =>
        freelancer.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, freelancers]);

  // Handle custom job form submission (clients)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFreelancer) {
      setError("Please select a freelancer.");
      return;
    }
    if (!title || !description || !budget) {
      setError("Please fill all fields.");
      return;
    }
    if (budget <= 0) {
      setError("Budget must be greater than 0.");
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/custom-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: user.id,
          freelancer_id: selectedFreelancer.id,
          title,
          description,
          budget: parseFloat(budget),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert("Custom job submitted successfully!");
        setTitle("");
        setDescription("");
        setBudget("");
        setSelectedFreelancer(null);
        setError("");
      } else {
        setError(data.message || "Failed to submit custom job.");
      }
    } catch {
      setError("Error submitting custom job.");
    }
  };

  // Handle approve custom job (freelancers)
  const handleApprove = async (jobId) => {
    try {
      const response = await fetch(`http://localhost:5000/custom-jobs/${jobId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (response.ok) {
        alert("Custom job approved!");
        setCustomJobs((prev) => prev.filter((job) => job.id !== jobId));
        setError("");
      } else {
        setError(data.message || "Failed to approve custom job.");
      }
    } catch {
      setError("Error approving custom job.");
    }
  };

  // Handle decline custom job (freelancers)
  const handleDecline = async (jobId) => {
    try {
      const response = await fetch(`http://localhost:5000/custom-jobs/${jobId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (response.ok) {
        alert("Custom job declined.");
        setCustomJobs((prev) => prev.filter((job) => job.id !== jobId));
        setError("");
      } else {
        setError(data.message || "Failed to decline custom job.");
      }
    } catch {
      setError("Error declining custom job.");
    }
  };

  if (loading) {
    return <div className="profile-loading">Loading...</div>;
  }

  return (
    <div className="custom-job-container">
      {user.role === "client" ? (
        <div className="custom-job-split">
          {/* Left: Freelancer List */}
          <div className="freelancer-list">
            <h3>Freelancers</h3>
            <input
              type="text"
              placeholder="Search freelancers by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="freelancer-search"
            />
            {filteredFreelancers.length === 0 ? (
              <p className="no-freelancers">No freelancers found.</p>
            ) : (
              <div className="freelancer-items">
                {filteredFreelancers.map((freelancer) => (
                  <div
                    key={freelancer.id}
                    className={`freelancer-item ${selectedFreelancer?.id === freelancer.id ? "selected" : ""}`}
                    onClick={() => setSelectedFreelancer(freelancer)}
                  >
                    <h4>{freelancer.name}</h4>
                    <p>{freelancer.skills || "No skills listed"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Custom Job Form */}
          <div className="custom-job-form-container">
            <h2>Create Custom Job</h2>
            {selectedFreelancer ? (
              <p>
                Selected Freelancer: <strong>{selectedFreelancer.name}</strong>
              </p>
            ) : (
              <p>Please select a freelancer from the list.</p>
            )}
            <form className="custom-job-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title">Job Title</label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter job title"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter job description"
                  rows="5"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="budget">Budget ($)</label>
                <input
                  type="number"
                  id="budget"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Enter budget"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              {error && <p className="error-message">{error}</p>}
              <button type="submit" className="submit-custom-job-btn">Submit Custom Job</button>
            </form>
          </div>
        </div>
      ) : (
        <div className="custom-jobs-list">
          <h2>Your Custom Job Offers</h2>
          {customJobs.length === 0 ? (
            <p className="no-custom-jobs">No pending custom job offers.</p>
          ) : (
            <div className="custom-job-items">
              {customJobs.map((job) => (
                <div key={job.id} className="custom-job-item">
                  <h3>{job.title}</h3>
                  <p>{job.description}</p>
                  <p>
                    <strong>Budget:</strong> ${job.budget?.toFixed(2)}
                  </p>
                  <p>
                    <strong>Client:</strong> {job.clientName}
                  </p>
                  <div className="custom-job-actions">
                    <button className="approve-custom-job-btn" onClick={() => handleApprove(job.id)}>
                      Approve
                    </button>
                    <button className="decline-custom-job-btn" onClick={() => handleDecline(job.id)}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && <p className="error-message">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default CustomJob;