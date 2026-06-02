const router = require("express").Router();
const authMiddleware = require("../middlewares/auth.middleware");
const PropertyController = require("../controllers/property.controller");



router
    .route("/add-properties")
    .post(authMiddleware, PropertyController.addProperty);

router
    .route("/get-properties/:id")
    .get(authMiddleware, PropertyController.getProperties);

router
    .route("/get-all-properties")
    .get(authMiddleware, PropertyController.getAllProperties);

router
    .route("/get-property-verification/:id")
    .get(authMiddleware, PropertyController.downloadVerificationFile);

router
    .route("/check-property-verification")
    .post(authMiddleware, PropertyController.checkVerification);

router
    .route("/delete-property/:id")
    .delete(authMiddleware, PropertyController.deleteProperty);


module.exports = router;