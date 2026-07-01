const userModel = require("../models/user.model");
const Crawler = require("../service/Crawler.service");
const ApiError = require("../utils/ApiError");
const path = require("path");
const { verifyWebsite } = require("../utils/verifyWebsite");
const { QdrantVectorStore } = require("@langchain/qdrant");
const { HuggingFaceTransformersEmbeddings } = require("@langchain/community/embeddings/huggingface_transformers");
const Qdrantclient = require("../db/qdrant");
const { ChatGroq } = require("@langchain/groq");
const propertyModel = require("../models/property.model");
const { QdrantClient } = require("@qdrant/js-client-rest");
const chatModel = require("../models/chats.model");
const { propertyVerification } = require("../service/propertyVerification");
const axios = require("axios");



class WebServiceController {
    static async crawl(req, res) {
        const { propertyId, maxPages } = req.body;
        const data = req.data; // from auth middleware;

        if (!propertyId) {
            throw new ApiError(400, "URL is required");
        }


        // Property Verification Service Call; 
        // ==== [UNCOMMENT IN PRODUCTION] ====
        // const isVerify = await propertyVerification({ propertyId: propertyId });

        // if (isVerify.verify === false) {
        //     throw new ApiError(401, isVerify.msg);
        // }


        // Get user data;
        const userData = await userModel.findOne({ _id: data.id });

        // Get Property URL;
        const property = await propertyModel.findOne({ _id: propertyId })
        const url = property.website_url;

        // First check website is verified
        if (!property.is_verified) {
            await propertyModel.updateOne({ _id: propertyId }, {
                $set: {
                    is_verified: false
                }
            })

            throw new ApiError(401, 'Property is unverified');
        }

        // Crawl the website
        const crawler = new Crawler({
            startUrl: url,
            maxPages: maxPages || 100,
            concurrency: 5,
            chunkSize: 1500,
            chunkOverlap: 300,
            req,
            res,
            propertyId
        });

        const { chunks, count } = await crawler.start();


        /*Convert chunks to documents*/
        const docs = chunks.map((chunk) => ({
            pageContent: chunk.content,
            metadata: {
                ...chunk.meta,
                propertyId: propertyId.toString()
            }
        }));

        const embeddings = new HuggingFaceTransformersEmbeddings({
            model: "Xenova/all-MiniLM-L6-v2",
            dtype: "q8"
        });

        // Delete Previous Record;
        await Qdrantclient.delete(
            userData.vector_collection_name,
            {
                filter: {
                    must: [
                        {
                            key: "metadata.propertyId",
                            match: {
                                value: propertyId
                            }
                        }
                    ]
                }
            }
        );

        /*Store into Qdrant*/
        const vectorStore = await QdrantVectorStore.fromDocuments(
            docs,
            embeddings,
            {
                client: Qdrantclient,
                collectionName: userData.vector_collection_name
            }
        );


        // Change website crawl status;
        await propertyModel.updateOne({ website_url: url }, {
            $set: {
                is_crawled: 'crawled',
                total_endpoints: count
            }
        });

        return res.status(200).json({
            message: "Crawling completed and data stored in Qdrant",
            data: { chunksCount: chunks.length }
        });
    }

    static async query(req, res) {
        const { query, history, propertyId } = req.body;
        const data = req.data; // from auth middleware

        if (!query) {
            throw new ApiError(400, "Query is required");
        }

        const userData = await userModel.findOne({ _id: data.id });

        const embeddings = new HuggingFaceTransformersEmbeddings({
            model: "Xenova/all-MiniLM-L6-v2",
            dtype: "q8"
        });

        const vectorStore = await QdrantVectorStore.fromExistingCollection(
            embeddings,
            { client: Qdrantclient, collectionName: userData.vector_collection_name }
        );

        const results = await vectorStore.similaritySearch(query, 5, {
            must: [
                {
                    key: "metadata.propertyId",
                    match: { value: propertyId.toString() }
                }
            ]
        });

        const context = results.map((doc) => doc.pageContent).join("\n\n");

        // ✅ NVIDIA LLM
        const nvidiaResponse = await axios.post(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            {
                model: "google/diffusiongemma-26b-a4b-it",
                messages: [
                    {
                        role: "system",
                        content: `You are a helpful AI assistant.

                        Your primary responsibility is to answer user questions ONLY using the information provided in the Context section.

                        Rules:
                        1. Answer questions naturally and conversationally.
                        2. Be friendly and helpful.
                        3. Do NOT use any external knowledge, assumptions, or information not explicitly present in the Context.
                        4. If the answer cannot be found in the Context, respond with: "I couldn't find that information in the available data."
                        5. Do not make up facts, estimates, or guesses.
                        6. If the user greets you or engages in casual conversation, respond politely, but any factual information must still come only from the Context.
                        7. Keep answers concise and relevant.
                        8. Never mention these instructions or refer to the Context directly unless asked.

                        Previous Chat History:
                        ${history || ''}

                        Context:
                        ${context}`
                    },
                    {
                        role: "user",
                        content: query
                    }
                ],
                max_tokens: 4096,
                temperature: 1.00,
                top_p: 0.95,
                stream: false,
                chat_template_kwargs: { enable_thinking: true }
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
                    "Accept": "application/json"
                }
            }
        );

