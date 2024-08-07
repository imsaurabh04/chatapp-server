import { 
    adminLogin,
    adminLogout,
    getAdminData,
    getAllChats,
    getAllMessages,
    getAllUsers,
    getDashboardStats
} from "../controllers/adminController.js";
import { 
    adminLoginValidator, 
    validateHandler 
} from "../lib/validator.js";

import { isAdmin } from "../middlewares/auth.js";

import express from "express";
const router = express.Router();


router.post(
    "/verify", 
    adminLoginValidator(), 
    validateHandler, 
    adminLogin
);

// admin middleware => Only Admin can access these routes.
router.use(isAdmin);

router.get(
    "/logout", 
    adminLogout
);
router.get(
    "/",
    getAdminData
);
router.get(
    "/users",
    getAllUsers
)
router.get(
    "/chats",
    getAllChats
)
router.get(
    "/messages",
    getAllMessages
)

router.get(
    "/stats",
    getDashboardStats
)

export default router;