export function ProductDetailLoading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      className="min-h-screen bg-white px-4 py-10 sm:px-6 lg:px-8 lg:py-16"
    >
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-10 w-40 rounded-xl bg-border" />
        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,0.98fr)_minmax(24rem,0.78fr)] lg:gap-12 xl:gap-14">
          <div>
            <div className="aspect-square rounded-2xl bg-soft" />
            <div className="mt-4 flex justify-center gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="aspect-square w-20 bg-soft sm:w-24" />
              ))}
            </div>
          </div>
          <div className="pt-3">
            <div className="h-7 w-36 rounded-full bg-border" />
            <div className="mt-5 h-11 rounded-2xl bg-border" />
            <div className="mt-4 h-5 rounded-full bg-border" />
            <div className="mt-3 h-5 w-4/5 rounded-full bg-border" />
            <div className="mt-8 h-24 rounded-2xl bg-soft" />
            <div className="mt-6 h-52 rounded-2xl bg-soft" />
          </div>
        </div>
      </div>
    </main>
  );
}
