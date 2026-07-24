const widgetSettingModel = require("../models/widgetSettings.model");
const ApiError = require("../utils/ApiError");
const fs = require("node:fs")
const path = require('node:path');
const crypto = require("crypto");
const { fileTypeFromBuffer } = require("file-type")


class WidgetController {
    static async updateSetting(req, res) {
        const {
            propertyId,
            launcher_button_color, launcher_button_icon, launcher_button_position, launcher_button_offset,
            launcher_button_size, launcher_button_shadow, launcher_icon_color, launcher_border_radius,

            initial_message, suggested_questions,

            message_font_size, message_font_family, message_line_height, place_holder_text, send_button_icon,
            input_area_bg, header_logo, bot_name, subtitle, online_status, minimize_button, close_button,
            header_bg, header_text_bg, window_width, window_height, bot_bubble_bg, bot_bubble_text, user_bubble_bg,
            user_bubble_text, bubble_radius, bubble_spacing, remove_logo, show_window_shadow, window_animation,
            show_window_bg_img
        } = req.body;
        const data = req.data; // from auth middleware;


        if (!propertyId) {
            throw new ApiError(401, "Invalid Property id")
        }

        const widgetSetting = await widgetSettingModel.findOne({ user_id: data.id, property_id: propertyId })
        const filePath = path.join(__dirname, "..", "uploads");
        let headerLogoName = null;


        if (header_logo) {
            if (widgetSetting?.header_logo) {
                const oldFile = path.join(filePath, widgetSetting.header_logo);

                if (fs.existsSync(oldFile)) {
                    fs.unlinkSync(oldFile);
                }
            }

            const matches = header_logo.match(/^data:(.+);base64,(.+)$/);
            if (!matches) {
                throw new ApiError(422, "Invalid file format");
            }

            const base64 = matches[2];
            const buffer = Buffer.from(base64, "base64");

            // Detect actual file type from binary
            const detected = await fileTypeFromBuffer(buffer);

            if (!detected) {
                throw new ApiError(422, 'header logo has an unsupported or invalid file');
            }

            if (!['jpg', 'png'].includes(detected.ext)) {
                throw new ApiError(422, 'header logo has an unsupported or invalid file');
            }

            headerLogoName = `LOGO_${crypto.randomUUID()}_${Date.now()}.${detected.ext}`;

            fs.writeFileSync(
                path.join(filePath, headerLogoName),
                buffer
            );
        }

        if (remove_logo) {
            if (widgetSetting.header_logo) {
                const oldFile = path.join(filePath, widgetSetting.header_logo);

                if (fs.existsSync(oldFile)) {
                    fs.unlinkSync(oldFile);
                }
            }

            headerLogoName = "";
        }



        const update = await widgetSettingModel.updateOne({ user_id: data.id, property_id: propertyId }, {
            $set: {
                launcher_button_color, launcher_button_icon, launcher_button_position, launcher_button_offset,
                launcher_button_size, launcher_button_shadow, launcher_icon_color, launcher_border_radius,

                initial_message, suggested_questions,

                message_font_size, message_font_family, message_line_height, place_holder_text, send_button_icon,
                input_area_bg, header_logo: headerLogoName, bot_name, subtitle, online_status, minimize_button,
                close_button, header_bg, header_text_bg, window_width, window_height, bot_bubble_bg, bot_bubble_text,
                user_bubble_bg, user_bubble_text, bubble_radius, bubble_spacing, show_window_shadow, window_animation,
                show_window_bg_img
            }
        }, { upsert: true })

        if (update.modifiedCount < 1 && update.upsertedCount < 1) {
            throw new ApiError(500, "Widget settings not save");
        }

        return res.status(200).json({ msg: "Widget update successfully" });

    }

    static async getSetting(req, res) {
        const { propertyId } = req.params;
        const data = req.data; // from auth middleware;

        if (!propertyId) {
            throw new ApiError(401, "Invalid Property id");
        }

        const getSetting = await widgetSettingModel.findOne({ user_id: data.id, property_id: propertyId });

        if (!getSetting) {
            throw new ApiError(404, "Data not found");
        }

        return res.status(200).json({ data: getSetting });
    }
}


module.exports = WidgetController;