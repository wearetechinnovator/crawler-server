const propertyModel = require("../models/property.model");
const userModel = require("../models/user.model");
const ApiError = require("../utils/ApiError");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("node:fs")
const path = require('node:path');
const crypto = require("crypto");
const Qdrantclient = require("../db/qdrant");


class UserController {
    static async createUser(req, res) {
        const { name, phone, password, confirm_password } = req.body;

        if (!name || !phone || !password || !confirm_password) {
            throw new ApiError(400, "All fields are required");
        }

        if (password !== confirm_password) {
            throw new ApiError(400, "Password and confirm password do not match");
        }

        const existingUser = await userModel.findOne({ phone });
        if (existingUser) {
            throw new ApiError(400, "User with this phone number already exists");
        }

        // Hashing password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);


        // Create Qdrant(vector) Collection;
        const collectionName = `${name}_${crypto.randomUUID()}`;

        await Qdrantclient.createCollection(collectionName, {
            vectors: {
                size: 384,
                distance: "Cosine"
            }
        })

        // Index propertyId for filter data;
        await Qdrantclient.createPayloadIndex(
            collectionName,
            {
                field_name: "metadata.propertyId",
                field_schema: "keyword"
            }
        );


        const user = await userModel.create({ 
            name, phone, password: hashedPassword,
            vector_collection_name: collectionName
        });
        if (!user) {
            throw new ApiError(500, "User creation failed");
        }


        return res.status(201).json({
            msg: "User created successfully",
            data: user
        });
    }

    static async updateUser(req, res) {
        const { name, profile_img, removeImg } = req.body;
        const data = req.data; // from auth middleware;

        const userData = await userModel.findById(data.id);
        const filePath = path.join(__dirname, "..", "uploads");
        let fileName = userData.profile_img;



        if (profile_img) {
            // Delete previous image if exists
            if (userData.profile_img) {
                const oldFile = path.join(filePath, userData.profile_img);
                
                if (fs.existsSync(oldFile)) {
                    fs.unlinkSync(oldFile);
                }
            }

            const matches = profile_img.match(/^data:(.+);base64,(.+)$/);
            if (!matches) {
                throw new ApiError(400, "Invalid image format");
            }

            const ext = matches[1].split("/")[1];
            const buffer = Buffer.from(matches[2], "base64");

            // Create new file name
            fileName = `DP_${crypto.randomUUID()}_${Date.now()}.${ext}`;

            fs.writeFileSync(
                path.join(filePath, fileName),
                buffer
            );
        }

        // If user remove profile picture;
        if (removeImg) {
            if (userData.profile_img) {
                const oldFile = path.join(filePath, userData.profile_img);

                if (fs.existsSync(oldFile)) {
                    fs.unlinkSync(oldFile);
                }
            }

            fileName = '';
        }



        const updatedUser = await userModel.updateOne({ _id: data.id }, {
            $set: {
                name,
                profile_img: fileName
            }
        });


        if (updatedUser.modifiedCount === 0) {
            throw new ApiError(404, "User not updated!");
        }

        return res.status(200).json({
            msg: "User updated successfully",
            data: {
                name: name,
                profile_img: fileName
            }
        });

    }

    static async getUser(req, res) {
        const id = req.params.id;
        const data = req.data; // from auth middleware;

        const user = await userModel.findById(id || data.id).select("-password");
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        return res.status(200).json({
            msg: "User fetched successfully",
            data: user
        });
    }

    static async login(req, res) {
        const { phone, password } = req.body;

        if (!phone || !password) {
            throw new ApiError(400, "Phone and password are required");
        }

        const user = await userModel.findOne({ phone });
        if (!user) {
            throw new ApiError(404, "Invalid phone or password");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new ApiError(400, "Invalid phone or password");
        }

        // Get Properties count;
        const propertiesCount = await propertyModel.countDocuments({ is_del: false, user_id: user._id })

        // const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

        return res.status(200).json({
            msg: "Login successful",
            data: { token, properties_count: propertiesCount }
        });
    }

    static async changePassword(req, res) {
        const { current_password, new_password } = req.body;
        const data = req.data; // from auth middleware;

        const userData = await userModel.findOne({ _id: data.id });

        if (!userData) {
            throw new ApiError(404, "User not found");
        }

        const isMatch = await bcrypt.compare(current_password, userData.password);
        if (!isMatch) {
            throw new ApiError(400, "Current password is incorrect");
        }

        // Hashing new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(new_password, salt);


        const updateUser = await userModel.updateOne({ _id: data.id }, {
            $set: {
                password: hashedPassword
            }
        })

        if (updateUser.modifiedCount === 0) {
            throw new ApiError(500, "Password change failed");
        }

        return res.status(200).json({
            msg: "Password changed successfully"
        });
    }

    static async checkToken(req, res) {
        try {
            const { token } = req.body;

            if (!token) {
                return res.status(401).json({
                    valid: false,
                    message: "Token required"
                });
            }

            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );

            if (!decoded) {
                return res.status(401).json({ valid: false });
            }

            // Get Properties count;
            const propertiesCount = await propertyModel.countDocuments({
                is_del: false, user_id: decoded.id
            })

            return res.status(200).json({
                valid: true,
                user: decoded,
                property_count: propertiesCount || 0
            });

        } catch (error) {
            return res.status(401).json({
                valid: false,
                message: "Invalid or expired token"
            });
        }
    }
}


module.exports = UserController;