const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"], credentials: true }
});
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error("Error connecting to database:", err);
    process.exit(1);
  }
  console.log("Connected to database.db");
});

const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// WebSocket setup
// WebSocket setup
const userSockets = new Map(); // Map user_id to single socket ID (most recent)

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  let currentUserId = null;

  socket.on("join", (user_id) => {
    // Leave any previous rooms except the socket's own room
    Object.keys(socket.rooms).forEach((room) => {
      if (room !== socket.id) socket.leave(room);
    });
    socket.join(user_id.toString());
    currentUserId = user_id;

    // Update userSockets map (store only the latest socket)
    userSockets.set(user_id, socket.id);
    console.log(`User ${user_id} joined room ${user_id}. Active socket: ${socket.id}`);
  });

  socket.on("join_conversation", ({ user_id, other_user_id }) => {
    const room = [user_id, other_user_id].sort().join("_");
    socket.join(room);
    console.log(`User ${user_id} joined conversation room ${room}. Current rooms:`, [...socket.rooms]);
  });

  socket.on("send_message", async ({ sender_id, receiver_id, job_id, content }) => {
    console.log(`Received send_message from sender ${sender_id} to receiver ${receiver_id}`);
    if (!sender_id || !receiver_id || !content) {
      socket.emit("error", { message: "Sender ID, receiver ID, and content are required!" });
      console.log("Validation failed: Missing required fields");
      return;
    }
    try {
      const sender = await new Promise((resolve, reject) => {
        db.get("SELECT role, name FROM users WHERE id = ?", [sender_id], (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
      });
      if (!sender) {
        socket.emit("error", { message: "Invalid sender ID!" });
        console.log(`Validation failed: Invalid sender ID ${sender_id}`);
        return;
      }
      const receiver = await new Promise((resolve, reject) => {
        db.get("SELECT role FROM users WHERE id = ?", [receiver_id], (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
      });
      if (!receiver) {
        socket.emit("error", { message: "Invalid receiver ID!" });
        console.log(`Validation failed: Invalid receiver ID ${receiver_id}`);
        return;
      }
      if (sender.role === receiver.role) {
        socket.emit("error", { message: "Cannot message users of the same role!" });
        console.log("Validation failed: Same role");
        return;
      }
      const messageId = await new Promise((resolve, reject) => {
        db.run(
          "INSERT INTO messages (sender_id, receiver_id, job_id, content) VALUES (?, ?, ?, ?)",
          [sender_id, receiver_id, job_id || null, content],
          function (err) {
            if (err) reject(err);
            resolve(this.lastID);
          }
        );
      });
      const message = {
        id: messageId,
        sender_id,
        receiver_id,
        job_id: job_id || null,
        content,
        created_at: new Date().toISOString(),
        is_read: false,
      };
      // Send to receiver's latest socket
      const receiverSocketId = userSockets.get(receiver_id);
      if (receiverSocketId && receiverSocketId !== socket.id) {
        console.log(`Emitting receive_message to receiver socket ${receiverSocketId} for message ID ${message.id}`);
        io.to(receiverSocketId).emit("receive_message", message);
      } else {
        console.log(`No active socket for receiver ${receiver_id} or sender socket detected`);
      }
      console.log(`Creating notification for receiver ${receiver_id}`);
      createNotification(
        receiver_id,
        "new_message",
        `New message from ${sender.name}`
      );
    } catch (err) {
      console.error("Error processing send_message:", err);
      socket.emit("error", { message: "Error saving message!" });
    }
  });

  socket.on("disconnect", () => {
    if (currentUserId && userSockets.get(currentUserId) === socket.id) {
      userSockets.delete(currentUserId);
      console.log(`Client disconnected: ${socket.id} (User ${currentUserId}). No active socket for user`);
    } else {
      console.log(`Client disconnected: ${socket.id} (User ${currentUserId || "unknown"})`);
    }
  });

  // Debug listener for unexpected receive_message events
  socket.on("receive_message", (message) => {
    console.warn(`Unexpected receive_message event received by socket ${socket.id} (User ${currentUserId || "unknown"}):`, message);
  });
});

// Notification creation function
function createNotification(user_id, type, message) {
  db.run(
    "INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)",
    [user_id, type, message],
    (err) => {
      if (err) {
        console.error("Error creating notification:", err);
        return;
      }
      io.to(user_id.toString()).emit("notification", {
        type,
        message,
        created_at: new Date().toISOString(),
        is_read: false
      });
    }
  );
}

// Create Users Table
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

// Create Jobs Table
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

// Create Bids Table
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

// Create Reviews Table
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

// Create Bookmarks Table
db.run(
  `CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    freelancer_id INTEGER,
    job_id INTEGER,
    FOREIGN KEY (freelancer_id) REFERENCES users(id),
    FOREIGN KEY (job_id) REFERENCES jobs(id),
    UNIQUE(freelancer_id, job_id)
  )`
);

// Create Custom Jobs Table
db.run(
  `CREATE TABLE IF NOT EXISTS custom_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    freelancer_id INTEGER,
    title TEXT,
    description TEXT,
    budget REAL,
    status TEXT DEFAULT 'Pending',
    FOREIGN KEY (client_id) REFERENCES users(id),
    FOREIGN KEY (freelancer_id) REFERENCES users(id)
  )`
);

// Create Notifications Table
db.run(
  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    is_read BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`
);

// Create Messages Table
db.run(
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    job_id INTEGER,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    is_read BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id),
    FOREIGN KEY (job_id) REFERENCES jobs(id)
  )`,
  (err) => {
    if (err) console.error("Error creating messages table:", err);
    else console.log("Messages table created or exists");
  }
);

// Create index for faster queries
db.run(
  "CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id)",
  (err) => {
    if (err) console.error("Error creating messages index:", err);
    else console.log("Messages index created or exists");
  }
);

// Verify messages table exists
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'", (err, row) => {
  if (err) {
    console.error("Error checking messages table:", err);
  } else if (!row) {
    console.error("Messages table does not exist! Check database initialization.");
  } else {
    console.log("Messages table verified");
  }
});

