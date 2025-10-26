import { LanguageBanner } from '@/components/language-banner';

interface ResearchOfflineBannerProps {
  online: boolean;
  message: string;
}

export function ResearchOfflineBanner({ online, message }: ResearchOfflineBannerProps) {
  if (online) {
    return null;
  }
  return <LanguageBanner message={message} />;
}
