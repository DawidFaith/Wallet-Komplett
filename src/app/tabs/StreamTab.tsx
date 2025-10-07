import type { SupportedLanguage } from "../utils/deepLTranslation";

interface StreamTabProps {
  language: SupportedLanguage;
}

export default function StreamTab({ language }: StreamTabProps) {
  return (
    <div className="text-white text-xl">Stream Bereich</div>
  );
}