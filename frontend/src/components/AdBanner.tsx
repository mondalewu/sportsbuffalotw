import type { AdPlacement } from '../types';

export default function AdBanner({ ads }: { ads: AdPlacement[] }) {
  if (!ads.length) return null;
  const ad = ads[0];
  if (ad.type === 'CPM' && ad.ad_code)
    return <div className="w-full overflow-hidden rounded-2xl" dangerouslySetInnerHTML={{ __html: ad.ad_code }} />;
  if (ad.type === 'CPD' && ad.image_url)
    return (
      <a href={ad.link_url || '#'} target="_blank" rel="noopener noreferrer" className="block w-full">
        <img src={ad.image_url} alt={ad.client_name || '廣告'} className="w-full rounded-2xl" />
      </a>
    );
  return null;
}
