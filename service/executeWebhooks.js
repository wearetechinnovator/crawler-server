const axios = require("axios");
const eventEmitter = require('../events/event');



const executeWebhook = async ({ hook, inputs }) => {
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
            if (inputs[field.field_name] !== undefined) {
                value = inputs[field.field_name];
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

        
        return {
            success: true,
            data: response.data,
        };

    } catch (err) {
        return {
            success: false,
            message: err.message
        };
    }
}

module.exports = {
    executeWebhook
}