import { getOtherMember } from "../lib/helper.js";
import { TryCatch } from "../middlewares/error.js";
import { deleteFilesFromCloudinary, emitEvent, getFileFormat, uploadFilesToCloudinary } from "../utils/features.js";
import { ErrorHandle } from "../utils/utility.js";
import { v4 as uuid } from "uuid";

import {
    ALERT,
    NEW_MESSAGE,
    NEW_MESSAGE_ALERT,
    REFETCH_CHATS,
    REFETCH_GROUPS
} from "../constants/events.js";

import { Chat } from "../models/Chat.js";
import { User } from "../models/User.js";
import { Message } from "../models/Message.js";

const newGroupChat = TryCatch(async (req, res, next) => {
    const { name, members } = req.body;

    const allMembers = [...members, req.user];

    const existsGroup = await Chat.findOne({ name, creator: req.user });
    if(existsGroup) return next(new ErrorHandle("This group name already exists please choose another.", 400));

    const newGroup = await Chat.create({
        name,
        groupChat: true,
        creator: req.user,
        members: allMembers
    })

    emitEvent(req, ALERT, allMembers, { chatId: newGroup._id, message: `Welcome to ${name} group` });
    emitEvent(req, REFETCH_CHATS, members);

    return res.status(201).json({
        success: true,
        message: "Group created successfully."
    })
});

const getMyChats = TryCatch(async (req, res, next) => {

    const chats = await Chat.find({ members: req.user })
        .populate("members", "avatar name");

    const transformedChats = chats.map(({ _id, name, groupChat, members }) => {

        const otherMember = getOtherMember(members, req.user);

        return ({
            _id,
            groupChat,
            avatar: groupChat ? members.map(({ avatar }) => avatar.url) : [otherMember.avatar.url],
            name: groupChat ? name : otherMember.name,
            members: members.reduce((prev, curr) => {
                if (curr._id.toString() !== req.user.toString()) {
                    prev.push(curr._id);
                }
                return prev;
            }, [])
        })
    })

    return res.status(200).json({
        success: true,
        chats: transformedChats
    })

});

const getMyGroups = TryCatch(async (req, res, next) => {

    const myGroups = await Chat.find({
        members: req.user,
        groupChat: true,
        creator: req.user
    }).populate("members", "avatar name");

    const transformedMyGroups = myGroups.map(({ _id, name, groupChat, members }) => (
        {
            _id,
            name,
            groupChat,
            avatar: members.map(({ avatar }) => avatar.url)
        }
    ))

    return res.status(200).json({
        success: true,
        groups: transformedMyGroups
    })
});

const addMembers = TryCatch(async (req, res, next) => {

    const { groupId, members } = req.body;

    const group = await Chat.findById(groupId);

    if (!group) return next(new ErrorHandle("Group Not Found", 404));

    if (!group.groupChat) {
        return next(new ErrorHandle("This is not a group chat", 400));
    }

    if (group.creator.toString() !== req.user.toString()) {
        return next(new ErrorHandle("You are not allowed to add members", 403));
    }

    const allNewMembersPromise = members.map(i => (
        User.findById(i, "name")
    ));
    const allNewMembers = await Promise.all(allNewMembersPromise);

    const uniqueMembers = [];
    for (const member of allNewMembers) {
        if (group.members.includes(member._id.toString())) {
            return next(new ErrorHandle(`${member.name} is already a member of this group`, 400));
        } else {
            uniqueMembers.push(member._id);
        }
    }

    group.members.push(...uniqueMembers);

    if (group.members.length > 100)
        return next(new ErrorHandle("Group members limit reached.", 400));

    await group.save();

    const allUsersName = allNewMembers.map(i => i.name).join(",");

    emitEvent(
        req,
        ALERT,
        group.members,
        { chatId: groupId, message: `${allUsersName} has been added to ${group.name} group.` }
    )
    emitEvent(
        req,
        REFETCH_CHATS,
        group.members
    )

    res.status(200).json({
        success: true,
        message: "Members added successfully"
    })
});

