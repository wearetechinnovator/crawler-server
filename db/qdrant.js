const { QdrantClient } = require("@qdrant/js-client-rest");

const Qdrantclient = new QdrantClient({
    url: process.env.QDRANT_END_POINT,
    apiKey: process.env.QDRANT_API_KEY
});

module.exports = Qdrantclient;