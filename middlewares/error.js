
const errorMiddleware = (err, req, res, next) => {
    err.message ||= "Internal Server Error";
    err.statusCode ||= 500;

    if(err.code === 11000) {
        err.message = `Duplicate field - ${Object.keys(err.keyPattern).join(", ")}`;
        err.statusCode = 400;
    }

    if(err.name === "CastError"){
        err.message = `Invalid format of ${err.path}`;
        err.statusCode = 400;
    }

    return res.status(err.statusCode).json({
        success: false,
        message: err.message
    })
}

const TryCatch = (passedFunc) => async(req, res, next) => {

    try {
        await passedFunc(req, res, next);
    } catch (error) {
        return next(error);
    }
}

export { errorMiddleware, TryCatch }