// Notification Endpoints
app.get("/notifications", (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ message: "User ID is required!" });
  }
  db.all(
    "SELECT id, type, message, created_at, is_read FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
    [user_id],
    (err, rows) => {
      if (err) {
        console.error("Error fetching notifications:", err);
        return res.status(500).json({ message: "Error fetching notifications!" });
      }
      res.json(rows || []);
    }
  );
});

app.post("/notifications/:id/read", (req, res) => {
  const { id } = req.params;
  db.run(
    "UPDATE notifications SET is_read = TRUE WHERE id = ?",
    [id],
    (err) => {
      if (err) {
        console.error("Error marking notification as read:", err);
        return res.status(500).json({ message: "Error marking notification as read!" });
      }
      res.json({ message: "Notification marked as read!" });
    }
  );
});

// Messaging Endpoints
app.post("/messages", (req, res) => {
  const { sender_id, receiver_id, job_id, content } = req.body;
  if (!sender_id || !receiver_id || !content) {
    return res.status(400).json({ message: "Sender ID, receiver ID, and content are required!" });
  }
  db.get("SELECT role FROM users WHERE id = ?", [sender_id], (err, sender) => {
    if (err || !sender) {
      return res.status(400).json({ message: "Invalid sender ID!" });
    }
    db.get("SELECT role FROM users WHERE id = ?", [receiver_id], (err, receiver) => {
      if (err || !receiver) {
        return res.status(400).json({ message: "Invalid receiver ID!" });
      }
      if (sender.role === receiver.role) {
        return res.status(400).json({ message: "Cannot message users of the same role!" });
      }
      db.run(
        "INSERT INTO messages (sender_id, receiver_id, job_id, content) VALUES (?, ?, ?, ?)",
        [sender_id, receiver_id, job_id || null, content],
        function (err) {
          if (err) {
            console.error("Error sending message:", err);
            return res.status(500).json({ message: "Error sending message!" });
          }
          const message = {
            id: this.lastID,
            sender_id,
            receiver_id,
            job_id: job_id || null,
            content,
            created_at: new Date().toISOString(),
            is_read: false,
          };
          const room = [sender_id, receiver_id].sort().join("_");
          io.to(room).emit("receive_message", message);
          db.get("SELECT name FROM users WHERE id = ?", [sender_id], (err, senderData) => {
            if (!err && senderData) {
              createNotification(
                receiver_id,
                "new_message",
                `New message from ${senderData.name}`
              );
            }
          });
          res.json({ message: "Message sent successfully!", message_id: this.lastID });
        }
      );
    });
  });
});

