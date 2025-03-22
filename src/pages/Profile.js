import { useState, useEffect } from "react";

function Profile() {
  const [user, setUser] = useState(null);
  const [skills, setSkills] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser) {
      console.error("No user found in localStorage");
      setLoading(false);
      return;
    }

    // Fetch user details from backend
    fetch(`http://localhost:5000/user/profile?user_id=${storedUser.id}`, {
      method: "GET",
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          console.error("Error fetching profile:", data.message);
        } else {
          setUser(data);
          if (data.role === "freelancer") setSkills(data.skills || "");
          if (data.role === "client") setCompanyName(data.companyName || "");
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching profile:", error);
        setLoading(false);
      });
  }, []);

  const handleSave = () => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser) {
      alert("User not found!");
      return;
    }

    fetch("http://localhost:5000/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        user_id: storedUser.id, // Include user ID in update request
        skills: user.role === "freelancer" ? skills : undefined,
        companyName: user.role === "client" ? companyName : undefined,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message === "Profile updated successfully!") {
          alert("Profile updated successfully!");
        } else {
          alert("Error updating profile!");
        }
      })
      .catch((error) => console.error("Error updating profile:", error));
  };

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Error loading profile.</p>;

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      <p><strong>Name:</strong> {user.name}</p>
      <p><strong>Role:</strong> {user.role}</p>

      {user.role === "freelancer" && (
        <div>
          <label>Skills:</label>
          <input
            type="text"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Enter your skills..."
          />
        </div>
      )}

      {user.role === "client" && (
        <div>
          <label>Company Name:</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Enter your company name..."
          />
        </div>
      )}

      <button onClick={handleSave}>Save</button>
    </div>
  );
}

export default Profile;
