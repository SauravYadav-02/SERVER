import User from "../models/UserModel.js";

// Suspend a user
export const suspendUser = async (userId) => {
    const user = await User.findOneAndUpdate(
        { _id: userId, deleted: { $ne: true } },
        { status: "suspended" },
        { new: true }
    );

    if (!user) {
        throw new Error("User not found or deleted");
    }

    console.log(`[Audit] User ${userId} has been suspended.`);
    return user;
};

// Reactivate a user
export const unsuspendUser = async (userId) => {
    const user = await User.findOneAndUpdate(
        { _id: userId, deleted: { $ne: true } },
        { status: "active" },
        { new: true }
    );

    if (!user) {
        throw new Error("User not found or deleted");
    }

    console.log(`[Audit] User ${userId} has been reactivated/unsuspended.`);
    return user;
};
