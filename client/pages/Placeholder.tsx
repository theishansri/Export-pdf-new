interface PlaceholderProps { title: string }

export default function Placeholder({ title }: PlaceholderProps) {
  return (
    <div className="p-6">
      <div className="rounded-xl border bg-card p-8">
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-muted-foreground">
          This page is a placeholder. Ask to populate it with the content you want, and we'll generate it.
        </p>
      </div>
    </div>
  );
}
