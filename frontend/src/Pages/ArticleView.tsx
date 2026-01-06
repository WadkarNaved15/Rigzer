import { useEffect, useState } from "react";
import ReadOnlyCanvas from "../components/Articles/ReadOnlyCanvas";

export default function ArticleView() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("http://localhost:5000/api/article/695bc8adeeeaa9101e13478a")
      .then((res) => res.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center text-[#888]">
        Loading article...
      </div>
    );
  }
{console.log(data)}
  return <ReadOnlyCanvas data={data} />;
}
