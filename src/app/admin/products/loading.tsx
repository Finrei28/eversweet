import Loader from "~/app/components/customLoading";

export default function Loading() {
  return <Loader text={{ en: "Loading products...", zh: "正在加载产品..." }} />;
}
