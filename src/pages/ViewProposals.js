import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "../styles.css";

function ViewProposals({ user }) {
  const { jobId } = useParams();
  const [jobDetails, setJobDetails] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    // Fetch job details along with proposals
    fetch(`http://localhost:5000/jobs/${jobId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data || Object.keys(data).length === 0) {
          setError("Job not found.");
        } else {
          setJobDetails({
            title: data.title,
            description: data.description,
            budget: data.budget,
          });
          setProposals(data.bids || []);
        }
      })
      .catch((err) => {
        setError("Failed to fetch job details. Please try again later.");
        console.error("Error fetching job details:", err);
      });
  }, [jobId]);

  const handleApproveProposal = async (proposalId) => {
    try {
      const response = await fetch(`http://localhost:5000/approve-proposal/${proposalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        alert("Proposal approved successfully!");
        // Update UI: Keep only the approved proposal
        setProposals((prevProposals) =>
          prevProposals
            .filter((p) => p.id === proposalId) // Remove all other proposals
            .map((p) => ({ ...p, status: "Approved" }))
        );
      } else {
        alert("Error approving proposal.");
      }
    } catch (err) {
      console.error("Error approving proposal:", err);
    }
  };

  return (
    <div className="proposals-container">
      {error ? (
        <p className="error-message">{error}</p>
      ) : (
        <>
          {jobDetails && (
            <div className="job-details">
              <h2>{jobDetails.title}</h2>
              <p><strong>Description:</strong> {jobDetails.description}</p>
              <p><strong>Budget:</strong> ${jobDetails.budget}</p>
            </div>
          )}

          <h3>Proposals</h3>
          {proposals.length === 0 ? (
            <p className="no-proposals">No proposals submitted yet.</p>
          ) : (
            <ul className="proposal-list">
              {proposals.map((proposal) => (
                <li key={proposal.id} className="proposal-item">
                  <p><strong>Freelancer:</strong> {proposal.freelancerName}</p>
                  <p><strong>Bid Amount:</strong> ${proposal.bidAmount}</p>
                  <p><strong>Proposal:</strong> {proposal.proposal}</p>
                  <p><strong>Status:</strong> {proposal.status || "Pending"}</p>

                  {proposal.status !== "Approved" && (
                    <button onClick={() => handleApproveProposal(proposal.id)} className="approve-btn">
                      Approve
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default ViewProposals;
