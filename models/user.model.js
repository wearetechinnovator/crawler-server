const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    phone: {
        type: Number,
        unique: true,
    },
    password: String,
},{timestamps: true});

const userModel = mongoose.model('user', userSchema);

module.exports = userModel;