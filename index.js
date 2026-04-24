import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import userRoutes from "./Routes/userRoutes.js";
import vendorRoutes from "./Routes/vendorRoutes.js";
import adminRoutes  from "./Routes/adminRoutes.js";
import venueRoutes from "./Routes/venueRoutes.js";
import bookingRoutes from "./Routes/bookingRoutes.js";
const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://localhost:27017/Book_My_Venue")
.then(()=>console.log("DB Connected"))
.catch(()=>console.log("DB Error"));

app.use("/uploads", express.static("uploads"));

app.use("/users", userRoutes);
app.use("/vendors", vendorRoutes);
app.use("/admin", adminRoutes );
app.use("/venues", venueRoutes);
app.use("/bookings", bookingRoutes);

app.listen(3000,'0.0.0.0',()=>{
    console.log("Server running on 3000");
});