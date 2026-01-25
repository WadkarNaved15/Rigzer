import axios from "axios";
import { removeAccount } from "../utils/accountRegistry";

export const useAccountLogout = () => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const logoutAccount = async (userId: string) => {
    await axios.post(`${BACKEND_URL}/api/auth/logout`, {}, {
      withCredentials: true
    });

    removeAccount(userId);
    window.location.reload();
  };

  return { logoutAccount };
};
