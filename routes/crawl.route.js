const router = require("express").Router();
const WebServiceController = require("../controllers/webService.controller");
const authMiddleware = require("../middlewares/auth.middleware");


router
    .route("/crawl")
    .post(WebServiceController.crawl);

router
    .route("/query")
    .post(WebServiceController.query);


module.exports = router;