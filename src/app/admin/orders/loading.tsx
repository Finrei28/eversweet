import Loader from "~/app/components/customLoading";

export default function Loading() {
  return <Loader text={{ en: "Loading orders...", zh: "正在加载订单..." }} />;
}
