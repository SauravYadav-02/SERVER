import express from "express";
import Admin from "../models/AdminModel.js";


const router = express.Router();

// Create Admin
router.post("/register", async (req,res)=>{
    const admin = new Admin(req.body);
    await admin.save();
    res.json({message:"Admin Created", admin});
});

// Login
router.post("/login", async (req,res)=>{
    const {username,password} = req.body;

    const admin = await Admin.findOne({username});

    if(!admin || admin.password !== password){
        return res.status(400).json({message:"Invalid credentials"});
    }

    res.json({message:"Login success", admin});
});

export default router;