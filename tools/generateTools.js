const webhookModel = require("../models/webhook.model");
const { tool } = require("@langchain/core/tools");
const { z } = require('zod');
const { executeWebhook } = require("../service/executeWebhooks");


const generateTools = async ({ propertyId }) => {
    // Build dynamic Schema
    function buildZodSchema(payload) {
        const shape = {};

        for (const field of payload) {
            let schema;

            switch (field.type.toLowerCase()) {
                case "string":
                    schema = z.string();
                    break;

                case "number":
                    schema = z.number();
                    break;

                default:
                    schema = z.any();
            }

            // Default value
            if (
                field.default !== undefined &&
                field.default !== null &&
                field.default !== ""
            ) {
                schema = schema.default(field.default);
            }

            // Optional
            if (field.is_required.toLowerCase() !== "yes") {
                schema = schema.optional();
            }

            shape[field.field_name] = schema;
        }

        return z.object(shape);
    }


    // Get Webhooks;
    const webhooks = await webhookModel.find({
        property_id: propertyId,
        is_del: false,
        status: 'true'
    });

    // Generate Dynamic Tools
    const toolsArr = webhooks.map((hook, _) => {
        const schema = buildZodSchema(hook.payload);

        return tool(
            async (input) => {
                let res = await executeWebhook({
                    hook,
                    inputs: input,
                });

                return res;
            },
            {
                name: hook.webhook_name.replace(/\s+/g, ""),
                description: hook.description,
                schema
            }
        )
    })

    return toolsArr;
}

module.exports = {
    generateTools
}