const removeMember = TryCatch(async (req, res, next) => {
    const { groupId, userId } = req.body;

    const [group, userThatWillBeRemoved] = await Promise.all([
        Chat.findById(groupId),
        User.findById(userId, "name")
    ])

    if (!group) return next(new ErrorHandle("Group Not Found", 404));

    if (!group.groupChat) {
        return next(new ErrorHandle("This is not a group chat", 400));
    }

    if (group.creator.toString() !== req.user.toString()) {
        return next(new ErrorHandle("You are not allowed to remove members", 403));
    }

    if (group.members.length <= 3)
        return next(new ErrorHandle("Group must have at least 3 members", 400));

    const allGroupMembers = group.members.map(i => i.toString());

    const remainingMembers = group.members.filter(
        memberId => memberId.toString() !== userId.toString()
    );

    if (group.creator.toString() === userId.toString()) {

        const randomMember = Math.floor(Math.random() * remainingMembers.length);
        const newCreator = remainingMembers[randomMember];
        group.creator = newCreator;
    }

    group.members = remainingMembers;
    await group.save();

    emitEvent(
        req,
        ALERT,
        group.members,
        { chatId: groupId, message: `${userThatWillBeRemoved.name} has been removed from the group.` }
    );
    emitEvent(req, REFETCH_CHATS, allGroupMembers);

    return res.status(200).json({
        success: true,
        message: "Member removed successfully."
    })
});

const leaveGroup = TryCatch(async (req, res, next) => {
    const groupId = req.params.id;

    const group = await Chat.findById(groupId);

    if (!group) return next(new ErrorHandle("Group Not Found", 404));

    if (!group.groupChat) {
        return next(new ErrorHandle("This is not a group chat", 400));
    }

    const remainingMembers = group.members.filter(memberId => memberId.toString() !== req.user.toString());

    if (remainingMembers.length < 3) {
        return next(new ErrorHandle("Group must have at least 3 members", 400));
    }

    if (group.creator.toString() === req.user.toString()) {

        const randomMember = Math.floor(Math.random() * remainingMembers.length);
        const newCreator = remainingMembers[randomMember];
        group.creator = newCreator;
    }

    group.members = remainingMembers;

    const [user] = await Promise.all([
        User.findById(req.user, "name"),
        group.save()]);

    emitEvent(
        req,
        ALERT,
        group.members,
        { chatId: groupId, message: `User ${user.name} has left the group.` }
    );

    emitEvent(
        req,
        REFETCH_CHATS,
        group.members
    )

    emitEvent(
        req,
        REFETCH_GROUPS,
        group.members
    )

    res.status(200).json({
        success: true,
        message: "You have successfully left the group"
    })
});

const sendAttachments = TryCatch(async (req, res, next) => {

    const { chatId } = req.body;

    const files = req.files || [];
    
    if (files.length < 1) return next(new ErrorHandle("Please provide attachments", 400));
    if(files.length > 5) return next(new ErrorHandle("Attachments must be 1-5", 400));

    const [chat, me] = await Promise.all([
        Chat.findById(chatId),
        User.findById(req.user, "name")
    ]);

    if (!chat) return next(new ErrorHandle("Chat Not Found", 404));

    const attachments = await uploadFilesToCloudinary(files);

    const messageForDb = {
        content: "",
        attachments,
        sender: me._id,
        chat: chatId
    };

    const messageForRealTime = {
        ...messageForDb,
        sender: {
            _id: me._id,
            name: me.name
        },
        _id: uuid()
    };

    const message = await Message.create(messageForDb);

    emitEvent(
        req,
        NEW_MESSAGE,
        chat.members,
        {
            message: messageForRealTime,
            chatId
        }
    )
    emitEvent(
        req,
        NEW_MESSAGE_ALERT,
        chat.members,
        {
            chatId
        }
    )

    res.status(200).json({
        success: true,
        message
    })
});

