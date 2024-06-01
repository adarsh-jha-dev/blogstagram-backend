import { asyncHandler } from "../utils/asyncHandler.util.js"
import { ApiError } from "../utils/apiError.util.js"
import { ApiResponse } from "../utils/apiResponse.util.js"
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../utils/cloudinary.js"
import { Post } from "../models/post.model.js"
import { User } from "../models/user.model.js"

const getAllPosts = asyncHandler(async (req, res) => {
  try {
    const posts = await Post.find().limit(20)
    res
      .status(200)
      .json(new ApiResponse(200, posts, "Posts fetched successfully"))
  } catch (error) {
    console.log(error.message)
    throw new ApiError(500, "Internal server error")
  }
})

const makePost = asyncHandler(async (req, res) => {
  const { title, content } = req.body

  if (!title) {
    throw new ApiError(409, "Title is required")
  }

  if (!content) {
    throw new ApiError(409, "Content is required")
  }
  const photos = req.files?.photos
  const videos = req.files?.videos

  const photosLocalPaths = []
  const videosLocalPaths = []

  if (photos) {
    photos.forEach((photo) => {
      photosLocalPaths.push(photo.path)
    })
  }

  if (videos) {
    videos.forEach((video) => {
      videosLocalPaths.push(video.path)
    })
  }

  const photosUploadPromises = photosLocalPaths.map(async (photoPath) => {
    try {
      const { url, public_id } = await uploadToCloudinary(photoPath)
      if (!url || !public_id) {
        return null
      }
      return { url, public_id }
    } catch (error) {
      console.error("Error uploading photo:", error)
      return null
    }
  })

  const videosUploadPromises = videosLocalPaths.map(async (videoPath) => {
    try {
      const { url, public_id } = await uploadToCloudinary(videoPath)
      console.log(url, public_id)
      if (!url || !public_id) {
        return null // Skip if either URL or publicId is missing
      }

      return { url, public_id }
    } catch (error) {
      console.error("Error uploading video:", error)
      return null
    }
  })

  const photosUrls = await Promise.all(photosUploadPromises)
  const videosUrls = await Promise.all(videosUploadPromises)

  const post = await Post.create({
    user: req.user._id,
    title,
    content,
    photos: photosUrls.filter((data) => data !== null),
    videos: videosUrls.filter((data) => data !== null),
  })

  const createdPost = Post.findById(post._id)
  if (!createdPost) {
    throw new ApiResponse(500, "Something went wrong while making the post")
  }

  const userId = req.user._id // Extract logged-in user's ID

  await User.findByIdAndUpdate(
    userId,
    { $push: { posts: post._id } }, // Add post ID to user's posts array
    { new: true }
  )

  return res
    .status(200)
    .json(new ApiResponse(200, post, "Post created successfully"))
})

const getPostById = asyncHandler(async (req, res) => {
  try {
    const id = req.params.id
    if (!id) {
      throw new ApiError(400, "Please provide a valid id")
    }

    const post = await Post.findById(id)
    if (!post) {
      throw new ApiError(404, "No such posts found")
    }

    res.json(new ApiResponse(200, post, "Post found successfully"))
  } catch (error) {
    console.log(error)
    throw new ApiError(500, "Internal server error")
  }
})

const editPost = asyncHandler(async (req, res) => {
  try {
    const postId = req.params.id
    const post = await Post.findById(postId)

    if (!post) {
      throw new ApiError(404, "Post not found")
    }

    if (post.user.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "Unauthorized to edit this post")
    }

    const { title, content } = req.body
    const { photos, videos } = req.files || { photos: null, videos: null }

    let photosUrls = []
    let videosUrls = []

    if (photos) {
      for (const photo of post.photos) {
        const deletedPhotos = await deleteFromCloudinary(photo.public_id)
        if (!deletedPhotos) {
          throw new ApiError(500, "Post not updated successfully")
        }
      }

      const photosLocalPaths = photos.map((photo) => photo?.path)
      const photosUploadPromises = photosLocalPaths.map(async (photoPath) => {
        try {
          const { url, public_id } = await uploadToCloudinary(photoPath)
          if (!url || !public_id) {
            return null
          }
          return { url, public_id }
        } catch (error) {
          console.error("Error uploading photo:", error)
          return null
        }
      })
      photosUrls = await Promise.all(photosUploadPromises)
    }

    if (videos) {
      for (const video of post.videos) {
        const deletedVideos = await deleteFromCloudinary(video.public_id)
        if (!deletedVideos) {
          throw new ApiError(500, "Post not updated successfully")
        }
      }

      const videosLocalPaths = videos.map((video) => video?.path)
      const videosUploadPromises = videosLocalPaths.map(async (videoPath) => {
        try {
          const { url, public_id } = await uploadToCloudinary(videoPath)
          if (!url || !public_id) {
            return null
          }
          return { url, public_id }
        } catch (error) {
          console.error("Error uploading video:", error)
          return null
        }
      })
      videosUrls = await Promise.all(videosUploadPromises)
    }

    // Save the updated post
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $set: {
          title: title ? title : post.title,
          content: content ? content : post.content,
          photos: photos ? photosUrls : post.photos,
          videos: videos ? videosUrls : post.videos,
        },
      },
      { new: true } // Return the modified document
    )

    res
      .status(200)
      .json(new ApiResponse(200, updatedPost, "Post updated successfully"))
  } catch (error) {
    console.error(error.message)
    throw new ApiError(500, "Internal server error")
  }
})

