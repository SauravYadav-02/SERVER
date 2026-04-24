import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
        minlength: [2, "Name must be at least 2 characters long"],
        maxlength: [50, "Name cannot exceed 50 characters"]
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email address"]
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters long"],
        select: false // Don't include password in queries by default
    },
    phone: {
        type: String,
        required: false,
        match: [/^\d{10}$/, "Please enter a valid 10-digit phone number"]
    },
    address: {
        type: String,
        required: false,
        trim: true,
        maxlength: [200, "Address cannot exceed 200 characters"]
    },
    city: {
        type: String,
        required: false,
        trim: true,
        maxlength: [50, "City cannot exceed 50 characters"]
    },
    pinCode: {
        type: String,
        required: false,
        match: [/^\d{6}$/, "Please enter a valid 6-digit pin code"]
    },
    profilePhoto: {
        type: String,
        required: false,
        default: null
    }
    // isVerified: {
    //     type: Boolean,
    //     default: false
    // },
    // verificationToken: {
    //     type: String,
    //     select: false
    // },
    // resetPasswordToken: {
    //     type: String,
    //     select: false
    // },
    // resetPasswordExpires: {
    //     type: Date,
    //     select: false
    // }
}, {
    timestamps: true
});

// Index for email to ensure uniqueness
userSchema.index({ email: 1 });

export default mongoose.model("User", userSchema);