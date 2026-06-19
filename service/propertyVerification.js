const axios = require('axios');
const Constant = require("../utils/Constant");
const propertyModel = require("../models/property.model");


const propertyVerification = async ({ propertyId }) => {
    try {
        // Get Property;
        const property = await propertyModel.findOne({ _id: propertyId, is_del: false });

        const ORIGIN = property.website_url;
        const FILE_NAME = Constant.VERIFICATION_FILE;

        // Check secure key exist or not
        const response = await axios.get(`${ORIGIN}/${FILE_NAME}`);
        const secureData = response?.data.secure_key;

        if (!secureData) {
            return {
                verify: false,
                msg: "Invalid property!"
            }
        }

        if (property.secure_key !== secureData) {
            return {
                verify: false,
                msg: "Invalid Secure key or invalid property!"
            }
        }

        return true;

    } catch (err) {
        return {
            verify: false,
            msg: "Invalid Secure key or invalid property!"
        }
    }
}

module.exports = {
    propertyVerification
}