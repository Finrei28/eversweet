import Loader from "~/app/components/customLoading";

export default function Loading() {
  return (
    <Loader
      text={{ en: "Loading past orders...", zh: "正在加载过去的订单..." }}
    />
  );
}