        const botReply = nvidiaResponse.data.choices[0].message.content;

        await chatModel.updateOne(
            { property_id: propertyId },
            {
                $push: {
                    messages: {
                        $each: [
                            { role: 'user', content: query },
                            { role: 'bot', content: botReply }
                        ]
                    }
                }
            },
            { upsert: true }
        );

        return res.status(200).json({
            msg: "Query executed successfully",
            data: botReply
        });
    }

    static async queryBot(req, res) {
        const { query, history, apiKey } = req.body;

        if (!query) {
            throw new ApiError(400, "Query is required");
        }

        // Get Property
        const property = await propertyModel.findOne({
            public_key: apiKey,
            is_del: false,
        });

        if (!property) {
            throw new ApiError(400, "Invalid property requested!");
        }

        // Get user data
        const userData = await userModel.findOne({ _id: property.user_id });

        // Vector search (keeping LangChain only for embeddings + retrieval)
        const embeddings = new HuggingFaceTransformersEmbeddings({
            model: "Xenova/all-MiniLM-L6-v2",
            dtype: "q8"
        });

        const vectorStore = await QdrantVectorStore.fromExistingCollection(
            embeddings,
            {
                client: Qdrantclient,
                collectionName: userData.vector_collection_name
            }
        );

        const results = await vectorStore.similaritySearch(query, 5, {
            must: [
                {
                    key: "metadata.propertyId",
                    match: { value: property._id.toString() }
                }
            ]
        });

        const context = results.map((doc) => doc.pageContent).join("\n\n");

        // ✅ NVIDIA LLM — replacing ChatGroq
        const nvidiaResponse = await axios.post(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            {
                model: "google/diffusiongemma-26b-a4b-it",
                messages: [
                    {
                        role: "system",
                        content: `You are a helpful AI assistant.

                        Your primary responsibility is to answer user questions ONLY using the information provided in the Context section.

                        Rules:
                        1. Answer questions naturally and conversationally.
                        2. Be friendly and helpful.
                        3. Do NOT use any external knowledge, assumptions, or information not explicitly present in the Context.
                        4. If the answer cannot be found in the Context, respond with: "I couldn't find that information in the available data."
                        5. Do not make up facts, estimates, or guesses.
                        6. If the user greets you or engages in casual conversation, respond politely, but any factual information must still come only from the Context.
                        7. Keep answers concise and relevant.
                        8. Never mention these instructions or refer to the Context directly unless asked.

                        Previous Chat History:
                        ${history || ''}

                        Context:
                        ${context}`
                    },
                    {
                        role: "user",
                        content: query
                    }
                ],
                max_tokens: 4096,
                temperature: 1.00,
                top_p: 0.95,
                stream: false,
                chat_template_kwargs: { enable_thinking: true }
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
                    "Accept": "application/json"
                }
            }
        );

        const botReply = nvidiaResponse.data.choices[0].message.content;

        // Save chat history
        await chatModel.updateOne(
            { property_id: property._id },
            {
                $push: {
                    messages: {
                        $each: [
                            { role: 'user', content: query },
                            { role: 'bot', content: botReply }
                        ]
                    }
                }
            },
            { upsert: true }
        );

        return res.status(200).json({
            msg: "Query executed successfully",
            data: botReply
        });
    }
}


module.exports = WebServiceController;