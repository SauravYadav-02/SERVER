export const isAdmin = (req,res,next)=>{
    const adminId = req.headers.adminid;

    if(!adminId){
        return res.status(401).json({message:"Admin not logged in"});
    }

    req.adminId = adminId;
    next();
};