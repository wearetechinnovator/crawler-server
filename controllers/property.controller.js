const ApiError = require("../utils/ApiError");
const propertyModel = require("../models/property.model");
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');


class PropertyController {
    static async addProperty(req, res) {
        const { name, website_url } = req.body;
        const data = req.data; // from auth middleware;

        if (!website_url || !name) {
            throw new ApiError(400, "Website URL and name are required");
        }

        const url = new URL(website_url);

        // Check if the user has already added this property
        const existingProperty = await propertyModel.findOne({
            user_id: data.id,
            website_url: url.origin,
            is_del: false
        });

        if (existingProperty) {
            throw new ApiError(400, "Property already added");
        }

        // Generate a secure key for the property
        const secure_key = crypto.randomBytes(24).toString('hex');

        const property = await propertyModel.create({
            user_id: data.id,
            name,
            website_url: url.origin,
            secure_key
        });

        if (!property) {
            throw new ApiError(500, "Property creation failed");
        }

        return res.status(201).json({
            msg: "Property added successfully",
            data: property
        });
    }

    static async getProperties(req, res) {
        const data = req.data; // from auth middleware;
        const id = req.params.id; // from url params

        const properties = await propertyModel.findOne({
            user_id: data.id, _id: id, is_del: false
        });
        if (!properties) {
            throw new ApiError(404, "Properties not found");
        }

        return res.status(200).json({
            msg: "Properties fetched successfully",
            data: properties
        });
    }

    static async getAllProperties(req, res) {
        const data = req.data; // from auth middleware;

        const properties = await propertyModel.find({ user_id: data.id, is_del: false });
        if (!properties) {
            throw new ApiError(404, "Properties not found");
        }

        return res.status(200).json({
            msg: "Properties fetched successfully",
            data: properties
        });
    }

    static async deleteProperty(req, res) {
        const data = req.data; // from auth middleware;
        const id = req.params.id; // from url params

        const updateProperty = await propertyModel.updateOne({ _id: id, user_id: data.id }, {
            $set: {
                is_del: true
            }
        });

        if (updateProperty.modifiedCount === 0) {
            throw new ApiError(500, "Property deletion failed");
        }

        return res.status(200).json({
            msg: "Property deleted successfully"
        });
    }

    static async downloadVerificationFile(req, res) {
        const data = req.data; // from auth middleware;
        const id = req.params.id;

        // First check property exists and belongs to the user
        const property = await propertyModel.findOne({ _id: id, user_id: data.id, is_del: false });
        if (!property) {
            throw new ApiError(404, "Property not found");
        }

        // Genarate a json file with this verification key
        const fileContent = JSON.stringify({ secure_key: property.secure_key });
        const fileName = `verification_${property._id}.json`;

        const filePath = path.join(__dirname, "..", "temp", fileName);
        fs.writeFileSync(filePath, fileContent);

        // Send the file as response for download;
        res.status(200).download(filePath, fileName, (err) => {
            // Delete the verification file;
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error("File deletion error:", err);
                }
            });

            if (err) {
                console.error("File download error:", err);
                throw new ApiError(500, "File download failed");
            }
        })

    }

    static async checkVerification(req, res) {
        const { propery_id } = req.body;

        if (!propery_id) {
            throw new ApiError(500, "property id is required.");
        }

        const property = await propertyModel.findOne({ _id: propery_id, is_del: false });
        if (!property) {
            throw new ApiError(500, "Property not found");
        }

        const ORIGIN = property.website_url;
        const FILE_NAME = 'crawlbot-ai.json';

        // Check secure key exist or not
        const response = await axios.get(`${ORIGIN}/${FILE_NAME}`);
        const secureData = response.data.secure_key;

        if (!secureData) {
            throw new ApiError(401, "Invalid property.")
        }

        if (property.secure_key !== secureData) {
            throw new ApiError(401, "Invalid Secure key or invalid property.")
        }

        // Change verify status
        await propertyModel.updateOne({ _id: propery_id }, {
            $set: {
                is_verified: true
            }
        })

        return res.status(200).json({ msg: "Verification successfully complete." })
    }
}


module.exports = PropertyController;