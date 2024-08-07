import jwt from "jsonwebtoken";
import { ErrorHandle } from "../utils/utility.js";
import { adminSecretKey } from "../app.js";
import { User } from "../models/User.js";

const isAuthenticated = (req, res, next) => {

    const token = req.cookies["chatterbox-token"];

    if (!token) return next(new ErrorHandle("Please login first.", 401));

    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedData._id;

    next();
}

const isAdmin = (req, res, next) => {

    const token = req.cookies["chatterbox-admin-token"];

    if (!token) return next(new ErrorHandle("Only Admin can access this route", 401));

    const secretKey = jwt.verify(token, process.env.JWT_SECRET);

    const isMatched = secretKey === adminSecretKey;

    if (!isMatched) return next(new ErrorHandle("Only Admin can access this route", 401));

    next();
}

const socketAuthenticator = async (err, socket, next) => {

    try {
        if (err) return next(err);

        const authToken = socket.request.cookies["chatterbox-token"];

        if (!authToken) return next(new ErrorHandle("Please login first.", 401));

        const decodedData = jwt.verify(authToken, process.env.JWT_SECRET);
        const user = await User.findById(decodedData._id);

        if (!user) return next(new ErrorHandle("Socket Authentication Error", 401));

        socket.user = user;
        return next();
    } catch (error) {
        return next(error);
    }
}

export { isAuthenticated, isAdmin, socketAuthenticator }