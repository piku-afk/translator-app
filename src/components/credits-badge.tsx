import { Coins } from 'lucide-react';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';

type CreditsProps =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; credits: string };

export function CreditsBadge(props: CreditsProps) {
  const isDestructive = props.status === 'error';
  const formattedCredits =
    props.status === 'success'
      ? `${Number(props.credits).toFixed(2)}`
      : '0';

  return (
    <Badge color={isDestructive ? 'destructive' : undefined}>
      <Coins />
      {props.status === 'loading' ? (
        <Skeleton className="h-5 w-20" />
      ) : props.status === 'error' ? (
        props.error
      ) : (
        `${formattedCredits} Credits`
      )}
    </Badge>
  );
}