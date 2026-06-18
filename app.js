const path = require("path");
const express = require("express");
const errorMiddleware = require("./middlewares/error.middleware.js");
const routes = require("./routes/index.route");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true }))
app.use("/public", express.static(path.join(__dirname, "uploads")));


app.use("/api/v1", routes);
app.get("/ping", (req, res) => { res.json({ data: "PONG" }); }) //For testing purpose
app.use(errorMiddleware);


module.exports = app;