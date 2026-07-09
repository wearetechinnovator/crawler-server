const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    property_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'property',
        required: true,
        index: true
    },
    webhook_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'webhook',
        required: true,
        index: true
    },
    status: String,
    response: String,
    timestamp: String,
    full_log: String
}, { timestamps: true });

const webhookLogModel = new mongoose.model("webhook_log", webhookLogSchema);

module.exports = webhookLogModel;