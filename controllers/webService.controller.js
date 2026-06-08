const userModel = require("../models/user.model");
const Crawler = require("../service/Crawler.service");
const ApiError = require("../utils/ApiError");
const path = require("path");
const { verifyWebsite } = require("../utils/verifyWebsite");
const { QdrantVectorStore } = require("@langchain/qdrant");
const { HuggingFaceTransformersEmbeddings } = require("@langchain/community/embeddings/huggingface_transformers");
const Qdrantclient = require("../db/qdrant");
const { ChatGroq } = require("@langchain/groq");



class WebServiceController {
    static async crawl(req, res) {
        const { url, maxPages } = req.body;

        if (!url) {
            throw new ApiError(400, "URL is required");
        }

        // First check website is verified
        const isVerified = await verifyWebsite(url);
        if (!isVerified) {
            throw new ApiError(
                400,
                "Website is not verified. Please ensure ai_crawl.json is accessible at the root of the website."
            );
        }


        // Crawl the website
        const crawler = new Crawler({
            startUrl: url,
            maxPages: maxPages || 50,
            concurrency: 5,
            chunkSize: 1500,
            chunkOverlap: 300
        });

        const chunks = await crawler.start();


        /*Convert chunks to documents*/
        const docs = chunks.map((chunk) => ({
            pageContent: chunk.content,
            metadata: {
                ...chunk.meta
            }
        }));

        const embeddings = new HuggingFaceTransformersEmbeddings({
            model: "Xenova/all-MiniLM-L6-v2",
            dtype: "q8"
        });

        /*Store into Qdrant*/
        const vectorStore = await QdrantVectorStore.fromDocuments(
            docs,
            embeddings,
            {
                client: Qdrantclient,
                collectionName: "web-crawler"
            }
        );

        return res.status(200).json({
            message: "Crawling completed and data stored in Qdrant",
            data: { chunksCount: chunks.length }
        });

    }

    static async query(req, res) {
        const { query } = req.body;
        if (!query) {
            throw new ApiError(400, "Query is required");
        }

        const embeddings = new HuggingFaceTransformersEmbeddings({
            model: "Xenova/all-MiniLM-L6-v2",
            dtype: "q8"
        });
        const vectorStore = await QdrantVectorStore.fromExistingCollection(
            embeddings,
            {
                client: Qdrantclient,
                collectionName: "web-crawler"
            }
        );

        const results = await vectorStore.similaritySearch(query, 5);

        const context = results
            .map((doc) => doc.pageContent)
            .join("\n\n");

        const llm = new ChatGroq({
            apiKey: process.env.GROQ_API_KEY,
            model: "llama-3.1-8b-instant"
        });

        const response = await llm.invoke([
            ["system", "You are a helpful assistant."],
            ["user", `Based on the following context, answer the question: ${context}\n\nQuestion: ${query}`]
        ]);


        return res.status(200).json({
            message: "Query executed successfully",
            data: response.content
        });

    }
}


module.exports = WebServiceController;