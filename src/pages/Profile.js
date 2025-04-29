import { useState, useEffect } from "react";
import "../styles.css";

function Profile() {
  const [user, setUser] = useState(null);
  const [skills, setSkills] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);

  // Predefined list of 20 skills
  const skillOptions = [
    "Web Development",
    "Mobile App Development",
    "Graphic Design",
    "UI/UX Design",
    "Content Writing",
    "Copywriting",
    "SEO Optimization",
    "Digital Marketing",
    "Social Media Management",
    "Video Editing",
    "Photography",
    "Data Analysis",
    "Machine Learning",
    "Cloud Computing",
    "Database Administration",
    "Project Management",
    "Translation",
    "Voice Over",
    "Customer Support",
    "Accounting",
  ];

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
          setEmail(data.email || "");
          if (data.role === "freelancer") {
            // Set skills to current user.skills if it exists and is in skillOptions, else empty
            setSkills(skillOptions.includes(data.skills) ? data.skills : "");
          }
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching profile:", error);
        setLoading(false);
      });
  }, []);

  const handleSaveSkills = () => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser) {
      alert("User not found!");
      return;
    }

    if (!skills && storedUser.role === "freelancer") {
      alert("Please select a skill!");
      return;
    }

    fetch("http://localhost:5000/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        user_id: storedUser.id,
        skills: storedUser.role === "freelancer" ? skills : undefined,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        alert(data.message);
        if (data.message === "Profile updated successfully!") {
          // Update user state to reflect new skills
          setUser((prev) => ({ ...prev, skills }));
        }
      })
      .catch((error) => console.error("Error updating skills:", error));
  };

  const handleUpdateEmail = () => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser) {
      alert("User not found!");
      return;
    }

    fetch("http://localhost:5000/user/update-email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        user_id: storedUser.id,
        email,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        alert(data.message);
        if (data.message === "Email updated successfully!") {
          // Update localStorage and user state
          const updatedUser = { ...storedUser, email };
          localStorage.setItem("user", JSON.stringify(updatedUser));
          setUser((prev) => ({ ...prev, email }));
        }
      })
      .catch((error) => console.error("Error updating email:", error));
  };

  const handleUpdatePassword = () => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser) {
      alert("User not found!");
      return;
    }

    if (!password) {
      alert("Password cannot be empty!");
      return;
    }

    fetch("http://localhost:5000/user/update-password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        user_id: storedUser.id,
        password,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        alert(data.message);
        if (data.message === "Password updated successfully!") {
          setPassword(""); // Clear password field
        }
      })
      .catch((error) => console.error("Error updating password:", error));
  };

  if (loading) return <p className="profile-loading">Loading...</p>;
  if (!user) return <p className="profile-error">Error loading profile.</p>;

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      <div className="profile-field">
        <label>Name</label>
        <p>{user.name}</p>
      </div>

      <div className="profile-field">
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email..."
        />
        <button onClick={handleUpdateEmail}>Update Email</button>
      </div>

      <div className="profile-field">
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter new password..."
        />
        <button onClick={handleUpdatePassword}>Update Password</button>
      </div>

      {user.role === "freelancer" && (
        <>
          <div className="profile-field">
            <label>Skills</label>
            <select
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="profile-skills-select"
            >
              <option value="">Select a skill</option>
              {skillOptions.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
            <button onClick={handleSaveSkills}>Update Skills</button>
          </div>

          <div className="profile-field">
            <label>Completed Jobs</label>
            <p>{user.completedJobs}</p>
          </div>

          <div className="profile-field">
            <label>Ongoing Jobs</label>
            <p>{user.ongoingJobs}</p>
          </div>

          <div className="profile-field">
            <label>Average Rating</label>
            <p>{user.averageRating}</p>
          </div>

          <div className="profile-field">
            <label>Total Earnings</label>
            <p>${user.totalEarnings.toFixed(2)}</p>
          </div>
        </>
      )}
    </div>
  );
}

export default Profile;
