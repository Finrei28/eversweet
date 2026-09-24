import Loader from "~/app/components/customLoading";

export default function Loading() {
  return (
    <Loader text={{ en: "Loading dashboard...", zh: "正在加载仪表板..." }} />
  );
}
