export function CatalogLoading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      className="min-h-screen bg-soft px-4 py-14 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-4 w-28 rounded-full bg-border" />
        <div className="mt-4 h-10 max-w-xl rounded-2xl bg-border" />
        <div className="mt-4 h-5 max-w-2xl rounded-full bg-border" />
        <div className="mt-10 h-36 rounded-3xl border border-border bg-white" />
        <div className="mt-10 grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[1.75rem] border border-border bg-white"
            >
              <div className="mx-2 mt-2 aspect-[4/3] rounded-[1.35rem] bg-border/70" />
              <div className="space-y-4 px-5 pb-5 pt-6">
                <div className="h-4 w-24 rounded-full bg-border" />
                <div className="h-6 rounded-full bg-border" />
                <div className="h-7 w-32 rounded-full bg-border" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
