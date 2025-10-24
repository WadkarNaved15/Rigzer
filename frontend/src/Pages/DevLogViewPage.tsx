import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import DevLogView from "../components/Devlogs/DevLogsView";
import type { PageData } from "../types/Devlogs";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const DevLogsView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [devlog, setDevlog] = useState<{
    pageData: PageData;
    leftColumnCards: string[];
    rightColumnCards: string[];
    gradientColor: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDevlog = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/devlogs/${id}`);
        setDevlog(res.data.devlog);
      } catch (err) {
        console.error("Error fetching devlog:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchDevlog();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-white text-xl">Loading...</p>
      </div>
    );
  }

  if (!devlog) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-white text-xl">Devlog not found.</p>
      </div>
    );
  }

  return (
    <DevLogView
      pageData={devlog.pageData}
      leftColumnCards={devlog.leftColumnCards}
      rightColumnCards={devlog.rightColumnCards}
      gradientColor={devlog.gradientColor}
    />
  );
};

export default DevLogsView;