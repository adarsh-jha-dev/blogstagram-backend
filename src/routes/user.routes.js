import { Router } from "express"
import { upload } from "../middlewares/multer.middleware.js"
import {
  UnfollowUser,
  checkIfUserFollows,
  deleteUser,
  followUser,
  getFollowers,
  getFollowing,
  getUserById,
  getUserByUsername,
  loginUser,
  registerUser,
} from "../controllers/user.controller.js"
import fetchUser from "../middlewares/fetchUser.middleware.js"

const router = Router()

router.route("/").get((req, res) => {
  res.send(
    "Welcome to the social media API, here are the available routes: /register, /login, /delete, /username, /getuser/:id, /follow/:id, /isfollowing/:id, /unfollow/:id, /getfollowers/:id, /getfollowing/:id"
  )
})

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
)

router.route("/login").post(loginUser)
router.route("/delete").delete(fetchUser, deleteUser)
router.route("/username").get(fetchUser, getUserByUsername)
router.route("/getuser/:id").get(getUserById)
router.route("/follow/:id").post(fetchUser, followUser)
router.route("/isfollowing/:id").get(fetchUser, checkIfUserFollows)
router.route("/unfollow/:id").put(fetchUser, UnfollowUser)
router.route("/getfollowers/:id").get(fetchUser, getFollowers)
router.route("/getfollowing/:id").get(fetchUser, getFollowing)

export default router
