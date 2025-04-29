const request = require('supertest');
const app = require('../server'); // Correct path to server.js
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

// Mock the SQLite database
jest.mock('sqlite3', () => {
  const mDb = {
    run: jest.fn((query, params, callback) => callback && callback(null)),
    get: jest.fn((query, params, callback) => callback(null, null)),
    all: jest.fn((query, params, callback) => callback(null, [])),
    close: jest.fn((callback) => callback && callback(null)),
  };
  return { verbose: () => ({ Database: jest.fn(() => mDb) }) };
});

// Mock Socket.IO
jest.mock('socket.io', () => {
  const mSocket = { on: jest.fn(), join: jest.fn(), emit: jest.fn(), disconnect: jest.fn() };
  const mIo = {
    on: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
    close: jest.fn((cb) => cb && cb()),
  };
  return { Server: jest.fn(() => mIo) };
});

describe('Server API Endpoints', () => {
  let db;
  let server;
  let io;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeAll((done) => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    db = new sqlite3.Database('./database.db');
    server = http.createServer(app).listen(0, () => {
      io = new SocketIOServer(server);
      done();
    });
  });

  afterAll((done) => {
    io.close(() => {
      db.close((err) => {
        if (err) console.error('Error closing database:', err);
        server.close(() => {
          server.unref();
          consoleLogSpy.mockRestore();
          consoleErrorSpy.mockRestore();
          setTimeout(done, 1000); // Increased timeout for async cleanup
        });
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test Signup Endpoint
  describe('POST /signup', () => {
    it('should successfully sign up a new user', async () => {
      db.run.mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app)
        .post('/signup')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123', role: 'freelancer' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Signup successful!');
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .post('/signup')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123', role: 'invalid' });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid role selected!');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/signup')
        .send({ name: 'Test User', email: 'invalid', password: 'password123', role: 'freelancer' });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid email format!');
    });

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/signup')
        .send({ name: 'Test User', email: 'test@example.com', password: '123', role: 'freelancer' });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Password must be at least 6 characters!');
    });

    it('should handle duplicate email', async () => {
      db.run.mockImplementationOnce((query, params, callback) => callback(new Error('SQLITE_CONSTRAINT')));
      const response = await request(app)
        .post('/signup')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123', role: 'freelancer' });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email already exists!');
    });
  });

  // Test Login Endpoint
  describe('POST /login', () => {
    it('should log in a user with correct credentials', async () => {
      db.get.mockImplementationOnce((query, params, callback) =>
        callback(null, { id: 1, name: 'Test User', email: 'test@example.com', role: 'freelancer' })
      );
      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful!');
      expect(response.body.user).toHaveProperty('id', 1);
    });

    it('should reject invalid credentials', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, null));
      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid email or password!');
    });
  });

  // Test Job Posting Endpoint
  describe('POST /jobs', () => {
    it('should allow a client to post a job', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, { role: 'client' }));
      db.run.mockImplementationOnce((query, params, callback) => callback(null));
      db.all.mockImplementationOnce((query, params, callback) => callback(null, [{ id: 1 }]));
      const response = await request(app)
        .post('/jobs')
        .send({ title: 'Test Job', description: 'Test Description', budget: 100, client_id: 1 });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Job posted successfully!');
    });

    it('should reject non-client job posting', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, { role: 'freelancer' }));
      const response = await request(app)
        .post('/jobs')
        .send({ title: 'Test Job', description: 'Test Description', budget: 100, client_id: 1 });
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only clients can post jobs!');
    });

    it('should reject invalid budget', async () => {
      const response = await request(app)
        .post('/jobs')
        .send({ title: 'Test Job', description: 'Test Description', budget: 0, client_id: 1 });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Budget must be greater than 0!');
    });

    it('should handle database error', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, { role: 'client' }));
      db.run.mockImplementationOnce((query, params, callback) => callback(new Error('DB Error')));
      const response = await request(app)
        .post('/jobs')
        .send({ title: 'Test Job', description: 'Test Description', budget: 100, client_id: 1 });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Error posting job!');
    });
  });

  // Test Fetch Available Jobs Endpoint
  describe('GET /jobs', () => {
    it('should fetch available jobs', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [{ id: 1, title: 'Test Job', description: 'Test', budget: 100, status: 'Open' }])
      );
      const response = await request(app).get('/jobs');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { id: 1, title: 'Test Job', description: 'Test', budget: 100, status: 'Open' },
      ]);
    });

    it('should handle database error', async () => {
      db.all.mockImplementationOnce((query, params, callback) => callback(new Error('DB Error')));
      const response = await request(app).get('/jobs');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Error fetching jobs!');
    });
  });

  // Test Fetch Freelancers Endpoint
  describe('GET /freelancers', () => {
    it('should fetch all freelancers', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [{ id: 1, name: 'Freelancer', email: 'free@example.com', skills: 'JS' }])
      );
      const response = await request(app).get('/freelancers');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([{ id: 1, name: 'Freelancer', email: 'free@example.com', skills: 'JS' }]);
    });

    it('should filter freelancers by name', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [{ id: 1, name: 'Test', email: 'test@example.com', skills: 'JS' }])
      );
      const response = await request(app).get('/freelancers?name=Test');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([{ id: 1, name: 'Test', email: 'test@example.com', skills: 'JS' }]);
    });
  });

  // Test Submit a Custom Job Endpoint
  describe('POST /custom-jobs', () => {
    it('should submit a custom job', async () => {
      db.get
        .mockImplementationOnce((query, params, callback) => callback(null, { role: 'client' }))
        .mockImplementationOnce((query, params, callback) => callback(null, { role: 'freelancer' }))
        .mockImplementationOnce((query, params, callback) => callback(null, { name: 'Client' }));
      db.run.mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app)
        .post('/custom-jobs')
        .send({ client_id: 1, freelancer_id: 2, title: 'Custom Job', description: 'Test', budget: 200 });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Custom job submitted successfully!');
    });

    it('should reject invalid client ID', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, null));
      const response = await request(app)
        .post('/custom-jobs')
        .send({ client_id: 1, freelancer_id: 2, title: 'Custom Job', description: 'Test', budget: 200 });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid client ID!');
    });

    it('should reject missing fields', async () => {
      const response = await request(app)
        .post('/custom-jobs')
        .send({ client_id: 1, freelancer_id: 2, title: 'Custom Job' });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Missing required fields!');
    });
  });

  // Test Fetch Custom Jobs Endpoint
  describe('GET /custom-jobs', () => {
    it('should fetch custom jobs for a freelancer', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [
          {
            id: 1,
            client_id: 1,
            freelancer_id: 2,
            title: 'Custom Job',
            description: 'Test',
            budget: 200,
            status: 'Pending',
            clientName: 'Client',
          },
        ])
      );
      const response = await request(app).get('/custom-jobs?freelancer_id=2');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          client_id: 1,
          freelancer_id: 2,
          title: 'Custom Job',
          description: 'Test',
          budget: 200,
          status: 'Pending',
          clientName: 'Client',
        },
      ]);
    });

    it('should reject missing freelancer_id', async () => {
      const response = await request(app).get('/custom-jobs');
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Freelancer ID is required!');
    });

    it('should handle database error', async () => {
      db.all.mockImplementationOnce((query, params, callback) => callback(new Error('DB Error')));
      const response = await request(app).get('/custom-jobs?freelancer_id=2');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Error fetching custom jobs!');
    });
  });

  // Test Approve Custom Job Endpoint
  describe('POST /custom-jobs/:id/approve', () => {
    it('should approve a custom job', async () => {
      db.get
        .mockImplementationOnce((query, params, callback) =>
          callback(null, {
            id: 1,
            title: 'Custom Job',
            description: 'Test',
            budget: 200,
            client_id: 1,
            freelancer_id: 2,
            status: 'Pending',
          })
        )
        .mockImplementationOnce((query, params, callback) => callback(null, { name: 'Freelancer' }));
      db.run
        .mockImplementationOnce((query, params, callback) => callback(null))
        .mockImplementationOnce((query, params, callback) => callback(null))
        .mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app).post('/custom-jobs/1/approve');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Custom job approved successfully!');
    });

    it('should return 404 for non-existent or processed job', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, null));
      const response = await request(app).post('/custom-jobs/999/approve');
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Custom job not found or already processed!');
    });
  });

  // Test Decline Custom Job Endpoint
  describe('POST /custom-jobs/:id/decline', () => {
    it('should decline a custom job', async () => {
      db.get
        .mockImplementationOnce((query, params, callback) =>
          callback(null, { id: 1, title: 'Custom Job', client_id: 1, freelancer_id: 2, status: 'Pending' })
        )
        .mockImplementationOnce((query, params, callback) => callback(null, { name: 'Freelancer' }));
      db.run.mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app).post('/custom-jobs/1/decline');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Custom job declined successfully!');
    });

    it('should return 404 for non-existent or processed job', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, null));
      const response = await request(app).post('/custom-jobs/999/decline');
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Custom job not found or already processed!');
    });
  });

  // Test Bookmark Endpoint
  describe('POST /bookmarks', () => {
    it('should add a bookmark', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, null));
      db.run.mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app)
        .post('/bookmarks')
        .send({ freelancer_id: 1, job_id: 1 });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Bookmark added successfully!');
    });

    it('should remove an existing bookmark', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, { id: 1 }));
      db.run.mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app)
        .post('/bookmarks')
        .send({ freelancer_id: 1, job_id: 1 });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Bookmark removed successfully!');
    });

    it('should reject missing freelancer_id or job_id', async () => {
      const response = await request(app)
        .post('/bookmarks')
        .send({ freelancer_id: 1 });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Freelancer ID and Job ID are required!');
    });
  });

  // Test Fetch Bookmarks Endpoint
  describe('GET /bookmarks', () => {
    it('should fetch bookmarks for a freelancer', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [
          {
            id: 1,
            title: 'Test Job',
            description: 'Test',
            budget: 100,
            client_id: 1,
            status: 'Open',
          },
        ])
      );
      const response = await request(app).get('/bookmarks?freelancer_id=1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          title: 'Test Job',
          description: 'Test',
          budget: 100,
          client_id: 1,
          status: 'Open',
        },
      ]);
    });

    it('should handle database error', async () => {
      db.all.mockImplementationOnce((query, params, callback) => callback(new Error('DB Error')));
      const response = await request(app).get('/bookmarks?freelancer_id=1');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Error fetching bookmarked jobs!');
    });

    it('should reject missing freelancer_id', async () => {
      const response = await request(app).get('/bookmarks');
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Freelancer ID is required!');
    });
  });

  // Test Fetch Job Details Endpoint
  describe('GET /jobs/:id', () => {
    it('should fetch job details with bids', async () => {
      db.get.mockImplementationOnce((query, params, callback) =>
        callback(null, { id: 1, title: 'Test Job', description: 'Test', budget: 100 })
      );
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [
          {
            id: 1,
            job_id: 1,
            freelancer_id: 2,
            freelancerName: 'Freelancer',
            bidAmount: 90,
            proposal: 'I can do this!',
            status: 'Pending',
          },
        ])
      );
      const response = await request(app).get('/jobs/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        title: 'Test Job',
        description: 'Test',
        budget: 100,
        bids: [
          {
            id: 1,
            job_id: 1,
            freelancer_id: 2,
            freelancerName: 'Freelancer',
            bidAmount: 90,
            proposal: 'I can do this!',
            status: 'Pending',
          },
        ],
      });
    });

    it('should return 404 for non-existent job', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, null));
      const response = await request(app).get('/jobs/999');
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Job not found!');
    });
  });

  // Test Submit Review Endpoint
  describe('POST /reviews', () => {
    it('should submit a review', async () => {
      db.get
        .mockImplementationOnce((query, params, callback) => callback(null, { name: 'Reviewer' }))
        .mockImplementationOnce((query, params, callback) => callback(null, { title: 'Test Job' }));
      db.run.mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app)
        .post('/reviews')
        .send({ reviewer_id: 1, reviewed_id: 2, job_id: 1, rating: 5, comment: 'Great work!' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Review submitted successfully!');
    });

    it('should reject invalid rating', async () => {
      const response = await request(app)
        .post('/reviews')
        .send({ reviewer_id: 1, reviewed_id: 2, job_id: 1, rating: 6, comment: 'Invalid' });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Rating must be between 1 and 5!');
    });

    it('should reject missing fields', async () => {
      const response = await request(app)
        .post('/reviews')
        .send({ reviewer_id: 1, reviewed_id: 2, rating: 5 });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Missing required fields!');
    });
  });

  // Test Fetch Reviews Endpoint
  describe('GET /reviews/:user_id', () => {
    it('should fetch reviews for a user', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [
          {
            id: 1,
            rating: 5,
            comment: 'Great work!',
            reviewerName: 'Reviewer',
            jobTitle: 'Test Job',
            jobDescription: 'Test',
            jobAmount: 100,
          },
        ])
      );
      const response = await request(app).get('/reviews/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          rating: 5,
          comment: 'Great work!',
          reviewerName: 'Reviewer',
          jobTitle: 'Test Job',
          jobDescription: 'Test',
          jobAmount: 100,
        },
      ]);
    });

    it('should handle database error', async () => {
      db.all.mockImplementationOnce((query, params, callback) => callback(new Error('DB Error')));
      const response = await request(app).get('/reviews/1');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Error fetching reviews!');
    });
  });

  // Test Fetch Reviews Given Endpoint
  describe('GET /reviews-given/:user_id', () => {
    it('should fetch reviews given by a user', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [
          {
            id: 1,
            rating: 5,
            comment: 'Great work!',
            job_id: 1,
            reviewed_id: 2,
            reviewedName: 'Freelancer',
          },
        ])
      );
      const response = await request(app).get('/reviews-given/1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          rating: 5,
          comment: 'Great work!',
          job_id: 1,
          reviewed_id: 2,
          reviewedName: 'Freelancer',
        },
      ]);
    });

    it('should handle database error', async () => {
      db.all.mockImplementationOnce((query, params, callback) => callback(new Error('DB Error')));
      const response = await request(app).get('/reviews-given/1');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Error fetching reviews given!');
    });
  });

  // Test Fetch Completed Jobs Endpoint
  describe('GET /completed-jobs', () => {
    it('should fetch completed jobs for a freelancer', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [
          {
            id: 1,
            title: 'Test Job',
            description: 'Test',
            budget: 100,
            client_id: 1,
            clientName: 'Client',
            freelancer_id: 2,
            freelancerName: 'Freelancer',
            bidAmount: 90,
          },
        ])
      );
      const response = await request(app).get('/completed-jobs?freelancer_id=2');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          title: 'Test Job',
          description: 'Test',
          budget: 100,
          client_id: 1,
          clientName: 'Client',
          freelancer_id: 2,
          freelancerName: 'Freelancer',
          bidAmount: 90,
        },
      ]);
    });

    it('should fetch completed jobs for a client', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [
          {
            id: 1,
            title: 'Test Job',
            description: 'Test',
            budget: 100,
            client_id: 1,
            clientName: 'Client',
            freelancer_id: 2,
            freelancerName: 'Freelancer',
            bidAmount: 90,
          },
        ])
      );
      const response = await request(app).get('/completed-jobs?client_id=1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          title: 'Test Job',
          description: 'Test',
          budget: 100,
          client_id: 1,
          clientName: 'Client',
          freelancer_id: 2,
          freelancerName: 'Freelancer',
          bidAmount: 90,
        },
      ]);
    });
  });

  // Test Fetch Ongoing Jobs Endpoint
  describe('GET /ongoing-jobs', () => {
    it('should fetch ongoing jobs for a freelancer', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [
          {
            id: 1,
            title: 'Test Job',
            description: 'Test',
            budget: 100,
            freelancer_id: 2,
            freelancerName: 'Freelancer',
            bidAmount: 90,
            status: 'Approved',
          },
        ])
      );
      const response = await request(app).get('/ongoing-jobs?freelancer_id=2');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          title: 'Test Job',
          description: 'Test',
          budget: 100,
          freelancer_id: 2,
          freelancerName: 'Freelancer',
          bidAmount: 90,
          status: 'Approved',
        },
      ]);
    });

    it('should fetch ongoing jobs for a client', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [
          {
            id: 1,
            title: 'Test Job',
            description: 'Test',
            budget: 100,
            freelancer_id: 2,
            freelancerName: 'Freelancer',
            bidAmount: 90,
            status: 'Approved',
          },
        ])
      );
      const response = await request(app).get('/ongoing-jobs?client_id=1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          title: 'Test Job',
          description: 'Test',
          budget: 100,
          freelancer_id: 2,
          freelancerName: 'Freelancer',
          bidAmount: 90,
          status: 'Approved',
        },
      ]);
    });
  });

  // Test Fetch Client Jobs Endpoint
  describe('GET /client-jobs', () => {
    it('should fetch jobs posted by a client', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [
          {
            id: 1,
            title: 'Test Job',
            description: 'Test',
            budget: 100,
            client_id: 1,
            status: 'Open',
          },
        ])
      );
      const response = await request(app).get('/client-jobs?client_id=1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          title: 'Test Job',
          description: 'Test',
          budget: 100,
          client_id: 1,
          status: 'Open',
        },
      ]);
    });

    it('should reject missing client_id', async () => {
      const response = await request(app).get('/client-jobs');
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Client ID is required!');
    });
  });

  // Test Submit Bid Endpoint
  describe('POST /bids', () => {
    it('should submit a bid', async () => {
      db.get
        .mockImplementationOnce((query, params, callback) => callback(null, { name: 'Freelancer' }))
        .mockImplementationOnce((query, params, callback) => callback(null, { client_id: 1, title: 'Test Job' }));
      db.run.mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app)
        .post('/bids')
        .send({ job_id: 1, freelancer_id: 2, bidAmount: 90, proposal: 'I can do this!' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Bid submitted successfully!');
    });

    it('should reject invalid bid amount', async () => {
      const response = await request(app)
        .post('/bids')
        .send({ job_id: 1, freelancer_id: 2, bidAmount: 0, proposal: 'I can do this!' });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Bid amount must be greater than 0!');
    });

    it('should reject invalid freelancer ID', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, null));
      const response = await request(app)
        .post('/bids')
        .send({ job_id: 1, freelancer_id: 2, bidAmount: 90, proposal: 'I can do this!' });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid freelancer ID!');
    });
  });

  // Test Fetch Notifications Endpoint
  describe('GET /notifications', () => {
    it('should fetch notifications for a user', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [{ id: 1, type: 'test', message: 'Test message', created_at: '2023-10-01', is_read: false }])
      );
      const response = await request(app).get('/notifications?user_id=1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { id: 1, type: 'test', message: 'Test message', created_at: '2023-10-01', is_read: false },
      ]);
    });

    it('should reject missing user_id', async () => {
      const response = await request(app).get('/notifications');
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User ID is required!');
    });
  });

  // Test Mark Notification as Read Endpoint
  describe('POST /notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      db.run.mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app).post('/notifications/1/read');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Notification marked as read!');
    });

    it('should handle database error', async () => {
      db.run.mockImplementationOnce((query, params, callback) => callback(new Error('DB Error')));
      const response = await request(app).post('/notifications/1/read');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Error marking notification as read!');
    });
  });

  // Test Approve Proposal Endpoint
  describe('POST /approve-proposal/:id', () => {
    it('should approve a proposal and close the job', async () => {
      db.get
        .mockImplementationOnce((query, params, callback) =>
          callback(null, { id: 1, job_id: 1, freelancer_id: 2 })
        )
        .mockImplementationOnce((query, params, callback) => callback(null, { title: 'Test Job' }));
      db.run
        .mockImplementationOnce((query, params, callback) => callback(null))
        .mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app).post('/approve-proposal/1');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Proposal approved and job closed!');
    });

    it('should return 404 for non-existent proposal', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, null));
      const response = await request(app).post('/approve-proposal/999');
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Proposal not found!');
    });
  });

  // Test Complete Job Endpoint
  describe('POST /complete-job/:job_id', () => {
    it('should mark a job as completed', async () => {
      db.get
        .mockImplementationOnce((query, params, callback) => callback(null, { client_id: 1, title: 'Test Job' }))
        .mockImplementationOnce((query, params, callback) =>
          callback(null, { freelancer_id: 2, freelancerName: 'Freelancer' })
        );
      db.run
        .mockImplementationOnce((query, params, callback) => callback(null))
        .mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app).post('/complete-job/1');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Job marked as completed!');
    });

    it('should reject invalid job ID', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(null, null));
      const response = await request(app).post('/complete-job/999');
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid job ID!');
    });
  });

  // Test User Profile Endpoint
  describe('GET /user/profile', () => {
    it('should fetch client profile', async () => {
      db.get.mockImplementationOnce((query, params, callback) =>
        callback(null, { id: 1, name: 'Client', email: 'client@example.com', role: 'client', skills: null, companyName: 'Test Co' })
      );
      const response = await request(app).get('/user/profile?user_id=1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        name: 'Client',
        email: 'client@example.com',
        role: 'client',
        skills: null,
        companyName: 'Test Co',
      });
    });

    it('should fetch freelancer profile with stats', async () => {
      db.get
        .mockImplementationOnce((query, params, callback) =>
          callback(null, { id: 1, name: 'Freelancer', email: 'free@example.com', role: 'freelancer', skills: 'JS', companyName: null })
        )
        .mockImplementationOnce((query, params, callback) =>
          callback(null, { completedJobs: 5, ongoingJobs: 2, averageRating: 4.5, totalEarnings: 1000 })
        );
      const response = await request(app).get('/user/profile?user_id=1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        name: 'Freelancer',
        email: 'free@example.com',
        role: 'freelancer',
        skills: 'JS',
        companyName: null,
        completedJobs: 5,
        ongoingJobs: 2,
        averageRating: '4.5',
        totalEarnings: 1000,
      });
    });

    it('should return 404 for missing user_id', async () => {
      const response = await request(app).get('/user/profile');
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found!');
    });

    it('should handle database error', async () => {
      db.get.mockImplementationOnce((query, params, callback) => callback(new Error('DB Error')));
      const response = await request(app).get('/user/profile?user_id=1');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Error fetching user profile!');
    });
  });

  // Test Update Profile Endpoint
  describe('PUT /user/profile', () => {
    it('should update user profile', async () => {
      db.run.mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app)
        .put('/user/profile')
        .send({ user_id: 1, skills: 'JS, Python', companyName: 'Test Co' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Profile updated successfully!');
    });

    it('should handle database error', async () => {
      db.run.mockImplementationOnce((query, params, callback) => callback(new Error('DB Error')));
      const response = await request(app)
        .put('/user/profile')
        .send({ user_id: 1, skills: 'JS, Python', companyName: 'Test Co' });
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Error updating profile!');
    });
  });

  // Test Update Email Endpoint
  describe('PUT /user/update-email', () => {
    it('should update user email', async () => {
      db.run.mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app)
        .put('/user/update-email')
        .send({ user_id: 1, email: 'new@example.com' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Email updated successfully!');
    });

    it('should reject missing user_id or email', async () => {
      const response = await request(app)
        .put('/user/update-email')
        .send({ user_id: 1 });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User ID and email are required!');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .put('/user/update-email')
        .send({ user_id: 1, email: 'invalid' });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid email format!');
    });

    it('should handle database error', async () => {
      db.run.mockImplementationOnce((query, params, callback) => callback(new Error('DB Error')));
      const response = await request(app)
        .put('/user/update-email')
        .send({ user_id: 1, email: 'new@example.com' });
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Error updating email! Email may already exist.');
    });
  });

  // Test Update Password Endpoint
  describe('PUT /user/update-password', () => {
    it('should update user password', async () => {
      db.run.mockImplementationOnce((query, params, callback) => callback(null));
      const response = await request(app)
        .put('/user/update-password')
        .send({ user_id: 1, password: 'newpassword123' });
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password updated successfully!');
    });

    it('should reject missing user_id or password', async () => {
      const response = await request(app)
        .put('/user/update-password')
        .send({ user_id: 1 });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User ID and password are required!');
    });

    it('should reject short password', async () => {
      const response = await request(app)
        .put('/user/update-password')
        .send({ user_id: 1, password: 'short' });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Password must be at least 6 characters!');
    });

    it('should handle database error', async () => {
      db.run.mockImplementationOnce((query, params, callback) => callback(new Error('DB Error')));
      const response = await request(app)
        .put('/user/update-password')
        .send({ user_id: 1, password: 'newpassword123' });
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Error updating password!');
    });
  });

  // Test Fetch Proposals Endpoint
  describe('GET /proposals', () => {
    it('should fetch proposals for a job', async () => {
      db.all.mockImplementationOnce((query, params, callback) =>
        callback(null, [
          {
            id: 1,
            job_id: 1,
            freelancer_id: 2,
            freelancerName: 'Freelancer',
            bidAmount: 90,
            proposal: 'I can do this!',
            status: 'Pending',
          },
        ])
      );
      const response = await request(app).get('/proposals?job_id=1');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: 1,
          job_id: 1,
          freelancer_id: 2,
          freelancerName: 'Freelancer',
          bidAmount: 90,
          proposal: 'I can do this!',
          status: 'Pending',
        },
      ]);
    });

    it('should reject missing job_id', async () => {
      const response = await request(app).get('/proposals');
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Job ID is required!');
    });

    it('should handle database error', async () => {
      db.all.mockImplementationOnce((query, params, callback) => callback(new Error('DB Error')));
      const response = await request(app).get('/proposals?job_id=1');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Error fetching proposals');
    });
  });
});