const deletePost = asyncHandler(async (req, res) => {
  try {
    const user = req.user
    const id = req.params.id

    console.log(id)

    const post = await Post.findById(id)
    if (!post) {
      throw new ApiError(404, "No such posts")
    }

    if (post.user.toString() !== user._id.toString()) {
      throw new ApiError(401, "Unauthorized")
    }

    await post.photos.forEach(async (photo) => {
      await deleteFromCloudinary(photo.public_id)
    })

    await post.videos.forEach(async (video) => {
      await deleteFromCloudinary(video.public_id)
    })

    const deleted = await Post.deleteOne(post)

    await User.findByIdAndUpdate(
      user._id,
      { $pull: { posts: post._id } }, // Add post ID to user's posts array
      { new: true }
    )

    await User.updateMany(
      { $in: { posts: post._id } },
      {
        $pull: {
          posts: post._id,
        },
      }
    )

    await Comment.deleteMany({
      post: post._id,
    })

    if (!deleted) {
      throw new ApiError(500, "Some error occured while deleting the post")
    } else {
      res
        .status(200)
        .json(new ApiResponse(200, deleted, `Post deleted successfully`))
    }
  } catch (error) {
    console.log(error.message)
    throw new ApiError(500, "Internal server error")
  }
})

const likePost = asyncHandler(async (req, res) => {
  try {
    const postId = req.params.id
    const post = await Post.findById(postId)

    if (!post) {
      throw new ApiError(400, "No such post")
    }

    const userId = req.user._id

    //  if the user has already liked the post
    const alreadyLiked = await User.exists({
      _id: userId,
      likedPosts: { $in: [postId] },
    })

    if (alreadyLiked) {
      return res
        .status(200)
        .json(new ApiResponse(200, null, "You have already liked this post"))
    }

    // Update the like count in the Post model
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $push: {
          likes: userId,
        },
      },
      { new: true }
    )

    // Update the likedPosts array in the User model
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          likedPosts: postId,
        },
      },
      { new: true }
    )

    if (!updatedPost || !updatedUser) {
      throw new ApiError(500, "Some error occurred while liking the post")
    }

    res
      .status(200)
      .json(new ApiResponse(200, updatedPost, "Post liked successfully"))
  } catch (error) {
    console.error(error.message)
    throw new ApiError(500, "Internal server error")
  }
})

const dislikePost = asyncHandler(async (req, res) => {
  try {
    const id = req.params.id
    const post = await Post.findById(id)
    if (!post) {
      return res.status(404).json(new ApiError(404, "No such posts found"))
    }
    const updatedPost = await Post.findByIdAndUpdate(post._id, {
      $pull: { likes: req.user._id },
    })

    const updatedUser = await User.findByIdAndUpdate(req.user._id, {
      $pull: { likedPosts: post._id },
    })

    if (updatedPost && updatedUser) {
      return res
        .status(200)
        .json({ message: "Post disliked successfully", success: true })
    } else {
      return res
        .status(400)
        .json({ message: "Something went wrong", success: false })
    }
  } catch (error) {
    console.log(error)
    return res.status(500).json(new ApiError(500, "Internal server error"))
  }
})

const isLiked = asyncHandler(async (req, res) => {
  try {
    const id = req.params.id
    const user = req.user

    const post = await Post.findById(id)
    if (!post) {
      return res.status(404).json(new ApiError(404, "No such posts"))
    }

    const userLiked = post.likes.includes(user._id)

    if (userLiked) {
      return res
        .status(200)
        .json({ message: "User has already liked the post", success: true })
    } else {
      return res
        .status(200)
        .jsON({ message: "User has not liked the post", success: false })
    }
  } catch (error) {
    console.log(error.message)
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error", error))
  }
})

export {
  getAllPosts,
  makePost,
  getPostById,
  editPost,
  deletePost,
  likePost,
  dislikePost,
  isLiked,
}