app.get("/messages", (req, res) => {
  const { user_id, other_user_id } = req.query;
  if (!user_id || !other_user_id) {
    return res.status(400).json({ message: "User ID and other user ID are required!" });
  }
  db.all(
    `SELECT id, sender_id, receiver_id, job_id, content, created_at, is_read
     FROM messages
     WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
     ORDER BY created_at ASC`,
    [user_id, other_user_id, other_user_id, user_id],
    (err, messages) => {
      if (err) {
        console.error("Error fetching messages:", err);
        return res.status(500).json({ message: "Error fetching messages!" });
      }
      res.json(messages || []);
    }
  );
});

app.post("/messages/:id/read", (req, res) => {
  const { id } = req.params;
  db.run(
    "UPDATE messages SET is_read = TRUE WHERE id = ?",
    [id],
    (err) => {
      if (err) {
        console.error("Error marking message as read:", err);
        return res.status(500).json({ message: "Error marking message as read!" });
      }
      res.json({ message: "Message marked as read!" });
    }
  );
});

// Fetch All Freelancers
app.get("/freelancers", (req, res) => {
  const { name } = req.query;
  let query = "SELECT id, name, email, skills FROM users WHERE role = 'freelancer'";
  let params = [];

  if (name) {
    query += " AND name LIKE ?";
    params.push(`%${name}%`);
  }

  db.all(query, params, (err, freelancers) => {
    if (err) {
      console.error("Error fetching freelancers:", err);
      return res.status(500).json({ message: "Error fetching freelancers!" });
    }
    res.json(freelancers || []);
  });
});

// Submit a Custom Job
app.post("/custom-jobs", (req, res) => {
  const { client_id, freelancer_id, title, description, budget } = req.body;

  if (!client_id || !freelancer_id || !title || !description || !budget) {
    return res.status(400).json({ message: "Missing required fields!" });
  }
  if (budget <= 0) {
    return res.status(400).json({ message: "Budget must be greater than 0!" });
  }

  db.get("SELECT role FROM users WHERE id = ?", [client_id], (err, client) => {
    if (err || !client) {
      return res.status(400).json({ message: "Invalid client ID!" });
    }
    if (client.role !== "client") {
      return res.status(403).json({ message: "Only clients can create custom jobs!" });
    }

    db.get("SELECT role FROM users WHERE id = ?", [freelancer_id], (err, freelancer) => {
      if (err || !freelancer) {
        return res.status(400).json({ message: "Invalid freelancer ID!" });
      }
      if (freelancer.role !== "freelancer") {
        return res.status(400).json({ message: "Selected user is not a freelancer!" });
      }

      db.run(
        "INSERT INTO custom_jobs (client_id, freelancer_id, title, description, budget, status) VALUES (?, ?, ?, ?, ?, 'Pending')",
        [client_id, freelancer_id, title, description, budget],
        function (err) {
          if (err) {
            console.error("Error submitting custom job:", err);
            return res.status(500).json({ message: "Error submitting custom job!" });
          }
          db.get("SELECT name FROM users WHERE id = ?", [client_id], (err, clientData) => {
            if (!err && clientData) {
              createNotification(
                freelancer_id,
                "custom_job_offer",
                `${clientData.name} has offered you a custom job: "${title}". Check it out!`
              );
            }
          });
          res.json({ message: "Custom job submitted successfully!", custom_job_id: this.lastID });
        }
      );
    });
  });
});