const getChatDetails = TryCatch(async (req, res, next) => {

    const chatId = req.params.id;

    if (req.query.populate === "true") {

        const chat = await Chat.findById(chatId).populate("members", "name avatar").lean();

        if (!chat) return next(new ErrorHandle("Chat Not Found", 404));

        chat.members = chat.members.map(({_id, name, avatar}) => (
            {
                _id,
                name,
                avatar: avatar.url
            }
        ));

        res.status(200).json({
            success: true,
            chat
        })

    } else {
        const chat = await Chat.findById(chatId)

        if (!chat) return next(new ErrorHandle("Chat Not Found", 404));

        res.status(200).json({
            success: true,
            chat
        })
    }
});

const renameGroup = TryCatch(async(req, res, next) => {

    const groupId = req.params.id;
    const { name } = req.body;

    const group = await Chat.findById(groupId);

    if (!group) return next(new ErrorHandle("Group Not Found", 404));

    if (!group.groupChat) {
        return next(new ErrorHandle("This is not a group chat", 400));
    }

    if (group.creator.toString() !== req.user.toString()) {
        return next(new ErrorHandle("You are not allowed to rename the group", 403));
    }

    group.name = name;
    await group.save();

    emitEvent(
        req,
        REFETCH_CHATS,
        group.members
    )

    res.status(200).json({
        success: true,
        message: "Group renamed successfully"
    })
});

const deleteChat = TryCatch(async(req, res, next) => {

    const chatId = req.params.id;

    const chat = await Chat.findById(chatId);
    
    if (!chat) return next(new ErrorHandle("Chat Not Found", 404));

    const members = chat.members;

    if(chat.groupChat && chat.creator.toString() !== req.user.toString()) {
        return next (new ErrorHandle("You are not allowed to delete the group", 403));
    }

    if(!chat.groupChat && !chat.members.includes(req.user.toString())) {
        return next (new ErrorHandle("You are not allowed to delete the chat", 403));
    }

    const messagesWithAttachments = await Message.find({
        chat: chatId,
        attachments: { $exists: true, $ne: [] }
    })

    const files = [];

    messagesWithAttachments.forEach(({ attachments }) => {
        attachments.forEach(({ public_id, url }) => {
            const item = {
                id: public_id,
                fileType: getFileFormat(url)
            }
            files.push(item)
        })
    })

    await Promise.all([
        deleteFilesFromCloudinary(files),
        chat.deleteOne(),
        Message.deleteMany({ chat: chatId })
    ])

    emitEvent(
        req,
        REFETCH_CHATS,
        members
    )

    res.status(200).json({
        success: true,
        message: "Chat deleted successfully"
    })
});

const getMessages = TryCatch(async(req, res, next) => {

    const chatId = req.params.id;
    const { page = 1 } = req.query;

    const chat = await Chat.findById(chatId);

    if(!chat) return next(new ErrorHandle("Chat not found", 404));

    if(!chat.members.includes(req.user.toString())) {
        return next(new ErrorHandle("You are not allowed to access this chat", 403));
    }

    const resultPerPage = 20;

    const [messages, totalMessagesCount] = await Promise.all([
        Message.find({ chat: chatId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * resultPerPage)
        .limit(resultPerPage)
        .populate("sender", "name")
        .lean(),
        Message.countDocuments({ chat: chatId })
    ])

    const totalPages = Math.ceil(totalMessagesCount / resultPerPage);

    res.status(200).json({
        success: true,
        messages: messages.reverse(),
        totalPages
    })
});

export {
    newGroupChat,
    getMyChats,
    getMyGroups,
    addMembers,
    removeMember,
    leaveGroup,
    sendAttachments,
    getChatDetails,
    renameGroup,
    deleteChat,
    getMessages
}