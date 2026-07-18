const webhookModel = require("../models/webhook.model");
const webhookLogModel = require("../models/webhookLog.model");
const ApiError = require("../utils/ApiError");
const axios = require("axios");
const eventEmitter = require('../events/event');


class WebHookController {
    static async addHook(req, res) {
        const {
            webhook_name, description, status, webhook_url, http_method, payload_format,
            authentication_type, secret_token, signature_header_name, payload, header,
            propertyId, form_flow
        } = req.body;

        const data = req.data; // from auth middleware;

        if ([webhook_name, webhook_url, signature_header_name]
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
            authentication_type, secret_token, signature_header_name, payload, header, form_flow
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
            id, form_flow
        } = req.body;

        const data = req.data; // from auth middleware;

        if ([id, webhook_name, webhook_url, signature_header_name]
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
                authentication_type, secret_token, signature_header_name, payload, header, form_flow
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
        }).sort({ _id: -1 })

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

    static async getAllLog(req, res) {
        const { propertyId } = req.query;
        const page = req.query?.page || 1;
        const limit = req.query?.limit || 10;
        const skip = (Number(page) - 1) * Number(limit);

        const data = req.data; // from auth middleware;


        if (!propertyId) {
            throw new ApiError(401, "Property id is required.")
        }

        const logs = await webhookLogModel.find({
            user_id: data.id,
            property_id: propertyId,
        })
            .populate('webhook_id')
            .skip(skip)
            .limit(limit)
            .sort({ _id: -1 })


        return res.status(200).json({ data: logs });
    }

    static async webhookReport(req, res) {
        const { propertyId } = req.query;
        const data = req.data; // from auth middleware;

        if (!propertyId) {
            throw new ApiError(401, "Property id is required.")
        }

        /**
       * Report::
       * 1. Total Active Hooks
       * 2. Total Delivery
       * 3. Total Successfully Delivery
       * 4. Fail Delivery
       */

        // Get All Active Webhooks;
        const hooks = await webhookModel.find({
            property_id: propertyId,
            status: 'true'
        })

        // Get all logs
        const hookLogs = await webhookLogModel.find({
            property_id: propertyId
        })


        let { totalDelivery, successDelivery, failDelivery } = hookLogs.reduce((acc, i) => {
            if (i.status) acc.successDelivery += 1;
            if (!i.status) acc.failDelivery += 1;
            acc.totalDelivery += 1;

            return acc;
        }, { totalDelivery: 0, successDelivery: 0, failDelivery: 0 })


        let activeHooks = hooks.length;

        let successPercentage = (successDelivery / totalDelivery) * 100;
        let failPercentage = (failDelivery / totalDelivery) * 100;



        return res.status(200).json({
            totalDelivery,
            successDelivery,
            failDelivery,
            activeHooks,
            successPercentage,
            failPercentage
        });

    }

    static async callWebhook(req, res) {
        const { hook, result } = req.body;

        try {
            let headers = {};
            let body;

            if (hook.payload_format === "json") {
                headers["Content-Type"] = "application/json";
                body = {};
            }
            else if (hook.payload_format === "form_data") {
                body = new FormData();
            }


            //Authentication
            if (hook.authentication_type === "bearer_token") {
                headers["Authorization"] = `Bearer ${hook.secret_token}`;
            }

            if (hook.authentication_type === "signature") {
                headers[hook.signature_header_name] = hook.secret_token;
            }

            // Attach Fields;
            for (const field of hook.payload) {
                let value;
                if (result[field.field_name] !== undefined) {
                    value = result[field.field_name];
                } else {
                    value = field.default;
                }

                if (hook.payload_format === "json") {
                    body[field.field_name] = value;
                } else if (hook.payload_format === "form_data") {
                    body.append(field.field_name, value);
                }
            }


            // Attach Extranal headers;
            if (hook.header.length > 0) {
                let extraHeader = {};

                hook.header.forEach((h, _) => {
                    extraHeader[h.header_name] = h.header_value
                })

                headers = { ...headers, ...extraHeader }
            }

            const response = await axios({
                url: hook.webhook_url,
                method: hook.http_method,
                headers,
                data: body,
                validateStatus: () => true
            });

            eventEmitter.emit("webhook.executed", {
                hook,
                response
            })


            if (response.status < 200 || response.status >= 300) {
                return {
                    success: false,
                    status: response.status,
                    message: response.data?.message || response.statusText || "Request failed",
                };
            }


            return res.status(200).json({ data: response.data })

        } catch (err) {
            return res.status(500).json({ err: "Something went wrong" })
        }
    }
}


module.exports = WebHookController;