// Fetch Custom Jobs for a Freelancer
app.get("/custom-jobs", (req, res) => {
  const { freelancer_id } = req.query;

  if (!freelancer_id) {
    return res.status(400).json({ message: "Freelancer ID is required!" });
  }

  db.all(
    `SELECT cj.*, u.name AS clientName 
     FROM custom_jobs cj 
     JOIN users u ON cj.client_id = u.id 
     WHERE cj.freelancer_id = ? AND cj.status = 'Pending'`,
    [freelancer_id],
    (err, jobs) => {
      if (err) {
        console.error("Error fetching custom jobs:", err);
        return res.status(500).json({ message: "Error fetching custom jobs!" });
      }
      res.json(jobs || []);
    }
  );
});

// Approve a Custom Job
app.post("/custom-jobs/:id/approve", (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM custom_jobs WHERE id = ? AND status = 'Pending'", [id], (err, job) => {
    if (err) {
      console.error("Error checking custom job:", err);
      return res.status(500).json({ message: "Error checking custom job!" });
    }
    if (!job) {
      return res.status(404).json({ message: "Custom job not found or already processed!" });
    }

    db.run(
      "INSERT INTO jobs (title, description, budget, client_id, status) VALUES (?, ?, ?, ?, 'Closed')",
      [job.title, job.description, job.budget, job.client_id],
      function (err) {
        if (err) {
          console.error("Error creating job:", err);
          return res.status(500).json({ message: "Error creating job!" });
        }
        const jobId = this.lastID;

        db.get("SELECT name FROM users WHERE id = ?", [job.freelancer_id], (err, user) => {
          if (err || !user) {
            console.error("Error fetching freelancer name:", err);
            return res.status(500).json({ message: "Error fetching freelancer name!" });
          }

          db.run(
            "INSERT INTO bids (job_id, freelancer_id, freelancerName, bidAmount, proposal, status) VALUES (?, ?, ?, ?, ?, 'Approved')",
            [jobId, job.freelancer_id, user.name, job.budget, ""],
            function (err) {
              if (err) {
                console.error("Error creating bid:", err);
                return res.status(500).json({ message: "Error creating bid!" });
              }

              db.run(
                "UPDATE custom_jobs SET status = 'Approved' WHERE id = ?",
                [id],
                function (err) {
                  if (err) {
                    console.error("Error updating custom job:", err);
                    return res.status(500).json({ message: "Error updating custom job!" });
                  }
                  createNotification(
                    job.client_id,
                    "custom_job_approved",
                    `Great news! ${user.name} has approved your custom job "${job.title}".`
                  );
                  res.json({ message: "Custom job approved successfully!" });
                }
              );
            }
          );
        });
      }
    );
  });
});

// Decline a Custom Job
app.post("/custom-jobs/:id/decline", (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM custom_jobs WHERE id = ? AND status = 'Pending'", [id], (err, job) => {
    if (err) {
      console.error("Error checking custom job:", err);
      return res.status(500).json({ message: "Error checking custom job!" });
    }
    if (!job) {
      return res.status(404).json({ message: "Custom job not found or already processed!" });
    }

    db.run(
      "UPDATE custom_jobs SET status = 'Declined' WHERE id = ?",
      [id],
      function (err) {
        if (err) {
          console.error("Error declining custom job:", err);
          return res.status(500).json({ message: "Error declining custom job!" });
        }
        db.get("SELECT name FROM users WHERE id = ?", [job.freelancer_id], (err, freelancer) => {
          if (!err && freelancer) {
            createNotification(
              job.client_id,
              "custom_job_declined",
              `${freelancer.name} has declined your custom job "${job.title}".`
            );
          }
        });
        res.json({ message: "Custom job declined successfully!" });
      }
    );
  });
});

