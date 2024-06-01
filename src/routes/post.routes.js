import { Router } from "express"
import { upload } from "../middlewares/multer.middleware.js"
import fetchUser from "../middlewares/fetchUser.middleware.js"
import {
  deletePost,
  dislikePost,
  editPost,
  getAllPosts,
  getPostById,
  isLiked,
  likePost,
  makePost,
} from "../controllers/post.controller.js"
import {
  getUserLikedPosts,
  getUserPosts,
} from "../controllers/user.controller.js"
import { getPostComments } from "../controllers/comment.controller.js"

const router = Router()

router.route("/").get((req, res) => {
  res.send(
    "Welcome to the social media API, here are the available routes: /createnewpost, /fetchallposts, /deletepost/:id, /likepost/:id, /dislike/:id, /isliked/:id, /fetchuserposts/:id, /fetchlikedposts/:id, /edit/:id, /post/:id/comments, /getpost/:id"
  )
})

router.route("/createnewpost").post(
  fetchUser,
  upload.fields([
    {
      name: "photos",
      maxCount: 10,
    },
    {
      name: "videos",
      maxCount: 4,
    },
  ]),
  makePost
)

router.route("/fetchallposts").get(getAllPosts)
router.route("/deletepost/:id").delete(fetchUser, deletePost)
router.route("/likepost/:id").put(fetchUser, likePost)
router.route("/dislike/:id").put(fetchUser, dislikePost)
router.route("/isliked/:id").get(fetchUser, isLiked)
router.route("/fetchuserposts/:id").get(fetchUser, getUserPosts)
router.route("/fetchlikedposts/:id").get(fetchUser, getUserLikedPosts)
router.route("/edit/:id").put(fetchUser, editPost)
router.route("/post/:id/comments").get(getPostComments)
router.route("/getpost/:id").get(getPostById)

export default router
