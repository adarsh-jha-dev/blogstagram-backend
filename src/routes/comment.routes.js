import { Router } from "express"
import fetchUser from "../middlewares/fetchUser.middleware.js"
import {
  deleteComment,
  editComment,
  getUserComments,
  likeComment,
  makeComment,
} from "../controllers/comment.controller.js"

const router = Router()

router.route("/").get((req, res) => {
  res.send(
    "Welcome to the social media API, here are the available routes: /create/:id, /delete/:id, /like/:id, /fetchall/:id, /edit/:id"
  )
})

router.route("/create/:id").post(fetchUser, makeComment)
router.route("/delete/:id").delete(fetchUser, deleteComment)
router.route("/like/:id").put(fetchUser, likeComment)
router.route("/fetchall/:id").get(fetchUser, getUserComments)
router.route("/edit/:id").put(fetchUser, editComment)

export default router