// Add or Remove Bookmark
app.post("/bookmarks", (req, res) => {
  const { freelancer_id, job_id } = req.body;
  if (!freelancer_id || !job_id) {
    return res.status(400).json({ message: "Freelancer ID and Job ID are required!" });
  }

  db.get(
    "SELECT * FROM bookmarks WHERE freelancer_id = ? AND job_id = ?",
    [freelancer_id, job_id],
    (err, bookmark) => {
      if (err) {
        console.error("Error checking bookmark:", err);
        return res.status(500).json({ message: "Error checking bookmark!" });
      }
      if (bookmark) {
        db.run(
          "DELETE FROM bookmarks WHERE freelancer_id = ? AND job_id = ?",
          [freelancer_id, job_id],
          (err) => {
            if (err) {
              console.error("Error removing bookmark:", err);
              return res.status(500).json({ message: "Error removing bookmark!" });
            }
            res.json({ message: "Bookmark removed successfully!" });
          }
        );
      } else {
        db.run(
          "INSERT INTO bookmarks (freelancer_id, job_id) VALUES (?, ?)",
          [freelancer_id, job_id],
          (err) => {
            if (err) {
              console.error("Error adding bookmark:", err);
              return res.status(500).json({ message: "Error adding bookmark!" });
            }
            res.json({ message: "Bookmark added successfully!" });
          }
        );
      }
    }
  );
});

// Fetch Bookmarked Jobs
app.get("/bookmarks", (req, res) => {
  const { freelancer_id } = req.query;
  if (!freelancer_id) {
    return res.status(400).json({ message: "Freelancer ID is required!" });
  }
  db.all(
    `SELECT j.* FROM jobs j
     JOIN bookmarks b ON j.id = b.job_id
     WHERE b.freelancer_id = ? AND j.status = 'Open'`,
    [freelancer_id],
    (err, jobs) => {
      if (err) {
        console.error("Error fetching bookmarked jobs:", err);
        return res.status(500).json({ message: "Error fetching bookmarked jobs!" });
      }
      res.json(jobs || []);
    }
  );
});

// Submit a Review
app.post("/reviews", (req, res) => {
  const { reviewer_id, reviewed_id, job_id, rating, comment } = req.body;
  if (!reviewer_id || !reviewed_id || !job_id || !rating) {
    return res.status(400).json({ message: "Missing required fields!" });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be between 1 and 5!" });
  }
  db.run(
    "INSERT INTO reviews (reviewer_id, reviewed_id, job_id, rating, comment) VALUES (?, ?, ?, ?, ?)",
    [reviewer_id, reviewed_id, job_id, rating, comment],
    function (err) {
      if (err) {
        console.error("Error submitting review:", err);
        return res.status(500).json({ message: "Error submitting review!" });
      }
      db.get("SELECT name FROM users WHERE id = ?", [reviewer_id], (err, reviewer) => {
        if (!err && reviewer) {
          db.get("SELECT title FROM jobs WHERE id = ?", [job_id], (err, job) => {
            if (!err && job) {
              createNotification(
                reviewed_id,
                "new_review",
                `${reviewer.name} left you a ${rating}-star review for "${job.title}".`
              );
            }
          });
        }
      });
      res.json({ message: "Review submitted successfully!" });
    }
  );
});

// Fetch Reviews Received by a User
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

// Fetch Reviews Given by a User
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

