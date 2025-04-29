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
import Reviews from "./pages/Reviews";
import Bookmarks from "./pages/Bookmarks";
import History from "./pages/History";
import CustomJob from "./pages/CustomJob";
import Messages from "./pages/Messages";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Function to check authentication and update state
  const checkAuth = () => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser) {
      setIsAuthenticated(true);
      setUserRole(storedUser.role);
      setUser(storedUser);
    } else {
      setIsAuthenticated(false);
      setUserRole(null);
      setUser(null);
    }
    setIsLoadingAuth(false);
  };

  useEffect(() => {
    checkAuth(); // Initial auth check on mount
  }, []);

  // Update user state when logging in or out
  const handleLogin = (userData) => {
    setIsLoadingAuth(true);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
    setUserRole(userData.role);
    setIsLoadingAuth(false);
  };

  const handleLogout = () => {
    setIsLoadingAuth(true);
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    setUserRole(null);
    setUser(null);
    setIsLoadingAuth(false);
  };

  if (isLoadingAuth) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Navbar isAuthenticated={isAuthenticated} handleLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/login"
          element={<Login setIsAuthenticated={setIsAuthenticated} setUserRole={setUserRole} setUser={handleLogin} />}
        />
        <Route
          path="/signup"
          element={<Signup setIsAuthenticated={setIsAuthenticated} setUserRole={setUserRole} setUser={handleLogin} />}
        />
        <Route path="/jobs" element={<JobSearch />} />
        <Route path="/jobs/:id" element={<JobDetails />} />

        {isAuthenticated ? (
          <>
            <Route
              path="/dashboard"
              element={<Navigate to={userRole === "client" ? "/client-dashboard" : "/freelancer-dashboard"} />}
            />
            <Route path="/profile" element={<Profile />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/history" element={<History />} />
            <Route path="/custom-job" element={<CustomJob />} />
            <Route path="/messages" element={<Messages />} />

            {userRole === "client" && (
              <>
                <Route path="/client-dashboard" element={<ClientDashboard />} />
                <Route path="/job-posting" element={<JobPosting />} />
                <Route path="/view-proposals/:jobId" element={<ViewProposals />} />
              </>
            )}

            {userRole === "freelancer" && (
              <>
                <Route path="/freelancer-dashboard" element={<FreelancerDashboard />} />
                <Route path="/bookmarks" element={<Bookmarks />} />
                <Route path="/history" element={<History />} />
              </>
            )}
          </>
        ) : (
          <>
            <Route path="/dashboard" element={<Navigate to="/login" />} />
            <Route path="/client-dashboard" element={<Navigate to="/login" />} />
            <Route path="/freelancer-dashboard" element={<Navigate to="/login" />} />
            <Route path="/job-posting" element={<Navigate to="/login" />} />
            <Route path="/profile" element={<Navigate to="/login" />} />
            <Route path="/view-proposals/:jobId" element={<Navigate to="/login" />} />
            <Route path="/reviews" element={<Navigate to="/login" />} />
            <Route path="/bookmarks" element={<Navigate to="/login" />} />
            <Route path="/history" element={<Navigate to="/login" />} />
            <Route path="/custom-job" element={<Navigate to="/login" />} />
            <Route path="/messages" element={<Navigate to="/login" />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
