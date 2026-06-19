const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
    property_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'property',
        required: true
    },
    messages: [
        {
            role: {
                type: String,
                enum: ["user", "bot"]
            },
            content: String,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ]
}, { timestamps: true });

const chatModel = mongoose.model('chats', chatSchema);

module.exports = chatModel;