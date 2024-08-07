import { body, param, validationResult } from "express-validator";
import { ErrorHandle } from "../utils/utility.js";

const validateHandler = (req, res, next) => {
    const result = validationResult(req);

    if (result.isEmpty()) {
        return next();
    }

    const errorMessages = result.errors.map(error => error.msg).join(", ");

    return next(new ErrorHandle(errorMessages, 400));
}

const signupValidator = () => [
    body("name", "Please enter the name").notEmpty(),
    body("username", "Please enter the username").notEmpty(),
    body("bio", "Please enter the bio").notEmpty(),
    body("password", "Please enter the password").notEmpty()
];

const loginValidator = () => [
    body("username", "Please enter the username").notEmpty(),
    body("password", "Please enter the password").notEmpty(),
];

const newGroupValidator = () => [
    body("name", "Please enter the group name").notEmpty(),
    body("members")
        .notEmpty()
        .withMessage("Please include members")
        .isArray({ min: 2, max: 100 })
        .withMessage("Members must be 2-100")
]

const addMembersValidator = () => [
    body("groupId", "Please provide group ID").notEmpty(),
    body("members")
        .notEmpty()
        .withMessage("Please include members")
        .isArray({ min: 1, max: 97 })
        .withMessage("Members must be 1-97")
]

const removeMembersValidator = () => [
    body("groupId", "Please provide group ID").notEmpty(),
    body("userId", "Please provide user ID").notEmpty(),
]

const leaveGroupValidator = () => [
    param("id", "Please provide group ID").notEmpty()
]

const sendAttachmentsValidator = () => [
    body("chatId", "Please provide chat ID").notEmpty(),
]

const chatIdValidator = () => [
    param("id", "Please provide chat ID").notEmpty()
]

const renameGroupValidator = () => [
    param("id", "Please provide group ID").notEmpty(),
    body("name", "Please enter the group name").notEmpty()
]

const sendRequestValidator = () => [
    body("userId", "Please provide user ID").notEmpty()
]

const acceptRequestValidator = () => [
    body("requestId", "Please provide request ID").notEmpty(),
    body("accept")
        .notEmpty()
        .withMessage("Field 'accept' is required")
        .isBoolean()
        .withMessage("Field 'accept' must be boolean")
]

const adminLoginValidator = () => [
    body("secretKey", "Please provide secret key").notEmpty(),
]

export { 
    signupValidator, 
    loginValidator,
    newGroupValidator,
    addMembersValidator,
    removeMembersValidator,
    leaveGroupValidator,
    sendAttachmentsValidator,
    chatIdValidator,
    renameGroupValidator,
    sendRequestValidator,
    acceptRequestValidator,
    adminLoginValidator,
    validateHandler 
};
