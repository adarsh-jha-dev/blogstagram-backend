import { Post } from "../models/post.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/apiError.util.js"
import { ApiResponse } from "../utils/apiResponse.util.js"
import { asyncHandler } from "../utils/asyncHandler.util.js"
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../utils/cloudinary.js"

const registerUser = asyncHandler(async (req, res) => {
  // take the details from the user
  // validate the details - check for empty inputs
  // look for user in the database with the same credentials
  // check for image fields
  // upload the image fields to cloudinary
  // if an user with the same credentials doesn't exist, save the new user
  // return the response (new user) if not any errors

  const { firstname, lastname, username, email, password } = req.body
  let avatarLocalPath
  let coverImageLocalPath
  try {
    if (
      [firstname, lastname, username, email, password].some(
        (field) => field.trim() === ""
      )
    ) {
      throw new ApiError(400, "All fields are required for signing up")
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    })

    if (existingUser) {
      throw new ApiError(
        409,
        "A user with this email or username already exists"
      )
    }

    if (
      req.files &&
      Array.isArray(req.files.coverImage) &&
      req.files.coverImage.length > 0
    ) {
      coverImageLocalPath = req.files.coverImage[0].path
    }

    if (
      req.files &&
      Array.isArray(req.files.coverImage) &&
      req.files.avatar.length > 0
    ) {
      avatarLocalPath = req.files?.avatar[0]?.path
    }

    let avatar = avatarLocalPath
      ? await uploadToCloudinary(avatarLocalPath)
      : null
    const coverImage = coverImageLocalPath
      ? await uploadToCloudinary(coverImageLocalPath)
      : null
    if (!avatar) {
      throw new ApiError(409, "Avatar is required")
    }

    const user = await User.create({
      firstname,
      lastname,
      username,
      email,
      password,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
    })

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    )

    if (!createdUser) {
      throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res
      .status(201)
      .json(
        new ApiResponse(200, { createdUser }, "User registered Successfully")
      )
  } catch (error) {
    throw new ApiError(error.statusCode, error.message)
  }
})

const loginUser = asyncHandler(async (req, res) => {
  const { username, password } = req.body
  try {
    const user = await User.findOne({ username })

    if (!user) {
      throw new ApiError(401, "Invalid username or password")
    }

    const correct = await user.isPasswordCorrect(password)

    if (!correct) {
      throw new ApiError(401, "Invalid username or password")
    }

    const accessToken = await user.generateAccessToken()

    return res
      .status(200)
      .json(new ApiResponse(200, { accessToken, user }, "Login Successful"))
  } catch (error) {
    console.error("Login error:", error.message)
    throw error
  }
})

const getUserById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params

    // Find user by userId
    const user = await User.findById(id)

    if (!user) {
      throw new ApiError(404, "User not found")
    }

    res
      .status(200)
      .json(new ApiResponse(200, user, "User fetched successfully by userId"))
  } catch (error) {
    console.error(error.message)
    if (error instanceof ApiError) {
      throw error // rethrow ApiError instances
    } else {
      throw new ApiError(500, "Internal server error")
    }
  }
})

const getUserByUsername = asyncHandler(async (req, res) => {
  try {
    const { username } = req.body

    // case-insensitive regex to match usernames partially or completely
    const users = await User.find({
      username: { $regex: new RegExp(username, "i") },
    })

    res
      .status(200)
      .json(
        new ApiResponse(200, users, "Users fetched successfully by username")
      )
  } catch (error) {
    console.error(error.message)
    throw new ApiError(500, "Internal server error")
  }
})

const deleteUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id
    const user = await User.findById(userId)

    if (!user) {
      throw new ApiError(404, "User not found")
    }
    for (const postId of user.posts) {
      const post = await Post.findById(postId)

      if (post) {
        post.photos.forEach(async (photo) => {
          await deleteFromCloudinary(photo.public_id)
        })
        post.videos.forEach(async (video) => {
          await deleteFromCloudinary(video.public_id)
        })
        await Post.findByIdAndDelete(postId)
      }
    }
    await Comment.deleteMany({ user: userId })
    await User.findByIdAndDelete(userId)

    res
      .status(200)
      .json(new ApiResponse(200, null, "User deleted successfully"))
  } catch (error) {
    console.log(error.message)
    throw new ApiError(500, "Internal server error")
  }
})

