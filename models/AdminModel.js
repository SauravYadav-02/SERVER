import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
    username: String,
    password: String
},{timestamps:true});

export default mongoose.model("Admin", adminSchema);