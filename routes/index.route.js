const router = require("express").Router();
const userRoutes = require("./user.route");
const crawlRoutes = require("./crawl.route");
const propertyRoutes = require("./property.route");
const webhookRoutes = require("./webhook.route");




router.use("/users", userRoutes);
router.use("/properties", propertyRoutes);
router.use("/web", crawlRoutes);
router.use("/web-hook", webhookRoutes);

router.get("/", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    res.write(`data: Connected\n\n`);

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    const keepAlive = setInterval(() => send({ ping: Date.now() }), 1000);

    req.on("close", () => {
        clearInterval(keepAlive);
        res.end();
    });
});


module.exports = router;