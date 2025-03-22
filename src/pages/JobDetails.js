import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import "../styles.css";

function JobDetails({ user }) {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [proposal, setProposal] = useState("");
  const [bids, setBids] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); // ✅ Store local user state

  // ✅ Load user from localStorage when the component mounts
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    setCurrentUser(storedUser);
  }, []);

  // ✅ Fetch job details
  useEffect(() => {
    fetch(`http://localhost:5000/jobs/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setJob(data);
        setBids(data.bids || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching job details:", err);
        setLoading(false);
      });
  }, [id]);

  // ✅ Handle bid submission
  const handleSubmitBid = async (e) => {
    e.preventDefault();

    if (!currentUser || currentUser.role !== "freelancer") {
      alert("Only freelancers can submit bids.");
      return;
    }

    if (!bidAmount || !proposal) {
      alert("Please fill all fields!");
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: id,
          freelancer_id: currentUser.id,
          bidAmount: parseFloat(bidAmount),
          proposal: proposal,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setBids([...bids, { freelancerName: currentUser.name, bidAmount, proposal }]);
        setBidAmount("");
        setProposal("");
      } else {
        alert(data.message || "Error submitting bid.");
      }
    } catch (err) {
      console.error("Error submitting bid:", err);
    }
  };

  if (loading) return <p>Loading job details...</p>;
  if (!job) return <p>Job not found.</p>;

  return (
    <div className="job-details-container">
      <h2>{job.title}</h2>
      <p>{job.description}</p>
      <p><strong>Budget:</strong> ${job.budget}</p>

      {/* Show bids if the user is a client */}
      {currentUser?.role === "client" && (
        <div className="bids-section">
          <h3>Bids Received</h3>
          {bids.length > 0 ? (
            <ul>
              {bids.map((bid, index) => (
                <li key={index}>
                  <strong>Freelancer:</strong> {bid.freelancerName} <br />
                  <strong>Bid Amount:</strong> ${bid.bidAmount} <br />
                  <strong>Proposal:</strong> {bid.proposal}
                </li>
              ))}
            </ul>
          ) : (
            <p>No bids received yet.</p>
          )}
        </div>
      )}

      {/* Freelancers can submit bids */}
      {currentUser?.role === "freelancer" && (
        <form className="bid-form" onSubmit={handleSubmitBid}>
          <h3>Submit a Bid</h3>
          <input
            type="number"
            placeholder="Bid Amount ($)"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            required
          />
          <textarea
            placeholder="Write your proposal..."
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            required
          />
          <button type="submit">Submit Bid</button>
        </form>
      )}
    </div>
  );
}

export default JobDetails;
