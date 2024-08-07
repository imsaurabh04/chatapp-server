import express from "express";
import connectDb from "./middlewares/connectDb.js";
import dotenv from "dotenv";
import { errorMiddleware } from "./middlewares/error.js";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";

import { 
    CHAT_JOINED,
    CHAT_LEAVED,
    NEW_MESSAGE, 
    NEW_MESSAGE_ALERT, 
    ONLINE_USERS, 
    START_TYPING,
    STOP_TYPING
} from "./constants/events.js";
import { v4 as uuid } from "uuid";
import { getSockets } from "./lib/helper.js";
import { Message } from "./models/Message.js";
import { socketAuthenticator } from "./middlewares/auth.js";
import { corsOptions } from "./constants/config.js";

import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config({
    path: "./.env"
});

const mongoUri = process.env.MONGO_URI;
const port = process.env.PORT || 3000;
const adminSecretKey = process.env.DASHBOARD_SECRET_KEY;

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

//set an instance of io to app
app.set("io", io);

const userSocketIDs = new Map();
const onlineUsers = new Set();

// middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));

// connected to db
connectDb(mongoUri);
// configure cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

app.get("/", (req, res) => {
    res.send("Hello world")
})

// routes
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/admin", adminRoutes);

io.use((socket, next) => {
    cookieParser()(
        socket.request,
        socket.request.res,
        async(err) => await socketAuthenticator(err, socket, next)
    )
});

io.on("connection", (socket)=> {

    const user = socket.user;
    userSocketIDs.set(user._id.toString(), socket.id);
    
    socket.on(NEW_MESSAGE, async({chatId, members, message}) => {

        const messageForRealTime = {
            content: message,
            _id: uuid(),
            sender: {
                _id: user._id,
                name: user.name
            },
            chat: chatId,
            createdAt: new Date().toISOString()
        }
        const messageForDB = {
            content: message,
            sender: user._id,
            chat: chatId
        }
        
        const membersSocket = getSockets(members);
        io.to(membersSocket).emit(NEW_MESSAGE, {
            chatId,
            message: messageForRealTime
        })
        io.to(membersSocket).emit(NEW_MESSAGE_ALERT, { chatId });

        try {
            await Message.create(messageForDB);
        } catch (error) {
            throw new Error(error);
        }
    })

    socket.on(START_TYPING, ({members, chatId}) => {

        const membersSocket = getSockets(members);
        socket.to(membersSocket).emit(START_TYPING, { chatId });
    })

    socket.on(STOP_TYPING, ({members, chatId}) => {

        const membersSocket = getSockets(members);
        socket.to(membersSocket).emit(STOP_TYPING, { chatId });
    })

    socket.on(CHAT_JOINED, ({ userId, members }) => {
        onlineUsers.add(userId.toString());

        const membersSocket = getSockets(members);
        io.to(membersSocket).emit(ONLINE_USERS, Array.from(onlineUsers));
    });

    socket.on(CHAT_LEAVED, ({ userId, members }) => {
        onlineUsers.delete(userId.toString());

        const membersSocket = getSockets(members);
        io.to(membersSocket).emit(ONLINE_USERS, Array.from(onlineUsers));
    });

    socket.on("disconnect", () => {
        userSocketIDs.delete(user._id.toString());
        onlineUsers.delete(user._id.toString());
        socket.broadcast.emit(ONLINE_USERS, Array.from(onlineUsers));
    })
})

// error middleware
app.use(errorMiddleware);

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})

export {
    adminSecretKey,
    userSocketIDs
}