const webhookModel = require("../models/webhook.model");
const ApiError = require("../utils/ApiError");


class WebHookController {
    static async addHook(req, res) {
        const {
            webhook_name, description, status, webhook_url, http_method, payload_format,
            authentication_type, secret_token, signature_header_name, payload, header,
            propertyId
        } = req.body;

        const data = req.data; // from auth middleware;

        if ([webhook_name, webhook_url, secret_token, signature_header_name]
            .some((field) => !field || field === "")) {
            throw new ApiError(400, "required fields are empty");
        }

        if (!payload || payload.length === 0) {
            throw new ApiError(400, "At least one payload is required");
        }


        // Check existance;
        const isExist = await webhookModel.findOne({ webhook_name });

        if (isExist) {
            throw new ApiError(409, "Webhook already exist");
        }


        // Insert Data
        const insert = await webhookModel.create({
            user_id: data.id, property_id: propertyId,
            webhook_name, description, status, webhook_url, http_method, payload_format,
            authentication_type, secret_token, signature_header_name, payload, header
        })

        if (!insert) {
            throw new ApiError(500, "Webhook creation failed!");
        }

        return res.status(200).json({
            msg: 'Webhook create successfully',
            data: insert
        });
    }

    static async updateHook(req, res) {
        const {
            webhook_name, description, status, webhook_url, http_method, payload_format,
            authentication_type, secret_token, signature_header_name, payload, header,
            id
        } = req.body;

        const data = req.data; // from auth middleware;

        if ([id, webhook_name, webhook_url, secret_token, signature_header_name]
            .some((field) => !field || field === "")) {
            throw new ApiError(400, "required fields are empty");
        }

        if (!payload || payload.length === 0) {
            throw new ApiError(400, "At least one payload is required");
        }


        // Check existance;
        const isExist = await webhookModel.findOne({
            webhook_name,
            _id: {
                $ne: id
            }
        });

        if (isExist) {
            throw new ApiError(409, "Webhook already exist");
        }


        // Update Data
        const update = await webhookModel.updateOne({ _id: id }, {
            $set: {
                webhook_name, description, status, webhook_url, http_method, payload_format,
                authentication_type, secret_token, signature_header_name, payload, header
            }
        })

        if (update.modifiedCount === 0) {
            throw new ApiError(500, "Webhook not update");
        }

        return res.status(200).json({ msg: "Webhook update successfully" });
    }

    static async getAllHook(req, res) {
        const { propertyId } = req.body;
        const data = req.data; // from auth middleware;

        if (!propertyId) {
            throw new ApiError(401, "Invalid Property id")
        }

        const webhooks = await webhookModel.find({
            property_id: propertyId,
            is_del: false
        }).sort({_id: -1})

        return res.status(200).json({ data: webhooks });

    }

    static async getSingleHook(req, res) {
        const { id } = req.params;
        const data = req.data; // from auth middleware;

        if (!id) {
            throw new ApiError(401, "Invalid id")
        }

        const webhook = await webhookModel.findOne({
            _id: id,
            is_del: false
        })

        return res.status(200).json({ data: webhook });
    }

    static async deleteHook(req, res) {
        const { id } = req.params;
        const data = req.data; // from auth middleware;

        if (!id) {
            throw new ApiError(401, "Invalid id")
        }

        const webhook = await webhookModel.updateOne({ _id: id }, {
            $set: {
                is_del: true
            }
        })

        if (webhook.modefiedCount === 0) {
            throw new ApiError(500, "Webhook not delete");
        }

        return res.status(200).json({
            msg: "Webhook delete successfully"
        });
    }
}


module.exports = WebHookController;