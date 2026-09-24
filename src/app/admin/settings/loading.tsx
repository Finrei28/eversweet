import Loader from "~/app/components/customLoading";

export default function Loading() {
  return <Loader text={{ en: "Loading settings...", zh: "正在加载设置..." }} />;
}
