import Loader from "~/app/components/customLoading";

export default function Loading() {
  return (
    <Loader text={{ en: "Loading winners...", zh: "正在加载得奖者..." }} />
  );
}
