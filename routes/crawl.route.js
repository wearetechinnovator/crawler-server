const router = require("express").Router();
const WebServiceController = require("../controllers/webService.controller");
const authMiddleware = require("../middlewares/auth.middleware");


router
    .route("/crawl")
    .post(authMiddleware, WebServiceController.crawl);

router
    .route("/query")
    .post(authMiddleware, WebServiceController.query);

router
    .route("/query-bot")
    .post(WebServiceController.queryBot);


module.exports = router;
