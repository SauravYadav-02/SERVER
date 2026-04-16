import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
{   

    fullName: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },

    phone: {
        type: String,
        required: true
    },

    businessName: {
        type: String,
        required: true
    },

    businessType: {
        type: String,
        required: true
    },

    // ✅ File paths (stored by Multer)
    governmentId: {
        type: String,
        required: true
    },

    licenseDoc: {
        type: String,
        required: true
    },

    username: {
        type: String,
        unique: true,
        sparse: true   // allows null before approval
    },

    password: {
        type: String
    },

    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },

    adminMessage: {
        type: String,
        default: ""
    },

    address: {
        type: String,
        required: true
    },

    pincode: {
        type: String,
        required: true
    },

    state: {
        type: String,
        required: true
    }

},
{ timestamps: true }
);

export default mongoose.model("Vendor", vendorSchema);