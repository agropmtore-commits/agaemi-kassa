import type { Wallet } from '../db/schema';

// README §5.2 — hədəf = "savings" tipli cüzdan + hədəf məbləği + son tarix. Yığılan = cüzdanın qalığı.

export interface GoalProgress {
  saved: number;
  target: number;
  /** 0–1, hədəf 0-dırsa 0; 1-dən böyük ola bilər */
  ratio: number;
  /** target − saved, 0-dan aşağı düşmür */
  remaining: number;
  done: boolean;
  /** son tarixə qalan tam aylar (bu ay daxil, ≥ 1); son tarix yoxdursa null; keçibsə 0 */
  monthsLeft: number | null;
  /** qalan / aylar (yuxarı yuvarlaq); son tarix yoxdursa və ya keçibsə null; hədəfə çatıbsa 0 */
  neededPerMonth: number | null;
  overdue: boolean;
}

/** 'YYYY-MM-DD' × 2 → aralıqdakı ay sayı (başlanğıc ayı daxil). Eyni ay → 1. Keçmiş → 0. */
export function monthsBetween(today: string, deadline: string): number {
  if (deadline < today) return 0;
  const [y1, m1] = today.split('-').map(Number) as [number, number];
  const [y2, m2] = deadline.split('-').map(Number) as [number, number];
  return (y2 - y1) * 12 + (m2 - m1) + 1;
}

export function goalProgress(wallet: Pick<Wallet, 'target_amount' | 'deadline'>, saved: number, today: string): GoalProgress {
  const target = wallet.target_amount ?? 0;
  const remaining = Math.max(0, target - saved);
  const done = target > 0 && saved >= target;
  const monthsLeft = wallet.deadline ? monthsBetween(today, wallet.deadline) : null;
  const overdue = !done && monthsLeft === 0;
  let neededPerMonth: number | null = null;
  if (done) neededPerMonth = 0;
  else if (monthsLeft !== null && monthsLeft > 0) neededPerMonth = Math.ceil(remaining / monthsLeft);
  return { saved, target, ratio: target > 0 ? saved / target : 0, remaining, done, monthsLeft, neededPerMonth, overdue };
}
