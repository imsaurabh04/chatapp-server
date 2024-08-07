
class ErrorHandle extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode
    }
}

export { ErrorHandle };