import express from "express";
import User from "../models/UserModel.js";


const router = express.Router();

// Register
router.post("/register", async (req,res)=>{
    const user = new User(req.body);
    await user.save();
    res.json({message:"User Registered", user});
});

// Login
router.post("/login", async (req,res)=>{
    const {email,password} = req.body;

    const user = await User.findOne({email});

    if(!user || user.password !== password){
        return res.status(400).json({message:"Invalid credentials"});
    }

    res.json({message:"Login success", user});
});

export default router;