// Submit a Bid
app.post("/bids", (req, res) => {
  const { job_id, freelancer_id, bidAmount, proposal } = req.body;
  if (!bidAmount || bidAmount <= 0) {
    return res.status(400).json({ message: "Bid amount must be greater than 0!" });
  }
  db.get("SELECT name FROM users WHERE id = ?", [freelancer_id], (err, user) => {
    if (err || !user) {
      return res.status(400).json({ message: "Invalid freelancer ID!" });
    }
    db.get("SELECT client_id, title FROM jobs WHERE id = ?", [job_id], (err, job) => {
      if (err || !job) {
        return res.status(400).json({ message: "Invalid job ID!" });
      }
      db.run(
        "INSERT INTO bids (job_id, freelancer_id, freelancerName, bidAmount, proposal) VALUES (?, ?, ?, ?, ?)",
        [job_id, freelancer_id, user.name, bidAmount, proposal],
        function (err) {
          if (err) {
            console.error("Error submitting bid:", err);
            return res.status(400).json({ message: "Error submitting bid!" });
          }
          createNotification(
            job.client_id,
            "bid_submitted",
            `${user.name} submitted a bid of $${bidAmount} for your job "${job.title}".`
          );
          res.json({ message: "Bid submitted successfully!", bid_id: this.lastID });
        }
      );
    });
  });
});

// Fetch Completed Jobs (Supports History Page)
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
      console.error("Error fetching completed jobs:", err);
      return res.status(500).json({ message: "Error fetching completed jobs!" });
    }
    res.json(rows || []);
  });
});

// Fetch Job Details with Bids
app.get("/jobs/:id", (req, res) => {
  const jobId = req.params.id;
  db.get("SELECT id, title, description, budget FROM jobs WHERE id = ?", [jobId], (err, job) => {
    if (err) {
      console.error("Error retrieving job details:", err);
      return res.status(500).json({ message: "Error retrieving job details!" });
    }
    if (!job) {
      return res.status(404).json({ message: "Job not found!" });
    }
    db.all("SELECT * FROM bids WHERE job_id = ?", [jobId], (err, bids) => {
      if (err) {
        console.error("Error retrieving bids:", err);
        return res.status(500).json({ message: "Error retrieving bids!" });
      }
      res.json({ ...job, bids: bids || [] });
    });
  });
});

// Fetch Proposals for a Job
app.get("/proposals", (req, res) => {
  const { job_id } = req.query;
  if (!job_id) {
    return res.status(400).json({ message: "Job ID is required!" });
  }
  db.all("SELECT * FROM bids WHERE job_id = ?", [job_id], (err, rows) => {
    if (err) {
      console.error("Error fetching proposals:", err);
      return res.status(500).json({ message: "Error fetching proposals" });
    }
    res.json(rows || []);
  });
});

// Approve a Proposal and Close the Job
app.post("/approve-proposal/:id", (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM bids WHERE id = ?", [id], (err, proposal) => {
    if (err) {
      console.error("Error checking proposal:", err);
      return res.status(500).json({ message: "Error checking proposal existence!" });
    }
    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found!" });
    }
    db.get("SELECT title FROM jobs WHERE id = ?", [proposal.job_id], (err, job) => {
      if (err || !job) {
        return res.status(400).json({ message: "Invalid job ID!" });
      }
      db.run("UPDATE bids SET status = 'Approved' WHERE id = ?", [id], function (err) {
        if (err) {
          console.error("Error approving proposal:", err);
          return res.status(500).json({ message: "Error approving proposal!" });
        }
        db.run("UPDATE jobs SET status = 'Closed' WHERE id = ?", [proposal.job_id], function (err) {
          if (err) {
            console.error("Error closing job:", err);
            return res.status(500).json({ message: "Error closing job!" });
        }
          createNotification(
            proposal.freelancer_id,
            "bid_approved",
            `Congratulations! Your bid for "${job.title}" has been approved.`
          );
          res.json({ message: "Proposal approved and job closed!" });
        });
      });
    });
  });
});

// Fetch Ongoing Jobs
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
      console.error("Error fetching ongoing jobs:", err);
      return res.status(500).json({ message: "Error fetching ongoing jobs!" });
    }
    res.json(rows || []);
  });
});

