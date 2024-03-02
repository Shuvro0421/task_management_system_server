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
    origin: [
      "https://task-management-system-auth.web.app/",
      "https://task-management-system-auth.firebaseapp.com/",
    ], // Update this to your frontend URL in production
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
const uri = `mongodb+srv://taskManagementSystem:YNGKFueSeyehnxUK@cluster0.04lxrta.mongodb.net/taskDb`;

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
  const userCollection = client.db("taskDb").collection("users");
  const assignedTaskCollection = client
    .db("taskDb")
    .collection("assignedTasks");

  try {
    // jwt token
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, 'c2e09a2918d40d2cc825b431e46b825009bd53a196c26054d79c8cae770cc9136fdbc17bd14390204fc9b66aad0ec2e99bcc44c05924d6bcd36ba5bbcb609cd0', {
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

    app.put("/tasks/:taskId", async (req, res) => {
      const taskId = req.params.taskId;
      const updatedTask = req.body; // New task data from the request body

      try {
        const result = await taskCollection.updateOne(
          { _id: new ObjectId(taskId) },
          { $set: updatedTask } // Update task with new data
        );

        if (result.modifiedCount === 1) {
          res.send({ success: true, message: "Task updated successfully" });
        } else {
          res.send({
            success: false,
            message: "No task found with the provided ID",
          });
        }
      } catch (error) {
        console.error("Error updating task:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
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

    // user related api
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.find({ email: email }).toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists:
      // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.post("/make-admin", async (req, res) => {
      const { email } = req.body;
      // Update the user in the database to make them an admin
      try {
        const result = await userCollection.updateOne(
          { email: email },
          { $set: { isAdmin: true } }
        );
        res.send({ success: true, message: "User successfully made admin" });
      } catch (error) {
        console.error("Error making admin:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    app.post("/remove-admin", async (req, res) => {
      const { email } = req.body;
      // Update the user in the database to remove admin privileges
      try {
        const result = await userCollection.updateOne(
          { email: email },
          { $set: { isAdmin: false } }
        );
        res.send({
          success: true,
          message: "Admin privileges successfully removed from user",
        });
      } catch (error) {
        console.error("Error removing admin privileges:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });

    app.post("/assign-tasks", async (req, res) => {
      const { selectedTaskDetails, selectedUsers, senderEmail } = req.body; // Include senderEmail here

      try {
        // Loop through selected users
        for (const userId of selectedUsers) {
          // Loop through selected tasks for each user
          for (const task of selectedTaskDetails) {
            // Construct object to insert into the database
            const userTask = {
              userId: userId,
              taskId: task._id,
              title: task.title,
              description: task.description,
              dueDate: task.dueDate,
              priority: task.priority,
              category: task.category,
              senderEmail: senderEmail, // Include senderEmail here
            };

            // Insert the task for this user
            await assignedTaskCollection.insertOne(userTask);
          }
        }

        res.send({ success: true, message: "Tasks assigned successfully" });
      } catch (error) {
        console.error("Error assigning tasks:", error);
        res
          .status(500)
          .send({ success: false, message: "Internal server error" });
      }
    });
    // task related api
    app.get("/assign-tasks", async (req, res) => {
      const result = await assignedTaskCollection.find().toArray();
      res.send(result);
    });

    app.post("/assign-tasks/:taskId", async (req, res) => {
      const taskId = req.params.taskId;
      const { status } = req.body;

      try {
        const result = await assignedTaskCollection.updateOne(
          { _id: new ObjectId(taskId) }, // Match by _id
          { $set: { status: status || null } }, // Set status to null if not provided
          { upsert: true } // Create the document if it doesn't exist
        );

        if (result.modifiedCount === 1 || result.upsertedCount === 1) {
          res.send({ success: true, message: "Status updated successfully" });
        } else {
          res.send({
            success: false,
            message: "No task found with the provided ID",
          });
        }
      } catch (error) {
        console.error("Error updating status:", error);
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
