import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useFollow } from "../context/FollowContext";
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

    const {
        followersCache,
        followingCache,
        setFollowersCache,
        setFollowingCache
    } = useFollow();
    const cache = type === "followers"
        ? followersCache[userId]
        : followingCache[userId];

    const users = cache?.users || [];
    const page = cache?.page || 1;
    const hasMore = cache?.hasMore ?? true;
    const observer = useRef<IntersectionObserver | null>(null);
    const [loading, setLoading] = useState(false);
    const fetchUsers = async (pageNumber: number) => {
        if (loading) return;

        try {
            setLoading(true);

            const res = await axios.get(
                `${BACKEND_URL}/api/follow/${userId}/${type}?page=${pageNumber}&limit=20`
            );

            const newUsers = res.data[type];

            if (type === "followers") {

                setFollowersCache(prev => ({
                    ...prev,
                    [userId]: {
                        users: pageNumber === 1
                            ? newUsers
                            : [...(prev[userId]?.users || []), ...newUsers],
                        page: pageNumber,
                        hasMore: res.data.hasMore
                    }
                }));

            } else {

                setFollowingCache(prev => ({
                    ...prev,
                    [userId]: {
                        users: pageNumber === 1
                            ? newUsers
                            : [...(prev[userId]?.users || []), ...newUsers],
                        page: pageNumber,
                        hasMore: res.data.hasMore
                    }
                }));

            }

        } catch (err) {
            console.error("Error fetching users", err);
        } finally {
            setLoading(false);
        }
    };

    const lastUserRef = useCallback(
        (node: HTMLAnchorElement | null) => {
            if (loading) return;

            if (observer.current) observer.current.disconnect();

            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    fetchUsers(page + 1);
                }
            });

            if (node) observer.current.observe(node);
        },
        [loading, hasMore]
    );
    useEffect(() => {
        if (!cache) {
            fetchUsers(1);
        }
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
                    {users.length === 0 && loading ? (
                        <p className="p-4 text-gray-500">Loading...</p>
                    ) : users.length === 0 ? (
                        <p className="p-4 text-gray-500">No {type}</p>
                    ) : (
                        users.filter(Boolean).map((user, index) => {
                            const isLast = index === users.length - 1;
                            return (
                                <Link
                                    to={`/profile/${user.username}`}
                                    key={user._id}
                                    ref={isLast ? lastUserRef : null}
                                    className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                >
                                    <img
                                        src={user.avatar || "/default_avatar.png"}
                                        className="w-10 h-10 rounded-full"
                                    />

                                    <div>
                                        <p className="text-sm text-gray-500">@{user.username}</p>
                                    </div>
                                </Link>

                            );
                        })

                    )}
                    {loading && users.length > 0 && (
                        <p className="p-3 text-center text-gray-500">Loading more...</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FollowModal;