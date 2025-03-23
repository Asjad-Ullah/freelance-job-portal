const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const db = new sqlite3.Database("./database.db");

const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// ✅ Create Users Table
db.run(
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT, 
    email TEXT UNIQUE, 
    password TEXT,
    role TEXT CHECK(role IN ('freelancer', 'client')) NOT NULL,
    skills TEXT DEFAULT NULL, 
    companyName TEXT DEFAULT NULL
  )`
);

// ✅ Create Jobs Table
db.run(
  `CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    title TEXT, 
    description TEXT, 
    budget REAL, 
    client_id INTEGER,
    status TEXT DEFAULT 'Open',
    FOREIGN KEY (client_id) REFERENCES users(id)
  )`
);

// ✅ Create Bids Table (Freelancer Proposals)
db.run(
  `CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    freelancer_id INTEGER,
    freelancerName TEXT,
    bidAmount REAL,
    proposal TEXT,
    status TEXT DEFAULT 'Pending',
    FOREIGN KEY (job_id) REFERENCES jobs(id),
    FOREIGN KEY (freelancer_id) REFERENCES users(id)
  )`
);

// ✅ Create Reviews Table
db.run(
  `CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reviewer_id INTEGER,
    reviewed_id INTEGER,
    job_id INTEGER,
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    FOREIGN KEY (reviewer_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_id) REFERENCES users(id),
    FOREIGN KEY (job_id) REFERENCES jobs(id)
  )`
);

// ✅ Submit a Review
app.post("/reviews", (req, res) => {
  const { reviewer_id, reviewed_id, job_id, rating, comment } = req.body;

  if (!reviewer_id || !reviewed_id || !job_id || !rating) {
    return res.status(400).json({ message: "Missing required fields!" });
  }

  db.run(
    "INSERT INTO reviews (reviewer_id, reviewed_id, job_id, rating, comment) VALUES (?, ?, ?, ?, ?)",
    [reviewer_id, reviewed_id, job_id, rating, comment],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Error submitting review!" });
      }
      res.json({ message: "Review submitted successfully!" });
    }
  );
});

// ✅ Fetch Reviews Received by a User (where user is reviewed_id)
// ✅ Fetch Reviews Received by a User (where user is reviewed_id)
app.get("/reviews/:user_id", (req, res) => {
  const { user_id } = req.params;
  db.all(
    `SELECT r.id, r.rating, r.comment, u.name AS reviewerName, 
            j.title AS jobTitle, j.description AS jobDescription, 
            b.bidAmount AS jobAmount
     FROM reviews r 
     JOIN users u ON r.reviewer_id = u.id 
     JOIN jobs j ON r.job_id = j.id
     JOIN bids b ON j.id = b.job_id
     WHERE r.reviewed_id = ?`,
    [user_id],
    (err, reviews) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Error fetching reviews!" });
      }
      res.json(reviews || []);
    }
  );
});

// ✅ Fetch Reviews Given by a User (where user is reviewer_id) - NEW ENDPOINT
// ✅ Fetch Reviews Given by a User (where user is reviewer_id)
app.get("/reviews-given/:user_id", (req, res) => {
  const { user_id } = req.params;
  db.all(
    `SELECT r.id, r.rating, r.comment, r.job_id, r.reviewed_id, u.name AS reviewedName
     FROM reviews r 
     JOIN users u ON r.reviewed_id = u.id 
     WHERE r.reviewer_id = ?`,
    [user_id],
    (err, reviews) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Error fetching reviews given!" });
      }
      res.json(reviews || []);
    }
  );
});

// ✅ Submit a Bid (Proposal)
app.post("/bids", (req, res) => {
  const { job_id, freelancer_id, bidAmount, proposal } = req.body;

  db.get("SELECT name FROM users WHERE id = ?", [freelancer_id], (err, user) => {
    if (err || !user) {
      return res.status(400).json({ message: "Invalid freelancer ID!" });
    }

    db.run(
      "INSERT INTO bids (job_id, freelancer_id, freelancerName, bidAmount, proposal) VALUES (?, ?, ?, ?, ?)",
      [job_id, freelancer_id, user.name, bidAmount, proposal],
      function (err) {
        if (err) {
          return res.status(400).json({ message: "Error submitting bid!" });
        }
        res.json({ message: "Bid submitted successfully!", bid_id: this.lastID });
      }
    );
  });
});

// ✅ Fetch Completed Jobs (For Reviews)
app.get("/completed-jobs", (req, res) => {
  const { client_id, freelancer_id } = req.query;

  let query = `
    SELECT jobs.id, jobs.title, jobs.description, jobs.budget, 
           jobs.client_id, 
           u.name AS clientName,
           bids.freelancer_id, bids.freelancerName, bids.bidAmount 
    FROM jobs 
    JOIN bids ON jobs.id = bids.job_id
    JOIN users u ON jobs.client_id = u.id
    WHERE jobs.status = 'Completed' AND bids.status = 'Completed'
  `;

  let params = [];

  if (client_id) {
    query += " AND jobs.client_id = ?";
    params.push(client_id);
  }

  if (freelancer_id) {
    query += " AND bids.freelancer_id = ?";
    params.push(freelancer_id);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Error fetching completed jobs!" });
    }
    res.json(rows || []);
  });
});

// ✅ Fetch Job Details with Bids
app.get("/jobs/:id", (req, res) => {
  const jobId = req.params.id;

  db.get("SELECT id, title, description, budget FROM jobs WHERE id = ?", [jobId], (err, job) => {
    if (err) {
      return res.status(500).json({ message: "Error retrieving job details!" });
    }
    if (!job) {
      return res.status(404).json({ message: "Job not found!" });
    }

    db.all("SELECT * FROM bids WHERE job_id = ?", [jobId], (err, bids) => {
      if (err) {
        return res.status(500).json({ message: "Error retrieving bids!" });
      }
      res.json({ ...job, bids: bids || [] });
    });
  });
});

// ✅ Fetch Proposals for a Job
app.get("/proposals", (req, res) => {
  const { job_id } = req.query;

  if (!job_id) {
    return res.status(400).json({ message: "Job ID is required!" });
  }

  db.all("SELECT * FROM bids WHERE job_id = ?", [job_id], (err, rows) => {
    if (err) {
      res.status(500).json({ message: "Error fetching proposals" });
    } else {
      res.json(rows || []);
    }
  });
});

// ✅ Approve a Proposal and Close the Job
app.post("/approve-proposal/:id", (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM bids WHERE id = ?", [id], (err, proposal) => {
    if (err) {
      return res.status(500).json({ message: "Error checking proposal existence!" });
    }
    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found!" });
    }

    db.run("UPDATE bids SET status = 'Approved' WHERE id = ?", [id], function (err) {
      if (err) {
        return res.status(500).json({ message: "Error approving proposal!" });
      }

      db.run("UPDATE jobs SET status = 'Closed' WHERE id = ?", [proposal.job_id], function (err) {
        if (err) {
          return res.status(500).json({ message: "Error closing job!" });
        }
        res.json({ message: "Proposal approved and job closed!" });
      });
    });
  });
});

// ✅ Fetch Ongoing Jobs (For Clients & Freelancers)
app.get("/ongoing-jobs", (req, res) => {
  const { client_id, freelancer_id } = req.query;

  let query = `
    SELECT jobs.id, jobs.title, jobs.description, jobs.budget, 
           bids.freelancer_id, bids.freelancerName, bids.bidAmount, bids.status
    FROM jobs 
    JOIN bids ON jobs.id = bids.job_id
    WHERE bids.status = 'Approved'
  `;

  let params = [];

  if (client_id) {
    query += " AND jobs.client_id = ?";
    params.push(client_id);
  } else if (freelancer_id) {
    query += " AND bids.freelancer_id = ?";
    params.push(freelancer_id);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Error fetching ongoing jobs!" });
    }
    res.json(rows || []);
  });
});

// ✅ Mark Job as Completed
app.post("/complete-job/:job_id", (req, res) => {
  const { job_id } = req.params;

  db.run(
    "UPDATE bids SET status = 'Completed' WHERE job_id = ? AND status = 'Approved'",
    [job_id],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Error marking job as completed!" });
      }

      db.run("UPDATE jobs SET status = 'Completed' WHERE id = ?", [job_id], function (err) {
        if (err) {
          return res.status(500).json({ message: "Error updating job status!" });
        }
        res.json({ message: "Job marked as completed!" });
      });
    }
  );
});

// ✅ Signup Route
app.post("/signup", (req, res) => {
  const { name, email, password, role } = req.body;

  if (!role || (role !== "freelancer" && role !== "client")) {
    return res.status(400).json({ message: "Invalid role selected!" });
  }

  db.run(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
    [name, email, password, role],
    function (err) {
      if (err) {
        return res.status(400).json({ message: "Email already exists!" });
      }
      res.json({ message: "Signup successful!" });
    }
  );
});

// ✅ Login Route
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    "SELECT id, name, email, role FROM users WHERE email = ? AND password = ?",
    [email, password],
    (err, user) => {
      if (err || !user) {
        return res.status(401).json({ message: "Invalid email or password!" });
      }
      res.json({ message: "Login successful!", user });
    }
  );
});

// ✅ Get User Profile
app.get("/user/profile", (req, res) => {
  const { user_id } = req.query;

  db.get(
    "SELECT id, name, email, role, skills, companyName FROM users WHERE id = ?",
    [user_id],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ message: "User not found!" });
      }
      res.json(user);
    }
  );
});

// ✅ Update User Profile
app.put("/user/profile", (req, res) => {
  const { user_id, skills, companyName } = req.body;

  db.run(
    "UPDATE users SET skills = COALESCE(?, skills), companyName = COALESCE(?, companyName) WHERE id = ?",
    [skills, companyName, user_id],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "Error updating profile!" });
      }
      res.json({ message: "Profile updated successfully!" });
    }
  );
});

// ✅ Fetch Jobs Posted by a Specific Client
app.get("/client-jobs", (req, res) => {
  const { client_id } = req.query;

  if (!client_id) {
    return res.status(400).json({ message: "Client ID is required!" });
  }

  db.all(
    "SELECT * FROM jobs WHERE client_id = ? AND status = 'Open'",
    [client_id],
    (err, jobs) => {
      if (err) {
        return res.status(500).json({ message: "Error fetching client jobs!" });
      }
      res.json(jobs || []);
    }
  );
});

// ✅ Job Posting Route (Clients Only)
app.post("/jobs", (req, res) => {
  const { title, description, budget, client_id } = req.body;

  db.get("SELECT role FROM users WHERE id = ?", [client_id], (err, user) => {
    if (err || !user) {
      return res.status(400).json({ message: "Invalid client ID!" });
    }
    if (user.role !== "client") {
      return res.status(403).json({ message: "Only clients can post jobs!" });
    }

    db.run(
      "INSERT INTO jobs (title, description, budget, client_id) VALUES (?, ?, ?, ?)",
      [title, description, budget, client_id],
      function (err) {
        if (err) {
          return res.status(400).json({ message: "Error posting job!" });
        }
        res.json({ message: "Job posted successfully!", job_id: this.lastID });
      }
    );
  });
});

// ✅ Fetch Available Jobs (Only 'Open' Jobs)
app.get("/jobs", (req, res) => {
  db.all("SELECT * FROM jobs WHERE status = 'Open'", [], (err, jobs) => {
    if (err) {
      return res.status(500).json({ message: "Error fetching jobs!" });
    }
    res.json(jobs);
  });
});

// ✅ Start Server
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});