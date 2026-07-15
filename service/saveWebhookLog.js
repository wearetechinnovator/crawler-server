const { default: mongoose } = require('mongoose');
const eventEmitter = require('../events/event');
const webhookLogModel = require("../models/webhookLog.model");


eventEmitter.on("webhook.executed", async ({ hook, response }) => {
    try {
        const isSuccess = response.status >= 200 && response.status < 300;

        await webhookLogModel.create({
            user_id: new mongoose.Types.ObjectId(String(hook.user_id)),
            property_id: new mongoose.Types.ObjectId(String(hook.property_id)),
            webhook_id: new mongoose.Types.ObjectId(String(hook._id)),
            status_code: response.status,
            status: isSuccess,
            response: JSON.stringify(response.data),
        });
    } catch (err) {
        console.error("Webhook log failed:", err);
    }
});