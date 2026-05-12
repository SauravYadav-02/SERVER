export const isUser = (req, res, next) => {
    const userId = req.headers.userid || req.headers['userid'];

    if (!userId) {
        return res.status(401).json({ message: "User not logged in or userId missing in headers" });
    }

    req.userId = userId;
    next();
};
