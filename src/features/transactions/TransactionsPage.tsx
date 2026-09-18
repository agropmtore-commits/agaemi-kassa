import { ComingSoon, PageTitle } from '../../components/AppShell';
import { t } from '../../i18n/az';

export function TransactionsPage() {
  return (
    <>
      <PageTitle>{t.transactions.title}</PageTitle>
      <ComingSoon phase={2} />
    </>
  );
}
