const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Task management is running");
});

// middleware
const logger = (req, res, next) => {
  console.log(req.method, req.url);
  next();
};
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  // console.log('token in the middleware' , token)
  // no token available
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};
const uri = `mongodb+srv://${process.env.VITE_DB_USER}:${process.env.VITE_DB_PASS}@cluster0.04lxrta.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  const taskCollection = client.db("taskDb").collection("tasks");
  const listCollection = client.db("taskDb").collection("lists");
  try {
    // jwt token
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out ", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    app.post("/tasks", async (req, res) => {
      const tasks = req.body;
      console.log(tasks);
      const result = await taskCollection.insertOne(tasks);
      res.send(result);
    });

    app.get("/tasks", async (req, res) => {
      const result = await taskCollection.find().toArray();
      res.send(result);
    });

    app.get("/tasks/:email", async (req, res) => {
      const email = req.params.email;
      const result = await taskCollection.find({ email: email }).toArray();
      res.send(result);
    });

    app.post("/tasks/:taskId/category", async (req, res) => {
      const taskId = req.params.taskId;
      const { category } = req.body;

      try {
        const result = await taskCollection.updateOne(
          { _id: new ObjectId(taskId) },
          { $set: { category: category } }
        );
        res.send({ success: true, message: "Category updated successfully" });
      } catch (error) {
        console.error("Error updating category:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    app.post("/lists", async (req, res) => {
      const { tasks } = req.body;

      try {
        const result = await listCollection.insertOne({ tasks });
        res.send({ success: true, message: "List created successfully" });
      } catch (error) {
        console.error("Error creating list:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log("Task management system is running on port", port);
});
