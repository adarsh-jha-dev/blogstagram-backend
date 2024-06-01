import { Comment } from "../models/comment.model.js"
import { Post } from "../models/post.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/apiError.util.js"
import { ApiResponse } from "../utils/apiResponse.util.js"
import { asyncHandler } from "../utils/asyncHandler.util.js"

const makeComment = asyncHandler(async (req, res) => {
  try {
    const id = req.params.id
    const post = await Post.findById(id)

    if (!post) {
      throw new ApiError(404, "No such posts")
    }

    const user = req.user

    const comment = await Comment.create({
      post: post._id,
      user: user._id,
      content: req.body.content,
    })

    if (!comment) {
      throw new ApiError(400, "Comment creation failed")
    }

    const updatedPost = await Post.updateOne(
      { _id: post._id },
      {
        $push: {
          comments: comment._id,
        },
      }
    )

    const updatedUser = await User.updateOne(
      { _id: user._id },
      {
        $push: {
          comments: comment._id,
        },
      }
    )

    if (!updatedPost || !updatedUser) {
      throw new ApiError(500, "Some error occured while comment creation")
    }

    res
      .status(200)
      .json(new ApiResponse(200, comment, "Comment created successfully"))
  } catch (error) {
    console.log(error.message)
    throw new ApiError(500, "Internal server error")
  }
})

const deleteComment = asyncHandler(async (req, res) => {
  try {
    const id = req.params.id
    const comment = await Comment.findById(id) // Await here

    const user = req.user

    if (!comment) {
      throw new ApiError(404, "No such comments")
    }
    if (comment.user.toString() !== user._id.toString()) {
      throw new ApiError(409, "Unauthorized")
    }

    const post = await Post.findById(comment.post.toString())
    const commentId = comment._id

    const deletedComment = await Comment.deleteOne({ _id: comment._id }) // Corrected syntax

    if (!deletedComment) {
      throw new ApiError(500, "Some error occurred while deleting the comment")
    }

    await User.updateOne(
      { _id: user._id },
      {
        $pull: { comments: commentId },
      }
    )

    await Post.updateOne(
      { _id: post._id },
      {
        $pull: { comments: commentId },
      }
    )

    res.status(200).json(new ApiResponse(200, "Comment deleted successfully"))
  } catch (error) {
    console.log(error.message)
    throw new ApiError(500, "Something went wrong while deleting the comment")
  }
})

const editComment = asyncHandler(async (req, res) => {
  try {
    const commentId = req.params.id
    const { content } = req.body

    // Check if the comment exists
    const comment = await Comment.findById(commentId)

    if (!comment) {
      throw new ApiError(404, "Comment not found")
    }

    // Check if the user is the owner of the comment
    console.log(comment.user.toString(), req.user._id.toString())
    if (comment.user.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "Unauthorized to edit this comment")
    }

    // Update the comment content
    comment.content = content
    const updatedComment = await comment.save()

    res
      .status(200)
      .json(
        new ApiResponse(200, updatedComment, "Comment updated successfully")
      )
  } catch (error) {
    console.error(error.message)
    throw new ApiError(500, "Internal server error")
  }
})

const likeComment = asyncHandler(async (req, res) => {
  try {
    const commentId = req.params.id
    const user = req.user

    // Check if the comment exists
    const comment = await Comment.findById(commentId)
    if (!comment) {
      throw new ApiError(404, "No such comment")
    }

    // Check if the user has already liked the comment
    if (comment.likes.includes(user._id)) {
      return res
        .status(200)
        .json(new ApiResponse(200, {}, "You have already liked the comment"))
    }

    // Add the user to the likes array of the comment
    comment.likes.push(user._id)
    const updatedComment = await comment.save()

    if (!updatedComment) {
      throw new ApiError(500, "Some error occurred while liking the comment")
    }

    // Add the liked comment to the user's likedComments array
    const updatedUser = await User.updateOne(
      { _id: user._id },
      {
        $push: { likedComments: comment._id },
      }
    )

    if (!updatedUser) {
      // If updating the user fails, consider rolling back the comment update
      throw new ApiError(500, "Some error occurred while updating user likes")
    }

    res
      .status(200)
      .json(new ApiResponse(200, updatedComment, "Comment liked successfully"))
  } catch (error) {
    console.error(error.message)
    if (error instanceof ApiError) {
      throw error
    } else {
      throw new ApiError(500, "Something went wrong while liking the comment")
    }
  }
})

const getUserComments = asyncHandler(async (req, res) => {
  try {
    const id = req.params.id

    const user = await User.findById(id)

    if (!user) {
      throw new ApiError(409, "No such users exist")
    }

    const comments = await Comment.find({ user: user._id })

    res
      .status(200)
      .json(new ApiResponse(200, comments, "Comments fetched successfully"))
  } catch (error) {
    console.log(error.message)
    throw new ApiError(500, "Internal server error")
  }
})

const getPostComments = asyncHandler(async (req, res, next) => {
  try {
    const postId = req.params.id

    // Find the post and populate the comments field
    const post = await Post.findById(postId).populate(
      "comments.user",
      "username"
    )

    if (!post) {
      throw new ApiError(404, "Post not found")
    }

    const commentIds = post.comments // Adjust this based on your actual comment structure
    const comments = await Comment.find({ _id: { $in: commentIds } })

    res.json({
      status: "success",
      data: comments,
    })
  } catch (error) {
    next(error)
  }
})

export {
  makeComment,
  deleteComment,
  editComment,
  likeComment,
  getUserComments,
  getPostComments,
}
