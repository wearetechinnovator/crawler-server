const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
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
    webhook_name: String,
    description: String,
    status: {
        type: String,
        default: 'true'
    },
    webhook_url: String,
    http_method: {
        type: String,
        enum: ['post', 'patch', 'put'],
        default: 'post'
    },
    payload_format: {
        type: String,
        enum: ['json', 'form_data'],
        default: 'json'
    },
    authentication_type: {
        type: String,
        enum: ['signature', 'bearer_token', 'none']
    },
    secret_token: String,
    signature_header_name: String,
    payload: [
        {
            field_name: String,
            type: {
                type: String,
                default: 'string'
            },
            is_required: {
                type: String,
                default: 'no'
            },
            default: String,
        }
    ],
    header: [
        {
            header_name: String,
            header_value: String
        }
    ],
    is_del: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const webhookModel = new mongoose.model('webhooks', webhookSchema);

module.exports = webhookModel;
