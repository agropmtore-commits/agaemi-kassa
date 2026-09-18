import { ComingSoon, PageTitle } from '../../components/AppShell';
import { t } from '../../i18n/az';

export function StatsPage() {
  return (
    <>
      <PageTitle>{t.stats.title}</PageTitle>
      <ComingSoon phase={3} />
    </>
  );
}
