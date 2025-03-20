import { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import JobPosting from "./pages/JobPosting";
import JobSearch from "./pages/JobSearch";
import JobDetails from "./pages/JobDetails";
import ClientDashboard from "./pages/ClientDashboard";
import FreelancerDashboard from "./pages/FreelancerDashboard";
import Profile from "./pages/Profile";
import ViewProposals from "./pages/ViewProposals";
import Reviews from "./pages/Reviews"; // ✅ Import Reviews Page

function App() {
  // Load user from localStorage
  const storedUser = JSON.parse(localStorage.getItem("user"));
  const [isAuthenticated, setIsAuthenticated] = useState(!!storedUser);
  const [userRole, setUserRole] = useState(storedUser?.role || null);
  const [user, setUser] = useState(storedUser || null);

  useEffect(() => {
    if (storedUser) {
      setIsAuthenticated(true);
      setUserRole(storedUser.role);
      setUser(storedUser);
    }
  }, []);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <Router>
      <Navbar isAuthenticated={isAuthenticated} handleLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} setUserRole={setUserRole} setUser={setUser} />} />
        <Route path="/signup" element={<Signup setIsAuthenticated={setIsAuthenticated} setUserRole={setUserRole} setUser={setUser} />} />
        <Route path="/jobs" element={<JobSearch />} />
        <Route path="/jobs/:id" element={<JobDetails user={user} />} />

        {isAuthenticated ? (
          <>
            <Route path="/dashboard" element={<Navigate to={userRole === "client" ? "/client-dashboard" : "/freelancer-dashboard"} />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/reviews" element={<Reviews user={user} />} /> {/* ✅ Added Reviews Route */}

            {userRole === "client" && (
              <>
                <Route path="/client-dashboard" element={<ClientDashboard user={user} />} />
                <Route path="/job-posting" element={<JobPosting />} />
                <Route path="/view-proposals/:jobId" element={<ViewProposals user={user} />} />
              </>
            )}

            {userRole === "freelancer" && <Route path="/freelancer-dashboard" element={<FreelancerDashboard user={user} />} />}
          </>
        ) : (
          <>
            {/* Redirect to login if not authenticated */}
            <Route path="/dashboard" element={<Navigate to="/login" />} />
            <Route path="/client-dashboard" element={<Navigate to="/login" />} />
            <Route path="/freelancer-dashboard" element={<Navigate to="/login" />} />
            <Route path="/job-posting" element={<Navigate to="/login" />} />
            <Route path="/profile" element={<Navigate to="/login" />} />
            <Route path="/view-proposals/:jobId" element={<Navigate to="/login" />} />
            <Route path="/reviews" element={<Navigate to="/login" />} /> {/* ✅ Restrict Reviews Page */}
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
