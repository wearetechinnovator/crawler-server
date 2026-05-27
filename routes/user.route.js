const router = require("express").Router();
const UserController = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");



router
    .route("/signup")
    .post(UserController.createUser);

router
    .route("/login")
    .post(UserController.login);

router
    .route("/update")
    .patch(authMiddleware, UserController.updateUser);

router
    .route("/change-password")
    .patch(authMiddleware, UserController.changePassword);

router
    .route("/get-user{/:id}")
    .get(authMiddleware, UserController.getUser);




module.exports = router;