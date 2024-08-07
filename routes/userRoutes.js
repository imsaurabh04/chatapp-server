import express from "express";
const router = express.Router();

import { singleAvatar } from "../middlewares/multer.js";
import { isAuthenticated } from "../middlewares/auth.js";

import { 
    acceptFriendRequest,
    getMyFriends,
    getMyNotifications,
    getMyProfile, 
    login, 
    logout, 
    newUser, 
    searchUser,
    sendFriendRequest
} from "../controllers/userController.js";
import { 
    acceptRequestValidator,
    loginValidator, 
    sendRequestValidator, 
    signupValidator, 
    validateHandler 
} from "../lib/validator.js";

router.post("/new", singleAvatar, signupValidator(), validateHandler,  newUser);
router.post("/login", loginValidator(), validateHandler, login);

// After here user must be logged in to access the routes 

router.use(isAuthenticated);
router.get("/me", getMyProfile);
router.get("/logout", logout);
router.get("/search", searchUser);
router.put(
    "/sendrequest", 
    sendRequestValidator(), 
    validateHandler, 
    sendFriendRequest
);
router.put(
    "/acceptrequest",
    acceptRequestValidator(),
    validateHandler,
    acceptFriendRequest
)
router.get(
    "/notifications",
    getMyNotifications
)
router.get(
    "/friends",
    getMyFriends
)

export default router;