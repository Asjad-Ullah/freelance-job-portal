import { Link, useNavigate } from "react-router-dom";

function Navbar({ isAuthenticated, handleLogout }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user")); // Get user from localStorage

  const handleLogoutClick = () => {
    handleLogout(); // Update authentication state
    localStorage.removeItem("user"); // Remove user data
    navigate("/"); // Navigate to Home
  };

  return (
    <nav className="navbar">
      <h1>Freelance Portal</h1>
      <div>
        {!isAuthenticated ? (
          // Show Home, Job Search, Login, Signup when not logged in
          <>
            <Link to="/">Home</Link>
            <Link to="/jobs">Find Jobs</Link>
            <Link to="/login">Login</Link>
            <Link to="/signup">Signup</Link>
          </>
        ) : (
          // Different links for freelancers and clients
          <>
            <Link to={user?.role === "client" ? "/client-dashboard" : "/freelancer-dashboard"}>
              Dashboard
            </Link>
            <Link to="/profile">Profile</Link>
            <Link to="/reviews">Reviews</Link> {/* ✅ New Reviews button */}
            {user?.role === "freelancer" && <Link to="/jobs">Find Jobs</Link>}
            {user?.role === "client" && <Link to="/job-posting">Post a Job</Link>}
            <button onClick={handleLogoutClick} className="logout-btn">Logout</button>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
