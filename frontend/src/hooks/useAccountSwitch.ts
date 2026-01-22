import axios from "axios";
import { useUser } from "../context/user";
import { toast } from "react-toastify";
export const useAccountSwitch = () => {
  const { refreshUser } = useUser();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const switchAccount = async (userId: string) => {
    await axios.post(
      `${BACKEND_URL}/api/auth/switch-account`,
      { userId },
      { withCredentials: true }
    );

    await refreshUser();// fetch new active user
    toast.success("Account switched successfully!", {
        position: "top-right",
        autoClose: 3000,
      });
    console.log("New user is active:", userId);
  };

  return { switchAccount };
};
