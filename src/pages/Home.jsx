<main ... >
  <div style={{ background: 'yellow', padding: 40, fontSize: 24 }}>TEST — Portfolio Onboarding should appear below</div>
  {loading ? (
    <Loader2 ... />
  ) : stocks.length === 0 ? (
    <PortfolioOnboarding onStockAdded={loadStocks} />
  ) : (
    <div>Stocks found!</div>
  )}
</main>
