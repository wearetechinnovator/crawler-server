const userModel = require("../models/user.model");
const ApiError = require("../utils/ApiError");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


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

        const user = await userModel.create({ name, phone, password: hashedPassword });
        if (!user) {
            throw new ApiError(500, "User creation failed");
        }

        return res.status(201).json({
            msg: "User created successfully",
            data: user
        });
    }

    static async updateUser(req, res) {
        const { name, phone } = req.body;
        const data = req.data; // from auth middleware;

        // check phone is unique
        if (phone) {
            const existingUser = await userModel.findOne({ phone, _id: { $ne: data.id } });
            if (existingUser) {
                throw new ApiError(400, "User with this phone number already exists");
            }
        }

        const updatedUser = await userModel.findByIdAndUpdate(
            data.id,
            { name, phone },
            { new: true }
        );

        if (!updatedUser) {
            throw new ApiError(404, "User not found");
        }

        return res.status(200).json({
            msg: "User updated successfully",
            data: updatedUser
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

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

        return res.status(200).json({
            msg: "Login successful",
            data: { token }
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
}


module.exports = UserController;