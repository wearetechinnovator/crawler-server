const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");


const authMiddleware = async (req, res, next) => {
    try {
        const METHOD = req.method;
        let TOKEN;

        // Check GET or POST method;
        if (METHOD === "GET") {
            TOKEN = req.headers['x-crawler'];
        } else {
            TOKEN = req.body.token;
        }

        if (!TOKEN) throw new ApiError(401, "No Token Provided");


        // Check token is valid or not;
        const decoded = jwt.verify(TOKEN, process.env.JWT_SECRET);
        if (!decoded) {
            throw new ApiError(401, "Unauthorized users");
        }

        req.data = decoded;

        next();
    } catch (error) {
        throw new ApiError(401, "Unauthorized users");
    }

}

module.exports = authMiddleware;