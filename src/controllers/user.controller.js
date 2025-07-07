import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
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

export {registerUser}