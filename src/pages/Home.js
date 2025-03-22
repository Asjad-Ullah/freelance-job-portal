import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="home-container">
      <h1 className="home-title">Find the Best Freelancers & Clients</h1>
      <p className="home-text">
        Join our platform and start your freelancing journey today.
      </p>
      <Link to="/signup" className="home-btn">Get Started</Link>
    </div>
  );
}

export default Home;
