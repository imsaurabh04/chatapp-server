import express from "express";
const router = express.Router();

import { isAuthenticated } from "../middlewares/auth.js";

import {
    addMembers,
    deleteChat,
    getChatDetails,
    getMessages,
    getMyChats,
    getMyGroups,
    leaveGroup,
    newGroupChat,
    removeMember,
    renameGroup,
    sendAttachments,
} from "../controllers/chatController.js";
import { attachmentsMulter } from "../middlewares/multer.js";
import {
    addMembersValidator,
    chatIdValidator,
    leaveGroupValidator,
    newGroupValidator,
    removeMembersValidator,
    renameGroupValidator,
    sendAttachmentsValidator,
    validateHandler,
} from "../lib/validator.js";

router.use(isAuthenticated);

router.post(
    "/new",
    newGroupValidator(),
    validateHandler,
    newGroupChat
);
router.get("/my", getMyChats);
router.get("/my/groups", getMyGroups);
router.put(
    "/addmembers",
    addMembersValidator(),
    validateHandler,
    addMembers
);
router.put(
    "/removemember",
    removeMembersValidator(),
    validateHandler,
    removeMember
);
router.delete(
    "/leave/:id",
    leaveGroupValidator(),
    validateHandler,
    leaveGroup
);
router.post(
    "/message",
    attachmentsMulter,
    sendAttachmentsValidator(),
    validateHandler,
    sendAttachments
);
router.get(
    "/message/:id",
    chatIdValidator(),
    validateHandler,
    getMessages
);

router
    .route("/:id")
    .get(chatIdValidator(), validateHandler, getChatDetails)
    .put(renameGroupValidator(), validateHandler, renameGroup)
    .delete(chatIdValidator(), validateHandler, deleteChat);

export default router;
