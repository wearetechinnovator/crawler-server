const router = require('express').Router();
const authMiddleware = require("../middlewares/auth.middleware");
const WidgetController = require("../controllers/widget.controller");


router
    .route("/update-settings")
    .patch(authMiddleware, WidgetController.updateSetting);

router
    .route("/get-settings/:propertyId")
    .get(authMiddleware, WidgetController.getSetting);


module.exports = router;
