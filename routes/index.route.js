const router = require("express").Router();
const userRoutes = require("./user.route");
const crawlRoutes = require("./crawl.route");
const propertyRoutes = require("./property.route");




router.use("/users", userRoutes);
router.use("/properties", propertyRoutes);
router.use("/web", crawlRoutes);


module.exports = router;