import { Router } from "express";
import { registerUser, loginUser, logoutUser } from "../controllers/user.controller.js";

import {verifyJWT} from "../middlewares/auth.middleware.js"
import {upload} from "../middlewares/multer.js"

const router = Router()


router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 }
  ]),
  registerUser
)

router.route("/login").post(
  verifyJWT,
  loginUser
)

//protected routes
router.route("/logout").post(
  verifyJWT,
  logoutUser
)

export default router