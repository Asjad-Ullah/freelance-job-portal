import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles.css";

function Login({ setIsAuthenticated, setUserRole }) { // Accept setUserRole as a prop
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const response = await fetch("http://localhost:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      alert("Login successful!");
      localStorage.setItem("user", JSON.stringify(data.user)); // Store user info
      setIsAuthenticated(true);
      setUserRole(data.user.role); // Set role in state

      // Redirect based on user role
      if (data.user.role === "client") {
        navigate("/client-dashboard");
      } else if (data.user.role === "freelancer") {
        navigate("/freelancer-dashboard");
      } else {
        navigate("/"); // Fallback if role is missing
      }
    } else {
      alert(data.message);
    }
  };

  return (
    <div className="auth-container">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Login</button>
      </form>
      <p>Don't have an account? <Link to="/signup">Signup</Link></p>
    </div>
  );
}

export default Login;
