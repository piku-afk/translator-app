export function Greeting({
  name,
  message = 'Continue where you left off',
}: {
  name: string;
  message?: string;
}) {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-semibold text-foreground">Good morning, {name}</h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
    </div>
  );
}