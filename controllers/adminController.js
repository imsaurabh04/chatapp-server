import { TryCatch } from "../middlewares/error.js";
import jwt from "jsonwebtoken";

import { User } from "../models/User.js";
import { Chat } from "../models/Chat.js";
import { Message } from "../models/Message.js";

import { adminSecretKey } from "../app.js";
import { ErrorHandle } from "../utils/utility.js";
import { cookieOptions } from "../utils/features.js";

const getAllUsers = TryCatch(async (req, res, next) => {

    const users = await User.find();

    const transformedUsers = await Promise.all(users.map(async ({ _id, name, username, avatar, createdAt }) => {

        const [groups, friends] = await Promise.all([
            Chat.countDocuments({ groupChat: true, members: _id }),
            Chat.countDocuments({ groupChat: false, members: _id })
        ])

        return ({
            _id,
            name,
            username,
            avatar: avatar.url,
            groups,
            friends,
            joinedDate: createdAt
        })
    }));

    return res.status(200).json({
        success: true,
        users: transformedUsers
    })
});

const getAllChats = TryCatch(async (req, res, next) => {

    const chats = await Chat.find()
        .populate("members", "name avatar")
        .populate("creator", "name avatar")
        ;

    const transformedChats = await Promise.all(chats.map(async ({ _id, name, groupChat, creator, members }) => {

        const totalMessages = await Message.countDocuments({ chat: _id });

        return ({
            _id,
            name,
            groupChat,
            avatar: members.map(({ avatar }) => avatar.url),
            members: members.map(({ _id, name, avatar }) => ({
                _id,
                name,
                avatar: avatar.url
            })),
            creator: {
                name: creator?.name || "None",
                avatar: creator?.avatar.url || ""
            },
            totalMembers: members.length,
            totalMessages
        })
    }));

    return res.status(200).json({
        success: true,
        chats: transformedChats
    })
});

const getAllMessages = TryCatch(async (req, res, next) => {

    const messages = await Message.find()
        .populate("sender", "name avatar")
        .populate("chat", "groupChat");

    const transformedMessages = messages.map(({ _id, content, attachments, createdAt, sender, chat }) => {
        return ({
            _id,
            content,
            attachments,
            createdAt,
            chat: chat._id,
            groupChat: chat.groupChat,
            sender: {
                _id: sender._id,
                name: sender.name,
                avatar: sender.avatar.url
            }
        })
    })

    return res.status(200).json({
        success: true,
        messages: transformedMessages
    })
});

const getDashboardStats = TryCatch(async (req, res, next) => {

    const [usersCount, chatsCount, messagesCount, groups] = await Promise.all([
        User.countDocuments(),
        Chat.countDocuments(),
        Message.countDocuments(),
        Chat.countDocuments({ groupChat: true })
    ])
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of the current day
    const date_7daysAgo = new Date(today);
    date_7daysAgo.setDate(today.getDate() - 6); // Start from 6 days ago, as we include today

    // Fetch messages created in the last 7 days (including today)
    const last7daysMessages = await Message.find({
        createdAt: { $gte: date_7daysAgo, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    }).select("createdAt");

    // Initialize an array to hold message counts for each day (0 for 6 days ago, 6 for today)
    const messagesPerDay = new Array(7).fill(0);

    // Calculate the correct index for each message and increment the count
    last7daysMessages.forEach(({ createdAt }) => {
        const index = Math.floor((today.getTime() - new Date(createdAt).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
        if (index >= 0 && index < 7) {
            messagesPerDay[6 - index]++; // Reverse index to have 0 for 6 days ago and 6 for today
        }
    });

    const stats = {
        usersCount,
        chatsCount,
        messagesCount,
        groups,
        messagesChart: messagesPerDay
    }

    return res.status(200).json({
        success: true,
        stats
    })
});

const adminLogin = TryCatch(async (req, res, next) => {

    const { secretKey } = req.body;

    const isMatched = secretKey === adminSecretKey;

    if (!isMatched) return next(new ErrorHandle("Invalid Secret Key", 401));

    const token = jwt.sign(secretKey, process.env.JWT_SECRET);

    return res.status(200)
        .cookie(
            "chatterbox-admin-token",
            token,
            { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 }
        )
        .json({
            success: true,
            message: "Welcome to ChatterBox, BOSS"
        })
});

const adminLogout = TryCatch(async (req, res, next) => {

    return res.status(200)
        .clearCookie("chatterbox-admin-token", {
            ...cookieOptions,
            maxAge: 0
        })
        .json({
            success: true,
            message: "Logged out successfully"
        })
});

const getAdminData = TryCatch(async (req, res, next) => {
    return res.status(200).json({
        admin: true
    })
});

export {
    getAllUsers,
    getAllChats,
    getAllMessages,
    getDashboardStats,
    adminLogin,
    adminLogout,
    getAdminData
}