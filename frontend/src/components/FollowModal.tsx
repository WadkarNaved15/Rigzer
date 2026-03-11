import { useEffect, useState } from "react";
import axios from "axios";
import { X } from "lucide-react";

type User = {
    _id: string;
    username?: string;
    avatar?: string;
};

type Props = {
    userId: string;
    type: "followers" | "following";
    onClose: () => void;
};

const FollowModal = ({ userId, type, onClose }: Props) => {
    const BACKEND_URL =
        import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await axios.get(
                    `${BACKEND_URL}/api/follow/${userId}/${type}`
                );
                console.log("Full API Response:", res.data); // LOG HERE
                setUsers(res.data[type] || []);
            } catch (err) {
                console.error("Error fetching users", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [userId, type]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-[#191919] w-[420px] max-h-[500px] rounded-xl shadow-xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                    <h2 className="font-semibold text-lg capitalize">{type}</h2>
                    <button onClick={onClose}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* List */}
                <div className="overflow-y-auto max-h-[420px]">
                    {loading ? (
                        <p className="p-4 text-gray-500">Loading...</p>
                    ) : users.length === 0 ? (
                        <p className="p-4 text-gray-500">No {type}</p>
                    ) : (
                        users.filter(Boolean).map((user) => (
                            <div
                                key={user._id}
                                className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                            >
                                <img
                                    src={user.avatar || "/default_avatar.png"}
                                    className="w-10 h-10 rounded-full"
                                />

                                <div>
                                    <p className="text-sm text-gray-500">@{user.username}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default FollowModal;