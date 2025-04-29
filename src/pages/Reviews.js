import { useEffect, useState } from "react";
import "../styles.css";

function Reviews() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [completedJobs, setCompletedJobs] = useState([]);
  const [reviewsGiven, setReviewsGiven] = useState([]);
  const [reviewsReceived, setReviewsReceived] = useState([]);
  const [newReviews, setNewReviews] = useState({});

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const queryParam = user.role === "client" ? `client_id=${user.id}` : `freelancer_id=${user.id}`;
        const [jobsRes, reviewsGivenRes, reviewsReceivedRes] = await Promise.all([
          fetch(`http://localhost:5000/completed-jobs?${queryParam}`),
          fetch(`http://localhost:5000/reviews-given/${user.id}`),
          fetch(`http://localhost:5000/reviews/${user.id}`),
        ]);

        const jobsData = await jobsRes.json();
        const reviewsGivenData = await reviewsGivenRes.json();
        const reviewsReceivedData = await reviewsReceivedRes.json();

        setCompletedJobs(jobsData || []);
        setReviewsGiven(reviewsGivenData || []);
        setReviewsReceived(reviewsReceivedData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [user?.id]);

  const handleReviewChange = (jobId, field, value) => {
    setNewReviews((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        [field]: value,
      },
    }));
  };

  const handleReviewSubmit = async (jobId, freelancerId, clientId) => {
    const review = newReviews[jobId] || { rating: "", comment: "" };
    if (!review.rating || !review.comment) {
      alert("Please provide a rating and comment.");
      return;
    }

    const reviewedId = user.role === "client" ? freelancerId : clientId;

    try {
      const res = await fetch(`http://localhost:5000/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer_id: user.id,
          reviewed_id: reviewedId,
          job_id: jobId,
          rating: Number(review.rating),
          comment: review.comment.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to submit review");
      alert("Review submitted successfully!");

      setNewReviews((prev) => {
        const updated = { ...prev };
        delete updated[jobId];
        return updated;
      });

      const [reviewsGivenRes, reviewsReceivedRes] = await Promise.all([
        fetch(`http://localhost:5000/reviews-given/${user.id}`),
        fetch(`http://localhost:5000/reviews/${user.id}`),
      ]);
      const reviewsGivenData = await reviewsGivenRes.json();
      const reviewsReceivedData = await reviewsReceivedRes.json();
      setReviewsGiven(reviewsGivenData || []);
      setReviewsReceived(reviewsReceivedData || []);
    } catch (error) {
      console.error("Error submitting review:", error);
    }
  };

  // Deduplicate completed jobs by job ID
  const uniqueCompletedJobs = Array.from(
    new Map(completedJobs.map((job) => [job.id, job])).values()
  );

  const unreviewedJobs = uniqueCompletedJobs.filter(
    (job) => !reviewsGiven.some((review) => review.job_id === job.id)
  );

  // Deduplicate reviews received by review ID
  const uniqueReviewsReceived = Array.from(
    new Map(reviewsReceived.map((review) => [review.id, review])).values()
  );

  return (
    <div className="dashboard-container reviews-page">
      <h2>Jobs to Review</h2>
      {unreviewedJobs.length === 0 ? (
        <p className="no-jobs-message">No jobs to review yet.</p>
      ) : (
        <div className="job-cards-container">
          {unreviewedJobs.map((job) => (
            <div key={job.id} className="job-card job-review-card">
              <h3>{job.title}</h3>
              <p>
                <strong>{user.role === "freelancer" ? "Client" : "Freelancer"}:</strong>{" "}
                {user.role === "freelancer" ? job.clientName : job.freelancerName}
              </p>
              <p>
                <strong>Amount:</strong> ${job.bidAmount}
              </p>
              <div className="review-form">
                <input
                  type="number"
                  min="1"
                  max="5"
                  placeholder="Rating (1-5)"
                  value={newReviews[job.id]?.rating || ""}
                  onChange={(e) => handleReviewChange(job.id, "rating", e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Write a review..."
                  value={newReviews[job.id]?.comment || ""}
                  onChange={(e) => handleReviewChange(job.id, "comment", e.target.value)}
                />
                <button
                  className="submit-review-btn"
                  onClick={() => handleReviewSubmit(job.id, job.freelancer_id, job.client_id)}
                >
                  Submit Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>Reviews Received</h2>
      {uniqueReviewsReceived.length === 0 ? (
        <p className="no-reviews-message">No reviews received yet.</p>
      ) : (
        <div className="job-cards-container">
          {uniqueReviewsReceived.map((review) => (
            <div key={review.id} className="job-card review-card">
              <h3>{review.jobTitle}</h3>
              <p>
                <strong>Description:</strong> {review.jobDescription}
              </p>
              <p>
                <strong>Amount:</strong> ${review.jobAmount}
              </p>
              <p>
                <strong>Review from {review.reviewerName}:</strong> {review.comment} ⭐{review.rating}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Reviews;