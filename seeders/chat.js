import { faker, simpleFaker } from "@faker-js/faker";

import { Chat } from "../models/Chat.js";
import { User } from "../models/User.js"
import { Message } from "../models/Message.js";

const createSingleChats = async(numChats) => {
    try {
        const users = await User.find().select("_id");

        const chatsPromise = [];
        let count = 0;

        for (let i = 0; i < users.length; i++) {
            for (let j = i+1; j < users.length; j++) {
                if(count >= numChats) {
                    break;
                }
                chatsPromise.push(
                    Chat.create({
                        name: faker.lorem.words(2),
                        members: [ users[i], users[j] ]
                    })
                )
                count++;
            }
            if(count >= numChats) {
                break;
            }
        }

        await Promise.all(chatsPromise);
        console.log("Single chats created successfully.");
        process.exit(1);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

const createGroupChats = async(numChats) => {
    try {
        const users = await User.find().select("_id");

        const chatsPromise = [];

        for (let i = 0; i < numChats; i++) {
            const numMembers = simpleFaker.number.int({ min: 3, max: users.length })
            const members = [];

            for (let i = 0; i < numMembers; i++) {
                const randomIndex = Math.floor(Math.random() * users.length);
                const randomUser = users[randomIndex];
                
                if(!members.includes(randomUser)) {
                    members.push(randomUser);
                }
            }

            if(members.length >= 3) {
                chatsPromise.push(
                    Chat.create({
                        name: faker.lorem.words(2),
                        groupChat: true,
                        members,
                        creator: members[0]
                    })
                )
            }
        }

        await Promise.all(chatsPromise);
        console.log("Group chats created successfully", chatsPromise.length);
        process.exit(1);
        
    } catch (error) {
        console.log(error);
        process.exit(1);
    }

}

const createMessages = async(numMessages) => {
    try {
        const users = await User.find().select("_id");
        const chats = await Chat.find().select("_id");

        const messagesPromise = [];

        for (let i = 0; i < numMessages; i++) {
            
            const randomUser = users[Math.floor(Math.random() * users.length)];
            const randomChat = chats[Math.floor(Math.random() * chats.length)];

            messagesPromise.push(
                Message.create({
                    chat: randomChat,
                    sender: randomUser,
                    content: faker.lorem.sentence(5)
                })
            )
        }
        await Promise.all(messagesPromise);
        console.log("Messages created successfully.");
        process.exit(1);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

const createMessagesInAChat = async(chatId, numMessages) => {
    try {
        const users = await User.find().select("_id");

        const messagesPromise = [];

        for (let i = 0; i < numMessages; i++) {
            
            const randomUser = users[Math.floor(Math.random() * users.length)];

            messagesPromise.push(
                Message.create({
                    chat: chatId,
                    sender: randomUser,
                    content: faker.lorem.sentence(5)
                })
            )
        }
        await Promise.all(messagesPromise);
        console.log("Messages created successfully.");
        process.exit(1);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

export {
    createSingleChats,
    createGroupChats,
    createMessages,
    createMessagesInAChat
}