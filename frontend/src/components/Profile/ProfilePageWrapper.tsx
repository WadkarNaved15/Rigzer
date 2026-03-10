import { useParams } from "react-router-dom";
import ProfilePage from "./NewProfile";

// Forces a full remount of ProfilePage whenever username changes.
// This means all useRef/useState initialize fresh — no stale closure bugs.
export default function ProfilePageWrapper() {
  const { username } = useParams<{ username: string }>();
  return <ProfilePage key={username} />;
}