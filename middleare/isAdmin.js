export const isAdmin = (req,res,next)=>{
    console.log("HEADERS:", req.headers);

    const adminId = req.headers.adminid;

    if(!adminId){
        return res.status(401).json({message:"Admin not logged in"});
    }

    next();
};