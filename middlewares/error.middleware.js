const errorMiddleware = (err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || "Something went wrong";

    if (process.env.NODE_ENV === "development") {
        console.error(err);
    }

    return res.status(status).json({ err: message })
}

module.exports = errorMiddleware;