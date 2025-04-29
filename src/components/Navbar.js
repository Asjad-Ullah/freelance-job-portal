import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import Notifications from "../pages/Notifications";
import "../styles.css";

function Navbar({ isAuthenticated, handleLogout }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogoutClick = () => {
    handleLogout();
    localStorage.removeItem("user");
    navigate("/");
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="navbar">
      <h1 className="logo">Freelance Portal</h1>
      <div className={`nav-links ${isMenuOpen ? "active" : ""}`}>
        {!isAuthenticated ? (
          <>
            <Link to="/" onClick={toggleMenu}>Home</Link>
            <Link to="/jobs" onClick={toggleMenu}>Find Jobs</Link>
            <Link to="/login" onClick={toggleMenu}>Login</Link>
            <Link to="/signup" onClick={toggleMenu}>Signup</Link>
          </>
        ) : (
          <>
            <Link
              to={user?.role === "client" ? "/client-dashboard" : "/freelancer-dashboard"}
              onClick={toggleMenu}
            >
              Dashboard
            </Link>
            <Link to="/profile" onClick={toggleMenu}>Profile</Link>
            <Link to="/reviews" onClick={toggleMenu}>Reviews</Link>
            <Link to="/messages" onClick={toggleMenu}>Messages</Link>
            {user?.role === "freelancer" && (
              <>
                <Link to="/jobs" onClick={toggleMenu}>Find Jobs</Link>
                <Link to="/bookmarks" onClick={toggleMenu}>Bookmarks</Link>
                <Link to="/history" onClick={toggleMenu}>History</Link>
                <Link to="/custom-job" onClick={toggleMenu}>Custom Jobs</Link>
              </>
            )}
            {user?.role === "client" && (
              <>
                <Link to="/job-posting" onClick={toggleMenu}>Post a Job</Link>
                <Link to="/custom-job" onClick={toggleMenu}>Custom Job</Link>
              </>
            )}
            <Notifications />
            <button onClick={() => { handleLogoutClick(); toggleMenu(); }} className="logout-btn">
              Logout
            </button>
          </>
        )}
      </div>
      <div className="hamburger" onClick={toggleMenu}>
        {isMenuOpen ? "✕" : "☰"}
      </div>
    </nav>
  );
}

export default Navbar;
