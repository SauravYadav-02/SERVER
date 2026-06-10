import User from "../models/UserModel.js";

export const isUser = async (req, res, next) => {
    const userId = req.headers.userid || req.headers['userid'];

    if (!userId) {
        return res.status(401).json({ message: "User not logged in or userId missing in headers" });
    }

    try {
        const user = await User.findById(userId);
        if (!user || user.deleted) {
            return res.status(404).json({ message: "User account not found" });
        }

        if (user.status === "suspended") {
            return res.status(403).json({ message: "Access denied. Your account is suspended." });
        }

        req.userId = userId;
        next();
    } catch (error) {
        return res.status(500).json({ message: "Error authenticating user", error: error.message });
    }
};
