'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FaGift } from 'react-icons/fa';
import { useLang } from '../../../components/LangContext';
import { t, tFmt } from '../../../utils/i18n';

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
};

const CONTACT_EMAIL = 'dawid.faith@gmail.com';

interface PublicCampaign {
  id: string;
  title: string;
  requiredText: string;
  creditReward: number;
  artistName: string;
  platforms: { platform: string; postUrl: string }[];
}

export default function GiveawayTermsPage() {
  const params = useParams();
  const campaignId = String(params.id);
  const lang = useLang();

  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/giveaways/campaign/${campaignId}`);
      if (!res.ok) { setNotFound(true); return; }
      const data = await res.json();
      setCampaign(data.campaign);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0c0a] flex items-center justify-center">
        <span className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className="min-h-screen bg-[#0e0c0a] flex flex-col items-center justify-center text-center px-6">
        <FaGift className="text-zinc-600 mb-4" size={36} />
        <p className="text-zinc-300 font-semibold">{t('win.notFound', lang)}</p>
      </div>
    );
  }

  const platformNames = campaign.platforms.map(p => PLATFORM_LABELS[p.platform] ?? p.platform).join(', ');

  return (
    <div className="min-h-screen bg-[#0e0c0a] text-white pb-16">
      <div className="max-w-md mx-auto w-full px-5 pt-8 space-y-6">
        <div>
          <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-1">{campaign.title}</p>
          <h1 className="text-xl font-black">{t('win.termsPageTitle', lang)}</h1>
        </div>

        <p className="text-zinc-300 text-sm">{tFmt('win.termsOrganizer', lang, { name: campaign.artistName })}</p>

        <section className="space-y-2">
          <h2 className="text-amber-300 text-sm font-bold">{t('win.termsHowToEnterTitle', lang)}</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">{tFmt('win.termsHowToEnterBody', lang, { word: campaign.requiredText })}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-amber-300 text-sm font-bold">{t('win.termsEligibilityTitle', lang)}</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">{t('win.termsEligibilityBody', lang)}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-amber-300 text-sm font-bold">{t('win.termsPrizeTitle', lang)}</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">{tFmt('win.termsPrizeBody', lang, { reward: campaign.creditReward })}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-amber-300 text-sm font-bold">{t('win.termsPlatformTitle', lang)}</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">{tFmt('win.platformDisclaimer', lang, { platforms: platformNames })}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-amber-300 text-sm font-bold">{t('win.termsDataTitle', lang)}</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">{t('win.termsDataBody', lang)}</p>
        </section>

        <p className="text-zinc-500 text-xs">{tFmt('win.termsContact', lang, { email: CONTACT_EMAIL })}</p>

        <Link href={`/win/${campaignId}`} className="inline-block text-amber-400 hover:text-amber-300 text-sm font-semibold">
          {t('win.backToGiveaway', lang)}
        </Link>
      </div>
    </div>
  );
}
