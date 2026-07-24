const mongoose = require("mongoose");


const widgetSettingSchema = new mongoose.Schema({
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
    launcher_button_color: String,
    launcher_button_icon: String,
    launcher_button_position: {
        type: String,
        default: 'bottom-right'
    },
    launcher_button_offset: {
        type: Array,
        default: [0, 0]
    },
    launcher_button_size: String,
    launcher_button_shadow: {
        type: Boolean,
        default: true
    },
    launcher_icon_color: String,
    launcher_border_radius: Number,

    initial_message: String,
    suggested_questions: Array,

    message_font_size: Number,
    message_font_family: String,
    message_line_height: Number,
    place_holder_text: {
        type: String,
        default: 'Ask a question'
    },
    send_button_icon: String,
    input_area_bg: String,
    header_logo: String,
    bot_name: String,
    subtitle: String,
    online_status: {
        type: Boolean,
        default: true
    },
    minimize_button: {
        type: Boolean,
        default: true
    },
    close_button: {
        type: Boolean,
        default: true
    },
    header_bg: String,
    header_text_bg: String,
    window_width: {
        type: Number,
        default: 380
    },
    window_height: {
        type: Number,
        default: 450
    },
    bot_bubble_bg: String,
    bot_bubble_text: String,
    user_bubble_bg: String,
    user_bubble_text: String,
    bubble_radius: Number,
    bubble_spacing: Number,
    show_window_shadow: {
        type: Boolean,
        default: true
    },
    window_animation: String,
    show_window_bg_img: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const widgetModel = mongoose.model('widget_settings', widgetSettingSchema);

module.exports = widgetModel;