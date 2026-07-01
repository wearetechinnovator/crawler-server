const mongoose = require('mongoose');

// Property means the website that user wants to crawl. 
// We will store the url of the website in this collection.
const propertySchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    name: String,
    website_url: String,
    total_endpoints: {
        type: Number,
        default: 0
    },
    secure_key: String,
    public_key: {
        type: String,
        index: true
    },
    is_crawled: {
        enum: ['pending', 'crawling', 'crawled', 'failed'],
        type: String,
        default: 'pending'
    },
    is_verified: {
        type: Boolean,
        default: false
    },
    is_del: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const propertyModel = mongoose.model('property', propertySchema);
module.exports = propertyModel;