// Mark Job as Completed
app.post("/complete-job/:job_id", (req, res) => {
  const { job_id } = req.params;
  db.get("SELECT client_id, title FROM jobs WHERE id = ?", [job_id], (err, job) => {
    if (err || !job) {
      return res.status(400).json({ message: "Invalid job ID!" });
    }
    db.get("SELECT freelancer_id, freelancerName FROM bids WHERE job_id = ? AND status = 'Approved'", [job_id], (err, bid) => {
      if (err || !bid) {
        return res.status(400).json({ message: "No approved bid found for this job!" });
      }
      db.run(
        "UPDATE bids SET status = 'Completed' WHERE job_id = ? AND status = 'Approved'",
        [job_id],
        function (err) {
          if (err) {
            console.error("Error marking job as completed:", err);
            return res.status(500).json({ message: "Error marking job as completed!" });
          }
          db.run("UPDATE jobs SET status = 'Completed' WHERE id = ?", [job_id], function (err) {
            if (err) {
              console.error("Error updating job status:", err);
              return res.status(500).json({ message: "Error updating job status!" });
            }
            createNotification(
              job.client_id,
              "job_completed",
              `"${job.title}" has been completed by ${bid.freelancerName}. Please review their work!`
            );
            createNotification(
              bid.freelancer_id,
              "job_completed",
              `Well done! You've completed "${job.title}".`
            );
            res.json({ message: "Job marked as completed!" });
          });
        }
      );
    });
  });
});

// Signup Route
app.post("/signup", (req, res) => {
  const { name, email, password, role } = req.body;
  if (!role || (role !== "freelancer" && role !== "client")) {
    return res.status(400).json({ message: "Invalid role selected!" });
  }
  if (!email || !/[^@]+@[^.]+\..+/.test(email)) {
    return res.status(400).json({ message: "Invalid email format!" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters!" });
  }
  const saltRounds = 12;
  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      console.error("Error hashing password:", err);
      return res.status(500).json({ message: "Error processing signup!" });
    }
    db.run(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hash, role],
      function (err) {
        if (err) {
          console.error("Error during signup:", err);
          return res.status(400).json({ message: "Email already exists!" });
        }
        res.json({ message: "Signup successful!" });
      }
    );
  });
});

// Login Route
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.get(
    "SELECT id, name, email, role, password FROM users WHERE email = ?",
    [email],
    (err, user) => {
      if (err) {
        console.error("Error during login:", err);
        return res.status(500).json({ message: "Error during login!" });
      }
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password!" });
      }
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          console.error("Error comparing passwords:", err);
          return res.status(500).json({ message: "Error during login!" });
        }
        if (!isMatch) {
          return res.status(401).json({ message: "Invalid email or password!" });
        }
        res.json({ message: "Login successful!", user: { id: user.id, name: user.name, email: user.email, role: user.role } });
      });
    }
  );
});

// Get User Profile
app.get("/user/profile", (req, res) => {
  const { user_id } = req.query;

  db.get(
    `SELECT id, name, email, role, skills, companyName FROM users WHERE id = ?`,
    [user_id],
    (err, user) => {
      if (err) {
        console.error("Error fetching user profile:", err);
        return res.status(500).json({ message: "Error fetching user profile!" });
      }
      if (!user) {
        return res.status(404).json({ message: "User not found!" });
      }

      if (user.role === "freelancer") {
        db.get(
          `
          SELECT 
            (SELECT COUNT(*) FROM bids b JOIN jobs j ON b.job_id = j.id 
             WHERE b.freelancer_id = ? AND b.status = 'Completed' AND j.status = 'Completed') AS completedJobs,
            (SELECT COUNT(*) FROM bids b JOIN jobs j ON b.job_id = j.id 
             WHERE b.freelancer_id = ? AND b.status = 'Approved') AS ongoingJobs,
            (SELECT AVG(r.rating) FROM reviews r WHERE r.reviewed_id = ?) AS averageRating,
            (SELECT SUM(b.bidAmount) FROM bids b JOIN jobs j ON b.job_id = j.id 
             WHERE b.freelancer_id = ? AND b.status = 'Completed' AND j.status = 'Completed') AS totalEarnings
          `,
          [user_id, user_id, user_id, user_id],
          (err, stats) => {
            if (err) {
              console.error("Error fetching freelancer stats:", err);
              return res.status(500).json({ message: "Error fetching freelancer stats!" });
            }
            res.json({
              ...user,
              completedJobs: stats.completedJobs || 0,
              ongoingJobs: stats.ongoingJobs || 0,
              averageRating: stats.averageRating ? parseFloat(stats.averageRating).toFixed(1) : "No ratings",
              totalEarnings: stats.totalEarnings || 0,
            });
          }
        );
      } else {
        res.json(user);
      }
    }
  );
});

