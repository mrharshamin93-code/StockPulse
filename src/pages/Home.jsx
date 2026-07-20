<main
  ref={scrollRef}
  className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8 flex-1 overflow-y-auto"
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
>
  {loading ? (
    <div className="flex justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  ) : stocks.length === 0 ? (
    <PortfolioOnboarding onStockAdded={loadStocks} />
  ) : (
    <>
      <PortfolioSummary stocks={stocks} />
      <PortfolioGrowthChart stocks={stocks} />

      <div>
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4 text-center">
          Holdings · {stocks.length}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stocks.map((stock) => (
            <StockCard key={stock.id} stock={stock} onRefresh={loadStocks} />
          ))}
        </div>
      </div>
    </>
  )}
</main>