const getUserLikedPosts = asyncHandler(async (req, res) => {
  try {
    const userId = req.params.id
    const user = await User.findById(userId)

    if (!user) {
      throw new ApiError(404, "No such user exists")
    }

    // console.log("User Liked Posts (Before Conversion):", user.likedPosts)

    const userLikedPosts = await Post.find({ _id: { $in: user.likedPosts } })

    // console.log("User Liked Posts (Result):", userLikedPosts)

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          userLikedPosts,
          "User's liked posts fetched successfully"
        )
      )
  } catch (error) {
    console.error(error.message)
    throw new ApiError(
      500,
      "Something went wrong while fetching user's liked posts"
    )
  }
})

const getFollowers = asyncHandler(async (req, res) => {
  try {
    const userId = req.params.id // Retrieve user ID from params
    const user = await User.findById(userId)

    if (!user) {
      throw new ApiError(404, "User not found")
    }

    const followers = user.followers
    const users = await User.find({ _id: { $in: followers } })
    res.json(new ApiResponse(200, users, "Followers fetched successfully"))
  } catch (error) {
    console.error(error)
    throw new ApiError(500, error.message)
  }
})

const getFollowing = asyncHandler(async (req, res) => {
  try {
    const userId = req.params.id // Retrieve user ID from params
    const user = await User.findById(userId)

    if (!user) {
      throw new ApiError(404, "User not found")
    }

    const following = user.following
    const users = await User.find({ _id: { $in: following } })
    res.json(new ApiResponse(200, users, "Following fetched successfully"))
  } catch (error) {
    console.error(error)
    throw new ApiError(500, error.message)
  }
})

const getUserPosts = asyncHandler(async (req, res) => {
  try {
    const userId = req.params.id
    const user = await User.findById(userId)

    if (!user) {
      throw new ApiError(404, "No such user exists")
    }

    const userPosts = await Post.find({ user: userId })

    res
      .status(200)
      .json(
        new ApiResponse(200, userPosts, "User's posts fetched successfully")
      )
  } catch (error) {
    console.error(error.message)
    throw new ApiError(500, "Something went wrong while fetching user's posts")
  }
})

const followUser = asyncHandler(async (req, res) => {
  try {
    const id = req.params.id
    const followedUser = await User.findById(id)
    if (!followedUser) {
      throw new ApiError(404, "No such users")
    }

    // Check if the user is already following the specified user
    const alreadyFollowing = await User.findOne({
      _id: req.user._id,
      following: { $in: [id] },
    })

    if (alreadyFollowing) {
      return res.json(
        new ApiResponse(400, null, "User is already being followed.")
      )
    }

    await User.findByIdAndUpdate(followedUser._id, {
      $push: { followers: req.user._id },
    })

    const updatedUser = await User.findByIdAndUpdate(req.user._id, {
      $push: { following: followedUser._id },
    })

    res.json(new ApiResponse(200, updatedUser, "User followed successfully"))
  } catch (error) {
    console.log(error)
    throw new ApiError(error.message)
  }
})

const UnfollowUser = asyncHandler(async (req, res) => {
  try {
    const id = req.params.id

    const followingUser = await User.findById(id)
    if (!followingUser) {
      return res.status(404).json(new ApiError(404, "No such users found"))
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $pull: { following: id },
      },
      {
        new: true,
      }
    )

    const unfollowedUser = await User.findByIdAndUpdate(
      id,
      {
        $pull: { followers: req.user._id },
      },
      {
        new: true,
      }
    )

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Unfollowed user successfully"))
  } catch (error) {
    console.log(error.message)
    return res
      .status(500)
      .json(new ApiError(500, "Internal server error", error))
  }
})

const checkIfUserFollows = asyncHandler(async (req, res) => {
  try {
    const targetUserId = req.params.id
    const loggedInUserId = req.user._id
    const targetUser = await User.findById(targetUserId)
    if (!targetUser) {
      return res.status(404).json(new ApiError(404, "User not found"))
    }

    const isFollowing = targetUser.followers.includes(loggedInUserId)

    if (isFollowing) {
      return res.json({
        message: "User is already being followed",
        success: true,
      })
    } else {
      return res.json({ message: "User is not being followed", success: false })
    }
  } catch (error) {
    console.error(error)
    return res.status(500).json(new ApiError(500, "Internal Server Error"))
  }
})

export {
  registerUser,
  loginUser,
  getUserById,
  getUserByUsername,
  getUserLikedPosts,
  deleteUser,
  getUserPosts,
  getFollowers,
  getFollowing,
  followUser,
  UnfollowUser,
  checkIfUserFollows,
}
