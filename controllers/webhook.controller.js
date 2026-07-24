const webhookModel = require("../models/webhook.model");
const webhookLogModel = require("../models/webhookLog.model");
const ApiError = require("../utils/ApiError");
const axios = require("axios");
const eventEmitter = require('../events/event');
const { fileTypeFromBuffer } = require("file-type")


class WebHookController {
    static async addHook(req, res) {
        const {
            webhook_name, description, status, webhook_url, http_method, payload_format,
            authentication_type, secret_token, signature_header_name, payload, header,
            propertyId, form_flow, file_type, file_size, min_date, max_date, max_len, min_len
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
            id, form_flow, file_type, file_size, min_date, max_date, max_len, min_len
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
            successPercentage: Math.ceil(successPercentage),
            failPercentage: Math.ceil(failPercentage)
        });

    }

    static async callWebhook(req, res) {
        const { hook, result } = req.body;

        try {
            let headers = {};
            let body;
            const payload = hook.payload || [];


            // #region ----Hook validation----
            if (!payload || payload.length < 1) {
                return res.status(422).json({ err: "Invalid data" });
            }

            for (const f of payload) {
                const value = result[f.field_name];

                // Required validation
                if (f.is_required === "yes") {
                    const isEmpty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
                    if (isEmpty) {
                        return res.status(422).json({ err: `${f.field_label} is required` });
                    }
                }

                // Skip remaining validation if field is empty and not required
                if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
                    continue;
                }

                switch (f.type) {
                    case "text":
                    case "number":
                        if (f.max_len && String(value).length > Number(f.max_len)) {
                            return res.status(422).json({
                                err: `${f.field_label} must not exceed ${f.max_len} characters`
                            });
                        }

                        if (f.min_len && String(value).length < Number(f.min_len)) {
                            return res.status(422).json({
                                err: `${f.field_label} must be at least ${f.min_len} characters`
                            });
                        }

                        break;

                    case "date": {
                        const d = new Date(value);

                        if (f.min_date && d < new Date(f.min_date)) {
                            return res.status(422).json({
                                err: `${f.field_label} must be after ${f.min_date}`
                            });
                        }

                        if (f.max_date && d > new Date(f.max_date)) {
                            return res.status(422).json({
                                err: `${f.field_label} must be before ${f.max_date}`
                            });
                        }

                        break;
                    }

                    case "date-time": {
                        const dt = new Date(value);

                        if (f.min_date && dt < new Date(f.min_date)) {
                            return res.status(422).json({
                                err: `${f.field_label} must be after ${f.min_date}`
                            });
                        }

                        if (f.max_date && dt > new Date(f.max_date)) {
                            return res.status(422).json({
                                err: `${f.field_label} must be before ${f.max_date}`
                            });
                        }

                        break;
                    }

                    case "time":
                        if (f.min_time && value < f.min_time) {
                            return res.status(422).json({
                                err: `${f.field_label} must be after ${f.min_time}`
                            });
                        }

                        if (f.max_time && value > f.max_time) {
                            return res.status(422).json({
                                err: `${f.field_label} must be before ${f.max_time}`
                            });
                        }
                        break;

                    case "select":
                    case "radio":
                        if (f.set_of_value?.length && !f.set_of_value.includes(value)) {
                            return res.status(422).json({ err: `Invalid ${f.field_label}` });
                        }

                        break;

                    case "multi-select":
                    case "checkbox":
                        if (!Array.isArray(value)) {
                            return res.status(422).json({ err: `${f.field_label} must be an array` });
                        }

                        if (f.set_of_value?.length) {
                            const invalid = value.find((v) => !f.set_of_value.includes(v));

                            if (invalid) {
                                return res.status(422).json({
                                    err: `${invalid} is not a valid ${f.field_label}`
                                });
                            }
                        }
                        break;

                    case "file": {
                        if (!value) break;

                        const fileName = result[`${f.field_name}_name`];
                        const fileMimeType = result[`${f.field_name}_mimetype`]?.toLowerCase();
                        const fileExt = result[`${f.field_name}_ext`]?.toLowerCase();

                        // Validate Base64
                        const matches = value.match(/^data:(.+);base64,(.+)$/);

                        if (!matches) {
                            return res.status(422).json({ err: `${f.field_label} is not a valid file` });
                        }

                        const base64 = matches[2];
                        const buffer = Buffer.from(base64, "base64");

                        // Detect actual file type from binary
                        const detected = await fileTypeFromBuffer(buffer);

                        if (!detected) {
                            return res.status(422).json({
                                err: `${f.field_label} has an unsupported or invalid file`
                            });
                        }

                        // Normalize jpg/jpeg
                        const normalize = (type) => {
                            if (!type) return type;
                            return type.toLowerCase() === "jpeg" ? "jpg" : type.toLowerCase();
                        };

                        const detectedExt = normalize(detected.ext);
                        const detectedMime = detected.mime.toLowerCase();


                        if (fileExt && detectedExt !== normalize(fileExt)) {
                            return res.status(422).json({
                                err: `${f.field_label} extension mismatch`
                            });
                        }

                        // Allowed types
                        if (f.file_type) {
                            const allowedTypes = f.file_type
                                .split(",")
                                .map(t => normalize(t.trim()));

                            if (!allowedTypes.includes(detectedExt)) {
                                return res.status(422).json({
                                    err: `${f.field_label} must be one of: ${allowedTypes.join(", ")}`
                                });
                            }
                        }

                        // Size validation
                        if (f.file_size) {
                            const maxSizeKB = Number(f.file_size);
                            const sizeKB = buffer.length / 1024;

                            if (sizeKB > maxSizeKB) {
                                return res.status(422).json({
                                    err: `${f.field_label} must not exceed ${maxSizeKB} KB`
                                });
                            }
                        }

                        break;
                    }
                }
            }


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
                let filename;

                if (result[field.field_name] !== undefined) {
                    value = result[field.field_name];
                    filename = result[`${field.field_name}_name`]
                } else {
                    value = field.default;
                }

                if (hook.payload_format === "json") {
                    body[field.field_name] = value;
                } else if (hook.payload_format === "form_data") {
                    if (field.type === "file" && value) {
                        const matches = value.match(/^data:(.+);base64,(.+)$/);

                        if (!matches) {
                            throw new Error("Invalid Base64 Image");
                        }

                        const mimeType = matches[1];
                        const base64Data = matches[2];
                        const buffer = Buffer.from(base64Data, "base64");

                        body.append(field.field_name, buffer, {
                            filename: filename,
                            contentType: mimeType,
                        });
                    } else {
                        body.append(field.field_name, value);
                    }
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
                timeout: 10000,
                validateStatus: () => true
            });

            // Save Log
            eventEmitter.emit("webhook.executed", {
                hook,
                response
            })


            if (response.status < 200 || response.status >= 300) {
                return res.status(response.status).json({ err: response.data.err })
            }


            return res.status(200).json({ data: response.data })

        } catch (err) {
            console.log(err)
            if (err.code === "ECONNABORTED") {
                return res.status(504).json({ err: "Request timed out" });
            }
            return res.status(500).json({ err: "Something went wrong" })
        }
    }

}


module.exports = WebHookController;