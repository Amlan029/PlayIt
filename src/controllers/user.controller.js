import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async (userId) => {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return {accessToken, refreshToken}
}

const registerUser = asyncHandler(async (req, res)=> {
    //get data from body by req.body
    //validation - not empty
    //check if user already exists: username,email
    //check for images, check for avatar
    //upload them to cloudinary,avatar
    //create user object- create entry in DB 
    //remove password and refresh token field from response
    //check for user creation 
    //return res
    const {fullname, email, username, password} = req.body

    if(
        [fullname, email, username, password].some((field)=> field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are  Required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if(existedUser){
        throw new ApiError(409,"User with email or username Already Exists")
    }
    // console.log(req.files);
    
    const avatarLocalPath = req.files?.avatar[0]?.path;
    
    
    
    // const coverLocalPath = req.files?.coverImage[0]?.path;
    let coverLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverLocalPath = req.files.coverImage[0].path;
    }
   
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar needed")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    
    
    const coverImage = await uploadOnCloudinary(coverLocalPath)
    if(!avatar){
        throw new ApiError(400,"Avatar needed")
    }

    const user =  await User.create({
        username: username.toLowerCase(),
        email,
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        password
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser){
        throw new ApiError(500,"Something went Wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser, "User registered successfully")
    )

})

const loginUser = asyncHandler(async (req,res)=> {
    // req.body -> data
    // username or email
    // find the user
    // check for password
    // access and refresh token
    // send cookies
    const {username, email, password} = req.body

    if(!username && !email){
        throw new ApiError(400,"Username or email is Required!!!")
    }
    const user = await User.findOne({
        $or: [{username},{email}]
    })
    if(!user)  throw new ApiError(404, "User does not exist")

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid) throw new ApiError(401,"Password is incorrect")
    
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    
    }
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,
                accessToken,
                refreshToken,

            },
            "User LoggedIn Successfully"
        )
    )
    
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    
    }
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out"))
})

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken) throw new ApiError(401, "Unauthorized request")

    try {
        const decodedToken =  jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user) throw new ApiError(401, "Invalid Refresh Token")
        
        if(incomingRefreshToken !== user?.refreshToken) throw new ApiError(401,"Refresh token is expired or used")
        
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user?._id)
    
        const options = {
            httpOnly: true,
            secure: true
        }
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
        
    }
})

const changeCurrentPassword = asyncHandler(async(req, res)=> {
    const {oldPassword, newPassword} = req.body;
    const user = await User.findbyId(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect) throw new ApiError(400, "Invalid old password")
    user.password = newPassword;
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changed Successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "Current user fetchend Successfully"
    ))
})

const updateAccountDetails = asyncHandler(async(req, res)=>{
    const {fullName, email} = req.body;

    if(!(fullName || email)){
        throw new ApiError(400,"All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        user,
        "Account details updated successfully"
    ))
})

const updateUserAvatar = asyncHandler(async(req, res)=> {
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath) throw new ApiError(400,"Avatar file is missing")
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url) throw new ApiError(400,"Error while uploading avatar file")
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        user,
        "Avatar Image updated Successfully"
    ))
})
const updateUserCover = asyncHandler(async(req, res)=> {
    const coverLocalPath = req.file?.path;
    if(!coverLocalPath) throw new ApiError(400,"Cover file is missing")
    const cover = await uploadOnCloudinary(coverLocalPath);
    if(!cover.url) throw new ApiError(400,"Error while uploading cover file")
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: cover.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        user,
        "Cover Image updated Successfully"
    ))
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params;
    if(!username?.trim()) throw new ApiError(400, "Username is missing");
    const channel = await User.aggregate([
            {
                $match: {
                    username: username?.toLowerCase()
                }

            },
            {
                $lookup: {
                    from: "subcription",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subcribers"
                }
            },
            {
                $lookup: {
                    from: "subcription",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subcribedTo"
                }
            },
            {
                $addFields: {
                    subcriberCount: {
                        $size: "$subcribers"
                    },
                    channelsSubcribedToCount: {
                        $size: "$subcribedTo"
                    },
                    isSubcribed: {
                        $cond: {
                            if: {$in: [req.user?._id, "$subcribers.subcriber"]},
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project: {
                    username: 1,
                    fullname: 1,
                    email: 1,
                    avatar: 1,
                    coverImage: 1,
                    subcriberCount: 1,
                    channelsSubcribedToCount: 1,
                    isSubcribed: 1

                }
            }
        
    ]);
    if(!channel?.length) throw new ApiError(404, "Channel does not exist");

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        channel[0],
        "User channel fetched successfully"
    ))
    
})

const getUserWatchHistory = asyncHandler(async(req, res)=> {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                },
                                {
                                    $addFields: {
                                        owner: {
                                            $first: "$owner"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch History Fetched Successfully"
    ))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    changeCurrentPassword,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCover,
    getUserChannelProfile,
    getUserWatchHistory
}