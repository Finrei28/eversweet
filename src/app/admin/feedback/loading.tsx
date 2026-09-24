import Loader from "~/app/components/customLoading";

export default function Loading() {
  return <Loader text={{ en: "Loading feedback...", zh: "正在加载反馈..." }} />;
}
