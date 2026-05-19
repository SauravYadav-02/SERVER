export const isAdmin = (req,res,next)=>{
<<<<<<< HEAD
    const adminId = req.headers.adminid || req.headers["adminid"];
=======
    const adminId = req.headers.adminid;
>>>>>>> 40c8d7bb903d79d30f815186249dcb033d2a1109

    if(!adminId){
        return res.status(401).json({message:"Admin not logged in"});
    }

    req.adminId = adminId;
    next();
};
