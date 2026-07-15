const router = require("express").Router();
const authMiddleware = require("../middlewares/auth.middleware");
const WebhhookController = require("../controllers/webhook.controller");



router
    .route("/add-hook")
    .post(authMiddleware, WebhhookController.addHook);

router
    .route("/get-hook/:id")
    .get(authMiddleware, WebhhookController.getSingleHook);

router
    .route("/get-all-hook")
    .post(authMiddleware, WebhhookController.getAllHook);

router
    .route("/delete-hook/:id")
    .delete(authMiddleware, WebhhookController.deleteHook);

router
    .route("/update-hook")
    .patch(authMiddleware, WebhhookController.updateHook);

router
    .route("/get-logs")
    .get(authMiddleware, WebhhookController.getAllLog);


module.exports = router;