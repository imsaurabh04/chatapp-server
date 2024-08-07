import { compare } from "bcrypt";
import { cookieOptions, emitEvent, sendToken } from "../utils/features.js";
import { TryCatch } from "../middlewares/error.js";
import { ErrorHandle } from "../utils/utility.js";
import { NEW_REQUEST, REFETCH_CHATS } from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
import { uploadFilesToCloudinary } from "../utils/features.js";

import { Chat } from "../models/Chat.js";
import { User } from "../models/User.js";
import { Request } from "../models/Request.js";

const newUser = TryCatch(async (req, res, next) => {

    const { name, username, bio, password } = req.body;
    const file = req.file;
    
    if(!file) return next(new ErrorHandle("Please upload avatar", 400));

    const result = await uploadFilesToCloudinary([file]);

    const avatar = {
        public_id: result[0].public_id,
        url: result[0].url
    }

    const user = await User.create({
        name,
        username,
        bio,
        password,
        avatar
    });

    sendToken(res, user, 201, "Account created successfully.")
});

const login = TryCatch(async(req, res, next) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username }).select("+password");
    if(!user) return next(new ErrorHandle("Invalid Username or Password.", 400));
    
    const isPasswordMatched = await compare(password, user.password);
    if(!isPasswordMatched) return next(new ErrorHandle("Invalid Username or Password.", 400));
    
    sendToken(res, user, 200, `Welcome to ChatterBox, ${user.name}`)
});

const getMyProfile = TryCatch(async(req, res) => {

    const user = await User.findById(req.user);

    res.status(200).json({
        success: true,
        user
    })
});

const logout = TryCatch((req, res) => {
    
    res.status(200).clearCookie("chatterbox-token", {...cookieOptions, maxAge: 0}).json({
        success: true,
        message: "You have been successfully logged out."
    })
});

const searchUser = TryCatch(async(req, res, next) => {
    const {name = ""} = req.query;
    
    const myChats = await Chat.find({ groupChat: false, members: req.user });
    const myFriends = myChats.flatMap(chat => chat.members); 

    const allUsersExceptMeAndMyFriends = await User.find({
        _id: { $nin: [...myFriends, req.user] },
        name: { $regex: name, $options: "i" }
    })

    const users = allUsersExceptMeAndMyFriends.map(({_id, name, avatar}) => (
        {
            _id,
            name,
            avatar: avatar.url
        }
    )) 

    return res.status(200).json({
        success: true,
        users
    })
});

const sendFriendRequest = TryCatch(async(req, res, next) => {

    const { userId } = req.body;

    const existsRequest = await Request.findOne({
        $or: [
            { sender: req.user, receiver: userId },
            { sender: userId, receiver: req.user }
        ]
    })

    if(existsRequest) return next(new ErrorHandle("Request already sent", 400));

    await Request.create({
        sender: req.user,
        receiver: userId
    })

    emitEvent(
        req,
        NEW_REQUEST,
        [userId]
    )

    return res.status(200).json({
        success: true,
        message: "Friend Request Sent"
    })
});

const acceptFriendRequest = TryCatch(async(req, res, next) => {

    const { requestId, accept } = req.body;

    const request = await Request.findById(requestId)
        .populate("sender", "name avatar")
        .populate("receiver", "name avatar")

    if(!request) return next(new ErrorHandle("Request not found", 404));

    if(request.receiver._id.toString() !== req.user.toString()) {
        return next(new ErrorHandle("You are not authorized user to accept this request", 401));
    }

    if(!accept) {
        await request.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Friend request rejected"
        })
    }

    const members = [ request.sender._id, request.receiver._id ];

    await Promise.all([
        Chat.create({
            members,
            name: `${request.sender.name}-${request.receiver.name}`
        }),
        request.deleteOne()
    ])

    emitEvent(
        req,
        REFETCH_CHATS,
        members
    );

    return res.status(200).json({
        success: true,
        message: "Friend request accepted",
        senderId: request.sender._id
    })
});

const getMyNotifications = TryCatch(async(req, res, next) => {

    const requests = await Request.find({ receiver: req.user })
        .populate("sender", "name avatar");

    const allRequests = requests.map(({_id, sender}) => (
        {
            _id,
            sender: {
                _id: sender._id,
                name: sender.name,
                avatar: sender.avatar.url
            }
        }
    ))
    return res.status(200).json({
        success: true,
        allRequests
    })
});

const getMyFriends = TryCatch(async(req, res, next) => {

    const {chatId} = req.query;

    const myChats = await Chat.find({ groupChat: false, members: req.user })
        .populate("members", "name avatar");

    const myFriends = myChats.map(({members}) => {
        const otherMember = getOtherMember(members, req.user);

        return {
            _id: otherMember._id,
            name: otherMember.name,
            avatar: otherMember.avatar.url
        }
    })

    if(chatId) {
        const chat = await Chat.findById(chatId);

        const availableFriends = myFriends.filter(friend => (
            !chat.members.includes(friend._id.toString())
        ))
        return res.status(200).json({
            success: true,
            friends: availableFriends
        })
    }

    return res.status(200).json({
        success: true,
        friends: myFriends
    })
});

export {
    newUser,
    login,
    getMyProfile,
    logout,
    searchUser,
    sendFriendRequest,
    acceptFriendRequest,
    getMyNotifications,
    getMyFriends
};
