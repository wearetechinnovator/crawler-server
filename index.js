//|=========== [Radhe Radhe] ============|
//|:::::::: JAY JAGANNATH 0!!0 ::::::::::|
//|======================================|
require("dotenv").config();
const { createServer } = require("http");
const connection = require("./db/connection");
const app = require("./app");


const PORT = process.env.PORT || 8080;
const httpServer = createServer(app);


connection().then(con => {
    if (con) {
        httpServer.listen(PORT, () => {
            console.log("[*] Database Run");
            console.log("[*] Server Running on " + PORT);
        })
    } else {
        console.log("[*] Database Connection Failed");
    }
}).catch(err => {
    console.log("[*] Something went wrong: ", err);
})