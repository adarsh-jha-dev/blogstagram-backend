import express from "express"
import cors from "cors"

const app = express()

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
)

app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.static("public"))

import userRouter from "./routes/user.routes.js"
import postsRoute from "./routes/post.routes.js"
import commentsRoute from "./routes/comment.routes.js"

app.get("/", (req, res) => {
  res.send(
    "Welcome to the social media API, here are the available routes: /api/v1/users, /api/v1/posts, /api/v1/comments"
  )
})

app.use("/api/v1/users", userRouter)
app.use("/api/v1/posts", postsRoute)
app.use("/api/v1/comments", commentsRoute)

export { app }
