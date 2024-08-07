import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import { v4 as uuid } from "uuid";
import { getBase64, getSockets } from "../lib/helper.js";

const cookieOptions = {
    maxAge: 15 * 24 * 60 * 60 * 1000,
    sameSite: "none",
    httpOnly: true,
    secure: true
};

const sendToken = (res, user, code, message) => {

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

    user = Object.keys(user._doc).filter(key =>
        key !== 'password').reduce((obj, key) =>
        {
            obj[key] = user[key];
            return obj;
        }, {}
    );

    return res.status(code).cookie("chatterbox-token", token, cookieOptions).json({
        success: true,
        user,
        message
    })
}

const emitEvent = (req, event, users, data) => {

    const io = req.app.get("io");

    const usersSocket = getSockets(users);
    io.to(usersSocket).emit(event, data);
};

const getFileFormat = (url = "") => {

    const fileExt = url.split(".").pop();

    if (fileExt === "mp4" || fileExt === "webm" || fileExt === "ogg") {
        return "video";
    }

    if (fileExt === "mp3" || fileExt === "mpeg" || fileExt === "wav") return "audio";

    if (fileExt === "png" || fileExt === "jpg" || fileExt === "jpeg" || fileExt === "gif") {
        return "image";
    }

    return "file";
}


const uploadFilesToCloudinary = async (files = []) => {
    // Upload files to cloudinary

    const uploadPromises = files.map(file => {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload(
                getBase64(file),
                {
                    resource_type: "auto",
                    public_id: uuid(),
                    folder: "chatterbox"
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            )
        })
    })

    try {
        const results = await Promise.all(uploadPromises);
        const formattedResults = results.map(result => ({
            public_id: result.public_id,
            url: result.secure_url
        }))
        return formattedResults;

    } catch (error) {
        throw new Error("Error uploading files to cloudinary", error);
    }
};

const deleteFilesFromCloudinary = async (files= []) => {
    // Delete files from cloudinary
    try {
        const destroyPromises = files.map(file => {
            return new Promise((resolve, reject) => {

                const { id, fileType } = file;
                let resource_type = "image";

                if(fileType === "audio" || fileType === "video") {
                    resource_type = "video";
                } else if (fileType === "file") {
                    resource_type = "raw";
                }

                cloudinary.uploader.destroy(
                    id, 
                    { resource_type }, 
                    (error, result) => {
                        if(error) return reject(error);
                        resolve(result);
                })
            })
        })
        return destroyPromises;
    } catch (error) {
        throw new Error("Error deleting files from cloudinary", error);
    }
}

export {
    sendToken,
    cookieOptions,
    emitEvent,
    deleteFilesFromCloudinary,
    uploadFilesToCloudinary,
    getFileFormat
}