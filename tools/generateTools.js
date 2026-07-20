const { z } = require('zod');
const { tool } = require("@langchain/core/tools");
const webhookModel = require("../models/webhook.model");
const { tempCache } = require("../db/tempCache");



const generateTools = async ({ propertyId, req, res }) => {
    // Get Webhooks;
    const webhooks = await webhookModel.find({
        property_id: propertyId,
        is_del: false,
        status: 'true'
    });

    // Generate Dynamic Tools
    const toolsArr = webhooks.map((hook, _) => {
        return tool(
            async () => {
                tempCache.set(propertyId, hook);
                return "Form Generating...";
            },
            {
                name: hook.webhook_name.replace(/\s+/g, ""),
                description: hook.description,
                schema: z.object({})
            }
        )
    })

    return toolsArr;
}

module.exports = {
    generateTools
}