// Update User Profile
app.put("/user/profile", (req, res) => {
  const { user_id, skills, companyName } = req.body;
  db.run(
    "UPDATE users SET skills = COALESCE(?, skills), companyName = COALESCE(?, companyName) WHERE id = ?",
    [skills, companyName, user_id],
    function (err) {
      if (err) {
        console.error("Error updating profile:", err);
        return res.status(500).json({ message: "Error updating profile!" });
      }
      res.json({ message: "Profile updated successfully!" });
    }
  );
});

// Update Email
app.put("/user/update-email", (req, res) => {
  const { user_id, email } = req.body;

  if (!user_id || !email) {
    return res.status(400).json({ message: "User ID and email are required!" });
  }
  if (!/[^@]+@[^.]+\..+/.test(email)) {
    return res.status(400).json({ message: "Invalid email format!" });
  }

  db.run(
    "UPDATE users SET email = ? WHERE id = ?",
    [email, user_id],
    function (err) {
      if (err) {
        console.error("Error updating email:", err);
        return res.status(500).json({ message: "Error updating email! Email may already exist." });
      }
      res.json({ message: "Email updated successfully!" });
    }
  );
});

// Update Password
app.put("/user/update-password", (req, res) => {
  const { user_id, password } = req.body;

  if (!user_id || !password) {
    return res.status(400).json({ message: "User ID and password are required!" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters!" });
  }

  const saltRounds = 12;
  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      console.error("Error hashing password:", err);
      return res.status(500).json({ message: "Error updating password!" });
    }
    db.run(
      "UPDATE users SET password = ? WHERE id = ?",
      [hash, user_id],
      function (err) {
        if (err) {
          console.error("Error updating password:", err);
          return res.status(500).json({ message: "Error updating password!" });
        }
        res.json({ message: "Password updated successfully!" });
      }
    );
  });
});

// Fetch Jobs Posted by a Specific Client
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
        console.error("Error fetching client jobs:", err);
        return res.status(500).json({ message: "Error fetching client jobs!" });
      }
      res.json(jobs || []);
    }
  );
});

// Job Posting Route (Clients Only)
app.post("/jobs", (req, res) => {
  const { title, description, budget, client_id } = req.body;
  if (!budget || budget <= 0) {
    return res.status(400).json({ message: "Budget must be greater than 0!" });
  }
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
          console.error("Error posting job:", err);
          return res.status(400).json({ message: "Error posting job!" });
        }
        db.all("SELECT id FROM users WHERE role = 'freelancer'", [], (err, freelancers) => {
          if (!err) {
            freelancers.forEach((freelancer) => {
              createNotification(
                freelancer.id,
                "new_job",
                `A new job opportunity "${title}" is available. Apply now!`
              );
            });
          }
        });
        res.json({ message: "Job posted successfully!", job_id: this.lastID });
      }
    );
  });
});

// Fetch Available Jobs
app.get("/jobs", (req, res) => {
  db.all("SELECT * FROM jobs WHERE status = 'Open'", [], (err, jobs) => {
    if (err) {
      console.error("Error fetching jobs:", err);
      return res.status(500).json({ message: "Error fetching jobs!" });
    }
    res.json(jobs || []);
  });
});

// Start Server
server.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});

module.exports = app;
