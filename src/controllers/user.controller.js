import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"

const generateAccessAndRefreshTokens = async (userId) => {
    const user = await user.findById(userId)
    const AccessToken = user.generateAccessToken()
    const RefreshToken = user.generateRefreshToken()

    user.refreshToken = RefreshToken
    await user.save({ validateBeforeSave: false })

    return {AccessToken, RefreshToken}
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

    if(!username || !email){
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
    .cookie("AccessToken",accessToken,options)
    .cookie("RefreshToken",refreshToken,options)
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
            $set: {
                refreshToken: undefined
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
    .clearCookie("AccessToken", options)
    .clearCookie("RefreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out"))
})

export {
    registerUser,
    loginUser,
    logoutUser
}