import { Loader2 } from "lucide-react";

type LoaderProps = {
  text?: string;
};

export default function Loader({ text }: LoaderProps) {
  return (
    <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        {text && <p className="text-lg font-medium text-primary">{text}</p>}
      </div>
    </div>
  );
}
