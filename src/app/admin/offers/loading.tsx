import Loader from "~/app/components/customLoading";

export default function Loading() {
  return <Loader text={{ en: "Loading offers...", zh: "正在加载优惠..." }} />;
}
